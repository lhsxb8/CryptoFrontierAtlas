import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { refreshNodeDataModules } from './node-data-cache.ts';

const require = createRequire(import.meta.url);
const config = require('../atlas.config.cjs');
const dataModule = 'virtual:cryptanalysis-data';
const comparisonModule = 'virtual:cryptanalysis-comparison';

/** Adapt the shared Node data loader to Vite; never reimplement the contract. */
export function analysisDataPlugin(profile: 'public' | 'internal'): Plugin {
  let projectRoot = process.cwd();
  let snapshot: any;
  let production = false;
  let serving = false;
  let reportLocalError = (_message: string) => {};
  const loaderFile = require.resolve('../lib/node/cryptanalysis/dataset.cjs');
  const runtimeRoot = resolve(dirname(loaderFile), '../../..');
  const watchPaths = () => [
    ...[profile === 'public' ? config.paths.publishedCryptanalysis : config.paths.cryptanalysis,
      config.paths.questions, config.paths.cryptanalysisSchemas].map(p => resolve(projectRoot, p)),
    resolve(runtimeRoot, 'lib/cryptanalysis'), resolve(runtimeRoot, 'lib/node/cryptanalysis'),
    resolve(projectRoot, 'data/primitives'), resolve(projectRoot, 'schemas/primitives'),
  ];
  const isDatasetFile = (file: string) => watchPaths().some(p => file === p || file.startsWith(p + sep));
  const isOptimizerInput = (file: string) => file.startsWith(resolve(runtimeRoot, 'lib/cryptanalysis') + sep)
    || ['result-taxonomy.json', 'problem-result.schema.json'].some(name => file === resolve(projectRoot, config.paths.cryptanalysisSchemas, name));
  const loadRaw = () => {
    refreshNodeDataModules(require, runtimeRoot, projectRoot);
    const dataset = require(loaderFile).loadDataset(projectRoot, profile);
    {
      const {loadPrimitiveCatalog, assertAnalysisCatalogCompatibility} = require('../lib/node/primitive-catalog.cjs');
      assertAnalysisCatalogCompatibility(loadPrimitiveCatalog(projectRoot), dataset.ciphers, dataset.variants);
    }
    return dataset;
  };
  const load = () => {
    try { return loadRaw(); }
    catch (cause) {
      if (!serving) throw cause;
      reportLocalError(cause instanceof Error ? cause.message : 'Analysis validation failed.');
      const error = new Error('Analysis data validation failed. See the local terminal.');
      error.stack = '';
      throw error;
    }
  };
  const asset = () => {
    const source = JSON.stringify(snapshot ??= load());
    const hash = require('node:crypto').createHash('sha256').update(source).digest('hex');
    return {source, hash, name: `analysis-${hash}.json`};
  };
  return {
    name: 'atlas-data-profile',
    configResolved(value) {
      projectRoot = value.root; production = value.command === 'build';
      serving = value.command === 'serve';
      reportLocalError = message => value.logger.error(message);
    },
    buildStart() {
      snapshot = load();
      for (const file of watchPaths()) this.addWatchFile(file);
    },
    generateBundle() {
      const data = snapshot ??= load();
      const published = asset();
      this.emitFile({type: 'asset', fileName: 'atlas-build-profile.json', source: JSON.stringify({
        schema_version: 2, profile, analysis_included: true,
        analysis_record_count: data.results.length, analysis_source_count: data.sources.length,
        analysis_entry_count: data.results.length + data.compactResults.length,
        analysis_family_count: data.familyCatalogs.reduce((count: number, catalog: any) => count + catalog.families.length, 0),
        problem_analysis_record_count: data.problemAnalyses.reduce((count: number, catalog: any) => count + catalog.results.length, 0),
        problem_analysis_family_count: data.problemAnalyses.reduce((count: number, catalog: any) => count + catalog.families.length, 0),
        analysis_sha256: published.hash, analysis_asset: published.name,
      }, null, 2) + '\n'});
      this.emitFile({type: 'asset', fileName: published.name, source: published.source});
    },
    resolveId(id) { if (id === dataModule || id === comparisonModule) return `\0${id}`; },
    load(id) {
      if (id === `\0${dataModule}`) {
        if (!production) return `export default ${JSON.stringify(snapshot ??= load())};`;
        // A content-addressed JSON asset avoids duplicating the complete corpus in
        // JavaScript and binds each application build to its checked snapshot.
        return `const response = await fetch(new URL(import.meta.env.BASE_URL + ${JSON.stringify(asset().name)}, document.baseURI));
if (!response.ok) throw new Error('Published analysis data could not be loaded.');
export default await response.json();`;
      }
      if (id === `\0${comparisonModule}`) {
        // Normal module resolution and Vite's CommonJS interoperability replace
        // source-string injection and the old hand-written fake require.
        return `export {comparability, compareReportedCosts} from '@atlas/comparator';`;
      }
    },
    configureServer(server) {
      server.watcher.add(watchPaths());
      let restarting = false;
      const reportError = (cause: unknown) => {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        server.config.logger.error(error.message);
        server.ws.send({type: 'error', err: {message: 'Analysis data validation failed. See the local terminal.', stack: '', plugin: 'atlas-data-profile'}});
      };
      const reload = (file: string) => {
        if (!isDatasetFile(file)) return;
        snapshot = undefined;
        for (const id of [dataModule, comparisonModule]) {
          const mod = server.moduleGraph.getModuleById(`\0${id}`);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        try {
          snapshot = load();
          if (isOptimizerInput(file)) {
            // Rebuild the browser's prebundled CJS graph together with Node's
            // refreshed graph when comparison semantics or taxonomy change.
            if (!restarting) {
              restarting = true;
              void server.restart(true).catch(reportError).finally(() => { restarting = false; });
            }
          } else server.ws.send({type: 'full-reload'});
        }
        catch (cause) { reportError(cause); }
      };
      for (const event of ['change', 'add', 'unlink'] as const) server.watcher.on(event, reload);
      server.httpServer?.once('close', () => {
        for (const event of ['change', 'add', 'unlink'] as const) server.watcher.off(event, reload);
      });
    },
    handleHotUpdate(context) { if (isDatasetFile(context.file)) return []; },
  };
}

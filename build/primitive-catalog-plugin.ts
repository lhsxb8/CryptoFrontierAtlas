import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { refreshNodeDataModules } from './node-data-cache.ts';

const require = createRequire(import.meta.url);
const moduleId = 'virtual:primitive-catalog';

/** Public definitions are validated independently of analysis availability. */
export function primitiveCatalogPlugin(): Plugin {
  let root = process.cwd();
  let snapshot: any;
  let serving = false;
  let reportLocalError = (_message: string) => {};
  const runtimeRoot = resolve(dirname(require.resolve('../lib/node/primitive-catalog.cjs')), '../..');
  const files = () => ['data/primitives', 'data/questions', 'data/cryptanalysis-public', 'schemas/primitives', 'package.json',
    'schemas/cryptanalysis', 'lib/node/cryptanalysis',
    'lib/node/primitive-catalog.cjs', 'lib/node/primitive-diagrams.cjs', 'lib/node/release.cjs',
    'docs/figures/primitives', 'public/figures/primitives', 'scripts/build-diagrams.mjs'].map(file => resolve(root, file));
  const watched = (file: string) => files().some(path => file === path || file.startsWith(path + sep));
  function loadRaw() {
    refreshNodeDataModules(require, runtimeRoot, root);
    const catalog = require('../lib/node/primitive-catalog.cjs').loadPrimitiveCatalog(root);
    const structures = require('../lib/node/primitive-diagrams.cjs').validateDiagramAssets(root, catalog);
    return { catalog, structures, release: require('../lib/node/release.cjs').releaseMetadata(root, catalog) };
  }
  function load() {
    try { return loadRaw(); }
    catch (cause) {
      if (!serving) throw cause;
      reportLocalError(cause instanceof Error ? cause.message : 'Public catalog validation failed.');
      const error = new Error('Public catalog validation failed. See the local terminal.');
      error.stack = '';
      throw error;
    }
  }
  return {
    name: 'atlas-public-primitive-catalog',
    configResolved(config) {
      root = config.root; serving = config.command === 'serve';
      reportLocalError = message => config.logger.error(message);
    },
    buildStart() { snapshot = load(); for (const file of files()) this.addWatchFile(file); },
    resolveId(id) { if (id === moduleId) return '\0' + id; },
    load(id) { if (id === '\0' + moduleId) return `export default ${JSON.stringify(snapshot ??= load())};`; },
    generateBundle() {
      const data = snapshot ??= load();
      for (const [fileName, value] of [['atlas-catalog.json', data.catalog], ['atlas-release.json', data.release], ['atlas-diagrams.json', data.structures]] as const) {
        this.emitFile({type: 'asset', fileName, source: JSON.stringify(value, null, 2) + '\n'});
      }
    },
    configureServer(server) {
      server.watcher.add(files());
      const reload = (file: string) => {
        if (!watched(file)) return;
        snapshot = undefined;
        const module = server.moduleGraph.getModuleById('\0' + moduleId);
        if (module) server.moduleGraph.invalidateModule(module);
        try { snapshot = load(); server.ws.send({type: 'full-reload'}); }
        catch (cause) {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          server.config.logger.error(error.message);
          server.ws.send({type: 'error', err: {message: 'Public catalog validation failed. See the local terminal.', stack: '', plugin: 'atlas-public-primitive-catalog'}});
        }
      };
      for (const event of ['add', 'change', 'unlink'] as const) server.watcher.on(event, reload);
      server.httpServer?.once('close', () => {
        for (const event of ['add', 'change', 'unlink'] as const) server.watcher.off(event, reload);
      });
    },
    handleHotUpdate(context) { if (watched(context.file)) return []; },
  };
}

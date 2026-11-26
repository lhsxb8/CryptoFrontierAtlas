import { createRequire } from 'node:module';
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { isFileServingAllowed, type Plugin, type ResolvedConfig } from 'vite';

const require = createRequire(import.meta.url);
const { privateHttpPath } = require('../lib/node/private-paths.cjs');
const { assertPublicAsset, publicAssetInventory, validatePublicAssets } = require('../lib/node/public-assets.cjs');
const sharedBuildInputs = [dirname(require.resolve('../lib/cryptanalysis/compare.cjs')),
  require.resolve('../schemas/cryptanalysis/result-taxonomy.json'),
  require.resolve('../schemas/cryptanalysis/problem-result.schema.json')];
const within = (root: string, file: string) => file === root || file.startsWith(root + sep);

/** HTTP and imported files share a boundary; trusted Node loaders remain usable. */
export function devBoundaryPlugin(): Plugin {
  let config: ResolvedConfig;
  let roots: string[] = [];
  // Resolve existing ancestors too: a symlinked directory must not become safe
  // merely because a requested child does not exist yet.
  function physical(file: string): string {
    if (existsSync(file)) return realpathSync(file);
    const parent = dirname(file);
    return parent === file ? file : resolve(physical(parent), relative(parent, file));
  }
  function allowed(file: string): boolean {
    try {
      if (!isAbsolute(file) || !roots.some(root => within(root, file) && !privateHttpPath(relative(root, file)))) return false;
      const actual = physical(file);
      const workspace = realpathSync(config.root);
      if (within(workspace, actual) && privateHttpPath(relative(workspace, actual))) return false;
      if (!roots.some(root => within(root, actual) && !privateHttpPath(relative(root, actual)))) return false;
      if (config.command === 'serve' && !isFileServingAllowed(config, file)) return false;
      if (config.publicDir && (within(config.publicDir, file) || within(config.publicDir, actual)) && existsSync(file)) {
        // '/' also corresponds to publicDir itself. Directories can fall through
        // to the app only after checking that no unregistered index was added.
        if (lstatSync(file).isDirectory()) validatePublicAssets(config.root);
        else assertPublicAsset(config.root, file, publicAssetInventory(config.root));
      }
      return true;
    } catch { return false; }
  }
  function requestAllowed(url: string): boolean {
    try {
      const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]);
      // Reject ambiguous encodings instead of relying on downstream decoding.
      if (!pathname.startsWith('/') || /[%\\\0\r\n]/.test(pathname) || pathname.split('/').includes('..')) return false;
      if (privateHttpPath(pathname)) return false;
      // Static files must not shadow Vite's reserved URLs or virtual modules.
      const publicFile = config.publicDir && resolve(config.publicDir, '.' + pathname);
      if (publicFile && existsSync(publicFile) && !allowed(publicFile)) return false;
      if (pathname.startsWith('/@fs/')) return allowed(resolve('/' + pathname.slice(5)));
      if (pathname.startsWith('/@id/') || pathname.startsWith('/@vite/') || pathname === '/@react-refresh') return true;
      let candidate = resolve(config.root, '.' + pathname);
      for (const alias of config.resolve.alias) {
        const matches = typeof alias.find === 'string'
          ? pathname === alias.find || pathname.startsWith(alias.find + '/')
          : (alias.find.lastIndex = 0, alias.find.test(pathname));
        if (matches) {
          const replaced = typeof alias.find === 'string'
            ? alias.replacement + pathname.slice(alias.find.length)
            : pathname.replace(alias.find, alias.replacement);
          candidate = isAbsolute(replaced) ? replaced : resolve(config.root, replaced);
          break;
        }
      }
      return allowed(candidate);
    } catch { return false; }
  }
  return {
    name: 'atlas-private-file-boundary', enforce: 'pre',
    config(value) {
      const root = resolve(value.root ?? process.cwd());
      const dependencies = resolve(root, 'node_modules');
      return { server: { host: value.server?.host ?? '127.0.0.1', fs: { strict: true,
        allow: [root, ...(existsSync(dependencies) ? [realpathSync(dependencies)] : [])] } },
        preview: { host: value.preview?.host ?? '127.0.0.1' } };
    },
    configResolved(value) {
      config = value;
      if (!config.server.fs.strict) throw new Error('Atlas requires strict development file access.');
      const dependencies = resolve(config.root, 'node_modules');
      if (existsSync(dependencies) && privateHttpPath(realpathSync(dependencies))) throw new Error('Unsafe dependency directory.');
      const shared = config.command === 'build' ? sharedBuildInputs.flatMap(file => [file, realpathSync(file)]) : [];
      if (shared.some(file => privateHttpPath(file))) throw new Error('Unsafe shared build input.');
      roots = Array.from(new Set([resolve(config.root), realpathSync(config.root),
        ...(existsSync(dependencies) ? [realpathSync(dependencies)] : []),
        // A programmatic build may reuse the pure core and its exact contracts from
        // another checkout. This grants no additional HTTP access.
        ...shared]));
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (requestAllowed(req.url ?? '')) return next();
        res.statusCode = 404;
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(req.method === 'HEAD' ? undefined : 'Not found');
      });
    },
    load(id) {
      if (!id.startsWith('\0') && isAbsolute(id.split(/[?#]/, 1)[0]) && !allowed(id.split(/[?#]/, 1)[0])) {
        throw new Error('File access is not permitted by the Atlas development boundary.'
          + (config.command === 'build' ? ` Build input: ${id}` : ''));
      }
      return null;
    },
  };
}

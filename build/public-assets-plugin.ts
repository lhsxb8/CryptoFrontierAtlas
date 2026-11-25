import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import distribution from '../lib/distribution.cjs';
import { createRequire } from 'node:module';

const { validatePublicAssets } = createRequire(import.meta.url)('../lib/node/public-assets.cjs');

export function publicAssetsPlugin(): Plugin {
  let root: string;
  return {
    name: 'atlas-public-assets',
    configResolved(config) {
      root = config.root;
      if (config.publicDir !== resolve(root, 'public')) throw new Error('Atlas requires its checked public asset directory.');
    },
    buildStart() { validatePublicAssets(root); },
    configureServer(server) {
      const validate = () => {
        try { validatePublicAssets(root); }
        catch {
          server.config.logger.error('Static asset validation failed. Check the approved asset inventory.');
          server.ws.send({type: 'error', err: {message: 'Static asset validation failed.', stack: '', plugin: 'atlas-public-assets'}});
        }
      };
      const changed = (file: string) => {
        if (file.startsWith(resolve(root, 'public') + sep) || file === resolve(root, 'data/primitives/diagram-assets.json')) validate();
      };
      for (const event of ['add', 'change', 'unlink'] as const) server.watcher.on(event, changed);
      server.httpServer?.once('close', () => {
        for (const event of ['add', 'change', 'unlink'] as const) server.watcher.off(event, changed);
      });
    },
    generateBundle() {
      validatePublicAssets(root);
      for (const fileName of distribution.publicAssetFiles) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(resolve(root, fileName)) });
      }
    },
  };
}

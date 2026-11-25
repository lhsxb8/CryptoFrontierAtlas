import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { analysisDataPlugin } from './build/analysis-data-plugin.ts';
import { publicAssetsPlugin } from './build/public-assets-plugin.ts';
import { primitiveCatalogPlugin } from './build/primitive-catalog-plugin.ts';
import { devBoundaryPlugin } from './build/dev-boundary-plugin.ts';

const atlas = createRequire(import.meta.url)('./atlas.config.cjs');

export default defineConfig(({ command, mode }) => ({
  plugins: [devBoundaryPlugin(), react(), primitiveCatalogPlugin(), analysisDataPlugin(atlas.analysisProfile(command, mode)), publicAssetsPlugin()],
  base: './',
  resolve: { alias: { '@atlas/comparator': fileURLToPath(new URL('./lib/cryptanalysis/compare.cjs', import.meta.url)) } },
  optimizeDeps: { include: ['@atlas/comparator'] },
}));

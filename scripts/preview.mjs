import assert from 'node:assert/strict';
import {readFileSync, lstatSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {preview} from 'vite';
import {checkPublicBundle} from './check-public-bundle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loopback = host => ['127.0.0.1', 'localhost', '::1'].includes(host);
export function previewArguments(args = []) {
  const {values} = parseArgs({args, options: {local: {type: 'boolean', default: false},
    host: {type: 'string', default: '127.0.0.1'}, port: {type: 'string', default: '4173'},
    outDir: {type: 'string'}, strictPort: {type: 'boolean', default: false}}});
  assert(/^\d+$/.test(values.port) && Number(values.port) <= 65535, 'Invalid preview port');
  assert(!values.local || loopback(values.host), 'Internal preview requires a loopback host');
  return {internal: values.local, outDir: values.outDir ?? (values.local ? 'dist-local' : 'dist'),
    host: values.host, port: Number(values.port), strictPort: values.strictPort};
}
export function verifyPreview(config, internal = false) {
  const directory = resolve(config.root, config.build.outDir);
  if (!internal) return checkPublicBundle({projectRoot: config.root, outputDirectory: directory});
  assert(loopback(config.preview.host), 'Internal preview requires a loopback host');
  assert(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink(), 'Invalid internal preview directory');
  const receipt = JSON.parse(readFileSync(join(directory, 'atlas-build-profile.json'), 'utf8'));
  assert(receipt.schema_version === 2 && receipt.profile === 'internal', 'Internal preview requires an internal build');
}
export async function startPreview(args = [], projectRoot = root) {
  const options = previewArguments(args);
  return preview({root: projectRoot, configFile: join(projectRoot, 'vite.config.ts'),
    build: {outDir: options.outDir}, preview: {host: options.host, port: options.port, strictPort: options.strictPort},
    plugins: [{name: 'atlas-checked-preview', configurePreviewServer(server) {
      // This runs before listening, and checks the resolved directory rather than
      // a default path that a CLI argument or configuration could replace.
      verifyPreview(server.config, options.internal);
    }}],
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const server = await startPreview(process.argv.slice(2)); server.printUrls(); }
  catch { console.error('Preview refused. Check the output profile, release checks, host and port arguments.'); process.exitCode = 1; }
}

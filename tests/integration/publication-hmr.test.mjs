import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync, readFileSync, writeFileSync, symlinkSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {setTimeout} from 'node:timers/promises';
import {createServer} from 'vite';
import {diagramFixture} from '../helpers/diagram-fixtures.mjs';
import {writePublicationFixture} from '../helpers/publication-fixtures.mjs';

const project = fileURLToPath(new URL('../..', import.meta.url));
const json = value => JSON.stringify(value, null, 2) + '\n';
async function until(condition) {
  const deadline = Date.now() + 10000;
  while (!condition()) {
    assert(Date.now() < deadline, 'Timed out waiting for development invalidation');
    await setTimeout(25);
  }
}

test('real HMR fails closed on policy, schema and validator edits, hides diagnostics and recovers', async t => {
  const {root, write, catalog} = diagramFixture(t);
  writePublicationFixture(root);
  for (const name of ['lib', 'build', 'atlas.config.cjs', 'schemas/primitives']) cpSync(join(project, name), join(root, name), {recursive: true});
  write('package.json', {type: 'module', version: '1.0.0'});
  symlinkSync(join(project, 'node_modules'), join(root, 'node_modules'), 'dir');
  createRequire(join(root, 'package.json'))('./lib/node/cryptanalysis/published.cjs').exportPublishedDataset(root);
  const {analysisDataPlugin} = await import(pathToFileURL(join(root, 'build/analysis-data-plugin.ts')));
  const {primitiveCatalogPlugin} = await import(pathToFileURL(join(root, 'build/primitive-catalog-plugin.ts')));
  const {devBoundaryPlugin} = await import(pathToFileURL(join(root, 'build/dev-boundary-plugin.ts')));
  const server = await createServer({root, configFile: false, logLevel: 'silent', publicDir: false,
    plugins: [devBoundaryPlugin(), primitiveCatalogPlugin(), analysisDataPlugin('public')],
    server: {port: 0}, optimizeDeps: {noDiscovery: true, include: []}});
  t.after(() => server.close());
  const messages = [], send = server.ws.send.bind(server.ws);
  server.ws.send = (...args) => {if (typeof args[0] === 'object') messages.push(args[0]); return send(...args);};
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const get = async (module, headers = {}) => {
    const response = await fetch(base + '/@id/__x00__virtual:' + module, {headers});
    return {status: response.status, body: await response.text(), etag: response.headers.get('etag')};
  };
  const first = await get('cryptanalysis-data');
  assert.equal(first.status, 200); assert.match(first.body, /synthetic-detailed-point/);
  assert.equal((await get('primitive-catalog')).status, 200);

  async function change(file, bytes, type, plugin = 'atlas-data-profile') {
    await until(() => server.watcher.getWatched()[dirname(join(root, file))]?.includes(file.split('/').at(-1)));
    // Distinct saves must not fall inside the filesystem watcher's change throttle.
    await setTimeout(120);
    const start = messages.length;
    writeFileSync(join(root, file), bytes);
    await until(() => messages.slice(start).some(m => m.type === type && (type !== 'error' || m.err.plugin === plugin)));
    for (const message of messages.slice(start).filter(m => m.type === 'error')) {
      assert.equal(message.err.stack, '');
      assert(!JSON.stringify(message).includes(root));
      assert(!JSON.stringify(message).includes('SYNTHETIC_PRIVATE_ERROR_DETAIL'));
    }
  }
  async function unavailable(module) {
    const result = await get(module, {'If-None-Match': first.etag});
    assert.equal(result.status, 500, 'A bad edit must not serve a cached projection or a 304');
    assert.match(result.body, /validation failed/);
    for (const secret of [root, 'curator_message', 'SYNTHETIC_PRIVATE_ERROR_DETAIL']) assert(!result.body.includes(secret));
  }

  const schemaFile = 'schemas/cryptanalysis/source.schema.json';
  const schema = JSON.parse(readFileSync(join(root, schemaFile), 'utf8'));
  schema.properties.curator_message = {type: 'string'};
  await change(schemaFile, json(schema), 'error');
  await unavailable('cryptanalysis-data');
  const policyFile = 'schemas/cryptanalysis/publication-fields.json';
  const policy = JSON.parse(readFileSync(join(root, policyFile), 'utf8'));
  policy.documents.source.internal.push('/curator_message');
  await change(policyFile, json(policy), 'full-reload');
  assert.equal((await get('cryptanalysis-data')).status, 200);
  policy.documents.source.internal.pop();
  await change(policyFile, json(policy), 'error');
  await unavailable('cryptanalysis-data');
  policy.documents.source.internal.push('/curator_message');
  await change(policyFile, json(policy), 'full-reload');

  const implementation = 'lib/node/cryptanalysis/publication-policy.cjs';
  const original = readFileSync(join(root, implementation), 'utf8');
  await change(implementation, original + "\nthrow new Error('SYNTHETIC_PRIVATE_ERROR_DETAIL');\n", 'error');
  await unavailable('cryptanalysis-data');
  await change(implementation, original, 'full-reload');
  assert.equal((await get('cryptanalysis-data')).status, 200);

  await change('data/primitives/catalog.json', json({...catalog, curator_message: 'SYNTHETIC_PRIVATE_ERROR_DETAIL'}),
    'error', 'atlas-public-primitive-catalog');
  await unavailable('primitive-catalog');
  await change('data/primitives/catalog.json', json(catalog), 'full-reload');
  assert.equal((await get('primitive-catalog')).status, 200);
  assert.equal((await get('cryptanalysis-data')).status, 200);
});

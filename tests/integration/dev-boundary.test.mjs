import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {request} from 'node:http';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
import {devBoundaryPlugin} from '../../build/dev-boundary-plugin.ts';

const project = fileURLToPath(new URL('../..', import.meta.url));
const {validatePublicAssets} = createRequire(import.meta.url)('../../lib/node/public-assets.cjs');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'atlas-http-boundary-'));
  const external = mkdtempSync(join(tmpdir(), 'atlas-external-file-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  t.after(() => rmSync(external, {recursive: true, force: true}));
  const write = (name, value) => {mkdirSync(dirname(join(root, name)), {recursive: true}); writeFileSync(join(root, name), value);};
  write('index.html', '<html><body><script type="module" src="/main.js"></script></body></html>');
  write('main.js', 'export const visible = "SYNTHETIC_PUBLIC_MODULE";');
  write('data/cryptanalysis/secret.json', '{"message":"SYNTHETIC_PRIVATE_BYTES"}');
  for (const file of ['AGENTS.md', '.local/config.json', '.agents/skills/test/SKILL.md', 'reports/note.md', '.env', '.git/config', 'dist-local/analysis.json']) write(file, 'SYNTHETIC_PRIVATE_BYTES');
  symlinkSync(join(project, 'node_modules'), join(root, 'node_modules'), 'dir');
  symlinkSync(join(root, 'data/cryptanalysis/secret.json'), join(root, 'innocent.json'));
  symlinkSync(join(root, 'data/cryptanalysis'), join(root, 'innocent-directory'), 'dir');
  writeFileSync(join(external, 'external.json'), 'SYNTHETIC_PRIVATE_BYTES');
  symlinkSync(join(external, 'external.json'), join(root, 'outside.json'));
  return {root, external, write};
}
function get(server, path, method = 'GET') {
  const {port} = server.httpServer.address();
  return new Promise((resolve, reject) => {
    const req = request({hostname: '127.0.0.1', port, path, method}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({status: res.statusCode, body: Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error', reject); req.end();
  });
}
for (const mode of ['public', 'internal']) test(`${mode}: real Vite HTTP rejects private files and import variants`, async t => {
  const {root, external, write} = fixture(t);
  const server = await createServer({root, mode, configFile: false, publicDir: false, logLevel: 'silent',
    plugins: [devBoundaryPlugin(), {
      name: 'synthetic-node-data-loader',
      resolveId(id) {if (id === 'virtual:atlas-test-data') return '\0' + id;},
      load(id) {if (id === '\0virtual:atlas-test-data') return `export default ${JSON.stringify(mode === 'internal'
        ? readFileSync(join(root, 'data/cryptanalysis/secret.json'), 'utf8') : 'SYNTHETIC_PUBLIC_DATA')}`;},
    }],
    resolve: {alias: {'/alias-secret': join(root, 'data/cryptanalysis/secret.json')}},
    server: {port: 0}, optimizeDeps: {noDiscovery: true, include: []},
  });
  t.after(() => server.close()); await server.listen();
  assert.equal(server.config.server.fs.strict, true);
  assert(server.config.server.fs.deny.some(pattern => pattern.includes('.env')), 'Vite default deny rules remain active');
  for (const path of ['/data/cryptanalysis/secret.json', `/@fs/${root}/data/cryptanalysis/secret.json`,
    '/AGENTS.md', '/AGENTS.md?raw', '/.local/config.json', '/.agents/skills/test/SKILL.md', '/reports/note.md',
    '/.env', '/.git/config', '/dist-local/analysis.json', '/innocent.json', '/innocent-directory/secret.json',
    '/alias-secret', '/data/%63ryptanalysis/secret.json', '/data%2fcryptanalysis%2fsecret.json',
    '/data/%2563ryptanalysis/secret.json', '/data/cryptanalysis/secret.json?import',
    '/data/cryptanalysis/secret.json?raw', '/data/cryptanalysis/secret.json?url', '/bad%ZZ',
    '/innocent-directory/missing.json', '/data/../AGENTS.md', '/outside.json', `/@fs/${external}/external.json`,
    `/@fs/${join(project, 'lib/cryptanalysis/compare.cjs')}`,
    `/@fs/${join(project, 'schemas/cryptanalysis/result-taxonomy.json')}`]) {
    const response = await get(server, path);
    assert.equal(response.status, 404, path);
    assert(!response.body.includes('SYNTHETIC_PRIVATE_BYTES') && !response.body.includes(root), path);
  }
  assert.deepEqual(await get(server, '/AGENTS.md', 'HEAD'), {status: 404, body: ''});
  assert.equal((await get(server, '/')).status, 200);
  assert.match((await get(server, '/main.js')).body, /SYNTHETIC_PUBLIC_MODULE/);
  assert.match((await get(server, `/@fs/${root}/main.js?raw`)).body, /SYNTHETIC_PUBLIC_MODULE/);
  const virtual = await get(server, '/@id/__x00__virtual:atlas-test-data');
  assert.equal(virtual.status, 200);
  assert.match(virtual.body, mode === 'internal' ? /SYNTHETIC_PRIVATE_BYTES/ : /SYNTHETIC_PUBLIC_DATA/);
  write('bad-import.js', 'import secret from "./innocent.json?raw"; export default secret;');
  await assert.rejects(server.transformRequest('/innocent.json?raw'), /not permitted/);
  // Normal source updates remain visible through the same server.
  write('main.js', 'export const visible = "SYNTHETIC_UPDATED_MODULE";');
  server.moduleGraph.invalidateAll();
  assert.match((await get(server, '/main.js?t=1')).body, /SYNTHETIC_UPDATED_MODULE/);
});

test('public static inventory and HTTP reject additions, changed bytes and symlinks', async t => {
  const {root, write} = fixture(t);
  cpSync(join(project, 'public'), join(root, 'public'), {recursive: true});
  cpSync(join(project, 'data/primitives'), join(root, 'data/primitives'), {recursive: true});
  validatePublicAssets(root);
  const server = await createServer({root, configFile: false, logLevel: 'silent', plugins: [devBoundaryPlugin()],
    server: {port: 0}, optimizeDeps: {noDiscovery: true, include: []}});
  t.after(() => server.close()); await server.listen();
  assert.equal((await get(server, '/')).status, 200, 'A checked public directory must not block the application entry');
  assert.equal((await get(server, '/main.js')).status, 200);
  assert.equal((await get(server, '/@vite/client')).status, 200);
  assert.equal((await get(server, '/fonts/source-serif/SourceSerif4-Semibold.otf.woff2')).status, 200);
  assert.equal((await get(server, '/figures/primitives/sm3-256--overview.svg')).status, 200);
  assert.equal((await get(server, '/figures/primitives/sm3-256--overview.tex')).status, 200);
  write('public/index.html', 'SYNTHETIC_PRIVATE_BYTES');
  assert.equal((await get(server, '/')).status, 404, 'Directory indexes cannot bypass the static inventory');
  rmSync(join(root, 'public/index.html'));
  write('public/@vite/client', 'SYNTHETIC_PRIVATE_BYTES');
  assert.equal((await get(server, '/@vite/client')).status, 404, 'Reserved URLs cannot bypass the static inventory');
  rmSync(join(root, 'public/@vite'), {recursive: true});
  write('public/innocent.txt', 'SYNTHETIC_PRIVATE_BYTES');
  assert.throws(() => validatePublicAssets(root), /Unapproved/);
  assert.equal((await get(server, '/innocent.txt')).status, 404);
  assert.equal((await get(server, `/@fs/${root}/public/innocent.txt`)).status, 404);
  rmSync(join(root, 'public/innocent.txt'));
  symlinkSync(join(root, 'data/cryptanalysis/secret.json'), join(root, 'public/innocent.txt'));
  assert.throws(() => validatePublicAssets(root), /redirected/);
  assert.equal((await get(server, '/innocent.txt')).status, 404);
  write('public/figures/primitives/sm3-256--overview.svg', 'SYNTHETIC_PRIVATE_BYTES');
  assert.throws(() => validatePublicAssets(root), /Changed|redirected/);
  assert.equal((await get(server, '/figures/primitives/sm3-256--overview.svg')).status, 404);
});

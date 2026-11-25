import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {previewArguments, verifyPreview} from '../../scripts/preview.mjs';

test('checked preview keeps explicit directory/port selection and restricts internal hosts', () => {
  assert.deepEqual(previewArguments([]), {internal: false, outDir: 'dist', host: '127.0.0.1', port: 4173, strictPort: false});
  assert.deepEqual(previewArguments(['--outDir', 'reviewed-output', '--host', '0.0.0.0', '--port', '8000', '--strictPort']),
    {internal: false, outDir: 'reviewed-output', host: '0.0.0.0', port: 8000, strictPort: true});
  assert.equal(previewArguments(['--local']).outDir, 'dist-local');
  for (const args of [['--local', '--host', '0.0.0.0'], ['--port', '-1'], ['--port', '99999'], ['--unknown'], ['--host']]) {
    assert.throws(() => previewArguments(args));
  }
});
test('the resolved preview directory is checked, not the default dist directory', t => {
  const root = mkdtempSync(join(tmpdir(), 'atlas-preview-policy-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  mkdirSync(join(root, 'dist-local'));
  writeFileSync(join(root, 'dist-local/atlas-build-profile.json'), JSON.stringify({schema_version: 2, profile: 'internal'}));
  const config = {root, build: {outDir: 'dist-local'}, preview: {host: '127.0.0.1'}};
  assert.doesNotThrow(() => verifyPreview(config, true));
  assert.throws(() => verifyPreview(config, false));
  assert.throws(() => verifyPreview({...config, preview: {host: '0.0.0.0'}}, true), /loopback/);
  assert.throws(() => verifyPreview({...config, build: {outDir: 'missing'}}, true));
});

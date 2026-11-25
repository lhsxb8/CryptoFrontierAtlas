import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundle = await build({entryPoints:[fileURLToPath(new URL('../../src/components/safe-url.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});
const {safeExternalUrl} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
test('evidence links accept absolute HTTP(S) only', () => {
  assert.equal(safeExternalUrl('https://example.org/paper'), 'https://example.org/paper');
  assert.equal(safeExternalUrl('http://example.org/paper'), 'http://example.org/paper');
  for (const value of [undefined,'javascript:alert(1)','data:text/html,test','//example.org','file:///etc/passwd','https://user:secret@example.org/','https://']) assert.equal(safeExternalUrl(value), null);
});

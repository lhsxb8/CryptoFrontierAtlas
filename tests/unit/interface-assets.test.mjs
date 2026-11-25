import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';

const asset = name => readFileSync(new URL('../../public/fonts/source-serif/' + name, import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('the self-hosted heading font is the unmodified pinned upstream WOFF2', () => {
  const font = asset('SourceSerif4-Semibold.otf.woff2');
  assert.equal(font.subarray(0, 4).toString(), 'wOF2');
  assert.equal(font.length, 112092);
  assert.equal(digest(font), '7eff2d2fde32c42992e723eb24dcc6dc5b640ef0da97ce373cd38e0604202e30');
});

test('the complete upstream font license accompanies the font and distribution notices', () => {
  const license = asset('LICENSE.md');
  assert.equal(digest(license), 'c21d7293d87b6d7ab1d0229a2f55b77f33a7613a6a4e66f6693d68d7d8d09464');
  assert.ok(readFileSync(new URL('../../THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8').includes(license.toString().trim()));
});

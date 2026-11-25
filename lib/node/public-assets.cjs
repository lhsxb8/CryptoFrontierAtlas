'use strict';

const assert = require('node:assert/strict');
const {readFileSync, readdirSync, lstatSync} = require('node:fs');
const {join, resolve, relative, sep} = require('node:path');
const {createHash} = require('node:crypto');
const {privateHttpPath} = require('./private-paths.cjs');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fixedAssets = Object.freeze({
  'fonts/source-serif/LICENSE.md': 'c21d7293d87b6d7ab1d0229a2f55b77f33a7613a6a4e66f6693d68d7d8d09464',
  'fonts/source-serif/SourceSerif4-Semibold.otf.woff2': '7eff2d2fde32c42992e723eb24dcc6dc5b640ef0da97ce373cd38e0604202e30',
});
function publicAssetInventory(root) {
  const manifest = JSON.parse(readFileSync(join(root, 'data/primitives/diagram-assets.json'), 'utf8'));
  assert(manifest.schema_version === 1 && Array.isArray(manifest.assets), 'Invalid static asset manifest');
  const approved = new Map(Object.entries(fixedAssets));
  for (const asset of manifest.assets) for (const [field, hash] of [['asset', 'svg_sha256'], ['tex', 'tex_sha256']]) {
    const name = asset[field];
    assert(typeof name === 'string' && /^figures\/primitives\/[a-z0-9-]+\.(?:svg|tex)$/.test(name)
      && !approved.has(name) && /^[a-f0-9]{64}$/.test(asset[hash]), 'Invalid static asset identity');
    approved.set(name, asset[hash]);
  }
  return approved;
}
function assertPublicAsset(root, file, approved = publicAssetInventory(root)) {
  const directory = resolve(root, 'public'), name = relative(directory, resolve(file)).split(sep).join('/');
  assert(approved.has(name) && !privateHttpPath(name), 'Unapproved static asset');
  let cursor = directory;
  assert(lstatSync(cursor).isDirectory() && !lstatSync(cursor).isSymbolicLink(), 'Redirected static directory');
  for (const part of name.split('/')) {
    cursor = join(cursor, part);
    assert(!lstatSync(cursor).isSymbolicLink(), 'Redirected static asset');
  }
  assert(lstatSync(cursor).isFile() && digest(readFileSync(cursor)) === approved.get(name), 'Changed static asset');
}
function validatePublicAssets(root) {
  const approved = publicAssetInventory(root), directory = join(root, 'public'), found = [];
  const visit = (dir, prefix = '') => {
    assert(!lstatSync(dir).isSymbolicLink() && lstatSync(dir).isDirectory(), 'Redirected static directory');
    for (const name of readdirSync(dir).sort()) {
      const file = join(dir, name), relativeName = prefix + name, info = lstatSync(file);
      assert(!info.isSymbolicLink() && !privateHttpPath(relativeName), 'Private or redirected static asset');
      if (info.isDirectory()) {
        assert([...approved.keys()].some(key => key.startsWith(relativeName + '/')), 'Unapproved static directory');
        visit(file, relativeName + '/');
      } else { assertPublicAsset(root, file, approved); found.push(relativeName); }
    }
  };
  visit(directory);
  assert.deepEqual(found.sort(), [...approved.keys()].sort(), 'Incomplete static asset inventory');
  return approved;
}
module.exports = {publicAssetInventory, assertPublicAsset, validatePublicAssets};

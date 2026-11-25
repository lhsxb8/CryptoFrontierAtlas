import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkPublicSource} from '../../scripts/check-public-source.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'atlas-source-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  mkdirSync(join(root, 'tests/unit'), {recursive:true});
  writeFileSync(join(root, 'README.md'), 'Synthetic public project.');
  return root;
}
function privateReference(t) {
  const root = fixture(t), directory = join(root, 'data/cryptanalysis');
  mkdirSync(join(directory, 'results'), {recursive:true});
  const write = (file,value) => writeFileSync(join(directory,file), JSON.stringify(value));
  write('manifest.json', {local_only:true, records:['synthetic-private-record'], record_count:1, source_count:1});
  write('sources.json', [{id:'synthetic-private-source', content_sha256:null}]);
  write('ciphers.json', [{id:'test-cipher', name:'Test', primitive_type:'block_cipher', aliases:[], description:'Synthetic private catalog.'}]);
  write('variants.json', [{id:'test-cipher-128', family:'test-cipher', full_rounds:10, key_bits:128, block_bits:128}]);
  write('coverage.json', {issues:[], pending_sources:[], family_ids:['test-cipher']});
  write('results/synthetic-private-record.json', {id:'synthetic-private-record', result_kind:'synthetic', target:{}, setting:{}, resources:{}});
  return root;
}

test('source checks scan ordinary tests for private corpus identifiers', t => {
  const projectRoot = fixture(t), markerRoot = privateReference(t);
  assert.equal(checkPublicSource({projectRoot,markerRoot}).fileCount, 1);
  writeFileSync(join(projectRoot,'tests/unit/ordinary.test.mjs'), "const result = 'synthetic-private-record';");
  assert.throws(() => checkPublicSource({projectRoot,markerRoot}), /ordinary\.test\.mjs: private corpus content/);
});

test('candidate source checks include untracked files and reject force-tracked secrets', t => {
  const projectRoot = fixture(t);
  assert.equal(spawnSync('git',['init','--quiet'],{cwd:projectRoot}).status, 0);
  writeFileSync(join(projectRoot,'tests/unit/ordinary.test.mjs'), `const token = '${'ghp_' + 'x'.repeat(40)}';`);
  assert.throws(() => checkPublicSource({projectRoot,markerRoot:projectRoot}), /credential-like/);
  writeFileSync(join(projectRoot,'tests/unit/ordinary.test.mjs'), '// Synthetic behavior test.');
  writeFileSync(join(projectRoot,'.env'), 'SYNTHETIC_SECRET=example');
  assert.equal(spawnSync('git',['add','--force','--','.env'],{cwd:projectRoot}).status, 0);
  assert.throws(() => checkPublicSource({projectRoot,markerRoot:projectRoot}), /\.env: private path/);
});

test('source checks permit public citations and reject unchecked symlinks', t => {
  const projectRoot = fixture(t);
  writeFileSync(join(projectRoot,'README.md'), 'Public discussion of AES and EUROCRYPT proceedings.');
  assert.equal(checkPublicSource({projectRoot,markerRoot:projectRoot}).fileCount, 1);
  symlinkSync(join(projectRoot,'README.md'), join(projectRoot,'tests/unit/redirect.test.mjs'));
  assert.throws(() => checkPublicSource({projectRoot,markerRoot:projectRoot}), /source symlink/);
});

test('one workspace checks local data while exporting only source files', t => {
  const projectRoot = privateReference(t);
  mkdirSync(join(projectRoot, '.local'), {recursive:true});
  writeFileSync(join(projectRoot, '.local/notes.md'), 'synthetic-private-record');
  assert.equal(checkPublicSource({projectRoot,markerRoot:projectRoot}).fileCount, 1);
  writeFileSync(join(projectRoot, 'README.md'), 'synthetic-private-record');
  assert.throws(() => checkPublicSource({projectRoot,markerRoot:projectRoot}), /README\.md: private corpus content/);
});

test('local publication rules inspect source without printing matched content', t => {
  const projectRoot = fixture(t);
  mkdirSync(join(projectRoot, '.local'), {recursive:true});
  writeFileSync(join(projectRoot, '.local/publication-policy.json'), JSON.stringify({patterns:['synthetic-restricted-value']}));
  assert.equal(checkPublicSource({projectRoot,markerRoot:projectRoot}).fileCount, 1);
  writeFileSync(join(projectRoot, 'README.md'), 'synthetic-restricted-value');
  assert.throws(() => checkPublicSource({projectRoot,markerRoot:projectRoot}), error =>
    /README\.md: restricted content/.test(error.message) && !error.message.includes('synthetic-restricted-value'));
});

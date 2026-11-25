import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {catalogFixture} from '../helpers/primitive-catalog-fixtures.mjs';
const {checkVersion, publicDataRevision, releaseMetadata, citationScalar} = createRequire(import.meta.url)('../../lib/node/release.cjs');

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'atlas-version-fixture-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const write = (file, value) => writeFileSync(join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  write('package.json', {version: '1.0.0'});
  write('package-lock.json', {version: '1.0.0', packages: {'': {version: '1.0.0'}}});
  write('CHANGELOG.md', '# Changelog\n\n## Unreleased\n\n## 1.0.0\n\n- Synthetic release.\n');
  for (const dir of ['data/questions', 'data/primitives', 'data/cryptanalysis-public']) mkdirSync(join(root, dir), {recursive: true});
  write('data/questions/fixture.json', {schema_version: '0.2.0', title: 'Synthetic question'});
  write('data/primitives/catalog.json', catalogFixture());
  return {root, write};
}

test('application, lockfile, changelog, citation and release tags share one version', t => {
  const {root, write} = fixture(t);
  assert.equal(checkVersion(root, {tag: 'v1.0.0'}), '1.0.0');
  assert.throws(() => checkVersion(root, {tag: 'v1.0.1'}), /tag\/application/);
  assert.throws(() => checkVersion(root, {requireCitation: true}), /real authors/);
  write('CITATION.cff', 'version: "1.0.0"\n');
  checkVersion(root, {requireCitation: true});
  write('CITATION.cff', 'version: 0.2.0\n');
  assert.throws(() => checkVersion(root), /Citation\/application/);
  assert.equal(citationScalar("version: '1.0.0'\n", 'version'), '1.0.0');
});

test('version checks reject stale lockfiles and changelogs', t => {
  const {root, write} = fixture(t);
  write('package-lock.json', {version: '1.0.0', packages: {'': {version: '0.2.0'}}});
  assert.throws(() => checkVersion(root), /root-package/);
  write('package-lock.json', {version: '1.0.0', packages: {'': {version: '1.0.0'}}});
  write('CHANGELOG.md', '## 0.2.0\n');
  assert.throws(() => checkVersion(root), /changelog/);
});

test('data edits change a deterministic revision without changing application or schema versions', t => {
  const {root, write} = fixture(t);
  const original = publicDataRevision(root), packageBytes = readFileSync(join(root, 'package.json'), 'utf8');
  assert.equal(publicDataRevision(root), original);
  write('data/questions/fixture.json', {schema_version: '0.2.0', title: 'Corrected synthetic question'});
  assert.notEqual(publicDataRevision(root), original);
  assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), packageBytes);
  assert.equal(checkVersion(root), '1.0.0');
  const changed = publicDataRevision(root);
  write('data/cryptanalysis-public/synthetic.json', {id: 'synthetic-public-result'});
  assert.notEqual(publicDataRevision(root), changed);
  const withAnalyses = publicDataRevision(root);
  mkdirSync(join(root, 'data/cryptanalysis'), {recursive: true});
  write('data/cryptanalysis/manifest.json', 'Synthetic private bytes, deliberately not JSON.');
  assert.equal(publicDataRevision(root), withAnalyses);
  write('package.json', {version: '1.0.1'});
  assert.equal(publicDataRevision(root), withAnalyses);
  const release = releaseMetadata(root, catalogFixture());
  assert.equal(release.application_version, '1.0.1');
  assert.equal(release.data_revision, withAnalyses);
  assert.equal(release.primitive_count, 4);
});

test('data revisions refuse symlinks into unrelated files', t => {
  const {root} = fixture(t);
  symlinkSync(join(root, 'package.json'), join(root, 'data/questions/redirect.json'));
  assert.throws(() => publicDataRevision(root), /symlinks/);
});

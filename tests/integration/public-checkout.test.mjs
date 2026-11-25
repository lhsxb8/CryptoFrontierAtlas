import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {build, loadConfigFromFile} from 'vite';
import {checkPublicBundle} from '../../scripts/check-public-bundle.mjs';
import {publicSourceFiles} from '../../scripts/check-public-source.mjs';
import {startPreview} from '../../scripts/preview.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const {loadDataset} = require('../../lib/node/cryptanalysis/dataset.cjs');
const {validateDataset} = require('../../lib/node/cryptanalysis/check-data.cjs');
const config = require('../../atlas.config.cjs');

test('data profiles are explicit and unknown production modes use the public snapshot', () => {
  for (const mode of ['public', 'production', 'staging', 'preview', '']) assert.equal(config.analysisProfile('build', mode), 'public');
  assert.equal(config.analysisProfile('build', 'internal'), 'internal');
  assert.equal(config.analysisProfile('serve', 'development'), 'public');
  assert.equal(config.analysisProfile('serve', 'internal'), 'internal');
  assert.equal(config.analysisProfile('serve', 'public'), 'public');
});

test('missing public data fails closed instead of rendering an empty analysis site', t => {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-empty-checkout-'));
  t.after(() => rmSync(directory, {recursive:true, force:true}));
  assert.throws(() => loadDataset(directory, 'public'), /ENOENT/);
  assert.throws(() => validateDataset(directory), /Cryptanalysis dataset is not configured/);
});

test('a public checkout builds the complete snapshot without the local corpus, skills or reports', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-public-checkout-'));
  t.after(() => rmSync(directory, {recursive:true, force:true}));
  for (const name of publicSourceFiles(root)) {
    mkdirSync(dirname(join(directory, name)), {recursive:true});
    cpSync(join(root, name), join(directory, name));
  }
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  for (const name of ['data/cryptanalysis', '.agents', '.cache', '.local', 'CryptanalysisFrontierAtlas']) assert.equal(existsSync(join(directory, name)), false);
  await build({root:directory, configFile:join(directory, 'vite.config.ts'), mode:'public', logLevel:'silent'});
  const output = join(directory, 'dist');
  const receipt = JSON.parse(readFileSync(join(output, 'atlas-build-profile.json'), 'utf8'));
  assert.equal(receipt.profile, 'public');
  const publication = JSON.parse(readFileSync(join(directory, 'data/cryptanalysis-public/publication.json'), 'utf8'));
  assert.equal(receipt.schema_version, 2);
  assert.equal(receipt.analysis_included, true);
  assert.equal(receipt.analysis_record_count, publication.counts.records);
  assert.equal(receipt.analysis_source_count, publication.counts.sources);
  const publicData = JSON.parse(readFileSync(join(output, receipt.analysis_asset), 'utf8'));
  assert.equal(publicData.enabled, true);
  assert.equal(publicData.compactResults.length, publication.counts.compact_only);
  assert(publicData.results.length > 0);
  const catalogPath = join(output, 'atlas-catalog.json');
  const releasePath = join(output, 'atlas-release.json');
  const catalogBytes = readFileSync(catalogPath, 'utf8');
  const releaseBytes = readFileSync(releasePath, 'utf8');
  const catalog = JSON.parse(catalogBytes), release = JSON.parse(releaseBytes);
  assert(catalog.primitives.length > 0);
  assert.equal(release.application_version, JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version);
  assert.equal(release.primitive_count, catalog.primitives.length);
  assert.match(release.data_revision, /^[a-f0-9]{64}$/);
  checkPublicBundle({projectRoot:directory, outputDirectory:output});
  const shared = await loadConfigFromFile({command: 'build', mode: 'public'}, join(root, 'vite.config.ts'));
  await build({...shared.config, configFile: false, root: directory, logLevel: 'silent', build: {outDir: 'shared-build'}});
  checkPublicBundle({projectRoot:directory, outputDirectory:join(directory, 'shared-build')});
  const analysisPath = join(output, receipt.analysis_asset), analysisBytes = readFileSync(analysisPath, 'utf8');
  writeFileSync(analysisPath, JSON.stringify({...publicData, results: []}));
  assert.throws(() => checkPublicBundle({projectRoot:directory, outputDirectory:output}), /published analysis asset/);
  writeFileSync(analysisPath, analysisBytes);
  writeFileSync(releasePath, JSON.stringify({...release, application_version: '0.0.0'}));
  assert.throws(() => checkPublicBundle({projectRoot:directory, outputDirectory:output}), /stale public catalog\/release metadata/);
  writeFileSync(releasePath, releaseBytes);
  writeFileSync(catalogPath, JSON.stringify({...catalog, results: [{id: 'synthetic-private-record'}]}));
  assert.throws(() => checkPublicBundle({projectRoot:directory, outputDirectory:output}), error =>
    /invalid or stale public catalog/.test(error.message) && !error.message.includes('synthetic-private-record'));
  writeFileSync(catalogPath, catalogBytes);
  checkPublicBundle({projectRoot:directory, outputDirectory:output});
  // Exercise the actual checked entrypoint, including a caller-selected output.
  const preview = await startPreview(['--port', '0', '--strictPort'], directory);
  try {
    const response = await fetch(`http://127.0.0.1:${preview.httpServer.address().port}/`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), readFileSync(join(output, 'index.html'), 'utf8'));
  } finally { await new Promise((resolve, reject) => preview.httpServer.close(error => error ? reject(error) : resolve())); }
  await assert.rejects(startPreview(['--local', '--outDir', 'dist', '--port', '0'], directory), /internal build/);
  mkdirSync(join(directory, 'dist-local'));
  writeFileSync(join(directory, 'dist-local/index.html'), '<html><body>Synthetic internal preview</body></html>');
  writeFileSync(join(directory, 'dist-local/main.js'), 'export default 1;');
  writeFileSync(join(directory, 'dist-local/atlas-build-profile.json'), JSON.stringify({schema_version: 2, profile: 'internal'}));
  await assert.rejects(startPreview(['--outDir', 'dist-local', '--port', '0'], directory), /profile public/);
  const local = await startPreview(['--local', '--port', '0'], directory);
  try { assert.equal(local.httpServer.address().address, '127.0.0.1'); }
  finally { await new Promise((resolve, reject) => local.httpServer.close(error => error ? reject(error) : resolve())); }
  const corpus = spawnSync(process.execPath, ['scripts/test-corpus.mjs'], {cwd:directory, encoding:'utf8'});
  assert.equal(corpus.status, 1);
  assert.match(corpus.stderr, /Dataset tests require a configured cryptanalysis dataset/);
  const architecture = spawnSync(process.execPath, ['scripts/check-architecture.mjs'], {cwd:directory, encoding:'utf8'});
  assert.equal(architecture.status, 0, architecture.stderr);
  mkdirSync(join(directory, '.local'));
  writeFileSync(join(directory, '.local/publication-policy.json'), JSON.stringify({patterns:['synthetic-restricted-value']}));
  const asset = join(output, 'restricted.js');
  writeFileSync(asset, 'export const value = "synthetic-restricted-value";');
  assert.throws(() => checkPublicBundle({projectRoot:directory, outputDirectory:output}), error =>
    /restricted\.js: restricted content/.test(error.message) && !error.message.includes('synthetic-restricted-value'));
  rmSync(asset);
  mkdirSync(join(output, 'data/cryptanalysis'), {recursive:true});
  writeFileSync(join(output, 'data/cryptanalysis/unknown.json'), '{}');
  assert.throws(() => checkPublicBundle({projectRoot:directory, outputDirectory:output}), /Public release rejected/);
});

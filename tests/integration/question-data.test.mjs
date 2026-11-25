import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson(join(root, 'data/questions/manifest.json'));
const bundled = await build({
  entryPoints: [join(root, 'src/features/questions/data.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  logLevel: 'silent',
});
const frontendData = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

test('actual frontend question imports match the entire manifest without duplicates or omissions', () => {
  const ids = frontendData.problems.map(problem => problem.id);
  assert.equal(ids.length, manifest.record_count);
  assert.equal(new Set(ids).size, ids.length, 'Frontend question IDs must be unique');
  assert.deepEqual([...ids].sort(), [...manifest.records].sort());
});

test('actual frontend question values equal their canonical JSON records', () => {
  for (const problem of frontendData.problems) {
    assert.deepEqual(problem, readJson(join(root, 'data/questions/problems', `${problem.id}.json`)), problem.id);
  }
});

test('frontend question dataset version matches the manifest', () => {
  assert.equal(frontendData.datasetVersion, manifest.dataset_version);
});

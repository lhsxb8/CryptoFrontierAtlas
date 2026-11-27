import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {standardizationFixture} from '../helpers/standardization-fixtures.mjs';
const {validatePrimitiveCatalog} = createRequire(import.meta.url)('../../lib/node/primitive-catalog.cjs');
const bundle = await build({entryPoints: [fileURLToPath(new URL('../../src/features/primitives/standards.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm'});
const {standardsForTarget, standardsForInstances, standardPriority, standardInstanceOrder, standardSearchText}
  = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('standards apply only to explicitly bound instances, never citations, dependencies or siblings', () => {
  const catalog = standardizationFixture();
  validatePrimitiveCatalog(catalog);
  assert.equal(standardsForInstances(catalog, ['fixture-block-128']).length, 1);
  assert.deepEqual(standardsForInstances(catalog, ['fixture-block-256']), []);
  assert.deepEqual(standardsForInstances(catalog, ['fixture-xof-128']), []);
  assert.deepEqual(standardsForInstances(catalog, ['unregistered-instance']), []);
  assert.deepEqual(standardsForTarget(catalog, 'fixture-block', 'fixture-permutation-256'), {matches: [], total: 0});
  const family = standardsForTarget(catalog, 'fixture-block');
  assert.equal(family.total, 2);
  assert.deepEqual(family.matches[0].instanceIds, ['fixture-block-128']);
  assert.match(standardSearchText(catalog, 'fixture-block'), /Synthetic International Standard/);
});

test('current adoption precedes unverified profiles and withdrawn profiles come last without mutating instances', () => {
  const catalog = standardizationFixture();
  const before = structuredClone(catalog.instances);
  const sorted = standardInstanceOrder(catalog, catalog.instances);
  assert.deepEqual(sorted.map(instance => instance.id), ['fixture-block-128', 'fixture-permutation-256', 'fixture-block-256', 'fixture-xof-128', 'fixture-mac-128']);
  assert.deepEqual(catalog.instances, before);
  assert.equal(standardPriority(standardsForTarget(catalog, 'fixture-mac').matches), 2);
  assert.equal(standardPriority([]), 1);
  delete catalog.standardization;
  assert.deepEqual(standardInstanceOrder(catalog, catalog.instances), before);
  assert.deepEqual(standardsForTarget(catalog, 'fixture-block').matches, []);
});

test('withdrawal takes precedence even when the same profile retains a published standard', () => {
  const catalog = standardizationFixture();
  catalog.standardization.standards[2].bindings.push({instance_ids: ['fixture-block-128'], locator: 'Synthetic withdrawn national adoption.', role: 'algorithm'});
  validatePrimitiveCatalog(catalog);
  const family = standardsForTarget(catalog, 'fixture-block');
  assert.equal(family.matches.length, 2);
  assert.equal(standardPriority(family.matches), 2);
  assert.equal(standardPriority(standardsForInstances(catalog, ['fixture-block-256'])), 1);
  assert.deepEqual(standardInstanceOrder(catalog, catalog.instances).map(instance => instance.id),
    ['fixture-permutation-256', 'fixture-block-256', 'fixture-xof-128', 'fixture-block-128', 'fixture-mac-128']);
});

test('standardization rejects stale coverage, invented bodies, wrong sources and implicit scopes', () => {
  for (const mutate of [
    c => c.standardization.reviewed_instance_ids.pop(),
    c => c.standardization.reviewed_instance_ids.push('absent'),
    c => c.standardization.reviewed_instance_ids.push(c.instances[0].id),
    c => c.standardization.standards.push(structuredClone(c.standardization.standards[0])),
    c => {c.standardization.standards[0].bindings[0].instance_ids = ['absent'];},
    c => {c.standardization.standards[0].bindings[0].instance_ids = [];},
    c => c.standardization.standards[0].bindings.push(structuredClone(c.standardization.standards[0].bindings[0])),
    c => {c.standardization.standards[0].specification_id = 'absent';},
    c => {c.standardization.standards[0].specification_id = 'fixture-rfc';},
    c => {c.specifications[0].kind = 'submission';},
    c => {c.standardization.checked_on = '2026-01-02';},
    c => {c.standardization.standards[0].level = 'competition';},
    c => {c.standardization.standards[0].jurisdiction = 'US';},
    c => {delete c.standardization.standards[1].jurisdiction;},
    c => {c.standardization.standards[1].jurisdiction = 'United States';},
    c => {c.standardization.standards[1].bindings[0].role = 'algorithm';},
    c => {c.standardization.standards[0].bindings[0].internal_review = 'Synthetic internal note';},
    c => {c.standardization.standards[0].document_type = 'recommendation';},
  ]) {
    const catalog = standardizationFixture(); mutate(catalog);
    assert.throws(() => validatePrimitiveCatalog(catalog));
  }
});

test('several standards and profiles are aggregated without duplicate instances or family-wide inheritance', () => {
  const catalog = standardizationFixture();
  catalog.standardization.standards[0].bindings.push({instance_ids: ['fixture-block-256'], locator: 'Separately checked profile.', role: 'algorithm'});
  catalog.standardization.standards[1].bindings.push({instance_ids: ['fixture-block-128'], locator: 'Independent national adoption.', role: 'algorithm'});
  validatePrimitiveCatalog(catalog);
  const family = standardsForTarget(catalog, 'fixture-block');
  assert.equal(family.matches.length, 2);
  assert.deepEqual(family.matches[0].instanceIds, ['fixture-block-128','fixture-block-256']);
  assert.deepEqual(family.matches[1].instanceIds, ['fixture-block-128']);
});

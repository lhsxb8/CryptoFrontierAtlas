import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {catalogFixture} from '../helpers/primitive-catalog-fixtures.mjs';
const {validatePrimitiveCatalog, assertAnalysisCatalogCompatibility} = createRequire(import.meta.url)('../../lib/node/primitive-catalog.cjs');

test('a public directory accepts typed parameters and families without instances or analysis', () => {
  const catalog = catalogFixture();
  assert.equal(validatePrimitiveCatalog(catalog), catalog);
  catalog.instances = [];
  validatePrimitiveCatalog(catalog);
  assertAnalysisCatalogCompatibility(catalog, [], []);
});

test('directory validation rejects duplicate IDs, missing references and construction cycles', () => {
  for (const mutate of [
    c => c.primitives.push(structuredClone(c.primitives[0])),
    c => c.instances.push(structuredClone(c.instances[0])),
    c => c.categories.push(structuredClone(c.categories[0])),
    c => c.specifications.push(structuredClone(c.specifications[0])),
    c => {c.instances[0].family_id = 'missing';},
    c => {c.instances[0].specification_ids = ['missing'];},
    c => {c.primitives[0].uses = ['missing'];},
    c => {c.primitives[0].uses = ['fixture-mac'];},
  ]) {
    const catalog = catalogFixture(); mutate(catalog);
    assert.throws(() => validatePrimitiveCatalog(catalog));
  }
});

test('typed parameters reject invented key fields, malformed sponges and mismatched MACs', () => {
  for (const mutate of [
    c => {c.instances[1].parameters.key_bits = 128;},
    c => {c.instances[2].parameters.output_bits = 256;},
    c => {c.instances[2].parameters.capacity_bits = 64;},
    c => {c.instances[3].parameters.key_bits = 256;},
    c => {c.instances[3].parameters.tag_bits = 256;},
    c => {c.instances[0].parameters.rounds = 0;},
    c => {c.instances[0].parameters.rounds = 0.5;},
    c => {c.instances[0].family_id = 'fixture-permutation';},
    c => {c.instances[0].parameters.key_encoding_bits = 64;},
  ]) {
    const catalog = catalogFixture(); mutate(catalog);
    assert.throws(() => validatePrimitiveCatalog(catalog));
  }
});

test('specification statuses have dates and safe public links, not inferred security labels', () => {
  const catalog = catalogFixture(), spec = catalog.specifications[0];
  spec.status = 'withdrawn';
  assert.throws(() => validatePrimitiveCatalog(catalog));
  spec.withdrawn_on = '2025-01-01'; validatePrimitiveCatalog(catalog);
  spec.withdrawn_on = '2027-01-01'; assert.throws(() => validatePrimitiveCatalog(catalog));
  for (const url of ['javascript:alert(1)', 'https://user:password@example.invalid/spec']) {
    const copy = catalogFixture(); copy.specifications[0].url = url;
    assert.throws(() => validatePrimitiveCatalog(copy));
  }
});

test('public catalog contracts cannot embed analysis records, source audit fields or unknown metadata', () => {
  for (const mutate of [
    c => {c.results = [{id: 'synthetic-private-record'}];},
    c => {c.specifications[0].inspected_version = 'Synthetic private audit';},
    c => {c.primitives[0].coverage = {exhaustive: true};},
    c => {c.instances[0].resources = {time: 5};},
  ]) {
    const catalog = catalogFixture(); mutate(catalog);
    assert.throws(() => validatePrimitiveCatalog(catalog), /Primitive catalog/);
  }
});

test('analysis compatibility checks stable IDs and never coerce unrelated scientific targets', () => {
  const catalog = catalogFixture();
  const ciphers = [{id: 'fixture-block', primitive_type: 'block_cipher'}];
  const variants = [{id: 'fixture-block-128', family: 'fixture-block', key_bits: 128, block_bits: 128, full_rounds: 10}];
  assertAnalysisCatalogCompatibility(catalog, ciphers, variants);
  for (const change of [{key_bits: 256}, {block_bits: 64}, {full_rounds: 12}, {family: 'other'}]) {
    assert.throws(() => assertAnalysisCatalogCompatibility(catalog, ciphers, [{...variants[0], ...change}]), /mismatch/);
  }
  assert.throws(() => assertAnalysisCatalogCompatibility(catalog, [{...ciphers[0], primitive_type: 'stream_cipher'}], variants), /mismatch/);
  assert.throws(() => assertAnalysisCatalogCompatibility(catalog, [], [{id: 'fixture-xof-128', family: 'fixture-xof', full_rounds: 12}]), /adapter required/);
  assertAnalysisCatalogCompatibility(catalog, ciphers, [{id: 'synthetic-special-instance', family: 'fixture-block', full_rounds: 99}]);
});

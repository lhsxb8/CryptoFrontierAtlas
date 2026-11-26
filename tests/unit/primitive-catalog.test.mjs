import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {catalogFixture, asymmetricCatalogFixture, hardProblemCatalogFixture} from '../helpers/primitive-catalog-fixtures.mjs';
const {validatePrimitiveCatalog, assertAnalysisCatalogCompatibility} = createRequire(import.meta.url)('../../lib/node/primitive-catalog.cjs');

test('hard problems are first, source-backed definitions separate from algorithm instances', () => {
  const catalog = hardProblemCatalogFixture();
  validatePrimitiveCatalog(catalog);
  assert.equal(catalog.hard_problems.length, 9);
  assert.equal(catalog.categories.filter(c => c.domain === 'asymmetric')[0].id, 'hard_problem');
  assertAnalysisCatalogCompatibility(catalog, [], []);
  for (const p of catalog.hard_problems) {
    assert(!catalog.instances.some(i => i.family_id === p.id));
    assert.throws(() => assertAnalysisCatalogCompatibility(catalog, [{id: p.id}], []), /hard-problem scientific target adapter required/);
    assert.throws(() => assertAnalysisCatalogCompatibility(catalog, [], [{id: p.id, family: 'fixture-block'}]), /hard-problem scientific target adapter required/);
    assert.throws(() => assertAnalysisCatalogCompatibility(catalog, [], [{id: 'synthetic-target', family: p.id}]), /hard-problem scientific target adapter required/);
  }
});

test('problem contracts reject missing parameters, implicit publication fields and invalid links', () => {
  for (const mutate of [
    c => {c.hard_problems[0].parameters.key_bits = 128;},
    c => {delete c.hard_problems[0].parameters.modulus;},
    c => {c.hard_problems[0].parameters.type = 'lwe';},
    c => {c.hard_problems[0].parameters.modulus = 128;},
    c => {c.hard_problems[0].review_note = 'synthetic internal field';},
    c => {c.hard_problems[0].references[0].source_id = 'absent';},
    c => {c.hard_problems[0].references = [];},
    c => {c.hard_problems[0].references.push({...c.hard_problems[0].references[0]});},
    c => {c.hard_problems[0].related_scheme_ids = ['fixture-block'];},
    c => {c.hard_problems[0].related_scheme_ids = ['missing'];},
    c => {c.hard_problems[0].related_problem_ids = [c.hard_problems[0].id];},
    c => {c.hard_problems[0].related_problem_ids = ['missing'];},
    c => {c.hard_problems[0].id = c.primitives[0].id;},
    c => {c.hard_problems[0].id = c.instances[0].id;},
    c => {c.hard_problems.push(structuredClone(c.hard_problems[0]));},
    c => {c.problem_sources.push(structuredClone(c.problem_sources[0]));},
    c => {c.problem_sources[0].url = 'https://user:secret@example.invalid/';},
    c => {c.problem_sources[0].url = 'javascript:alert(1)';},
    c => {c.problem_sources[0].internal_note = 'synthetic';},
    c => {c.hard_problems[0].formulations[0].kind = 'decision';},
    c => {c.hard_problems.find(p => p.parameters.type === 'lwe').formulations.pop();},
    c => {c.hard_problems.find(p => p.parameters.type === 'lwe').formulations[1].kind = 'search';},
    c => {c.categories.find(g => g.id === 'hard_problem').domain = 'symmetric';},
    c => {c.categories.push(c.categories.splice(c.categories.findIndex(g => g.id === 'hard_problem'), 1)[0]);},
    c => {c.primitives[0].category = 'hard_problem';},
    c => {c.categories = c.categories.filter(g => g.id !== 'hard_problem');},
  ]) {
    const catalog = hardProblemCatalogFixture(); mutate(catalog);
    assert.throws(() => validatePrimitiveCatalog(catalog));
  }
});

test('asymmetric contracts accept explicit schemes without synthesizing scientific targets', () => {
  const catalog = asymmetricCatalogFixture();
  validatePrimitiveCatalog(catalog);
  assertAnalysisCatalogCompatibility(catalog, [], []);
  const instance = catalog.instances.find(i => i.parameters.scheme === 'ml_kem');
  assert.throws(() => assertAnalysisCatalogCompatibility(catalog, [{id: instance.family_id, primitive_type: 'kem'}], []), /adapter required/);
  assert.throws(() => assertAnalysisCatalogCompatibility(catalog, [], [{id: instance.id, family: instance.family_id, full_rounds: 1}]), /adapter required/);
});

test('domain, purpose and scheme validation fail closed', () => {
  for (const mutate of [
    c => {c.categories[0].domain = 'asymmetric';},
    c => {c.categories.at(-1).domain = 'symmetric';},
    c => {delete c.categories[0].domain;},
    c => {c.instances.at(-1).parameters.rounds = 12;},
    c => {c.instances.at(-1).parameters.scheme = 'unclassified';},
    c => {c.instances.at(-1).parameters.type = 'kem';},
    c => {c.instances.at(-1).parameters.internal_note = 'synthetic';},
    c => {c.instances.at(-1).parameters.parameter_set = 'SLH-DSA-unregistered';},
    c => {c.instances.at(-1).parameters.hash_family = 'SHAKE';},
    c => {c.instances.at(-1).parameters.signature_bytes++;},
    c => {c.instances.at(-1).parameters.context_hex = 'not-hex';},
    c => {c.instances.at(-1).parameters.context_hex = 'ab'.repeat(256);},
    c => {c.instances.at(-2).family_id = c.instances.at(-1).family_id;},
  ]) {
    const c = asymmetricCatalogFixture(); mutate(c);
    assert.throws(() => validatePrimitiveCatalog(c));
  }
});

test('named parameters reject inconsistent sizes, curves, encodings and security categories', () => {
  for (const [scheme, field, value] of [
    ['rsaes_oaep', 'modulus_bits', 128], ['rsassa_pss', 'salt_bytes', 1000],
    ['ffdhe', 'modulus_bits', 3072], ['ecdh', 'field_bits', 384],
    ['xdh', 'public_key_bytes', 57], ['ecdsa', 'curve', 'curveSM2'],
    ['eddsa', 'signature_bytes', 114], ['eddsa', 'context_hex', 'aa'],
    ['sm2_encryption', 'ciphertext_order', 'C1C2C3'], ['sm2_signature', 'hash', 'SHA-256'],
    ['ml_kem', 'ciphertext_bytes', 1088], ['ml_kem', 'security_category', 3],
    ['ml_dsa', 'matrix_columns', 8], ['ml_dsa', 'secret_key_bytes', 32],
    ['slh_dsa', 'hypertree_layers', 22],
  ]) {
    const c = asymmetricCatalogFixture();
    c.instances.find(i => i.parameters.scheme === scheme).parameters[field] = value;
    assert.throws(() => validatePrimitiveCatalog(c), undefined, `${scheme}/${field}`);
  }
});

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

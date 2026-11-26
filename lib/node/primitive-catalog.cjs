'use strict';

const assert = require('node:assert/strict');
const {readFileSync, lstatSync} = require('node:fs');
const {resolve} = require('node:path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const root = resolve(__dirname, '../..');
const schema = JSON.parse(readFileSync(resolve(root, 'schemas/primitives/catalog.schema.json'), 'utf8'));
const ajv = new Ajv({allErrors: true, strict: true});
addFormats(ajv);
const validate = ajv.compile(schema);

function uniqueMap(entries, label) {
  const map = new Map(entries.map(entry => [entry.id, entry]));
  assert.equal(map.size, entries.length, `Duplicate ${label} ID`);
  return map;
}

/** Named standard parameter sets constrain encodings, not measured attack costs. */
function checkAsymmetricParameters(id, p) {
  const equalFields = expected => {
    for (const [key, value] of Object.entries(expected)) assert.equal(p[key], value, `${id}: inconsistent ${key}`);
  };
  if (p.scheme === 'rsaes_oaep' || p.scheme === 'rsassa_pss') {
    const hashBytes = {'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64}[p.hash];
    if (p.scheme === 'rsaes_oaep') assert(Math.ceil(p.modulus_bits / 8) >= 2 * hashBytes + 2, `${id}: RSA modulus cannot fit OAEP encoding`);
    else assert(Math.ceil((p.modulus_bits - 1) / 8) >= hashBytes + p.salt_bytes + 2, `${id}: RSA modulus cannot fit PSS encoding`);
  }
  if (p.scheme === 'ffdhe') equalFields({modulus_bits: Number(p.group.slice(5))});
  if (p.scheme === 'ecdh' || p.scheme === 'ecdsa') equalFields({field_bits: {'P-256': 256, 'P-384': 384, 'P-521': 521}[p.curve]});
  if (p.scheme === 'xdh') equalFields(p.function === 'X25519'
    ? {field_bits: 255, public_key_bytes: 32, shared_secret_bytes: 32}
    : {field_bits: 448, public_key_bytes: 56, shared_secret_bytes: 56});
  if (p.scheme === 'eddsa') equalFields(p.variant === 'Ed25519'
    ? {field_bits: 255, public_key_bytes: 32, signature_bytes: 64, hash: 'SHA-512', context_hex: ''}
    : {field_bits: 448, public_key_bytes: 57, signature_bytes: 114, hash: 'SHAKE256'});
  if (p.scheme === 'ml_kem') {
    const sets = {
      'ML-KEM-512': [1, 2, 800, 1632, 768],
      'ML-KEM-768': [3, 3, 1184, 2400, 1088],
      'ML-KEM-1024': [5, 4, 1568, 3168, 1568],
    };
    equalFields(Object.fromEntries(['security_category', 'module_rank', 'public_key_bytes', 'secret_key_bytes', 'ciphertext_bytes']
      .map((key, index) => [key, sets[p.parameter_set][index]])));
  }
  if (p.scheme === 'ml_dsa') {
    const sets = {
      'ML-DSA-44': [2, 4, 4, 1312, 2560, 2420],
      'ML-DSA-65': [3, 6, 5, 1952, 4032, 3309],
      'ML-DSA-87': [5, 8, 7, 2592, 4896, 4627],
    };
    equalFields(Object.fromEntries(['security_category', 'matrix_rows', 'matrix_columns', 'public_key_bytes', 'secret_key_bytes', 'signature_bytes']
      .map((key, index) => [key, sets[p.parameter_set][index]])));
  }
  if (p.scheme === 'slh_dsa') {
    const small = p.parameter_set.endsWith('128s');
    equalFields({hash_family: p.parameter_set.includes('-SHA2-') ? 'SHA2' : 'SHAKE', public_key_bytes: 32, secret_key_bytes: 64,
      hypertree_height: small ? 63 : 66, hypertree_layers: small ? 7 : 22,
      fors_height: small ? 12 : 6, fors_trees: small ? 14 : 33, signature_bytes: small ? 7856 : 17088});
  }
}

function validatePrimitiveCatalog(catalog) {
  assert(validate(catalog), 'Primitive catalog: ' + ajv.errorsText(validate.errors));
  const categories = uniqueMap(catalog.categories, 'category');
  const specs = uniqueMap(catalog.specifications, 'specification');
  const primitives = uniqueMap(catalog.primitives, 'primitive');
  const instances = uniqueMap(catalog.instances, 'instance');
  const problems = uniqueMap(catalog.hard_problems, 'hard problem');
  const problemSources = uniqueMap(catalog.problem_sources, 'problem source');
  const directoryIds = [...primitives.keys(), ...instances.keys(), ...problems.keys()];
  assert.equal(new Set(directoryIds).size, directoryIds.length, 'Ambiguous directory ID');
  for (const source of problemSources.values()) {
    const url = new URL(source.url);
    assert(!url.username && !url.password, `${source.id}: credential-bearing problem source URL`);
  }
  if (problems.size) {
    assert.equal(catalog.categories.filter(c => c.domain === 'asymmetric')[0]?.id, 'hard_problem', 'Hard problems must be the first asymmetric category');
  }
  for (const problem of problems.values()) {
    assert(categories.has(problem.category), `${problem.id}: unregistered problem category`);
    assert.equal(new Set(problem.references.map(r => r.source_id)).size, problem.references.length, `${problem.id}: duplicate problem reference`);
    assert(problem.references.every(r => problemSources.has(r.source_id)), `${problem.id}: unknown problem reference`);
    const kinds = problem.formulations.map(f => f.kind).sort();
    const expected = ['lwe', 'ring_lwe', 'module_lwe'].includes(problem.parameters.type) ? ['decision', 'search'] : ['search'];
    assert.deepEqual(kinds, expected, `${problem.id}: inconsistent problem formulations`);
    assert(problem.related_scheme_ids.every(id => primitives.has(id) && categories.get(primitives.get(id).category)?.domain === 'asymmetric'), `${problem.id}: invalid related scheme`);
    assert(problem.related_problem_ids.every(id => problems.has(id) && id !== problem.id), `${problem.id}: invalid related problem`);
  }
  const references = item => {
    for (const id of item.specification_ids) assert(specs.has(id), `${item.id}: unknown specification`);
  };
  for (const spec of specs.values()) {
    const url = new URL(spec.url);
    assert(!url.username && !url.password, `${spec.id}: credential-bearing specification URL`);
    if (spec.withdrawn_on) assert(spec.withdrawn_on <= spec.checked_on, `${spec.id}: withdrawal after status check`);
  }
  for (const primitive of primitives.values()) {
    references(primitive);
    assert(categories.has(primitive.category), `${primitive.id}: unregistered category`);
    for (const id of primitive.uses) assert(primitives.has(id) && id !== primitive.id, `${primitive.id}: invalid dependency`);
  }
  const visited = new Set(), active = new Set();
  function visit(id) {
    assert(!active.has(id), 'Cyclic primitive dependencies');
    if (visited.has(id)) return;
    active.add(id);
    for (const dependency of primitives.get(id).uses) visit(dependency);
    active.delete(id); visited.add(id);
  }
  for (const id of primitives.keys()) visit(id);
  for (const instance of instances.values()) {
    references(instance);
    const family = primitives.get(instance.family_id), p = instance.parameters;
    assert(family, `${instance.id}: unknown family`);
    assert.equal(p.type, family.category, `${instance.id}: parameter/category mismatch`);
    if ('scheme' in p) checkAsymmetricParameters(instance.id, p);
    assert(instance.specification_ids.every(id => family.specification_ids.includes(id)), `${instance.id}: specification not registered for family`);
    if ('capacity_bits' in p) assert.equal(p.rate_bits + p.capacity_bits, p.state_bits, `${instance.id}: rate + capacity != state`);
    if ('key_encoding_bits' in p) assert(p.key_encoding_bits >= p.key_bits, `${instance.id}: key encoding shorter than key material`);
    if (p.type === 'mac') {
      const cipher = instances.get(p.cipher_instance_id);
      assert(cipher?.parameters.type === 'block_cipher', `${instance.id}: unknown block-cipher instance`);
      assert(family.uses.includes(cipher.family_id), `${instance.id}: missing construction dependency`);
      assert.equal(p.key_bits, cipher.parameters.key_bits, `${instance.id}: MAC key size mismatch`);
      assert.equal(p.block_bits, cipher.parameters.block_bits, `${instance.id}: MAC block size mismatch`);
      assert(p.tag_bits <= p.block_bits, `${instance.id}: MAC tag exceeds block size`);
    }
  }
  for (const family of primitives.values()) {
    const schemes = new Set([...instances.values()].filter(i => i.family_id === family.id).map(i => i.parameters.scheme));
    assert(schemes.size <= 1, `${family.id}: mixed schemes require separate families`);
  }
  return catalog;
}

function loadPrimitiveCatalog(projectRoot = root) {
  const file = resolve(projectRoot, 'data/primitives/catalog.json');
  assert(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink(), 'Primitive catalog must be a regular file');
  return validatePrimitiveCatalog(JSON.parse(readFileSync(file, 'utf8')));
}

/** Join only matching target definitions; directory entries never imply results. */
function assertAnalysisCatalogCompatibility(catalog, ciphers, variants) {
  const families = new Map(catalog.primitives.map(p => [p.id, p]));
  const instances = new Map(catalog.instances.map(p => [p.id, p]));
  for (const cipher of ciphers) {
    assert(!catalog.hard_problems.some(p => p.id === cipher.id), `${cipher.id}: hard-problem scientific target adapter required`);
    const primitive = families.get(cipher.id);
    if (primitive) {
      assert.equal(catalog.categories.find(c => c.id === primitive.category)?.domain, 'symmetric', `${cipher.id}: asymmetric scientific target adapter required`);
      assert.equal(cipher.primitive_type, primitive.category, `${cipher.id}: analysis/directory category mismatch`);
    }
  }
  for (const variant of variants) {
    assert(!catalog.hard_problems.some(p => p.id === variant.id || p.id === variant.family), `${variant.id}: hard-problem scientific target adapter required`);
    const instance = instances.get(variant.id);
    if (!instance) continue;
    assert.equal(variant.family, instance.family_id, `${variant.id}: analysis/directory family mismatch`);
    const p = instance.parameters;
    // The existing scientific contract counts rounds of one primitive. A
    // composite construction needs its own adapter, never an inferred product.
    assert(['block_cipher', 'stream_cipher', 'permutation'].includes(p.type) && !p.stages,
      `${variant.id}: scientific target adapter required`);
    for (const key of ['key_bits', 'block_bits']) {
      if (key in p) assert.equal(variant[key], p[key], `${variant.id}: analysis/directory ${key} mismatch`);
      else assert.equal(variant[key], undefined, `${variant.id}: inapplicable analysis ${key}`);
    }
    assert.equal(variant.full_rounds, p.rounds, `${variant.id}: analysis/directory round mismatch`);
  }
}

module.exports = {loadPrimitiveCatalog, validatePrimitiveCatalog, assertAnalysisCatalogCompatibility};

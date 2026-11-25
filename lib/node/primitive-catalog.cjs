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

function validatePrimitiveCatalog(catalog) {
  assert(validate(catalog), 'Primitive catalog: ' + ajv.errorsText(validate.errors));
  const categories = uniqueMap(catalog.categories, 'category');
  const specs = uniqueMap(catalog.specifications, 'specification');
  const primitives = uniqueMap(catalog.primitives, 'primitive');
  const instances = uniqueMap(catalog.instances, 'instance');
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
    const primitive = families.get(cipher.id);
    if (primitive) assert.equal(cipher.primitive_type, primitive.category, `${cipher.id}: analysis/directory category mismatch`);
  }
  for (const variant of variants) {
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

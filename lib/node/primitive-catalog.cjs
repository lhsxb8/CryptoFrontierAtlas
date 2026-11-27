'use strict';

const assert = require('node:assert/strict');
const {readFileSync, lstatSync} = require('node:fs');
const {resolve} = require('node:path');
const {checkPrimeSync} = require('node:crypto');
const {kemSets, slhSets} = require('./primitive-parameter-sets.cjs');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const root = resolve(__dirname, '../..');
const schema = JSON.parse(readFileSync(resolve(root, 'schemas/primitives/catalog.schema.json'), 'utf8'));
const ajv = new Ajv({allErrors: true, strict: true});
addFormats(ajv);
const validate = ajv.compile(schema);

function safeUrl(value, label) {
  const url = new URL(value);
  assert(url.protocol === 'https:' && !url.username && !url.password, `${label}: unsafe or credential-bearing URL`);
  return url;
}

function checkFieldParameters(id, p) {
  const modulus = BigInt(p.field_modulus);
  assert(modulus > 2n && modulus % 2n === 1n, `${id}: field modulus must be an odd integer greater than two`);
  assert(checkPrimeSync(modulus, {checks: 64}), `${id}: composite field modulus`);
  // Probable-prime screening and exponent invertibility are not security claims.
  let a = BigInt(p.sbox_exponent), b = modulus - 1n;
  assert(a > 1n && a < modulus - 1n, `${id}: invalid S-box exponent`);
  while (b) [a, b] = [b, a % b];
  assert.equal(a, 1n, `${id}: non-invertible power S-box`);
  if (p.construction === 'prime_field_sponge') {
    assert.equal(p.rate_elements + p.capacity_elements, p.state_elements, `${id}: rate + capacity != field state`);
    assert(p.full_rounds % 2 === 0, `${id}: full rounds must split evenly around partial rounds`);
  }
}

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
    const [security_category, hash_bytes, hypertree_height, hypertree_layers, fors_height, fors_trees, signature_bytes] = slhSets[p.parameter_set.split('-').at(-1)];
    equalFields({hash_family: p.parameter_set.includes('-SHA2-') ? 'SHA2' : 'SHAKE', security_category, hash_bytes,
      public_key_bytes: 2 * hash_bytes, secret_key_bytes: 4 * hash_bytes,
      hypertree_height, hypertree_layers, fors_height, fors_trees, signature_bytes});
  }
  if (p.type === 'kem' && p.scheme !== 'ml_kem') {
    assert(kemSets[p.parameter_set], `${id}: unregistered KEM profile`);
    equalFields(kemSets[p.parameter_set]);
  }
  if (p.scheme === 'dsa') {
    assert([[1024,160],[2048,224],[2048,256],[3072,256]].some(([l,n]) => p.modulus_bits === l && p.subgroup_bits === n), `${id}: invalid DSA L/N pair`);
    assert(({'SHA-256':256,'SHA-384':384,'SHA-512':512})[p.hash] >= p.subgroup_bits, `${id}: DSA hash too short`);
  }
  if (p.scheme === 'rsassa_pkcs1_v1_5') {
    assert(Math.ceil(p.modulus_bits / 8) >= ({'SHA-256':51,'SHA-384':67,'SHA-512':83})[p.hash] + 11, `${id}: RSA modulus cannot fit PKCS1 signature encoding`);
  }
  if (p.scheme === 'falcon') equalFields(p.parameter_set === 'Falcon-512'
    ? {polynomial_degree:512, security_category:1, public_key_bytes:897, signature_bytes:666}
    : {polynomial_degree:1024, security_category:5, public_key_bytes:1793, signature_bytes:1280});
  if (p.scheme === 'xmss' || p.scheme === 'xmssmt') {
    const match = /^XMSS(MT)?-SHA2_(\d+)(?:\/(\d+))?_256$/.exec(p.parameter_set);
    equalFields({tree_height:Number(match[2]), tree_layers:Number(match[3] ?? 1)});
    assert(p.tree_height % p.tree_layers === 0, `${id}: unequal XMSSMT layers`);
  }
  if (p.scheme === 'lms' || p.scheme === 'hss') {
    assert.equal(p.parameter_set, p.scheme === 'lms' ? `LMS_SHA256_M32_H${p.tree_height}+LMOTS_SHA256_N32_W8`
      : `HSS-L2-LMS_SHA256_M32_H${p.tree_height}+LMOTS_SHA256_N32_W8`, `${id}: mismatched stateful signature profile`);
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
    const observations = new Set();
    for (const observation of spec.citation_observations ?? []) {
      const url = safeUrl(observation.url, spec.id);
      const identity = `${observation.provider}/${observation.work_id}`;
      assert(!observations.has(identity), `${spec.id}: duplicate citation observation`); observations.add(identity);
      assert(observation.checked_on <= spec.checked_on, `${spec.id}: citation observation after source check`);
      if (observation.provider === 'openalex') {
        assert(/^W[0-9]+$/.test(observation.work_id), `${spec.id}: invalid OpenAlex work ID`);
        assert.equal(url.href, `https://openalex.org/${observation.work_id}`, `${spec.id}: mismatched OpenAlex evidence URL`);
      }
    }
  }
  for (const primitive of primitives.values()) {
    references(primitive);
    assert(categories.has(primitive.category), `${primitive.id}: unregistered category`);
    for (const id of primitive.uses) assert(primitives.has(id) && id !== primitive.id, `${primitive.id}: invalid dependency`);
    for (const inclusion of primitive.inclusion ?? []) {
      assert(primitive.specification_ids.includes(inclusion.specification_id), `${primitive.id}: inclusion source is not registered`);
      const source = specs.get(inclusion.specification_id);
      if (inclusion.reason === 'high_citation') {
        assert(['design_paper', 'designer_specification', 'submission', 'standard', 'rfc'].includes(source.kind), `${primitive.id}: unclassified citation source`);
        assert(source.citation_observations?.some(o => o.cited_by_count > 300), `${primitive.id}: citation threshold requires a verified count above 300`);
      }
    }
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
    if ('tweakey_bits' in p) assert.equal(p.key_bits + (p.tweak_bits ?? 0), p.tweakey_bits, `${instance.id}: key + tweak != tweakey`);
    if ('field_modulus' in p) checkFieldParameters(instance.id, p);
    if ('working_state_bits' in p) assert(p.working_state_bits >= p.chaining_bits, `${instance.id}: compression state shorter than chaining value`);
    if (p.type === 'hash_function' && 'chaining_bits' in p) assert(p.output_bits <= p.chaining_bits, `${instance.id}: digest exceeds chaining value`);
    if ('rate_bits' in p && 'state_bits' in p) assert(p.rate_bits <= p.state_bits, `${instance.id}: rate exceeds state`);
    if (p.type === 'stream_cipher' && 'output_bits_per_step' in p && 'state_bits' in p) assert(p.output_bits_per_step <= p.state_bits, `${instance.id}: output step exceeds state`);
    if (p.construction === 'scmac') {
      const stream = instances.get(p.stream_instance_id), q = stream?.parameters;
      assert(q?.type === 'stream_cipher' && 'output_bits_per_step' in q, `${instance.id}: SCMAC requires a feedback stream instance`);
      assert(family.uses.includes(stream.family_id), `${instance.id}: missing stream dependency`);
      for (const field of ['key_bits','nonce_bits','initialization_steps']) assert.equal(p[field], q[field], `${instance.id}: SCMAC ${field} mismatch`);
      assert.equal(p.stream_state_bits, q.state_bits, `${instance.id}: SCMAC stream-state mismatch`);
      assert.equal(p.rate_bits, q.output_bits_per_step, `${instance.id}: SCMAC rate mismatch`);
      assert.equal(p.state_bits, p.stream_state_bits + p.mac_state_bits, `${instance.id}: SCMAC total-state mismatch`);
      assert(p.tag_bits <= 128, `${instance.id}: SCMAC selected profiles support tags up to 128 bits`);
    }
    if (p.type === 'mac' && 'cipher_instance_id' in p) {
      const cipher = instances.get(p.cipher_instance_id);
      assert(cipher?.parameters.type === 'block_cipher', `${instance.id}: unknown block-cipher instance`);
      assert(family.uses.includes(cipher.family_id), `${instance.id}: missing construction dependency`);
      assert.equal(p.key_bits, cipher.parameters.key_bits, `${instance.id}: MAC key size mismatch`);
      assert.equal(p.block_bits, cipher.parameters.block_bits, `${instance.id}: MAC block size mismatch`);
      assert(p.tag_bits <= p.block_bits, `${instance.id}: MAC tag exceeds block size`);
    }
    if (p.construction === 'block_cipher_compression') {
      const cipher = instances.get(p.cipher_instance_id), q = cipher?.parameters;
      assert(q?.type === 'block_cipher' && !q.construction && !q.stages && !q.tweak_bits && !q.tweakey_bits,
        `${instance.id}: compression requires a plain block-cipher instance`);
      assert(family.uses.includes(cipher.family_id), `${instance.id}: missing compression dependency`);
      assert.equal(p.chaining_bits, q.block_bits, `${instance.id}: compression chaining width mismatch`);
      assert.equal(p.output_bits, q.block_bits, `${instance.id}: compression output width mismatch`);
      assert.equal(p.message_bits, p.mode === 'dm' ? q.key_bits : q.block_bits, `${instance.id}: compression message width mismatch`);
      assert.equal(p.cipher_rounds, q.rounds, `${instance.id}: compression round basis mismatch`);
      if (p.mode !== 'dm') assert.equal(q.key_bits, q.block_bits, `${instance.id}: MMO/MP require an explicit mapping for unequal key/block widths`);
    }
    if (p.type === 'mac' && p.construction === 'hmac') {
      const hash = instances.get(p.hash_instance_id);
      assert(hash?.parameters.type === 'hash_function' && hash.parameters.construction !== 'block_cipher_compression' && 'block_bits' in hash.parameters, `${instance.id}: unknown HMAC hash instance`);
      assert(family.uses.includes(hash.family_id), `${instance.id}: missing hash dependency`);
      assert.equal(p.block_bits, hash.parameters.block_bits, `${instance.id}: HMAC block size mismatch`);
      assert(p.tag_bits <= hash.parameters.output_bits, `${instance.id}: HMAC tag exceeds digest`);
    }
  }
  for (const family of primitives.values()) {
    const schemes = new Set([...instances.values()].filter(i => i.family_id === family.id).map(i => i.parameters.scheme));
    assert(schemes.size <= 1, `${family.id}: mixed schemes require separate families`);
    const compressionModes = new Set([...instances.values()].filter(i => i.family_id === family.id).map(i => i.parameters.mode));
    assert(compressionModes.size <= 1, `${family.id}: mixed compression modes require separate families`);
  }
  if (catalog.standardization) {
    const review = catalog.standardization;
    assert.deepEqual([...review.reviewed_instance_ids].sort(), [...instances.keys()].sort(),
      'Standardization review must cover exactly the registered instances; review new or removed profiles explicitly');
    const standardSources = new Set();
    for (const standard of review.standards) {
      const id = standard.specification_id, source = specs.get(id);
      assert(source?.kind === 'standard', `${id}: standardization requires an explicitly classified standard source, not an RFC or submission`);
      assert(!standardSources.has(id), `${id}: duplicate standardization source`); standardSources.add(id);
      assert(source.checked_on >= review.checked_on, `${id}: standard status predates the standardization review`);
      const bound = new Set();
      for (const binding of standard.bindings) for (const instanceId of binding.instance_ids) {
        assert(instances.has(instanceId), `${id}: standardization refers to an unknown instance`);
        assert(!bound.has(instanceId), `${id}: duplicate standardization binding`); bound.add(instanceId);
        const instance = instances.get(instanceId);
        if (instance.parameters.type === 'permutation' || instance.parameters.construction === 'block_cipher_compression') {
          assert.equal(binding.role, 'component', `${instanceId}: a standardized component is not a complete algorithm`);
        }
      }
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
    if (variant.compression) assert(instance, `${variant.id}: compression target needs a public directory definition`);
    if (!instance) continue;
    assert.equal(variant.family, instance.family_id, `${variant.id}: analysis/directory family mismatch`);
    const p = instance.parameters;
    if (p.construction === 'block_cipher_compression') {
      assert(variant.compression, `${variant.id}: compression scientific target adapter required`);
      assert.equal(variant.compression.mode, p.mode, `${variant.id}: compression mode mismatch`);
      assert.equal(variant.compression.cipher_variant_id, p.cipher_instance_id, `${variant.id}: compression dependency mismatch`);
      assert.equal(variant.compression.name, families.get(instance.family_id).name, `${variant.id}: compression name mismatch`);
      assert.equal(variant.compression.output_bits, p.output_bits, `${variant.id}: compression output mismatch`);
      assert.equal(variant.full_rounds, p.cipher_rounds, `${variant.id}: compression round mismatch`);
      assert.equal(variant.key_bits, undefined, `${variant.id}: compression has no secret key parameter`);
      assert.equal(variant.block_bits, undefined, `${variant.id}: compression has explicit message/chaining parameters`);
      continue;
    }
    assert(!variant.compression, `${variant.id}: compression target requires a compression directory instance`);
    // The existing scientific contract counts rounds of one primitive. A
    // composite construction needs its own adapter, never an inferred product.
    assert(['block_cipher', 'stream_cipher', 'permutation'].includes(p.type) && !p.stages && 'rounds' in p
      && !p.construction && !('tweak_bits' in p) && !('tweakey_bits' in p) && !('sboxes_per_round' in p),
      `${variant.id}: scientific target adapter required`);
    for (const key of ['key_bits', 'block_bits']) {
      if (key in p) assert.equal(variant[key], p[key], `${variant.id}: analysis/directory ${key} mismatch`);
      else assert.equal(variant[key], undefined, `${variant.id}: inapplicable analysis ${key}`);
    }
    assert.equal(variant.full_rounds, p.rounds, `${variant.id}: analysis/directory round mismatch`);
  }
}

module.exports = {loadPrimitiveCatalog, validatePrimitiveCatalog, assertAnalysisCatalogCompatibility};

import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {catalogFixture, asymmetricCatalogFixture, hardProblemCatalogFixture} from '../helpers/primitive-catalog-fixtures.mjs';
const {validatePrimitiveCatalog, assertAnalysisCatalogCompatibility} = createRequire(import.meta.url)('../../lib/node/primitive-catalog.cjs');
const {kemSets, slhSets} = createRequire(import.meta.url)('../../lib/node/primitive-parameter-sets.cjs');

function namedProfileFixture(parameters) {
  const c = asymmetricCatalogFixture(), template = c.primitives.find(p => p.category === parameters.type);
  c.primitives.push({...structuredClone(template), id:'fixture-added-scheme', uses:[]});
  c.instances.push({id:'fixture-added-profile', family_id:'fixture-added-scheme', name:'Synthetic Named Profile',
    specification_ids:template.specification_ids, locator:'Synthetic profile validation fixture.', parameters:structuredClone(parameters)});
  return c;
}

test('pinned KEM profiles reject revision/encoding mismatches and preserve native dimensions', () => {
  for (const p of Object.values(kemSets)) {
    const c = namedProfileFixture(p); validatePrimitiveCatalog(c);
    assertAnalysisCatalogCompatibility(c, [], []);
    for (const field of Object.keys(p).filter(k => typeof p[k] === 'number')) {
      const bad = structuredClone(c); bad.instances.at(-1).parameters[field]++;
      assert.throws(() => validatePrimitiveCatalog(bad), undefined, `${p.parameter_set}/${field}`);
    }
    const bad = structuredClone(c); bad.instances.at(-1).parameters.internal_note='not public';
    assert.throws(() => validatePrimitiveCatalog(bad));
  }
  assert.equal(kemSets['FrodoKEM-640-AES'].ciphertext_bytes,9752); // Not eFrodoKEM's 9720.
  assert.equal(kemSets['HQC-1'].secret_key_representation,'seed');
  assert.equal(kemSets['HQC-1'].secret_key_bytes,32);
  assert.equal(kemSets.sntrup761.security_category,2); // Submission's explicit category, not guessed from n.
  const bike = namedProfileFixture(kemSets['BIKE-L1-R4']);
  bike.instances.at(-1).parameters.secret_key_bytes=281; // Table 5 is a storage bound in bits, not a canonical encoding.
  assert.throws(() => validatePrimitiveCatalog(bike));
});

test('all twelve SLH-DSA sets have coupled forest, hypertree and encoding parameters', () => {
  for (const hash_family of ['SHA2','SHAKE']) for (const [suffix,values] of Object.entries(slhSets)) {
    const [security_category,hash_bytes,hypertree_height,hypertree_layers,fors_height,fors_trees,signature_bytes]=values;
    const p={type:'digital_signature',scheme:'slh_dsa',parameter_set:`SLH-DSA-${hash_family}-${suffix}`,hash_family,
      security_category,hash_bytes,hypertree_height,hypertree_layers,fors_height,fors_trees,signature_bytes,
      public_key_bytes:hash_bytes*2,secret_key_bytes:hash_bytes*4,context_hex:''};
    const c=namedProfileFixture(p); validatePrimitiveCatalog(c);
    for (const field of ['hash_bytes','hypertree_height','hypertree_layers','fors_height','fors_trees','public_key_bytes','secret_key_bytes','signature_bytes','security_category']) {
      const bad=structuredClone(c);bad.instances.at(-1).parameters[field]++;
      assert.throws(()=>validatePrimitiveCatalog(bad),undefined,`${p.parameter_set}/${field}`);
    }
  }
});

test('stateful signature profiles cannot lose state or mix WOTS+ bases with LMOTS bit widths', () => {
  const profiles=[
    {scheme:'xmss',parameter_set:'XMSS-SHA2_10_256',tree_height:10,tree_layers:1,winternitz_base:16},
    {scheme:'xmssmt',parameter_set:'XMSSMT-SHA2_40/4_256',tree_height:40,tree_layers:4,winternitz_base:16},
    {scheme:'lms',parameter_set:'LMS_SHA256_M32_H10+LMOTS_SHA256_N32_W8',tree_height:10,tree_layers:1,winternitz_width:8},
    {scheme:'hss',parameter_set:'HSS-L2-LMS_SHA256_M32_H15+LMOTS_SHA256_N32_W8',tree_height:15,tree_layers:2,winternitz_width:8},
  ];
  for(const profile of profiles){
    const c=namedProfileFixture({type:'digital_signature',stateful:true,hash:'SHA-256',hash_bytes:32,...profile});
    validatePrimitiveCatalog(c);
    for(const update of [{stateful:false},{hash_bytes:24},{tree_height:20},{tree_layers:3},
      profile.winternitz_base?{winternitz_width:8}:{winternitz_base:16}]){
      const bad=structuredClone(c);Object.assign(bad.instances.at(-1).parameters,update);
      assert.throws(()=>validatePrimitiveCatalog(bad));
    }
  }
});

test('new classical and Falcon signature contracts reject wrong encodings and category pairs', () => {
  for(const parameters of [
    {type:'digital_signature',scheme:'dsa',modulus_bits:2048,subgroup_bits:256,hash:'SHA-256'},
    {type:'digital_signature',scheme:'rsassa_pkcs1_v1_5',modulus_bits:2048,hash:'SHA-256'},
    {type:'digital_signature',scheme:'bip340',curve:'secp256k1',field_bits:256,hash:'SHA-256',public_key_bytes:32,signature_bytes:64},
    {type:'digital_signature',scheme:'falcon',parameter_set:'Falcon-512',polynomial_degree:512,modulus:12289,security_category:1,public_key_bytes:897,signature_bytes:666,signature_encoding:'padded'},
  ]){
    const c=namedProfileFixture(parameters);validatePrimitiveCatalog(c);
    const bad=structuredClone(c);bad.instances.at(-1).parameters.type='public_key_encryption';
    assert.throws(()=>validatePrimitiveCatalog(bad));
  }
  for(const parameters of [
    {type:'digital_signature',scheme:'dsa',modulus_bits:1024,subgroup_bits:256,hash:'SHA-256'},
    {type:'digital_signature',scheme:'rsassa_pkcs1_v1_5',modulus_bits:128,hash:'SHA-512'},
    {...{type:'digital_signature',scheme:'falcon',parameter_set:'Falcon-1024',polynomial_degree:1024,modulus:12289,security_category:5,public_key_bytes:1793,signature_bytes:1280},signature_encoding:'average'},
  ])assert.throws(()=>validatePrimitiveCatalog(namedProfileFixture(parameters)));
});

test('SCMAC binds an exact stream instance and separate authentication state', () => {
  const c=extendedCatalog({type:'stream_cipher',construction:'feedback',key_bits:256,nonce_bits:128,state_bits:768,output_bits_per_step:128,initialization_steps:12});
  c.categories.push({id:'aead',domain:'symmetric',en:'AEAD',zh:'认证加密'});
  c.primitives.push({id:'fixture-scmac',name:'SCMAC Fixture',category:'aead',aliases:[],description:'Synthetic SCMAC fixture.',specification_ids:['fixture-spec'],uses:['fixture-extended']});
  c.instances.push({id:'fixture-scmac-profile',family_id:'fixture-scmac',name:'SCMAC Profile',specification_ids:['fixture-spec'],locator:'Synthetic fixture.',
    parameters:{type:'aead',construction:'scmac',stream_instance_id:'fixture-extended-instance',key_bits:256,nonce_bits:128,tag_bits:128,state_bits:1280,stream_state_bits:768,mac_state_bits:512,rate_bits:128,initialization_steps:12}});
  validatePrimitiveCatalog(c);
  for(const update of [{stream_instance_id:'fixture-block-128'},{nonce_bits:256},{stream_state_bits:1280},{state_bits:768},{rate_bits:256},{tag_bits:256},{initialization_steps:16}]){
    const bad=structuredClone(c);Object.assign(bad.instances.at(-1).parameters,update);assert.throws(()=>validatePrimitiveCatalog(bad));
  }
  c.primitives.at(-1).uses=[];assert.throws(()=>validatePrimitiveCatalog(c));
});

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

function extendedCatalog(parameters) {
  const catalog = catalogFixture();
  if (!catalog.categories.some(c => c.id === parameters.type)) catalog.categories.push({id: parameters.type, domain:'symmetric', en:'Fixture Category', zh:'测试分类'});
  catalog.primitives.push({id:'fixture-extended', name:'Extended Fixture', category:parameters.type, aliases:[], description:'Synthetic extended parameter shape.', specification_ids:['fixture-spec'], uses:['fixture-block']});
  catalog.instances.push({id:'fixture-extended-instance', family_id:'fixture-extended', name:'Extended Fixture Instance', specification_ids:['fixture-spec'], locator:'Synthetic contract location', parameters});
  return catalog;
}

test('extended symmetric parameters preserve real units without invented counters, binary keys or cipher dependencies', () => {
  for (const parameters of [
    {type:'block_cipher',key_bits:128,block_bits:64,rounds:10,tweak_bits:64,tweakey_bits:192},
    {type:'block_cipher',construction:'prime_field',field_modulus:'17',block_elements:1,key_elements:1,rounds:7,sbox_exponent:3},
    {type:'stream_cipher',construction:'feedback',key_bits:80,nonce_bits:64,state_bits:160,output_bits_per_step:1,initialization_steps:160},
    {type:'stream_cipher',construction:'word_oriented',key_bits:128,nonce_bits:128,state_bits:512,output_bits_per_step:32},
    {type:'stream_cipher',construction:'byte_permutation',key_bits:128,permutation_entries:256,word_bits:8,output_bits_per_step:8},
    {type:'hash_function',construction:'compression',output_bits:128,chaining_bits:256,block_bits:512,compression_rounds:10},
    {type:'hash_function',construction:'tree',output_bits:256,chaining_bits:256,block_bits:512,compression_rounds:7,chunk_bytes:1024},
    {type:'hash_function',construction:'prime_field_sponge',field_modulus:'17',state_elements:3,rate_elements:2,capacity_elements:1,output_elements:1,full_rounds:8,partial_rounds:5,sbox_exponent:3},
    {type:'xof',construction:'tree_sponge',output:'variable',state_bits:256,rate_bits:128,capacity_bits:128,permutation_rounds:12,chunk_bytes:1024},
    {type:'permutation',state_bits:256,steps:10},
    {type:'mac',construction:'universal_hash',key_bits:256,tag_bits:128,key_use:'one_time'},
    {type:'mac',construction:'universal_hash',key_bits:128,tag_bits:64,key_use:'nonce_based',nonce_bits:64},
    {type:'mac',construction:'arx_prf',key_bits:128,tag_bits:64,block_bits:64,compression_rounds:2,finalization_rounds:4},
    {type:'mac',construction:'sponge',key_input:'variable',tag_bits:128,state_bits:256,rate_bits:128,capacity_bits:128},
    {type:'aead',nonce_mode:'deterministic',key_bits:256,tag_bits:128},
  ]) validatePrimitiveCatalog(extendedCatalog(parameters));
});

test('extended symmetric contracts fail closed on incorrect dimensions, units and inapplicable fields', () => {
  for (const parameters of [
    {type:'block_cipher',key_bits:128,block_bits:64,rounds:10,tweak_bits:64,tweakey_bits:128},
    {type:'block_cipher',construction:'prime_field',field_modulus:'15',block_elements:1,key_elements:1,rounds:7,sbox_exponent:3},
    {type:'block_cipher',construction:'prime_field',field_modulus:17,block_elements:1,key_elements:1,rounds:7,sbox_exponent:3},
    {type:'block_cipher',construction:'prime_field',field_modulus:'17',block_elements:1,key_elements:1,rounds:7,sbox_exponent:4},
    {type:'stream_cipher',construction:'feedback',key_bits:80,nonce_bits:64,state_bits:160,output_bits_per_step:1,counter_bits:0},
    {type:'stream_cipher',construction:'byte_permutation',key_bits:128,permutation_entries:256,word_bits:8,output_bits_per_step:8,nonce_bits:0},
    {type:'hash_function',construction:'tree',output_bits:256,chaining_bits:256,block_bits:512,compression_rounds:7},
    {type:'hash_function',construction:'compression',output_bits:512,chaining_bits:256,block_bits:512,compression_rounds:7},
    {type:'hash_function',construction:'prime_field_sponge',field_modulus:'17',state_elements:3,rate_elements:2,capacity_elements:2,output_elements:1,full_rounds:8,partial_rounds:5,sbox_exponent:3},
    {type:'permutation',state_bits:256,steps:10,rounds:10},
    {type:'mac',construction:'universal_hash',key_bits:256,tag_bits:128,key_use:'one_time',nonce_bits:128},
    {type:'mac',construction:'universal_hash',key_bits:128,tag_bits:64,key_use:'nonce_based'},
    {type:'aead',nonce_mode:'deterministic',key_bits:256,tag_bits:128,nonce_bits:0},
  ]) assert.throws(() => validatePrimitiveCatalog(extendedCatalog(parameters)));
});

test('HMAC resolves the actual hash block and digest without inventing a fixed key size', () => {
  const catalog=extendedCatalog({type:'hash_function',output_bits:256,state_bits:256,block_bits:512,compression_steps:64});
  catalog.primitives.push({id:'fixture-hmac',name:'Fixture HMAC',category:'mac',aliases:[],description:'Synthetic hash MAC.',specification_ids:['fixture-spec'],uses:['fixture-extended']});
  const instance={id:'fixture-hmac-instance',family_id:'fixture-hmac',name:'Fixture HMAC Instance',specification_ids:['fixture-spec'],locator:'Synthetic section',parameters:{type:'mac',construction:'hmac',key_input:'variable',hash_instance_id:'fixture-extended-instance',block_bits:512,tag_bits:256}};
  catalog.instances.push(instance); validatePrimitiveCatalog(catalog);
  for(const change of [{hash_instance_id:'fixture-block-128'},{block_bits:128},{tag_bits:512},{key_bits:128}]) {
    const copy=structuredClone(catalog); Object.assign(copy.instances.at(-1).parameters,change); assert.throws(()=>validatePrimitiveCatalog(copy));
  }
});

test('citation eligibility requires identified evidence above 300 and never adds duplicate observations', () => {
  const catalog=catalogFixture(), source=catalog.specifications[0], family=catalog.primitives[0];
  source.kind='design_paper';
  source.citation_observations=[{provider:'openalex',work_id:'W123',title:'Synthetic original design',cited_by_count:301,checked_on:'2026-01-01',url:'https://openalex.org/W123'}];
  family.inclusion=[{reason:'high_citation',specification_id:source.id,note:'Synthetic eligibility evidence.'}];
  validatePrimitiveCatalog(catalog);
  for(const mutate of [
    c=>{c.specifications[0].citation_observations[0].cited_by_count=300;},
    c=>{delete c.specifications[0].citation_observations;},
    c=>{c.specifications[0].citation_observations.push({...c.specifications[0].citation_observations[0]});},
    c=>{c.specifications[0].citation_observations[0].url='https://openalex.org/W456';},
    c=>{c.specifications[0].citation_observations[0].url='https://user:secret@openalex.org/W123';},
    c=>{c.specifications[0].citation_observations[0].checked_on='2027-01-01';},
    c=>{c.primitives[0].inclusion[0].specification_id='missing';},
    c=>{c.specifications[0].citation_observations[0].internal_note='not public';},
  ]) {const copy=structuredClone(catalog);mutate(copy);assert.throws(()=>validatePrimitiveCatalog(copy));}
});

test('new parameterizations require an explicit scientific adapter before they can become analysis targets', () => {
  for(const parameters of [
    {type:'block_cipher',key_bits:128,block_bits:64,rounds:10,tweak_bits:64},
    {type:'block_cipher',construction:'prime_field',field_modulus:'17',block_elements:1,key_elements:1,rounds:7,sbox_exponent:3},
    {type:'stream_cipher',construction:'feedback',key_bits:80,nonce_bits:64,state_bits:160,output_bits_per_step:1},
    {type:'permutation',state_bits:256,steps:10},
  ]) {
    const catalog=extendedCatalog(parameters);validatePrimitiveCatalog(catalog);
    assert.throws(()=>assertAnalysisCatalogCompatibility(catalog,[],[{id:'fixture-extended-instance',family:'fixture-extended',full_rounds:parameters.rounds}]),/adapter required/);
  }
});

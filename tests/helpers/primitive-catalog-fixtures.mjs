/** Synthetic definitions only; no corpus or scientific source is copied. */
export function catalogFixture() {
  return {
    schema_version: 3,
    hard_problems: [],
    problem_sources: [],
    categories: [
      {id: 'block_cipher', domain: 'symmetric', en: 'Block Ciphers', zh: '分组密码'},
      {id: 'permutation', domain: 'symmetric', en: 'Permutations', zh: '置换'},
      {id: 'xof', domain: 'symmetric', en: 'Extendable-Output Functions', zh: '可扩展输出函数'},
      {id: 'mac', domain: 'symmetric', en: 'Message Authentication Codes', zh: '消息认证码'},
    ],
    specifications: [{id: 'fixture-spec', title: 'Synthetic specification', edition: 'Fixture edition',
      url: 'https://example.invalid/specification', status: 'published',
      status_note: 'A synthetic fixture, not a standard or security claim.', checked_on: '2026-01-01'}],
    primitives: [
      {id: 'fixture-block', name: 'Fixture Block', category: 'block_cipher', aliases: ['Fixture alias'], description: 'Synthetic block cipher.', specification_ids: ['fixture-spec'], uses: []},
      {id: 'fixture-permutation', name: 'Fixture Permutation', category: 'permutation', aliases: [], description: 'Synthetic permutation.', specification_ids: ['fixture-spec'], uses: []},
      {id: 'fixture-xof', name: 'Fixture XOF', category: 'xof', aliases: [], description: 'Synthetic XOF.', specification_ids: ['fixture-spec'], uses: ['fixture-permutation']},
      {id: 'fixture-mac', name: 'Fixture MAC', category: 'mac', aliases: [], description: 'Synthetic MAC.', specification_ids: ['fixture-spec'], uses: ['fixture-block']},
    ],
    instances: [
      {id: 'fixture-block-128', family_id: 'fixture-block', name: 'Fixture Block 128', specification_ids: ['fixture-spec'], locator: 'Synthetic section 1', parameters: {type: 'block_cipher', key_bits: 128, block_bits: 128, rounds: 10}},
      {id: 'fixture-permutation-256', family_id: 'fixture-permutation', name: 'Fixture Permutation 256', specification_ids: ['fixture-spec'], locator: 'Synthetic section 2', parameters: {type: 'permutation', state_bits: 256, rounds: 12}},
      {id: 'fixture-xof-128', family_id: 'fixture-xof', name: 'Fixture XOF 128', specification_ids: ['fixture-spec'], locator: 'Synthetic section 3', parameters: {type: 'xof', output: 'variable', state_bits: 256, rate_bits: 128, capacity_bits: 128}},
      {id: 'fixture-mac-128', family_id: 'fixture-mac', name: 'Fixture MAC 128', specification_ids: ['fixture-spec'], locator: 'Synthetic section 4', parameters: {type: 'mac', key_bits: 128, block_bits: 128, tag_bits: 128, cipher_instance_id: 'fixture-block-128'}},
    ],
  };
}

/** Synthetic targets exercise each closed parameter contract; no attack records. */
export function asymmetricCatalogFixture() {
  const catalog = catalogFixture();
  catalog.categories.push(...[
    ['public_key_encryption', 'Public-Key Encryption'], ['key_agreement', 'Key Agreement'],
    ['digital_signature', 'Digital Signatures'], ['kem', 'Key Encapsulation Mechanisms'],
  ].map(([id, en]) => ({id, domain: 'asymmetric', en, zh: `测试 ${id}`})));
  const parameters = [
    {type: 'public_key_encryption', scheme: 'rsaes_oaep', modulus_bits: 2048, hash: 'SHA-256', mgf_hash: 'SHA-256', label_hex: ''},
    {type: 'digital_signature', scheme: 'rsassa_pss', modulus_bits: 2048, hash: 'SHA-256', mgf_hash: 'SHA-256', salt_bytes: 32},
    {type: 'key_agreement', scheme: 'ffdhe', group: 'ffdhe2048', modulus_bits: 2048, generator: 2},
    {type: 'key_agreement', scheme: 'ecdh', curve: 'P-256', field_bits: 256},
    {type: 'key_agreement', scheme: 'xdh', function: 'X25519', field_bits: 255, public_key_bytes: 32, shared_secret_bytes: 32},
    {type: 'digital_signature', scheme: 'ecdsa', curve: 'P-256', field_bits: 256, hash: 'SHA-256'},
    {type: 'digital_signature', scheme: 'eddsa', variant: 'Ed25519', field_bits: 255, hash: 'SHA-512', public_key_bytes: 32, signature_bytes: 64, context_hex: ''},
    {type: 'public_key_encryption', scheme: 'sm2_encryption', curve: 'curveSM2', field_bits: 256, hash: 'SM3', ciphertext_order: 'C1C3C2'},
    {type: 'digital_signature', scheme: 'sm2_signature', curve: 'curveSM2', field_bits: 256, hash: 'SM3'},
    {type: 'key_agreement', scheme: 'sm2_key_exchange', curve: 'curveSM2', field_bits: 256, hash: 'SM3', shared_secret_bits: 256},
    {type: 'kem', scheme: 'ml_kem', parameter_set: 'ML-KEM-512', security_category: 1, module_rank: 2, public_key_bytes: 800, secret_key_bytes: 1632, ciphertext_bytes: 768, shared_secret_bytes: 32},
    {type: 'digital_signature', scheme: 'ml_dsa', parameter_set: 'ML-DSA-44', security_category: 2, matrix_rows: 4, matrix_columns: 4, public_key_bytes: 1312, secret_key_bytes: 2560, signature_bytes: 2420, context_hex: ''},
    {type: 'digital_signature', scheme: 'slh_dsa', parameter_set: 'SLH-DSA-SHA2-128s', hash_family: 'SHA2', security_category: 1, hash_bytes: 16, hypertree_height: 63, hypertree_layers: 7, fors_height: 12, fors_trees: 14, public_key_bytes: 32, secret_key_bytes: 64, signature_bytes: 7856, context_hex: ''},
  ];
  for (const p of parameters) {
    const family = {id: 'fixture-' + p.scheme.replaceAll('_', '-'), name: 'Synthetic ' + p.scheme, category: p.type,
      aliases: [], description: 'Synthetic directory target.', specification_ids: ['fixture-spec'], uses: ['fixture-xof']};
    catalog.primitives.push(family);
    catalog.instances.push({id: family.id + '-instance', family_id: family.id, name: family.name + ' instance',
      specification_ids: ['fixture-spec'], locator: 'Synthetic parameter-contract section', parameters: p});
  }
  return catalog;
}

/** Definitions are deliberately synthetic, not collected research evidence. */
export function hardProblemCatalogFixture() {
  const catalog = asymmetricCatalogFixture();
  catalog.categories.splice(catalog.categories.findIndex(c => c.domain === 'asymmetric'), 0,
    {id: 'hard_problem', domain: 'asymmetric', en: 'Hard Problems', zh: '困难问题'});
  catalog.problem_sources = [{id: 'fixture-problem-source', title: 'Synthetic source with qRAM and ePrint',
    authors: ['Synthetic Author'], year: 2026, edition: 'Synthetic edition', url: 'https://example.invalid/problem-definition'}];
  const shapes = {
    integer_factorization: ['modulus', 'size', 'input_distribution'],
    rsa_inversion: ['modulus', 'exponent', 'input_distribution'],
    discrete_logarithm: ['group', 'order', 'input_distribution'],
    elliptic_curve_discrete_logarithm: ['curve', 'group', 'order', 'input_distribution'],
    lwe: ['dimension', 'modulus', 'sample_count', 'secret_distribution', 'error_distribution'],
    ring_lwe: ['ring', 'modulus', 'sample_count', 'secret_distribution', 'error_distribution', 'representation'],
    module_lwe: ['ring', 'module_rank', 'modulus', 'sample_count', 'secret_distribution', 'error_distribution', 'representation'],
    sis: ['dimension', 'column_count', 'modulus', 'norm', 'bound'],
    module_sis: ['ring', 'module_rank', 'column_count', 'modulus', 'norm', 'bound', 'representation'],
  };
  catalog.hard_problems = Object.entries(shapes).map(([type, keys]) => ({
    id: 'fixture-problem-' + type.replaceAll('_', '-'), name: 'Fixture ' + type, category: 'hard_problem',
    aliases: ['Synthetic definition ' + type], description: 'Synthetic problem, not a security claim.',
    statement: 'A synthetic equation ($x=1$).',
    parameters: {type, ...Object.fromEntries(keys.map(key => [key, 'Synthetic ' + key]))},
    formulations: (['lwe', 'ring_lwe', 'module_lwe'].includes(type) ? ['search', 'decision'] : ['search']).map(kind => ({kind, description: 'Synthetic ' + kind + ' task.'})),
    qualifications: ['Synthetic conditions, not an unconditional hardness claim.'],
    references: [{source_id: 'fixture-problem-source', locator: 'Synthetic definition location'}],
    related_scheme_ids: ['fixture-rsaes-oaep'], related_problem_ids: [],
  }));
  catalog.hard_problems[0].related_problem_ids = [catalog.hard_problems[1].id];
  return catalog;
}

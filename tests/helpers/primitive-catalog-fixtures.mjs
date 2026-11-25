/** Synthetic definitions only; no corpus or scientific source is copied. */
export function catalogFixture() {
  return {
    schema_version: 1,
    categories: [
      {id: 'block_cipher', en: 'Block ciphers', zh: '分组密码'},
      {id: 'permutation', en: 'Permutations', zh: '置换'},
      {id: 'xof', en: 'Extendable-output functions', zh: '可扩展输出函数'},
      {id: 'mac', en: 'Message authentication codes', zh: '消息认证码'},
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

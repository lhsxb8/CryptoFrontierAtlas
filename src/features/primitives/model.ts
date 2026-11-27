import type { CipherFamily, CipherVariant } from '../cryptanalysis/types';
import type { HardProblemDefinition, HardProblemParameters, PrimitiveCatalog, PrimitiveDomain, PrimitiveInstance, PrimitiveParameters } from './types';
import type { StructureData } from './structure-types';

/** Use the same explicit binding for the figure and its parameter summary. */
export function structureBinding(structures: StructureData, familyId: string, instanceId?: string, viewId = 'overview') {
  const definition = structures.registry.diagrams.find(d => d.family_id === familyId
    && (!instanceId || d.instance_ids.includes(instanceId)) && d.review.status === 'source_checked');
  const view = definition?.views.find(v => v.id === viewId);
  const asset = structures.manifest.assets.find(a => a.target_id === (instanceId ?? familyId)
    && a.family_id === familyId && a.view_id === viewId);
  return definition && view && asset ? {definition, view, asset} : undefined;
}

export function primitiveDomain(catalog: PrimitiveCatalog, familyId: string): PrimitiveDomain | undefined {
  const family = catalog.primitives.find(p => p.id === familyId);
  return catalog.categories.find(category => category.id === family?.category)?.domain;
}

export const directoryPath = (domain: PrimitiveDomain) => domain === 'asymmetric' ? '/asymmetric-cryptanalysis' : '/cryptanalysis';
export function primitivePath(domain: PrimitiveDomain, familyId: string, instanceId?: string) {
  return `${directoryPath(domain)}/${domain === 'asymmetric' ? 'algorithms' : 'ciphers'}/${familyId}${instanceId ? '/' + instanceId : ''}`;
}

export const hardProblemPath = (id: string) => `/asymmetric-cryptanalysis/problems/${id}`;

export function isCompressionFamily(catalog: PrimitiveCatalog, familyId: string) {
  const instances = catalog.instances.filter(i => i.family_id === familyId);
  return instances.length > 0 && instances.every(i => 'construction' in i.parameters && i.parameters.construction === 'block_cipher_compression');
}

export function directoryEntries(catalog: PrimitiveCatalog, ciphers: readonly CipherFamily[], domain: PrimitiveDomain = 'symmetric') {
  const publicIds = new Set(catalog.primitives.map(p => p.id));
  return [...(domain === 'asymmetric' ? catalog.hard_problems.map(p => ({...p, kind: 'hard_problem' as const})) : []),
    ...catalog.primitives.filter(p => primitiveDomain(catalog, p.id) === domain).map(p => ({...p, kind: 'primitive' as const})),
    ...(domain === 'symmetric' ? ciphers : []).filter(c => !publicIds.has(c.id)).map(c => ({
    ...c, kind: 'primitive' as const, category: c.primitive_type as string, specification_ids: [] as string[], uses: [] as string[],
  }))];
}

/** Route identity only: no synthetic scientific rounds, keys or source records. */
export function directoryRoutes(catalog: PrimitiveCatalog, variants: readonly Pick<CipherVariant, 'id' | 'family'>[], domain: PrimitiveDomain = 'symmetric') {
  const routes = new Map(catalog.instances.filter(i => primitiveDomain(catalog, i.family_id) === domain).map(i => [i.id, {id: i.id, family: i.family_id}]));
  if (domain === 'symmetric') for (const variant of variants) {
    const familyDomain = primitiveDomain(catalog, variant.family);
    if (!familyDomain || familyDomain === domain) routes.set(variant.id, {id: variant.id, family: variant.family});
  }
  return [...routes.values()];
}

type ParameterKey<T> = T extends unknown ? keyof T : never;
const problemParameterLabels: Record<Exclude<ParameterKey<HardProblemParameters>, 'type'>, [string, string]> = {
  modulus: ['Modulus', '模数'], size: ['Input Size', '输入长度'], input_distribution: ['Input Distribution', '输入分布'],
  exponent: ['Public Exponent', '公开指数'], group: ['Group', '群'], order: ['Group Order', '群阶'], curve: ['Curve', '曲线'],
  dimension: ['Dimension', '维数'], sample_count: ['Samples', '样本数'], secret_distribution: ['Secret Distribution', '秘密分布'],
  error_distribution: ['Error Distribution', '误差分布'], ring: ['Ring', '环'], representation: ['Representation', '表示方式'],
  module_rank: ['Module Rank', '模秩'], column_count: ['Columns', '列数'], norm: ['Norm', '范数'], bound: ['Shortness Bound', '短向量界'],
};

export function hardProblemParameterRows(problem: HardProblemDefinition, locale: 'en' | 'zh' = 'en') {
  return Object.entries(problem.parameters).filter(([key]) => key !== 'type').map(([key, value]) => ({
    key, label: problemParameterLabels[key as keyof typeof problemParameterLabels][locale === 'zh' ? 1 : 0], value,
  }));
}

const labels: Record<Exclude<ParameterKey<PrimitiveParameters>, 'type' | 'scheme' | 'construction' | 'mode'>, [string, string]> = {
  stream_instance_id: ['Underlying Stream Instance', '底层流密码实例'], stream_state_bits: ['Stream State', '流密码状态'], mac_state_bits: ['Authentication State', '认证状态'],
  code_length: ['Code Length (n)', '码长（n）'], field_degree: ['Extension Degree (m)', '扩域次数（m）'], error_capacity: ['Error-Correction Capacity (t)', '纠错能力（t）'],
  secret_weight: ['Secret Weight', '秘密向量重量'], ephemeral_weight: ['Ephemeral Weight', '临时向量重量'],
  lattice_dimension: ['Lattice Dimension (n)', '格维数（n）'], matrix_generator: ['Matrix Generator', '矩阵生成器'],
  polynomial_degree: ['Polynomial Degree (n)', '多项式次数（n）'], modulus: ['Modulus (q)', '模数（q）'],
  ring_degree: ['Cyclic Ring Degree (r)', '循环环次数（r）'], error_weight: ['Error Weight (t)', '错误重量（t）'],
  secret_key_representation: ['Secret-Key Representation', '私钥表示'], signature_encoding: ['Signature Encoding Mode', '签名编码方式'],
  subgroup_bits: ['Subgroup Order Size', '子群阶长度'], stateful: ['Signing State', '签名状态'],
  tree_height: ['Tree Height (h)', '树高度（h）'], tree_layers: ['Tree Layers', '树层数'],
  winternitz_base: ['Winternitz Base (w)', 'Winternitz 基数（w）'], winternitz_width: ['Winternitz Digit Width (bits)', 'Winternitz 数位宽度（比特）'],
  message_bits: ['Message Input', '消息输入'], cipher_rounds: ['Underlying Cipher Rounds', '底层分组密码轮数'],
  tweak_bits: ['Public Tweak', '公开 Tweak'], tweakey_bits: ['Total Tweakey', 'Tweakey 总长'], sboxes_per_round: ['S-Boxes per Round', '每轮 S 盒数'],
  steps: ['Permutation Steps', '置换步数'], squeeze_bits: ['Output Rate', '输出速率'],
  initialization_steps: ['Initialization Steps', '初始化步数'], output_bits_per_step: ['Output per Step (bits)', '每步输出（比特）'],
  permutation_entries: ['Permutation Entries', '置换元素数'], word_bits: ['Word Size', '字长'],
  chaining_bits: ['Chaining Value', '链接值'], working_state_bits: ['Compression State', '压缩函数状态'],
  compression_rounds: ['Compression Rounds', '压缩轮数'], finalization_rounds: ['Finalization Rounds', '终结轮数'],
  permutation_rounds: ['Permutation Rounds', '置换轮数'], chunk_bytes: ['Chunk Size', '分块大小'],
  field_modulus: ['Field Modulus', '有限域模数'], block_elements: ['Block (field elements)', '分组（域元素）'],
  key_elements: ['Key (field elements)', '密钥（域元素）'], state_elements: ['State (field elements)', '状态（域元素）'],
  rate_elements: ['Rate (field elements)', '速率（域元素）'], capacity_elements: ['Capacity (field elements)', '容量（域元素）'],
  output_elements: ['Output (field elements)', '输出（域元素）'], full_rounds: ['Full Rounds', '完整轮数'],
  partial_rounds: ['Partial Rounds', '部分轮数'], sbox_exponent: ['S-Box Exponent', 'S 盒指数'],
  key_input: ['Key Length', '密钥长度'], hash_instance_id: ['Underlying Hash Instance', '底层哈希实例'],
  key_use: ['Key Use', '密钥使用方式'], nonce_mode: ['Nonce Mode', 'Nonce 模式'],
  key_bits: ['Key material', '密钥材料'], key_encoding_bits: ['Key encoding (including parity)', '密钥编码（含校验位）'],
  block_bits: ['Block size', '分组大小'], nonce_bits: ['Nonce', 'Nonce'], counter_bits: ['Counter', '计数器'],
  state_bits: ['State size', '状态大小'], keystream_block_bits: ['Keystream block', '密钥流块'],
  output_bits: ['Output', '输出'], tag_bits: ['Tag', '认证标签'], rate_bits: ['Rate', '比特率'],
  capacity_bits: ['Capacity', '容量'], rounds: ['Rounds', '轮数'], stages: ['Stages', '阶段数'],
  compression_steps: ['Compression Steps', '压缩函数步数'], output: ['Output length', '输出长度'],
  cipher_instance_id: ['Underlying cipher instance', '底层分组密码实例'],
  modulus_bits: ['Modulus size', '模数大小'], field_bits: ['Field size', '有限域大小'],
  curve: ['Curve', '曲线'], group: ['Named group', '命名群'], generator: ['Generator', '生成元'],
  function: ['Function', '函数'], variant: ['Variant', '变体'], parameter_set: ['Parameter set', '参数集'],
  hash: ['Hash', '哈希函数'], mgf_hash: ['MGF1 hash', 'MGF1 哈希函数'], hash_family: ['Hash family', '哈希家族'],
  label_hex: ['OAEP label (hex)', 'OAEP 标签（十六进制）'], context_hex: ['Context (hex)', '上下文（十六进制）'],
  salt_bytes: ['PSS salt length', 'PSS 盐长度'], ciphertext_order: ['Ciphertext components', '密文分量顺序'],
  public_key_bytes: ['Public-key encoding', '公钥编码'], secret_key_bytes: ['Secret-key encoding', '私钥编码'],
  signature_bytes: ['Signature encoding', '签名编码'], ciphertext_bytes: ['Ciphertext encoding', '密文编码'],
  shared_secret_bytes: ['Shared-secret encoding', '共享秘密编码'], shared_secret_bits: ['Derived-key length', '派生密钥长度'],
  security_category: ['NIST security category', 'NIST 安全类别'], module_rank: ['Module rank', '模秩'],
  matrix_rows: ['Matrix rows (k)', '矩阵行数（k）'], matrix_columns: ['Matrix columns (l)', '矩阵列数（l）'],
  hash_bytes: ['Hash parameter (n)', '哈希参数（n）'], hypertree_height: ['Hypertree height (h)', '超树高度（h）'],
  hypertree_layers: ['Hypertree layers (d)', '超树层数（d）'], fors_height: ['FORS tree height (a)', 'FORS 树高度（a）'],
  fors_trees: ['FORS tree count (k)', 'FORS 树数量（k）'],
};

export function parameterRows(instance: PrimitiveInstance, locale: 'en' | 'zh' = 'en') {
  return Object.entries(instance.parameters).filter(([key]) => !['type', 'scheme', 'construction', 'mode'].includes(key)).map(([key, value]) => ({
    key,
    label: key === 'rounds' && 'stages' in instance.parameters
      ? (locale === 'zh' ? '每阶段 DES 轮数' : 'DES Rounds per stage') : labels[key as keyof typeof labels][locale === 'zh' ? 1 : 0],
    value: key === 'stateful' ? (locale === 'zh' ? '有状态（不得重复使用一次性密钥）' : 'Stateful (Never Reuse One-Time Keys)')
      : key === 'secret_key_representation' ? (value === 'seed' ? (locale === 'zh' ? '种子' : 'Seed') : (locale === 'zh' ? '规范编码' : 'Specified Encoding'))
      : key === 'signature_encoding' ? (locale === 'zh' ? '填充至固定长度' : 'Padded to Fixed Length')
      : key === 'output' || key === 'key_input' ? (locale === 'zh' ? '可变' : 'Variable')
      : key === 'key_use' ? (value === 'one_time' ? (locale === 'zh' ? '一次性密钥' : 'One-Time Key') : (locale === 'zh' ? '依赖唯一 Nonce' : 'Nonce-Based'))
      : key === 'nonce_mode' ? (locale === 'zh' ? '确定性（无 Nonce）' : 'Deterministic (No Nonce)')
      : key.endsWith('_hex') && value === '' ? (locale === 'zh' ? '空' : 'Empty')
        : String(value) + (key.endsWith('_bits') ? (locale === 'zh' ? ' 比特' : ' bits')
          : key.endsWith('_bytes') ? (locale === 'zh' ? ' 字节' : ' bytes') : ''),
  }));
}

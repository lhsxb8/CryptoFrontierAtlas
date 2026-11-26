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

const labels: Record<Exclude<ParameterKey<PrimitiveParameters>, 'type' | 'scheme'>, [string, string]> = {
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
  return Object.entries(instance.parameters).filter(([key]) => key !== 'type' && key !== 'scheme').map(([key, value]) => ({
    key,
    label: key === 'rounds' && 'stages' in instance.parameters
      ? (locale === 'zh' ? '每阶段 DES 轮数' : 'DES Rounds per stage') : labels[key as keyof typeof labels][locale === 'zh' ? 1 : 0],
    value: key === 'output' ? (locale === 'zh' ? '可变' : 'Variable')
      : key.endsWith('_hex') && value === '' ? (locale === 'zh' ? '空' : 'Empty')
        : String(value) + (key.endsWith('_bits') ? (locale === 'zh' ? ' 比特' : ' bits')
          : key.endsWith('_bytes') ? (locale === 'zh' ? ' 字节' : ' bytes') : ''),
  }));
}

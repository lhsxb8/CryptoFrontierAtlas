import type { CipherFamily, CipherVariant } from '../cryptanalysis/types';
import type { PrimitiveCatalog, PrimitiveInstance } from './types';
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

export function directoryEntries(catalog: PrimitiveCatalog, ciphers: readonly CipherFamily[]) {
  const publicIds = new Set(catalog.primitives.map(p => p.id));
  return [...catalog.primitives, ...ciphers.filter(c => !publicIds.has(c.id)).map(c => ({
    ...c, category: c.primitive_type as string, specification_ids: [] as string[], uses: [] as string[],
  }))];
}

/** Route identity only: no synthetic scientific rounds, keys or source records. */
export function directoryRoutes(catalog: PrimitiveCatalog, variants: readonly Pick<CipherVariant, 'id' | 'family'>[]) {
  const routes = new Map(catalog.instances.map(i => [i.id, {id: i.id, family: i.family_id}]));
  for (const variant of variants) routes.set(variant.id, {id: variant.id, family: variant.family});
  return [...routes.values()];
}

const labels: Record<string, [string, string]> = {
  key_bits: ['Key material', '密钥材料'], key_encoding_bits: ['Key encoding (including parity)', '密钥编码（含校验位）'],
  block_bits: ['Block size', '分组大小'], nonce_bits: ['Nonce', 'Nonce'], counter_bits: ['Counter', '计数器'],
  state_bits: ['State size', '状态大小'], keystream_block_bits: ['Keystream block', '密钥流块'],
  output_bits: ['Output', '输出'], tag_bits: ['Tag', '认证标签'], rate_bits: ['Rate', '比特率'],
  capacity_bits: ['Capacity', '容量'], rounds: ['Rounds', '轮数'], stages: ['Stages', '阶段数'],
  compression_steps: ['Compression steps', '压缩函数步数'], output: ['Output length', '输出长度'],
  cipher_instance_id: ['Underlying cipher instance', '底层分组密码实例'],
};

export function parameterRows(instance: PrimitiveInstance, locale: 'en' | 'zh' = 'en') {
  return Object.entries(instance.parameters).filter(([key]) => key !== 'type').map(([key, value]) => ({
    key,
    label: key === 'rounds' && 'stages' in instance.parameters
      ? (locale === 'zh' ? '每阶段 DES 轮数' : 'DES rounds per stage') : labels[key][locale === 'zh' ? 1 : 0],
    value: key === 'output' ? (locale === 'zh' ? '可变' : 'Variable')
      : String(value) + (key.endsWith('_bits') ? (locale === 'zh' ? ' 比特' : ' bits') : ''),
  }));
}

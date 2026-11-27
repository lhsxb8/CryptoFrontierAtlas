import type {PrimitiveCatalog, PrimitiveSpecification, PrimitiveStandard} from './types';

export interface StandardMatch {
  standard: PrimitiveStandard;
  specification: PrimitiveSpecification;
  bindings: PrimitiveStandard['bindings'];
  instanceIds: string[];
}

/** Explicit instance bindings only: a citation or dependency grants no standard status. */
export function standardsForInstances(catalog: PrimitiveCatalog, instanceIds: readonly string[]): StandardMatch[] {
  const ids = new Set(instanceIds);
  return (catalog.standardization?.standards ?? []).flatMap(standard => {
    const bindings = standard.bindings.filter(binding => binding.instance_ids.some(id => ids.has(id)));
    const specification = catalog.specifications.find(spec => spec.id === standard.specification_id);
    if (!bindings.length || !specification) return [];
    return [{standard, specification, bindings,
      instanceIds: [...new Set(bindings.flatMap(binding => binding.instance_ids.filter(id => ids.has(id))))]}];
  });
}

export function standardsForTarget(catalog: PrimitiveCatalog, familyId: string, instanceId?: string) {
  const instances = catalog.instances.filter(instance => instance.family_id === familyId && (!instanceId || instance.id === instanceId));
  return {matches: standardsForInstances(catalog, instances.map(instance => instance.id)), total: instances.length};
}

/** Current adoption first, unverified profiles next, any withdrawn binding last. */
export function standardPriority(matches: readonly StandardMatch[]) {
  if (matches.some(match => match.specification.status === 'withdrawn')) return 2;
  return matches.some(match => match.specification.status === 'published') ? 0 : 1;
}

export function standardInstanceOrder<T extends {id: string}>(catalog: PrimitiveCatalog, instances: readonly T[]): T[] {
  return [...instances].sort((a, b) => standardPriority(standardsForInstances(catalog, [a.id]))
    - standardPriority(standardsForInstances(catalog, [b.id])));
}

export function standardSearchText(catalog: PrimitiveCatalog, familyId: string) {
  return standardsForTarget(catalog, familyId).matches.flatMap(({standard, specification}) =>
    [standard.designation, standard.authority, standard.jurisdiction ?? '', specification.title]).join(' ');
}

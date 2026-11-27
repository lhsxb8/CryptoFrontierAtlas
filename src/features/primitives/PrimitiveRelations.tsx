import {useLocale} from '../../app/locale';
import {routeHref} from '../../app/atlas/model';
import {primitiveCatalog} from './data';
import {isCompressionFamily, primitiveDomain, primitivePath} from './model';
import type {PrimitiveDefinition, PrimitiveInstance} from './types';

/** Dependency links never copy results or contribute to target counts. */
export function PrimitiveRelations({familyId, instanceId}: {familyId: string; instanceId?: string}) {
  const {locale} = useLocale();
  const family = primitiveCatalog.primitives.find(p => p.id === familyId);
  if (!family) return null;
  const instance = primitiveCatalog.instances.find(i => i.id === instanceId);
  const parameters = instance?.parameters;
  const underlying = parameters && 'construction' in parameters && parameters.construction === 'block_cipher_compression'
    ? primitiveCatalog.instances.find(i => i.id === parameters.cipher_instance_id)
    : parameters && 'construction' in parameters && parameters.construction === 'scmac'
      ? primitiveCatalog.instances.find(i => i.id === parameters.stream_instance_id) : undefined;
  const related = primitiveCatalog.primitives.filter(p => p.uses.includes(familyId) && isCompressionFamily(primitiveCatalog, p.id))
    .flatMap<{family: PrimitiveDefinition; instance?: PrimitiveInstance}>(p => {
      const instances = primitiveCatalog.instances.filter(i => i.family_id === p.id && 'cipher_instance_id' in i.parameters && i.parameters.cipher_instance_id === instanceId);
      return instanceId ? instances.map(i => ({family: p, instance: i})) : [{family: p, instance: undefined}];
    });
  const link = (id: string, label: string, instance?: string) => <a key={instance ?? id} href={routeHref(primitivePath(primitiveDomain(primitiveCatalog, id)!, id, instance))}>{label}</a>;
  return <div className="atlas-primitive-relations">
    {family.uses.length > 0 && <p><span>{locale === 'zh' ? '底层原语' : 'Uses'}</span>
      {underlying ? link(underlying.family_id, underlying.name, underlying.id) : family.uses.map(id => link(id, primitiveCatalog.primitives.find(p => p.id === id)!.name))}</p>}
    {related.length > 0 && <p><span>{locale === 'zh' ? '相关压缩构造' : 'Related Compression Functions'}</span>
      {related.map(p => link(p.family.id, p.instance?.name ?? p.family.name, p.instance?.id))}</p>}
  </div>;
}

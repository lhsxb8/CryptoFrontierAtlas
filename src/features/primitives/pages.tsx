import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react';
import { useLocale } from '../../app/locale';
import { SUBMISSION_GUIDE_URL } from '../../app/reporting';
import { instanceGroups, matchesSearch, routeHref } from '../../app/atlas/model';
import type { QueryPageProps } from '../../app/atlas/pages';
import { ciphers, variants, resultPoints, familyCatalogs } from '../cryptanalysis/data';
import { activeResultPoints, resultFamilyViews } from '../cryptanalysis/model';
import { countLabel, resultCounts } from '../cryptanalysis/copy';
import { primitiveCatalog } from './data';
import { directoryEntries, directoryRoutes, parameterRows } from './model';
import type { PrimitiveInstance } from './types';
import { StructurePanel } from './StructurePanel';

const entries = directoryEntries(primitiveCatalog, ciphers);
const routes = directoryRoutes(primitiveCatalog, variants);
const points = activeResultPoints(resultPoints, familyCatalogs);

function setFilter(params: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value); else next.delete(key);
  return next;
}

export function PrimitiveDirectory({searchParams, onParamsChange}: QueryPageProps) {
  const {locale, text} = useLocale();
  const query = searchParams.get('q') ?? '', category = searchParams.get('primitive') ?? '';
  const categories = [...primitiveCatalog.categories.map(c => ({id: c.id as string, label: c[locale]})),
    ...[...new Set(entries.map(p => p.category))].filter(id => !primitiveCatalog.categories.some(c => c.id === id))
      .map(id => ({id, label: id.replaceAll('_', ' ')}))];
  const filtered = entries.filter(p => (!category || p.category === category) && matchesSearch([
    p.id, p.name, p.description, ...p.aliases,
    ...primitiveCatalog.instances.filter(i => i.family_id === p.id).flatMap(i => [i.id, i.name]),
    ...variants.filter(v => v.family === p.id).flatMap(v => [v.id, v.name ?? '']),
  ].join(' '), query));
  return <section className="atlas-page atlas-directory">
    <div className="atlas-page-heading"><h1 tabIndex={-1}>{text.cipherDirectory}</h1></div>
    <div className="atlas-source-toolbar atlas-directory-toolbar">
      <label className="atlas-small-search"><Search size={17} aria-hidden="true" /><span className="sr-only">{text.searchPrimitives}</span>
        <input type="search" value={query} placeholder={text.searchPrimitives} onChange={event => onParamsChange(setFilter(searchParams, 'q', event.target.value), true)} /></label>
      <div className="atlas-inline-filters"><label>{text.primitiveType}<select value={category} onChange={event => onParamsChange(setFilter(searchParams, 'primitive', event.target.value))}>
        <option value="">{text.allPrimitiveTypes}</option>
        {category && !categories.some(c => c.id === category) && <option value={category}>{category}</option>}
        {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select></label></div>
      <div className="atlas-directory-count" role="status"><strong>{filtered.length}</strong> {text.registeredPrimitives}</div>
    </div>
    {categories.filter(c => filtered.some(p => p.category === c.id)).map(c => <section key={c.id} className="atlas-family-group">
      <div className="atlas-section-heading"><h2>{c.label}</h2></div><div className={'atlas-family-grid' + (filtered.filter(p => p.category === c.id).length === 1 ? ' is-single' : '')}>
        {filtered.filter(p => p.category === c.id).map(p => {
          const ids = new Set(routes.filter(i => i.family === p.id).map(i => i.id));
          const records = points.filter(r => r.target.variant_ids.some(id => ids.has(id)));
          const otherCount = instanceGroups(variants.filter(v => v.family === p.id)).others.length;
          const instanceCount = locale === 'zh' ? `${ids.size} ${text.instancesLabel}` : otherCount
            ? `${ids.size - otherCount} standard + ${otherCount} other instances` : countLabel(ids.size, 'instance');
          const withdrawn = p.specification_ids.some(id => primitiveCatalog.specifications.find(s => s.id === id)?.status === 'withdrawn');
          return <a className="atlas-family-card" key={p.id} href={'#/cryptanalysis/ciphers/' + p.id}>
            <div className="atlas-family-card-heading"><h3>{p.name}</h3>
              {withdrawn && <span className="atlas-status-warning" title={text.historicalStandard}>{text.withdrawnStandard}</span>}</div>
            <ArrowUpRight className="atlas-family-arrow" size={18} aria-hidden="true" />
            <div className="atlas-family-stats"><span>{instanceCount}</span><span>{records.length
              ? resultCounts(resultFamilyViews(records, familyCatalogs).length, records.length) : text.noCataloguedResults}</span></div>
          </a>;
        })}
      </div></section>)}
    {!filtered.length && <div className="atlas-empty"><h2>{text.noMatchingPrimitives}</h2>
      <button type="button" onClick={() => onParamsChange(new URLSearchParams())}>{text.resetFilters}</button></div>}
  </section>;
}

function InstanceCard({instance}: {instance: PrimitiveInstance}) {
  const {locale} = useLocale();
  return <article className="atlas-source-card atlas-primitive-instance">
    <dl className="atlas-metadata">{parameterRows(instance, locale).map(p => <div key={p.key}><dt>{p.label}</dt><dd>{p.value}</dd></div>)}</dl>
    {instance.note && <p lang="en">{instance.note}</p>}
    <p className="atlas-subtle" lang="en">{instance.locator}</p>
    <div className="atlas-external-links">{instance.specification_ids.map(id => {
      const spec = primitiveCatalog.specifications.find(s => s.id === id)!;
      return <a key={id} href={spec.url} target="_blank" rel="noreferrer">{spec.title}<ArrowUpRight size={13} aria-hidden="true" /></a>;
    })}</div>
  </article>;
}

function InstanceComparison({instances}: {instances: PrimitiveInstance[]}) {
  const {locale} = useLocale();
  const rows = instances.map(instance => ({instance, parameters: parameterRows(instance, locale)}));
  const keys = [...new Set(rows.flatMap(row => row.parameters.map(p => p.key)))];
  const differences = keys.filter(key => new Set(rows.map(row => row.parameters.find(p => p.key === key)?.value)).size > 1);
  const columns = (differences.length ? differences : keys.slice(0, 4)).map(key => rows.flatMap(row => row.parameters).find(p => p.key === key)!);
  return <section className="atlas-instance-comparison"><h2>{locale === 'zh' ? '实例差异' : 'Instance comparison'}</h2>
    <div className="atlas-instance-table-wrap" role="region" aria-label={locale === 'zh' ? '实例参数对照' : 'Instance parameter comparison'} tabIndex={0}>
      <table className="atlas-instance-table"><caption className="sr-only">{locale === 'zh' ? '实例参数对照' : 'Instance parameter comparison'}</caption>
        <thead><tr><th scope="col">{locale === 'zh' ? '实例' : 'Instance'}</th>{columns.map(p => <th scope="col" key={p.key}>{p.label}</th>)}</tr></thead>
        <tbody>{rows.map(({instance, parameters}) => <tr key={instance.id}><th scope="row"><a href={routeHref(`/cryptanalysis/ciphers/${instance.family_id}/${instance.id}`)}>{instance.name}</a></th>
          {columns.map(p => <td key={p.key}>{parameters.find(value => value.key === p.key)?.value ?? '—'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export function PrimitivePage({cipherId, variantId}: {cipherId: string; variantId?: string}) {
  const {text, locale} = useLocale();
  const primitive = primitiveCatalog.primitives.find(p => p.id === cipherId);
  const instance = variantId ? primitiveCatalog.instances.find(i => i.id === variantId && i.family_id === cipherId) : undefined;
  if (!primitive || variantId && !instance) return <section className="atlas-page atlas-unavailable">
    <h1 tabIndex={-1}>{text.recordNotFound}</h1><p>{text.unknownPrimitive}</p><a href="#/cryptanalysis">{text.cipherDirectory}</a>
  </section>;
  const instances = primitiveCatalog.instances.filter(i => i.family_id === cipherId);
  return <section className="atlas-page">
    <a className="atlas-text-link" href="#/cryptanalysis"><ArrowLeft size={15} aria-hidden="true" />{text.cipherDirectory}</a>
    <div className="atlas-page-heading"><h1 tabIndex={-1}>{instance?.name ?? primitive.name}</h1></div>
    {primitive.uses.length > 0 && <p>{text.usesPrimitives}: {primitive.uses.map((id, index) => <span key={id}>
      {index > 0 && ' · '}<a href={'#/cryptanalysis/ciphers/' + id}>{primitiveCatalog.primitives.find(p => p.id === id)!.name}</a>
    </span>)}</p>}
    <nav className="atlas-primitive-navigation" aria-label={text.allInstances}>
      <a href={'#/cryptanalysis/ciphers/' + cipherId} aria-current={!instance ? 'page' : undefined}>{locale === 'zh' ? '家族概览' : 'Family overview'}</a>
      {instances.map(i => <a key={i.id} href={routeHref(`/cryptanalysis/ciphers/${cipherId}/${i.id}`)} aria-current={i.id === instance?.id ? 'page' : undefined}>{i.name}</a>)}
    </nav>
    <StructurePanel key={variantId ?? cipherId} familyId={cipherId} instanceId={variantId} />
    {!instance && instances.length > 0 && <InstanceComparison instances={instances} />}
    <details className="atlas-instance-details"><summary>{locale === 'zh' ? '定义' : 'Definition'}</summary>
      <p lang="en">{primitive.description}</p>{instance && <InstanceCard instance={instance} />}</details>
    {!instances.length && <p>{text.noRegisteredInstances}</p>}
    <section className="atlas-primitive-specs"><h2>{text.specificationsTitle}</h2>
      {primitive.specification_ids.map(id => {
        const spec = primitiveCatalog.specifications.find(s => s.id === id)!;
        return <article className="atlas-source-card" key={id}><h3><a href={spec.url} target="_blank" rel="noreferrer">{spec.title} <ArrowUpRight size={13} aria-hidden="true" /></a></h3>
          <p lang="en">{spec.edition}</p>{spec.status === 'withdrawn' && <p className="atlas-status-warning">{text.withdrawnStandard} · {spec.withdrawn_on}</p>}
          <details className="atlas-specification-details"><summary>{text.specificationDetails}</summary>
            <p lang="en">{spec.status_note}</p><p className="atlas-subtle">{text.specificationChecked} {spec.checked_on}</p></details>
        </article>;
      })}
    </section>
    <div className="atlas-catalog-empty"><p>{text.noCataloguedResults}</p><a className="atlas-button" href={SUBMISSION_GUIDE_URL} target="_blank" rel="noreferrer">{text.contributeResult}<ArrowUpRight size={15} aria-hidden="true" /></a></div>
  </section>;
}

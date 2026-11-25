import { ArrowRight, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, FileWarning, Layers3, Search } from 'lucide-react';
import { problems } from '../../features/questions/data';
import { analysisEnabled, analysisManifest, ciphers, results, resultPoints, familyCatalogs, sources, variants, coverage } from '../../features/cryptanalysis/data';
import type { AnalysisResult, AnalysisSource, CipherVariant, KeyModel } from '../../features/cryptanalysis/types';
import { AnalysisUnavailable, CitationLabel } from '../../features/cryptanalysis';
import { activeResultPoints, citationLabel, goalLabels, instanceHref, isCostResult, keyModelLabels, publicationLabel, resultFamilyViews, resultHref } from '../../features/cryptanalysis/model';
import { countLabel } from '../../features/cryptanalysis/copy';
import { analysisScope, buildCitationIndex, enumLabel, externalLinks, matchesSearch, pageNumber, routeHref, sourcesInScope, variantLabel } from './model';
import { InstanceOptions } from './InstanceNavigation';
import { useLocale } from '../locale';
import CollectionArtwork from '../../components/CollectionArtwork';

export { PrimitiveDirectory as CipherDirectory } from '../../features/primitives/pages';

export interface QueryPageProps {
  searchParams: URLSearchParams;
  onParamsChange: (params: URLSearchParams, replace?: boolean) => void;
}

const citationIndex = buildCitationIndex(problems);
const browseResults = activeResultPoints(resultPoints, familyCatalogs);

function update(params: URLSearchParams, fields: Record<string, string | null>): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === '' || value === 'all') next.delete(key);
    else next.set(key, value);
  }
  return next;
}

export function NotFound({ label = 'Page', detail }: { label?: string; detail?: string }) {
  return <section className="atlas-page atlas-unavailable"><FileWarning size={30} aria-hidden="true" />
    <h1 tabIndex={-1}>{label} not found</h1>{detail && <p>{detail}</p>}
    <a className="atlas-button" href="#/">Back to home <ArrowRight size={15} /></a>
  </section>;
}

export function PortalPage() {
  const { text } = useLocale();
  return <section className="atlas-page atlas-portal">
    <header className="atlas-portal-heading"><h1 tabIndex={-1}>CryptoFrontier<wbr /><span>Atlas</span></h1></header>
    <div className="atlas-portal-grid">
      <a className="atlas-portal-card is-primary is-questions" href="#/questions">
        <CollectionArtwork kind="questions" /><h2>{text.questions}</h2><ArrowRight className="atlas-portal-arrow" size={21} aria-hidden="true" /></a>
      <a className="atlas-portal-card is-primary is-analysis" href="#/cryptanalysis">
        <CollectionArtwork kind="analysis" /><h2>{text.analysis}</h2><ArrowRight className="atlas-portal-arrow" size={21} aria-hidden="true" /></a>
      <a className="atlas-portal-card is-planned is-asymmetric" href="#/asymmetric-cryptanalysis"><CollectionArtwork kind="asymmetric" />
        <h2>{text.asymmetric}</h2><span className="atlas-tbd">TBD</span></a>
      <a className="atlas-portal-card is-planned is-implementation" href="#/implementation"><CollectionArtwork kind="implementation" />
        <h2>{text.implementation}</h2><span className="atlas-tbd">TBD</span></a>
    </div>
  </section>;
}

export function PlannedCollection({collection}: {collection: 'asymmetric' | 'implementation'}) {
  const {text} = useLocale();
  return <section className="atlas-page atlas-unavailable">
    <h1 tabIndex={-1}>{text[collection]}</h1><span className="atlas-tbd">TBD</span>
    <a className="atlas-button" href="#/">{text.backHome}<ArrowRight size={15} aria-hidden="true" /></a>
  </section>;
}

function Pagination({ page, total, count, onPage }: { page: number; total: number; count: number; onPage: (page: number) => void }) {
  return <div className="atlas-pagination"><span>Showing {count ? (page - 1) * 12 + 1 : 0}–{Math.min(page * 12, count)} of {count}</span><div>
    <button type="button" disabled={page <= 1} aria-label="Previous page" onClick={() => onPage(page - 1)}><ChevronLeft size={17} /></button><span>Page {page} of {total}</span>
    <button type="button" disabled={page >= total} aria-label="Next page" onClick={() => onPage(page + 1)}><ChevronRight size={17} /></button></div></div>;
}

function ExternalReferences({ source }: { source: { url?: string; doi?: string; eprint?: string } }) {
  return <div className="atlas-external-links">{externalLinks(source).map(link => <a href={link.href} key={link.href} target="_blank" rel="noreferrer">{link.label}<ArrowUpRight size={13} /></a>)}</div>;
}

function ScopeControls({ searchParams, onParamsChange }: QueryPageProps) {
  const selectedVariant = variants.find(variant => variant.id === searchParams.get('variant'));
  const family = searchParams.get('family') || selectedVariant?.family || '';
  return <div className="atlas-inline-filters"><label>Cipher<select value={family} onChange={event => onParamsChange(update(searchParams, { family: event.target.value, variant: null, goal: null, page: null }))}><option value="">All ciphers</option>{ciphers.map(cipher => <option key={cipher.id} value={cipher.id}>{cipher.name}</option>)}</select></label>
    <label>Instance<select value={selectedVariant?.id ?? ''} onChange={event => onParamsChange(update(searchParams, { family: variants.find(variant => variant.id === event.target.value)?.family ?? family, variant: event.target.value, goal: null, page: null }))}><option value="">Choose an instance</option><InstanceOptions variants={variants.filter(variant => !family || variant.family === family)} /></select></label></div>;
}

function SourceCard({ source, expanded = false, searchParams, records }: { source: AnalysisSource; expanded?: boolean; searchParams: URLSearchParams; records: AnalysisResult[] }) {
  const linked = records.filter(result => result.evidence.some(evidence => evidence.source_id === source.id));
  const discrepancyLinked = records.filter(result => !linked.includes(result) && result.field_conflicts?.some(conflict => conflict.observations.some(observation => observation.source_id === source.id)));
  const context = new URLSearchParams();
  if (searchParams.has('variant')) context.set('variant', searchParams.get('variant')!);
  return <article className="atlas-source-card"><div className="atlas-entry-line"><a href={source.publication.url} target="_blank" rel="noreferrer">{publicationLabel(source)}<ArrowUpRight size={12} aria-hidden="true" /></a><span>{enumLabel(source.publication.kind)}</span></div>
    {expanded ? <h2><CitationLabel label={citationLabel(source)} /> {source.title}</h2> : <h2><a href={routeHref('/cryptanalysis/sources/' + source.id, searchParams)}><CitationLabel label={citationLabel(source)} /> {source.title}<ArrowUpRight size={16} /></a></h2>}
    <p className="atlas-source-authors">{source.authors.join(' · ')}</p>{source.publication.event_year && source.publication.event_year !== source.publication.year && <p>Conference event: {source.publication.event_year} · Proceedings published: {source.publication.year}</p>}<ExternalReferences source={source} />
    <details open={expanded ? true : undefined}><summary>Version &amp; evidence <ChevronRight size={14} /></summary><dl className="atlas-metadata"><div><dt>Inspected version</dt><dd>{source.inspected_version}</dd></div><div><dt>Accessed</dt><dd>{source.accessed_on}</dd></div><div><dt>Source ID</dt><dd><code>{source.id}</code></dd></div><div><dt>SHA-256</dt><dd>{source.content_sha256 ? <code>{source.content_sha256}</code> : 'Hash not available'}</dd></div><div><dt>Hash scope</dt><dd>{source.hash_note}</dd></div></dl>
      {source.locators.length > 0 && <><h3>Inspected locations</h3><ul>{source.locators.map(locator => <li key={locator}>{locator}</li>)}</ul></>}
      {source.artifact_url && <><h3>Associated artifact</h3><ExternalReferences source={{ url: source.artifact_url }} />{source.artifact_sha256 && <p className="atlas-long-code"><code>{source.artifact_sha256}</code></p>}</>}
      <h3>Directly citing results · {linked.length}</h3>{linked.length ? <ul className="atlas-link-list">{linked.map(result => <li key={result.id}><a href={resultHref(result.id, context)}>{result.title}<ArrowUpRight size={13} /></a></li>)}</ul> : null}
      {discrepancyLinked.length > 0 && <><h3>Discrepancy citations · {discrepancyLinked.length}</h3><ul className="atlas-link-list">{discrepancyLinked.map(result => <li key={result.id}><a href={resultHref(result.id, context)}>{result.title}<ArrowUpRight size={13} /></a></li>)}</ul></>}
    </details>
  </article>;
}

export function SourcesPage({ collection, id, searchParams, onParamsChange }: QueryPageProps & { collection: 'questions' | 'analysis'; id?: string }) {
  if (collection === 'analysis' && !analysisEnabled) return <AnalysisUnavailable />;
  const scope = analysisScope(searchParams, ciphers, variants, resultPoints);
  if (collection === 'analysis' && scope.invalid) return <NotFound label="Analysis scope" />;
  const scopedSources = sourcesInScope(sources, scope);
  if (id) {
    const source = scopedSources.find(source => source.id === id);
    if (!source) return <NotFound label="Source in this scope" />;
    return <section className="atlas-page"><a className="atlas-text-link" href={routeHref('/cryptanalysis/sources', searchParams)}><ChevronLeft size={15} />All analysis sources</a><div className="atlas-page-heading"><div><h1 tabIndex={-1}>Source details</h1><p>{scope.variant ? variantLabel(scope.variant) : scope.family?.name ?? 'All ciphers'}</p></div></div><SourceCard source={source} expanded searchParams={searchParams} records={scope.records} /></section>;
  }
  const query = searchParams.get('q') ?? '';
  const filteredSources = scopedSources.filter(source => matchesSearch([citationLabel(source), source.title, source.id, source.year, publicationLabel(source), source.publication.venue, source.publication.year, ...source.authors, source.doi, source.eprint].join(' '), query));
  const filteredCitations = citationIndex.filter(entry => matchesSearch([entry.citation.label, entry.citation.doi, entry.citation.eprint, ...entry.questions.map(question => question.title)].join(' '), query));
  const count = collection === 'analysis' ? filteredSources.length : filteredCitations.length;
  const total = Math.max(1, Math.ceil(count / 12));
  const page = pageNumber(searchParams.get('page'), total);
  const change = (fields: Record<string, string | null>, replace = false) => onParamsChange(update(searchParams, { page: null, ...fields }), replace);
  return <section className="atlas-page"><div className="atlas-page-heading"><div><h1 tabIndex={-1}>{collection === 'questions' ? 'Question citations' : 'Analysis sources'}</h1></div><BookOpen size={28} /></div>
    <div className="atlas-source-toolbar"><label className="atlas-small-search"><Search size={16} /><span className="sr-only">Search sources</span><input type="search" value={query} placeholder={collection === 'analysis' ? 'Citation, title, author, venue, DOI…' : 'Title, author, DOI…'} onChange={event => change({ q: event.target.value }, true)} /></label>{collection === 'analysis' && <ScopeControls searchParams={searchParams} onParamsChange={onParamsChange} />}</div>
    <p className="atlas-subtle">{countLabel(count, collection === 'analysis' ? 'matching source version' : 'matching citation entry', collection === 'analysis' ? 'matching source versions' : 'matching citation entries')}</p>
    <div className="atlas-source-list">{collection === 'analysis' ? filteredSources.slice((page - 1) * 12, page * 12).map(source => <SourceCard key={source.id} source={source} searchParams={searchParams} records={scope.records} />) : filteredCitations.slice((page - 1) * 12, page * 12).map(entry => <article key={entry.key} className="atlas-source-card"><h2>{entry.citation.label}</h2>{entry.citation.locator && <p>{entry.citation.locator}</p>}<ExternalReferences source={entry.citation} /><details><summary>Cited by {new Set(entry.questions.map(question => question.id)).size} questions <ChevronRight size={14} /></summary><ul className="atlas-link-list">{entry.questions.map(question => <li key={question.id + question.role}><a href={'#/questions/' + question.id}>{question.title}<ArrowUpRight size={13} /></a><small>{enumLabel(question.role)}</small></li>)}</ul></details></article>)}</div>
    {!count && <div className="atlas-empty"><h2>{query ? 'No matching sources' : 'No catalogued sources in this scope'}</h2>{query && <button type="button" onClick={() => change({ q: null })}>Clear search</button>}</div>}
    {count > 0 && <Pagination page={page} total={total} count={count} onPage={next => onParamsChange(update(searchParams, { page: String(next) }))} />}
  </section>;
}

function CoverageMatrix({ records, variant, goal }: { records: AnalysisResult[]; variant: CipherVariant; goal: string }) {
  const models = Object.keys(keyModelLabels) as KeyModel[];
  const visible = records.filter(result => Boolean(goal) || isCostResult(result));
  const variable = visible.filter(result => result.target.round_domain);
  const rounds = [...new Set([...Array.from({ length: variant.full_rounds }, (_, index) => index + 1), ...visible.flatMap(result => result.target.rounds === null ? [] : [result.target.rounds])])].sort((a, b) => a - b);
  return <div className="atlas-matrix-section"><div className="atlas-section-heading"><h2>{variantLabel(variant)} recorded coverage</h2><span>Key model × rounds</span></div>
    <p className="atlas-subtle">Catalogued results · —: not catalogued · source-defined rounds</p>
    <div className="atlas-table-scroll" role="region" aria-label={`${variantLabel(variant)} coverage by key model and rounds`} tabIndex={0}><table className="atlas-coverage-matrix"><caption className="sr-only">{variantLabel(variant)} result counts for the selected goal</caption><thead><tr><th scope="col">Key model / rounds</th>{rounds.map(round => <th scope="col" key={round}>{round}</th>)}{variable.length > 0 && <th scope="col">Variable-round theorems</th>}</tr></thead><tbody>{models.map(model => <tr key={model}><th scope="row">{keyModelLabels[model]}</th>{rounds.map(round => {
      const matching = visible.filter(result => result.setting.key_model === model && result.target.rounds === round);
      const params = new URLSearchParams({ key_model: model, rounds: String(round) });
      if (goal) params.set('goal', goal);
      return <td key={round} className={matching.length ? 'is-recorded' : ''}>{matching.length ? <a href={instanceHref(variant.family, variant.id, params)} aria-label={`${countLabel(matching.length, 'result')}, ${keyModelLabels[model]}, ${round} rounds`}>{matching.length}</a> : <span aria-label="Not yet catalogued">—</span>}</td>;
    })}{variable.length > 0 && <td>{variable.some(result => result.setting.key_model === model) ? <a href={instanceHref(variant.family, variant.id, new URLSearchParams({ scope: 'variable', key_model: model, ...(goal ? { goal } : {}) }))}>{variable.filter(result => result.setting.key_model === model).length}</a> : '—'}</td>}</tr>)}</tbody></table></div></div>;
}

export function CoveragePage({ searchParams, onParamsChange }: QueryPageProps) {
  if (!analysisEnabled) return <AnalysisUnavailable />;
  const scope = analysisScope(searchParams, ciphers, variants, browseResults);
  if (scope.invalid) return <NotFound label="Analysis scope" />;
  const query = searchParams.get('q') ?? '';
  const goal = searchParams.get('goal') ?? '';
  const goals = [...new Set(scope.records.map(result => result.goal))].sort();
  const selected = scope.records.filter(result => !goal || result.goal === goal);
  // The audit ledger covers detailed records, including retained historical points.
  const selectedIds = new Set(analysisScope(searchParams, ciphers, variants, results).records.map(result => result.id));
  const ledgerApplies = Boolean(coverage && (!scope.family || coverage.family_ids.includes(scope.family.id)));
  const issues = ledgerApplies ? coverage!.issues.filter(issue => (!issue.affected_records.length || issue.affected_records.some(id => selectedIds.has(id))) && matchesSearch([issue.id, issue.status, issue.action, ...issue.evidence].join(' '), query)) : [];
  const pending = ledgerApplies ? coverage!.pending_sources.filter(source => matchesSearch([source.id, source.status, source.reason].join(' '), query)) : [];
  const context = scope.variant ? new URLSearchParams({ variant: scope.variant.id }) : scope.family ? new URLSearchParams({ family: scope.family.id }) : new URLSearchParams();
  const ledgerNames = coverage?.family_ids.map(id => ciphers.find(cipher => cipher.id === id)?.name ?? id).join(', ');
  return <section className="atlas-page"><div className="atlas-page-heading"><div><h1 tabIndex={-1}>Coverage &amp; audit</h1></div></div>
    <div className="atlas-source-toolbar"><ScopeControls searchParams={searchParams} onParamsChange={onParamsChange} />{scope.variant && <div className="atlas-inline-filters"><label>Result goal<select value={goal} onChange={event => onParamsChange(update(searchParams, { goal: event.target.value }))}><option value="">All cost-result goals</option>{goal && !goals.some(value => value === goal) && <option value={goal}>{goalLabels[goal as keyof typeof goalLabels] ?? enumLabel(goal)} · No records in this instance</option>}{goals.map(value => <option key={value} value={value}>{goalLabels[value]}</option>)}</select></label></div>}</div>
    {scope.variant ? <CoverageMatrix records={selected} variant={scope.variant} goal={goal} /> : <div className="atlas-notice"><Layers3 size={20} /><p>Select an instance for coverage.</p></div>}
    <div className="atlas-scope-summary"><span><strong>{scope.records.length}</strong> {scope.records.length === 1 ? 'reported point' : 'reported points'} in {scope.variant ? variantLabel(scope.variant) : scope.family?.name ?? 'the directory'}</span><span><strong>{resultFamilyViews(scope.records, familyCatalogs).length}</strong> {resultFamilyViews(scope.records, familyCatalogs).length === 1 ? 'result' : 'results'}</span><span><strong>{scope.records.filter(result => result.result_kind === 'structural_bound').length}</strong> structural bounds</span><span><strong>{scope.records.filter(result => result.result_kind === 'structural_property').length}</strong> structural properties</span></div>
    {!ledgerApplies ? <div className="atlas-empty"><h2>No audit ledger for this scope</h2></div> : <>
      <div className="atlas-section-heading"><h2>Audit scope · {ledgerNames}</h2><span>Reviewed {coverage!.reviewed_on}</span></div>
      <div className="atlas-coverage-grid"><section className="atlas-side-card"><h2>Ledger totals · {ledgerNames}</h2><p>Includes historical records</p><dl className="atlas-count-list">{Object.entries(coverage!.included_counts).map(([category, count]) => <div key={category}><dt>{enumLabel(category)}</dt><dd>{count}</dd></div>)}</dl></section><section className="atlas-side-card"><h2>Coverage gaps · {ledgerNames}</h2><ul className="atlas-spaced-list">{coverage!.not_yet_covered.map(item => <li key={item}>{item}</li>)}</ul></section></div>
      <label className="atlas-small-search atlas-ledger-search"><Search size={17} /><span className="sr-only">Search audit ledger</span><input type="search" value={query} placeholder="Conflicts, versions, pending literature…" onChange={event => onParamsChange(update(searchParams, { q: event.target.value }), true)} /></label>
      <div className="atlas-section-heading"><h2>Source issues &amp; accounting notes <span>{issues.length}</span></h2></div><div className="atlas-source-list">{issues.map(issue => <article className="atlas-source-card" key={issue.id}><span className={'atlas-state ' + (issue.status === 'source_conflict' ? 'is-conflict' : '')}>{enumLabel(issue.status)}</span><h3>{enumLabel(issue.id)}</h3><p>{issue.action}</p>{!issue.affected_records.length && <p>Family-wide · {ledgerNames}</p>}<details><summary>Evidence and affected records <ChevronRight size={14} /></summary><ul>{issue.evidence.map(evidence => <li key={evidence}>{evidence}</li>)}</ul>{issue.original_url && <ExternalReferences source={{ url: issue.original_url }} />}<ul className="atlas-link-list">{issue.affected_records.filter(id => selectedIds.has(id)).map(id => <li key={id}><a href={resultHref(id, scope.variant ? context : undefined)}>{results.find(result => result.id === id)?.title ?? id}<ArrowUpRight size={13} /></a></li>)}</ul></details></article>)}</div>
      <div className="atlas-section-heading"><h2>Pending literature <span>{pending.length}</span></h2></div><div className="atlas-related-grid">{pending.map(source => <article className="atlas-source-card" key={source.id}><span className="atlas-state">{enumLabel(source.status)}</span><h3>{enumLabel(source.id)}</h3><p>{source.reason}</p><ExternalReferences source={source} />{source.reviewed_source_id && <a className="atlas-text-link" href={routeHref('/cryptanalysis/sources/' + source.reviewed_source_id, new URLSearchParams())}>Inspected version <ArrowUpRight size={13} /></a>}</article>)}</div>
      {coverage!.ingestion_batches?.filter(batch => [...batch.new_records, ...batch.indexed_existing_records].some(id => selectedIds.has(id))).map(batch => <details className="atlas-source-card atlas-methods" key={batch.id}><summary>{batch.reviewed_on} · Ingestion batch<ChevronRight size={15} /></summary><p>{batch.note}</p><ul className="atlas-link-list">{batch.new_records.filter(id => selectedIds.has(id)).map(id => <li key={id}><a href={resultHref(id, scope.variant ? context : undefined)}>{results.find(result => result.id === id)?.title ?? id}</a></li>)}</ul></details>)}
      <details className="atlas-source-card atlas-methods"><summary>Review scope <ChevronRight size={15} /></summary><p>{coverage!.selection}</p><p>{analysisManifest?.verification_scope}</p><dl className="atlas-metadata">{Object.entries(coverage!.review_process).map(([key, value]) => <div key={key}><dt>{enumLabel(key)}</dt><dd>{value}</dd></div>)}</dl></details>
    </>}
  </section>;
}

import { useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Columns3, ExternalLink, Filter, Layers3, Search, TriangleAlert, X } from 'lucide-react';
import { analysisEnabled, ciphers, resultPoints, familyCatalogs, sources, variants, comparability, compareReportedCosts } from './data';
import type { AnalysisResult, AnalysisSource, CipherVariant } from './types';
import { problems } from '../questions/data';
import { variantLabel as variantName, variantParameters } from '../../app/atlas/model';
import { InstanceNavigation } from '../../app/atlas/InstanceNavigation';
import { StructurePanel } from '../primitives/StructurePanel';
import { primitiveStructures } from '../primitives/data';
import { structureBinding } from '../primitives/model';
import { citationLabel, comparisonHref, comparisonSelection, filterResults, goalLabels, humanize, instanceHref, isCostResult, keyModelLabels, methodLabels, MAX_COMPARISON_RECORDS, publicationLabel, resolveInstance, resultCitationLabel, resultFilterKeys, resultHref, resultsForVariant, sourceHref, sourcesForResult, switchInstanceParams, uniqueResults, updateResultFilter, withSelectedResults, withVariantContext } from './model';
import type { ComparisonSelection } from './model';
import { computationLabels, surfaceLabels, resourceEntries, resourceLabels } from './model';
import { ResourceValue } from './ResourceValue';
import { SuccessValue, successConflicts } from './SuccessValue';
import { Formula } from './Formula';
import { MathText } from '../../components/MathText';
import { FamilyModel } from './ResultFamilyPanel';
import { activeResultPoints, comparisonView, modelSelectionId, resultFamilyViews } from './model';
import type { ResultFamilyView } from './model';
import { countLabel, resultGroupTitle } from './copy';
import { complexityTitle, ModelConditions, ModelDomain, ModelResource, ModelSuccess, ResultTitle, modelPriorKnowledge, parameterChoice } from './ComplexityModels';
import { CitationLabel } from './CitationLabel';
import { ExperimentDefinition, ExperimentSummary, TheoremValue } from './TargetSemantics';
import { roundLabel, roundScopeLabel } from './model';
import { attackSurfaces, clearResultFilters, resultPageParams } from './model';
import { attackRows, attackBlocks, type AttackRow } from './AttackTable';
import { ResultSections } from './ResultSections';
import { Conditions } from './Conditions';
import { readerNotes, recoveryScopeLabel } from './presentation';
import { useLocale } from '../../app/locale';
import { SUBMISSION_GUIDE_URL } from '../../app/reporting';
import './analyses.css';

export { ResourceValue } from './ResourceValue';

export { CitationLabel } from './CitationLabel';

type SearchProps = {
  searchParams: URLSearchParams;
  onParamsChange: (params: URLSearchParams, replace?: boolean) => void;
};

const registryResults = uniqueResults(resultPoints);
const browseResults = activeResultPoints(registryResults, familyCatalogs);
const sourceById = new Map(sources.map((source) => [source.id, source]));
const problemById = new Map(problems.map((problem) => [problem.id, problem]));
const dimensions = Object.keys(resourceLabels) as (keyof typeof resourceLabels)[];
const familyHref = (id: string) => `#/cryptanalysis/ciphers/${encodeURIComponent(id)}`;
const modelValue = (value: string) => /^[a-z]+(?:_[a-z]+)+$/.test(value) ? humanize(value) : value;

export function AnalysisUnavailable() {
  const { text } = useLocale();
  return <section className="a-page a-unavailable" aria-labelledby="a-unavailable-heading">
    <Layers3 size={30} aria-hidden="true" />
    <h1 id="a-unavailable-heading" tabIndex={-1}>{text.analysisEmptyTitle}</h1>
    <p>{text.noCataloguedResults}</p>
    <a className="a-button" href={SUBMISSION_GUIDE_URL} target="_blank" rel="noreferrer">{text.contributeResult} <ExternalLink size={15} aria-hidden="true" /></a>
  </section>;
}

function InvalidInstance() {
  return <section className="a-page a-empty"><h1 tabIndex={-1}>Cipher instance not found</h1><a className="a-button" href="#/cryptanalysis">Cipher directory</a></section>;
}

function ClaimBadge({ record }: { record: AnalysisResult }) {
  if (record.assessment.claim_status !== 'source_conflict') return null;
  const conflicting = dimensions.filter(dimension => record.resources[dimension]?.status === 'conflict');
  const fields = record.field_conflicts ?? [];
  const labels = [...(conflicting.length ? [humanize(conflicting.join(', '))] : []), ...fields.map(field => field.label)];
  const label = labels.length ? `${labels.join(', ')} discrepancy` : 'Source conflict';
  const explanation = [`Source conflict · Reviewed ${record.assessment.reviewed_on}`, ...conflicting.map(dimension => `${resourceLabels[dimension]}: ${record.resources[dimension]!.note}`), ...fields.map(field => `${field.label}: ${field.description}`)].join('\n');
  return <span className="a-badge a-badge-warning" title={explanation}><TriangleAlert size={12} aria-hidden="true" />{labels.length > 0 && <span className="sr-only">Source conflict: </span>}{label}</span>;
}

function SharedBadge({ record }: { record: AnalysisResult }) {
  return record.target.variant_ids.length > 1 ? <span className="a-badge a-shared-badge" title="Applies to multiple cipher instances. See Applicable instances in the result details.">Shared result</span> : null;
}

function ResultAssessment({ record }: { record: AnalysisResult }) {
  return <div className="a-assessment"><ClaimBadge record={record} /><span>{record.assessment.primary_text === 'checked' ? 'Primary text checked' : 'Source review: ' + humanize(record.compact_review?.scope || 'not_recorded')}</span>{record.assessment.reproduction === 'collision_witness_only' && <span>Collision witness checked</span>}</div>;
}

function VerificationDetails({ record }: { record: AnalysisResult }) {
  return <Metadata items={[
    { label: 'Source review', value: record.assessment.primary_text === 'checked' ? 'Primary text checked' : humanize(record.compact_review?.scope || 'not_recorded') },
    { label: 'Independent reproduction', value: record.assessment.reproduction === 'collision_witness_only' ? 'Collision witness checked; full attack not reproduced' : 'Not performed' },
    { label: 'Best-known assessment', value: humanize(record.assessment.frontier_status) },
    ...(record.compact_review?.next_action ? [{ label: 'Review follow-up', value: record.compact_review.next_action }] : []),
  ]} />;
}

function SelectFilter({ label, value, onChange, options, any = 'All' }: {
  label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; any?: string;
}) {
  const unknown = Boolean(value) && !options.some((option) => option.value === value);
  return <label className="a-filter"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">{any}</option>{unknown && <option value={value}>{humanize(value)}</option>}
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select></label>;
}

function SelectionNotice({ selection, name }: { selection: ComparisonSelection; name: string }) {
  const notices = [
    ...(selection.staleContext ? ['The selection belongs to a different instance and has been cleared.'] : []),
    ...(selection.unknownIds.length ? [`${selection.unknownIds.length} unknown record IDs were excluded.`] : []),
    ...(selection.inapplicableIds.length ? [`${selection.inapplicableIds.length} records do not apply to ${name} and were excluded.`] : []),
    ...(selection.structuralIds.length ? [`${selection.structuralIds.length} structural results were excluded from cost comparison.`] : []),
    ...(selection.excessIds.length ? [`Only the first ${MAX_COMPARISON_RECORDS} eligible records are selected.`] : []),
  ];
  return notices.length ? <div className="a-notice a-notice-warning a-selection-warning" role="status"><TriangleAlert size={17} aria-hidden="true" /><div>{notices.map((notice) => <p key={notice}>{notice}</p>)}</div></div> : null;
}

function CandidateSpaceValue({ record, expanded = false }: { record: AnalysisResult; expanded?: boolean }) {
  const space = record.candidate_space;
  if (!space) return <span className="a-small">Not reported</span>;
  return <div className="a-candidate-space"><p className="a-small">{space.material_bits}-bit key material{expanded && ` · ${space.material}`}</p>
    {space.observations.map((observation, index) => <div className="a-candidate-observation" key={index}><strong>{humanize(observation.statistic)}</strong><ResourceValue resource={observation.count} expanded={expanded} />
      {expanded && ['sample_mean', 'sample_maximum', 'observed_values'].includes(observation.statistic) && <p className="a-small">{observation.sample_count === null ? 'Trial count not reported' : `${observation.sample_count.toLocaleString('en-US')} trials`}</p>}</div>)}
  </div>;
}

export function ResultsPage({ cipherId, variantId, searchParams, onParamsChange }: SearchProps & { cipherId: string; variantId?: string }) {
  if (!analysisEnabled) return <AnalysisUnavailable />;
  const family = ciphers.find(cipher => cipher.id === cipherId);
  if (!family) return <section className="a-page a-empty"><h1 tabIndex={-1}>Cipher not found</h1><a className="a-button" href="#/cryptanalysis">Cipher directory</a></section>;
  const instance = resolveInstance(cipherId, variantId, ciphers, variants);
  if (!instance) return variantId !== undefined ? <InvalidInstance /> : <section className="a-page a-empty"><h1 tabIndex={-1}>{family.name}</h1><p>No instances are catalogued for this cipher yet.</p><a className="a-button" href="#/cryptanalysis">All ciphers</a></section>;
  const { cipher, variant } = instance;
  const applicable = resultsForVariant(browseResults, variant.id);
  const listParams = resultPageParams(searchParams);
  const filtered = filterResults(applicable, variant.id, listParams, sources, familyCatalogs);
  const selection = comparisonSelection(searchParams, registryResults, variant.id, familyCatalogs);
  const selected = selection.ids;
  const contextParams = withVariantContext(withSelectedResults(listParams, selected), variant.id);
  // Legacy ?view=points is accepted, but has no separate presentation.
  contextParams.delete('view');
  contextParams.delete('compare');
  const comparisonParams = new URLSearchParams(contextParams);
  const views = resultFamilyViews(filtered, familyCatalogs);
  const rowCount = attackBlocks(attackRows(views, searchParams.get('q') || '')).length;
  const activeFilterCount = resultFilterKeys.filter((key) => Boolean(listParams.get(key))).length;
  const changeFilter = (key: string, value: string, replace = false) => onParamsChange(updateResultFilter(contextParams, key, value), replace);
  const toggleSelected = (id: string) => {
    if (!selected.includes(id) && selected.length >= MAX_COMPARISON_RECORDS) return;
    onParamsChange(withSelectedResults(contextParams, selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]), true);
  };
  const reset = () => onParamsChange(clearResultFilters(contextParams));
  const rounds = [...new Set(applicable.flatMap((record) => record.target.rounds === null ? [] : [record.target.rounds]))].sort((a, b) => a - b);
  const methods = [...new Set(applicable.map((record) => record.display.method))].sort();
  const techniques = [...new Set(applicable.flatMap((record) => record.techniques))].sort();
  const oracles = [...new Set(applicable.flatMap((record) => record.setting.oracle_access))].sort();
  const select = (key: string, label: string, options: { value: string; label: string }[], any?: string) => <SelectFilter label={label} value={searchParams.get(key) || ''} onChange={(value) => changeFilter(key, value)} options={options} any={any} />;
  return <section className="a-page" aria-labelledby="a-results-heading">
    <div className="a-breadcrumbs"><a href="#/cryptanalysis">Cipher directory</a><span>/</span><span>{cipher.name}</span><span>/</span><span>{variantName(variant)}</span></div>
    <header className="a-page-heading"><div><h1 id="a-results-heading" tabIndex={-1}>{variantName(variant)}</h1>{!structureBinding(primitiveStructures, cipher.id, variant.id) && <p>{variantParameters(variant)}</p>}</div></header>
    <InstanceNavigation variants={variants.filter(entry => entry.family === cipher.id)} activeId={variant.id}
      href={entry => instanceHref(cipher.id, entry.id, entry.id === variant.id ? contextParams : switchInstanceParams(contextParams))} />
    <StructurePanel key={`structure:${variant.id}`} familyId={cipher.id} instanceId={variant.id} resultsId="a-analysis-results" />
    <div className="a-results-intro" id="a-analysis-results" tabIndex={-1}><h2>Analysis results</h2><div className="a-result-actions">
      <a className="a-text-link" href={`#/cryptanalysis/coverage?variant=${variant.id}`}>Coverage &amp; audit</a>
      <a className="a-text-link" id="a-compare-results" aria-label="Compare results" href={comparisonHref(variant.id, selected, comparisonParams)}><Columns3 size={15} aria-hidden="true" />Compare</a>
    </div></div>
    <SelectionNotice selection={selection} name={variantName(variant)} />
    <div className="a-search-row"><label className="a-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search analysis results</span><input type="search" value={searchParams.get('q') || ''} placeholder={`Search within ${variantName(variant)}…`} onChange={(event) => changeFilter('q', event.target.value, true)} /></label><SelectFilter label="Sort" value={searchParams.get('sort') || 'rounds-desc'} onChange={(value) => changeFilter('sort', value)} options={[{ value: 'rounds-desc', label: 'Rounds · method · year' }, { value: 'source-year-desc', label: 'Source year' }, { value: 'reviewed-desc', label: 'Latest review' }, { value: 'title', label: 'Title' }]} /></div>
    <div className="a-filters" aria-label="Analysis filters">
      {select('rounds', 'Rounds', rounds.map((round) => ({ value: String(round), label: `${round} rounds` })), 'Any round count')}
      {select('goal', 'Goal', Object.entries(goalLabels).map(([value, label]) => ({ value, label })), 'All goals')}
      {select('key_model', 'Key model', Object.entries(keyModelLabels).map(([value, label]) => ({ value, label })), 'All key models')}
      {select('method', 'Attack method', methods.map((value) => ({ value, label: methodLabels[value] })), 'All methods')}
    </div>
    <details className="a-more-filters" open={Boolean(searchParams.get('scope') || searchParams.get('computation') || searchParams.get('technique') || searchParams.get('oracle') || searchParams.get('assessment')) || undefined}><summary><Filter size={14} aria-hidden="true" /> More filters</summary><div className="a-filters a-secondary-filters">
      {select('scope', 'Round scope', [{ value: 'full', label: 'Full round' }, { value: 'reduced', label: 'Reduced round' }, { value: 'variable', label: 'Variable round' }], 'All round scopes')}
      {select('computation', 'Computation', Object.entries(computationLabels).map(([value, label]) => ({ value, label })), 'All computation models')}
      {select('technique', 'Specific technique', techniques.map((value) => ({ value, label: humanize(value) })), 'All techniques')}
      {select('oracle', 'Oracle access', oracles.map((value) => ({ value, label: humanize(value) })), 'All access models')}
      {select('assessment', 'Evidence', [{ value: 'author_reported', label: 'Author reported' }, { value: 'source_conflict', label: 'Source conflict' }, { value: 'witness_checked', label: 'Collision witness checked only' }, { value: 'not_reproduced', label: 'Reproduction not attempted' }], 'All evidence states')}
    </div></details>
    <div className="a-list-toolbar"><span role="status">{countLabel(rowCount, 'result')}{activeFilterCount ? ` · ${countLabel(activeFilterCount, 'active filter')}` : ''}</span>{activeFilterCount > 0 && <button className="a-text-button" onClick={reset}>Clear filters <X size={13} aria-hidden="true" /></button>}</div>
    {views.length > 0 ? <ResultSections key={variant.id} views={views} sources={sources} variant={variant} params={contextParams} selected={selected} onToggle={toggleSelected}
      renderStructural={record => record.result_kind === 'structural_bound' ? <BoundValue record={record} /> : <PropertyValue record={record} />} />
      : <div className="a-empty a-compact-empty"><Search size={24} aria-hidden="true" /><h2>{applicable.length ? 'No matching results' : 'No catalogued results'}</h2>{activeFilterCount > 0 && <button className="a-button" onClick={reset}>Clear filters</button>}</div>}
    {selected.length > 0 && <div className="a-selection-bar a-selection-active" aria-label="Comparison selection"><Columns3 size={18} aria-hidden="true" /><div><strong role="status">{selected.length}/{MAX_COMPARISON_RECORDS} selected</strong></div><button className="a-text-button" onClick={() => {document.getElementById('a-compare-results')?.focus(); onParamsChange(withSelectedResults(contextParams, []), true);}}>Clear</button>{selected.length >= 2 ? <a className="a-button" href={comparisonHref(variant.id, selected, comparisonParams)}>Compare <ArrowRight size={15} aria-hidden="true" /></a> : <span className="a-button a-button-disabled" aria-disabled="true">Select one more</span>}</div>}
    {selected.length > 0 && <div className="a-selected-chips">{selected.map((id) => {
      const title = complexityTitle(comparisonView(id, registryResults, familyCatalogs)!);
      return <button key={id} onClick={() => toggleSelected(id)} aria-label={`Remove ${title} from comparison`}><span><ResultTitle title={title} recordId={id} /></span><X size={13} aria-hidden="true" /></button>;
    })}</div>}
  </section>;
}

function Metadata({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return <dl className="a-metadata">{items.map(({ label, value }, index) => <div key={typeof label === 'string' ? label : index}><dt>{label}</dt><dd>{typeof value === 'string' ? <MathText text={value} /> : value}</dd></div>)}</dl>;
}

function BoundValue({ record }: { record: AnalysisResult }) {
  const bound = record.bound;
  return bound ? <div className="a-bound"><strong>{bound.metric === 'active_sboxes' ? 'Active S-boxes' : humanize(bound.metric)} <Formula expression={`${bound.relation} ${bound.value}`} readable /></strong><p><Formula expression={bound.quantifier} readable /></p><p><Formula expression={bound.scope} readable /></p></div> : <span className="a-small">No separate structural bound in this record</span>;
}

function PropertyValue({ record, expanded = false }: { record: AnalysisResult; expanded?: boolean }) {
  if (record.theorem) return <TheoremValue record={record} expanded={expanded} />;
  const property = record.property;
  if (!property) return null;
  return <div className="a-bound a-property"><strong><Formula expression={property.statement} readable /></strong><p><Formula expression={property.quantifier} readable /></p><p><Formula expression={property.scope} readable /></p>{expanded && <>
    <Metadata items={property.parameters.map(parameter => ({ label: <Formula expression={parameter.name} />, value: <><span className="a-expression"><Formula expression={parameter.reported} /></span><p><Formula expression={parameter.meaning} /></p></> }))} />
    <h3>Validation scope · {humanize(property.validation.basis)}</h3><p><Formula expression={property.validation.description} /></p>
  </>}</div>;
}

function SourceEvidence({ source, evidence, variantId }: { source?: AnalysisSource; evidence: AnalysisResult['evidence'][number]; variantId?: string }) {
  return <article className="a-evidence-entry"><h3>{source ? <a href={sourceHref(source.id, variantId)}><CitationLabel label={citationLabel(source)} /> <MathText text={source.title} /> <ArrowRight size={13} aria-hidden="true" /></a> : evidence.source_id}</h3>{source && <p className="a-small">{source.authors.join(', ')} · {source.year}</p>}<p className="a-evidence-locator"><BookOpen size={14} aria-hidden="true" /><span><Formula expression={evidence.locator} /></span></p><p><Formula expression={evidence.interpretation} /></p><span className="a-small">Supports: {evidence.fields.map(field => field.split('/').filter(Boolean).map(humanize).join(' / ')).join(', ')}</span>
    {source && <details className="a-disclosure"><summary>Source version and file hash</summary><Metadata items={[{ label: 'Version', value: source.inspected_version }, { label: 'Accessed', value: source.accessed_on }, { label: 'SHA-256', value: source.content_sha256 ? <code className="a-hash">{source.content_sha256}</code> : 'Not available' }, { label: 'Hash provenance', value: source.hash_note }, ...(source.artifact_sha256 ? [{ label: 'Artifact SHA-256', value: <code className="a-hash">{source.artifact_sha256}</code> }] : [])]} /><div className="a-link-row"><a href={source.url} target="_blank" rel="noreferrer">Inspected source <ExternalLink size={13} aria-hidden="true" /></a>{source.doi && <a href={`https://doi.org/${source.doi}`} target="_blank" rel="noreferrer">DOI <ExternalLink size={13} aria-hidden="true" /></a>}{source.artifact_url && <a href={source.artifact_url} target="_blank" rel="noreferrer">Source artifact <ExternalLink size={13} aria-hidden="true" /></a>}</div></details>}
  </article>;
}

export function ResultDetail({ id, searchParams }: { id: string; searchParams: URLSearchParams }) {
  if (!analysisEnabled) return <AnalysisUnavailable />;
  const record = registryResults.find((entry) => entry.id === id);
  if (!record) return <section className="a-page a-empty"><h1 tabIndex={-1}>Analysis record not found</h1><a className="a-button" href="#/cryptanalysis">Cipher directory</a></section>;
  const applicable = variants.filter((variant) => record.target.variant_ids.includes(variant.id));
  const requestedVariant = searchParams.get('variant');
  const current = requestedVariant ? applicable.find((variant) => variant.id === requestedVariant) : applicable.length === 1 ? applicable[0] : undefined;
  const invalidContext = Boolean(requestedVariant && !current);
  const pageParams = resultPageParams(searchParams);
  const contextParams = current ? withVariantContext(pageParams, current.id) : switchInstanceParams(pageParams);
  const selection = current ? comparisonSelection(contextParams, registryResults, current.id, familyCatalogs) : null;
  const selected = selection?.ids ?? [];
  const selectionFull = selected.length >= MAX_COMPARISON_RECORDS && !selected.includes(id);
  const comparisonIds = selected.includes(id) || selectionFull ? selected : [...selected, id];
  const commonFamily = [...new Set(applicable.map((variant) => variant.family))];
  const backHref = current ? instanceHref(current.family, current.id, withSelectedResults(contextParams, selected)) : commonFamily.length === 1 ? familyHref(commonFamily[0]) : '#/cryptanalysis';
  const resultFamily = familyCatalogs.flatMap(catalog => catalog.families).find(family => family.points.some(point => point.result_id === id));
  const exclusion = familyCatalogs.flatMap(catalog => catalog.excluded_results).find(point => point.result_id === id);
  return <article className="a-page a-detail" aria-labelledby="a-detail-heading">
    <div className="a-detail-topbar"><a className="a-back-link" href={backHref}><ArrowLeft size={15} aria-hidden="true" /> {current ? `${variantName(current)} results` : commonFamily.length === 1 ? `${ciphers.find(cipher => cipher.id === commonFamily[0])?.name ?? commonFamily[0]} results` : 'Cipher directory'}</a><span>Reviewed <time dateTime={record.assessment.reviewed_on}>{record.assessment.reviewed_on}</time></span></div>
    <header className="a-detail-heading"><div className="a-target-tags"><span>{surfaceLabels[record.setting.attack_surface]}</span><span><Formula expression={roundLabel(record)} /> rounds · {roundScopeLabel(record).toLowerCase()} round</span><span>{goalLabels[record.goal]}</span><SharedBadge record={record} /></div><h1 id="a-detail-heading" tabIndex={-1}><ResultTitle title={record.title} recordId={record.id} /></h1><p><Formula expression={record.target.description} /></p><div className="a-detail-badges"><ClaimBadge record={record} /><span className="a-badge"><Check size={12} aria-hidden="true" /> {record.assessment.primary_text === 'checked' ? 'Primary text checked' : 'Source review: ' + humanize(record.compact_review?.scope || 'not_recorded')}</span></div></header>
    {exclusion && <div className="a-notice"><p>Historical record · excluded from the active collection. {exclusion.reason}</p></div>}
    {invalidContext && <div className="a-notice a-notice-warning"><TriangleAlert size={17} aria-hidden="true" /><p>The requested instance does not apply to this result. Choose an applicable instance below.</p></div>}
    <section className="a-instance-context"><h2>Applicable instances</h2><InstanceNavigation variants={applicable} activeId={current?.id} current="true" label="Applicable instances"
      href={variant => resultHref(record.id, withVariantContext(current?.id === variant.id ? contextParams : switchInstanceParams(pageParams), variant.id))} /><div className="a-link-row">{applicable.map((variant) => <a key={variant.id} href={instanceHref(variant.family, variant.id, current?.id === variant.id ? contextParams : switchInstanceParams(pageParams))}>{variantName(variant)} results <ArrowRight size={13} aria-hidden="true" /></a>)}</div></section>
    {selection && <SelectionNotice selection={selection} name={variantName(current!)} />}
    {resultFamily && <section className="a-detail-section a-result-group-details"><div className="a-section-heading"><h2>{resultFamily.display_name ?? resultGroupTitle(resultFamily.title)}</h2><span>{countLabel(resultFamily.points.length, 'result')}</span></div>
      <p className="a-small a-current-parameters">Parameters: <Formula expression={Object.entries(resultFamily.points.find(point => point.result_id === id)!.values).map(([name, value]) => `${name} = ${value}`).join('; ')} /></p>
      <FamilyModel family={resultFamily} sources={sources} variantId={current?.id} />
      <div className="a-link-row">{applicable.map(variant => <a key={variant.id} href={instanceHref(variant.family, variant.id, withSelectedResults(new URLSearchParams({ q: resultFamily.id }), current?.id === variant.id ? selected : []))}>View complexity model in {variantName(variant)} <ArrowRight size={13} aria-hidden="true" /></a>)}</div>
    </section>}

    {record.field_conflicts && <section className="a-detail-section a-field-conflicts"><h2>Documented source discrepancies</h2>{record.field_conflicts.map((field, index) => <div key={`${record.id}:${field.field}:${index}`}><h3><MathText text={field.label} /></h3><p><Formula expression={field.description} /></p><ul className="a-prose-list">{field.observations.map((observation, index) => <li key={index}><a href={sourceHref(observation.source_id, current?.id)}>{observation.source_id}</a> · <MathText text={observation.locator} /><p><Formula expression={observation.reported} /></p></li>)}</ul></div>)}</section>}
    {isCostResult(record) && <section className="a-detail-section" aria-labelledby="a-resources-heading"><div className="a-section-heading"><h2 id="a-resources-heading">Reported resources</h2></div><div className="a-resource-grid">{resourceEntries(record).map(({ key, label, resource }) => <div className="a-resource-card" key={key}><h3>{label}</h3><ResourceValue resource={resource} expanded /></div>)}<div className="a-resource-card a-success-card"><h3>Success probability</h3><SuccessValue record={record} expanded /></div></div></section>}
    {record.bound && <section className="a-detail-section a-bound-section"><h2>Structural bound</h2><BoundValue record={record} /></section>}
    {record.property && <section className="a-detail-section a-property-section"><h2>Structural property</h2><PropertyValue record={record} expanded /></section>}
    {record.theorem && <section className="a-detail-section a-theorem-section"><h2>Theoretical bound</h2><TheoremValue record={record} expanded /></section>}
    {record.experiment && <section className="a-detail-section a-experiment-section"><h2>Target experiment</h2><ExperimentDefinition record={record} /></section>}
    {record.candidate_space && <section className="a-detail-section a-candidate-section"><h2>Remaining key candidates</h2><CandidateSpaceValue record={record} expanded /></section>}
    <div className="a-detail-columns"><div>
      <section className="a-detail-section"><h2>{isCostResult(record) ? 'Attack setting' : 'Setting and scope'}</h2><Metadata items={[
        { label: 'Result name', value: <Formula expression={record.display.name} /> },
        { label: 'Original target instances', value: record.target.variant_ids.map((variantId) => { const variant = variants.find((entry) => entry.id === variantId); return variant ? variantName(variant) : variantId; }).join(', ') },
        { label: 'Result kind', value: humanize(record.result_kind) }, { label: 'Goal', value: goalLabels[record.goal] }, { label: 'Round convention', value: <Formula expression={record.target.round_convention} /> },
        { label: 'Key model', value: keyModelLabels[record.setting.key_model] }, { label: 'Oracle access', value: <ul className="a-compact-list">{record.setting.oracle_access.map((access) => <li key={access}>{humanize(access)}</li>)}</ul> },
        { label: 'Key relation', value: <Formula expression={record.setting.key_relation || 'Not specified'} /> }, { label: 'Key population', value: <Formula expression={record.setting.key_population} /> }, { label: 'Plaintext / input model', value: <Formula expression={record.setting.plaintext_model} /> },
        ...(record.setting.prior_key_knowledge ? [{ label: 'Prior key knowledge', value: <p>{record.setting.prior_key_knowledge.bits} known key bits · <Formula expression={record.setting.prior_key_knowledge.material} /><br /><Formula expression={record.setting.prior_key_knowledge.cost_accounting} /></p> }] : []),
        { label: 'Related-key count', value: record.setting.related_key_count === null ? 'Not specified as a numerical count' : record.setting.related_key_count.toLocaleString('en-US') },
        { label: 'Target selection', value: record.setting.target_selection ? humanize(record.setting.target_selection) : 'Not separately specified' },
        ...(record.setting.key_budget ? [{ label: 'Key budget', value: <div className="a-budget"><span className="a-expression"><Formula expression={record.setting.key_budget.reported} /></span><span className="a-unit">{record.setting.key_budget.unit}</span><p><Formula expression={record.setting.key_budget.note} /></p>{record.setting.key_budget.distinct_key_count !== null && <span className="a-small">Distinct keys: {record.setting.key_budget.distinct_key_count.toLocaleString('en-US')}</span>}</div> }] : []),
        ...(record.setting.reference_model ? [{ label: 'Reference model', value: <Formula expression={record.setting.reference_model} /> }] : []), { label: 'Computation', value: humanize(record.setting.computation) },
        { label: 'Attack surface', value: surfaceLabels[record.setting.attack_surface] },
        ...Object.entries(record.setting.quantum_model || {}).map(([key, value]) => ({ label: `Quantum: ${humanize(key)}`, value: <Formula expression={modelValue(value)} /> })),
        ...Object.entries(record.setting.fault_model || {}).map(([key, value]) => ({ label: `Fault: ${humanize(key)}`, value: <Formula expression={modelValue(value)} /> })),
      ]} /><h3>Assumptions</h3><Conditions items={record.setting.assumptions} /></section>
      {!isCostResult(record) && <section className="a-detail-section"><h2>Success and target semantics</h2><SuccessValue record={record} expanded /></section>}
      <section className="a-detail-section"><h2>Source evidence</h2><details className="a-disclosure a-verification-details"><summary>Review and verification</summary><VerificationDetails record={record} /></details>{record.evidence.map((evidence, index) => <SourceEvidence key={`${evidence.source_id}-${index}`} source={sourceById.get(evidence.source_id)} evidence={evidence} variantId={current?.id} />)}</section>
    </div><aside className="a-detail-aside">
      <section className="a-detail-section"><h2>Techniques</h2><div className="a-tag-list">{record.techniques.map((technique) => current ? <a key={technique} href={instanceHref(current.family, current.id, updateResultFilter(contextParams, 'technique', technique))}>{humanize(technique)}</a> : <span key={technique}>{humanize(technique)}</span>)}</div></section>
      {readerNotes(record.limitations).length > 0 && <section className="a-detail-section"><details className="a-disclosure a-scope-notes"><summary>Conditions and scope</summary><Conditions items={record.limitations} /></details></section>}
      {record.related_problem_ids.length > 0 && <section className="a-detail-section"><h2>Related open questions</h2><div className="a-related-list">{record.related_problem_ids.map((problemId) => { const plainId = problemId.replace(/^cryptofrontieratlas:/, ''); return <a key={problemId} href={`#/questions/${encodeURIComponent(plainId)}`}><span>{problemById.get(plainId)?.title || humanize(plainId)}</span><ArrowRight size={15} aria-hidden="true" /></a>; })}</div></section>}
      <section className="a-detail-section"><h2>Compare this result</h2>{!isCostResult(record) ? <p className="a-small">Cost comparison is available for attacks and distinguishers.</p> : !current ? <p className="a-small">Choose an applicable instance above to start a comparison.</p> : <>{selectionFull && <p className="a-small">4/4 selected</p>}<a className="a-button" href={comparisonHref(current.id, comparisonIds, contextParams)}><Columns3 size={15} aria-hidden="true" /> {selectionFull ? 'Edit selected comparison' : comparisonIds.length > 1 ? 'Open comparison' : 'Choose another record'}</a></>}</section>
      <details className="a-detail-section a-disclosure"><summary>Record</summary><code className="a-record-id">{record.id}</code><p className="a-small">Schema {record.schema_version}</p></details>
    </aside></div>
  </article>;
}

type ComparisonRow = { label: string; value: (record: AnalysisResult, context?: URLSearchParams) => ReactNode; key: (record: AnalysisResult) => unknown };
const mathContent = (value: ReactNode) => typeof value === 'string' ? <Formula expression={value} /> : value;
const comparisonRows: ComparisonRow[] = [
  { label: 'Original target instances', key: (r) => r.target.variant_ids, value: (r) => r.target.variant_ids.map((id) => { const variant = variants.find((entry) => entry.id === id); return variant ? variantName(variant) : id; }).join(' / ') },
  { label: 'Rounds', key: (r) => [r.target.rounds, r.target.full_round, r.target.round_domain], value: (r) => `${roundLabel(r)} · ${roundScopeLabel(r).toLowerCase()} round` },
  { label: 'Target experiment', key: (r) => r.experiment, value: (r) => r.experiment ? <ExperimentDefinition record={r} /> : 'Not applicable' },
  { label: 'Goal', key: (r) => [r.goal, recoveryScopeLabel(r)], value: (r) => [goalLabels[r.goal], recoveryScopeLabel(r)].filter(Boolean).join(' · ') }, { label: 'Result kind', key: (r) => r.result_kind, value: (r) => humanize(r.result_kind) },
  { label: 'Round convention', key: (r) => r.target.round_convention, value: (r) => r.target.round_convention }, { label: 'Target scope', key: (r) => r.target.description, value: (r) => r.target.description },
  { label: 'Key model', key: (r) => r.setting.key_model, value: (r) => keyModelLabels[r.setting.key_model] }, { label: 'Oracle access', key: (r) => r.setting.oracle_access, value: (r) => r.setting.oracle_access.map(humanize).join('; ') },
  { label: 'Key relation', key: (r) => r.setting.key_relation, value: (r) => r.setting.key_relation || 'Not specified' }, { label: 'Key population', key: (r) => r.setting.key_population, value: (r) => r.setting.key_population },
  { label: 'Input model', key: (r) => r.setting.plaintext_model, value: (r) => r.setting.plaintext_model }, { label: 'Target selection', key: (r) => r.setting.target_selection, value: (r) => r.setting.target_selection ? humanize(r.setting.target_selection) : 'Not separately specified' },
  { label: 'Related-key count', key: (r) => r.setting.related_key_count, value: (r) => r.setting.related_key_count === null ? 'Not numerically specified' : r.setting.related_key_count.toLocaleString('en-US') },
  { label: 'Key budget', key: (r) => r.setting.key_budget, value: (r) => r.setting.key_budget ? <div className="a-budget"><span className="a-expression"><Formula expression={r.setting.key_budget.reported} /></span><span className="a-unit">{r.setting.key_budget.unit}</span><p><Formula expression={r.setting.key_budget.note} /></p></div> : 'Not separately specified' },
  { label: 'Reference model', key: (r) => r.setting.reference_model, value: (r) => r.setting.reference_model || 'Not separately specified' }, { label: 'Computation', key: (r) => r.setting.computation, value: (r) => humanize(r.setting.computation) },
  { label: 'Attack surface', key: (r) => r.setting.attack_surface, value: (r) => surfaceLabels[r.setting.attack_surface] },
  ...(['quantum_model', 'fault_model'] as const).map((model): ComparisonRow => ({ label: humanize(model), key: (r) => r.setting[model], value: (r) => r.setting[model] ? <Metadata items={Object.entries(r.setting[model]!).map(([key, value]) => ({ label: humanize(key), value: <Formula expression={modelValue(value)} /> }))} /> : 'Not applicable' })),
  { label: 'Assumptions', key: (r) => r.setting.assumptions, value: (r) => <Conditions items={r.setting.assumptions} /> },
  ...dimensions.map((dimension): ComparisonRow => ({ label: resourceLabels[dimension], key: (r) => r.resources[dimension], value: (r) => r.resources[dimension] ? <ResourceValue resource={r.resources[dimension]!} expanded /> : 'Not applicable' })),
  { label: 'Success probability', key: (r) => [r.success, successConflicts(r)], value: (r) => <SuccessValue record={r} expanded /> }, { label: 'Techniques', key: (r) => r.techniques, value: (r) => r.techniques.map(humanize).join(' · ') },
  { label: 'Remaining key candidates', key: (r) => r.candidate_space, value: (r) => <CandidateSpaceValue record={r} expanded /> },
  { label: 'Prior key knowledge', key: (r) => r.setting.prior_key_knowledge, value: (r) => r.setting.prior_key_knowledge ? <p>{r.setting.prior_key_knowledge.bits} known key bits · <Formula expression={r.setting.prior_key_knowledge.material} /><br /><Formula expression={r.setting.prior_key_knowledge.cost_accounting} /></p> : 'Not separately specified' },
  { label: 'Setting discrepancies', key: (r) => r.field_conflicts, value: (r) => r.field_conflicts ? <ul>{r.field_conflicts.map((field, index) => <li key={`${r.id}:${field.field}:${index}`}><MathText text={field.label} />: <Formula expression={field.description} /></li>)}</ul> : 'None recorded' },
  { label: 'Evidence state', key: (r) => r.assessment, value: (r) => <><ResultAssessment record={r} /><VerificationDetails record={r} /><p className="a-small">Reviewed {r.assessment.reviewed_on}</p></> },
  { label: 'Sources', key: (r) => r.evidence, value: (r, context) => <ul className="a-compact-list">{r.evidence.map((entry, index) => <li key={`${entry.source_id}-${index}`}><a href={sourceHref(entry.source_id, context?.get('variant') || undefined)}><MathText text={sourceById.get(entry.source_id)?.title || entry.source_id} /></a><p className="a-small"><Formula expression={entry.locator} /></p></li>)}</ul> },
  { label: 'Conditions and scope', key: (r) => r.limitations, value: (r) => <Conditions items={r.limitations} /> },
];

function comparisonRelation(relation: ReturnType<typeof compareReportedCosts>['relation']): string {
  switch (relation) {
    case 'equal': return 'Equal reported cost vectors';
    case 'a_dominates_reported_costs': return 'First record has no higher reported cost in each checked dimension';
    case 'b_dominates_reported_costs': return 'Second record has no higher reported cost in each checked dimension';
    case 'tradeoff': return 'Reported costs show a tradeoff';
    default: return 'Incomparable costs';
  }
}

function ComparisonOptions({ rows }: { rows: AttackRow[] }) {
  return <>{attackSurfaces.map(surface => {
    const scoped = rows.filter(row => row.view.records[0].setting.attack_surface === surface);
    return scoped.length > 0 ? <optgroup key={surface} label={surfaceLabels[surface]}>
      {scoped.map(row => <option value={row.id} key={row.id}>{row.formula ? complexityTitle(row.view) : row.view.records[0].title}</option>)}
    </optgroup> : null;
  })}</>;
}

/** A common field is displayed once; tuning-dependent values retain their point labels. */
function ModelComparisonField({ row, view, context }: { row: ComparisonRow; view: ResultFamilyView; context: URLSearchParams }) {
  const values = new Map<string, AnalysisResult[]>();
  for (const record of view.records) {
    const key = JSON.stringify(row.key(record));
    values.set(key, [...(values.get(key) ?? []), record]);
  }
  if (values.size === 1) return <>{mathContent(row.value(view.records[0], context))}</>;
  return <details className="a-parameter-values" open={row.label === 'Setting discrepancies' || undefined}><summary>Parameter-specific values · {values.size}</summary>
    {[...values.values()].map((records, index) => <div key={index}><p className="a-small"><Formula expression={records.map(record => parameterChoice(view, record)).join(' / ')} /></p>{mathContent(row.value(records[0], context))}</div>)}
  </details>;
}

function ModelComparePage({ variant, selection, searchParams, onParamsChange }: SearchProps & { variant: CipherVariant; selection: ComparisonSelection }) {
  const selected = selection.ids;
  const views = selected.map(id => comparisonView(id, registryResults, familyCatalogs)!);
  const context = withVariantContext(withSelectedResults(resultPageParams(searchParams), selected), variant.id);
  context.set('compare', 'models');
  const available = attackRows(resultFamilyViews(resultsForVariant(browseResults, variant.id).filter(isCostResult), familyCatalogs))
    .filter(row => !selected.includes(row.id));
  const select = (ids: string[]) => onParamsChange(withSelectedResults(context, ids), true);
  const modelRows: { label: string; value: (view: ResultFamilyView) => ReactNode; key: (view: ResultFamilyView) => unknown }[] = [
    { label: 'Parameters and domain', key: view => view.family?.parameters, value: view => <ModelDomain view={view} /> },
    ...dimensions.map(dimension => ({ label: resourceLabels[dimension], key: (view: ResultFamilyView) => view.family?.model?.resources[dimension] ?? view.records.map(record => record.resources[dimension]), value: (view: ResultFamilyView) => <ModelResource view={view} dimension={dimension} expanded /> })),
    { label: 'Success probability', key: view => [view.family?.model?.success, view.records.map(record => [record.success, successConflicts(record)])], value: view => <ModelSuccess view={view} /> },
    { label: 'Conditions and accounting', key: view => view.family?.model, value: view => <ModelConditions view={view} /> },
    { label: 'Formula and table sources', key: view => view.family?.evidence, value: view => view.family ? <ul className="a-compact-list">{view.family.evidence.map((evidence, index) => <li key={index}><a href={sourceHref(evidence.source_id, variant.id)}><MathText text={sourceById.get(evidence.source_id)?.title ?? evidence.source_id} /></a><p><MathText text={evidence.locator} /></p></li>)}</ul> : <span className="a-small">See result sources below</span> },
    ...comparisonRows.filter(row => !dimensions.some(dimension => resourceLabels[dimension] === row.label) && row.label !== 'Success probability').map(row => ({ label: row.label, key: (view: ResultFamilyView) => view.records.map(record => row.key(record)), value: (view: ResultFamilyView) => <ModelComparisonField row={row} view={view} context={context} /> })),
  ];
  const pairs = views.flatMap((a, index) => views.slice(index + 1).map(b => ({ a, b })));
  return <section className="a-page a-compare a-model-compare" aria-labelledby="a-compare-heading">
    <a className="a-back-link" href={instanceHref(variant.family, variant.id, context)}><ArrowLeft size={15} aria-hidden="true" /> {variantName(variant)} results</a>
    <header className="a-page-heading"><div><h1 id="a-compare-heading" tabIndex={-1}>Compare {variantName(variant)} results</h1><p>Parameters are local to each column.</p></div><a className="a-button a-button-subtle" href="#/cryptanalysis/compare">Change instance</a></header>
    <SelectionNotice selection={selection} name={variantName(variant)} />
    <div className="a-comparison-picker"><label className="a-filter"><span>Add a result ({views.length}/{MAX_COMPARISON_RECORDS})</span><select value="" disabled={views.length >= MAX_COMPARISON_RECORDS} onChange={event => { if (event.target.value) select([...selected, event.target.value]); }}><option value="">Choose a result…</option><ComparisonOptions rows={available} /></select></label><a className="a-text-link" href={instanceHref(variant.family, variant.id, context)}>Select with filters <ArrowRight size={14} /></a></div>
    {views.length < 2 && <div className="a-empty a-compact-empty"><h2>{views.length ? 'Choose one more construction' : 'Choose two to four constructions'}</h2></div>}
    {pairs.length > 0 && <section className="a-comparability"><h2>Comparison scope</h2><div className="a-pair-list">{pairs.map(({ a, b }) => {
      const parameterized = Boolean(a.family || b.family);
      const differentSurface = a.records[0].setting.attack_surface !== b.records[0].setting.attack_surface;
      const check = parameterized ? null : comparability(a.records[0], b.records[0]);
      const relation = differentSurface ? 'Different attack surfaces' : parameterized ? 'Parameterized costs' : comparisonRelation(compareReportedCosts(a.records[0], b.records[0]).relation);
      return <details className="a-pair" key={`${modelSelectionId(a)}-${modelSelectionId(b)}`}><summary><strong>{relation}</strong><span>{a.records[0].target.rounds}R ↔ {b.records[0].target.rounds}R</span></summary><div className="a-pair-body"><p>{complexityTitle(a)} compared with {complexityTitle(b)}</p>{differentSurface ? <p>Cost ranking requires the same attack surface.</p> : parameterized ? <p>Choose reported points in the column headers for a numerical cost comparison.</p> : <ul>{check!.reasons.map(reason => <li key={reason}>{humanize(reason)}</li>)}</ul>}</div></details>;
    })}</div></section>}
    <div className="a-table-wrap a-comparison-wrap" tabIndex={0} aria-label="Side-by-side formula comparison; scroll horizontally to view all constructions"><table className="a-comparison-table a-model-comparison-table" style={{ minWidth: 155 + views.length * 330 }}>
      <caption className="sr-only">Complexity formulas, parameter domains and source-native conditions for selected constructions.</caption>
      <thead><tr><th scope="col">Field</th>{views.map((view, index) => {
        const family = view.family ?? familyCatalogs.flatMap(catalog => catalog.families).find(family => family.points.some(point => point.result_id === view.records[0].id));
        const conflict = view.records.some(record => record.assessment.claim_status === 'source_conflict');
        return <th scope="col" key={selected[index]} data-comparison-id={selected[index]}><span><ResultTitle title={complexityTitle(view)} recordId={view.records[0].id} /></span>{conflict && <span className="a-badge a-badge-warning">Source conflict</span>}
          <p className="a-comparison-setting">{view.records[0].target.rounds} rounds · {goalLabels[view.records[0].goal]} · {keyModelLabels[view.records[0].setting.key_model]} · {computationLabels[view.records[0].setting.computation]} · {surfaceLabels[view.records[0].setting.attack_surface]} · {methodLabels[view.records[0].display.method]}</p>
          {modelPriorKnowledge(view) && <p className="a-model-prior-knowledge">{modelPriorKnowledge(view)}</p>}
          {family && <label className="a-filter a-comparison-parameter"><span>Parameter choice</span><select aria-label={`Parameter choice for ${complexityTitle(view)}`} value={selected[index]} onChange={event => select(selected.map((id, position) => position === index ? event.target.value : id))}>
            <option value={'model:' + family.id} disabled={selected.includes('model:' + family.id) && selected[index] !== 'model:' + family.id}>{family.model ? 'Full formula' : 'All reported cases'}</option>
            {family.points.map(point => <option key={point.result_id} value={point.result_id} disabled={selected.includes(point.result_id) && selected[index] !== point.result_id}>{Object.entries(point.values).map(([key, value]) => `${key}=${value}`).join('; ')}</option>)}
          </select></label>}
          {!view.family && <a className="a-text-link" href={resultHref(view.records[0].id, context)}>Result details</a>}
          <button className="a-text-button" aria-label={`Remove ${complexityTitle(view)} from comparison`} onClick={() => select(selected.filter((_, position) => position !== index))}>Remove <X size={12} aria-hidden="true" /></button>
        </th>;
      })}</tr></thead>
      <tbody>{modelRows.map(row => {
        const differs = new Set(views.map(view => JSON.stringify(row.key(view)))).size > 1;
        return <tr key={row.label} className={differs ? 'a-diff-row' : undefined}><th scope="row">{row.label}{differs && <span className="a-diff-label">Different</span>}</th>{views.map((view, index) => <td key={selected[index]}>{row.value(view)}</td>)}</tr>;
      })}</tbody>
    </table></div>
  </section>;
}

export function ComparePage({ variantId, searchParams, onParamsChange }: SearchProps & { variantId?: string }) {
  if (!analysisEnabled) return <AnalysisUnavailable />;
  if (!variantId) return <section className="a-page a-comparison-instance-picker"><a className="a-back-link" href="#/cryptanalysis"><ArrowLeft size={15} aria-hidden="true" /> Cipher directory</a><h1 tabIndex={-1}>Choose an instance to compare</h1><InstanceNavigation variants={variants} label="Comparison instances" className="a-instance-choices"
    href={variant => comparisonHref(variant.id, [], switchInstanceParams(resultPageParams(searchParams)))} /></section>;
  const variant = variants.find((entry) => entry.id === variantId);
  if (!variant || !resolveInstance(variant.family, variant.id, ciphers, variants)) return <InvalidInstance />;
  const selection = comparisonSelection(searchParams, registryResults, variant.id, familyCatalogs);
  if (selection.ids.some(id => id.startsWith('model:')) || searchParams.get('compare') === 'models') return <ModelComparePage variant={variant} selection={selection} searchParams={searchParams} onParamsChange={onParamsChange} />;
  const selected = selection.ids;
  const records = selected.map((id) => registryResults.find((record) => record.id === id)!);
  const available = attackRows(resultFamilyViews(resultsForVariant(browseResults, variant.id).filter(isCostResult), familyCatalogs)).filter(row => !selected.includes(row.id));
  const contextParams = withVariantContext(withSelectedResults(resultPageParams(searchParams), selected), variant.id);
  const pairs = records.flatMap((a, i) => records.slice(i + 1).map((b) => ({ a, b, check: comparability(a, b), comparison: compareReportedCosts(a, b) })));
  const select = (ids: string[]) => onParamsChange(withSelectedResults(contextParams, ids), true);
  return <section className="a-page a-compare" aria-labelledby="a-compare-heading">
    <a className="a-back-link" href={instanceHref(variant.family, variant.id, contextParams)}><ArrowLeft size={15} aria-hidden="true" /> {variantName(variant)} results</a>
    <header className="a-page-heading"><div><h1 id="a-compare-heading" tabIndex={-1}>Compare {variantName(variant)} results</h1></div><a className="a-button a-button-subtle" href="#/cryptanalysis/compare">Change instance</a></header>
    <SelectionNotice selection={selection} name={variantName(variant)} />
    <div className="a-comparison-picker"><label className="a-filter"><span>Add a record ({records.length}/{MAX_COMPARISON_RECORDS})</span><select value="" disabled={records.length >= MAX_COMPARISON_RECORDS} onChange={(event) => { if (event.target.value) select([...selected, event.target.value]); }}><option value="">{records.length >= MAX_COMPARISON_RECORDS ? 'Remove a record before adding another' : `Choose a ${variantName(variant)} result…`}</option><ComparisonOptions rows={available} /></select></label><a className="a-text-link" href={instanceHref(variant.family, variant.id, contextParams)}>Select with filters <ArrowRight size={14} aria-hidden="true" /></a></div>
    {records.length > 0 && <div className="a-selected-chips">{records.map((record) => <button key={record.id} onClick={() => select(selected.filter((id) => id !== record.id))} aria-label={`Remove ${record.title} from comparison`}><span><ResultTitle title={record.title} recordId={record.id} /></span><X size={13} aria-hidden="true" /></button>)}</div>}
    {records.length < 2 && <div className="a-empty a-compact-empty"><Columns3 size={27} aria-hidden="true" /><h2>{records.length ? 'Choose one more result' : 'Choose two to four results'}</h2></div>}
    {records.length >= 2 && <>
      <section className="a-comparability" aria-labelledby="a-comparability-heading"><div className="a-section-heading"><h2 id="a-comparability-heading">Pairwise cost compatibility</h2><span>{pairs.filter((pair) => pair.check.comparable).length} of {pairs.length} pairs pass all checks</span></div><div className="a-pair-list">{pairs.map(({ a, b, check, comparison }, index) => <details className={`a-pair${check.comparable ? ' a-pair-compatible' : ''}`} open={index === 0} key={`${a.id}-${b.id}`}><summary><span>{check.comparable ? <Check size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}<strong>{comparisonRelation(comparison.relation)}</strong><span>{a.target.rounds}R ↔ {b.target.rounds}R</span></span><span>{check.reasons.length ? `${check.reasons.length} reasons` : 'Compatible'}</span></summary><div className="a-pair-body"><p><a href={resultHref(a.id, contextParams)}>{a.title}</a><span> compared with </span><a href={resultHref(b.id, contextParams)}>{b.title}</a></p>{check.reasons.length > 0 && <ul>{check.reasons.map((reason) => <li key={reason}>{humanize(reason)}</li>)}</ul>}</div></details>)}</div></section>

      <div className="a-table-wrap a-comparison-wrap" tabIndex={0} aria-label="Side-by-side comparison; scroll horizontally to view all selected records"><table className="a-comparison-table"><caption className="sr-only">Selected {variantName(variant)} results: costs, settings and evidence.</caption><thead><tr><th scope="col">Field</th>{records.map((record) => <th scope="col" key={record.id}><a href={resultHref(record.id, contextParams)}><ResultTitle title={record.title} recordId={record.id} /></a><SharedBadge record={record} /><button className="a-text-button" onClick={() => select(selected.filter((id) => id !== record.id))} aria-label={`Remove ${record.title} from comparison`}>Remove <X size={12} aria-hidden="true" /></button></th>)}</tr></thead><tbody>{comparisonRows.map((row) => { const differs = new Set(records.map((record) => JSON.stringify(row.key(record)))).size > 1; return <tr className={differs ? 'a-diff-row' : undefined} key={row.label}><th scope="row">{row.label}{differs && <span className="a-diff-label">Different</span>}</th>{records.map((record) => <td key={record.id}>{mathContent(row.value(record, contextParams))}</td>)}</tr>; })}</tbody></table></div>
    </>}
  </section>;
}

import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react';
import { MathText } from '../../components/MathText';
import { matchesSearch, routeHref } from '../../app/atlas/model';
import { useLocale } from '../../app/locale';
import { goalLabels, sectionFor } from '../../../lib/cryptanalysis/problem-results.cjs';
import { problemAnalyses, sources } from './data';
import { ResourceValue } from './ResourceValue';
import { CitationLabel } from './CitationLabel';
import { sourcesForResult, sourceHref } from './model';
import type { ProblemAnalysis, ProblemResource, ProblemResult } from './problem-types';
import './problem-analysis.css';

export const problemResultHref = (record: ProblemResult) => routeHref(`/asymmetric-cryptanalysis/problems/${record.target.problem_id}/results/${record.id}`);
const costLabels: Record<ProblemResource, string> = {time: 'Time / Work', memory: 'Memory', classical_time: 'Classical Work', quantum_calls: 'Quantum Calls', gates_per_call: 'Gates per Call', logical_qubits: 'Logical Qubits', oracle_calls: 'Subroutine / Oracle Calls', wall_time: 'Elapsed Time', energy: 'Energy'};
const inputLabels = {general_integer: 'General Integers', composite_integer: 'Composite Integers', balanced_semiprime: 'Balanced Semiprimes', special_integer: 'Distinct Prime Exponents', almost_all_integers: 'Almost-All Inputs', named_challenge: 'Named Challenge'};
const basisLabels = {proved: 'Theorem', conditional: 'Conditional', heuristic: 'Heuristic', experiment: 'Reported Computation'};

function ModelTags({record}: {record: ProblemResult}) {
  return <div className="hp-tags">
    <span className={'hp-tag hp-tag-' + record.setting.basis}>{basisLabels[record.setting.basis]}</span>
    {record.result_kind === 'supporting_result' && <span className="hp-tag hp-tag-supporting">Supporting Result</span>}
    {record.setting.model === 'oracle_assisted' && <span className="hp-tag hp-tag-conditional">Oracle-Assisted</span>}
    {record.setting.memory_model && <span className="hp-tag hp-tag-quantum">{{qram: 'qRAM', qraqm: 'QRAQM', no_qram: 'No qRAM'}[record.setting.memory_model]}</span>}
    {record.assessment.claim_status === 'source_conflict' && <span className="hp-tag hp-tag-conflict">Source Conflict</span>}
  </div>;
}
function Probability({record, detailed = false}: {record: ProblemResult; detailed?: boolean}) {
  const s = record.success;
  return <div className="hp-success" data-success-event={s.metric}>
    {s.status === 'reported' ? <MathText text={s.expression ?? `$${s.relation ?? '='}${s.value}$`} />
      : <span>{s.review?.status === 'pending' ? 'Unresolved' : s.status === 'not_applicable' ? 'Not Applicable' : 'Not Quantified'}</span>}
    {detailed && <><p><MathText text={s.description} /></p><p className="atlas-subtle">{s.review?.scope}</p>
      {s.components?.map(component => <p key={component.metric}><strong>{component.metric}</strong>: <MathText text={component.expression ?? String(component.value ?? 'Not Quantified')} /> — <MathText text={component.description} /></p>)}</>}
  </div>;
}

export function ProblemAnalysisSection({catalog}: {catalog: ProblemAnalysis}) {
  const {locale} = useLocale();
  const [query, setQuery] = useState(''), [goal, setGoal] = useState('');
  const filtered = catalog.results.filter(r => (!goal || r.goal === goal) && matchesSearch([r.id, r.title, r.statement, r.method,
    r.target.description, inputLabels[r.target.input_class], goalLabels[r.goal],
    ...sourcesForResult(r, sources).map(s => `${s.citation_label} ${s.title} ${s.authors.join(' ')} ${s.year}`)].join(' '), query));
  const sections = [{id: 'classical', title: 'Classical Algorithms'}, {id: 'quantum', title: 'Quantum Algorithms'}, {id: 'records', title: 'Factorization Records'}] as const;
  return <section className="hp-analyses" lang="en" aria-labelledby="hp-analysis-heading">
    <div className="atlas-section-heading"><h2 id="hp-analysis-heading">{locale === 'zh' ? '分析结果' : 'Analysis Results'}</h2>
      <span className="atlas-subtle">{catalog.results.length} Results · {catalog.coverage.source_ids.length} Sources</span></div>
    <div className="atlas-source-toolbar hp-toolbar">
      <label className="atlas-small-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search Factorization Results</span>
        <input type="search" placeholder="Algorithm, paper, input class…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="hp-goal-filter">Goal<select value={goal} onChange={e => setGoal(e.target.value)}><option value="">All Goals</option>
        {Object.entries(goalLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    {(query || goal) && <p role="status" className="atlas-subtle">{filtered.length} Matching Results <button className="a-text-button" onClick={() => {setQuery(''); setGoal('');}}>Clear Filters</button></p>}
    {sections.map(section => {
      const rows = filtered.filter(r => sectionFor(r) === section.id).sort((a, b) =>
        Math.max(...sourcesForResult(b, sources).map(s => s.year)) - Math.max(...sourcesForResult(a, sources).map(s => s.year)) || a.title.localeCompare(b.title));
      return rows.length > 0 && <section className="hp-section" data-problem-section={section.id} key={section.id} aria-labelledby={'hp-' + section.id}>
        <h3 id={'hp-' + section.id}>{section.title} <span>{rows.length}</span></h3>
        <div className="hp-table-scroll" role="region" aria-label={section.title} tabIndex={0}><table className="hp-table">
          <caption className="sr-only">{section.title} for Integer Factorization</caption>
          <thead><tr><th scope="col">Result</th><th scope="col">Input &amp; Goal</th><th scope="col">Reported Resources</th><th scope="col">Success</th></tr></thead>
          <tbody>{rows.map(r => {
            const costs = (Object.keys(r.resources) as ProblemResource[]).filter(key => key !== 'memory' && key !== 'logical_qubits' && key !== 'energy' && r.resources[key]!.status === 'reported');
            return <tr key={r.id} data-result-id={r.id}><th scope="row"><a className="hp-result-title" href={problemResultHref(r)}>{r.title}</a>
              <div className="hp-citations">{sourcesForResult(r, sources).map(s => <a key={s.id} href={sourceHref(s.id)}><CitationLabel label={`[${s.citation_label}]`} /></a>)}</div>
              <ModelTags record={r} /><a className="hp-details-link" href={problemResultHref(r)}>Details <ArrowUpRight size={12} aria-hidden="true" /></a></th>
              <td><span className="hp-input-label">{r.target.instance_name ?? inputLabels[r.target.input_class]}</span><span className="hp-goal">{goalLabels[r.goal]}</span></td>
              <td>{costs.length ? costs.map(key => <div className="hp-cost" key={key}><small>{costLabels[key]}</small><ResourceValue resource={r.resources[key]!} /></div>) : 'Not Reported'}</td>
              <td><Probability record={r} /></td></tr>;
          })}</tbody>
        </table></div>
      </section>;
    })}
    {!filtered.length && <p>No Matching Results</p>}
    <details className="hp-coverage"><summary>Coverage &amp; Review · {catalog.reviewed_on}</summary>
      <p>{catalog.coverage.selection}</p><p>Search cutoff: {catalog.coverage.search_cutoff} · Comparison as of: {catalog.coverage.comparison_as_of}</p>
      <ul>{catalog.coverage.not_yet_covered.map(note => <li key={note}>{note}</li>)}</ul>
      <h3>Result-Level Exclusions</h3><ul>{catalog.coverage.exclusions.map(e => <li key={e.source_id}><a href={sourceHref(e.source_id)}>{sources.find(s => s.id === e.source_id)?.citation_label}</a> · {e.locator} — {e.reason}</li>)}</ul>
    </details>
  </section>;
}

export function ProblemResultDetail({problemId, id}: {problemId: string; id: string}) {
  const catalog = problemAnalyses.find(c => c.problem_id === problemId);
  const record = catalog?.results.find(r => r.id === id);
  const back = routeHref('/asymmetric-cryptanalysis/problems/' + problemId);
  if (!record) return <section className="atlas-page"><h1 tabIndex={-1}>Record Not Found</h1><a href={back}>Back to Problem</a></section>;
  const family = catalog!.families.find(f => f.points.some(p => p.result_id === id));
  return <section className="atlas-page hp-detail" lang="en">
    <a className="atlas-text-link" href={back}><ArrowLeft size={15} aria-hidden="true" />Integer Factorization</a>
    <div className="atlas-page-heading"><h1 tabIndex={-1}>{record.title}</h1></div>
    <ModelTags record={record} /><p className="hp-statement"><MathText text={record.statement} /></p>
    <section><h2>Target &amp; Model</h2><dl className="atlas-metadata">
      <div><dt>Goal</dt><dd>{goalLabels[record.goal]}</dd></div><div><dt>Input</dt><dd><MathText text={record.target.description} /></dd></div>
      <div><dt>Computation</dt><dd>{record.setting.computation === 'quantum' ? 'Quantum · Public Integer Input' : 'Classical · Public Integer Input'}</dd></div>
      <div><dt>Method</dt><dd>{record.method.replaceAll('-', ' ')}</dd></div>
    </dl>
      {record.setting.assumptions.length > 0 && <><h3>Assumptions</h3><ul>{record.setting.assumptions.map(note => <li key={note}><MathText text={note} /></li>)}</ul></>}
      {record.setting.auxiliary_information.length > 0 && <><h3>Auxiliary Information / Oracle</h3><ul>{record.setting.auxiliary_information.map(note => <li key={note}><MathText text={note} /></li>)}</ul></>}
    </section>
    <section><h2>Parameters</h2><dl className="hp-parameters">{record.target.parameters.map(p => <div key={p.name}><dt><code>{p.name}</code> · {p.meaning}</dt><dd><MathText text={p.domain ?? 'Unspecified Domain'} /> <span className="hp-assignment">Value: <code>{p.value ?? 'Unassigned'}</code></span></dd></div>)}</dl></section>
    <section><h2>Resources</h2><div className="hp-resource-grid">{(Object.keys(record.resources) as ProblemResource[]).map(key => <article key={key}><h3>{costLabels[key]}</h3><ResourceValue resource={record.resources[key]!} expanded /></article>)}</div></section>
    <section><h2>Success</h2><Probability record={record} detailed /></section>
    {record.experiment && <section><h2>Reported Computation</h2><dl className="atlas-metadata">{(['date', 'hardware', 'software', 'parameters', 'reported_outcome'] as const).map(key => <div key={key}><dt>{({date: 'Run Date', hardware: 'Hardware', software: 'Software', parameters: 'Configuration', reported_outcome: 'Outcome'})[key]}</dt><dd>{record.experiment![key]}</dd></div>)}</dl></section>}
    {record.field_conflicts?.map(conflict => <section className="hp-conflict" key={conflict.field}><h2>{conflict.label}</h2><p>{conflict.description}</p><ul>{conflict.observations.map(o => <li key={o.locator}><MathText text={o.reported} /> — {o.locator}</li>)}</ul></section>)}
    <section><h2>Evidence</h2>{record.evidence.map((e, index) => {
      const source = sources.find(s => s.id === e.source_id)!;
      return <article className="atlas-source-card" key={index}><h3><a href={sourceHref(source.id)}><CitationLabel label={`[${source.citation_label}]`} /> {source.title}</a></h3>
        <p>{source.authors.join(' · ')}</p><p>{e.locator}</p><p>{e.interpretation}</p>
        <a className="atlas-text-link" href={source.url} target="_blank" rel="noreferrer">Inspected PDF <ArrowUpRight size={13} aria-hidden="true" /></a>
        <details><summary>Version &amp; Fingerprint</summary><p>{source.inspected_version}</p><p className="atlas-long-code"><code>{source.content_sha256}</code></p><p>Accessed: {source.accessed_on}</p><p>{source.hash_note}</p><p>Supported fields: {e.fields.join(', ')}</p></details>
      </article>;
    })}</section>
    <section><h2>Review &amp; Limitations</h2><p>Targeted Primary-Text Extraction · {record.assessment.reviewed_on}</p><p>Reproduction Not Attempted · Frontier Not Assessed</p>
      <ul>{record.limitations.map(note => <li key={note}><MathText text={note} /></li>)}</ul>
      <details><summary>Stable Identifiers</summary><p>Result: <code>{record.id}</code></p>{family && <p>Family: <code>{family.id}</code></p>}</details>
    </section>
    {record.related_result_ids.length > 0 && <section><h2>Related Results</h2><ul className="atlas-link-list">{record.related_result_ids.map(id => {
      const related = catalog!.results.find(r => r.id === id)!;
      return <li key={id}><a href={problemResultHref(related)}>{related.title}</a></li>;
    })}</ul></section>}
  </section>;
}

import { Fragment } from 'react';
import type { AnalysisResult } from './types';
import { Formula } from './Formula';
import { ResourceValue } from './ResourceValue';
import { ResourceUnit } from './ResourceUnit';
import { SuccessContext, SuccessValue, successConflicts } from './SuccessValue';
import { attackName, readerText } from './presentation';
import { Conditions } from './Conditions';
import type { ResultFamilyView } from './model';
import { humanize } from './model';
import { presentationKey } from './attack-rows';

export function ParameterName({ name }: { name: string }) {
  return /^[a-z]{3,}(?:_[a-z0-9]+)*$/.test(name) && name !== 'ell' && !/^(?:alpha|beta|gamma|delta|epsilon|lambda|sigma|theta|omega)$/.test(name)
    ? <>{humanize(name)}</> : <Formula expression={name} />;
}

export function complexityTitle(view: ResultFamilyView): string {
  return attackName(view);
}

/** A fallback record ID is an identifier, not an algebraic expression. */
export function ResultTitle({ title, recordId }: { title: string; recordId: string }) {
  return title === recordId ? <>{title}</> : <Formula expression={title} />;
}

export function parameterChoice(view: ResultFamilyView, record: AnalysisResult): string {
  const values = view.family?.points.find(point => point.result_id === record.id)?.values;
  return values ? Object.entries(values).map(([name, value]) => `${/^[a-z]{3,}(?:_[a-z0-9]+)*$/.test(name) && name !== 'ell' && name !== 'epsilon' && name !== 'lambda' ? humanize(name) : name} = ${typeof value === 'string' && /^[a-z]+(?:[-_][a-z0-9]+)+$/i.test(value) ? humanize(value) : value}`).join('; ') : record.display.name;
}

/** Short labels for reported choices; multiple varying scalars remain paired tuples. */
export function parameterSummary(view: ResultFamilyView, records: AnalysisResult[]): string {
  const points = view.family?.points;
  if (!points) return records[0].display.name;
  const assignments = records.map(record => points.find(point => point.result_id === record.id)!.values);
  const visible = view.records.map(record => points.find(point => point.result_id === record.id)!.values);
  const varying = view.family!.parameters.filter(({ name }) => new Set(visible.map(values => values[name])).size > 1);
  const scalars = varying.filter(({ name }) => assignments.every(values => typeof values[name] === 'number'
    || !/[,;]|.{49}/.test(String(values[name]))));
  let parameters = scalars.length ? scalars : varying;
  if (scalars.length) {
    const ids = new Set(records.map(record => record.id));
    const projection = (assignment: Record<string, string | number>) => presentationKey(scalars.map(parameter => assignment[parameter.name]));
    const labels = new Set(assignments.map(projection));
    // Keep a vector when omitting it would give distinct outcomes the same label.
    if (visible.some((assignment, index) => !ids.has(view.records[index].id) && labels.has(projection(assignment)))) parameters = varying;
  }
  if (!parameters.length) return parameterChoice(view, records[0]);
  const name = (value: string) => /^[a-z]{3,}(?:_[a-z0-9]+)*$/.test(value)
    && !/^(?:ell|alpha|beta|gamma|delta|epsilon|lambda|sigma|theta|omega)$/.test(value) ? humanize(value) : value;
  const value = (value: string | number) => typeof value === 'string' && /^-?\d+(?:\.\d+)?(?:,\s*-?\d+(?:\.\d+)?)+$/.test(value) ? `(${value})`
    : typeof value === 'string' && /^[a-z]+(?:[-_][a-z0-9]+)+$/i.test(value) ? humanize(value) : String(value);
  if (records.length === 1) return parameters.map(parameter => `${name(parameter.name)} = ${value(assignments[0][parameter.name])}`).join('; ');
  if (parameters.length === 1) {
    const parameter = parameters[0].name;
    const values = [...new Set(assignments.map(assignment => value(assignment[parameter])))];
    return `${name(parameter)} ${values.length === 1 ? '= ' + values[0] : 'in {' + values.join(',') + '}'}`;
  }
  const tuples = [...new Set(assignments.map(assignment => '(' + parameters.map(parameter => value(assignment[parameter.name])).join(',') + ')'))];
  return `(${parameters.map(parameter => name(parameter.name)).join(',')}) in {${tuples.join(',')}}`;
}

export function modelPriorKnowledge(view: ResultFamilyView): string | null {
  const bits = [...new Set(view.records.map(record => record.setting.prior_key_knowledge?.bits ?? null))];
  if (bits.length === 1) return bits[0] === null ? null : `Requires ${bits[0]} known key bits`;
  return 'Prior key knowledge depends on parameter choice';
}

/** Discrete costs stay associated with the same reported parameter assignment. */
export function ModelResource({ view, dimension, expanded = false, parameterLabels = false, display = false }: {
  view: ResultFamilyView; dimension: keyof AnalysisResult['resources']; expanded?: boolean; parameterLabels?: boolean; display?: boolean;
}) {
  const expression = view.family?.model?.resources[dimension];
  const conflict = view.records.some(record => record.resources[dimension]?.status === 'conflict');
  if (expression && expression.display_expression !== null) return <div className={`a-resource a-model-resource${conflict ? ' a-resource-conflict' : ''}`}>
    <span className="a-expression"><Formula expression={expression.display_expression ?? expression.expression} display={display} readable /></span><ResourceUnit unit={expression.unit} />
    {conflict && <span className="a-resource-status">Source conflict</span>}
    {expanded && expression.note && <p className="a-resource-note"><Formula expression={readerText(expression.note)} /></p>}
  </div>;
  const reported = view.records.filter(record => record.resources[dimension]);
  if (!reported.length) return <span className="a-small">Not applicable</span>;
  if (!view.family || reported.every(record => ['not_reported', 'not_applicable'].includes(record.resources[dimension]!.status)
    && record.resources[dimension]!.status === reported[0].resources[dimension]!.status)) {
    return <ResourceValue resource={reported[0].resources[dimension]!} expanded={expanded} display={display} />;
  }
  return <div className="a-discrete-costs">{reported.map(record => <div key={record.id} data-cost-point={record.id}>
    <span className="a-case-label">{parameterLabels ? <Formula expression={parameterChoice(view, record)} readable /> : `Case ${view.records.indexOf(record) + 1}`}</span><ResourceValue resource={record.resources[dimension]!} expanded={expanded} display={display} />
  </div>)}</div>;
}

export function ModelDomain({ view, compact = false }: { view: ResultFamilyView; compact?: boolean }) {
  if (!view.family) return <span className="a-small" aria-label="No formula parameters">—</span>;
  return <div className="a-model-domain">
    <dl>{view.family.parameters.map(parameter => <div key={parameter.name}><dt><ParameterName name={parameter.name} /></dt><dd><Formula expression={compact ? parameter.short_meaning ?? parameter.meaning : parameter.meaning} readable /><span className="a-parameter-domain"><Formula expression={compact ? parameter.short_domain ?? parameter.domain : readerText(parameter.domain)} readable /></span></dd></div>)}</dl>
    {!view.family.model && <ol className="a-case-domain">{view.records.map((record, index) => <li key={record.id}><span className="a-case-label">Case {index + 1}</span><Formula expression={parameterChoice(view, record)} /></li>)}</ol>}
  </div>;
}

export function ModelSuccess({ view, compact = false, display = false }: { view: ResultFamilyView; compact?: boolean; display?: boolean }) {
  const values = new Map<string, AnalysisResult[]>();
  for (const record of view.records) {
    // Components and source definitions can distinguish equal headline values
    // (for example different false-positive rates); compact copy must not erase them.
    const key = presentationKey([record.success, successConflicts(record)]);
    values.set(key, [...(values.get(key) ?? []), record]);
  }
  const sharedContext = compact && values.size > 1 && view.records.every(record =>
    record.success.metric === view.records[0].success.metric && record.success.basis === view.records[0].success.basis);
  const symbolic = view.records.some(record => record.success.status === 'reported' && record.success.value === null);
  const order = new Map(view.family?.points.map((point, index) => [point.result_id, index]));
  const cases = [...values.values()].map(records => [...records].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)))
    .sort((a, b) => (order.get(a[0].id) ?? 0) - (order.get(b[0].id) ?? 0));
  return <div className="a-model-success">{sharedContext && <div className="a-success-context"><SuccessContext record={view.records[0]} compact /></div>}<div className={`a-success-cases${compact ? ' a-success-cases-compact' : ''}${symbolic ? ' a-success-cases-symbolic' : ''}`}>{cases.map((records, index) => {
    return <div className="a-success-case" key={index} data-success-points={records.map(record => record.id).join(' ')}>{(values.size > 1 || compact && (records.length !== view.configurationCount || view.configurationCount === 1)) && <p className="a-case-label">{view.family?.model
      ? compact ? <Formula expression={parameterSummary(view, records)} readable /> : records.map((record, index) => <Fragment key={record.id}>{index > 0 && <br />}<Formula expression={parameterChoice(view, record)} readable /></Fragment>)
      : records.map(record => `Case ${view.records.indexOf(record) + 1}`).join(', ')}</p>}
      <SuccessValue record={records[0]} compact={compact} display={display} contextVisible={!sharedContext} />
    </div>;
  })}</div>{!compact && view.family?.model && <details className="a-success-definition a-success-model"><summary>Success model and assumptions</summary><p><Formula expression={view.family.model.success} /></p></details>}</div>;
}

export function ModelConditions({ view }: { view: ResultFamilyView }) {
  return view.family?.model ? <div className="a-model-accounting"><Conditions items={view.family.model.constraints} /><p><Formula expression={readerText(view.family.model.accounting)} /></p></div> : null;
}

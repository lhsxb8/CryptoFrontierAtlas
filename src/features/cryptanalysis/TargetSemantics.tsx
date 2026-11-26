import type { AnalysisModelParameter, AnalysisResult } from './types';
import { MathText } from '../../components/MathText';
import { Formula } from './Formula';
import { humanize } from './model';
import { Conditions } from './Conditions';

function Parameters({ parameters }: { parameters: AnalysisModelParameter[] }) {
  return parameters.length ? <dl className="a-metadata">{parameters.map(parameter => <div key={parameter.name}>
    <dt><Formula expression={parameter.name} /></dt><dd><Formula expression={parameter.meaning} />
      <p><Formula expression={parameter.domain ?? 'Domain not reported'} /></p>
      {parameter.value !== null && <Formula expression={`${parameter.name} = ${parameter.value}`} />}
    </dd></div>)}</dl> : null;
}

/** Shared presentation for all experiment goals; no paper-specific render branches. */
export function ExperimentSummary({ record }: { record: AnalysisResult }) {
  const experiment = record.experiment;
  if (!experiment) return null;
  return <span className="a-experiment-summary"><span><MathText text={experiment.construction.name} /></span>
    <span>{experiment.output.bits === null ? 'Output width not reported' : `${experiment.output.bits}-bit ${experiment.output.scope} output`}</span>
    {experiment.output.mask && <span>Mask: <Formula expression={experiment.output.mask} /></span>}
    {experiment.parameters.length > 0 && <span><Formula expression={experiment.parameters.map(parameter => parameter.value === null ? `${parameter.name}: ${parameter.domain ?? 'domain not reported'}` : `${parameter.name} = ${parameter.value}`).join('; ')} /></span>}
  </span>;
}

export function ExperimentDefinition({ record }: { record: AnalysisResult }) {
  const e = record.experiment;
  if (!e) return null;
  return <div className="a-experiment-definition">
    <h3><MathText text={e.construction.name} /></h3><p><Formula expression={e.construction.definition} /></p>
    <h3>Target Relation</h3><p><Formula expression={e.relation} /></p>
    <dl className="a-metadata"><div><dt>Output condition</dt><dd><ExperimentSummary record={record} /></dd></div>
      <div><dt>Distinctness and reuse</dt><dd><Formula expression={e.distinctness ?? 'Not specified in the source'} /></dd></div>
      <div><dt>Reference experiment</dt><dd><Formula expression={e.reference ?? 'Not specified in the source'} /></dd></div>
    </dl>
    <h3>Input Control</h3><dl className="a-metadata">{e.variables.map(variable => <div key={variable.name}>
      <dt><Formula expression={variable.name} /></dt><dd>{humanize(variable.control)}
        <p><Formula expression={variable.domain ?? 'Domain not reported'} /></p>
        <p><Formula expression={variable.condition ?? 'Condition not reported'} /></p>
      </dd></div>)}</dl>
    <Parameters parameters={e.parameters} />
    {e.unresolved.length > 0 && <><h3>Unresolved Source Definitions</h3><ul className="a-compact-list">{e.unresolved.map(item => <li key={item}><Formula expression={item} /></li>)}</ul></>}
  </div>;
}

export function TheoremValue({ record, expanded = false }: { record: AnalysisResult; expanded?: boolean }) {
  const theorem = record.theorem;
  if (!theorem) return null;
  return <div className="a-bound a-theorem"><strong><Formula expression={theorem.statement} readable /></strong>
    <p><Formula expression={theorem.quantifier} readable /></p>
    <p>{humanize(theorem.metric)} <Formula expression={`${theorem.relation} ${theorem.expression}`} readable /></p>
    {record.target.round_domain && <><p>Round domain: <Formula expression={record.target.round_domain.domain} /></p>
      <p>{humanize(record.target.round_domain.scope)}: <Formula expression={record.target.round_domain.definition} /></p></>}
    {expanded && <><Parameters parameters={theorem.parameters} /><h3>Assumptions</h3>
      <Conditions items={theorem.assumptions} /></>}
  </div>;
}

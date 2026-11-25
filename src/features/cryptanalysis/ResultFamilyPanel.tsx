import type { AnalysisResultFamily, AnalysisSource } from './types';
import { MathText } from '../../components/MathText';
import { Formula } from './Formula';
import { ResourceUnit } from './ResourceUnit';
import { countLabel } from './copy';
import { publicationLabel, resourceLabels, sourceHref } from './model';
import { Conditions } from './Conditions';
import { readerText } from './presentation';

export function FamilyModel({ family, sources, variantId }: {
  family: AnalysisResultFamily; sources: AnalysisSource[]; variantId?: string;
}) {
  return <div className="a-family-model">
    <p><Formula expression={readerText(family.construction)} /></p>
    <dl className="a-family-parameters">{family.parameters.map(parameter => <div key={parameter.name}>
      <dt><Formula expression={parameter.name} /></dt><dd><Formula expression={parameter.meaning} /><span className="a-parameter-domain"><Formula expression={parameter.domain} readable /></span></dd>
    </div>)}</dl>
    {family.model && <>
      <div className="a-family-formulas">{Object.entries(family.model.resources).map(([dimension, expression]) => expression && <div key={dimension}>
        <h4>{resourceLabels[dimension as keyof typeof resourceLabels] || dimension}</h4>
        {expression.display_expression === null ? <span>See reported points</span> : <><Formula expression={expression.display_expression ?? expression.expression} display readable /><ResourceUnit unit={expression.unit} /></>}
        {expression.note && <p><Formula expression={readerText(expression.note)} /></p>}
      </div>)}</div>
      <details className="a-model-conditions"><summary>Parameter range, success and cost accounting</summary>
        <Conditions items={family.model.constraints} />
        <p><strong>Success: </strong><Formula expression={readerText(family.model.success)} readable /></p>
        <p><strong>Accounting: </strong><Formula expression={readerText(family.model.accounting)} /></p>
      </details>
    </>}
    <details className="a-model-conditions"><summary>Formula and table sources · {countLabel(family.evidence.length, 'reference')}</summary>
      <ul>{family.evidence.map((evidence, index) => {
        const source = sources.find(item => item.id === evidence.source_id);
        return <li key={index}><a href={sourceHref(evidence.source_id, variantId)}>{source ? `[${source.citation_label}] · ${publicationLabel(source)}` : evidence.source_id}</a><p><MathText text={evidence.locator} /></p></li>;
      })}</ul>
    </details>
  </div>;
}

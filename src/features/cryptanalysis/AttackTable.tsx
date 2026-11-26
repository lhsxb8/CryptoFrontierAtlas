import { Fragment, useState } from 'react';
import type { AnalysisResult, AnalysisSource, CipherVariant } from './types';
import { MathText } from '../../components/MathText';
import { CitationLabel } from './CitationLabel';
import { Formula } from './Formula';
import { FamilyModel } from './ResultFamilyPanel';
import { ResourceValue } from './ResourceValue';
import { SuccessContext, SuccessValue, successConflicts, successPercentage } from './SuccessValue';
import { ModelDomain, ModelResource, ModelSuccess, ResultTitle, complexityTitle, parameterChoice, parameterSummary } from './ComplexityModels';
import { ExperimentDefinition } from './TargetSemantics';
import { goalLabels, humanize, isCostResult, MAX_COMPARISON_RECORDS, primaryCostDimensions, publicationsForResult, publicationLabel, resourceEntries, resourceLabels, resultCitationLabel, resultHref, roundLabel, roundScopeLabel, sourceHref } from './model';
import type { ResultFamilyView } from './model';
import { attackName, readerText, recoveryScopeLabel, settingSummary } from './presentation';
import { Conditions } from './Conditions';
import { QuantumModelTags } from './QuantumModelTags';
import { attackBlocks, attackRows, type AttackRow } from './attack-rows';
import { useWideCosts } from './use-wide-costs';
export { attackRows, attackBlocks, type AttackRow } from './attack-rows';

type CostDimension = keyof AnalysisResult['resources'] | 'success';
const costColumns = ['Time', 'Data', 'Memory', 'Preprocessing', 'Success Probability'];
const costSymbols: Partial<Record<CostDimension, string>> = {
  time: 'T', data: 'D', memory: 'M', preprocessing: 'T_{\\mathrm{pre}}',
  t_gates: 'T_{\\mathrm{gates}}', circuit_depth: 'D_{\\mathrm{circuit}}',
  t_depth: 'D_T', logical_qubits: 'Q', clifford_gates: 'C_{\\mathrm{gates}}',
};
function costDimensions(row: AttackRow): CostDimension[] {
  const [time, memory] = primaryCostDimensions(row.view.records);
  return [time, 'data', memory, 'preprocessing', 'success'];
}
function AttackCost({ row, dimension, display = false }: { row: AttackRow; dimension: CostDimension; display?: boolean }) {
  if (dimension === 'success') return row.formula ? <ModelSuccess view={row.view} compact display={display} /> : <SuccessValue record={row.view.records[0]} compact display={display} />;
  return row.formula ? <ModelResource view={row.view} dimension={dimension} parameterLabels display={display} /> : <ResourceValue resource={row.view.records[0].resources[dimension]!} display={display} />;
}
function SuccessOverview({ row }: { row: AttackRow }) {
  const successes = row.view.records.map(record => record.success);
  const comparable = successes.every(success => success.status === 'reported' && success.value !== null
    && (success.relation ?? '=') === '=' && success.metric === successes[0].metric && success.basis === successes[0].basis);
  if (!comparable || row.view.records.some(record => successConflicts(record).length > 0)) return <span className="a-formula-reference">By parameter choice ↓</span>;
  const values = [...new Set(successes.map(success => success.value!))].sort((a, b) => a - b);
  return <div className="a-success a-success-overview"><strong>{successPercentage(values[0])}{values.length > 1 && `–${successPercentage(values[values.length - 1])}`}</strong><SuccessContext record={row.view.records[0]} compact /><span>By parameter choice ↓</span></div>;
}

export function SettingValue({ record }: { record: AnalysisResult }) {
  return <div className="a-attack-setting">{settingSummary(record).map((label, index) => index === 0
    ? <strong key={index}>{label}</strong> : <span key={index}><Formula expression={label} /></span>)}<QuantumModelTags record={record} /></div>;
}

function AttackDetails({ row, sources, params }: { row: AttackRow; sources: AnalysisSource[]; params: URLSearchParams }) {
  const { view } = row;
  const record = view.records[0];
  return <div className="a-attack-details">
    <div><h3>Attack and Conditions</h3><p><ResultTitle title={record.title} recordId={record.id} /></p><p><Formula expression={record.target.description} /></p>
      <dl className="a-metadata">{[
        ['Round boundary', record.target.round_convention],
        ['Key relation', record.setting.key_relation], ['Key population', record.setting.key_population],
        ['Plaintext model', record.setting.plaintext_model], ['Reference experiment', record.setting.reference_model],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd><Formula expression={value ?? 'Not reported'} /></dd></div>)}</dl>
      <Conditions items={record.setting.assumptions} />
      {record.setting.fault_model && <dl className="a-metadata">{Object.entries(record.setting.fault_model).map(([key, value]) => <div key={key}><dt>{humanize(key)}</dt><dd><Formula expression={readerText(value)} /></dd></div>)}</dl>}
      <ExperimentDefinition record={record} />
      {view.family && <FamilyModel family={view.family} sources={sources} variantId={params.get('variant') || undefined} />}
    </div>
    <div><h3>Success, Accounting and Evidence</h3>{view.records.map(item => <section key={item.id} className="a-attack-point-details">
      <a className="a-text-link" href={resultHref(item.id, params)}>{view.family ? <Formula expression={parameterChoice(view, item)} /> : 'Full result details'} →</a>
      {item.setting.plaintext_model !== record.setting.plaintext_model && <p><strong>Plaintext model: </strong><Formula expression={item.setting.plaintext_model} /></p>}
      {JSON.stringify(item.setting.assumptions) !== JSON.stringify(record.setting.assumptions) && <Conditions items={item.setting.assumptions} />}
      <SuccessValue record={item} expanded />
      {resourceEntries(item).filter(({ resource }) => resource.status !== 'not_applicable' && readerText(resource.note)).map(({ key, label, resource }) => <p key={key}><strong>{label}: </strong><Formula expression={readerText(resource.note)} /></p>)}
      {item.field_conflicts?.map((field, index) => <p className="a-attack-prerequisite" key={index}><MathText text={field.label} />: <Formula expression={field.description} /></p>)}
      <p className="a-small">{item.assessment.primary_text === 'checked' ? 'Primary text checked' : 'Source review pending'} · Reviewed {item.assessment.reviewed_on}</p>
      <ul className="a-compact-list">{item.evidence.map((evidence, index) => <li key={index}><a href={sourceHref(evidence.source_id, params.get('variant') || undefined)}><MathText text={sources.find(source => source.id === evidence.source_id)?.title ?? evidence.source_id} /></a><p><MathText text={evidence.locator} /></p></li>)}</ul>
    </section>)}</div>
  </div>;
}

export function AttackTable({ views = [], rows: suppliedRows, sources, variant, params, selected, onToggle }: {
  views?: ResultFamilyView[]; rows?: AttackRow[]; sources: AnalysisSource[]; variant: CipherVariant; params: URLSearchParams;
  selected: string[]; onToggle: (id: string) => void;
}) {
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, string>>({});
  const rows = (suppliedRows ?? attackRows(views, params.get('q') || '')).filter(row => isCostResult(row.view.records[0]));
  const { container, wide } = useWideCosts(rows.map(row => row.id).join('|'));
  const widths = [2.5, 16, 4.5, 8, 14, 12, 10, 10, 9, 14];
  const toggleDetails = (id: string) => setOpened(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <div ref={container} className="a-attack-table-wrap" role="region" aria-label={`${variant.name || variant.id} results`}>
    <table className="a-attack-table">
      <caption className="sr-only">Attacks. Formulas and complete reported parameter choices, in source-native units.</caption>
      <colgroup>{widths.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
      <thead><tr><th scope="col"><span className="sr-only">Compare selection</span></th>{['Paper / Attack', 'Rounds', 'Goal', 'Setting', 'Time', 'Data', 'Memory', 'Preprocessing', 'Success Probability'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{attackBlocks(rows).map(block => {
        const { view, id } = block;
        const first = view.records[0], formula = block.rows[0].formula;
        const title = formula ? complexityTitle(view) : first.title;
        const open = opened.has(id);
        const publications = publicationsForResult({ evidence: view.records.flatMap(item => item.evidence) }, sources);
        return <Fragment key={id}>{block.rows.map((row, rowIndex) => {
          const record = row.view.records[0];
          const choice = row.view.records.find(item => item.id === choices[row.id])?.id
            ?? row.view.records.find(item => selected.includes(item.id))?.id ?? row.id;
          const selectionId = formula ? row.id : choice;
          const checked = selected.includes(selectionId);
          return <tr key={row.id} className={`a-attack-row${rowIndex ? ' a-attack-continuation' : ''}${checked ? ' a-row-selected' : ''}`} data-attack-block={id} data-record-id={formula ? undefined : record.id} data-record-ids={formula ? undefined : row.view.records.map(item => item.id).join(' ')} data-model-id={formula ? row.id : undefined} data-family-id={view.family?.id}>
            <td className="a-attack-select"><label className="a-checkbox"><input type="checkbox" aria-label={formula ? `Compare ${title}` : `Compare ${parameterChoice(row.view, row.view.records.find(item => item.id === selectionId)!)} at ${attackName(view)}`} checked={checked} disabled={selected.length >= MAX_COMPARISON_RECORDS && !checked} onChange={() => { setChoices(current => ({ ...current, [row.id]: selectionId })); onToggle(selectionId); }} /></label></td>
            {rowIndex === 0 && <>
              <td data-label="Paper / Attack" className="a-attack-identity" rowSpan={block.rows.length}>
                <a className="a-result-title" href={resultHref(first.id, params)} title={title}><CitationLabel label={resultCitationLabel({ evidence: view.records.flatMap(item => item.evidence) }, sources)} /></a>
                <span className="a-attack-name"><Formula expression={attackName(view)} /></span>
                {publications.map(({ source }) => <a className="a-attack-publication" key={source.publication.url} href={sourceHref(source.id, variant.id)} title={source.title}>{publicationLabel(source)}</a>)}
                {view.records.some(item => item.assessment.claim_status === 'source_conflict') && <span className="a-badge a-badge-warning">Source conflict</span>}
                {view.records.some(item => item.assessment.primary_text !== 'checked') && <span className="a-badge">Review pending</span>}
                <button className="a-text-button a-attack-detail-toggle" aria-expanded={open} aria-controls={`attack-details-${id}`} onClick={() => toggleDetails(id)}>{open ? 'Hide details' : 'Details'}</button>
              </td>
              <td data-label="Rounds" className="a-attack-rounds" rowSpan={block.rows.length}><strong><Formula expression={roundLabel(first)} /></strong><span>{roundScopeLabel(first)}</span></td>
              <td data-label="Goal" rowSpan={block.rows.length}><span className="a-attack-goal">{goalLabels[first.goal]}</span>{first.experiment?.output.scope === 'partial' && first.experiment.output.bits && <span className="a-small">{first.experiment.output.bits}-bit output</span>}{recoveryScopeLabel(first) && <span className="a-small">{recoveryScopeLabel(first)}</span>}</td>
              <td data-label="Setting" rowSpan={block.rows.length}><SettingValue record={first} /></td>
            </>}
            {costDimensions(row).map((dimension, index) => <td data-label={costColumns[index]} className={`a-attack-cost${dimension === 'success' ? ' a-attack-success' : ''}`} key={dimension}>
              {dimension !== 'success' && resourceLabels[dimension] !== costColumns[index] && <span className="a-case-label">{resourceLabels[dimension]}</span>}
              <div className="a-cost-slot" data-cost-slot={`${row.id}:${dimension}`}>
                {wide.has(`${row.id}:${dimension}`)
                  ? dimension === 'success' ? <SuccessOverview row={row} /> : <span className="a-formula-reference" aria-label={`${costColumns[index]}, full expression below`}><Formula expression={costSymbols[dimension] ?? resourceLabels[dimension]} /><span aria-hidden="true"> ↓</span></span>
                  : <div data-cost-content={`${row.id}:${dimension}`}><AttackCost row={row} dimension={dimension} /></div>}
              </div>
              {!formula && index === 0 && view.family && <>
                <span className="a-attack-assignment"><Formula expression={block.rows.length === 1 && row.view.records.length === 1 ? parameterChoice(view, record) : parameterSummary(view, row.view.records)} /></span>
                {row.view.records.length > 1 && <select className="a-attack-choice" aria-label={`Parameters to compare for ${attackName(view)}`} title={parameterChoice(view, row.view.records.find(item => item.id === choice)!)} value={choice} onChange={event => setChoices(current => ({ ...current, [row.id]: event.target.value }))}>
                  {row.view.records.map(item => <option value={item.id} key={item.id}>Compare: {parameterSummary(view, [item])}</option>)}
                </select>}
              </>}
            </td>)}
          </tr>;
        })}
          {block.rows.map(row => {
            const dimensions = costDimensions(row).filter(dimension => wide.has(`${row.id}:${dimension}`));
            return dimensions.length > 0 && <tr className="a-attack-formulas" key={`formulas:${row.id}`} data-formulas-for={row.id}><td colSpan={10}>
              {!formula && block.rows.length > 1 && <p className="a-formula-choice"><Formula expression={parameterSummary(view, row.view.records)} readable /></p>}
              <div className="a-wide-costs">{dimensions.map(dimension => <div className="a-wide-equation" key={dimension}>
                <span className="a-equation-label">{dimension === 'success' ? 'Success' : resourceLabels[dimension]}</span>
                <div data-cost-content={`${row.id}:${dimension}`}><AttackCost row={row} dimension={dimension} display /></div>
              </div>)}</div>
            </td></tr>;
          })}
          {formula && <tr className="a-attack-parameters" data-parameters-for={id}><td /><td colSpan={9}>
            <ModelDomain view={view} compact />
            {(view.family!.model!.display_constraints?.length ?? 0) > 0 && <div className="a-attack-constraints"><Conditions items={view.family!.model!.display_constraints!} /></div>}
          </td></tr>}
          {open && <tr className="a-attack-detail-row" id={`attack-details-${id}`}><td colSpan={10}><AttackDetails row={{ ...block.rows[0], view }} sources={sources} params={params} /></td></tr>}
        </Fragment>;
      })}</tbody>
    </table>
  </div>;
}

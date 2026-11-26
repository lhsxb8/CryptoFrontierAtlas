import type { ReactNode } from 'react';
import type { AnalysisResult, AnalysisSource, CipherVariant } from './types';
import { MathText } from '../../components/MathText';
import { SettingValue, type AttackRow } from './AttackTable';
import { CitationLabel } from './CitationLabel';
import { Formula } from './Formula';
import { kindLabels, methodLabel, publicationsForResult, publicationLabel, resultCitationLabel, resultHref, roundLabel, roundScopeLabel, sourceHref } from './model';
import { attackName } from './presentation';

/** Structural probabilities and bounds describe a property, not attack success or cost. */
export function StructuralTable({ rows, sources, variant, params, renderStatement }: {
  rows: AttackRow[]; sources: AnalysisSource[]; variant: CipherVariant; params: URLSearchParams;
  renderStatement: (record: AnalysisResult) => ReactNode;
}) {
  const widths = [16, 8, 10, 10, 29, 16, 11];
  return <div className="a-attack-table-wrap" role="region" aria-label={`${variant.name || variant.id} structural properties and bounds`}>
    <table className="a-attack-table a-structural-table">
      <caption className="sr-only">Structural properties, theorems and bounds, with their quantified scope and conditions.</caption>
      <colgroup>{widths.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
      <thead><tr>{['Paper / Property', 'Rounds / Scope', 'Type', 'Method', 'Statement / Bound', 'Conditions', 'Source / Details'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(({ id, view }) => {
        const record = view.records[0];
        return <tr className="a-structural-row" key={id} data-record-id={record.id}>
          <td data-label="Paper / Property" className="a-attack-identity">
            <a className="a-result-title" href={resultHref(record.id, params)} title={record.title}><CitationLabel label={resultCitationLabel(record, sources)} /></a>
            <span className="a-attack-name"><Formula expression={attackName(view)} /></span>
          </td>
          <td data-label="Rounds / Scope" className="a-attack-rounds"><strong><Formula expression={roundLabel(record)} /></strong><span>{roundScopeLabel(record)}</span>
            {record.target.round_domain && <p><Formula expression={record.target.round_domain.domain} /></p>}
          </td>
          <td data-label="Type">{kindLabels[record.result_kind]}</td>
          <td data-label="Method">{methodLabel(record.display.method, record.setting.attack_surface)}</td>
          <td data-label="Statement / Bound" className="a-structural-statement">{renderStatement(record)}</td>
          <td data-label="Conditions"><SettingValue record={record} />
            {record.setting.key_relation && <p><Formula expression={record.setting.key_relation} /></p>}
          </td>
          <td data-label="Source / Details">{publicationsForResult(record, sources).map(({ source }) => <a className="a-attack-publication" key={source.publication.url} href={sourceHref(source.id, variant.id)}><MathText text={publicationLabel(source)} /></a>)}
            {record.assessment.claim_status === 'source_conflict' && <span className="a-badge a-badge-warning">Source conflict</span>}
            {record.assessment.primary_text !== 'checked' && <span className="a-badge">Review pending</span>}
            <a className="a-text-link a-structural-detail-link" href={resultHref(record.id, params)}>Details and evidence →</a>
          </td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

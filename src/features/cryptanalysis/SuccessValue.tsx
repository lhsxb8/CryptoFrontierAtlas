import type { AnalysisResult, ProbabilityBasis } from './types';
import { Formula } from './Formula';
import { humanize } from './model';
import { readerText } from './presentation';

// Presentation aliases only; the native metric remains attached to every value.
const metricLabels: Record<string, string> = {
  'full-master-key-recovery': 'Full-key recovery',
  'complete-master-key-recovery': 'Full-key recovery',
  'key-recovery-success': 'Key-recovery success',
  'source-reported-recovery-success': 'Key-recovery success',
  'source-reported-attack-success': 'Attack success',
  'whole-attack-success': 'Whole-attack success',
  'author-model-key-recovery-lower-bound': 'Key recovery · author model',
  'source-model-twelve-byte-linear-key-information-lower-bound': '96-bit linear key information · model bound',
  'source-model-unique-partial-subkey-lower-bound': 'Partial-subkey recovery · model bound',
  'conditional-source-model-unique-partial-subkey-lower-bound': 'Partial-subkey recovery · conditional model bound',
  'author-model-key-recovery-with-at-least-three-good-groups': 'Key recovery · good-group model',
  'equal-prior-two-sided-classification-success': 'Distinguishing success · equal priors',
  'distinguishing-advantage': 'Distinguishing advantage',
  'conditional-source-model-distinguishing-advantage-lower-bound': 'Distinguishing advantage · conditional model bound',
  'mrsa-printed-loop-model-equal-prior-distinguishing-success': 'Distinguishing success · MRSA23 printed-loop model · equal priors',
  'model-aes-acceptance-probability': 'AES acceptance · author model',
  'model-random-permutation-correct-rejection': 'Random-permutation rejection · author model',
  'aes-acceptance-probability': 'AES acceptance',
  'real-cipher-acceptance': 'Real-cipher acceptance',
  'modelled-real-cipher-acceptance': 'Real-cipher acceptance · model estimate',
  'random-permutation-false-positive': 'False-positive probability',
  'random-permutation-rejection-probability': 'Random-permutation rejection',
  'random-permutation-rejection': 'Random-permutation rejection',
  'source-random-permutation-rejection': 'Random-permutation rejection',
  'aes-world-acceptance-observation': 'AES acceptance · experiment',
  'aes20-surrogate-rejection-observation': 'AES20-surrogate rejection · experiment',
  'drand48-surrogate-rejection-observation': 'drand48-surrogate rejection · experiment',
  'balanced-aes-versus-aes20-classification-observation': 'Distinguishing success · AES/AES20 experiment',
  'paper-labelled-rp-rejection-observation': 'Random-surrogate rejection · experiment',
  'balanced-classification-observation': 'Distinguishing success · experiment',
  'source-reported-distinguishing-success': 'Distinguishing success · source definition',
  'source-distinguishing-rate': 'Distinguishing rate · source definition',
  'source-complete-keyspace-enumeration': 'Complete key-space enumeration',
  'key-population-coverage-of-fixed-precomputation': 'Key-population coverage',
  'source-model-per-test-true-key-retention': 'True-key retention · per test',
  'conditional-source-model-candidate-retention-lower-bound': 'True-key retention · conditional model bound',
  'last-round-subkey-candidate-retention': 'True-subkey retention',
  'at-least-one-right-pair': 'At least one right pair',
  'source-simulation-byte-recovery': 'Byte recovery · simulation',
  'random-candidate-set-model-single-byte-uniqueness': 'Byte recovery · random-set model',
  'empirical-byte-recovery-two-random-single-bit-faults-jmr2007': 'Byte recovery · 2 random faults · JMR07',
  'empirical-byte-recovery-three-random-single-bit-faults-jmr2007': 'Byte recovery · 3 random faults · JMR07',
  'packed-first-stage-right-key-parities-correct': 'First-stage array · author model',
  'packed-third-stage-right-key-parities-correct': 'Third-stage row · intended-lane estimate',
  'packed-fourth-stage-one-coefficient-in-range': 'Final-stage coefficient · author model',
  'third-stage-eight-lane-guarded-reference-row-model': 'Third-stage row · guarded-input model',
  'fourth-stage-twelve-lane-guarded-reference-output-model': 'Final-stage output · guarded-input model',
  'ideal-fault-model-byte-recovery': 'Byte recovery · ideal fault model',
  'ideal-fault-model-full-key-recovery': 'Full-key recovery · ideal fault model',
  'conditional-source-model-bit-recovery-lower-bound': 'Bit recovery · conditional model bound',
  'conditional-source-model-full-key-recovery-lower-bound': 'Full-key recovery · conditional model bound',
  'empirical-marginal-model-complete-key-success-lower-envelope': 'Full-key recovery · empirical marginal-model estimate',
  'historical-author-model-complete-master-key-recovery-estimate': 'Full-key recovery · historical model estimate',
  'historical-author-model-selected-round-key-material-recovery-estimate': 'Partial-subkey recovery · historical model estimate',
  'no-incorrect-96-bit-partial-guess-survives-original-multiset-model': '96-bit partial stage · source-model estimate',
  'conditional-source-model-complete-key-recovery-estimate': 'Full-key recovery · conditional model',
  'source-model-no-wrong-120-bit-candidate-reaches-four-votes': '120-bit voting · model bound',
  'source-model-no-surviving-wrong-128-bit-boundary-tuple': 'Wrong-subkey elimination · model bound',
  'source-model-any-wrong-176-bit-tuple-acceptance': 'Wrong-tuple acceptance · model estimate',
  'empirical-unique-full-key-candidate-frequency': 'Unique full-key candidate · experiment',
  'empirical-unique-four-byte-candidate-frequency': 'Unique four-byte candidate · experiment',
  'known-key-relation-construction': 'Relation construction · known key',
  'chosen-key-restricted-pair-construction-success': 'Relation construction · chosen key',
  'conditional-source-model-eventual-restricted-pair-finding': 'Witness finding · conditional eventual completion',
  'chosen-key-simultaneous-set-construction-success': 'Relation construction · chosen key',
  'random-permutation-relation-construction': 'Relation construction · ideal permutation',
  'conditional-wrong-subkey-acceptance': 'Wrong-subkey acceptance · per test',
  'random-permutation-zero-pattern': 'False-positive probability',
};

const relationLabels = { '=': '', '>=': '≥ ', '<=': '≤ ', '>': '> ', '<': '< ' };
const relationMathLabels = { '=': '', '>=': '\\ge ', '<=': '\\le ', '>': '> ', '<': '< ' };
const basisLabels: Record<ProbabilityBasis, string> = {
  author_statement: 'Author statement', author_model: 'Author model', source_proof: 'Theoretical guarantee',
  derived_from_source: 'Derived from source construction', reported_experiment: 'Reported experiment',
};
const reviewLabels = { verified: 'Verified', not_quantified: 'Not quantified', not_stated: 'Not stated in checked source', pending: 'Pending verification' };

export function successConflicts(record: AnalysisResult) {
  return record.field_conflicts?.filter(field => field.field === '/success' || field.field.startsWith('/success/')) ?? [];
}

/** Shift the source decimal, without rounding a bound or a near-one value to 100%. */
export function successPercentage(value: number): string {
  const [coefficient, exponent = '0'] = String(value).split('e');
  const shift = Number(exponent) + 2;
  if (shift < -4) return `${coefficient}e${shift}%`;
  const [integer, fraction = ''] = coefficient.split('.');
  const digits = integer + fraction;
  const position = integer.length + shift;
  const decimal = position <= 0 ? `0.${'0'.repeat(-position)}${digits}`
    : position >= digits.length ? digits + '0'.repeat(position - digits.length)
      : `${digits.slice(0, position)}.${digits.slice(position)}`;
  return decimal.replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') + '%';
}

export function SuccessContext({ record, compact = false }: { record: AnalysisResult; compact?: boolean }) {
  const { success } = record;
  const metricLabel = metricLabels[success.metric] ?? humanize(success.metric);
  const compactMetric = metricLabel.replace(' · MRSA23 printed-loop model', ' · model')
    .replace(/ · (?:author model|model estimate)\b/g, ' · model')
    .replace(/ · source definition\b/g, '')
    .replace(/ · model\b/g, success.basis === 'author_model' ? '' : ' · model')
    .replace(/ · experiment\b/g, success.basis === 'reported_experiment' ? '' : ' · experiment');
  return <>
    {(!compact || success.status !== 'not_applicable') && <span data-native-metric={success.metric} title={success.metric}>{compact ? compactMetric : metricLabel}</span>}
    {success.basis && (!compact || success.basis !== 'author_statement') && <span className="a-success-basis" data-probability-basis={success.basis}>{compact ? ({ author_statement: 'Reported', author_model: 'Model', source_proof: 'Theoretical', derived_from_source: 'Derived', reported_experiment: 'Experiment' }[success.basis]) : basisLabels[success.basis]}</span>}
  </>;
}

export function SuccessValue({ record, expanded = false, compact = false, display = false, contextVisible = true }: { record: AnalysisResult; expanded?: boolean; compact?: boolean; display?: boolean; contextVisible?: boolean }) {
  const { success } = record;
  const numeric = success.status === 'reported' && success.value !== null;
  const conflict = successConflicts(record).length > 0;
  const disputedAuthorClaim = numeric && conflict && success.basis === 'author_statement';
  const description = <Formula expression={readerText(success.description)} />;
  return <div className="a-success" data-success-status={success.status} data-success-value={success.value ?? undefined} data-success-relation={success.relation ?? '='} data-success-review={success.review?.status}>
    <strong className="a-success-value" title={numeric ? `Source probability: ${success.relation ?? '='} ${success.value}` : undefined}>
      {numeric ? `${relationLabels[success.relation ?? '=']}${successPercentage(success.value!)}`
        : success.status === 'reported' ? success.expression ? <Formula expression={success.expression} display={display} readable /> : 'Symbolic'
          : success.status === 'not_applicable' ? compact ? 'N/A' : 'Not applicable'
            : success.review ? compact ? { verified: 'Not reported', not_quantified: 'Not quantified', not_stated: 'Not stated', pending: 'Pending review' }[success.review.status] : reviewLabels[success.review.status] : humanize(success.status)}
      {disputedAuthorClaim && <span className="a-success-claim-qualifier"> · author claim</span>}
    </strong>
    {contextVisible ? <SuccessContext record={record} compact={compact} /> : <span className="sr-only"><SuccessContext record={record} compact={compact} /></span>}
    {conflict && <span className="a-success-conflict">Source conflict</span>}
    {!compact && success.components && <div className="a-success-components" aria-label="Related probability events">{success.components.map(component => <div key={component.metric} data-success-component={component.metric} data-probability-value={component.value ?? undefined}>
      <span>{metricLabels[component.metric] ?? humanize(component.metric)}</span>
      <strong className="a-success-component-value">{component.expression
        ? <Formula expression={`${relationMathLabels[component.relation ?? '=']}${component.expression}`} readable />
        : `${relationLabels[component.relation ?? '=']}${successPercentage(component.value!)}`}</strong>
      <span data-probability-basis={component.basis}>{basisLabels[component.basis]}</span>
      {expanded ? <p><Formula expression={component.description} /></p> : <details className="a-success-definition"><summary>Definition</summary><p><Formula expression={component.description} /></p></details>}
    </div>)}</div>}
    {expanded && numeric && <p className="a-success-native">Source probability: <Formula expression={`${success.relation ?? '='} ${success.value}`} /></p>}
    {!compact && (expanded || success.status === 'reported' && !numeric ? <p>{description}</p>
      : <details className="a-success-definition"><summary>Definition</summary><p>{description}</p></details>)}
    {expanded && success.review && <p className="a-success-review">Checked {success.review.reviewed_on}: <Formula expression={success.review.scope} /></p>}
  </div>;
}

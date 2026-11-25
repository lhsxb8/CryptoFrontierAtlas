import type { AnalysisResult } from './types';
import { humanize, keyModelLabels, methodLabel, type ResultFamilyView } from './model';

/** Compact terminology is shared by all reader-facing summaries. */
export const oracleLabels: Record<string, string> = {
  chosen_plaintext_encryption: 'CPA', 'chosen-plaintext-encryption': 'CPA', chosen_plaintext: 'CPA',
  chosen_ciphertext_decryption: 'CCA', 'chosen-ciphertext-decryption': 'CCA',
  adaptive_chosen_plaintext_encryption: 'Adaptive CPA', adaptive_chosen_ciphertext_decryption: 'Adaptive CCA',
  known_plaintext_ciphertext_pairs: 'KPA', known_plaintext_pairs: 'KPA',
  'known-plaintext-ciphertext-pairs': 'KPA', 'classical-known-plaintext-ciphertext-pairs': 'KPA',
  related_key_chosen_plaintext_encryption: 'CPA', 'related-key-chosen-plaintext-encryption': 'CPA',
  'related-key-chosen-ciphertext-decryption': 'CCA',
  'adaptive-related-key-chosen-plaintext-encryption': 'Adaptive CPA',
  'adaptive-related-key-chosen-ciphertext-decryption': 'Adaptive CCA',
  'related-subkey-chosen-plaintext-encryption': 'Related-subkey CPA',
  'adaptive-related-subkey-chosen-ciphertext-decryption': 'Adaptive related-subkey CCA',
  chosen_plaintext_encryption_under_two_related_master_keys: 'CPA',
  chosen_plaintext_under_two_related_subkey_oracles: 'Related-subkey CPA',
  public_chosen_key_pair_evaluation: 'Chosen-key evaluation', public_chosen_key_permutation_evaluation: 'Chosen-key evaluation',
  public_known_key_encryption_decryption: 'Forward / inverse evaluation', public_known_key_permutation_evaluation: 'Public evaluation',
  'white-box-known-key-forward-and-backward-computation': 'Forward / inverse evaluation',
  chosen_input_four_inner_round_permutation: 'Chosen inner-round inputs',
  public_internal_state_construction: 'Chosen internal state', 'internal-state-difference-model': 'Internal-state differences',
  complete_codebook_pairs: 'Full codebook', public_ciphertexts_unknown_plaintexts: 'Ciphertext-only',
  'passive-local-electromagnetic-traces': 'Local EM leakage',
  bytewise_power_difference_traces_of_round_3_SubBytes: 'Power leakage · round 3 SB',
  bytewise_power_difference_traces_of_round_4_SubBytes_after_RK0_recovery: 'Power leakage · round 4 SB · known RK0',
  bytewise_power_difference_traces_of_round_7_SubBytes: 'Power leakage · round 7 SB',
  'single-bit-state-fault-injection': 'Single-bit state faults', 'single-byte-state-fault-injection': 'Single-byte state faults',
  'random-single-byte-state-fault-injection': 'Random-byte state faults',
  'known-location-random-single-byte-state-fault-injection': 'Random-byte faults · known location',
  'byte-fault-injection-in-state-or-online-key-schedule': 'State / key-schedule byte faults',
  'paired-correct-and-faulty-encryption-outputs': 'Correct / faulty ciphertext pairs',
  'chosen-plaintext-encryption-with-fault-attempt': 'CPA · fault injection',
  'correct-ciphertext-reference': 'Correct ciphertext reference', 'observable-encryption-correctness': 'Correct / incorrect outcome',
  'repeat-encryption-fixed-input': 'Repeated fixed input',
  coherent_secret_key_permutation_queries: 'Coherent secret-key queries',
  'offline-coherent-public-cipher-evaluation': 'Offline coherent evaluation',
  'offline-public-cipher-evaluation': 'Offline public evaluation', 'offline-public-aes-evaluation': 'Offline public evaluation',
  'coherent-ddt-table-lookup': 'Coherent DDT lookup', 'local-reversible-aes-computation': 'Local reversible evaluation',
  none: '', not_applicable_structural_analysis: '', structural_analysis_no_attack_oracle: '', structural_property_no_oracle: '',
};

export function compactFaultText(value: string): string {
  return value
    .replace(/, using the paper's Nr-relative injection window\./, '')
    .replace(/,?\s*(?:the source does not specify|exact measured per-stage|the source's theta is)[\s\S]*$/, '')
    .replace(/\b(?:Immediately|Precisely|Temporarily) /g, '')
    .replace(/MixColumns/g, 'MC').replace(/SubBytes/g, 'SB').replace(/AddRoundKey/g, 'ARK')
    .replace(/After MC of round (\d+) and before MC of round (\d+)/, 'After MC $1, before MC $2')
    .replace(/One random8-bit state byte per useful fault\./, 'One random state byte')
    .replace(/Exactly one bit is flipped in one state byte per useful execution\./, 'One bit in one state byte')
    .replace(/One initial byte with an unknown nonzero difference; later diffusion may change four or sixteen state bytes\./, 'One byte · unknown nonzero difference')
    .replace(/All counted outputs concern the same selected or postselected state byte; there is no whole-state coverage budget\./, 'Same selected state byte')
    .replace(/Count only useful outputs from faults on K8\[12\]; position acquisition or rejection cost is excluded\./, 'Useful K8[12] faults')
    .replace(/Acquire two useful faults in each of the four position classes that cover disjoint four-byte final-round-key groups\. The source calls these carefully chosen locations; arbitrary placement is not guaranteed to achieve coverage in eight attempts\./, 'Two useful faults in each of four position classes')
    .replace(/\.$/, '');
}

export function settingSummary(record: AnalysisResult): string[] {
  const setting = record.setting;
  const labels: string[] = [keyModelLabels[setting.key_model]];
  if (setting.computation === 'quantum') labels.push('Quantum');
  const access = [...new Set(setting.oracle_access.map(value => oracleLabels[value] ?? humanize(value)).filter(Boolean))];
  if (access.length) labels.push(access.join(' · '));
  if (setting.attack_surface === 'side_channel' && !access.some(label => /leakage/i.test(label))) labels.push('Side-channel leakage');
  if (setting.attack_surface === 'fault_injection' && !access.some(label => /fault|outcome/i.test(label))) labels.push('Fault injection');
  if (setting.key_budget) labels.push(`${setting.key_budget.reported} ${humanize(setting.key_budget.unit).toLowerCase()}`);
  else if (setting.related_key_count) labels.push(`${setting.related_key_count} related keys`);
  if (setting.prior_key_knowledge) labels.push(`Requires ${setting.prior_key_knowledge.bits} known key bits`);
  const target = { any_from_pool: 'Any target from a pool', conditional_weak_pair: 'Conditional weak-key pair', attacker_selected_pair: 'Attacker-selected pair' };
  if (setting.target_selection && setting.target_selection in target) labels.push(target[setting.target_selection as keyof typeof target]);
  // Positive weak-key restrictions remain visible; a statement that there is no
  // weak-key restriction is not a weak-key model.
  if (/weak[- ]key/i.test(setting.key_population) && !/no (?:special )?weak[- ]key|without .*weak|not .*weak/i.test(setting.key_population)) {
    const fraction = /fraction\s*(2\^[-\d.()]+)/i.exec(setting.key_population)?.[1];
    labels.push(fraction ? `Weak-key fraction: ${fraction}` : 'Weak-key restriction');
  }
  if (setting.fault_model) {
    labels.push(compactFaultText(setting.fault_model.granularity));
    labels.push(compactFaultText(setting.fault_model.timing));
    labels.push(compactFaultText(setting.fault_model.location));
    if (setting.fault_model.feedback) labels.push('Binary correctness feedback');
  }
  if (setting.quantum_model) {
    const query = { classically_known_pairs: 'Classical known pairs', coherent_secret_oracle: 'Coherent secret-key oracle', offline_public_cipher_evaluation: 'Offline public-cipher evaluation' };
    labels.push(query[setting.quantum_model.query_model]);
  }
  const experiment = record.experiment;
  if (experiment?.construction.type === 'compression_function') labels.push(experiment.construction.name);
  if (experiment?.output.bits !== undefined && experiment.output.bits !== null && experiment.output.scope === 'partial') labels.push(`${experiment.output.bits}-bit output`);
  return [...new Set(labels)];
}

/** Exact, recorded success events; never infer recovery width from rounds or cost. */
export function recoveryScopeLabel(record: AnalysisResult): string | undefined {
  if (record.goal !== 'partial_key_recovery') return;
  if (record.success.metric === 'source-simulation-byte-recovery') return '1 subkey byte';
  if (record.success.metric === 'partial16-bit-master-key-recovery-probability') return '16 master-key bits';
}

/** Family names are curated summaries, never inferred mathematical semantics. */
export function attackName(view: ResultFamilyView): string {
  if (view.family?.display_name) return view.family.display_name;
  if (view.family) return view.family.title.replace(/\b(?:parameter family|source model|family|configurations)\b/gi, '').replace(/\s+/g, ' ').trim();
  const record = view.records[0];
  const name = record.display.name;
  if ((record.compact_review || name === record.id) && record.setting.attack_surface === 'side_channel'
    && record.techniques.includes('see-in-the-middle')) return 'See-in-the-Middle (SITM)';
  if (name === record.id || /^aes(?:[- ]?\d+)?[- ]/i.test(name) && /\b\d{4}\b/.test(name) || /^[A-Z]+\+?\d{2}[a-z]?$/.test(name)) return methodLabel(record.display.method, record.setting.attack_surface);
  return name.replace(/\bparameter family\b/gi, '').replace(/\bfull-key (?:claim|headline)\b/gi, 'full-key recovery').replace(/\s+/g, ' ').trim();
}

/** Delete workflow boilerplate, not scientific conditions or source conflicts.
 * Rules match complete, known workflow statements; mathematical fields bypass
 * this copy layer and raw evidence remains in the dataset.
 */
export function readerText(text: string): string {
  return text
    .replace('Basic:mu4,pb2^-128,p$2^-96; multiple:mu4,pb2^-122,p$2^-94; two-diagonal:mu8,pb≈2^-113.4,p$≈2^-61.4.', 'Basic: mu=4, p_b=2^-128, p_$=2^-96; multiple: mu=4, p_b=2^-122, p_$=2^-94; two-diagonal: mu=8, p_b≈2^-113.4, p_$≈2^-61.4.')
    .replace('OneD_i diagonal,32 guessed key bits; integer complete-coset countL.', 'One D_i diagonal; 32 guessed key bits; integer count L of complete cosets.')
    .replace(/The algorithms and complexity estimates were read but not independently executed; no current best-known or Pareto-frontier status is asserted\.?/g, '')
    .replace(/(?:;\s*|^)(?:the procedure was not independently reproduced|not independently reproduced|no whole-domain optimality claim)\.?/gi, '')
    .replace(/No (?:claimed )?whole-domain Pareto coverage;\s*/g, '')
    .replace(/No whole-domain Pareto or global-optimality proof is asserted\.?/g, '')
    .replace(/Only the (?:published|enumerated) ([^;.]*) (?:is|are) retained as (?:an? )?evidenced attack configuration[s]?; plotted curves are not digitized into invented costs\./g, 'Reported $1.')
    .replace(/Do not generate nonzero-s points merely by sampling (?:this source formula|the model)\.?/g, '')
    .replace(/\bnot an unconditional AES-query bound\b/g, 'fitted leakage model')
    .replace(/;?\s*no (?:Cartesian or continuous interpolation|interpolation asserted|interpolated success curve|unreported continuous tradeoff)\.?/gi, '')
    .trim();
}

export function readerNotes(notes: readonly string[]): string[] {
  return [...new Set(notes.map(readerText).filter(Boolean))];
}

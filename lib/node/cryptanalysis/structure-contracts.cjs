'use strict';

// Structural declarations for contracts whose scientific checks are procedural.
// Validators consume these same field sets; publication permissions live elsewhere.
const scalar = {type: ['string', 'number', 'boolean', 'null']};
const text = {type: 'string'};
const list = items => ({type: 'array', items});
const texts = list(text);
const object = (required, optional = [], children = {}) => ({type: 'object', additionalProperties: false,
  required, properties: Object.fromEntries([...required, ...optional].map(key => [key, children[key] ?? scalar]))});
const map = (items, domain) => ({type: 'object', additionalProperties: items, 'x-atlas-key-domain': domain});
const opaque = {};

const parameter = object(['name', 'meaning', 'domain'], ['short_meaning', 'short_domain']);
const point = object(['result_id', 'values'], [], {values: map({type: ['string', 'number']}, 'declared family parameter names')});
const evidence = object(['source_id', 'locator'], [], {source_id: text, locator: text});
const resource = object(['expression', 'unit'], ['display_expression', 'note']);
const model = object(['resources', 'constraints', 'success', 'accounting'], ['display_constraints'], {
  resources: map(resource, 'resource dimensions present in member results'), constraints: texts, display_constraints: texts,
});
const family = object(['id', 'title', 'construction', 'representation', 'parameters', 'points', 'evidence'], ['model', 'display_name'], {
  parameters: list(parameter), points: list(point), evidence: list(evidence), model,
});
const exclusion = object(['result_id', 'reason']);
const familyCatalog = object(['schema_version', 'cipher_family_id', 'reviewed_on', 'families', 'standalone_result_ids', 'excluded_results'], [], {
  families: list(family), standalone_result_ids: texts, excluded_results: list(exclusion),
});
const parameterDisplay = object([], ['short_meaning', 'short_domain']);
const resourceDisplay = object([], ['display_expression', 'note']);
const modelDisplay = object([], ['display_constraints', 'resources'], {
  display_constraints: texts, resources: map(resourceDisplay, 'resource dimensions in the referenced family'),
});
const familyDisplay = object([], ['display_name', 'parameters', 'model'], {
  parameters: map(parameterDisplay, 'declared parameter names in the referenced family'), model: modelDisplay,
});
const presentation = object(['schema_version', 'cipher_family_id', 'families'], [], {
  families: map(familyDisplay, 'existing result family identifiers'),
});
const review = object(['scope', 'decision'], ['reviewed_on', 'next_action', 'issue_ids'], {issue_ids: texts});
const instanceComparison = object([], ['variant_id', 'relation', 'record_ids', 'reasons'], {record_ids: texts, reasons: texts});
const comparison = object([], ['relation', 'record_ids', 'reasons', 'baseline_hash', 'instances'], {
  record_ids: texts, reasons: texts, instances: list(instanceComparison),
});
const entry = object(['id', 'source_id', 'source_sha256', 'method', 'record_id', 'review', 'comparison'], [], {review, comparison});
const manifest = object([], ['dataset_version', 'schema_version', 'reviewed_on', 'local_only', 'record_count',
  'source_count', 'scope', 'verification_scope', 'records'], {records: texts});
const boundedChecks = object([], ['applicability_checked', 'attack_failure_proved', 'attribution_checked',
  'automatic_dominance_certified', 'corrected_cost_derivation_verified', 'exact_target_equivalence',
  'full_master_key_completion_priced', 'independent_transcription_complete', 'key_index_reconciled',
  'new_cipher_experiments', 'primary_versions_checked', 'reading_complete', 'reference_attribution_checked',
  'round_boundary_reconciled', 'secondary_versions_checked', 'source_equation_prose_checked',
  'source_versions_separated', 'structured_inventory_closed', 'version_lineage_reconciled',
  'witness_bytes_and_key_labels_match_across_editions']);
const issue = object([], ['id', 'status', 'affected_records', 'affected_entries', 'action', 'evidence', 'original_url',
  'access_component', 'audit_status', 'bounded_checks', 'category', 'description', 'kind', 'locator',
  'proposed_resolution_status', 'resolution', 'resolution_scope', 'resolution_source_id', 'resolution_source_sha256',
  'result_ids', 'scope', 'severity', 'source_id', 'summary', 'audit_report', 'local_resolution_report',
  'resolution_report', 'resolved_in_batch', 'work_id'], {
  action: text, affected_records: texts, affected_entries: texts, evidence: texts, result_ids: texts, bounded_checks: boundedChecks,
  access_component: object([], ['source_id', 'source_sha256', 'status']),
});
const pending = object([], ['id', 'status', 'reason', 'url', 'reviewed_source_id', 'audit_report', 'provenance_receipt', 'tasks', 'work_id'], {tasks: opaque});
const reviewProcess = { ...object([], ['independence_limit', 'witness_check', 'artifact_inspection']),
  // Internal workflow steps are a dictionary, not additional public fields.
  additionalProperties: opaque, 'x-atlas-key-domain': 'internal workflow step names',
};
const coverage = object([], ['reviewed_on', 'family_ids', 'coverage_kind', 'exhaustive', 'latest_or_best_known_claim',
  'selection', 'included_counts', 'not_yet_covered', 'review_process', 'issues', 'pending_sources', 'ingestion_batches',
  'queries_used', 'publication'], {
  family_ids: texts, not_yet_covered: texts, included_counts: map({type: 'integer'}, 'coverage count categories'),
  review_process: reviewProcess, issues: list(issue), pending_sources: list(pending),
  ingestion_batches: list(opaque), queries_used: opaque, publication: opaque,
});
const witnessSource = object([], ['title', 'authors', 'version_date', 'retrieved_date', 'repository_commit', 'pdf_url', 'pdf_sha256',
  'author_verifier_url', 'author_verifier_sha256', 'author_verifier_note'], {authors: texts});
const roundConvention = object([], ['id', 'initial_add_round_key', 'key_schedule', 'round_selection',
  'last_round_mix_columns', 'description', 'source_locator']);
const witness = object([], ['id', 'result_id', 'key_bits', 'rounds', 'plaintext_control', 'plaintext', 'key1', 'key2',
  'expected_ciphertext', 'paper_locator', 'code_locator', 'interpretation']);
const witnesses = object([], ['schema_version', 'scope', 'known_answer_source_id', 'scope_note', 'source', 'round_convention', 'witnesses'], {
  source: witnessSource, round_convention: roundConvention, witnesses: list(witness),
});
const shapes = {familyCatalog, family, parameter, point, evidence, model, resource, exclusion,
  presentation, familyDisplay, parameterDisplay, modelDisplay, resourceDisplay, entry, review, comparison, instanceComparison,
  manifest, coverage, witnesses};
const fields = name => Object.keys(shapes[name].properties);
module.exports = {shapes, fields};

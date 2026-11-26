import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {writePublicationFixture} from './publication-fixtures.mjs';

export function problemResultFixture(id = 'synthetic-factoring-point') {
  const resource = {status: 'reported', reported: '$2^{10}$', log2: 10, unit: 'synthetic-operations', qualifier: 'exact', note: 'Synthetic matched accounting, not a literature result.'};
  return {schema_version: 1, id, title: 'Synthetic Factoring Example', method: 'synthetic-method', result_kind: 'algorithm', goal: 'complete_factorization', statement: 'Synthetic theorem statement, not a scientific claim.',
    target: {kind: 'hard_problem', problem_id: 'integer-factorization', input_class: 'composite_integer', description: 'Synthetic fixed input class.', parameters: [{name: 'n', meaning: 'Synthetic input size', domain: 'n = 32', value: 32}], modulus_bits: 32, instance_name: null},
    setting: {computation: 'classical', model: 'deterministic', basis: 'proved', input_access: 'public_integer', assumptions: ['Synthetic assumption.'], auxiliary_information: []},
    resources: {time: {...resource}, memory: {...resource, unit: 'synthetic-bits'}},
    success: {status: 'reported', metric: 'complete-factorization', value: 1, relation: '=', basis: 'source_proof', description: 'Synthetic success guarantee only.', review: {status: 'verified', reviewed_on: '2026-11-26', scope: 'Synthetic targeted success review.'}},
    evidence: [{source_id: 'synthetic-model-source', locator: 'Synthetic theorem 1, page 2.', fields: ['/statement', '/target', '/setting', '/resources', '/success', '/success/review'], interpretation: 'Synthetic evidence, not a real paper.'}],
    assessment: {claim_status: 'author_reported', review_scope: 'targeted_primary_text', reproduction: 'not_attempted', reviewed_on: '2026-11-26', frontier_status: 'not_assessed'}, limitations: ['Synthetic test only.'], related_result_ids: []};
}
export function writeProblemFixture(root) {
  const fixture = writePublicationFixture(root), record = problemResultFixture();
  mkdirSync(join(root, 'data/primitives'), {recursive: true});
  // Reference registry for this isolated loader test; full catalog validation is
  // exercised by the independent public-checkout build with its own fixtures.
  writeFileSync(join(root, 'data/primitives/catalog.json'), JSON.stringify({hard_problems: [{id: 'integer-factorization'}]}));
  const family = {id: 'synthetic-problem-family', title: 'Synthetic Problem Family', construction: 'Synthetic construction.', representation: 'table',
    parameters: record.target.parameters.map(({value, ...p}) => p), points: [{result_id: record.id, values: {n: 32}}], evidence: [{source_id: fixture.source.id, locator: 'Synthetic theorem 1, page 2.'}]};
  const catalog = {schema_version: 1, problem_id: 'integer-factorization', reviewed_on: '2026-11-26', records: [record.id], families: [family], standalone_result_ids: [],
    coverage: {search_cutoff: '2026-11-26', comparison_as_of: '2026-11-26', selection: 'Synthetic bounded extraction, not a census.', source_ids: [fixture.source.id], exhaustive: false, latest_or_best_known_claim: false, not_yet_covered: ['Synthetic gap.'], exclusions: []},
    ingestion_batches: [{id: 'synthetic-problem-batch', reviewed_on: '2026-11-26', baseline_hash: 'b'.repeat(64), new_record_count: 1, new_records: [record.id], indexed_existing_records: [], added_source_ids: [fixture.source.id], provenance_receipt: 'provenance/reviews/synthetic-problem-batch.json'}]};
  fixture.write('provenance/reviews/synthetic-problem-batch.json', {schema_version: 1, batch_id: 'synthetic-problem-batch', reviewed_on: '2026-11-26', source_versions: [{source_id: fixture.source.id, sha256: fixture.source.content_sha256, locators: ['Synthetic theorem 1, page 2.']}], decisions: [{source_ids: [fixture.source.id], result_ids: [record.id], decision: 'needs_details', reason: 'Synthetic targeted result extraction.'}]});
  fixture.write(`problem-results/${record.id}.json`, record);
  fixture.write('problem-analyses/integer-factorization.json', catalog);
  return {...fixture, problemRecord: record, problemCatalog: catalog};
}

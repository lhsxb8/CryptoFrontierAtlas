'use strict';

const {validateDataset} = require('./check-data.cjs');
const families = require('./result-families.cjs');
const model = require('../../cryptanalysis/result-model.cjs');
const {resolvePaths} = require('../../../atlas.config.cjs');

const emptyDataset = () => ({enabled: false, manifest: null, ciphers: [], results: [],
  compactResults: [], familyCatalogs: [], sources: [], variants: [], coverage: null});
const pick = (value, keys) => Object.fromEntries(keys.filter(key => key in value).map(key => [key, value[key]]));

// Project collection metadata into the browser read model.
function coverageView(coverage) {
  return {...pick(coverage, ['family_ids', 'reviewed_on', 'selection', 'included_counts',
    'not_yet_covered', 'review_process', 'issues', 'pending_sources', 'exhaustive', 'latest_or_best_known_claim']),
    ingestion_batches: (coverage.ingestion_batches ?? []).map(batch => pick(batch,
      ['id', 'reviewed_on', 'new_records', 'indexed_existing_records', 'note']))};
}

function loadDataset(root, profile = 'public') {
  // The boolean compatibility case is for existing local maintenance tooling.
  if (profile === true) profile = 'internal';
  if (profile === false) profile = 'public';
  if (!['internal', 'public'].includes(profile)) throw new Error('Unknown analysis profile');
  const validated = profile === 'public'
    ? require('./published.cjs').validatePublishedDataset(root).data : validateDataset(root);
  const {manifest, sources, ciphers, variants, coverage, results, entries, familyCatalogs} = validated;
  const compactResults = entries.filter(entry => entry.record_id === null).map(entry => {
    const point = families.materializeEntry(entry);
    const title = entry.id.replace(/-/g, ' ').replace(/^aes(\d*)\b/i, (_match, bits) => bits ? `AES-${bits}` : 'AES').replace(/\b(\d+)r\b/g, '$1-round');
    return {...point, schema_version: model.recordVersion(point), title,
      display: {name: title, method: entry.method}, bound: point.bound ?? null,
      limitations: [], related_problem_ids: [],
      evidence: point.evidence.map(evidence => ({interpretation: '', ...evidence})),
      assessment: {...point.assessment,
        primary_text: ['targeted_primary_text', 'abstract_and_targeted_primary_text',
          'targeted_primary_text_body_supplement', 'full_primary_text_inventory'].includes(entry.review.scope) ? 'checked' : 'not_recorded',
        reproduction: point.assessment.reproduction ?? 'not_attempted',
        reviewed_on: point.assessment.reviewed_on ?? ''},
      compact_review: {...entry.review}};
  });
  const byId = new Map(results.map(result => [result.id, result]));
  return {enabled: true, manifest, ciphers, results: manifest.records.map(id => byId.get(id)), compactResults,
    familyCatalogs: families.loadDisplayCatalogs(root, familyCatalogs, resolvePaths(root, profile).cryptanalysis),
    sources, variants, coverage: coverageView(coverage)};
}

module.exports = {loadDataset, emptyDataset, coverageView};

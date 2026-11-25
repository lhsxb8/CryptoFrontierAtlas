'use strict';

// Pure scientific projections shared by tools and presentation code.
const {experimentScope, recordVersion, hasSourceConflict} = require('./result-model.cjs');
const payloadFields = ['result_kind', 'goal', 'target', 'setting', 'techniques', 'resources',
  'success', 'candidate_space', 'property', 'bound', 'experiment', 'theorem', 'field_conflicts', 'evidence', 'assessment'];

function materializeEntry(entry) {
  if (entry.record_id !== null) throw new Error('Only compact-only entries have their own payload');
  const conflict = hasSourceConflict(entry);
  return {schema_version: recordVersion(entry), id: entry.id, title: entry.id, display: {name: entry.id, method: entry.method},
    ...Object.fromEntries(payloadFields.filter(field => field in entry).map(field => [field, entry[field]])),
    assessment: {...entry.assessment,
      ...(entry.review?.reviewed_on ? {reviewed_on: entry.review.reviewed_on} : {}),
      claim_status: conflict ? 'source_conflict' : 'author_reported', frontier_status: 'not_assessed'}};
}

function groupingScope(point) {
  const setting = point.setting;
  return {method: point.display.method, result_kind: point.result_kind, goal: point.goal,
    target: {variant_ids: [...point.target.variant_ids].sort(), rounds: point.target.rounds,
      full_round: point.target.full_round, round_convention: point.target.round_convention,
      ...(point.target.round_domain ? {round_domain: point.target.round_domain} : {})},
    ...(point.experiment ? {experiment: experimentScope(point, true)} : {}),
    ...(point.theorem ? {theorem: point.theorem} : {}),
    setting: Object.fromEntries(['key_model', 'key_population', 'key_relation', 'key_budget',
      'computation', 'attack_surface', 'related_key_count', 'reference_model',
      'target_selection', 'prior_key_knowledge', 'fault_model', 'quantum_model']
      .filter(key => key in setting).map(key => [key, setting[key]])),
    oracle_access: [...setting.oracle_access].sort(),
    candidate_material: point.candidate_space ? {
      material_bits: point.candidate_space.material_bits, material: point.candidate_space.material,
    } : null};
}

function catalogStats(catalog) {
  const grouped = catalog.families.reduce((n, family) => n + family.points.length, 0);
  return {result_families: catalog.families.length + catalog.standalone_result_ids.length,
    parameterized_families: catalog.families.length,
    formula_families: catalog.families.filter(f => f.representation === 'formula').length,
    table_families: catalog.families.filter(f => f.representation === 'table').length,
    grouped_points: grouped, standalone_points: catalog.standalone_result_ids.length,
    active_points: grouped + catalog.standalone_result_ids.length,
    excluded_points: catalog.excluded_results.length,
    total_points: grouped + catalog.standalone_result_ids.length + catalog.excluded_results.length};
}

module.exports = {payloadFields, materializeEntry, groupingScope, catalogStats};

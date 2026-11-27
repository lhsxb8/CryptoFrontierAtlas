'use strict';

// Shared, side-effect-free semantics used by both Node and browser modules.
const taxonomy = require('../../schemas/cryptanalysis/result-taxonomy.json');
const {compressionTargetErrors} = require('./compression.cjs');
const own = (object, key) => object != null && Object.prototype.hasOwnProperty.call(object, key);
const definition = result => own(taxonomy.goals, result.goal) ? taxonomy.goals[result.goal] : null;
const resultKind = result => own(taxonomy.kinds, result.result_kind) ? taxonomy.kinds[result.result_kind] : null;
const supportedVersion = version => taxonomy.schema_versions.includes(version);
const currentVersion = taxonomy.schema_versions.at(-1);
function recordVersion(result) {
  return result.schema_version ?? (definition(result)?.legacy && !result.experiment && !result.theorem && !result.target.round_domain ? taxonomy.legacy_version : currentVersion);
}
function datasetVersion(records) {
  const versions = records.map(recordVersion);
  if (versions.some(version => !supportedVersion(version))) throw new Error('Unsupported analysis schema version');
  return taxonomy.schema_versions.filter(version => versions.includes(version)).at(-1) ?? taxonomy.legacy_version;
}
function targetErrors(result, variant) {
  const target = result.target, errors = [];
  if (target.round_domain) {
    if (result.result_kind !== 'theorem' || target.rounds !== null || target.full_round !== null) errors.push('A round domain requires a theorem with null fixed-round fields');
    const {minimum, maximum, step} = target.round_domain;
    if (minimum !== null && maximum !== null && minimum > maximum) errors.push('Reversed round domain');
    if (step !== null && step <= 0) errors.push('Invalid round-domain step');
    if (target.round_domain.scope === 'registered_instance') {
      if (minimum === null || maximum === null) errors.push('Registered-instance round domains require finite bounds');
      if (variant && maximum > variant.full_rounds) errors.push('round domain exceeds the registered instance');
    }
  } else {
    if (!Number.isFinite(target.rounds) || target.rounds <= 0 || typeof target.full_round !== 'boolean') errors.push('Fixed rounds and full-round flag are required');
    if (variant && target.rounds > variant.full_rounds) errors.push('round count exceeds the registered instance');
    if (variant && target.full_round !== (target.rounds === variant.full_rounds)) errors.push('full-round flag mismatch');
  }
  return [...errors, ...compressionTargetErrors(result, variant)];
}
function probabilityErrors(result) {
  const errors = [], success = result.success;
  if (success?.review) {
    // A transcribed author claim can remain scientifically disputed. Require
    // primary-event evidence and a primary-event conflict; never promote a
    // component probability or an unsupported pending value to the headline.
    const primaryField = field => /^\/success(?:\/(?:value|expression|relation|metric|basis|description))?$/.test(field);
    const pendingAuthorClaim = success.review.status === 'pending' && success.status === 'reported'
      && ['author_statement', 'author_model'].includes(success.basis)
      && (Number.isFinite(success.value) || typeof success.expression === 'string' && success.expression.trim().length > 0)
      && (result.field_conflicts ?? []).some(conflict => primaryField(conflict.field))
      && (result.evidence ?? []).some(evidence => evidence.fields.some(primaryField));
    const expected = success.review.status === 'verified' ? 'reported' : 'not_reported';
    if (success.status !== expected && !pendingAuthorClaim) errors.push('Success review contradicts the primary probability status');
  }
  if (success?.components) {
    if (success.status === 'not_applicable') errors.push('Inapplicable success cannot contain probability components');
    const metrics = success.components.map(component => component.metric);
    if (new Set(metrics).size !== metrics.length) errors.push('Duplicate success component metrics');
    for (let i = 0; i < success.components.length; i++) {
      const pointer = '/success/components/' + i;
      if (!(result.evidence ?? []).some(e => e.fields.some(field => field === '/success/components' || field === pointer || field.startsWith(pointer + '/')))) errors.push('Missing evidence for success component ' + i);
    }
  }
  return errors;
}
function semanticErrors(result) {
  const errors = [], goal = definition(result), kind = resultKind(result);
  if (!goal || !kind || goal.kind !== result.result_kind) errors.push('Unknown or incompatible result kind and goal');
  if (goal?.key_model && result.setting.key_model !== goal.key_model) errors.push('Goal requires key model ' + goal.key_model);
  if (result.setting.key_model === 'known_key' && !goal?.known_key) errors.push('known-key evidence supports a distinguisher or structural property, not unknown-key recovery');
  for (const field of goal?.required ?? []) if (!result[field]) errors.push('Goal requires ' + field);
  errors.push(...targetErrors(result), ...probabilityErrors(result));
  if (result.experiment) {
    const e = result.experiment;
    if (!(goal?.required ?? []).includes('experiment')) errors.push('Experiment contract is not supported by this goal');
    if (goal?.construction_type && e.construction.type !== goal.construction_type) errors.push('Incompatible construction type');
    if (e.output.bits !== null && e.output.bits > e.construction.output_bits) errors.push('Output condition exceeds construction width');
    if (e.output.scope === 'full' && (e.output.bits !== e.construction.output_bits || e.output.mask !== null)) errors.push('Full output requires the complete width and no partial mask');
    if (e.output.scope === 'partial' && e.output.bits !== null && e.output.bits >= e.construction.output_bits) errors.push('Partial output must be narrower than full output');
    if (e.output.scope === 'unspecified' && (e.output.bits !== null || e.output.mask !== null)) errors.push('Unspecified output must retain null width and mask');
    for (const field of ['variables', 'parameters']) {
      const names = e[field].map(parameter => parameter.name);
      if (new Set(names).size !== names.length) errors.push('Duplicate experiment ' + field);
    }
    if (result.goal === 'differential_q_multicollision' && !e.parameters.some(parameter => parameter.name === 'q')) errors.push('Differential q-multicollision requires the q parameter');
    const q = e.parameters.find(parameter => parameter.name === 'q');
    if (q && typeof q.value === 'number' && (!Number.isInteger(q.value) || q.value < 2)) errors.push('Multicollision multiplicity must be an integer at least two');
  }
  if (result.theorem) {
    if (result.result_kind !== 'theorem') errors.push('Theorem payload requires theorem result kind');
    if (goal?.metric && result.theorem.metric !== goal.metric) errors.push('Theorem metric does not match goal');
    const names = result.theorem.parameters.map(parameter => parameter.name);
    if (new Set(names).size !== names.length) errors.push('Duplicate theorem parameters');
    if (result.target.round_domain) {
      const domain = result.target.round_domain;
      const parameter = result.theorem.parameters.find(parameter => parameter.name === domain.variable);
      if (!parameter) errors.push('Theorem must declare its round variable');
      else if (parameter.value !== null || parameter.domain !== domain.domain) errors.push('Theorem round variable must be quantified over the declared round domain');
    }
  }
  if (result.result_kind === 'theorem') {
    if (result.bound !== null) errors.push('Theorem uses its own quantified bound, not the legacy active-S-box bound');
    if (result.success.status !== 'not_applicable' || Object.values(result.resources).some(cost => cost.status !== 'not_applicable')) errors.push('A theorem is not an attack-cost or attack-success vector');
  }
  for (const field of ['experiment', 'theorem']) if (result[field] && !(result.evidence ?? []).some(e => e.fields.some(pointer => pointer === '/' + field || pointer.startsWith('/' + field + '/')))) errors.push('Missing evidence for ' + field);
  return errors;
}
function experimentScope(result, grouping = false) {
  if (!result.experiment) return null;
  const e = result.experiment;
  return {...e, parameters: e.parameters.map(parameter => grouping
    ? Object.fromEntries(Object.entries(parameter).filter(([key]) => key !== 'value')) : parameter)};
}
function hasSourceConflict(result) {
  return result.assessment?.claim_status === 'source_conflict'
    || (result.field_conflicts?.length ?? 0) > 0
    || Object.values(result.resources ?? {}).some(cost => cost?.status === 'conflict')
    || result.comparison?.relation === 'conflict';
}
function comparisonBlockers(result) {
  const reasons = [], kind = resultKind(result), goal = definition(result);
  if (!kind || !goal || goal.kind !== result.result_kind) reasons.push('unknown or incompatible result semantics');
  if (!own(taxonomy.methods, result.display?.method ?? result.method)) reasons.push('unknown or missing attack method');
  if (result.experiment || result.theorem) reasons.push(...semanticErrors(result));
  if (!kind?.comparable) reasons.push('result is not an attack-cost vector');
  if (result.success?.review && result.success.review.status !== 'verified') reasons.push('primary success probability is not verified');
  if (result.target.round_domain) reasons.push('variable-round theorem is not a fixed attack target');
  if ((goal?.required ?? []).includes('experiment') && !result.experiment) reasons.push('missing experiment contract');
  if (result.experiment) {
    const e = result.experiment;
    if (e.unresolved.length || e.distinctness === null || e.reference === null || e.output.scope === 'unspecified'
      || e.output.bits === null || e.output.scope === 'partial' && e.output.mask === null
      || e.parameters.some(parameter => typeof parameter.value !== 'number' || parameter.domain === null)
      || e.variables.some(variable => variable.control === 'not_reported' || variable.domain === null || variable.condition === null)) reasons.push('incomplete or symbolic experiment contract');
  }
  return reasons;
}
// Reports retain native event names and source expressions, just like the UI.
function successSummary(success) {
  const probability = value => value.expression ?? value.value;
  const primary = success.status === 'reported'
    ? `${success.relation ?? (success.expression ? '' : '=')}${probability(success) ?? 'symbolic'} ${success.metric}`
    : `${success.review?.status ?? success.status} ${success.metric}`;
  return [primary, ...(success.components ?? []).map(component =>
    `${component.metric} ${component.relation ?? '='}${probability(component)}`)].join('; ');
}
module.exports = {taxonomy, definition, resultKind, currentVersion, supportedVersion, recordVersion,
  datasetVersion, targetErrors, semanticErrors, probabilityErrors, experimentScope, hasSourceConflict, comparisonBlockers, successSummary};

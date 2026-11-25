'use strict';
const {comparisonBlockers, experimentScope, hasSourceConflict} = require('./result-model.cjs');

// This compares reported cost vectors, never proves optimality or best-known status.
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function comparability(a, b) {
  const reasons = [];
  if (a.result_kind !== b.result_kind || a.goal !== b.goal) reasons.push('different result kind or goal');
  const methodA = a.display?.method ?? a.method, methodB = b.display?.method ?? b.method;
  if (!methodA || !methodB) reasons.push('missing attack method');
  else if (methodA !== methodB) reasons.push('different attack method');
  for (const reason of new Set([...comparisonBlockers(a), ...comparisonBlockers(b)])) reasons.push(reason);
  for (const field of ['variant_ids', 'rounds', 'round_convention', 'full_round', 'round_domain']) {
    if (stable(a.target[field]) !== stable(b.target[field])) reasons.push('different target.' + field);
  }
  // Exact equality is deliberately conservative: semantic equivalences need a reviewed rule.
  if (stable(a.setting) !== stable(b.setting)) reasons.push('different setting or assumptions');
  if (stable(experimentScope(a)) !== stable(experimentScope(b))) reasons.push('different experiment construction, output condition or parameters');
  if (a.result_kind === 'structural_bound' || b.result_kind === 'structural_bound') reasons.push('bounds are not attack-cost vectors');
  if (a.result_kind === 'structural_property' || b.result_kind === 'structural_property') reasons.push('structural properties are not attack-cost vectors');
  if (a.result_kind === 'key_space_reduction' || b.result_kind === 'key_space_reduction') reasons.push('candidate-space reductions are not completed key-recovery cost vectors');
  if (stable(a.candidate_space) !== stable(b.candidate_space)) reasons.push('different candidate-space outcome or statistical scope');
  if (hasSourceConflict(a) || hasSourceConflict(b)) reasons.push('unresolved source conflict');
  if (a.success.status !== 'reported' || b.success.status !== 'reported' ||
      a.success.value === null || b.success.value === null) reasons.push('success probability not numerically specified');
  if (stable(a.success) !== stable(b.success)) reasons.push('different success semantics');
  if ((a.success.relation && a.success.relation !== '=') || (b.success.relation && b.success.relation !== '=')) {
    reasons.push('success probability is only bounded, not an exact comparable value');
  }
  for (const dimension of resourceDimensions(a, b)) {
    const x = a.resources[dimension], y = b.resources[dimension];
    if ([x, y].some(cost => cost?.qualifier === 'lower_bound' || (cost?.relation && cost.relation !== '='))) reasons.push(dimension + ': one-sided resource threshold is not a measured comparable cost');
    if (!x || !y || x.status !== 'reported' || y.status !== 'reported' || x.log2 === null || y.log2 === null) {
      reasons.push(dimension + ': missing, qualitative, conflicting or non-numeric cost');
    } else if (x.unit !== y.unit || x.qualifier !== y.qualifier || x.note !== y.note) {
      reasons.push(dimension + ': incompatible unit, precision or accounting assumptions');
    }
  }
  return {comparable: reasons.length === 0, reasons};
}

// Every reported coordinate participates; optional dimensions are never dropped.
function resourceDimensions(a, b) {
  return [...new Set(['time', 'data', 'memory', 'preprocessing', ...Object.keys(a.resources), ...Object.keys(b.resources)])];
}

function compareReportedCosts(a, b) {
  const check = comparability(a, b);
  if (!check.comparable) return {relation: 'incomparable', reasons: check.reasons};
  const dimensions = resourceDimensions(a, b);
  const le = dimensions.every(d => a.resources[d].log2 <= b.resources[d].log2);
  const ge = dimensions.every(d => a.resources[d].log2 >= b.resources[d].log2);
  return {relation: le && ge ? 'equal' : le ? 'a_dominates_reported_costs' : ge ? 'b_dominates_reported_costs' : 'tradeoff', reasons: []};
}

module.exports = {comparability, compareReportedCosts};

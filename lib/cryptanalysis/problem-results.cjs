'use strict';

const {probabilityErrors} = require('./result-model.cjs');
const contract = require('../../schemas/cryptanalysis/problem-result.schema.json');
const goalLabels = {nontrivial_factor: 'Nontrivial Factor', complete_factorization: 'Complete Factorization', large_order_or_factor: 'Large-Order Element or Factor'};
const sectionFor = record => record.result_kind === 'computation_record' ? 'records'
  : record.setting.computation === 'quantum' ? 'quantum' : 'classical';

function problemResultErrors(record) {
  const errors = probabilityErrors(record);
  if (record.target.kind !== 'hard_problem' || record.target.problem_id !== 'integer-factorization') errors.push('Unsupported hard-problem target');
  for (const field of ['result_kind', 'goal']) if (!contract.properties[field].enum.includes(record[field])) errors.push('Unknown problem ' + field);
  if ((record.goal === 'large_order_or_factor') !== (record.result_kind === 'supporting_result')) errors.push('Disjunctive subroutine requires supporting-result semantics');
  const measured = record.result_kind === 'computation_record';
  if (measured !== Boolean(record.experiment) || measured !== (record.setting.basis === 'experiment')
      || measured !== (record.setting.model === 'measured_implementation')) errors.push('Computation records require an experiment and measured model');
  if (measured && (record.target.modulus_bits === null || !record.target.instance_name)) errors.push('Computation record needs a named, sized input');
  if ((record.setting.model === 'quantum') !== (record.setting.computation === 'quantum')) errors.push('Computation and algorithm model disagree');
  if (record.setting.memory_model && record.setting.computation !== 'quantum') errors.push('Quantum memory model on a classical result');
  if (record.setting.model === 'oracle_assisted' && !record.setting.auxiliary_information.length) errors.push('Oracle access must be specified');
  if (record.setting.basis === 'conditional' && !record.setting.assumptions.length) errors.push('Conditional result requires assumptions');
  if (new Set(record.target.parameters.map(p => p.name)).size !== record.target.parameters.length) errors.push('Duplicate problem parameters');
  if (record.target.parameters.some(p => !p.domain)) errors.push('Problem parameters require domains');
  if (record.success.status !== 'not_applicable' && !record.success.review) errors.push('Success requires a scoped review');
  if (record.success.status === 'reported' && (!record.success.basis || record.success.value === null && !record.success.expression)) errors.push('Reported success requires its value or expression and basis');
  if (measured && record.success.status === 'reported') errors.push('A reported successful computation is not an overall success probability');
  if (record.target.input_class === 'almost_all_integers' && record.success.value !== null) errors.push('Input-density guarantee is not a per-input success probability');
  if ((record.field_conflicts?.length || Object.values(record.resources).some(r => r.status === 'conflict')) && record.assessment.claim_status !== 'source_conflict') errors.push('Unresolved conflict must retain its assessment');
  return errors;
}

module.exports = {goalLabels, sectionFor, problemResultErrors};

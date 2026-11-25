import {resultFixture} from './result-model-fixtures.mjs';

// Synthetic UI/comparison contracts only, not extracted AES attacks.
export function surfaceResult({surface = 'algorithmic', method = 'differential', structural = false, id, source} = {}) {
  const record = resultFixture({id: id ?? `synthetic-${surface.replaceAll('_', '-')}-${method}${structural ? '-property' : ''}`,
    source, goal: 'key_recovery', kind: 'key_recovery_attack'});
  delete record.experiment;
  record.title = `Synthetic ${surface} ${method}${structural ? ' property' : ' recovery'}`;
  record.display = {name: record.title, method};
  record.setting.key_model = 'single_secret_key';
  record.setting.attack_surface = surface;
  record.setting.oracle_access = ['chosen_plaintext_encryption'];
  record.techniques = ['synthetic-test-construction'];
  record.evidence[0].fields = ['/target', '/setting', '/resources', '/success', '/bound'];
  if (surface === 'side_channel') {
    record.setting.oracle_access.push('bytewise_power_difference_traces_of_round_3_SubBytes');
    record.techniques.push('synthetic-leakage-analysis');
  }
  if (surface === 'fault_injection') {
    record.setting.oracle_access.push('single-byte-state-fault-injection');
    record.setting.fault_model = {target: 'Synthetic fixture state', granularity: 'Synthetic one-byte fault', timing: 'Synthetic test boundary',
      location: 'Synthetic test location', value_control: 'Synthetic test value', sample_pairing: 'Synthetic correct/faulty pairs', evidence_scope: 'analytical'};
  }
  if (structural) {
    record.result_kind = 'structural_property'; record.goal = 'structural_property';
    record.property = {statement: 'Synthetic property, not a scientific claim.', quantifier: 'For synthetic fixture inputs.',
      scope: 'Synthetic test scope.', parameters: [], validation: {basis: 'analytical', description: 'Synthetic test statement.'}};
    record.success = {status: 'not_applicable', value: null, metric: 'synthetic-property', description: 'Not an attack.'};
    for (const key of Object.keys(record.resources)) record.resources[key] = {status: 'not_applicable', reported: null, log2: null,
      unit: null, qualifier: 'not_applicable', note: 'A synthetic property, not an attack cost.'};
    record.evidence[0].fields.push('/property');
  }
  return record;
}

export function quantumResult({queryModel = 'classically_known_pairs', memoryModel, ...options} = {}) {
  const record = surfaceResult({id: `synthetic-quantum-${queryModel.replaceAll('_', '-')}`, ...options});
  record.setting.computation = 'quantum';
  record.setting.quantum_model = {
    query_model: queryModel, ...(memoryModel ? {memory_model: memoryModel} : {}), cost_level: 'quantum_algorithm',
    gate_set: 'Synthetic abstract algorithm; no gate estimate.', routing: 'Synthetic routing is unspecified.',
    error_correction: 'Synthetic error correction is unspecified.', oracle_parallelism: 'Synthetic single-oracle accounting.',
    solution_assumption: 'Synthetic fixture solution assumption, not a research claim.',
  };
  record.setting.oracle_access = [queryModel === 'coherent_secret_oracle' ? 'coherent_secret_key_permutation_queries'
    : queryModel === 'offline_public_cipher_evaluation' ? 'offline_public_cipher_evaluation' : 'classical_chosen_plaintexts'];
  if (queryModel === 'offline_public_cipher_evaluation' && !options.structural) {
    record.setting.key_model = 'chosen_key_pair'; record.result_kind = 'collision_construction'; record.goal = 'key_collision';
  }
  for (const key of ['t_gates', 'clifford_gates', 't_depth', 'circuit_depth', 'logical_qubits']) record.resources[key] = {
    status: options.structural ? 'not_applicable' : 'not_reported', reported: null, log2: null, unit: null,
    qualifier: options.structural ? 'not_applicable' : 'unspecified', note: 'Synthetic fixture; no circuit-resource claim.',
  };
  return record;
}

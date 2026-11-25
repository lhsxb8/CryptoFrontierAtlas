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

// Synthetic contracts only. These are not paper extractions or claimed attacks.
export function experimentFixture({ partial = false, q = 2 } = {}) {
  return {
    construction: { type: 'compression_function', name: 'Synthetic Davies–Meyer', definition: 'F(h,m) = E_m(h) xor h (synthetic test definition)', output_bits: 128 },
    variables: [{ name: 'h', control: 'fixed', domain: '128-bit test strings', condition: 'The same test chaining value is used.' },
      { name: 'm', control: 'chosen', domain: '128-bit test strings', condition: 'The test messages are selected by the constructor.' }],
    relation: 'F(h,m_1) = F(h,m_2) (synthetic test relation)',
    output: partial ? { scope: 'partial', bits: 64, mask: 'low 64 bits' } : { scope: 'full', bits: 128, mask: null },
    parameters: [{ name: 'q', meaning: 'Synthetic output multiplicity', domain: 'q in {2,4}', value: q }],
    distinctness: 'Test executions are distinct and unordered executions are not reused.',
    reference: 'Synthetic ideal-cipher experiment with the same input-control constraints.', unresolved: [],
  };
}
export function resultFixture({ goal = 'compression_preimage', kind = 'preimage_attack', id = 'synthetic-model-control', source = 'synthetic-model-source', theorem = false, q = 2 } = {}) {
  const cost = { status: 'reported', reported: '2^8', log2: 8, unit: 'synthetic-operations', qualifier: 'exact', note: 'Synthetic accounting, not a literature value.' };
  const r = {
    schema_version: '0.11.0', id, title: 'Synthetic result-model extension control', display: { name: 'Synthetic model control', method: 'mitm' },
    result_kind: kind, goal,
    target: { variant_ids: ['aes-128'], rounds: 6, full_round: false, round_convention: 'synthetic-standard-rounds', description: 'Synthetic test target; this is not a reported AES result.' },
    setting: { key_model: 'chosen_key_pair', oracle_access: ['synthetic_public_evaluation'], related_key_count: null,
      key_relation: 'Synthetic chosen variables.', key_population: 'Synthetic fixture keys only.', plaintext_model: 'Synthetic fixture inputs only.',
      computation: 'classical', attack_surface: 'algorithmic', assumptions: ['Synthetic fixture, not a scientific claim.'] },
    techniques: ['synthetic-test-construction'], resources: Object.fromEntries(['time', 'data', 'memory', 'preprocessing'].map(d => [d, { ...cost }])),
    success: { status: 'reported', metric: 'synthetic fixture success', value: 1, description: 'Synthetic test probability, not a source claim.' }, bound: null,
    experiment: experimentFixture({ q }),
    evidence: [{ source_id: source, locator: 'Synthetic test fixture only', fields: ['/target', '/setting', '/resources', '/success', '/bound', '/experiment'], interpretation: 'Synthetic schema and software behavior test, not an attribution to the cited work.' }],
    assessment: { claim_status: 'author_reported', primary_text: 'checked', reproduction: 'not_attempted', reviewed_on: '2026-10-09', frontier_status: 'not_assessed' },
    limitations: ['Synthetic test-only data; never ingest into the scientific corpus.'], related_problem_ids: [],
  };
  if (theorem) {
    r.result_kind = 'theorem'; r.goal = 'characteristic_probability_bound';
    r.target.rounds = null; r.target.full_round = null;
    r.target.round_domain = { scope: 'round_function_extension', definition: 'Repeat the synthetic round function with independent round keys; not a claim about an extended AES key schedule.', variable: 'r', domain: 'integer r >= 3', minimum: 3, maximum: null, step: 1 };
    r.theorem = { statement: 'Synthetic characteristic probability bound for software testing.', quantifier: 'For every r in the declared synthetic domain.', metric: 'characteristic_probability', relation: '<=', expression: '2^(-8*r)',
      parameters: [{ name: 'r', meaning: 'Synthetic round variable', domain: 'integer r >= 3', value: null }], assumptions: ['Synthetic product model; not an AES theorem.'] };
    delete r.experiment;
    for (const d of Object.keys(r.resources)) r.resources[d] = { status: 'not_applicable', reported: null, log2: null, unit: null, qualifier: 'not_applicable', note: 'A theorem is not an attack-cost estimate.' };
    r.success = { status: 'not_applicable', metric: 'synthetic theorem', value: null, description: 'A theorem bound is not attack success.' };
    r.evidence[0].fields = ['/target', '/setting', '/resources', '/success', '/bound', '/theorem'];
  }
  return r;
}

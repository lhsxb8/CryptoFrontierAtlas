import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { resultFixture } from '../helpers/result-model-fixtures.mjs';

const require = createRequire(import.meta.url), base = '../../';
const json = file => JSON.parse(readFileSync(new URL(base + file, import.meta.url), 'utf8'));
const { taxonomy, semanticErrors, recordVersion, datasetVersion } = require(base + 'lib/cryptanalysis/result-model.cjs');
const { assertResultSemantics, assertTarget } = require(base + 'lib/node/cryptanalysis/result-semantics.cjs');
const { comparability, compareReportedCosts } = require(base + 'lib/cryptanalysis/compare.cjs');
const { validateCatalog, materializeEntry, groupingScope } = require(base + 'lib/node/cryptanalysis/result-families.cjs');
const { projections, sync } = require(base + 'lib/node/cryptanalysis/sync-result-model.cjs');
const Ajv = require('ajv/dist/2020'), ajv = new Ajv({ allErrors: true, strict: true });
require('ajv-formats')(ajv);
const schema = json('schemas/cryptanalysis/result.schema.json'), validate = ajv.compile(schema);
const compiled = await build({ entryPoints: [fileURLToPath(new URL('../../src/features/cryptanalysis/model.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm' });
const ui = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const valid = r => { assert(validate(r), ajv.errorsText(validate.errors)); assert.deepEqual(semanticErrors(r), []); };

test('taxonomy projections are deterministic and all schema/type/browser labels agree', () => {
  assert.equal(sync(), 0);
  assert.deepEqual(Object.keys(ui.goalLabels), schema.properties.goal.enum);
  assert.deepEqual(Object.keys(ui.kindLabels), schema.properties.result_kind.enum);
  assert.deepEqual(Object.keys(ui.methodLabels), schema.properties.display.properties.method.enum);
  assert.deepEqual(Object.keys(ui.surfaceLabels), schema.properties.setting.properties.attack_surface.enum);
  assert.deepEqual(projections(taxonomy, schema), projections(taxonomy, schema));
});

test('taxonomy typos and incompatible contracts are rejected before projections can be written', () => {
  const changes = [
    t => { t.goals.compression_preimage.requred = ['experiment']; },
    t => { t.goals.compression_preimage.kind = 'invented_kind'; },
    t => { t.goals.compression_preimage.required = ['invented_payload']; },
    t => { t.goals.compression_preimage.known_key = 'yes'; },
    t => { t.goals.compression_preimage.construction_type = 'invented_construction'; },
    t => { t.goals.compression_preimage.key_model = 'invented_key_model'; },
    t => { t.goals.characteristic_probability_bound.required = []; },
    t => { t.kinds.theorem.comparable = true; },
    t => { t.schema_versions.reverse(); },
  ];
  for (const change of changes) {
    const registry = structuredClone(taxonomy); change(registry);
    assert.throws(() => projections(registry, schema), /Invalid result taxonomy/);
  }
});

for (const [goal, def] of Object.entries(taxonomy.goals).filter(([,g]) => !g.legacy)) {
  test(`new target ${goal} validates without pretending to be key recovery`, () => {
    const r = resultFixture({ goal, kind: def.kind, theorem: def.kind === 'theorem' });
    r.goal = goal;
    if (def.metric) r.theorem.metric = def.metric;
    valid(r);
    assert.equal(r.schema_version, '0.11.0');
    assert.notEqual(r.goal, 'key_recovery');
  });
}

test('legacy records need no rewrite and mixed versions derive the newest actually used version', () => {
  const legacy = resultFixture({goal:'key_recovery', kind:'key_recovery_attack', id:'synthetic-legacy-recovery'});
  legacy.schema_version = '0.10.0';
  legacy.setting.key_model = 'single_secret_key';
  delete legacy.experiment;
  const before = JSON.stringify(legacy);
  valid(legacy);
  assert.equal(datasetVersion([legacy]), '0.10.0');
  assert.equal(datasetVersion([legacy, resultFixture()]), '0.11.0');
  assert.equal(JSON.stringify(legacy), before);
  const wrong = resultFixture(); wrong.schema_version = '0.10.0'; assert.equal(validate(wrong), false);
  assert.throws(() => datasetVersion([{ ...legacy, schema_version: '9.9.9' }]), /Unsupported/);
});

test('success profiles accept evidenced probability events without promoting them to overall recovery', () => {
  const r = resultFixture();
  r.success = { status: 'not_reported', metric: 'complete-master-key-recovery', value: null,
    description: 'Overall recovery is not quantified by the checked construction.',
    review: { status: 'not_quantified', reviewed_on: '2026-11-05', scope: 'Only a conditional false-candidate acceptance probability is quantified.' },
    components: [{ metric: 'conditional-wrong-subkey-acceptance', value: null, expression: '2^{-387.6}', relation: '<', basis: 'author_model', description: 'Conditional acceptance of one wrong multiset, not whole-key recovery.' }] };
  r.evidence.push({ ...r.evidence[0], fields: ['/success/components/0', '/success/review'] });
  valid(r);
  assert.equal(compareReportedCosts(r, r).relation, 'incomparable');
  for (const change of [s => { s.components[0].value = 1.1; }, s => { s.components[0].basis = 'invented'; }, s => { delete s.components[0].expression; }, s => { s.review.extra = 'unknown'; }]) {
    const wrong = structuredClone(r); change(wrong.success); assert.equal(validate(wrong), false);
  }
  const missing = structuredClone(r); missing.evidence.pop();
  assert(semanticErrors(missing).some(message => message.includes('Missing evidence for success component')));
  const duplicate = structuredClone(r); duplicate.success.components.push(duplicate.success.components[0]);
  assert(semanticErrors(duplicate).some(message => message.includes('Duplicate success component')));
});

test('a pending success audit cannot certify a fabricated numerical probability', () => {
  const r = resultFixture();
  r.success.review = { status: 'pending', reviewed_on: '2026-11-05', scope: 'The required extended-version success argument is not yet available.' };
  assert(semanticErrors(r).some(message => message.includes('Success review contradicts')));
  assert.equal(compareReportedCosts(r, r).relation, 'incomparable');
});

test('an evidenced disputed author probability may remain reported and pending, never comparable', () => {
  for (const basis of ['author_statement', 'author_model']) {
    const r = resultFixture();
    r.success.basis = basis;
    r.assessment.claim_status = 'source_conflict';
    r.success.review = { status: 'pending', reviewed_on: '2026-11-05', scope: 'The explicit author claim is transcribed; its probability argument remains disputed.' };
    const observation = { source_id: r.evidence[0].source_id, locator: 'Synthetic source probability paragraph', reported: 'Synthetic conflicting author model, not a literature claim.' };
    r.field_conflicts = [{ field: '/success', label: 'Synthetic probability dispute', description: 'The synthetic source probability argument is unresolved.', observations: [observation, { ...observation }] }];
    valid(r);
    const symbolic = structuredClone(r); symbolic.success.value = null; symbolic.success.expression = '1-2^{-8}'; valid(symbolic);
    for (const point of [r, symbolic]) {
      const comparison = compareReportedCosts(point, point);
      assert.equal(comparison.relation, 'incomparable');
      assert(comparison.reasons.includes('primary success probability is not verified'));
    }
    for (const change of [
      p => { delete p.field_conflicts; },
      p => { p.field_conflicts[0].field = '/resources/time'; },
      p => { p.field_conflicts[0].field = '/success/components/0'; },
      p => { p.field_conflicts[0].field = '/success/review'; },
      p => { p.evidence[0].fields = ['/success/components/0']; },
      p => { p.evidence[0].fields = ['/success/review']; },
      p => { delete p.success.basis; },
      p => { p.success.basis = 'source_proof'; },
      p => { p.success.basis = 'reported_experiment'; },
      p => { p.success.value = null; },
      p => { p.success.value = null; p.success.expression = ' '; },
      p => { p.success.review.status = 'not_quantified'; },
      p => { p.success.review.status = 'not_stated'; },
    ]) {
      const wrong = structuredClone(r); change(wrong);
      assert(semanticErrors(wrong).some(message => message.includes('Success review contradicts')));
    }
  }
});

test('unknown goals, malformed contracts and kind/goal mismatches fail closed', () => {
  for (const change of [r => { r.goal = 'invented_goal'; }, r => { r.result_kind = 'key_recovery_attack'; }, r => { delete r.experiment; }, r => { r.experiment.extra = 'unknown'; }, r => { r.experiment.construction.type = 'block_cipher'; }]) {
    const r = resultFixture(); change(r); assert.equal(validate(r), false);
  }
  const r = resultFixture(); r.goal = 'invented_goal';
  assert.equal(comparability(r, r).comparable, false);
});

test('cost comparison remains method-specific and isolates every experiment coordinate', () => {
  const seed = resultFixture(); valid(seed); assert.equal(compareReportedCosts(seed, seed).relation, 'equal');
  const changes = [
    r => { r.goal = 'compression_collision'; r.result_kind = 'collision_construction'; },
    r => { r.display.method = 'biclique'; }, r => { r.experiment.construction.name = 'Synthetic MMO'; },
    r => { r.experiment.construction.definition += ' changed'; }, r => { r.experiment.variables[0].control = 'chosen'; },
    r => { r.experiment.variables[0].condition += ' changed'; }, r => { r.experiment.output = { scope: 'partial', bits: 64, mask: 'low 64 bits' }; },
    r => { r.experiment.parameters[0].value = 4; }, r => { r.experiment.parameters[0].domain = 'q >= 2'; },
    r => { r.experiment.distinctness += ' changed'; }, r => { r.experiment.reference += ' changed'; },
  ];
  for (const change of changes) { const r = structuredClone(seed); change(r); valid(r); assert.equal(compareReportedCosts(seed, r).relation, 'incomparable'); }
  const partial = structuredClone(seed); partial.experiment.output = { scope: 'partial', bits: 64, mask: 'low 64 bits' };
  const other = structuredClone(partial); other.experiment.output.mask = 'high 64 bits'; valid(other);
  assert.equal(compareReportedCosts(partial, other).relation, 'incomparable');
});

test('source gaps and symbolic parameters are retained but never become comparable attack costs', () => {
  for (const change of [r => { r.experiment.reference = null; }, r => { r.experiment.distinctness = null; }, r => { r.experiment.parameters[0].value = null; }, r => { r.experiment.parameters[0].domain = null; }, r => { r.experiment.variables[0].control = 'not_reported'; }, r => { r.experiment.variables[0].condition = null; }, r => { r.experiment.output = { scope: 'partial', bits: null, mask: null }; }, r => { r.experiment.unresolved = ['Source definition remains missing.']; }]) {
    const r = resultFixture(); change(r); valid(r); assert.equal(compareReportedCosts(r, r).relation, 'incomparable');
  }
  for (const symbol of ['q', 'q+1', '2']) {
    const r = resultFixture(); r.experiment.parameters[0].value = symbol;
    valid(r); assert.equal(compareReportedCosts(r, r).relation, 'incomparable');
  }
});

test('semantic validation rejects inconsistent masks, duplicate variables and noninteger multiplicities', () => {
  for (const change of [r => { r.experiment.output.bits = 64; }, r => { r.experiment.output.mask = 'low 64 bits'; }, r => { r.experiment.variables.push(structuredClone(r.experiment.variables[0])); }, r => { r.experiment.parameters[0].value = 1.5; }]) {
    const r = resultFixture(); change(r); assert.throws(() => assertResultSemantics(r));
    assert.equal(compareReportedCosts(r, r).relation, 'incomparable');
  }
  const q = resultFixture({ goal: 'differential_q_multicollision', kind: 'multicollision_construction' });
  q.experiment.parameters = []; assert.throws(() => assertResultSemantics(q), /q parameter/);
});

test('round-domain theorems retain quantifiers and never enter attack-cost groups or full/reduced filters', () => {
  const r = resultFixture({ theorem: true }); valid(r); assertTarget(r, { full_rounds: 10 });
  assert.equal(ui.roundLabel(r), 'integer r >= 3'); assert.equal(ui.roundScopeLabel(r), 'Variable');
  assert.equal(ui.isCostResult(r), false); assert.deepEqual(ui.groupResults([r]).properties, [r]);
  assert.equal(compareReportedCosts(r, r).relation, 'incomparable');
  for (const scope of ['full', 'reduced']) assert.deepEqual(ui.filterResults([r], 'aes-128', new URLSearchParams({ scope })), []);
  assert.deepEqual(ui.filterResults([r], 'aes-128', new URLSearchParams({ scope: 'variable' })), [r]);
  const bad = structuredClone(r); bad.target.round_domain.maximum = 2; assert.throws(() => assertTarget(bad, { full_rounds: 10 }), /Reversed/);
  delete bad.target.round_domain; assert.equal(validate(bad), false);
  const attack = resultFixture(); attack.target = r.target; assert.equal(validate(attack), false);
  const numeric = structuredClone(r); numeric.resources.time = resultFixture().resources.time; assert.equal(validate(numeric), false);
});

test('registered round intervals respect instance bounds and quantified variables retain the same domain', () => {
  const r = resultFixture({ theorem: true });
  r.target.round_domain = { ...r.target.round_domain, scope: 'registered_instance', maximum: 10, domain: 'integer 3 <= r <= 10' };
  r.theorem.parameters[0].domain = r.target.round_domain.domain;
  valid(r); assertTarget(r, { full_rounds: 10 });
  assert.throws(() => assertTarget(r, { full_rounds: 8 }), /round domain exceeds/);
  r.target.round_domain.maximum = null;
  assert.throws(() => assertTarget(r, { full_rounds: 10 }), /finite bounds/);
  r.target.round_domain.scope = 'round_function_extension';
  r.theorem.parameters[0].domain = 'a conflicting synthetic domain';
  assert.throws(() => assertResultSemantics(r), /quantified/);
  r.theorem.parameters[0].domain = r.target.round_domain.domain;
  r.theorem.parameters[0].value = 3;
  assert.throws(() => assertResultSemantics(r), /quantified/);
  delete r.target.round_domain.definition; assert.equal(validate(r), false);
});

test('direct compact comparison resolves its method, while absent methods cannot certify equality', () => {
  const r = resultFixture(), compact = { ...r, method: r.display.method };
  delete compact.display;
  delete compact.assessment;
  assert.equal(compareReportedCosts(r, compact).relation, 'equal');
  assert.equal(compareReportedCosts(compact, r).relation, 'equal');
  delete compact.method;
  assert.equal(compareReportedCosts(compact, compact).relation, 'incomparable');
  compact.method = 'invented_method';
  assert.equal(compareReportedCosts(compact, compact).relation, 'incomparable');
});

test('raw and materialized compact conflicts use the same comparison boundary', () => {
  for (const markConflict of [
    entry => { entry.comparison = { relation: 'conflict' }; },
    entry => { entry.assessment = { claim_status: 'source_conflict' }; },
    entry => { entry.field_conflicts = [{ field: '/setting', description: 'Synthetic conflict' }]; },
    entry => { entry.resources.time.status = 'conflict'; },
  ]) {
    const record = resultFixture(), entry = { ...structuredClone(record), record_id: null, method: record.display.method };
    delete entry.display; delete entry.assessment;
    markConflict(entry);
    const materialized = materializeEntry(entry);
    for (const point of [entry, materialized]) {
      for (const pair of [[record, point], [point, record]]) {
        const comparison = compareReportedCosts(...pair);
        assert.equal(comparison.relation, 'incomparable');
        assert(comparison.reasons.includes('unresolved source conflict'));
      }
    }
  }
});

function familyFixture() {
  const points = [2, 4].map(q => resultFixture({ id: `synthetic-q-${q}`, goal: 'differential_q_multicollision', kind: 'multicollision_construction', q }));
  const family = { id: 'synthetic-q-family', title: 'Synthetic multicollision parameterization', construction: 'Synthetic shared construction only.', representation: 'formula', parameters: [{ name: 'q', meaning: 'Synthetic multiplicity', domain: 'q in {2,4}' }],
    points: points.map(p => ({ result_id: p.id, values: { q: p.experiment.parameters[0].value } })), evidence: [{ source_id: 'synthetic-model-source', locator: 'Synthetic test fixture only' }],
    model: { resources: { time: { expression: '2^q', unit: 'synthetic-operations' } }, constraints: ['q in {2,4}'], success: 'Synthetic success 1', accounting: 'Synthetic accounting only.' } };
  const catalog = { schema_version: 1, cipher_family_id: 'aes', reviewed_on: '2026-10-31', families: [family], standalone_result_ids: [], excluded_results: [] };
  return { points, family, catalog };
}
const validateFamily = ({points, catalog}) => validateCatalog(catalog, points, [{ id: 'synthetic-model-source' }], [{ id: 'aes-128', family: 'aes' }]);
test('q tuning points share a family only when its declared assignments bind the same q values', () => {
  const f = familyFixture(); assert.deepEqual(groupingScope(f.points[0]), groupingScope(f.points[1])); validateFamily(f);
  const bad = familyFixture(); bad.family.points[1].values.q = 2; assert.throws(() => validateFamily(bad), /assignment mismatch/);
  const undeclared = familyFixture(); undeclared.family.parameters[0].name = 'n'; for (const p of undeclared.family.points) p.values = { n: p.values.q };
  assert.throws(() => validateFamily(undeclared), /not declared/);
  const mask = familyFixture(); mask.points[1].experiment.output = { scope: 'partial', bits: 64, mask: 'low 64 bits' }; assert.throws(() => validateFamily(mask), /incompatible target/);
});

test('compact materialization preserves both new payloads and their inferred record version', () => {
  for (const record of [resultFixture(), resultFixture({ theorem: true })]) {
    const { schema_version, ...entry } = record; entry.record_id = null; entry.method = record.display.method;
    const compact = materializeEntry(entry); assert.equal(compact.schema_version, '0.11.0'); assert.equal(recordVersion(entry), '0.11.0');
    assert.deepEqual(compact.experiment, record.experiment); assert.deepEqual(compact.theorem, record.theorem);
  }
});

test('adding a compatible goal uses the same schema generator and comparator without new branches', () => {
  const extra = 'synthetic_compression_goal', extended = structuredClone(taxonomy);
  extended.goals[extra] = { ...extended.goals.compression_preimage, label: 'Synthetic extension control' };
  const projected = projections(extended, schema), check = ajv.compile(JSON.parse(projected.schema));
  const record = resultFixture({ goal: extra }); assert(check(record), ajv.errorsText(check.errors));
  assert(projected.typescript.includes(extra));
  const modelModule = { exports: {} };
  new Function('require', 'module', readFileSync(new URL(base + 'lib/cryptanalysis/result-model.cjs', import.meta.url), 'utf8'))(() => extended, modelModule);
  const comparisonModule = { exports: {} };
  new Function('require', 'module', readFileSync(new URL(base + 'lib/cryptanalysis/compare.cjs', import.meta.url), 'utf8'))(() => modelModule.exports, comparisonModule);
  assert.equal(comparisonModule.exports.compareReportedCosts(record, record).relation, 'equal');
  assert.deepEqual(modelModule.exports.semanticErrors(record), []);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, renameSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {build} from 'esbuild';
import {writeProblemFixture, problemResultFixture} from '../helpers/problem-analysis-fixtures.mjs';
import {resultFixture} from '../helpers/result-model-fixtures.mjs';

const require = createRequire(import.meta.url), root = resolve('.');
const {problemContract} = require('../../lib/node/cryptanalysis/problem-contract.cjs');
const {problemResultErrors, sectionFor} = require('../../lib/cryptanalysis/problem-results.cjs');
const {comparability, compareReportedCosts} = require('../../lib/cryptanalysis/compare.cjs');
const {validateDataset} = require('../../lib/node/cryptanalysis/check-data.cjs');
const {createPublicationPolicy} = require('../../lib/node/cryptanalysis/publication-policy.cjs');
const {exportPublishedDataset, validatePublishedDataset, checkExport} = require('../../lib/node/cryptanalysis/published.cjs');
const {loadDataset} = require('../../lib/node/cryptanalysis/dataset.cjs');
const Ajv = require('ajv/dist/2020'), ajv = new Ajv({strict: true, allowUnionTypes: true});
require('ajv-formats')(ajv); ajv.addKeyword('x-atlas-key-domain');
const valid = ajv.compile(problemContract(root, 'problem-result'));
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const json = v => JSON.stringify(v, null, 2) + '\n';
const edit = (file, fn) => {const v = read(file); fn(v); writeFileSync(file, json(v));};
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'atlas-problem-analysis-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  return {root, output: join(root, 'data/cryptanalysis-public'), ...writeProblemFixture(root)};
}

test('hard-problem results reuse resource, success and evidence contracts without cipher fields', () => {
  const r = problemResultFixture();
  assert(valid(r), ajv.errorsText(valid.errors)); assert.deepEqual(problemResultErrors(r), []);
  for (const mutate of [r => {r.target.rounds = 10;}, r => {r.setting.query_model = 'Q2';}, r => {r.target.problem_id = 'aes';},
    r => {r.resources.time.status = 'not_reported';}, r => {r.success.value = 1.1;}, r => {r.target.internal_note = 'Unapproved';}]) {
    const next = structuredClone(r); mutate(next); assert.equal(valid(next), false);
  }
});

test('disjunctive goals, oracle access, experiments and input-density success stay distinct', () => {
  for (const mutate of [r => {r.result_kind = 'supporting_result';}, r => {r.goal = 'large_order_or_factor';},
    r => {r.setting.model = 'oracle_assisted';}, r => {r.setting.computation = 'quantum';},
    r => {r.result_kind = 'computation_record';}, r => {r.target.input_class = 'almost_all_integers';},
    r => {r.success.review.status = 'pending';}, r => {r.target.parameters.push(r.target.parameters[0]);},
    r => {r.assessment.claim_status = 'author_reported'; r.resources.time.status = 'conflict';}]) {
    const r = problemResultFixture(); mutate(r); assert(problemResultErrors(r).length > 0);
  }
  const a = problemResultFixture(), q = structuredClone(a), c = structuredClone(a);
  q.setting.computation = 'quantum'; q.setting.model = 'quantum'; c.result_kind = 'computation_record';
  assert.deepEqual([a, q, c].map(sectionFor), ['classical', 'quantum', 'records']);
});

test('shared comparator dispatches by target and retains every resource and parameter coordinate', () => {
  const a = problemResultFixture(), b = problemResultFixture('synthetic-second-point'); b.resources.time.log2 = 11;
  assert.equal(compareReportedCosts(a, b).relation, 'a_dominates_reported_costs');
  assert.equal(compareReportedCosts(a, resultFixture()).relation, 'incomparable');
  for (const mutate of [b => {b.target.parameters[0].value = 'n';}, b => {b.target.input_class = 'balanced_semiprime';},
    b => {b.setting.assumptions.push('Different assumption.');}, b => {b.resources.time.unit = 'GPU-hours';},
    b => {b.resources.time.qualifier = 'lower_bound';}, b => {b.resources.energy = {...b.resources.time, unit: 'kWh'};},
    b => {b.resources.memory.log2 = null;}, b => {b.success.value = null; b.success.expression = '1-o(1)';}]) {
    const next = structuredClone(b); mutate(next); assert.equal(comparability(a, next).comparable, false);
  }
});

test('Node and bundled-browser comparison give identical hard-problem decisions', async () => {
  const bundle = await build({entryPoints: [join(root, 'lib/cryptanalysis/compare.cjs')], bundle: true, write: false, platform: 'browser', format: 'esm'});
  const browser = (await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))).default;
  const a = problemResultFixture(), b = structuredClone(a); b.target.parameters[0].value = 'n';
  assert.deepEqual(browser.compareReportedCosts(a, b), compareReportedCosts(a, b));
});

test('problem records, family parameters, provenance and counts round-trip without the private corpus', t => {
  const f = fixture(t); assert.equal(validateDataset(f.root).problemAnalyses[0].results.length, 1);
  const summary = exportPublishedDataset(f.root);
  assert.equal(summary.problem_records, 1); assert.equal(summary.hard_problems, 1);
  const publicCatalog = read(join(f.output, 'problem-analyses/integer-factorization.json'));
  assert.equal(publicCatalog.ingestion_batches, undefined);
  assert.equal(readdirSync(join(f.root, '.local/publication')).length, 0, 'Successful exports leave no rollback snapshots');
  checkExport(f.root);
  renameSync(f.directory, join(f.root, 'research-not-available'));
  const data = loadDataset(f.root, 'public');
  assert.deepEqual(data.problemAnalyses[0].results[0], f.problemRecord);
  assert.equal(data.results.length, 1, 'Existing symmetric results retain their own target model');
});

test('bad targets, family assignments, source links and missing receipt decisions fail scientific validation', t => {
  const f = fixture(t);
  for (const mutate of [c => {c.records.push('missing-result');}, c => {c.families[0].points[0].values.n = 33;},
    c => {c.standalone_result_ids.push(f.problemRecord.id);}, c => {c.ingestion_batches = [];},
    c => {c.coverage.source_ids = [];}, c => {c.reviewed_on = '2026-11-01';}]) {
    const next = structuredClone(f.problemCatalog); mutate(next); f.write('problem-analyses/integer-factorization.json', next);
    assert.throws(() => validateDataset(f.root));
  }
  f.write('problem-analyses/integer-factorization.json', f.problemCatalog);
  const receiptFile = join(f.directory, f.problemCatalog.ingestion_batches[0].provenance_receipt);
  edit(receiptFile, r => {r.decisions[0].result_ids = [];});
  assert.throws(() => validateDataset(f.root), /missing from receipt decisions/);
});

test('new unused nested problem fields need explicit publication classification', t => {
  const f = fixture(t), schema = join(f.root, 'schemas/cryptanalysis/problem-result.schema.json');
  exportPublishedDataset(f.root);
  edit(schema, s => {s.properties.target.properties.curator_note = {type: 'string'};});
  assert.doesNotThrow(() => validateDataset(f.root));
  assert.throws(() => createPublicationPolicy(f.root), /curator_note: unclassified/);
  assert.throws(() => exportPublishedDataset(f.root), /curator_note: unclassified/);
  assert.throws(() => validatePublishedDataset(f.root), /curator_note: unclassified/);
  const policy = join(f.root, 'schemas/cryptanalysis/publication-fields.json');
  edit(policy, p => {p.documents['problem-result'].internal.push('/target/curator_note');});
  f.problemRecord.target.curator_note = 'Synthetic internal research discussion';
  f.write(`problem-results/${f.problemRecord.id}.json`, f.problemRecord);
  exportPublishedDataset(f.root);
  assert.equal(validatePublishedDataset(f.root).data.problemAnalyses[0].results[0].target.curator_note, undefined);
  const name = `problem-results/${f.problemRecord.id}.json`, hash = s => createHash('sha256').update(s).digest('hex');
  edit(join(f.output, name), r => {r.target.curator_note = 'Synthetic internal research discussion';});
  edit(join(f.output, 'publication.json'), p => {p.files[name] = hash(readFileSync(join(f.output, name))); p.data_sha256 = hash(json(p.files));});
  assert.throws(() => validatePublishedDataset(f.root), /internal field in public data/);
});

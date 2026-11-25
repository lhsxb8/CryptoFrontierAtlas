import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {surfaceResult, quantumResult} from '../helpers/attack-surface-fixtures.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../..', import.meta.url));
const bundle = await build({stdin: {contents: "export * from './src/features/cryptanalysis/model'; export * from './src/features/cryptanalysis/quantum-model'; export * from './src/features/cryptanalysis/QuantumModelTags'; export * from './src/features/cryptanalysis/ResultSections';", resolveDir: root, loader: 'ts'},
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic'});
const compiled = {exports: {}};
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, compiled, compiled.exports);
const ui = compiled.exports;
const {compareReportedCosts, comparability} = require('../../lib/cryptanalysis/compare.cjs');
const {groupingScope} = require('../../lib/cryptanalysis/result-families.cjs');
const tags = record => ui.quantumModelTags(record).map(tag => tag.label);
const q1 = quantumResult({memoryModel: 'qram'});
const q2 = quantumResult({queryModel: 'coherent_secret_oracle', memoryModel: 'qraqm'});
const offline = quantumResult({queryModel: 'offline_public_cipher_evaluation', memoryModel: 'qram'});
const points = [surfaceResult(), q1, q2, offline];

test('quantum fixtures and optional memory models obey the shared scientific contract', () => {
  const Ajv = require('ajv/dist/2020'); const ajv = new Ajv({allErrors: true, strict: true});
  require('ajv-formats')(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(new URL('../../schemas/cryptanalysis/result.schema.json', import.meta.url))));
  const {semanticErrors} = require('../../lib/cryptanalysis/result-model.cjs');
  for (const record of [...points, quantumResult(), quantumResult({memoryModel: 'no_qram'}), quantumResult({structural: true})]) {
    assert(validate(record), ajv.errorsText(validate.errors)); assert.deepEqual(semanticErrors(record), []);
  }
  const invalid = structuredClone(q1); invalid.setting.quantum_model.memory_model = 'guessed-from-title';
  assert.equal(validate(invalid), false);
});

test('classical results are separated while Q1, Q2 and public functions share a quantum method table', () => {
  const before = JSON.stringify(points);
  const sections = ui.resultSections(ui.resultFamilyViews(points));
  assert.deepEqual(sections.map(section => section.id), ['algorithmic-differential', 'quantum-differential']);
  assert.deepEqual(sections[1].rows.map(row => row.view.records[0].id).sort(), [q1.id, q2.id, offline.id].sort());
  assert.deepEqual(sections.flatMap(s => s.rows.flatMap(row => row.view.records.map(r => r.id))).sort(), points.map(r => r.id).sort());
  assert.equal(JSON.stringify(points), before);
});

test('malformed mixed-model display families cannot merge settings or move physical attacks', () => {
  const side = quantumResult({surface: 'side_channel', id: 'synthetic-quantum-leakage'});
  const physicalClassical = surfaceResult({surface: 'side_channel'});
  const records = [...points, side, physicalClassical];
  const views = [{id: 'synthetic-malformed-family', family: {id: 'synthetic-malformed-family', points: records.map(r => ({result_id: r.id, values: {}}))}, records, configurationCount: records.length}];
  const sections = ui.resultSections(views);
  assert.equal(sections.find(s => s.rows.some(row => row.id === side.id)).collection, 'side_channel');
  assert.equal(sections.filter(s => s.collection === 'side_channel').length, 2);
  assert(sections.every(s => new Set(s.rows.flatMap(row => row.view.records.map(r => r.setting.computation))).size === 1));
  assert(sections.every(s => s.rows.every(row => row.view.records.length === 1)));
});

test('badges use only structured query and memory fields, never IDs, prose or units', () => {
  assert.deepEqual(tags(q1), ['Q1', 'qRAM']);
  assert.deepEqual(tags(q2), ['Q2', 'QRAQM']);
  assert.deepEqual(tags(offline), ['Public function', 'qRAM']);
  assert.deepEqual(tags(quantumResult({memoryModel: 'no_qram'})), ['Q1', 'No qRAM']);
  const unspecified = quantumResult(); unspecified.title = 'Q2 qRAM QRAQM'; unspecified.id = 'synthetic-q2-qram';
  unspecified.setting.assumptions = ['No qRAM. This text must not grant any model badge.'];
  unspecified.resources.memory.unit = 'qraqm-table-entries';
  assert.deepEqual(tags(unspecified), ['Q1']);
  assert.deepEqual(tags(surfaceResult()), []);
});

test('colored model tags retain text and explanations, including a distinct no-qRAM badge', () => {
  for (const record of [q1, q2, offline, quantumResult({memoryModel: 'no_qram'})]) {
    const html = renderToStaticMarkup(createElement(ui.QuantumModelTags, {record}));
    for (const tag of ui.quantumModelTags(record)) {
      assert(html.includes(`data-model-tag="${tag.id}"`)); assert(html.includes(`>${tag.label}</span>`));
      assert(html.includes('title='));
    }
    if (record.setting.quantum_model.memory_model === 'no_qram') assert(!html.includes('data-model-tag="qram"'));
  }
});

test('query tags are searchable even when the ID and prose contain no Q1/Q2 aliases', () => {
  const one = structuredClone(q1); one.id = 'synthetic-first'; one.title = 'First synthetic point';
  const two = structuredClone(q2); two.id = 'synthetic-second'; two.title = 'Second synthetic point';
  assert.deepEqual(ui.filterResults([one, two], 'aes-128', new URLSearchParams('q=Q1')).map(r => r.id), [one.id]);
  assert.deepEqual(ui.filterResults([one, two], 'aes-128', new URLSearchParams('q=Q2')).map(r => r.id), [two.id]);
});

test('query and memory model differences remain incomparable despite sharing one table', () => {
  for (const change of [r => {r.setting.quantum_model.query_model = 'coherent_secret_oracle';}, r => {r.setting.quantum_model.memory_model = 'no_qram';}]) {
    const other = structuredClone(q1); other.id = 'synthetic-other'; change(other);
    assert.equal(comparability(q1, other).comparable, false);
    assert(comparability(q1, other).reasons.includes('different setting or assumptions'));
    assert.equal(compareReportedCosts(q1, other).relation, 'incomparable');
    assert.notDeepEqual(groupingScope(q1), groupingScope(other));
  }
});

test('the page has one quantum heading, no Q1/Q2 subheadings or tabs, and unique DOM IDs', () => {
  const html = renderToStaticMarkup(createElement(ui.ResultSections, {views: ui.resultFamilyViews([...points, quantumResult({structural: true, id: 'synthetic-quantum-property'})]),
    sources: [], variant: {id: 'aes-128', name: 'AES-128'}, params: new URLSearchParams(), selected: [], onToggle() {}, renderStructural: () => 'Synthetic property'}));
  assert.equal((html.match(/<h3 class="a-surface-heading">Quantum cryptanalysis<\/h3>/g) ?? []).length, 1);
  assert(html.includes('data-section-id="quantum-structural"'));
  assert.doesNotMatch(html, /role="tab|<h[1-6][^>]*>Q[12]</);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
});

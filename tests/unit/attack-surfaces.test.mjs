import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {surfaceResult} from '../helpers/attack-surface-fixtures.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../..', import.meta.url));
const bundled = await build({stdin: {contents: "export * from './src/features/cryptanalysis/model'; export * from './src/features/cryptanalysis/ResultSections'; export * from './src/features/cryptanalysis/presentation'; export * from './src/features/cryptanalysis/AttackTable';", resolveDir: root, loader: 'ts'},
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic'});
const compiled = {exports: {}};
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, compiled, compiled.exports);
const ui = compiled.exports;
const {compareReportedCosts, comparability} = require('../../lib/cryptanalysis/compare.cjs');
const {groupingScope} = require('../../lib/cryptanalysis/result-families.cjs');
const params = value => new URLSearchParams(value);
const records = ui.attackSurfaces.flatMap(surface => [surfaceResult({surface}), surfaceResult({surface, structural: true})]);
const props = {sources: [], variant: {id: 'aes-128', family: 'aes', key_bits: 128, block_bits: 128, full_rounds: 10},
  params: params(), selected: [], onToggle() {}, renderStructural: () => 'Synthetic property'};
const render = (component, values) => renderToStaticMarkup(createElement(component, values));

test('synthetic surface fixtures obey the scientific schema and semantic contracts', () => {
  const Ajv = require('ajv/dist/2020');
  const ajv = new Ajv({allErrors: true, strict: true});
  require('ajv-formats')(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(new URL('../../schemas/cryptanalysis/result.schema.json', import.meta.url), 'utf8')));
  const {semanticErrors} = require('../../lib/cryptanalysis/result-model.cjs');
  for (const record of [...records, surfaceResult({surface: 'side_channel', method: 'collision'}), surfaceResult({surface: 'fault_injection', method: 'fault'})]) {
    assert(validate(record), `${record.id}: ${ajv.errorsText(validate.errors)}`);
    assert.deepEqual(semanticErrors(record), [], record.id);
  }
});

test('the unified page covers the taxonomy and discards retired surface URL state', () => {
  assert.deepEqual([...ui.attackSurfaces].sort(), Object.keys(ui.surfaceLabels).sort());
  const query = params({method: 'differential'});
  assert.equal(ui.filterResults(records, 'aes-128', ui.resultPageParams(query)).length, 6);
  assert.equal(query.has('attack_surface'), false);
  for (const surface of [...ui.attackSurfaces, 'all', 'unknown', '']) {
    const legacy = params({attack_surface: surface});
    const normalized = ui.resultPageParams(legacy);
    assert.equal(normalized.has('attack_surface'), false);
    assert.equal(ui.filterResults(records, 'aes-128', normalized).length, 6);
    assert.equal(legacy.get('attack_surface'), surface);
  }
  assert.equal(ui.filterResults(records, 'aes-128', params('attack_surface=side_channel')).length, 2, 'Research tools retain explicit surface filtering');
  assert.deepEqual(ui.filterResults(records, 'aes-128', params('attack_surface=unknown')), []);
});

test('same-method attacks and supporting properties are partitioned by surface exactly once', () => {
  const before = JSON.stringify(records);
  const sections = ui.resultSections(ui.resultFamilyViews(records));
  assert.deepEqual(sections.map(section => section.id), ui.attackSurfaces.flatMap(surface => [`${surface}-differential`, `${surface}-structural`]));
  assert.deepEqual(sections.flatMap(section => section.rows.flatMap(row => row.view.records.map(r => r.id))).sort(), records.map(r => r.id).sort());
  for (const section of sections) for (const row of section.rows) for (const record of row.view.records) {
    assert.equal(section.surface, record.setting.attack_surface);
    assert.equal(section.structural, !ui.isCostResult(record));
  }
  assert.equal(JSON.stringify(records), before);
});

test('a future fault method cannot escape its surface, even under a malformed cross-surface display family', () => {
  const points = records.filter(ui.isCostResult);
  const views = [{id: 'synthetic-family', family: {id: 'synthetic-family', points: points.map(r => ({result_id: r.id, values: {}}))}, records: points, configurationCount: 3}];
  const sections = ui.resultSections(views);
  assert.deepEqual(sections.map(section => section.surface), [...ui.attackSurfaces]);
  assert(sections.every(section => section.rows.every(row => row.view.records.length === 1)));
  const fault = surfaceResult({surface: 'fault_injection', method: 'algebraic'});
  assert.equal(ui.resultSections(ui.resultFamilyViews([fault]))[0].id, 'fault_injection-algebraic');
});

test('normalizing legacy tab state preserves all other query entries without mutating the input', () => {
  const input = params({attack_surface: 'side_channel', method: 'collision', technique: 'synthetic-leakage-analysis',
    oracle: 'bytewise_power_difference_traces_of_round_3_SubBytes', q: 'synthetic', rounds: '6', goal: 'key_recovery', ids: 'keep-me', variant: 'aes-128', page: '3', sort: 'title'});
  input.append('attack_surface', 'algorithmic');
  const before = input.toString();
  const next = ui.resultPageParams(input);
  assert.deepEqual([...next], [...input].filter(([key]) => key !== 'attack_surface'));
  assert.equal(input.toString(), before);
  assert.equal(ui.resultPageParams(next).toString(), next.toString());
});

test('clearing filters restores the unified page and keeps sort and selected comparison context', () => {
  const initial = params({attack_surface: 'side_channel', q: 'missing', method: 'differential', page: '4', ids: 'a,b', variant: 'aes-128', sort: 'title'});
  const next = ui.clearResultFilters(initial);
  assert.deepEqual(Object.fromEntries(next), {ids: 'a,b', variant: 'aes-128', sort: 'title'});
  assert.equal(ui.clearResultFilters(params()).size, 0);
  assert.equal(ui.clearResultFilters(params('attack_surface=all')).size, 0);
});

test('normalized detail and comparison links keep their selection and search without a surface mode', () => {
  const side = records.find(r => r.setting.attack_surface === 'side_channel' && ui.isCostResult(r));
  const raw = params({variant: 'aes-128', q: side.id, attack_surface: 'side_channel'});
  const normalized = ui.resultPageParams(raw);
  const link = ui.comparisonHref('aes-128', [side.id], normalized);
  assert.deepEqual(Object.fromEntries(params(link.split('?')[1])), {variant: 'aes-128', q: side.id, ids: side.id});
  const detail = ui.resultHref(side.id, normalized);
  assert.deepEqual(Object.fromEntries(params(detail.split('?')[1])), {variant: 'aes-128', q: side.id});
  assert.deepEqual(Object.fromEntries(ui.switchInstanceParams(normalized)), {q: side.id});
  assert.equal(raw.get('attack_surface'), 'side_channel');
});

test('method filters span all surfaces and exact IDs are directly discoverable', () => {
  const side = records.find(r => r.setting.attack_surface === 'side_channel' && ui.isCostResult(r));
  assert.deepEqual(ui.filterResults(records, 'aes-128', ui.resultPageParams(params({q: side.id}))), [side]);
  assert.deepEqual(ui.filterResults(records, 'aes-128', ui.resultPageParams(params({q: side.id, attack_surface: 'algorithmic'}))), [side]);
  assert.deepEqual(ui.filterResults(records, 'other-instance', params()), []);
  assert.equal(ui.filterResults(records, 'aes-128', params('method=differential')).length, records.length);
});

test('surface-qualified names are display-only and recovery width requires an exact recorded event', () => {
  assert.equal(ui.methodLabel('differential', 'algorithmic'), 'Differential');
  assert.equal(ui.methodLabel('differential', 'side_channel'), 'Side-channel-assisted differential');
  assert.equal(ui.methodLabel('collision', 'side_channel'), 'Collision-based side-channel analysis');
  const side = surfaceResult({surface: 'side_channel'});
  side.display.name = side.id;
  side.techniques.push('see-in-the-middle');
  side.goal = 'partial_key_recovery'; side.success.metric = 'partial16-bit-master-key-recovery-probability';
  side.success.status = 'not_reported'; side.success.value = null;
  const before = JSON.stringify(side);
  assert.equal(ui.attackName(ui.resultFamilyViews([side])[0]), 'See-in-the-Middle (SITM)');
  assert.equal(ui.recoveryScopeLabel(side), '16 master-key bits');
  const html = render(ui.AttackTable, {...props, views: ui.resultFamilyViews([side])});
  assert.match(html, /Partial key recovery/); assert.match(html, /16 master-key bits/); assert.match(html, /Power leakage/);
  assert.equal(JSON.stringify(side), before);
  side.success.metric = 'unknown-partial-event'; assert.equal(ui.recoveryScopeLabel(side), undefined);
  side.success.metric = 'source-simulation-byte-recovery'; assert.equal(ui.recoveryScopeLabel(side), '1 subkey byte');
  side.goal = 'key_recovery'; assert.equal(ui.recoveryScopeLabel(side), undefined);
});

test('all-surface markup has independent controls and structural sections with unique IDs', () => {
  const sections = ui.resultSections(ui.resultFamilyViews(records));
  const html = render(ui.ResultSections, {...props, views: ui.resultFamilyViews(records)});
  for (const surface of ui.attackSurfaces) assert.ok(html.includes(`data-attack-surface="${surface}"`));
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const section of sections) {
    assert.ok(html.includes(`id="result-section-body-${section.id}"`));
    assert.ok(html.includes(`aria-controls="result-section-body-${section.id}"`));
  }
  assert.equal((html.match(/class="a-result-section-toggle" aria-expanded="false"/g) ?? []).length, 6);
  assert.equal((html.match(/class="a-surface-heading"/g) ?? []).length, 3);
});

test('a filtered single-surface page keeps its ordinary heading and nested method heading', () => {
  const side = records.filter(r => r.setting.attack_surface === 'side_channel');
  const html = render(ui.ResultSections, {...props, views: ui.resultFamilyViews(side)});
  assert.match(html, /<h3 class="a-surface-heading">Side-channel analysis<\/h3>/);
  assert.match(html, /<h4 class="a-result-section-heading"/);
  assert.doesNotMatch(html, /role="tab|aria-label="Attack surface"|a-surface-nav/);
});

test('changing only attack surface blocks cost dominance and separates scientific families', () => {
  const a = surfaceResult();
  assert.equal(comparability(a, a).comparable, true);
  const b = structuredClone(a); b.id = 'synthetic-other-surface'; b.setting.attack_surface = 'side_channel';
  assert.deepEqual(comparability(a, b), {comparable: false, reasons: ['different setting or assumptions']});
  assert.equal(compareReportedCosts(a, b).relation, 'incomparable');
  assert.notDeepEqual(groupingScope(a), groupingScope(b));
});

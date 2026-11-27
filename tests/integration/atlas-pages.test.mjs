import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resultFixture } from '../helpers/result-model-fixtures.mjs';
import { catalogFixture, asymmetricCatalogFixture, hardProblemCatalogFixture } from '../helpers/primitive-catalog-fixtures.mjs';
import { surfaceResult } from '../helpers/attack-surface-fixtures.mjs';
import {standardizationFixture} from '../helpers/standardization-fixtures.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Entirely synthetic rendering data. No production corpus is read or changed.
const ciphers = [
  { id: 'aes', name: 'AES', primitive_type: 'block_cipher', aliases: [], description: 'Synthetic AES directory fixture.' },
  { id: 'test-cipher', name: 'Test Cipher', primitive_type: 'block_cipher', aliases: ['Temporary family'], description: 'Synthetic second family for rendering regressions.' },
  { id: 'empty-family', name: 'Empty fixture family', primitive_type: 'block_cipher', aliases: [], description: 'Synthetic family without registered instances.' },
];
const variants = [
  { id: 'aes-128', family: 'aes', key_bits: 128, block_bits: 128, full_rounds: 10, specification_source: 'aes-fixture-source' },
  { id: 'test-cipher-20', family: 'test-cipher', name: 'Test Cipher 20', key_bits: 128, block_bits: 128, full_rounds: 20, specification_source: 'test-fixture-source' },
  { id: 'test-cipher-24', family: 'test-cipher', name: 'Test Cipher 24', key_bits: 256, block_bits: 128, full_rounds: 24, specification_source: 'test-fixture-source' },
];
const sources = ['aes-fixture-source', 'test-fixture-source'].map(id => ({
  id, title: `Synthetic source ${id}`, year: 2026,
  authors: id === 'aes-fixture-source' ? ['Alice Author'] : ['Tara Test', 'Fay Fixture', 'Ada Author', 'Ben Example', 'Cora Sample', 'Dan Model'],
  citation_label: id === 'aes-fixture-source' ? 'Aut26' : 'TFA+26',
  publication: { venue: 'FixtureConf', year: 2026, kind: 'conference', url: 'https://example.invalid/publication' },
  inspected_version: 'Synthetic fixture, not a literature claim', url: 'https://example.invalid/fixture',
  accessed_on: '2026-10-09', content_sha256: null, hash_note: 'Synthetic source without an artifact', locators: [],
}));
function result(id, title, variantIds, rounds, sourceId) {
  const resource = { status: 'reported', reported: '2^5', log2: 5, unit: 'fixture-operation', qualifier: 'estimate', note: 'Synthetic resource for rendering only.' };
  const names = { 'aes-only-fixture': 'Original-family fixture recovery', 'twenty-round-fixture': 'Default-instance fixture recovery', 'sibling-only-fixture': 'Sibling-only fixture recovery', 'shared-fixture': 'Shared fixture recovery' };
  return {
    schema_version: '0.10.0', id, title, display: { name: names[id] ?? title, method: 'mitm' }, result_kind: 'key_recovery_attack', goal: 'key_recovery',
    target: { variant_ids: variantIds, rounds, full_round: variantIds.every(id => variants.find(variant => variant.id === id).full_rounds === rounds), round_convention: 'fixture-rounds', description: 'Synthetic target for component rendering.' },
    setting: { key_model: 'single_secret_key', oracle_access: ['chosen_plaintext'], related_key_count: null,
      key_relation: 'One synthetic key', key_population: 'Synthetic fixture keys', plaintext_model: 'Synthetic chosen input',
      computation: 'classical', attack_surface: 'algorithmic', assumptions: ['Rendering fixture; no scientific result is asserted.'] },
    techniques: ['meet-in-the-middle'],
    resources: Object.fromEntries(['time', 'data', 'memory', 'preprocessing'].map(dimension => [dimension, { ...resource }])),
    success: { status: 'not_reported', metric: 'fixture success', value: null, description: 'Not a scientific claim.' },
    bound: null, evidence: [{ source_id: sourceId, locator: 'Synthetic fixture', fields: ['/target', '/setting', '/resources', '/success', '/bound'], interpretation: 'Fixture only.' }],
    assessment: { claim_status: 'author_reported', primary_text: 'checked', reproduction: 'not_attempted', reviewed_on: '2026-10-09', frontier_status: 'not_assessed' },
    limitations: ['Rendering fixture only.'], related_problem_ids: [],
  };
}
const results = [
  result('aes-only-fixture', 'AES-only fixture result', ['aes-128'], 10, 'aes-fixture-source'),
  result('twenty-round-fixture', 'Twenty-round fixture result', ['test-cipher-20'], 20, 'test-fixture-source'),
  result('sibling-only-fixture', 'Sibling-only fixture result', ['test-cipher-24'], 24, 'test-fixture-source'),
  result('shared-fixture', 'Shared fixture result', ['test-cipher-20', 'test-cipher-24'], 10, 'test-fixture-source'),
];
// Repeated locators do not turn one cited work into repeated name labels.
results[1].evidence.push({ ...results[1].evidence[0], locator: 'Second synthetic locator' });
const coverage = {
  reviewed_on: '2026-10-09', family_ids: ['aes'], coverage_kind: 'synthetic-audit', exhaustive: false,
  latest_or_best_known_claim: false, selection: 'AES audit selection sentinel', included_counts: { other_key_recovery: 1 },
  queries_used: [], review_process: { extraction: 'AES review process sentinel' },
  issues: [{ id: 'aes-issue-fixture', status: 'needs_review', affected_records: ['aes-only-fixture'], evidence: ['AES issue evidence sentinel'], action: 'AES issue action sentinel' }],
  pending_sources: [{ id: 'aes-pending-fixture', status: 'pending', url: 'https://example.invalid/pending', reason: 'AES pending literature sentinel' }],
  not_yet_covered: ['AES coverage gap sentinel'],
  publication: { remote_upload_performed: false, existing_open_question_records_modified: false, formal_proof_system_used: false },
  ingestion_batches: [{ id: 'aes-batch-fixture', reviewed_on: '2026-10-09', new_record_count: 1, new_records: ['aes-only-fixture'], indexed_existing_records: [], added_source_ids: ['aes-fixture-source'], audit_report: 'fixture.md', note: 'AES ingestion batch sentinel' }],
};
const analysisManifest = {
  dataset_version: '0.10.0', schema_version: '0.10.0', reviewed_on: '2026-10-09', local_only: true,
  record_count: results.length, source_count: sources.length, scope: 'Rendering fixture', verification_scope: 'AES verification scope sentinel', records: results.map(result => result.id),
};
const fixture = { analysisEnabled: true, ciphers, variants, results, resultPoints: results, familyCatalogs: [], problemAnalyses: [], sources, coverage, analysisManifest };

// Bundle the actual pages and their actual model/components. Only the data
// boundary and inert CSS imports are replaced; there are no mock page views.
const componentProviders = new WeakMap();
async function bundleFixture(fixture) {
  const catalog = fixture.publicCatalog ?? {
    schema_version: 4, hard_problems: [], problem_sources: [], categories: [{id: 'block_cipher', domain: 'symmetric', en: 'Block Ciphers', zh: '分组密码'}],
    specifications: [{id: 'fixture-specification', title: 'Synthetic specification', edition: 'Fixture edition', url: 'https://example.invalid/spec', status: 'published', status_note: 'Synthetic fixture.', checked_on: '2026-01-01'}],
    primitives: fixture.ciphers.map(c => ({id: c.id, name: c.name, category: c.primitive_type, aliases: c.aliases, description: c.description, specification_ids: ['fixture-specification'], uses: []})),
    instances: fixture.variants.map(v => ({id: v.id, family_id: v.family, name: v.name ?? v.id.toUpperCase(), specification_ids: ['fixture-specification'], locator: 'Synthetic location', parameters: {type: 'block_cipher', key_bits: v.key_bits, block_bits: v.block_bits, rounds: v.full_rounds}})),
  };
  const bundled = await build({
    absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    loader: {'.webp': 'dataurl'},
    define: {'import.meta.env.BASE_URL': JSON.stringify('./')},
    stdin: {
      contents: "export { PortalPage, CipherDirectory, SourcesPage, CoveragePage, PlannedCollection } from './src/app/atlas/pages'; export { HardProblemPage } from './src/features/primitives/HardProblemPage'; export { titleCaseLabel } from './src/app/interface-labels'; export { routeScopeParams } from './src/app/atlas/model'; export { PrimitivePage, PrimitiveDirectory } from './src/features/primitives/pages'; export { directoryEntries, directoryRoutes, parameterRows } from './src/features/primitives/model'; export { parseHash } from './src/app/atlas/model'; export { CitationLabel, ResultsPage, ResultDetail, ComparePage } from './src/features/cryptanalysis'; export { LocaleProvider } from './src/app/locale';",
      resolveDir: root, sourcefile: 'atlas-page-fixture.ts', loader: 'ts',
    },
    plugins: [{
      name: 'synthetic-page-data',
      setup(builder) {
        builder.onResolve({ filter: /(?:^|\/)data$/ }, args => ({
          path: args.path.includes('primitives') || args.path === './data' && args.importer.includes('/primitives/') ? 'primitives'
            : args.path.includes('cryptanalysis') || args.path === './data' && args.importer.includes('/cryptanalysis/') ? 'analysis' : 'questions', namespace: 'fixture',
        }));
        builder.onResolve({ filter: /\.css$/ }, () => ({ path: 'styles', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
          loader: 'js',
          contents: path === 'analysis'
            ? `const fixture = ${JSON.stringify(fixture)}; export const { analysisEnabled, ciphers, variants, results, resultPoints, familyCatalogs, problemAnalyses, sources, coverage, analysisManifest } = fixture;
               export function comparability() { throw new Error('Unexpected comparison in a page-rendering fixture'); }
               export function compareReportedCosts() { throw new Error('Unexpected comparison in a page-rendering fixture'); }`
            : path === 'primitives' ? `export const primitiveCatalog = ${JSON.stringify(catalog)}; export const releaseMetadata = {application_version: '1.0.0', data_revision: '${'a'.repeat(64)}'}; export const primitiveStructures = ${JSON.stringify(fixture.structures ?? {registry: {diagrams: []}, manifest: {assets: []}})};`
              : path === 'questions' ? 'export const problems = [];' : '',
        }));
      },
    }],
  });
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
  for (const value of Object.values(compiled.exports)) if (typeof value === 'function') componentProviders.set(value, compiled.exports.LocaleProvider);
  return compiled.exports;
}
const { CitationLabel, CipherDirectory, ResultsPage, ResultDetail, CoveragePage, LocaleProvider } = await bundleFixture(fixture);
const specialVariants = [
  { ...variants[0], id: 'aes-128-secret-sbox', name: 'AES-128 with secret S-box' },
  { ...variants[0], id: 'aes-ind-8r', name: 'AES-IND (8 rounds, independent round keys)', key_bits: 1152, full_rounds: 8 },
];
const specialResult = { ...results[0], id: 'special-aes-fixture', title: 'Special AES fixture attack', display: { name: 'Special AES fixture attack', method: 'mitm' }, target: { ...results[0].target, variant_ids: [specialVariants[0].id] } };
const groupedPages = await bundleFixture({ ...fixture,
  variants: [...variants, ...[192, 256].map(bits => ({ ...variants[0], id: `aes-${bits}`, key_bits: bits, full_rounds: bits === 192 ? 12 : 14 })), ...specialVariants],
  results: [...results, specialResult], resultPoints: [...results, specialResult],
});
const render = (Component, props = {}) => renderToStaticMarkup(createElement(componentProviders.get(Component) ?? LocaleProvider, {initialLocale: 'en'}, createElement(Component, { searchParams: new URLSearchParams(), onParamsChange() {}, ...props })));
const plainText = html => html.replace(/<[^>]*>/g, '');
const recordRow = (html, id) => html.match(new RegExp(`<tr[^>]*data-record-id="${id}"[^>]*>([\\s\\S]*?)<\\/tr>`))?.[1];
const noLedger = html => {
  assert.match(html, /No Audit Ledger for This Scope/);
  assert.doesNotMatch(html, /AES (?:audit selection|review process|issue evidence|issue action|pending literature|coverage gap|ingestion batch|verification scope) sentinel/);
  assert.doesNotMatch(html, /Ledger Totals/);
};

test('standard badges, source disclosure, partial coverage and priority agree across directory and instance pages', async () => {
  const publicCatalog = standardizationFixture();
  // Put the unverified family first to exercise sorting even in small directories.
  publicCatalog.primitives = [...publicCatalog.primitives].reverse();
  const pages = await bundleFixture({...fixture, ciphers: [], variants: [], results: [], resultPoints: [], publicCatalog});
  const html = render(pages.PrimitiveDirectory);
  assert.match(html, /data-standard-kind="international"/);
  assert.match(html, /aria-label="International Standard: Synthetic International Standard; covers 1\/2 instances"/);
  assert.match(html, /data-standard-kind="recommendation"/);
  assert.match(html, /data-standard-kind="historical"/);
  assert.match(html, /aria-label="Withdrawn Standard: Synthetic Withdrawn Standard"/);
  for (const badge of html.matchAll(/<span class="atlas-standard-badge [^>]*>([\s\S]*?)<\/span>/g)) {
    assert.match(badge[0], /role="img"/);
    assert.match(badge[1], /<svg /);
    assert.equal(plainText(badge[1]), '');
  }
  for (const card of html.matchAll(/<a class="atlas-family-card"[^>]*>([\s\S]*?)<\/a>/g)) assert.doesNotMatch(card[1], /<a /);
  const family = render(pages.PrimitivePage, {cipherId: 'fixture-block'});
  assert(family.indexOf('>Fixture Block 128</a>') < family.indexOf('>Fixture Block 256</a>'));
  assert.match(family, /Standardization Evidence/);
  assert.match(family, /https:\/\/example.invalid\/specification/);
  assert.match(family, /Covered Instances: Fixture Block 128/);
  const instance = render(pages.PrimitivePage, {cipherId: 'fixture-block', variantId: 'fixture-block-256'});
  assert.doesNotMatch(instance, /atlas-standard-panel|data-standard-kind=/);
  const dependent = render(pages.PrimitivePage, {cipherId: 'fixture-xof', variantId: 'fixture-xof-128'});
  assert.doesNotMatch(dependent, /atlas-standard-panel|data-standard-kind=/);
  const component = render(pages.PrimitivePage, {cipherId: 'fixture-permutation', variantId: 'fixture-permutation-256'});
  assert.match(component, /Standardized Component/);
  const historic = render(pages.PrimitivePage, {cipherId: 'fixture-mac', variantId: 'fixture-mac-128'});
  assert.match(plainText(historic), /Withdrawn 2025-01-01/);

  publicCatalog.standardization.standards[2].bindings.push({instance_ids: ['fixture-block-128'], locator: 'Synthetic withdrawn adoption.', role: 'algorithm'});
  const mixedPages = await bundleFixture({...fixture, ciphers: [], variants: [], results: [], resultPoints: [], publicCatalog});
  const mixedCard = [...render(mixedPages.PrimitiveDirectory).matchAll(/<a class="atlas-family-card"[^>]*>([\s\S]*?)<\/a>/g)]
    .find(card => card[1].includes('Fixture Block'))[1];
  assert.match(mixedCard, /data-standard-kind="international"/);
  assert.match(mixedCard, /data-standard-kind="historical"/);
  assert.doesNotMatch(mixedCard, /atlas-status-warning/);
});

test('compression pages isolate records, link the exact dependency and normalize legacy result context', async () => {
  const point = resultFixture({id: 'synthetic-compression-result', source: sources[0].id});
  const compression = {mode: 'dm', cipher_variant_id: 'aes-128', ...point.experiment.construction};
  delete compression.type;
  const variant = {id: 'synthetic-dm-128', family: 'synthetic-dm', name: 'Synthetic DM 128', full_rounds: 10, specification_source: sources[0].id, compression};
  point.target.variant_ids = [variant.id];
  const cipher = {id: variant.family, name: compression.name, primitive_type: 'hash_function', aliases: [], description: 'Synthetic compression only.'};
  const publicCatalog = catalogFixture();
  publicCatalog.categories.push({id: 'hash_function', domain: 'symmetric', en: 'Hash', zh: '哈希'});
  publicCatalog.primitives[0] = {...publicCatalog.primitives[0], id: 'aes', name: 'AES'};
  publicCatalog.instances[0] = {...publicCatalog.instances[0], id: 'aes-128', family_id: 'aes', name: 'AES-128'};
  publicCatalog.primitives.push({id: cipher.id, name: cipher.name, category: 'hash_function', aliases: [], description: cipher.description, specification_ids: ['fixture-spec'], uses: ['aes']});
  publicCatalog.instances.push({id: variant.id, family_id: cipher.id, name: variant.name, specification_ids: ['fixture-spec'], locator: 'Synthetic compression definition.',
    parameters: {type: 'hash_function', construction: 'block_cipher_compression', mode: 'dm', cipher_instance_id: 'aes-128', chaining_bits: 128, message_bits: 128, output_bits: 128, cipher_rounds: 10}});
  const pages = await bundleFixture({...fixture, ciphers: [...ciphers, cipher], variants: [...variants, variant],
    results: [...results, point], resultPoints: [...results, point], publicCatalog});
  const aes = render(pages.ResultsPage, {cipherId: 'aes', variantId: 'aes-128', searchParams: new URLSearchParams({q: point.id})});
  assert.doesNotMatch(aes, /data-record-id="synthetic-compression-result"/);
  assert.match(aes, /Related Compression Functions/);
  const hash = render(pages.ResultsPage, {cipherId: cipher.id, variantId: variant.id});
  assert.match(hash, /Compression Function/);
  assert.match(hash, /href="#\/cryptanalysis\/ciphers\/aes\/aes-128">AES-128/);
  assert.match(hash, /role="status">1 result<\/span>/);
  assert.doesNotMatch(hash, /128-bit key|data-record-id="aes-only-fixture"/);
  const detail = render(pages.ResultDetail, {id: point.id, searchParams: new URLSearchParams({variant: 'aes-128', ids: results[0].id, q: 'preserved'})});
  assert.match(detail, /a-back-link" href="#\/cryptanalysis\/ciphers\/synthetic-dm\/synthetic-dm-128\?q=preserved/);
  assert.doesNotMatch(detail, /requested instance does not apply/);
  assert.match(detail, /do not apply to Synthetic DM 128 and were excluded/);
  const scope = pages.routeScopeParams({page: 'result', id: point.id, params: new URLSearchParams({variant: 'aes-128'})}, [...ciphers, cipher], [...variants, variant], [point]);
  assert.equal(scope.get('variant'), variant.id);
});

test('large synthetic directories bound previews and paginate without losing hidden search matches', async () => {
  const publicCatalog = catalogFixture();
  const family = publicCatalog.primitives[0], instance = publicCatalog.instances[0];
  for (let n = 1; n <= 57; n++) {
    const id = `synthetic-block-${String(n).padStart(2, '0')}`;
    publicCatalog.primitives.push({...family, id, name: `Synthetic Block ${n}`, aliases: [`fixture-alias-${n}`]});
    publicCatalog.instances.push({...instance, id: `${id}-instance`, family_id: id, name: `Unique Profile ${n}`});
  }
  const pages = await bundleFixture({...fixture, ciphers: [], variants: [], results: [], resultPoints: [], publicCatalog});
  const directory = params => render(pages.PrimitiveDirectory, {searchParams: new URLSearchParams(params)});
  const cards = html => [...html.matchAll(/class="atlas-family-card" href="([^"]+)"/g)].map(match => match[1]);
  const overview = directory('');
  assert.equal(cards(overview).length, 9); // Six blocks and three singleton categories.
  assert.match(overview, /Browse Categories/);
  assert.doesNotMatch(overview, /role="tab|No Catalogued Results/);
  const allPages = [1, 2, 3].map(page => cards(directory(`primitive=block_cipher&page=${page}`)));
  assert.deepEqual(allPages.map(page => page.length), [24, 24, 10]);
  assert.equal(new Set(allPages.flat()).size, 58);
  assert.deepEqual(cards(directory('primitive=block_cipher&page=9999')), allPages[2]);
  assert.deepEqual(cards(directory('primitive=block_cipher&page=invalid')), allPages[0]);
  for (const q of ['fixture-alias-57', 'Unique Profile 57']) {
    assert.deepEqual(cards(directory(new URLSearchParams({q}))), ['#/cryptanalysis/ciphers/synthetic-block-57']);
  }
  assert.match(directory('q=not-a-fixture-family'), /No Matching Primitives/);
});

const surfaceRecords = ['algorithmic', 'side_channel', 'fault_injection'].flatMap(surface =>
  [surfaceResult({surface, method: surface === 'fault_injection' ? 'fault' : 'differential', source: sources[0].id}), surfaceResult({surface, source: sources[0].id, structural: true})]);
const surfacePages = await bundleFixture({...fixture, results: surfaceRecords, resultPoints: surfaceRecords});

test('result pages directly show every surface with separate method and property sections and no tabs', () => {
  const initial = render(surfacePages.ResultsPage, {cipherId: 'aes', variantId: 'aes-128'});
  assert.equal((initial.match(/data-attack-surface=/g) ?? []).length, 3);
  assert.equal((initial.match(/class="a-surface-heading"/g) ?? []).length, 3);
  assert.equal((initial.match(/class="a-result-section-toggle"/g) ?? []).length, 6);
  assert.match(initial, /role="status">6 results<\/span>/);
  assert.doesNotMatch(initial, /aria-label="Attack surface"|role="tab|a-surface-nav|attack_surface=/);
  for (const surface of ['algorithmic', 'side_channel', 'fault_injection']) {
    assert.ok(initial.includes(`data-section-id="${surface}-${surface === 'fault_injection' ? 'fault' : 'differential'}"`));
    assert.ok(initial.includes(`data-section-id="${surface}-structural"`));
  }
});

test('exact-ID and citation searches find side-channel records directly', () => {
  const side = surfaceRecords.find(r => r.setting.attack_surface === 'side_channel' && r.goal === 'key_recovery');
  for (const q of [side.id, sources[0].citation_label]) {
    const html = render(surfacePages.ResultsPage, {cipherId: 'aes', variantId: 'aes-128', searchParams: new URLSearchParams({q})});
    assert.ok(recordRow(html, side.id));
    assert.match(html, /<h3 class="a-surface-heading">Side-Channel Analysis<\/h3>/);
    assert.doesNotMatch(html, /Matching results on other attack surfaces|attack_surface=/);
    const legacy = render(surfacePages.ResultsPage, {cipherId: 'aes', variantId: 'aes-128', searchParams: new URLSearchParams({q, attack_surface: 'algorithmic'})});
    assert.equal(legacy, html);
  }
});

test('method-only links directly reach fault results without dropping other constraints', () => {
  const html = render(surfacePages.ResultsPage, {cipherId: 'aes', variantId: 'aes-128', searchParams: new URLSearchParams('method=fault')});
  assert.match(html, /<h3 class="a-surface-heading">Fault-Injection Analysis<\/h3>/);
  assert.match(html, /data-section-id="fault_injection-fault"/);
  assert.doesNotMatch(html, /No Matching Results|Matching results on other attack surfaces|attack_surface=/);
  const constrained = render(surfacePages.ResultsPage, {cipherId: 'aes', variantId: 'aes-128', searchParams: new URLSearchParams('method=fault&rounds=999')});
  assert.match(constrained, /No Matching Results/);
  assert.doesNotMatch(constrained, /data-section-id=/);
});

test('legacy details and comparisons return to the unified page with search and selection intact', () => {
  const side = surfaceRecords.find(r => r.setting.attack_surface === 'side_channel' && r.goal === 'key_recovery');
  for (const surface of ['algorithmic', 'side_channel', 'fault_injection', 'all', 'unknown']) {
    const context = new URLSearchParams({variant: 'aes-128', q: 'Syn26', ids: side.id, attack_surface: surface});
    const detail = render(surfacePages.ResultDetail, {id: side.id, searchParams: context});
    assert.ok(detail.includes(`class="a-back-link" href="#/cryptanalysis/ciphers/aes/aes-128?q=Syn26&amp;ids=${side.id}"`));
    assert.match(detail, /class="a-target-tags"><span>Side-channel<\/span>/);
    assert.doesNotMatch(detail, /attack_surface=/);
    const compare = render(surfacePages.ComparePage, {variantId: 'aes-128', searchParams: context});
    assert.ok(compare.includes(`class="a-back-link" href="#/cryptanalysis/ciphers/aes/aes-128?q=Syn26&amp;ids=${side.id}"`));
    assert.match(compare, /<optgroup label="Algorithmic">/);
    assert.match(compare, /<optgroup label="Fault injection">/);
    assert.doesNotMatch(compare, /attack_surface=/);
    const modelCompare = render(surfacePages.ComparePage, {variantId: 'aes-128', searchParams: new URLSearchParams({...Object.fromEntries(context), compare: 'models'})});
    assert.match(modelCompare, /a-model-compare/);
    assert.doesNotMatch(modelCompare, /attack_surface=/);
    const picker = render(surfacePages.ComparePage, {searchParams: context});
    assert.match(picker, /Comparison Instances/);
    assert.doesNotMatch(picker, /attack_surface=/);
  }
});

test('retired surface values, including unknown values, cannot leave a hidden list filter', () => {
  const initial = render(surfacePages.ResultsPage, {cipherId: 'aes', variantId: 'aes-128'});
  for (const surface of ['algorithmic', 'side_channel', 'fault_injection', 'all', 'unknown', '']) {
    const html = render(surfacePages.ResultsPage, {cipherId: 'aes', variantId: 'aes-128', searchParams: new URLSearchParams({attack_surface: surface})});
    assert.equal(html, initial);
  }
});

test('structure and results have distinct sibling keys across filter rerenders', () => {
  for (const search of ['', 'rounds=1', 'q=fixture']) {
    const tree = ResultsPage({cipherId: 'aes', variantId: 'aes-128', searchParams: new URLSearchParams(search), onParamsChange() {}});
    const keys = tree.props.children.flat(Infinity).filter(child => child && typeof child === 'object' && child.key !== null).map(child => child.key);
    assert.equal(new Set(keys).size, keys.length, 'Sibling components must not reuse the instance key');
    assert(keys.includes('structure:aes-128'));
  }
});

test('real pages show extended experiments and theorem round domains with separate cost semantics', async () => {
  const experiment = resultFixture({ id: 'synthetic-render-experiment', source: sources[0].id });
  const theorem = resultFixture({ id: 'synthetic-render-theorem', source: sources[0].id, theorem: true });
  const extended = await bundleFixture({ ...fixture, results: [experiment, theorem], resultPoints: [experiment, theorem] });
  const detail = render(extended.ResultDetail, { id: experiment.id, searchParams: new URLSearchParams({ variant: 'aes-128' }) });
  assert.match(detail, /Target Experiment|Synthetic Davies/);
  assert.match(detail, /128-bit full output/);
  assert.match(detail, /Target Relation|Input Control|Reference experiment/);
  assert.match(detail, /Reported Resources/);
  const theoremDetail = render(extended.ResultDetail, { id: theorem.id, searchParams: new URLSearchParams({ variant: 'aes-128' }) });
  assert.match(theoremDetail, /Theoretical Bound/);
  assert.match(theoremDetail, /data-native-expression="integer r &gt;= 3"/);
  assert.doesNotMatch(theoremDetail, /Reported Resources|a-resource-card|Choose another record/);
  assert.match(theoremDetail, /Synthetic product model/);
  const list = render(extended.ResultsPage, { cipherId: 'aes', variantId: 'aes-128', searchParams: new URLSearchParams({ q: 'synthetic', view: 'points' }) });
  assert.match(list, /Compression-function preimage/);
  assert.match(list, /a-attack-table/);
  assert.match(list, /data-label="Type">Theoretical bound/);
  const row = recordRow(list, theorem.id);
  assert.ok(row); assert.doesNotMatch(row, /data-label="Time"|data-label="Memory"|type="checkbox"/);
  const coverage = render(extended.CoveragePage, { searchParams: new URLSearchParams({ variant: 'aes-128', goal: theorem.goal }) });
  assert.match(coverage, /Variable-round theorems/);
  assert.match(coverage, /scope=variable/);
  assert.doesNotMatch(coverage, /<th scope="col">null<\/th>/);
});

test('the real cipher directory exposes a second family without rendering result tables', () => {
  const html = render(CipherDirectory);
  assert.match(html, /href="#\/cryptanalysis\/ciphers\/aes"/);
  assert.match(html, /href="#\/cryptanalysis\/ciphers\/test-cipher"/);
  assert.match(html, /<span>2 instances<\/span><span>3 results · 3 reported points<\/span>/);
  assert.doesNotMatch(html, /<table\b|Twenty-round fixture result|AES-only fixture result/);
  const filtered = render(CipherDirectory, { searchParams: new URLSearchParams({ q: 'Temporary family' }) });
  assert.match(filtered, /href="#\/cryptanalysis\/ciphers\/test-cipher"/);
  assert.doesNotMatch(filtered, /href="#\/cryptanalysis\/ciphers\/aes"/);
});

test('standard AES navigation folds special instances into Others while preserving their links', () => {
  const html = render(groupedPages.ResultsPage, { cipherId: 'aes', variantId: 'aes-128' });
  const nav = html.match(/<nav[^>]*aria-label="Cipher instances"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav);
  const primary = nav.match(/class="a-instance-main-links">([\s\S]*?)<\/div>/)?.[1];
  assert.deepEqual([...primary.matchAll(/href="([^"]+)"/g)].map(match => match[1]), [
    '#/cryptanalysis/ciphers/aes/aes-128', '#/cryptanalysis/ciphers/aes/aes-192', '#/cryptanalysis/ciphers/aes/aes-256',
  ]);
  assert.match(primary, /aria-expanded="false"[^>]*>Others /);
  assert.match(nav, /class="a-instance-other-links"[^>]*hidden=""/);
  for (const variant of specialVariants) assert.ok(nav.includes(`href="#/cryptanalysis/ciphers/aes/${variant.id}"`));
  assert.doesNotMatch(html, /Special AES fixture attack/);
  assert.match(render(groupedPages.CipherDirectory), /3 standard \+ 2 other instances/);
});

test('a special AES bookmark keeps its exact instance, opens Others and never aggregates scopes', () => {
  const html = render(groupedPages.ResultsPage, { cipherId: 'aes', variantId: specialVariants[0].id });
  assert.match(html, /<h1[^>]*>AES-128 with secret S-box<\/h1>/);
  assert.match(html, /Special AES fixture attack/);
  assert.doesNotMatch(html, /Original-family fixture recovery/);
  assert.match(html, /class="a-instance-others-toggle is-active" aria-expanded="true"/);
  assert.match(html, /aria-current="page"[^>]*>AES-128 with secret S-box<\/a>/);
  assert.doesNotMatch(html, /class="a-instance-other-links"[^>]*hidden/);
  assert.match(render(groupedPages.ResultsPage, { cipherId: 'aes', variantId: 'others' }), /Cipher Instance Not Found/);
});

test('comparison and coverage selectors share the Others group without introducing an Others instance', () => {
  const comparison = render(groupedPages.ComparePage, { searchParams: new URLSearchParams({ ids: 'stale-selection' }) });
  assert.match(comparison, /aria-label="Comparison Instances"/);
  assert.match(comparison, /class="a-instance-other-links"[^>]*hidden=""/);
  for (const variant of specialVariants) assert.ok(comparison.includes(`href="#/cryptanalysis/compare/${variant.id}?variant=${variant.id}"`));
  assert.doesNotMatch(comparison, /stale-selection|\/compare\/others/);
  const coverage = render(groupedPages.CoveragePage, { searchParams: new URLSearchParams({ family: 'aes', variant: specialVariants[0].id }) });
  assert.match(coverage, /<optgroup label="Others">/);
  assert.match(coverage, /<option value="aes-128-secret-sbox" selected="">AES-128 with secret S-box<\/option>/);
  assert.doesNotMatch(coverage, /value="others"/);
  const allCiphers = render(groupedPages.CoveragePage);
  assert.match(allCiphers, /<optgroup label="AES · Others">/);
  const otherCipher = render(groupedPages.CoveragePage, { searchParams: new URLSearchParams({ family: 'test-cipher' }) });
  assert.doesNotMatch(otherCipher, /<optgroup/);
});

test('a family opens its first registered instance directly with in-page instance links', () => {
  const html = render(ResultsPage, { cipherId: 'test-cipher' });
  assert.match(html, /<h1[^>]*>Test Cipher 20<\/h1>/);
  assert.match(html, /<table\b/);
  assert.match(html, /role="status">2 results(?: · \d+ active filters?)?<\/span>/);
  assert.match(html, /Twenty-round fixture result/);
  assert.match(html, /Shared fixture result/);
  assert.match(html, /data-native-expression="20"/);
  assert.match(html, /result-section-heading-algorithmic-mitm/);
  assert.match(html, /<span class="a-citation-label">\[TFA<sup>\+<\/sup>26\]<\/span>/);
  assert.match(html, /data-label="Paper \/ Attack"/);
  assert.match(html, /FixtureConf 2026/);
  assert.doesNotMatch(html, /AES-only fixture result|Sibling-only fixture result|Choose an instance/);
  const nav = html.match(/<nav[^>]*aria-label="Cipher instances"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert(nav, 'The default results page retains the instance navigation');
  assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(match => match[1]), [
    '#/cryptanalysis/ciphers/test-cipher/test-cipher-20',
    '#/cryptanalysis/ciphers/test-cipher/test-cipher-24',
  ]);
  assert.match(nav, /aria-current="page"[^>]*>Test Cipher 20<\/a>/);

  const sibling = render(ResultsPage, { cipherId: 'test-cipher', variantId: 'test-cipher-24' });
  assert.match(sibling, /<h1[^>]*>Test Cipher 24<\/h1>/);
  assert.match(sibling, /Sibling-only fixture result/);
  assert.match(sibling, /Shared fixture result/);
  assert.doesNotMatch(sibling, /AES-only fixture result|Twenty-round fixture result/);
  assert.match(sibling, /href="#\/cryptanalysis\/ciphers\/test-cipher\/test-cipher-20"/);
});

test('a registered family without instances shows the catalogue empty state', () => {
  const html = render(ResultsPage, { cipherId: 'empty-family' });
  assert.match(html, /No instances are catalogued for this cipher yet\./);
  assert.doesNotMatch(html, /<table\b|fixture result|not found/);
});

test('the real instance page renders only applicable second-family records', () => {
  const html = render(ResultsPage, { cipherId: 'test-cipher', variantId: 'test-cipher-20' });
  assert.match(html, /<h1[^>]*>Test Cipher 20<\/h1>/);
  assert.match(html, /role="status">2 results(?: · \d+ active filters?)?<\/span>/);
  assert.match(html, /Twenty-round fixture result/);
  assert.match(html, /Shared fixture result/);
  assert.doesNotMatch(recordRow(html, 'shared-fixture'), /Shared result/);
  assert.match(html, /data-native-expression="20"/);
  assert.match(html, /result-section-heading-algorithmic-mitm/);
  assert.match(html, /<span class="a-citation-label">\[TFA<sup>\+<\/sup>26\]<\/span>/);
  assert.doesNotMatch(html, /AES-only fixture result|Sibling-only fixture result/);
  const filtered = render(ResultsPage, { cipherId: 'test-cipher', variantId: 'test-cipher-20', searchParams: new URLSearchParams({ variant: 'aes-128', rounds: '20' }) });
  assert.match(filtered, /Twenty-round fixture result/);
  assert.match(filtered, /role="status">1 result(?: · \d+ active filters?)?<\/span>/);
  assert.doesNotMatch(filtered, /AES-only fixture result|Sibling-only fixture result|Shared fixture result/);
});

test('citation labels preserve metadata text while typesetting plus signs as superscripts', () => {
  const html = renderToStaticMarkup(createElement(CitationLabel, { label: '[DFJ13] [DGK+24]' }));
  assert.equal(plainText(html), '[DFJ13] [DGK+24]');
  assert.match(html, /\[DGK<sup>\+<\/sup>24\]/);
  assert.doesNotMatch(html, /aria-hidden/);
});

test('unified rows retain scoped result links and deduplicated citations alongside attack names', () => {
  const html = render(ResultsPage, { cipherId: 'test-cipher', variantId: 'test-cipher-20', searchParams: new URLSearchParams({ view: 'points' }) });
  for (const id of ['twenty-round-fixture', 'shared-fixture']) {
    const record = results.find(result => result.id === id);
    const row = recordRow(html, id);
    assert.ok(row);
    const cell = row.match(/<td[^>]*data-label="Paper \/ Attack"[^>]*>([\s\S]*?)<\/td>/)?.[1];
    const link = cell?.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/);
    assert.ok(link);
    assert.equal(plainText(link[2]), '[TFA+26]');
    assert.ok(link[1].includes(`href="#/cryptanalysis/results/${id}?variant=test-cipher-20"`));
    assert.ok(link[1].includes(`title="${record.title}"`));
    assert.ok(cell.includes(record.display.name));
    assert.doesNotMatch(cell, /data-label="Rounds"/);
    assert.match(row, new RegExp(`aria-label="Compare ${record.display.name} at ${record.display.name}"`));
    assert.equal((row.match(/href="#\/cryptanalysis\/sources\/test-fixture-source\?variant=test-cipher-20"/g) || []).length, 1);
  }
});

test('citation-label searches preserve instance isolation and match all same-paper rows', () => {
  for (const q of ['TFA+26', '[TFA+26]']) {
    const html = render(ResultsPage, { cipherId: 'test-cipher', variantId: 'test-cipher-20', searchParams: new URLSearchParams({ q, view: 'points' }) });
    assert.match(html, /role="status">2 results(?: · \d+ active filters?)?<\/span>/);
    assert.ok(recordRow(html, 'twenty-round-fixture'));
    assert.ok(recordRow(html, 'shared-fixture'));
    assert.equal(recordRow(html, 'sibling-only-fixture'), undefined);
    assert.equal(recordRow(html, 'aes-only-fixture'), undefined);
  }
});

test('result details retain the attack name and connect citation-labelled evidence to scoped sources', () => {
  const record = results[1];
  const html = render(ResultDetail, { id: record.id, searchParams: new URLSearchParams({ variant: 'test-cipher-20' }) });
  assert.match(html, /<h1[^>]*><span[^>]*>Twenty-round fixture result<\/span><\/h1>/);
  assert.match(plainText(html), /Result nameDefault-instance fixture recovery/);
  const evidenceHeadings = [...html.matchAll(/<article class="a-evidence-entry"><h3>([\s\S]*?)<\/h3>/g)].map(match => match[1]);
  assert.equal(evidenceHeadings.length, record.evidence.length);
  for (const heading of evidenceHeadings) {
    assert.equal(plainText(heading).trim(), '[TFA+26] Synthetic source test-fixture-source');
    assert.match(heading, /href="#\/cryptanalysis\/sources\/test-fixture-source\?variant=test-cipher-20"/);
  }
});

test('the real second-family coverage matrix reaches twenty rounds and does not inherit the AES ledger', () => {
  const html = render(CoveragePage, { searchParams: new URLSearchParams({ family: 'test-cipher', variant: 'test-cipher-20' }) });
  const header = html.match(/<thead>([\s\S]*?)<\/thead>/)?.[1];
  assert(header, 'The actual coverage table is rendered');
  assert.deepEqual([...header.matchAll(/<th scope="col">(\d+)<\/th>/g)].map(match => Number(match[1])), Array.from({ length: 20 }, (_, index) => index + 1));
  assert.match(html, /aria-label="1 result, Single-key, 20 rounds"/);
  assert.match(html, /href="#\/cryptanalysis\/ciphers\/test-cipher\/test-cipher-20\?key_model=single_secret_key&amp;rounds=20"/);
  assert.match(html, /<strong>2<\/strong> reported points in Test Cipher 20/);
  noLedger(html);
});

test('family-level coverage requires an instance and keeps the AES-only audit isolated', () => {
  const html = render(CoveragePage, { searchParams: new URLSearchParams({ family: 'test-cipher' }) });
  assert.match(html, /Select an instance for coverage/);
  assert.match(html, /<strong>3<\/strong> reported points in Test Cipher/);
  assert.doesNotMatch(html, /<table\b/);
  noLedger(html);
});

test('AES audit totals remain separate from whole-directory record totals', () => {
  const html = render(CoveragePage);
  assert.match(html, /<strong>4<\/strong> reported points in the directory/);
  assert.match(html, /Ledger Totals · AES/);
  assert.match(html, /<dt>other key recovery<\/dt><dd>1<\/dd>/);
  assert.match(html, /AES audit selection sentinel/);
  assert.match(html, /AES ingestion batch sentinel/);
  assert.doesNotMatch(html, /No Audit Ledger for This Scope/);
});

test('real pages reject an unknown family and mismatched family-instance scope', () => {
  const familyHtml = render(ResultsPage, { cipherId: 'missing' });
  assert.match(familyHtml, /Cipher Not Found/);
  assert.doesNotMatch(familyHtml, /<table\b|fixture result/);
  const resultHtml = render(ResultsPage, { cipherId: 'aes', variantId: 'test-cipher-20' });
  assert.match(resultHtml, /Cipher Instance Not Found/);
  assert.doesNotMatch(resultHtml, /<table\b|fixture result/);
  const coverageHtml = render(CoveragePage, { searchParams: new URLSearchParams({ family: 'aes', variant: 'test-cipher-20' }) });
  assert.match(coverageHtml, /Analysis Scope Not Found/);
  assert.doesNotMatch(coverageHtml, /<table\b|Ledger Totals/);
});

const compactSource = { ...sources[0], id: 'compact-only-source', title: 'Compact-only source fixture', citation_label: 'Cmp26' };
const historicalSource = { ...sources[0], id: 'historical-only-source', title: 'Historical-only source fixture', citation_label: 'His26' };
const compactPoints = [
  result('compact-one-fixture', 'Compact configuration one', ['aes-128'], 9, compactSource.id),
  result('compact-two-fixture', 'Compact configuration two', ['aes-128'], 9, compactSource.id),
];
const historicalPoint = result('historical-fixture', 'Retained historical configuration', ['aes-128'], 10, historicalSource.id);
const extendedFixture = {
  ...fixture,
  results: [...results, historicalPoint],
  resultPoints: [...results, historicalPoint, ...compactPoints],
  sources: [...sources, compactSource, historicalSource],
  familyCatalogs: [{
    schema_version: 1, cipher_family_id: 'aes', reviewed_on: '2026-10-09',
    families: [{
      id: 'compact-fixture-family', title: 'Synthetic compact configuration family',
      construction: 'One synthetic construction with two parameter settings.', representation: 'table',
      parameters: [{ name: 'n', meaning: 'Synthetic parameter', domain: 'n in {1,2}' }],
      points: compactPoints.map((point, index) => ({ result_id: point.id, values: { n: index + 1 } })),
      evidence: [{ source_id: compactSource.id, locator: 'Synthetic family table' }],
    }],
    standalone_result_ids: ['aes-only-fixture'],
    excluded_results: [{ result_id: historicalPoint.id, reason: 'Synthetic historical exclusion' }],
  }],
  coverage: {
    ...coverage, included_counts: { other_key_recovery: 2 },
    issues: [...coverage.issues, { id: 'historical-review-fixture', status: 'needs_review', affected_records: [historicalPoint.id], evidence: ['Historical audit evidence sentinel'], action: 'Historical audit action sentinel' }],
  },
  analysisManifest: { ...analysisManifest, record_count: results.length + 1, source_count: sources.length + 2, records: [...analysisManifest.records, historicalPoint.id] },
};
const extended = await bundleFixture(extendedFixture);

const directoryOnly = await bundleFixture({analysisEnabled: false, analysisManifest: null, ciphers: [], variants: [],
  results: [], resultPoints: [], familyCatalogs: [], sources: [], coverage: null, publicCatalog: catalogFixture()});

test('public directory works without an analysis dataset and separates zero results from filter misses', () => {
  const html = render(directoryOnly.CipherDirectory);
  assert.match(html, /Fixture Block/);
  assert.match(html, /Extendable-Output Functions/);
  assert.match(html, /No Catalogued Results/);
  assert.doesNotMatch(html, /No Matching Primitives|<table\b|Comparison selection/);
  const filtered = render(directoryOnly.CipherDirectory, {searchParams: new URLSearchParams({primitive: 'xof'})});
  assert.match(filtered, /Fixture XOF/);
  assert.doesNotMatch(filtered, /Fixture Block/);
  const missing = render(directoryOnly.CipherDirectory, {searchParams: new URLSearchParams({q: 'does-not-exist'})});
  assert.match(missing, /No Matching Primitives/);
  assert.match(missing, /Reset filters/);
});

test('directory detail renders type-specific parameters without inventing cipher keys or analysis', () => {
  const html = render(directoryOnly.PrimitivePage, {cipherId: 'fixture-xof', variantId: 'fixture-xof-128'});
  assert.match(html, /Output length/); assert.match(html, /Variable/);
  assert.match(html, /State size/); assert.match(html, /128 bits/);
  assert.match(html, /Synthetic specification/); assert.match(html, /Synthetic section 3/);
  assert.doesNotMatch(html, /Key material|Block size|full rounds|Comparison selection|<table\b/);
  assert.match(render(directoryOnly.PrimitivePage, {cipherId: 'fixture-xof', variantId: 'fixture-block-128'}), /Record Not Found/);
});

test('home retains four entrances and only implementation remains planned', () => {
  const html = render(directoryOnly.PortalPage);
  assert.match(html, /<header class="atlas-portal-heading"><h1[^>]*>CryptoFrontier<wbr\/><span>Atlas<\/span><\/h1><\/header>/);
  assert.doesNotMatch(html, /atlas-portal-mark|\u2733/);
  assert.equal((html.match(/class="atlas-portal-card /g) ?? []).length, 4);
  for (const href of ['/questions', '/cryptanalysis', '/asymmetric-cryptanalysis', '/implementation']) assert(html.includes(`href="#${href}"`));
  assert.equal((html.match(/class="atlas-tbd"/g) ?? []).length, 1);
  const page = render(directoryOnly.PlannedCollection);
  assert.match(page, /Implementation/); assert.match(page, /TBD/); assert.match(page, /Back to home/);
  assert.doesNotMatch(page, /atlas-portal-count|Comparison selection/);
});

test('all four home cards embed distinct local artwork while keeping headings and links accessible', () => {
  const html = render(directoryOnly.PortalPage);
  const cards = [...html.matchAll(/<a class="atlas-portal-card [^"]+"[^>]*>([\s\S]*?)<\/a>/g)].map(match => match[1]);
  assert.equal(cards.length, 4);
  const labels = ['Open Questions', 'Symmetric Cryptanalysis', 'Asymmetric Cryptanalysis', 'Implementation'];
  const imageSources = new Set();
  for (const [index, card] of cards.entries()) {
    assert.match(card, /<img class="atlas-collection-art" src="data:image\/webp;base64,/);
    assert.match(card, /width="1200" height="800" alt="" aria-hidden="true" draggable="false"/);
    assert.ok(card.includes(`<h2>${labels[index]}</h2>`));
    assert.doesNotMatch(card, /atlas-portal-icon|<svg class="atlas-collection-art"/);
    imageSources.add(card.match(/<img[^>]+src="([^"]+)"/)?.[1]);
    assert.equal(card.includes('class="atlas-tbd"'), index === 3);
  }
  assert.equal(imageSources.size, 4);
});

test('directory routes keep legacy bookmarks and explicit IDs without choosing an arbitrary public instance', () => {
  const targets = catalogFixture().instances.map(i => ({id: i.id, family: i.family_id}));
  assert.equal(directoryOnly.parseHash('#/asymmetric-cryptanalysis', targets, []).page, 'asymmetric');
  assert.equal(directoryOnly.parseHash('#/implementation', targets, []).page, 'implementation');
  assert.equal(directoryOnly.parseHash('#/cryptanalysis/ciphers/fixture-xof', targets, []).page, 'cipher');
  const legacy = directoryOnly.parseHash('#/objects/fixture-xof?variant=fixture-xof-128&q=kept', targets, []);
  assert.equal(legacy.path, '/cryptanalysis/ciphers/fixture-xof/fixture-xof-128');
  assert.equal(legacy.params.get('q'), 'kept');
  assert.equal(directoryOnly.parseHash('#/cryptanalysis/ciphers/fixture-block', targets).variantId, 'fixture-block-128');
  assert.equal(directoryOnly.parseHash('#/implementation/unknown', targets).page, 'not-found');
});

const asymmetricCatalog = asymmetricCatalogFixture();
const asymmetricPages = await bundleFixture({...fixture, publicCatalog: asymmetricCatalog});
const hardCatalog = hardProblemCatalogFixture();
const problemPages = await bundleFixture({...fixture, publicCatalog: hardCatalog});

test('hard problems share the directory hierarchy without becoming algorithms or scientific targets', () => {
  const html = render(problemPages.PrimitiveDirectory, {domain: 'asymmetric'});
  assert.equal((html.match(/class="atlas-family-card"/g) ?? []).length, 19);
  assert.match(html, /View All Hard Problems/);
  assert(html.indexOf('<h2>Hard Problems</h2>') < html.indexOf('<h2>Public-Key Encryption</h2>'));
  assert.equal(problemPages.directoryRoutes(hardCatalog, variants, 'asymmetric').length, 13);
  const filtered = render(problemPages.PrimitiveDirectory, {domain: 'asymmetric', searchParams: new URLSearchParams({primitive: 'hard_problem'})});
  assert.equal((filtered.match(/class="atlas-family-card"/g) ?? []).length, 9);
  assert.doesNotMatch(filtered, /0 instances|No Catalogued Results|algorithms\/fixture/);
  assert.doesNotMatch(render(problemPages.PrimitiveDirectory), /Hard Problems|fixture-problem-/);
  const search = render(problemPages.PrimitiveDirectory, {domain: 'asymmetric', searchParams: new URLSearchParams({q: 'Synthetic definition ring_lwe'})});
  assert.equal((search.match(/class="atlas-family-card"/g) ?? []).length, 1);
  assert.match(search, /href="#\/asymmetric-cryptanalysis\/problems\/fixture-problem-ring-lwe"/);
});

test('problem details retain symbolic parameters and source titles without instance or diagram placeholders', () => {
  for (const problem of hardCatalog.hard_problems) {
    const html = render(problemPages.HardProblemPage, {id: problem.id});
    assert.match(html, /class="katex"/);
    assert.match(html, /Synthetic source with qRAM and ePrint/);
    assert.match(html, /Synthetic definition location/);
    assert.match(html, /Related Schemes/);
    assert.match(html, /href="#\/asymmetric-cryptanalysis\/algorithms\/fixture-rsaes-oaep"/);
    assert.doesNotMatch(html, /0 instances|Diagram pending|Specifications|atlas-instance-table|a-selection-bar|No Catalogued Results/);
  }
  const scheme = render(problemPages.PrimitivePage, {cipherId: 'fixture-rsaes-oaep', domain: 'asymmetric'});
  assert.match(scheme, /Related Hard Problems/);
  assert.match(scheme, /href="#\/asymmetric-cryptanalysis\/problems\/fixture-problem-integer-factorization"/);
});

test('problem routes reject algorithm identities and cannot inherit symmetric comparison scope', () => {
  const path = '#/asymmetric-cryptanalysis/problems/fixture-problem-lwe?variant=aes-128';
  const route = problemPages.parseHash(path, variants);
  assert.equal(route.page, 'hard-problem'); assert.equal(route.domain, 'asymmetric');
  assert.equal(route.id, 'fixture-problem-lwe');
  assert.equal(problemPages.routeScopeParams(route, ciphers, variants, results).toString(), '');
  assert.equal(problemPages.parseHash(path.split('?')[0] + '/extra', variants).page, 'not-found');
  assert.match(render(problemPages.HardProblemPage, {id: 'fixture-rsaes-oaep'}), /Record Not Found/);
  assert.match(render(problemPages.PrimitivePage, {cipherId: 'fixture-problem-lwe', domain: 'asymmetric'}), /Record Not Found/);
});

test('interface title casing preserves acronyms, mathematical identifiers and mixed-case names', () => {
  for (const [before, after] of [
    ['Round & key schedule', 'Round & Key Schedule'],
    ['Differential fault analysis (DFA)', 'Differential Fault Analysis (DFA)'],
    ['qRAM and ePrint', 'qRAM and ePrint'],
    ['AES and ML-KEM', 'AES and ML-KEM'],
    ['X25519 / ffdhe2048', 'X25519 / ffdhe2048'],
  ]) assert.equal(problemPages.titleCaseLabel(before), after);
});

test('shared directory rendering isolates domains, filters and scientific result counts', () => {
  const html = render(asymmetricPages.PrimitiveDirectory, {domain: 'asymmetric'});
  assert.equal((html.match(/class="atlas-family-card"/g) ?? []).length, 13);
  assert.match(html, /Asymmetric Cryptanalysis/);
  assert.match(html, /Public-Key Encryption/); assert.match(html, /Key Encapsulation Mechanisms/);
  assert.doesNotMatch(html, /Block Ciphers|AES|Twenty-round|fixture-block|reported points|No Catalogued Results|role="tab/);
  assert.match(html, /href="#\/asymmetric-cryptanalysis\/algorithms\/fixture-ml-kem"/);
  const symmetric = render(asymmetricPages.PrimitiveDirectory);
  assert.doesNotMatch(symmetric, /Synthetic ml_kem|Key Encapsulation Mechanisms/);
  const filtered = render(asymmetricPages.PrimitiveDirectory, {domain: 'asymmetric', searchParams: new URLSearchParams({primitive: 'kem'})});
  assert.equal((filtered.match(/class="atlas-family-card"/g) ?? []).length, 1);
  const wrongFilter = render(asymmetricPages.PrimitiveDirectory, {domain: 'asymmetric', searchParams: new URLSearchParams({primitive: 'block_cipher'})});
  assert.match(wrongFilter, /No Matching Entries/);
});

test('asymmetric deep links retain domain and cannot reuse symmetric scientific defaults', () => {
  const targets = asymmetricPages.directoryRoutes(asymmetricCatalog, variants);
  assert(targets.every(i => !i.id.includes('ml-kem')));
  const asymmetricTargets = asymmetricPages.directoryRoutes(asymmetricCatalog, variants, 'asymmetric');
  assert.equal(asymmetricTargets.length, 13);
  assert(asymmetricTargets.every(i => !variants.some(v => v.id === i.id)));
  const family = asymmetricPages.parseHash('#/asymmetric-cryptanalysis/algorithms/fixture-ml-kem?variant=aes-128', targets);
  assert.equal(family.domain, 'asymmetric'); assert.equal(family.variantId, undefined);
  const instance = asymmetricPages.parseHash('#/asymmetric-cryptanalysis/algorithms/fixture-ml-kem/fixture-ml-kem-instance', targets);
  assert.equal(instance.page, 'instance'); assert.equal(instance.domain, 'asymmetric');
  assert.equal(asymmetricPages.parseHash('#/asymmetric-cryptanalysis/algorithms/fixture-ml-kem/extra/path', targets).page, 'not-found');
  for (const [cipherId, domain] of [['fixture-ml-kem', 'symmetric'], ['fixture-block', 'asymmetric']]) {
    assert.match(render(asymmetricPages.PrimitivePage, {cipherId, domain}), /Record Not Found/);
  }
});

test('asymmetric details use typed units and cross-domain dependency links without result comparisons', () => {
  for (const instance of asymmetricCatalog.instances.filter(i => 'scheme' in i.parameters)) {
    const rows = asymmetricPages.parameterRows(instance);
    assert(rows.every(row => row.label && row.value !== 'undefined'));
    assert(rows.every(row => !['type', 'scheme'].includes(row.key)));
    for (const row of rows) {
      if (row.key.endsWith('_bytes')) assert.match(row.value, / bytes$/);
      if (row.key.endsWith('_bits')) assert.match(row.value, / bits$/);
    }
    const html = render(asymmetricPages.PrimitivePage, {cipherId: instance.family_id, variantId: instance.id, domain: 'asymmetric'});
    assert.match(html, /href="#\/asymmetric-cryptanalysis"/);
    assert.match(html, /href="#\/cryptanalysis\/ciphers\/fixture-xof"/);
    assert.match(html, /No Catalogued Results/);
    assert.doesNotMatch(html, /<table|a-selection-bar|Search analysis results|AES-only fixture/);
  }
  const kem = asymmetricCatalog.instances.find(i => i.parameters.scheme === 'ml_kem');
  assert.equal(asymmetricPages.parameterRows(kem).find(row => row.key === 'security_category').value, '1');
});

test('counts live in the directory and results, not the portal, and include compact points', () => {
  const portal = renderToStaticMarkup(createElement(extended.LocaleProvider, { initialLocale: 'en' }, createElement(extended.PortalPage)));
  assert.doesNotMatch(portal, /atlas-portal-count|reported points|<p\b|<strong\b/);
  assert.match(portal, /<h1[^>]*>CryptoFrontier<wbr\/><span>Atlas<\/span><\/h1>/);
  const directory = render(extended.CipherDirectory);
  assert.match(directory, /<span>1 instance<\/span><span>2 results · 3 reported points<\/span>/);
  assert.match(directory, /<span>2 instances<\/span><span>3 results · 3 reported points<\/span>/);
  assert.doesNotMatch(directory, /unique results|historical-fixture/);
  const instance = render(extended.ResultsPage, { cipherId: 'aes', variantId: 'aes-128' });
  assert.match(instance, /role="status">2 results(?: · \d+ active filters?)?<\/span>/);
  assert.ok(recordRow(instance, compactPoints[0].id));
  assert.ok(recordRow(instance, compactPoints[1].id));
  assert.equal(recordRow(instance, historicalPoint.id), undefined);
});

test('Chinese portal retains four concise entrances and their destinations', () => {
  const portal = renderToStaticMarkup(createElement(extended.LocaleProvider, { initialLocale: 'zh' }, createElement(extended.PortalPage)));
  assert.match(plainText(portal), /CryptoFrontierAtlas/);
  assert.doesNotMatch(portal, /<p\b|<strong\b|报告参数点|atlas-portal-mark|\u2733/);
  for (const label of ['开放问题', '对称密码分析', '非对称密码分析', '实现']) assert.ok(portal.includes(`<h2>${label}</h2>`));
  assert.match(portal, /href="#\/questions"/);
  assert.match(portal, /href="#\/cryptanalysis"/);
});

test('scoped source pages include compact-only and retained historical citations without cross-instance leakage', () => {
  const searchParams = new URLSearchParams({ variant: 'aes-128' });
  const compact = render(extended.SourcesPage, { collection: 'analysis', id: compactSource.id, searchParams });
  assert.match(compact, /Source Details/);
  assert.match(compact, /Directly Citing Results · 2/);
  for (const point of compactPoints) {
    assert.ok(compact.includes(`href="#/cryptanalysis/results/${point.id}?variant=aes-128"`));
    assert.ok(compact.includes(point.title));
  }
  const historical = render(extended.SourcesPage, { collection: 'analysis', id: historicalSource.id, searchParams });
  assert.match(historical, /Directly Citing Results · 1/);
  assert.match(historical, /href="#\/cryptanalysis\/results\/historical-fixture\?variant=aes-128"/);
  const index = render(extended.SourcesPage, { collection: 'analysis', searchParams });
  assert.match(index, /Compact-only source fixture/);
  assert.match(index, /Historical-only source fixture/);
  const other = render(extended.SourcesPage, { collection: 'analysis', id: compactSource.id, searchParams: new URLSearchParams({ variant: 'test-cipher-20' }) });
  assert.match(other, /Source in This Scope Not Found/);
  assert.doesNotMatch(other, /Compact configuration one|Compact configuration two/);
});

test('coverage counts active compact configurations while its detailed-record ledger retains historical evidence', () => {
  const html = render(extended.CoveragePage, { searchParams: new URLSearchParams({ variant: 'aes-128' }) });
  assert.match(html, /<strong>3<\/strong> reported points in AES-128/);
  assert.match(html, /<strong>2<\/strong> results/);
  assert.match(html, /aria-label="2 results, Single-key, 9 rounds"/);
  assert.match(html, /aria-label="1 result, Single-key, 10 rounds"/);
  assert.doesNotMatch(html, /aria-label="2 results, Single-key, 10 rounds"/);
  assert.match(html, /<dt>other key recovery<\/dt><dd>2<\/dd>/);
  assert.match(html, /Ledger Totals/);
  assert.match(html, /Includes historical records/);
  assert.match(html, /Historical audit action sentinel/);
  assert.match(html, /href="#\/cryptanalysis\/results\/historical-fixture\?variant=aes-128"/);
});

test('legacy reported-point URLs render the identical single table without a mode selector', () => {
  const current = render(ResultsPage, { cipherId: 'test-cipher', variantId: 'test-cipher-20', searchParams: new URLSearchParams() });
  const legacy = render(ResultsPage, { cipherId: 'test-cipher', variantId: 'test-cipher-20', searchParams: new URLSearchParams({ view: 'points' }) });
  assert.equal(legacy, current);
  assert.equal((current.match(/<table\b/g) || []).length, 1);
  assert.doesNotMatch(current, /a-view-switch|a-setting-group|a-model-points|Reported parameter points/);
});

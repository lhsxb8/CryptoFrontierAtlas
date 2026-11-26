import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {diagramFixture} from '../helpers/diagram-fixtures.mjs';
const {validateDiagramSvg, validateDiagramAssets, loadDiagramRegistry, diagramJobs, parameterMacros, digest} = createRequire(import.meta.url)('../../lib/node/primitive-diagrams.cjs');

test('synthetic structure registry and assets validate without a TeX toolchain', t => {
  const {root, catalog, manifest} = diagramFixture(t);
  assert.deepEqual(validateDiagramAssets(root, catalog).manifest, manifest);
});

test('registry requires exact instances, sources and closed metadata', async t => {
  for (const mutate of [
    r => {r.diagrams[0].instance_ids = ['unknown-fixture'];},
    r => {r.diagrams[0].instance_ids = r.diagrams[1].instance_ids;},
    r => {r.diagrams[0].views[0].template = '../../unsafe.tex';},
    r => {r.diagrams[0].design_source_ids = ['absent-fixture'];},
    r => {r.diagrams[0].specification_ids = ['absent-fixture'];},
    r => {r.diagrams[0].results = [];},
    r => {r.diagrams.push(r.diagrams[0]);},
    r => {r.diagrams.pop();},
  ]) await t.test('reject invalid binding', sub => {
    const {root, catalog, registry, write} = diagramFixture(sub); mutate(registry);
    write('data/primitives/diagrams.json', registry);
    assert.throws(() => loadDiagramRegistry(root, catalog));
  });
});

test('stale parameters, templates, metadata and generated assets are rejected', async t => {
  for (const mutate of [
    f => {f.catalog.instances[0].parameters.rounds++;},
    f => f.write('docs/figures/primitives/fixture.tex', '% changed template'),
    f => f.write('docs/figures/primitives/theme.tex', '% changed theme'),
    f => f.write('public/' + f.manifest.assets[0].asset, f.svg + '\n'),
    f => f.write('public/' + f.manifest.assets[0].tex, '% changed source'),
    f => {f.manifest.assets[0].width++; f.write('data/primitives/diagram-assets.json', f.manifest);},
    f => f.write('public/figures/primitives/unlisted.svg', f.svg),
    f => {f.manifest.assets.pop(); f.write('data/primitives/diagram-assets.json', f.manifest);},
  ]) await t.test('reject stale artifact', sub => {
    const fixture = diagramFixture(sub); mutate(fixture);
    assert.throws(() => validateDiagramAssets(fixture.root, fixture.catalog));
  });
});

test('SVG validation is a closed inert dialect, even if a malicious asset hash is recomputed', t => {
  const {root, catalog, manifest, write} = diagramFixture(t);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><script>alert(1)</script></svg>';
  manifest.assets[0].svg_sha256 = digest(svg); write('data/primitives/diagram-assets.json', manifest);
  write('public/' + manifest.assets[0].asset, svg);
  assert.throws(() => validateDiagramAssets(root, catalog), /Forbidden SVG/);
  for (const inner of [
    '<image href="https://example.invalid/image"/>', '<foreignObject/>', '<g onload="alert(1)"/>',
    '<use href="https://example.invalid/path#x"/>', '<path style="fill:red"/>', '<style>path {fill:red}</style>',
    '<use href="#missing"/>', '<path fill="url(https://example.invalid/fill)"/>', '<g><path/></svg>',
  ]) assert.throws(() => validateDiagramSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`), inner);
  assert.throws(() => validateDiagramSvg('<!DOCTYPE svg><svg viewBox="0 0 10 10"/>'));
});

test('numeric macro derivation distinguishes exact AES and Keccak Round conventions', t => {
  const {root, catalog, registry} = diagramFixture(t);
  const job = diagramJobs(root, catalog, registry)[0];
  const macros = parameterMacros({...job, family_id: 'aes', instances: [{parameters: {key_bits: 256, rounds: 14}}]});
  assert.match(macros, /\\AtlasKeyWords\}\{8\}/);
  assert.match(macros, /\\AtlasPriorRounds\}\{13\}/);
  const permutation = parameterMacros({...job, family_id: 'keccak', instances: [{parameters: {rounds: 12, state_bits: 1600}}]});
  assert.match(permutation, /\\AtlasRoundStart\}\{12\}/);
  const family = parameterMacros({...job, family_id: 'keccak', instances: [{parameters: {rounds: 24}}, {parameters: {rounds: 12}}]});
  assert.match(family, /\\AtlasRoundStart\}\{24-n\}/);
});

test('hash diagrams distinguish XOR feed-forward, word count and byte order', () => {
  const sm3 = parameterMacros({family_id: 'sm3', instances: [{parameters: {state_bits: 256, output_bits: 256, compression_steps: 64}}]});
  assert.match(sm3, /\\AtlasFeedForward\}\{\\oplus\}/);
  assert.match(sm3, /\\AtlasHashWords\}\{8\}/);
  assert.match(sm3, /\\AtlasStateBits\}\{256\}/);
  assert.match(sm3, /\\AtlasByteOrder\}\{big-endian\}/);
  const sha1 = parameterMacros({family_id: 'sha1', instances: [{parameters: {state_bits: 160, output_bits: 160, compression_steps: 80}}]});
  assert.match(sha1, /\\AtlasHashWords\}\{5\}/);
  assert.match(sha1, /\\AtlasLastStep\}\{79\}/);
  assert.match(sha1, /\\AtlasFeedForward\}\{\\boxplus\}/);
  const md5 = parameterMacros({family_id: 'md5', instances: [{parameters: {state_bits: 128, output_bits: 128, compression_steps: 64}}]});
  assert.match(md5, /\\AtlasHashWords\}\{4\}/);
  assert.match(md5, /\\AtlasByteOrder\}\{little-endian\}/);
  assert.match(md5, /\\AtlasFeedForward\}\{\\boxplus\}/);
});

test('asymmetric macro bindings preserve scheme dimensions and reject TeX-bearing labels', () => {
  const rsa = parameterMacros({family_id: 'fixture-rsa', instances: [{parameters: {scheme: 'rsaes_oaep', modulus_bits: 3072, hash: 'SHA-256'}}]});
  assert.match(rsa, /\\AtlasModulusBits\}\{3072\}/);
  assert.doesNotMatch(rsa, /\\AtlasRounds/);
  const family = parameterMacros({family_id: 'fixture-kem', instances: [2, 3, 4].map(module_rank => ({parameters: {scheme: 'ml_kem', module_rank}}))});
  assert.match(family, /\\AtlasModuleRank\}\{k\}/);
  const curve = parameterMacros({family_id: 'fixture-ecdh', instances: [{parameters: {scheme: 'ecdh', curve: 'P-384', field_bits: 384}}]});
  assert.match(curve, /\\AtlasDhPublicA\}\{\[a\]G\}/);
  assert.throws(() => parameterMacros({family_id: 'fixture-rsa', instances: [{parameters: {scheme: 'rsaes_oaep', hash: '\\input{private}'}}]}), /Unsafe/);
});

test('round groups and extra keys derive from exact instances without conflating round conventions', () => {
  for (const [rounds, groups, fl] of [[18, 3, 2], [24, 4, 3]]) {
    const macros = parameterMacros({family_id: 'camellia', instances: [{parameters: {rounds}}]});
    assert(macros.includes(`\\newcommand{\\AtlasSixRoundGroups}{${groups}}`));
    assert(macros.includes(`\\newcommand{\\AtlasFLGroups}{${fl}}`));
  }
  const family = parameterMacros({family_id: 'camellia', instances: [{parameters: {rounds: 18}}, {parameters: {rounds: 24}}]});
  assert.match(family, /\\AtlasFLGroups\}\{N_r\/6-1\}/);
  for (const [family_id, rounds] of [['aria', 12], ['aria', 14], ['aria', 16], ['present', 31]]) {
    const macros = parameterMacros({family_id, instances: [{parameters: {rounds}}]});
    assert(macros.includes(`\\newcommand{\\AtlasRoundKeys}{${rounds + 1}}`));
  }
  const salsa = parameterMacros({family_id: 'salsa20', instances: [{parameters: {key_bits: 128, nonce_bits: 64, counter_bits: 64, state_bits: 512, rounds: 20, keystream_block_bits: 512}}]});
  for (const [name, value] of [['KeyBits', 128], ['NonceBits', 64], ['CounterBits', 64], ['DoubleRounds', 10], ['StreamBlockBits', 512]]) {
    assert(salsa.includes(`\\newcommand{\\Atlas${name}}{${value}}`));
  }
});

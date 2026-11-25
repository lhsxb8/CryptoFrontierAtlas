'use strict';

const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {readFileSync, lstatSync, readdirSync} = require('node:fs');
const {join} = require('node:path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const sourceDirectory = 'docs/figures/primitives';
const assetDirectory = 'public/figures/primitives';
const manifestFile = 'data/primitives/diagram-assets.json';
const digest = value => createHash('sha256').update(value).digest('hex');
const json = (root, file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
function regularFile(root, file) {
  let path = root;
  for (const segment of file.split('/')) {
    path = join(path, segment);
    assert(!lstatSync(path).isSymbolicLink(), `Diagram path must not be redirected: ${file}`);
  }
  assert(lstatSync(path).isFile(), `Expected diagram file: ${file}`);
  return readFileSync(path, 'utf8');
}

function loadDiagramRegistry(root, catalog) {
  const registry = json(root, 'data/primitives/diagrams.json');
  const ajv = new Ajv({allErrors: true, strict: true}); addFormats(ajv);
  const validate = ajv.compile(json(root, 'schemas/primitives/diagrams.schema.json'));
  assert(validate(registry), `Invalid diagram registry: ${ajv.errorsText(validate.errors)}`);
  const sources = new Set(registry.design_sources.map(s => s.id));
  assert.equal(sources.size, registry.design_sources.length, 'Duplicate design source');
  for (const source of [registry.style_reference, ...registry.design_sources]) {
    const url = new URL(source.url);
    assert(!url.username && !url.password, 'Credential-bearing diagram URL');
  }
  const families = new Set(), bound = new Set();
  for (const diagram of registry.diagrams) {
    assert(!families.has(diagram.family_id), 'Duplicate diagram family'); families.add(diagram.family_id);
    const family = catalog.primitives.find(p => p.id === diagram.family_id);
    assert(family, `Unknown diagram family: ${diagram.family_id}`);
    for (const id of diagram.instance_ids) {
      assert(!bound.has(id), `Duplicate diagram instance: ${id}`); bound.add(id);
      assert(catalog.instances.some(i => i.id === id && i.family_id === diagram.family_id), `Wrong diagram binding: ${id}`);
    }
    assert(diagram.specification_ids.every(id => family.specification_ids.includes(id)), 'Wrong diagram specification');
    assert(diagram.design_source_ids.every(id => sources.has(id)), 'Unknown design source');
    assert.equal(new Set(diagram.views.map(v => v.id)).size, diagram.views.length, 'Duplicate diagram view');
    assert(diagram.views.some(v => v.id === 'overview'), 'An overview is required');
    for (const view of diagram.views) regularFile(root, `${sourceDirectory}/${view.template}`);
    if (diagram.compact_template) regularFile(root, `${sourceDirectory}/${diagram.compact_template}`);
  }
  assert(catalog.instances.every(i => bound.has(i.id)), 'Every public instance needs an explicit diagram binding');
  return registry;
}

function diagramJobs(root, catalog, registry) {
  const common = ['data/primitives/diagrams.json', `${sourceDirectory}/theme.tex`,
    'lib/node/primitive-diagrams.cjs', 'scripts/build-diagrams.mjs'].map(file => regularFile(root, file));
  return registry.diagrams.flatMap(diagram => [diagram.family_id, ...diagram.instance_ids].flatMap(targetId => {
    const instance = catalog.instances.find(i => i.id === targetId);
    const instances = instance ? [instance] : diagram.instance_ids.map(id => catalog.instances.find(i => i.id === id));
    const binding = JSON.stringify(instances);
    const views = [...diagram.views];
    if (diagram.compact_template) views.push({...diagram.views.find(v => v.id === 'overview'), id: 'overview-compact', template: diagram.compact_template});
    return views.map(view => ({
      target_id: targetId, family_id: diagram.family_id, view_id: view.id,
      asset: `figures/primitives/${targetId}--${view.id}.svg`,
      tex: `figures/primitives/${targetId}--${view.id}.tex`,
      parameters_sha256: digest(binding),
      source_sha256: digest(JSON.stringify([...common, regularFile(root, `${sourceDirectory}/${view.template}`), binding])),
      diagram, view, instances,
    }));
  }));
}

function parameterMacros(job) {
  const values = job.instances.map(i => i.parameters);
  function field(key, symbol) {
    const unique = [...new Set(values.map(p => p[key]))];
    return unique.length === 1 && typeof unique[0] === 'number' ? String(unique[0]) : symbol;
  }
  function derived(value, operation, symbolic) { return /^\d+$/.test(value) ? String(operation(Number(value))) : symbolic; }
  const rounds = field('rounds', job.family_id === 'keccak' ? 'n' : 'N_r');
  const steps = field('compression_steps', 'N');
  const key = field('key_bits', 'k');
  const state = field('state_bits', '8w');
  const definitions = {
    AtlasKeyBits: key, AtlasKeyWords: derived(key, n => n / 32, 'N_k'),
    AtlasRounds: rounds, AtlasPriorRounds: derived(rounds, n => n - 1, 'N_r-1'),
    AtlasRoundKeys: derived(rounds, n => n + 1, 'N_r+1'),
    AtlasDoubleRounds: derived(rounds, n => n / 2, 'N_r/2'),
    AtlasSixRoundGroups: derived(rounds, n => n / 6, 'N_r/6'),
    AtlasFLGroups: derived(rounds, n => n / 6 - 1, 'N_r/6-1'),
    AtlasRoundStart: derived(rounds, n => 24 - n, '24-n'),
    AtlasBlockBits: field('block_bits', 'b'), AtlasOutputBits: field('output_bits', 'd'),
    AtlasStateBits: state, AtlasNonceBits: field('nonce_bits', 'v'),
    AtlasCounterBits: field('counter_bits', 'q'), AtlasStreamBlockBits: field('keystream_block_bits', 'b'),
    AtlasRate: field('rate_bits', 'r'), AtlasCapacity: field('capacity_bits', 'c'),
    AtlasSteps: steps, AtlasLastStep: derived(steps, n => n - 1, 'N-1'),
    AtlasWordBits: derived(state, n => n / 8, 'w'),
    AtlasHashWords: derived(state, n => n / 32, 'h'),
    AtlasFeedForward: job.family_id === 'sm3' ? '\\oplus' : '\\boxplus',
    AtlasByteOrder: job.family_id === 'md5' ? 'little-endian' : 'big-endian',
    AtlasDomain: job.family_id === 'shake' ? '1111' : '01',
  };
  return Object.entries(definitions).map(([name, value]) => `\\newcommand{\\${name}}{${value}}`).join('\n')
    + `\n\\newif\\ifAtlasXof\n\\AtlasXof${job.family_id === 'shake' ? 'true' : 'false'}\n`;
}

function diagramTex(root, job) {
  return '% Generated from the public primitive catalog. Original Atlas drawing; Apache-2.0.\n'
    + `% Target: ${job.target_id}; view: ${job.view_id}\n`
    + '\\documentclass[border=9pt]{standalone}\n'
    + regularFile(root, `${sourceDirectory}/theme.tex`) + '\n' + parameterMacros(job)
    + '\\begin{document}\n' + regularFile(root, `${sourceDirectory}/${job.view.template}`)
    + '\n\\end{document}\n';
}

/** Closed, non-interactive SVG dialect emitted by dvisvgm --no-fonts.
 * Reject unknown elements/attributes, external references, CSS and declarations.
 * The frontend also uses <img>, never innerHTML, for these documents.
 */
function validateDiagramSvg(svg) {
  assert(svg.length < 2_000_000, 'Diagram SVG too large');
  assert(!/<[!?]|\bon\w+\s*=|\b(?:javascript|data):/i.test(svg), 'Active SVG content or declaration');
  const tags = new Set(['svg', 'g', 'defs', 'path', 'use', 'rect', 'clipPath', 'title', 'desc']);
  const attributes = new Set(['xmlns', 'xmlns:xlink', 'version', 'width', 'height', 'viewBox', 'id', 'd', 'x', 'y',
    'x1', 'x2', 'y1', 'y2', 'rx', 'ry', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-opacity', 'opacity', 'transform', 'clip-path', 'clip-rule', 'href', 'xlink:href']);
  const stack = [], ids = new Set(), references = [];
  let cursor = 0, roots = 0;
  for (const match of svg.matchAll(/<(\/?)([A-Za-z][\w:-]*)([^<>]*?)(\/?)>/g)) {
    const text = svg.slice(cursor, match.index);
    assert(!/[<>]/.test(text), 'Malformed SVG markup');
    assert(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(text), 'Unsupported SVG text entity');
    assert(['title', 'desc'].includes(stack.at(-1)) || !text.trim(), 'Unexpected SVG text');
    const [, closing, tag, attrs, selfClosing] = match;
    assert(tags.has(tag), `Forbidden SVG element: ${tag}`);
    if (closing) { assert(!attrs.trim() && !selfClosing && stack.pop() === tag, 'Unbalanced SVG element'); }
    else {
      if (!stack.length) { assert(tag === 'svg' && ++roots === 1, 'Invalid SVG root'); }
      else assert(tag !== 'svg', 'Nested SVG root');
      let rest = attrs;
      const names = new Set();
      while (rest.trim()) {
        const attr = /^\s+([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(rest);
        assert(attr, 'Malformed SVG attribute');
        const name = attr[1], value = attr[2] ?? attr[3];
        assert(!names.has(name), 'Duplicate SVG attribute'); names.add(name);
        assert(attributes.has(name), `Forbidden SVG attribute: ${name}`);
        assert(!/[&<>]/.test(value), 'Escaped SVG attribute values are not supported');
        if (name === 'xmlns') assert.equal(value, 'http://www.w3.org/2000/svg');
        else if (name === 'xmlns:xlink') assert.equal(value, 'http://www.w3.org/1999/xlink');
        else assert(!/https?:|\/\/|url\((?!#[\w.-]+\))/i.test(value), 'External SVG reference');
        if (name === 'href' || name === 'xlink:href') { assert(/^#[\w.-]+$/.test(value), 'External SVG use'); references.push(value.slice(1)); }
        if (name === 'clip-path') { assert(/^url\(#[\w.-]+\)$/.test(value), 'External SVG clip'); references.push(value.slice(5, -1)); }
        if (name === 'id') { assert(!ids.has(value), 'Duplicate SVG ID'); ids.add(value); }
        rest = rest.slice(attr[0].length);
      }
      if (tag === 'svg') assert(names.has('xmlns') && names.has('viewBox'), 'SVG namespace and viewBox are required');
      if (!selfClosing) stack.push(tag);
    }
    cursor = match.index + match[0].length;
  }
  assert(roots === 1 && stack.length === 0 && !svg.slice(cursor).trim(), 'Incomplete SVG');
  assert(references.every(id => ids.has(id)), 'Unresolved SVG reference');
  const viewBox = /\bviewBox=['"]([\d.eE+\s-]+)['"]/.exec(svg)?.[1].trim().split(/\s+/).map(Number);
  assert(viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0, 'Invalid SVG viewBox');
  return {width: viewBox[2], height: viewBox[3]};
}

function validateDiagramAssets(root, catalog, registry = loadDiagramRegistry(root, catalog)) {
  const manifest = json(root, manifestFile);
  assert.deepEqual(Object.keys(manifest).sort(), ['assets', 'schema_version', 'toolchain']);
  assert.equal(manifest.schema_version, 1, 'Unsupported diagram asset manifest');
  assert(manifest.toolchain && Object.keys(manifest.toolchain).sort().join(',') === 'dvisvgm,latex'
    && Object.values(manifest.toolchain).every(v => typeof v === 'string' && v.length > 0 && v.length < 200), 'Missing toolchain receipt');
  const jobs = diagramJobs(root, catalog, registry);
  assert.equal(manifest.assets.length, jobs.length, 'Incomplete diagram asset manifest');
  const expectedFiles = [];
  jobs.forEach((job, index) => {
    const entry = manifest.assets[index];
    assert.deepEqual(Object.keys(entry).sort(), ['asset', 'family_id', 'height', 'parameters_sha256', 'source_sha256', 'svg_sha256', 'target_id', 'tex', 'tex_sha256', 'view_id', 'width']);
    for (const key of ['target_id', 'family_id', 'view_id', 'asset', 'tex', 'parameters_sha256', 'source_sha256'])
      assert.equal(entry[key], job[key], `Stale diagram ${job.target_id}/${job.view_id}: ${key}; run npm run diagrams:build`);
    const svg = regularFile(root, 'public/' + entry.asset), tex = regularFile(root, 'public/' + entry.tex);
    assert.equal(entry.svg_sha256, digest(svg), `SVG hash mismatch: ${entry.asset}`);
    assert.equal(tex, diagramTex(root, job), `Stale TeX: ${entry.tex}`);
    assert.equal(entry.tex_sha256, digest(tex), `TeX hash mismatch: ${entry.tex}`);
    const size = validateDiagramSvg(svg);
    assert.equal(entry.width, size.width); assert.equal(entry.height, size.height);
    expectedFiles.push(entry.asset.split('/').at(-1), entry.tex.split('/').at(-1));
  });
  assert.deepEqual(readdirSync(join(root, assetDirectory)).sort(), expectedFiles.sort(), 'Unexpected generated diagram files');
  return {registry, manifest};
}

module.exports = {sourceDirectory, assetDirectory, manifestFile, digest, loadDiagramRegistry, diagramJobs,
  parameterMacros, diagramTex, validateDiagramSvg, validateDiagramAssets};

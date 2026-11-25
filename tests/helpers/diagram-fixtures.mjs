import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {catalogFixture} from './primitive-catalog-fixtures.mjs';
const project = fileURLToPath(new URL('../..', import.meta.url));
const {diagramJobs, diagramTex, digest} = createRequire(import.meta.url)('../../lib/node/primitive-diagrams.cjs');

/** Synthetic source and inert assets: no literature or private corpus fixtures. */
export function diagramFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'atlas-diagram-fixture-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const write = (file, value) => {
    const location = join(root, file); mkdirSync(dirname(location), {recursive: true});
    writeFileSync(location, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const catalog = catalogFixture();
  const registry = {
    schema_version: 1,
    style_reference: {title: 'Synthetic style', author: 'Fixture', url: 'https://example.invalid/style', note: 'Test-only drawing'},
    design_sources: [],
    diagrams: catalog.primitives.map(family => ({
      family_id: family.id, instance_ids: catalog.instances.filter(i => i.family_id === family.id).map(i => i.id),
      specification_ids: family.specification_ids, design_source_ids: [], locator: 'Synthetic section',
      review: {status: 'source_checked', checked_on: '2026-01-01'},
      views: [{id: 'overview', template: 'fixture.tex', label: {en: 'Fixture', zh: '测试'}, caption: {en: 'Synthetic diagram', zh: '测试结构图'}}],
    })),
  };
  write('data/primitives/diagrams.json', registry);
  write('data/primitives/catalog.json', catalog);
  for (const file of ['schemas/primitives/diagrams.schema.json', 'lib/node/primitive-diagrams.cjs', 'scripts/build-diagrams.mjs']) write(file, readFileSync(join(project, file), 'utf8'));
  write('docs/figures/primitives/theme.tex', '% Synthetic theme\n');
  write('docs/figures/primitives/fixture.tex', '% Synthetic template\n');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><title>Fixture</title><path id="p" d="M0 0 L10 10"/><use href="#p" x="10"/></svg>';
  const assets = diagramJobs(root, catalog, registry).map(job => {
    const tex = diagramTex(root, job), {diagram, view, instances, ...identity} = job;
    write('public/' + job.asset, svg); write('public/' + job.tex, tex);
    return {...identity, svg_sha256: digest(svg), tex_sha256: digest(tex), width: 100, height: 50};
  });
  const manifest = {schema_version: 1, toolchain: {latex: 'Synthetic TeX', dvisvgm: 'Synthetic converter'}, assets};
  write('data/primitives/diagram-assets.json', manifest);
  return {root, write, catalog, registry, manifest, svg};
}

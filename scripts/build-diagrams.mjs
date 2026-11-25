import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const {loadPrimitiveCatalog} = require('../lib/node/primitive-catalog.cjs');
const {assetDirectory, manifestFile, digest, loadDiagramRegistry, diagramJobs, diagramTex, validateDiagramSvg} = require('../lib/node/primitive-diagrams.cjs');
const catalog = loadPrimitiveCatalog(root), registry = loadDiagramRegistry(root, catalog);
const verify = process.argv.includes('--verify');
assert(process.argv.slice(2).every(arg => arg === '--verify'), 'Usage: build-diagrams.mjs [--verify]');
const work = mkdtempSync(join(tmpdir(), 'atlas-tikz-'));
function run(command, args, cwd = work) {
  const result = spawnSync(command, args, {cwd, encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
    env: {...process.env, SOURCE_DATE_EPOCH: '0', FORCE_SOURCE_DATE: '1', openin_any: 'p', openout_any: 'p'}});
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
try {
  const toolchain = {latex: run('latex', ['--version']).split('\n')[0], dvisvgm: run('dvisvgm', ['--version']).split('\n')[0]};
  if (verify) assert.deepEqual(toolchain, JSON.parse(readFileSync(join(root, manifestFile), 'utf8')).toolchain,
    'Regeneration verification requires the recorded TeX/converter versions');
  const assets = [], staged = [];
  for (const job of diagramJobs(root, catalog, registry)) {
    const tex = diagramTex(root, job);
    writeFileSync(join(work, 'figure.tex'), tex);
    run('latex', ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'figure.tex']);
    run('dvisvgm', ['--no-fonts', '--exact', '--bbox=min', '--output=figure.svg', 'figure.dvi']);
    let raw = readFileSync(join(work, 'figure.svg'), 'utf8').replace(/<\?xml[\s\S]*?\?>\s*/g, '').replace(/<!--[\s\S]*?-->\s*/g, '');
    validateDiagramSvg(raw);
    // Keep strokes and glyphs clear of the exported viewport, including when
    // rasterized at narrow screen sizes. dvisvgm's minimal box has no inset.
    raw = raw.replace(/<svg\b[^>]*>/, opening => {
      const [x, y, width, height] = /\bviewBox=['"]([^'"]+)['"]/.exec(opening)[1].trim().split(/\s+/).map(Number);
      const padded = [x - 6, y - 6, width + 12, height + 12].map(number => Number(number.toFixed(6)));
      return opening.replace(/\bviewBox=['"][^'"]+['"]/, `viewBox='${padded.join(' ')}'`)
        .replace(/\bwidth=['"][^'"]+['"]/, `width='${padded[2]}pt'`)
        .replace(/\bheight=['"][^'"]+['"]/, `height='${padded[3]}pt'`);
    });
    const svg = raw.replace(/(<svg\b[^>]*>)/, `$1\n<title>${escapeXml(job.target_id + ': ' + job.view.label.en)}</title>\n<desc>${escapeXml(job.view.caption.en)}</desc>`);
    const size = validateDiagramSvg(svg);
    const {diagram, view, instances, ...identity} = job;
    assets.push({...identity, svg_sha256: digest(svg), tex_sha256: digest(tex), ...size});
    for (const [file, text] of [[job.asset, svg], [job.tex, tex]]) {
      const temporary = join(work, file.split('/').at(-1)); writeFileSync(temporary, text);
      staged.push([temporary, join(root, 'public', file)]);
    }
    console.log(`Generated ${job.target_id} / ${job.view_id}`);
  }
  // Publish only after every trusted template has compiled and passed validation.
  const receipt = JSON.stringify({schema_version: 1, toolchain, assets}, null, 2) + '\n';
  if (verify) {
    for (const [temporary, destination] of staged) assert(readFileSync(temporary).equals(readFileSync(destination)), `Regeneration differs: ${destination.split('/').at(-1)}`);
    assert.equal(readFileSync(join(root, manifestFile), 'utf8'), receipt, 'Regeneration manifest differs');
    console.log(`PASS: ${assets.length} figures regenerate byte-for-byte with the recorded toolchain.`);
  } else {
  mkdirSync(join(root, assetDirectory), {recursive: true});
  for (const [temporary, destination] of staged) writeFileSync(destination, readFileSync(temporary));
  const next = join(root, manifestFile + '.tmp');
  writeFileSync(next, receipt);
  renameSync(next, join(root, manifestFile));
  console.log(`Built ${assets.length} diagrams; ordinary site builds do not require TeX.`);
  }
} finally { rmSync(work, {recursive: true, force: true}); }

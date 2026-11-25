import {existsSync, lstatSync, readFileSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {privateAnalysisMarkers, privateWorkspacePath, publicationPatterns} from './check-public-bundle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {loadPrimitiveCatalog} = createRequire(import.meta.url)('../lib/node/primitive-catalog.cjs');
const {validateDiagramAssets} = createRequire(import.meta.url)('../lib/node/primitive-diagrams.cjs');
const {validatePublishedDataset, checkExport} = createRequire(import.meta.url)('../lib/node/cryptanalysis/published.cjs');
const {validatePublicAssets} = createRequire(import.meta.url)('../lib/node/public-assets.cjs');
const localOutput = /^(?:node_modules|dist(?:-local)?|test-results|playwright-report|blob-report|coverage|\.git)(?:\/|$)|(?:\.log|\.tsbuildinfo)$/;
const exportedDirectories = new Set(['.github', 'src', 'lib', 'build', 'scripts', 'schemas', 'tests', 'data', 'docs', 'public', 'licenses']);
const exportedRootFiles = new Set(['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'LICENSE', 'LICENSE-DATA.md', 'LICENSE-CC-BY-4.0.txt', 'THIRD_PARTY_NOTICES.txt', 'CITATION.cff', 'package.json', 'package-lock.json', 'project.config.json', 'atlas.config.cjs', 'vite.config.ts', 'playwright.config.ts', 'index.html', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', '.gitignore', '.gitattributes', '.node-version', '.npmrc', '.env.example']);

export function publicSourceFiles(projectRoot = root) {
  if (existsSync(join(projectRoot, '.git'))) {
    const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd:projectRoot, encoding:'utf8', maxBuffer:32*1024*1024});
    if (result.error || result.status !== 0) throw new Error('Cannot enumerate candidate Git source files.');
    return [...new Set(result.stdout.split('\0').filter(Boolean))].sort();
  }
  // Check source exports before Git initialization using the same path policy.
  const files = [];
  function visit(directory, prefix = '') {
    for (const entry of readdirSync(directory, {withFileTypes:true})) {
      const file = prefix + entry.name;
      if (localOutput.test(file) || privateWorkspacePath(file) || entry.name === '.DS_Store') continue;
      if (!prefix && !exportedRootFiles.has(file) && !exportedDirectories.has(file)) throw new Error(`Unreviewed root path: ${file}`);
      if (entry.isSymbolicLink()) throw new Error(`Unchecked source symlink: ${file}`);
      if (entry.isDirectory()) visit(join(directory, entry.name), file + '/');
      else files.push(file);
    }
  }
  visit(projectRoot);
  return files.sort();
}

export function checkPublicSource({projectRoot = root, markerRoot = process.env.ATLAS_PRIVATE_REFERENCE || projectRoot} = {}) {
  if (resolve(markerRoot) !== resolve(projectRoot) && !existsSync(join(markerRoot, 'data/cryptanalysis/manifest.json'))) {
    throw new Error('The requested private reference corpus is missing; exact checks were not performed.');
  }
  const markers = existsSync(join(markerRoot, 'data/cryptanalysis/manifest.json')) ? privateAnalysisMarkers(markerRoot, projectRoot) : [];
  const patterns = publicationPatterns(projectRoot);
  const files = publicSourceFiles(projectRoot);
  const findings = [];
  for (const file of files) {
    const location = join(projectRoot, file);
    if (privateWorkspacePath(file)) { findings.push(`${file}: private path`); continue; }
    if (!existsSync(location) || !lstatSync(location).isFile() || lstatSync(location).isSymbolicLink()) throw new Error(`Missing or redirected candidate source: ${file}`);
    const text = readFileSync(location, 'utf8');
    if (markers.some(marker => text.includes(marker.value))) findings.push(`${file}: private corpus content`);
    if (patterns.some(pattern => pattern.test(text))) findings.push(`${file}: restricted content`);
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
      || /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16})\b/.test(text)) findings.push(`${file}: credential-like content`);
  }
  if (findings.length) throw new Error('Public source rejected:\n' + [...new Set(findings)].slice(0,30).join('\n'));
  if (files.includes('data/primitives/catalog.json')) {
    const catalog = loadPrimitiveCatalog(projectRoot);
    if (files.includes('data/primitives/diagrams.json')) {
      validateDiagramAssets(projectRoot, catalog);
      validatePublicAssets(projectRoot);
    }
  }
  if (files.includes('data/cryptanalysis-public/publication.json')) {
    validatePublishedDataset(projectRoot);
    if (existsSync(join(projectRoot, 'data/cryptanalysis/manifest.json'))) checkExport(projectRoot);
  }
  return {fileCount:files.length, markerCount:markers.length};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = checkPublicSource(); console.log(`PASS: ${result.fileCount} candidate source files inspected.`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

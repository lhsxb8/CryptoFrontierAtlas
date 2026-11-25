import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const allowed = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0']);
function packageDirectory(name, from = root) {
  let parent = from;
  while (true) {
    const directory = join(parent, 'node_modules', name);
    if (existsSync(join(directory, 'package.json'))) return directory;
    const next = dirname(parent);
    if (next === parent) throw new Error(`Install dependencies before checking licenses: ${name}`);
    parent = next;
  }
}
export function licenseNotices() {
  const packages = new Map();
  function visit(name, from) {
    const directory = packageDirectory(name, from);
    const metadata = json(join(directory, 'package.json'));
    const key = `${metadata.name}@${metadata.version}`;
    if (packages.has(key)) return;
    if (!allowed.has(metadata.license)) throw new Error(`Review license before distribution: ${key} (${metadata.license})`);
    const files = readdirSync(directory).filter(name => /^(?:licen[cs]e|notice)(?:[.-].*)?$/i.test(name)).sort();
    if (!files.some(file => /^licen[cs]e/i.test(file))) throw new Error(`Missing full license: ${key}`);
    packages.set(key, files.map(file => `${file}\n\n${readFileSync(join(directory, file), 'utf8').trim()}\n`).join('\n'));
    for (const dependency of Object.keys(metadata.dependencies ?? {})) visit(dependency, directory);
  }
  for (const name of Object.keys(json(join(root, 'package.json')).dependencies)) visit(name, root);
  // Vite supplies the distributed module-preload helper. Its license file
  // also preserves the notices shipped by that package.
  const vite = packageDirectory('vite');
  const metadata = json(join(vite, 'package.json'));
  packages.set(`vite@${metadata.version} (build runtime helper)`, readFileSync(join(vite, 'LICENSE.md'), 'utf8').trim() + '\n');
  for (const [name, file] of [
    ['KaTeX fonts (MIT)', 'licenses/katex-fonts-MIT.txt'],
    ['Source Serif 4 (SIL Open Font License 1.1)', 'public/fonts/source-serif/LICENSE.md'],
    ['Feather icons incorporated by Lucide (MIT)', 'licenses/feather-MIT.txt'],
  ]) packages.set(name, readFileSync(join(root, file), 'utf8').trim() + '\n');
  return 'Third-party notices for the CryptoFrontierAtlas website\n\n'
    + 'Generated from lockfile-pinned runtime dependencies, build runtime helpers and bundled font licenses.\n'
    + 'Run npm run licenses:generate after updating dependencies. Upstream texts follow verbatim.\n\n'
    + [...packages].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, text]) => `${'='.repeat(72)}\n${name}\n${'='.repeat(72)}\n\n${text}`).join('\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = join(root, 'THIRD_PARTY_NOTICES.txt');
  const expected = licenseNotices();
  if (process.argv[2] === '--write') writeFileSync(destination, expected);
  else if (process.argv[2] !== '--check') throw new Error('Usage: node scripts/licenses.mjs <--check|--write>');
  else if (!existsSync(destination) || readFileSync(destination, 'utf8') !== expected) throw new Error('Third-party notices are stale; run npm run licenses:generate.');
  for (const file of ['LICENSE', 'LICENSE-DATA.md', 'LICENSE-CC-BY-4.0.txt']) {
    if (!existsSync(join(root, file))) throw new Error(`Missing distribution license: ${file}`);
  }
  console.log('PASS: project, data and dependency license materials.');
}

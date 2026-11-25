import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = dir => readdirSync(resolve(root, dir), {withFileTypes:true}).flatMap(entry =>
  entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
const violations = [];
for (const file of ['src', 'lib', 'build', 'scripts'].flatMap(files).filter(file => /\.(?:[cm]?js|tsx?)$/.test(file) && !file.includes('.test.'))) {
  const source = readFileSync(resolve(root, file), 'utf8');
  const imports = [...source.matchAll(/(?:\bfrom\s*|\brequire\s*\(|\bimport\s*\()\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const name of imports) {
    const target = name.startsWith('.') ? relative(root, resolve(root, dirname(file), name)) : name;
    const forbidden = file.startsWith('lib/cryptanalysis/')
      ? /^(?:node:|fs$|path$|react|vite|src\/|build\/|lib\/node\/|\.agents\/)/.test(target)
      : file.startsWith('lib/node/') ? /^(?:src\/|build\/|\.agents\/)/.test(target)
      : file.startsWith('src/') ? /^(?:lib\/node\/|build\/|\.agents\/|data\/cryptanalysis\/)/.test(target) : false;
    if (forbidden) violations.push(`${file} -> ${target}`);
  }
}
assert.deepEqual(violations, [], `Architecture boundary violations:\n${violations.join('\n')}`);
assert(!existsSync(resolve(root, 'CryptanalysisFrontierAtlas/package.json')), 'A second application package must not return.');
console.log('PASS: core, Node, build, UI and skill dependency boundaries.');

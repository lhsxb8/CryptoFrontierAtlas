import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {checkVersion, citationScalar} = createRequire(import.meta.url)('../lib/node/release.cjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = JSON.parse(readFileSync(resolve(root, 'project.config.json'), 'utf8'));
assert.equal(project.name, 'CryptoFrontierAtlas');
assert.deepEqual(Object.keys(project).sort(), ['name', 'repository']);
if (project.repository !== null) {
  assert.match(project.repository, /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/);
  const url = new URL(project.repository);
  assert(!url.username && !url.password && !url.search && !url.hash);
}
if (process.argv.includes('--ready')) {
  assert(project.repository, 'Set the new public repository in project.config.json before publication.');
  const citation = resolve(root, 'CITATION.cff');
  assert(existsSync(citation), 'Add CITATION.cff with the real authors and release metadata before publication.');
  const text = readFileSync(citation, 'utf8');
  checkVersion(root, {requireCitation: true, tag: process.env.ATLAS_RELEASE_TAG || ''});
  assert.equal(citationScalar(text, 'repository-code'), project.repository, 'CITATION.cff must use the configured public repository.');
  assert.match(text, /^authors:\s*\n\s+- /m);
  assert.match(text, /^\s+(?:-\s+)?(?:name|family-names):\s*\S+/m, 'Add named authors or an authoring organization.');
  assert.equal(citationScalar(text, 'cff-version'), '1.2.0');
  assert.equal(citationScalar(text, 'license'), 'CC-BY-4.0', 'Use the curated dataset license in the citation.');
  const date = citationScalar(text, 'date-released');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date || ''), 'Set the actual release date.');
  const timestamp = Date.parse(date + 'T00:00:00Z');
  assert(Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
    && date <= new Date().toISOString().slice(0, 10), 'Use a valid, non-future release date.');
  assert(!/anonymous|\bTODO\b|\bTBD\b/i.test(text), 'Complete the citation identity before publication.');
  console.log('PASS: publication identity is configured.');
} else console.log(`PASS: project configuration${project.repository ? '' : ' (publication identity pending)'}.`);

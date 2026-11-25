import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writePublicationFixture} from '../helpers/publication-fixtures.mjs';

const require = createRequire(import.meta.url);
const {createPublicationPolicy} = require('../../lib/node/cryptanalysis/publication-policy.cjs');
const {shapes} = require('../../lib/node/cryptanalysis/structure-contracts.cjs');
const {exportPublishedDataset, validatePublishedDataset, fileInventory} = require('../../lib/node/cryptanalysis/published.cjs');
const {validateDataset} = require('../../lib/node/cryptanalysis/check-data.cjs');
const json = value => JSON.stringify(value, null, 2) + '\n';
const digest = value => createHash('sha256').update(value).digest('hex');
const fingerprint = dir => digest(fileInventory(dir).map(f => f + '\0' + readFileSync(join(dir, f), 'utf8')).join('\n'));
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const edit = (file, change) => {const value = read(file); change(value); writeFileSync(file, json(value));};
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'atlas-field-policy-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  return {root, ...writePublicationFixture(root), output: join(root, 'data/cryptanalysis-public'),
    policy: join(root, 'schemas/cryptanalysis/publication-fields.json'), sourceSchema: join(root, 'schemas/cryptanalysis/source.schema.json'),
    resultSchema: join(root, 'schemas/cryptanalysis/result.schema.json')};
}
function rehash(output, name) {
  edit(join(output, 'publication.json'), receipt => {
    receipt.files[name] = digest(readFileSync(join(output, name)));
    receipt.data_sha256 = digest(json(receipt.files));
  });
}

test('schema-approved optional fields block publication even before data uses them', t => {
  const f = fixture(t); exportPublishedDataset(f.root);
  const previous = fingerprint(f.output), raw = fingerprint(f.directory);
  edit(f.sourceSchema, s => {s.properties.curator_message = {type: 'string'};});
  assert.doesNotThrow(() => validateDataset(f.root));
  assert.throws(() => createPublicationPolicy(f.root), /source\/curator_message: unclassified publication field/);
  assert.throws(() => exportPublishedDataset(f.root), /unclassified publication field/);
  assert.throws(() => validatePublishedDataset(f.root), /unclassified publication field/);
  assert.equal(fingerprint(f.output), previous); assert.equal(fingerprint(f.directory), raw);
});

test('an independently classified internal source field is omitted and a public one is retained', t => {
  const f = fixture(t);
  edit(f.sourceSchema, s => {s.properties.curator_message = {type: 'string'};});
  f.source.curator_message = 'Synthetic ordinary editorial discussion'; f.write('sources.json', [f.source]);
  assert.doesNotThrow(() => validateDataset(f.root));
  assert.throws(() => exportPublishedDataset(f.root), /unclassified/);
  edit(f.policy, p => p.documents.source.internal.push('/curator_message'));
  const raw = fingerprint(f.directory);
  exportPublishedDataset(f.root);
  assert.equal(validatePublishedDataset(f.root).data.sources[0].curator_message, undefined);
  assert.equal(fingerprint(f.directory), raw);
  // Integrity receipts are not an authorization mechanism: even a rehashed
  // hand-crafted public snapshot must reject the internal field.
  edit(join(f.output, 'sources.json'), sources => {sources[0].curator_message = f.source.curator_message;});
  rehash(f.output, 'sources.json');
  assert.throws(() => validatePublishedDataset(f.root), /internal field in public data/);
  edit(f.policy, p => {p.documents.source.internal = []; p.documents.source.public.push('/curator_message');});
  exportPublishedDataset(f.root);
  assert.equal(validatePublishedDataset(f.root).data.sources[0].curator_message, f.source.curator_message);
});

test('nested objects, arrays and inactive conditional branches need independent classifications', async t => {
  for (const location of ['nested', 'array', 'conditional']) await t.test(location, sub => {
    const f = fixture(sub);
    let document, path;
    if (location === 'array') {
      document = 'result'; path = '/evidence/*/curator_message';
      edit(f.resultSchema, s => {s.properties.evidence.items.properties.curator_message = {type: 'string'};});
      f.record.evidence[0].curator_message = 'Synthetic editorial discussion'; f.write('results/' + f.record.id + '.json', f.record);
    } else {
      document = 'source'; path = location === 'nested' ? '/publication/curator_message' : '/curator_message';
      edit(f.sourceSchema, s => {
        if (location === 'nested') s.properties.publication.properties.curator_message = {type: 'string'};
        else (s.allOf ??= []).push({if: {properties: {year: {const: 2099}}}, then: {properties: {curator_message: {type: 'string'}}}});
      });
      if (location === 'nested') {f.source.publication.curator_message = 'Synthetic editorial discussion'; f.write('sources.json', [f.source]);}
    }
    assert.doesNotThrow(() => validateDataset(f.root));
    assert.throws(() => createPublicationPolicy(f.root), /unclassified/);
    edit(f.policy, p => p.documents[document].internal.push(path));
    exportPublishedDataset(f.root);
    assert(!JSON.stringify(validatePublishedDataset(f.root).data).includes('Synthetic editorial discussion'));
  });
});

test('a scalar becoming a nested object cannot inherit blanket public permission', t => {
  const f = fixture(t);
  edit(f.sourceSchema, s => {s.properties.hash_note = {type: 'object', additionalProperties: false, properties: {curator_message: {type: 'string'}}};});
  assert.throws(() => createPublicationPolicy(f.root), /hash_note\/curator_message: unclassified/);
});

test('procedural family and presentation field declarations also fail closed when extended', t => {
  const f = fixture(t);
  for (const name of ['family', 'familyDisplay', 'comparison']) {
    shapes[name].properties.curator_message = {type: 'string'};
    try {assert.throws(() => createPublicationPolicy(f.root), /curator_message: unclassified/);}
    finally {delete shapes[name].properties.curator_message;}
  }
});

test('policy errors, required/private conflicts and unsupported schemas are rejected', t => {
  const f = fixture(t), original = read(f.policy);
  for (const mutate of [
    p => p.documents.source.public.push('/title'),
    p => p.documents.source.public.push('/not_a_field'),
    p => p.documents.source.internal.push('/title'),
    p => {p.documents.source.public = p.documents.source.public.filter(x => x !== '/title'); p.documents.source.internal.push('/title');},
    p => {p.documents.source.transforms['/locators/*'] = 'unknown-transform';},
    p => {p.documents.entry.reuse = {entry: ['/id']};},
    p => {p.documents.source.order = {'/missing': ['title']};},
  ]) {const policy = structuredClone(original); mutate(policy); assert.throws(() => createPublicationPolicy(f.root, {policy}));}
  edit(f.sourceSchema, s => {s.patternProperties = {'.*': {}};});
  assert.throws(() => createPublicationPolicy(f.root), /Unsupported publication schema keyword/);
});

test('dictionary keys are data but dictionary values cannot acquire new fields', t => {
  const f = fixture(t), policy = createPublicationPolicy(f.root);
  const family = read(join(f.directory, 'result-families/aes.json'));
  family.families[0].points[0].values.q = {curator_message: 'Synthetic discussion'};
  assert.throws(() => policy.project('family', family), /unexpected nested field/);
  const annotation = {schema_version: 1, cipher_family_id: 'aes', families: {'synthetic-parameterized-family': {curator_message: 'Synthetic discussion'}}};
  assert.throws(() => policy.project('presentation', annotation), /unapproved field/);
});

test('unapproved transformation locations fail rather than rewriting scientific or citation text', t => {
  const f = fixture(t);
  f.source.title = 'Synthetic publication at reports/internal.md'; f.write('sources.json', [f.source]);
  assert.throws(() => exportPublishedDataset(f.root), /local artifact/);
  f.source.title = 'Synthetic publication in synthetic-private-batch'; f.write('sources.json', [f.source]);
  assert.throws(() => exportPublishedDataset(f.root), /unprojected local batch/);
});

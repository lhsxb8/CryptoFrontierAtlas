import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const require = createRequire(import.meta.url);
const {evidencePath, verifyReport, verifyBatchEvidence} = require('../../lib/node/cryptanalysis/provenance.cjs');
const {coverageView} = require('../../lib/node/cryptanalysis/dataset.cjs');

test('historical evidence references resolve without changing signed JSON payloads', () => {
  const root = join(tmpdir(), 'synthetic-atlas-root');
  assert.equal(evidencePath(root, 'reports/review.md'), join(root, 'data/cryptanalysis/provenance/legacy-reports/review.md'));
  assert.equal(evidencePath(root, 'data/schema/result.schema.json'), join(root, 'schemas/cryptanalysis/result.schema.json'));
  assert.equal(evidencePath(root, 'tests/fixtures/before.json'), join(root, 'tests/fixtures/before.json'));
  for (const ref of ['../outside', '/tmp/outside', 'reports/../../outside', 'reports/..\\outside', 'other.json']) assert.throws(() => evidencePath(root, ref));
});

test('historical report receipts verify both bytes and the referenced source version', t => {
  const root = mkdtempSync(join(tmpdir(), 'atlas-provenance-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const dir = join(root, 'data/cryptanalysis/provenance');
  mkdirSync(join(dir, 'legacy-reports'), {recursive:true});
  const hash = 'a'.repeat(64), text = `Synthetic source ${hash}\n`;
  writeFileSync(join(dir, 'legacy-reports/review.md'), text);
  writeFileSync(join(dir, 'legacy-reports.json'), JSON.stringify({schema_version:1, reports:[{
    reference:'reports/review.md', sha256:createHash('sha256').update(text).digest('hex'), source_sha256:[hash],
  }]}));
  verifyReport(root, 'reports/review.md', hash);
  assert.throws(() => verifyReport(root, 'reports/review.md', 'b'.repeat(64)), /source version mismatch/);
  writeFileSync(join(dir, 'legacy-reports/review.md'), text + 'changed');
  assert.throws(() => verifyReport(root, 'reports/review.md'), /hash mismatch/);
});

test('browser coverage is a whitelist, not a copy of the extraction ledger', () => {
  const input = {family_ids:['synthetic'], reviewed_on:'2026-11-09', issues:[], private_receipt:'private',
    ingestion_batches:[{id:'synthetic', new_records:[], indexed_existing_records:[], note:'Visible', baseline_hash:'private', before_payload_fixture:'private'}]};
  const view = coverageView(input);
  assert.equal(view.private_receipt, undefined);
  assert.equal(view.ingestion_batches[0].baseline_hash, undefined);
  assert.equal(view.ingestion_batches[0].note, 'Visible');
  assert.equal(input.ingestion_batches[0].baseline_hash, 'private');
});

test('new structured review receipts bind batch, sources and result decisions without a Markdown dependency', t => {
  const root = mkdtempSync(join(tmpdir(), 'atlas-review-receipt-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const directory = join(root, 'data/cryptanalysis/provenance/reviews');
  mkdirSync(directory, {recursive:true});
  const file = join(directory, 'synthetic.json');
  const receipt = {schema_version:1, batch_id:'synthetic', reviewed_on:'2026-11-09',
    source_versions:[{source_id:'synthetic-source', sha256:'a'.repeat(64), locators:['p. 3, synthetic result']}],
    decisions:[{source_ids:['synthetic-source'], result_ids:['synthetic-result'], decision:'needs_details', reason:'Synthetic unresolved result event.'}]};
  const batch = {id:'synthetic', reviewed_on:'2026-11-09', provenance_receipt:'provenance/reviews/synthetic.json'};
  const sources = [{id:'synthetic-source', content_sha256:'a'.repeat(64)}];
  const validate = () => verifyBatchEvidence(root, batch, sources, new Set(['synthetic-result']));
  writeFileSync(file, JSON.stringify(receipt));
  assert.deepEqual(validate(), receipt);
  for (const [change, error] of [
    [r => {r.batch_id = 'wrong';}, /identity mismatch/],
    [r => {r.source_versions[0].sha256 = 'b'.repeat(64);}, /source version mismatch/],
    [r => {r.source_versions.push(r.source_versions[0]);}, /Duplicate review source/],
    [r => {r.decisions[0].source_ids = ['missing'];}, /unverified source/],
    [r => {r.decisions[0].result_ids = ['missing'];}, /unknown result/],
    [r => {r.decisions[0].decision = 'unreviewed-certainty';}, /Invalid review receipt/],
    [r => {r.source_versions[0].locators = [];}, /Invalid review receipt/],
  ]) {
    const invalid = structuredClone(receipt); change(invalid); writeFileSync(file, JSON.stringify(invalid));
    assert.throws(validate, error);
  }
});

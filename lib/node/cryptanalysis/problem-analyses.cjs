'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {problemContract} = require('./problem-contract.cjs');
const {problemResultErrors} = require('../../cryptanalysis/problem-results.cjs');
const {verifyBatchEvidence} = require('./provenance.cjs');

function readFolder(directory, folder) {
  const full = path.join(directory, folder);
  if (!fs.existsSync(full)) return [];
  assert(!fs.lstatSync(full).isSymbolicLink(), 'Redirected problem data directory');
  return fs.readdirSync(full).sort().map(file => {
    assert(/^[a-z0-9-]+\.json$/.test(file) && !fs.lstatSync(path.join(full, file)).isSymbolicLink(), 'Unexpected problem data file');
    return {file, value: JSON.parse(fs.readFileSync(path.join(full, file), 'utf8'))};
  });
}
const pointerExists = (value, pointer) => {
  for (const part of pointer.slice(1).split('/')) {
    const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return false;
    value = value[key];
  }
  return true;
};
function loadProblemAnalyses(root, directory, sources, profile, reservedIds = new Set()) {
  const catalogs = readFolder(directory, 'problem-analyses'), files = readFolder(directory, 'problem-results');
  if (!catalogs.length && !files.length) return [];
  assert(catalogs.length, 'Uncatalogued problem results');
  const primitiveCatalog = JSON.parse(fs.readFileSync(path.join(root, 'data/primitives/catalog.json'), 'utf8'));
  const problemIds = new Set(primitiveCatalog.hard_problems.map(p => p.id));
  const Ajv = require('ajv/dist/2020'), ajv = new Ajv({strict: true, allErrors: true, allowUnionTypes: true});
  require('ajv-formats')(ajv); ajv.addKeyword('x-atlas-key-domain');
  const validateRecord = ajv.compile(problemContract(root, 'problem-result'));
  const validateCatalog = ajv.compile(problemContract(root, 'problem-analysis'));
  const sourceMap = new Map(sources.map(s => [s.id, s]));
  const sourceEvidence = evidence => {
    for (const item of evidence) assert(sourceMap.get(item.source_id)?.content_sha256 && item.locator?.length >= 8, 'Problem evidence needs an inspected, fingerprinted source and locator');
  };
  const byId = new Map();
  for (const {file, value: r} of files) {
    assert(validateRecord(r), r.id + ': ' + ajv.errorsText(validateRecord.errors));
    assert.equal(file, r.id + '.json', 'Problem result filename mismatch');
    assert(!byId.has(r.id) && !reservedIds.has(r.id), 'Duplicate analysis result ID');
    assert(problemIds.has(r.target.problem_id), 'Unknown primitive hard problem');
    assert.deepEqual(problemResultErrors(r), [], r.id + ': invalid problem semantics');
    sourceEvidence(r.evidence);
    const pointers = r.evidence.flatMap(e => e.fields);
    for (const pointer of pointers) assert(pointerExists(r, pointer), r.id + ': nonexistent evidence pointer');
    for (const field of ['statement', 'target', 'setting', 'resources', 'success']) assert(pointers.some(p => p === '/' + field || p.startsWith('/' + field + '/')), r.id + ': missing ' + field + ' evidence');
    for (const conflict of r.field_conflicts ?? []) {
      assert(pointerExists(r, conflict.field), 'Nonexistent problem conflict pointer');
      sourceEvidence(conflict.observations);
    }
    assert(!/(?:\/(?:tmp|home|data_600G)\/|file:\/\/)/.test(JSON.stringify(r)), 'Private path in problem result');
    byId.set(r.id, r);
  }
  for (const record of byId.values()) for (const id of record.related_result_ids) assert(id !== record.id && byId.has(id), 'Unknown or self-linked problem result');
  const seenProblems = new Set(), catalogued = new Set();
  return catalogs.map(({file, value: catalog}, index) => {
    assert(validateCatalog(catalog), catalog.problem_id + ': ' + ajv.errorsText(validateCatalog.errors));
    assert.equal(file, catalog.problem_id + '.json', 'Problem catalog filename mismatch');
    assert(problemIds.has(catalog.problem_id) && !seenProblems.has(catalog.problem_id), 'Unknown or duplicate problem catalog');
    seenProblems.add(catalog.problem_id);
    const records = catalog.records.map(id => {
      const record = byId.get(id);
      assert(record && record.target.problem_id === catalog.problem_id && !catalogued.has(id), 'Orphan or duplicate problem catalog record');
      assert(record.assessment.reviewed_on <= catalog.reviewed_on, 'Problem coverage review date is stale');
      catalogued.add(id); return record;
    });
    const membership = [...catalog.standalone_result_ids], familyIds = new Set();
    for (const family of catalog.families) {
      assert(!familyIds.has(family.id) && family.points.length, 'Empty or duplicate problem family'); familyIds.add(family.id);
      sourceEvidence(family.evidence);
      const names = family.parameters.map(p => p.name);
      assert.equal(names.length, new Set(names).size, 'Duplicate family parameters');
      let scope;
      for (const point of family.points) {
        const record = byId.get(point.result_id);
        assert(catalog.records.includes(point.result_id), 'Unknown problem family point');
        assert.deepEqual(Object.keys(point.values).sort(), names.slice().sort(), 'Incomplete problem-family assignment');
        for (const p of family.parameters) {
          const parameter = record.target.parameters.find(item => item.name === p.name);
          assert(parameter && parameter.domain === p.domain && parameter.value === point.values[p.name], 'Problem family and point parameters differ');
        }
        assert.deepEqual(names.slice().sort(), record.target.parameters.map(p => p.name).sort(), 'Unbound problem point parameter');
        const current = JSON.stringify([record.method, record.result_kind, record.goal, record.setting,
          {...record.target, parameters: record.target.parameters.map(({value, ...p}) => p)}]);
        if (scope) assert.equal(current, scope, 'Problem family mixes targets, goals or settings'); else scope = current;
        if (family.model) for (const dimension of Object.keys(family.model.resources)) assert(record.resources[dimension], 'Unknown problem family resource');
        membership.push(point.result_id);
      }
    }
    assert.deepEqual(membership.slice().sort(), catalog.records.slice().sort(), 'Problem family membership must partition records exactly');
    assert(catalog.coverage.comparison_as_of >= catalog.reviewed_on && catalog.coverage.search_cutoff <= catalog.reviewed_on, 'Inconsistent problem coverage dates');
    const usedSources = new Set(records.flatMap(r => r.evidence.map(e => e.source_id)));
    for (const source of catalog.coverage.source_ids) assert(sourceMap.has(source), 'Unknown problem coverage source');
    for (const id of usedSources) assert(catalog.coverage.source_ids.includes(id), 'Missing problem coverage source');
    sourceEvidence(catalog.coverage.exclusions);
    const reviewedIds = new Set(), batchIds = new Set();
    for (const batch of catalog.ingestion_batches ?? []) {
      assert.equal(profile, 'internal', 'Public problem catalog contains ingestion batches');
      assert(!batchIds.has(batch.id), 'Duplicate problem ingestion batch'); batchIds.add(batch.id);
      assert(/^[0-9a-f]{64}$/.test(batch.baseline_hash), 'Missing problem pre-ingestion fingerprint');
      assert.equal(batch.new_record_count, batch.new_records.length, 'Problem batch count mismatch');
      const changed = batch.new_records.concat(batch.indexed_existing_records);
      assert.equal(new Set(changed).size, changed.length, 'Duplicate problem batch result');
      for (const id of changed) assert(catalog.records.includes(id), 'Problem batch result outside scope');
      const receipt = verifyBatchEvidence(root, batch, sources, new Set(catalog.records));
      const receiptSources = new Set(receipt.source_versions.map(v => v.source_id));
      for (const id of batch.added_source_ids) assert(receiptSources.has(id), 'Problem batch source missing from receipt');
      for (const id of changed) {
        assert(receipt.decisions.some(d => d.result_ids.includes(id)), 'Problem batch result missing from receipt decisions');
        assert(byId.get(id).evidence.every(e => receiptSources.has(e.source_id)), 'Problem receipt does not cover result source versions');
        reviewedIds.add(id);
      }
    }
    if (profile === 'internal') for (const id of catalog.records) assert(reviewedIds.has(id), 'Problem result has no ingestion receipt');
    if (index === catalogs.length - 1) assert.equal(catalogued.size, byId.size, 'Uncatalogued problem result');
    return {...catalog, results: records};
  });
}
module.exports = {loadProblemAnalyses, readFolder};

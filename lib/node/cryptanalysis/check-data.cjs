'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const {loadEntries, loadCatalogs, loadDisplayCatalogs, loadPoints, validateCatalog: validateResultFamilies, payloadFields} = require('./result-families.cjs');
const {assertKeyKnowledgeScope, assertResultSemantics, assertTarget} = require('./result-semantics.cjs');
const {supportedVersion, datasetVersion} = require('../../cryptanalysis/result-model.cjs');
const {resolvePaths} = require('../../../atlas.config.cjs');
const {verifyBatchEvidence} = require('./provenance.cjs');
const {shapes, fields: structureFields} = require('./structure-contracts.cjs');
const {loadProblemAnalyses} = require('./problem-analyses.cjs');

function validateDataset(root = path.resolve(__dirname, '../../..'), {profile = 'internal', dataDirectory} = {}) {
const locations = resolvePaths(root, profile);
if (dataDirectory) locations.cryptanalysis = dataDirectory;
if (!fs.existsSync(path.join(locations.cryptanalysis, 'manifest.json'))) {
  throw new Error('Cryptanalysis dataset is not configured (ENOENT).');
}
const read = name => JSON.parse(fs.readFileSync(path.join(locations.cryptanalysis, name), 'utf8'));
const schema = name => JSON.parse(fs.readFileSync(path.join(locations.cryptanalysisSchemas, name), 'utf8'));
const ajv = new Ajv({allErrors: true, strict: true});
addFormats(ajv);
const resultSchema = schema('result.schema.json');
const validate = ajv.compile(resultSchema);
const validateSource = ajv.compile(schema('source.schema.json'));
const sources = read('sources.json');
const ciphers = read('ciphers.json');
const variants = read('variants.json');
const coverage = read('coverage.json');
const manifest = read('manifest.json');
assert(Array.isArray(manifest.records), 'Analysis manifest has no records array');
assert.equal(manifest.record_count, manifest.records.length, 'Analysis record_count mismatch');
assert.equal(new Set(manifest.records).size, manifest.records.length, 'Duplicate Analysis record');
assert(manifest.records.every(id => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)), 'Invalid Analysis record id');
const validateCatalog = ajv.compile(schema('catalog.schema.json'));
assert(validateCatalog({ciphers, variants, coverage_family_ids: coverage.family_ids}), 'catalog: ' + ajv.errorsText(validateCatalog.errors));
const sourceIds = new Set(sources.map(s => s.id));
const cipherIds = new Set(ciphers.map(c => c.id));
const variantIds = new Set(variants.map(v => v.id));
assert.equal(sourceIds.size, sources.length, 'duplicate sources');
assert.equal(cipherIds.size, ciphers.length, 'duplicate cipher families');
assert.equal(variantIds.size, variants.length, 'duplicate variants');
const citationPublications = new Map();
for (const source of sources) {
  assert(validateSource(source), source.id + ': source schema: ' + ajv.errorsText(validateSource.errors));
  const citedPublication = citationPublications.get(source.citation_label);
  assert(citedPublication === undefined || citedPublication === source.publication.url, 'citation_label collision across publications: ' + source.citation_label);
  citationPublications.set(source.citation_label, source.publication.url);
  for (const field of ['id', 'title', 'authors', 'year', 'inspected_version', 'url', 'accessed_on', 'content_sha256', 'hash_note']) {
    assert(Object.prototype.hasOwnProperty.call(source, field), source.id + ': missing ' + field);
  }
  assert(/^https:\/\//.test(source.url), source.id + ': primary URL required');
  assert(source.content_sha256 === null || /^[0-9a-f]{64}$/.test(source.content_sha256), source.id + ': invalid hash');
  if (source.content_sha256 === null) assert(source.hash_note.length > 10, 'missing hash explanation');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.accessed_on));
}
for (const variant of variants) {
  assert(cipherIds.has(variant.family), variant.id + ': unknown cipher family');
  const cipher = ciphers.find(c => c.id === variant.family);
  if (cipher.primitive_type === 'block_cipher') {
    assert(Number.isInteger(variant.key_bits) && Number.isInteger(variant.block_bits), variant.id + ': block-cipher instance requires key_bits and block_bits');
  }
  assert(sourceIds.has(variant.specification_source), 'unknown specification');
}
for (const family of coverage.family_ids) assert(cipherIds.has(family), 'unknown coverage family');
const resultDir = path.join(locations.cryptanalysis, 'results');
const files = fs.readdirSync(resultDir).filter(f => f.endsWith('.json')).sort();
const records = files.map(f => read('results/' + f));
const ids = new Set();
function existsPointer(record, pointer) {
  let cursor = record;
  for (const segment of pointer.slice(1).split('/')) {
    const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (cursor === null || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, key)) return false;
    cursor = cursor[key];
  }
  return true;
}
for (let i = 0; i < records.length; i++) {
  const r = records[i];
  assert(validate(r), r.id + ': ' + ajv.errorsText(validate.errors));
  assert.equal(files[i], r.id + '.json', 'filename/id mismatch');
  assert(!ids.has(r.id), 'duplicate result'); ids.add(r.id);
  for (const id of r.target.variant_ids) {
    assert(variantIds.has(id), 'unknown variant');
    const variant = variants.find(v => v.id === id);
    assertTarget(r, variant);
  }
  const pointers = [];
  for (const conflict of r.field_conflicts || []) {
    assert(existsPointer(r, conflict.field), r.id + ': nonexistent conflict pointer ' + conflict.field);
    for (const observation of conflict.observations) assert(sourceIds.has(observation.source_id), r.id + ': unknown conflict source');
  }
  for (const evidence of r.evidence) {
    assert(sourceIds.has(evidence.source_id), r.id + ': missing source');
    for (const field of evidence.fields) {
      assert(existsPointer(r, field), r.id + ': nonexistent evidence pointer ' + field);
      pointers.push(field);
    }
  }
  for (const field of ['/target', '/setting', '/resources', '/success', '/bound']) {
    // Coverage must explicitly cover the parent or at least one concrete field inside it.
    assert(pointers.some(p => p === field || p.startsWith(field + '/')), r.id + ': evidence coverage missing ' + field);
  }
  if (r.result_kind === 'structural_bound') {
    assert.equal(r.goal, 'minimum_active_sboxes'); assert(r.bound !== null);
    for (const cost of Object.values(r.resources)) assert.equal(cost.status, 'not_applicable');
  } else assert.equal(r.bound, null);
  if (r.result_kind === 'structural_property') {
    assert.equal(r.goal, 'structural_property');
    assert(pointers.some(p => p === '/property' || p.startsWith('/property/')), r.id + ': structural-property evidence missing');
    for (const cost of Object.values(r.resources)) assert.equal(cost.status, 'not_applicable');
  }
  if (r.result_kind === 'collision_construction') {
    if (r.goal === 'key_collision') assert.equal(r.setting.key_model, 'chosen_key_pair');
  }
  if (r.result_kind === 'key_recovery_attack') assert(['key_recovery', 'partial_key_recovery'].includes(r.goal), 'key-recovery scope required');
  if (r.goal === 'partial_key_recovery') assert.equal(r.result_kind, 'key_recovery_attack');
  if (r.candidate_space) {
    assert(pointers.some(p => p === '/candidate_space' || p.startsWith('/candidate_space/')), r.id + ': candidate-space evidence missing');
    for (const observation of r.candidate_space.observations) {
      assert.equal(observation.count.unit, 'key-candidates', r.id + ': candidate counts are not operations or bytes');
      if (observation.count.status === 'conflict') assert.equal(r.assessment.claim_status, 'source_conflict');
    }
  }
  if (r.field_conflicts) assert(pointers.some(p => p === '/field_conflicts' || p.startsWith('/field_conflicts/')), r.id + ': field-conflict evidence missing');
  if (r.result_kind === 'distinguisher') {
    assert.equal(r.goal, 'distinguishing');
    assert(r.setting.reference_model && r.setting.reference_model.length > 20, 'distinguisher needs a reference experiment');
  }
  assertKeyKnowledgeScope(r);
  assertResultSemantics(r);
  if (r.setting.key_model === 'related_secret_keys') {
    assert(r.setting.related_key_count > 1 || (r.setting.related_key_count === null && r.setting.key_budget), 'missing related-key budget');
  }
  if (r.setting.key_budget && r.setting.key_budget.unit === 'tested_related_key_pairs') {
    assert.equal(r.setting.related_key_count, null, 'pair budget is not a distinct-key count');
    assert.equal(r.setting.key_budget.distinct_key_count, null, 'distinct key count for pair scan is not established');
    assert.equal(r.setting.target_selection, 'any_from_pool', 'pair scan must declare target-selection semantics');
  }
  if (Object.values(r.resources).some(x => x.status === 'conflict')) assert.equal(r.assessment.claim_status, 'source_conflict');
  assert(!JSON.stringify(r).includes('/tmp/'), 'temporary local path leaked into data');
  assert(!JSON.stringify(r).includes('/data_600G/'), 'workspace path leaked into data');
}
// The index projects the existing result contract; it does not define another result schema.
const compactSchema = JSON.parse(JSON.stringify(resultSchema));
compactSchema.required = resultSchema.required.filter(field => field === 'id' || payloadFields.includes(field) && field !== 'assessment');
compactSchema.properties.evidence.items.required = compactSchema.properties.evidence.items.required.filter(field => field !== 'interpretation');
const validateCompact = ajv.compile(compactSchema);
const entryFields = shapes.entry.required;
const sourceById = new Map(sources.map(source => [source.id, source]));
const recordById = new Map(records.map(record => [record.id, record]));
const methods = new Set(resultSchema.properties.display.properties.method.enum);
const decisions = new Set(['skip_indexed_abstract', 'skip_dominated_abstract', 'keep_candidate', 'needs_details', 'audit_required', 'skip_out_of_scope']);
const relations = new Set(['already_indexed', 'conflict', 'dominated', 'equal', 'frontier_candidate', 'incomparable']);
const hashPattern = /^[0-9a-f]{64}$/;
function checkCompactEntries(directory = path.join(locations.cryptanalysis, 'entries')) {
  const entryIds = new Set();
  if (!fs.existsSync(directory)) return entryIds;
  // Certificates may cite a compact point, including another retained point in this batch.
  const comparisonIds = new Set([...recordById.keys(), ...loadEntries(root, locations.cryptanalysis).map(entry => entry.id)]);
  for (const file of fs.readdirSync(directory).filter(file => file.endsWith('.jsonl'))) {
    for (const line of fs.readFileSync(path.join(directory, file), 'utf8').split(/\r?\n/)) {
      try { comparisonIds.add(JSON.parse(line).id); } catch { /* Report the labelled parse error below. */ }
    }
  }
  for (const file of fs.readdirSync(directory).filter(file => file.endsWith('.jsonl')).sort()) {
    const family = file.slice(0, -6);
    assert(cipherIds.has(family), 'unknown compact-entry family: ' + family);
    const lines = fs.readFileSync(path.join(directory, file), 'utf8').split(/\r?\n/);
    for (let line = 0; line < lines.length; line++) {
      if (!lines[line].trim()) continue;
      let entry;
      try { entry = JSON.parse(lines[line]); }
      catch (error) { throw new Error(file + ':' + (line + 1) + ': invalid compact JSON: ' + error.message); }
      const label = file + ':' + (line + 1);
      assert(entry && typeof entry === 'object' && !Array.isArray(entry), label + ': expected compact object');
      for (const field of entryFields) assert(Object.hasOwn(entry, field), label + ': missing ' + field);
      assert(typeof entry.id === 'string' && new RegExp(resultSchema.$defs.id.pattern).test(entry.id), label + ': invalid entry ID');
      assert(!entryIds.has(entry.id), label + ': duplicate compact entry ' + entry.id); entryIds.add(entry.id);
      assert(Object.keys(entry).every(field => structureFields('entry').includes(field) || payloadFields.includes(field)), entry.id + ': unknown compact field (keep abstracts and cache metadata outside the index)');
      const source = sourceById.get(entry.source_id);
      assert(source, entry.id + ': unknown compact source');
      assert(typeof entry.source_sha256 === 'string' && hashPattern.test(entry.source_sha256) && entry.source_sha256 === source.content_sha256, entry.id + ': compact/source version hash mismatch');
      assert(methods.has(entry.method), entry.id + ': unknown compact method');
      assert(entry.review && typeof entry.review === 'object' && !Array.isArray(entry.review), entry.id + ': missing review');
      assert(Object.keys(entry.review).every(field => structureFields('review').includes(field)), entry.id + ': unknown review field');
      assert(typeof entry.review.scope === 'string' && entry.review.scope.length > 0 && decisions.has(entry.review.decision), entry.id + ': invalid review scope/decision');
      if (entry.review.reviewed_on !== undefined) assert(typeof entry.review.reviewed_on === 'string' && ajv.formats.date.validate(entry.review.reviewed_on), entry.id + ': invalid entry review date');
      if (entry.review.next_action !== undefined) assert(typeof entry.review.next_action === 'string' && entry.review.next_action.trim().length > 0, entry.id + ': empty evidence task');
      if (entry.review.issue_ids !== undefined) assert(Array.isArray(entry.review.issue_ids) && entry.review.issue_ids.every(id => coverage.issues.some(issue => issue.id === id)), entry.id + ': unknown entry issue');
      const comparison = entry.comparison;
      assert(comparison && typeof comparison === 'object' && !Array.isArray(comparison), entry.id + ': missing comparison');
      assert(Object.keys(comparison).every(field => structureFields('comparison').includes(field)), entry.id + ': unknown comparison field');
      assert(relations.has(comparison.relation) && typeof comparison.baseline_hash === 'string' && hashPattern.test(comparison.baseline_hash), entry.id + ': invalid comparison relation/baseline');
      assert(Array.isArray(comparison.record_ids) && new Set(comparison.record_ids).size === comparison.record_ids.length && comparison.record_ids.every(id => comparisonIds.has(id)), entry.id + ': orphan/duplicate comparison record');
      assert(Array.isArray(comparison.reasons) && comparison.reasons.every(reason => typeof reason === 'string'), entry.id + ': invalid comparison reasons');
      let result;
      if (entry.record_id !== null) {
        result = recordById.get(entry.record_id);
        assert(result && result.id === entry.id, entry.id + ': orphan/mismatched detail record');
        assert.equal(entry.method, result.display.method, entry.id + ': detail method mismatch');
        assert(!payloadFields.some(field => Object.hasOwn(entry, field)), entry.id + ': detail reference duplicates result payload');
      } else {
        assert(!recordById.has(entry.id), entry.id + ': indexed detail must be referenced, not duplicated');
        result = {id: entry.id, display: {name: 'Compact result', method: entry.method},
          ...Object.fromEntries(payloadFields.filter(field => Object.hasOwn(entry, field)).map(field => [field, entry[field]]))};
        assert(validateCompact(result), entry.id + ': compact result schema: ' + ajv.errorsText(validateCompact.errors));
      }
      assertKeyKnowledgeScope(result);
      assertResultSemantics(result);
      assert(result.evidence.some(evidence => evidence.source_id === entry.source_id), entry.id + ': entry source absent from result evidence');
      if (comparison.instances !== undefined) {
        assert(Array.isArray(comparison.instances) && comparison.instances.length > 0, entry.id + ': empty instance comparison');
        assert.deepEqual(comparison.instances.map(instance => instance.variant_id).sort(), [...result.target.variant_ids].sort(), entry.id + ': incomplete instance comparison');
        const supporting = new Set();
        for (const instance of comparison.instances) {
          assert(Object.keys(instance).every(key => structureFields('instanceComparison').includes(key)), entry.id + ': unknown instance comparison field');
          assert(relations.has(instance.relation) && Array.isArray(instance.record_ids) &&
            new Set(instance.record_ids).size === instance.record_ids.length && instance.record_ids.every(id => comparisonIds.has(id)), entry.id + ': invalid instance comparison reference');
          assert(Array.isArray(instance.reasons) && instance.reasons.every(reason => typeof reason === 'string'), entry.id + ': invalid instance comparison reasons');
          for (const id of instance.record_ids) supporting.add(id);
        }
        assert.deepEqual([...supporting].sort(), [...comparison.record_ids].sort(), entry.id + ': inconsistent instance comparison references');
        if (['dominated', 'equal'].includes(comparison.relation)) assert(comparison.instances.every(instance => ['dominated', 'equal'].includes(instance.relation)), entry.id + ': incomplete instance dominance');
      }
      for (const variantId of result.target.variant_ids) {
        const variant = variants.find(variant => variant.id === variantId);
        assert(variant && variant.family === family, entry.id + ': unknown/out-of-family compact variant');
        if (result.target.round_domain) assertTarget(result, variant);
        else {
          assert(result.target.rounds <= variant.full_rounds, entry.id + ': excessive compact rounds');
          assert.equal(result.target.full_round, result.target.rounds === variant.full_rounds, entry.id + ': compact full-round mismatch');
        }
      }
      for (const evidence of result.evidence) {
        assert(sourceIds.has(evidence.source_id), entry.id + ': unknown compact evidence source');
        for (const field of evidence.fields) assert(existsPointer(result, field), entry.id + ': nonexistent compact evidence pointer ' + field);
      }
      for (const conflict of result.field_conflicts || []) {
        assert(existsPointer(result, conflict.field), entry.id + ': nonexistent compact conflict pointer ' + conflict.field);
        for (const observation of conflict.observations) assert(sourceIds.has(observation.source_id), entry.id + ': unknown compact conflict source');
      }
      assert(!/(?:\/(?:tmp|var\/tmp|home|Users|data_600G)\/|file:\/\/|[A-Za-z]:\\)/.test(JSON.stringify(entry)), entry.id + ': machine path leaked into compact index');
    }
  }
  return entryIds;
}
const compactEntryIds = checkCompactEntries();
const entries = loadEntries(root, locations.cryptanalysis);
const points = loadPoints(root, records, entries);
const familyCatalogs = loadCatalogs(root, locations.cryptanalysis);
assert.equal(new Set(familyCatalogs.map(catalog => catalog.cipher_family_id)).size, familyCatalogs.length, 'Duplicate cipher-family catalogs');
for (const catalog of familyCatalogs) validateResultFamilies(catalog, points, sources, variants);
for (const catalog of loadDisplayCatalogs(root, familyCatalogs, locations.cryptanalysis)) validateResultFamilies(catalog, points, sources, variants);
assert.equal(manifest.record_count, records.length);
assert.deepStrictEqual(manifest.records.slice().sort(), Array.from(ids).sort());
assert.equal(manifest.source_count, sources.length, 'Analysis source_count mismatch');
assert(supportedVersion(manifest.schema_version), 'Unsupported manifest schema version');
assert.equal(manifest.schema_version, datasetVersion(points), 'Analysis schema version mismatch');
assert.equal(manifest.dataset_version, manifest.schema_version);
assert.equal(manifest.local_only, profile === 'internal', 'Dataset/profile mismatch');
const witnessDocument = read('witnesses.json');
const witnesses = witnessDocument.witnesses;
assert(Array.isArray(witnesses) && witnesses.length > 0, 'missing witness array');
assert(sourceIds.has(witnessDocument.known_answer_source_id), 'missing version-specific known-answer source');
assert(sources.some(source => source.content_sha256 === witnessDocument.source.pdf_sha256), 'witness/source version hash mismatch');
for (const witness of witnesses) {
  assert(ids.has(witness.result_id), 'orphan collision witness');
  const r = records.find(x => x.id === witness.result_id);
  assert.equal(r.target.rounds, witness.rounds, 'witness round mismatch');
  assert.equal(r.target.round_convention, witnessDocument.round_convention.id, 'witness round convention mismatch');
  assert.equal(r.setting.plaintext_model, witness.plaintext_control, 'witness plaintext setting mismatch');
  assert(r.target.variant_ids.some(id => variants.find(v => v.id === id).key_bits === witness.key_bits), 'witness key length mismatch');
  assert.equal(r.assessment.reproduction, 'collision_witness_only');
}
for (const r of records.filter(x => x.assessment.reproduction === 'collision_witness_only')) {
  assert(witnesses.some(w => w.result_id === r.id), 'claimed witness check without witness');
}
const auditVariants = new Set(variants.filter(variant => coverage.family_ids.includes(variant.family)).map(variant => variant.id));
const auditRecords = records.filter(record => record.target.variant_ids.some(id => auditVariants.has(id)));
const auditRecordIds = new Set(auditRecords.map(record => record.id));
const auditReviewDate = auditRecords.map(record => record.assessment.reviewed_on).sort().slice(-1)[0];
assert(typeof coverage.reviewed_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(coverage.reviewed_on), 'invalid coverage review date');
if (auditReviewDate) assert(coverage.reviewed_on >= auditReviewDate, 'coverage review date precedes a scoped record review');
assert.equal(coverage.exhaustive, false);
assert.equal(coverage.latest_or_best_known_claim, false);
assert(Object.values(coverage.included_counts).every(count => Number.isInteger(count) && count >= 0), 'invalid coverage count');
assert.equal(Object.values(coverage.included_counts).reduce((a, b) => a + b, 0), auditRecordIds.size, 'coverage count mismatch for declared families');
for (const issue of coverage.issues) {
  assert(typeof issue.action === 'string' && issue.action.trim().length > 0, 'invalid coverage issue action: ' + issue.id);
  assert(Array.isArray(issue.evidence) && issue.evidence.length > 0 && issue.evidence.every(item => typeof item === 'string' && item.trim().length > 0), 'invalid coverage issue evidence: ' + issue.id);
  for (const id of issue.affected_records) {
    assert(ids.has(id), 'orphan coverage issue');
    assert(auditRecordIds.has(id), 'coverage result outside declared families');
  }
  for (const id of issue.affected_entries || []) assert(compactEntryIds.has(id), 'orphan coverage entry issue');
}
for (const source of coverage.pending_sources) {
  if (source.reviewed_source_id) assert(sourceIds.has(source.reviewed_source_id), 'unknown reviewed source in pending queue');
}
for (const batch of coverage.ingestion_batches || []) {
  assert.equal(profile, 'internal', 'Public snapshots cannot contain ingestion batches');
  assert.equal(batch.new_record_count, batch.new_records.length, 'batch count mismatch');
  assert.equal(new Set(batch.new_records).size, batch.new_records.length, 'duplicate batch record');
  for (const id of batch.new_records.concat(batch.indexed_existing_records)) {
    assert(ids.has(id), 'orphan batch record');
    assert(auditRecordIds.has(id), 'batch result outside declared families');
  }
  for (const id of batch.added_source_ids) assert(sourceIds.has(id), 'orphan batch source');
  for (const [count, field] of [['new_entry_count', 'new_entries'], ['compact_only_count', 'compact_only_entries']]) {
    if (batch[count] !== undefined || batch[field] !== undefined) {
      assert(Array.isArray(batch[field]), 'missing batch entries: ' + field);
      assert.equal(batch[count], batch[field].length, 'batch entry count mismatch: ' + field);
      assert.equal(new Set(batch[field]).size, batch[field].length, 'duplicate batch entry: ' + field);
      for (const id of batch[field]) assert(compactEntryIds.has(id), 'orphan batch entry: ' + id);
    }
  }
  // These are ingestion-time counts; a later batch may expand a compact-only entry.
  for (const id of batch.compact_only_entries || []) assert(batch.new_entries?.includes(id), 'invalid compact-only batch entry: ' + id);
  verifyBatchEvidence(root, batch, sources, new Set([...ids, ...compactEntryIds]));
}
const questionManifest = JSON.parse(fs.readFileSync(path.join(locations.questions, 'manifest.json'), 'utf8'));
const questionIds = new Set(questionManifest.records);
for (const id of questionIds) {
  const question = JSON.parse(fs.readFileSync(path.join(locations.questions, 'problems', id + '.json'), 'utf8'));
  assert.equal(question.id, id, 'Problem filename/id mismatch');
}
for (const record of records) for (const reference of record.related_problem_ids) {
  assert(reference.startsWith('cryptofrontieratlas:') && questionIds.has(reference.slice('cryptofrontieratlas:'.length)),
    record.id + ': unknown related problem ' + reference);
}
const problemAnalyses = loadProblemAnalyses(root, locations.cryptanalysis, sources, profile, new Set([...ids, ...compactEntryIds]));
return {manifest, sources, ciphers, variants, coverage, results: records,
  entries, familyCatalogs, problemAnalyses, checkCompactEntries};
}

function checkCompactEntries(directory, root) {
  return validateDataset(root).checkCompactEntries(directory);
}
module.exports = {validateDataset, checkCompactEntries};

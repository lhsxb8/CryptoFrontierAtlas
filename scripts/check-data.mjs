import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve('data/questions/problems');
const repositoryRoot = path.resolve('.');
const files = fs.readdirSync(root).filter((file) => file.endsWith('.json')).sort();
const taxonomy = JSON.parse(fs.readFileSync('data/questions/taxonomy.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('data/questions/manifest.json', 'utf8'));
const problemSchema = JSON.parse(fs.readFileSync('schemas/questions/problem.schema.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const validateProblem = ajv.compile(problemSchema);
const taxonomyIds = new Set(taxonomy.domains.flatMap((domain) => domain.children.map((child) => child.id)));
const areaIds = new Set(taxonomy.areas.map((area) => area.id));
const ids = new Set();
const records = [];
const forbidden = ['file://', '/home/', '/Users/', 'private_solution'];

const progressCitationRoles = {
  source_statement: new Set(['original_source']),
  restatement: new Set(['restatement']),
  prior_result: new Set(['prior_progress']),
  public_result: new Set(['prior_progress', 'resolution']),
  independent_result: new Set(['independent_resolution']),
};
const historicalSourceCue = /\b(?:restates?|recalls?|previously posed|long-standing open problem|posed by|conjectured by|repeats?\s+(?:a|the|this|an existing)\s+(?:problem|question|conjecture))\b/i;

function validateLineage(record, file) {
  const source = record.source;
  const citations = source.citations;
  const citationByLabel = new Map();
  for (const [index, citation] of citations.entries()) {
    if (typeof citation.label !== 'string' || citation.label.trim().length === 0) {
      throw new Error(`${file} source.citations[${index}] label must be non-empty`);
    }
    if (citationByLabel.has(citation.label)) {
      throw new Error(`${file} citation label is duplicated: ${citation.label}`);
    }
    citationByLabel.set(citation.label, citation);
  }

  const provenance = source.provenance;
  const originStatus = provenance?.origin_status ?? 'confirmed';
  if (provenance) {
    if (!['confirmed', 'unresolved'].includes(provenance.origin_status)) {
      throw new Error(`${file} source.provenance.origin_status is invalid`);
    }
    if (!['explicit_cited_antecedent', 'undetermined'].includes(provenance.method)) {
      throw new Error(`${file} source.provenance.method is invalid`);
    }
    const expectedMethod = originStatus === 'confirmed'
      ? 'explicit_cited_antecedent'
      : 'undetermined';
    if (provenance.method !== expectedMethod) {
      throw new Error(`${file} ${originStatus} provenance must use ${expectedMethod}`);
    }
  }

  const roles = citations.map((citation) => citation.role);
  const lineageAware = Boolean(provenance)
    || roles.includes('restatement')
    || record.progress.some((event) => event.kind === 'restatement');
  if (lineageAware && !provenance) {
    throw new Error(`${file} records with restatement lineage must declare source.provenance`);
  }
  if (originStatus === 'confirmed') {
    if (roles.filter((role) => role === 'original_source').length !== 1) {
      throw new Error(`${file} confirmed provenance requires exactly one original_source citation`);
    }
    if (citations[0]?.role !== 'original_source') {
      throw new Error(`${file} confirmed provenance requires original_source as the first citation`);
    }
  } else {
    if (roles.includes('original_source')) {
      throw new Error(`${file} unresolved provenance must not claim an original_source citation`);
    }
    if (!roles.includes('restatement')) {
      throw new Error(`${file} unresolved provenance requires a restatement citation`);
    }
    if (citations[0]?.role !== 'restatement') {
      throw new Error(`${file} unresolved provenance requires restatement as the first citation`);
    }
  }

  let previousDate = '';
  for (const [index, event] of record.progress.entries()) {
    if (event.date < previousDate) {
      throw new Error(`${file} progress timeline is not in non-decreasing date order at index ${index}`);
    }
    previousDate = event.date;
    const labels = event.citation_labels;
    const eventRoles = new Set();
    for (const label of labels) {
      const citation = citationByLabel.get(label);
      if (!citation) {
        throw new Error(`${file} progress[${index}] references unknown citation label ${label}`);
      }
      eventRoles.add(citation.role);
    }
    const expectedRoles = lineageAware ? progressCitationRoles[event.kind] : undefined;
    if (expectedRoles) {
      if (![...eventRoles].some((role) => expectedRoles.has(role))) {
        throw new Error(`${file} progress[${index}] ${event.kind} must cite ${[...expectedRoles].join(' or ')}`);
      }
      if ([...eventRoles].some((role) => !expectedRoles.has(role))) {
        throw new Error(`${file} progress[${index}] ${event.kind} cites an inconsistent evidence role`);
      }
    }
    if (event.kind === 'source_statement' && historicalSourceCue.test(event.summary)) {
      throw new Error(`${file} progress[${index}] source_statement contains historical-source wording; use a restatement event and cite the antecedent as original_source`);
    }
  }

  if (originStatus === 'confirmed') {
    const sourceEvents = record.progress.filter((event) => event.kind === 'source_statement');
    if (sourceEvents.length !== 1) {
      throw new Error(`${file} confirmed provenance requires exactly one source_statement event`);
    }
  } else if (record.progress.some((event) => event.kind === 'source_statement')) {
    throw new Error(`${file} unresolved provenance must not contain a source_statement event`);
  }

  for (const citation of citations) {
    if (citation.role === 'restatement' && !record.progress.some((event) =>
      event.kind === 'restatement' && event.citation_labels.includes(citation.label)
    )) {
      throw new Error(`${file} restatement citation is not represented by a restatement progress event: ${citation.label}`);
    }
  }
}

// Published formalizations use byte fingerprints, independent of Git history.
function verifyRepositoryFormalization(record, file) {
  const lean = record.lean;
  if (!lean.path?.startsWith('data/formalizations/') || !lean.path.endsWith('.lean')
    || path.posix.normalize(lean.path) !== lean.path || lean.path.includes('\\')) {
    throw new Error(file + ' requires a safe data/formalizations/*.lean path');
  }
  const formalRoot = path.resolve(repositoryRoot, 'data/formalizations');
  if (fs.lstatSync(formalRoot).isSymbolicLink()) throw new Error(file + ' formalization root is a symlink');
  if (lean.status === 'none' || ['lean_version', 'mathlib_version', 'trusted_base', 'replay_command'].some(key => !lean[key]?.trim())) {
    throw new Error(file + ' requires formalization scope, toolchain, trust and replay metadata');
  }
  const sourceFiles = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      if (entry.name === '.lake') continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(file + ' formalization contains a symlink');
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.lean')) sourceFiles.push({
        relative:path.relative(formalRoot, absolute).split(path.sep).join('/'),
        bytes:fs.readFileSync(absolute),
      });
    }
  }
  visit(formalRoot);
  sourceFiles.sort((a,b) => a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0);
  const digest = crypto.createHash('sha256');
  for (const {relative,bytes} of sourceFiles) {
    digest.update(relative); digest.update('\0');
    digest.update(crypto.createHash('sha256').update(bytes).digest()); digest.update('\n');
  }
  if (digest.digest('hex') !== lean.source_tree_sha256 || sourceFiles.length !== lean.source_tree_file_count) {
    throw new Error(file + ' formalization tree fingerprint mismatch');
  }
  const artifacts = record.artifacts.filter(item => item.role === 'source_code' && item.visibility === 'repository_file');
  if (artifacts.length !== 1) throw new Error(file + ' requires one repository source artifact');
  const artifact = artifacts[0];
  const expected = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(repositoryRoot, lean.path))).digest('hex');
  const publicUrl = new URL(artifact.url);
  if (artifact.sha256 !== expected || !artifact.license || !publicUrl.pathname.endsWith('/blob/' + lean.commit + '/' + lean.path)) {
    throw new Error(file + ' formalization fingerprint, license or immutable URL mismatch');
  }
  if (!['computer_checked', 'repository_checked'].includes(record.status.public_verification_status)) {
    throw new Error(file + ' requires a checked verification status for a repository formalization');
  }
}
for (const domain of taxonomy.domains) {
  if (!areaIds.has(domain.area)) throw new Error(`taxonomy domain ${domain.id} has unknown area ${domain.area}`);
}
for (const file of files) {
  const record = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  if (!validateProblem(record)) {
    throw new Error(`${file} schema validation failed: ${ajv.errorsText(validateProblem.errors)}`);
  }
  validateLineage(record, file);
  records.push({file, record});
  if (ids.has(record.id)) throw new Error(`duplicate id: ${record.id}`);
  ids.add(record.id);
  if (`${record.id}.json` !== file) throw new Error(`${file} does not match record id ${record.id}`);
  const serialized = JSON.stringify(record);
  for (const token of forbidden) {
    if (serialized.includes(token)) throw new Error(`${file} contains forbidden token ${token}`);
  }
  for (const key of ['schema_version', 'id', 'group_id', 'title', 'summary', 'formal_statement', 'scope', 'classification', 'source', 'status', 'progress', 'artifacts', 'lean', 'relations']) {
    if (!(key in record)) throw new Error(`${file} is missing required field ${key}`);
  }
  if (record.classification.taxonomy_version !== taxonomy.taxonomy_version) {
    throw new Error(`${file} uses taxonomy ${record.classification.taxonomy_version}, expected ${taxonomy.taxonomy_version}`);
  }
  if (!taxonomyIds.has(record.classification.primary)) throw new Error(`${file} has unknown primary taxonomy id`);
  for (const secondary of record.classification.secondary) {
    if (!taxonomyIds.has(secondary)) throw new Error(`${file} has unknown secondary taxonomy id ${secondary}`);
    if (secondary === record.classification.primary) {
      throw new Error(`${file} repeats primary taxonomy id ${secondary} in secondary taxonomy`);
    }
  }
  if (record.lean.available_in_repo) verifyRepositoryFormalization(record, file);
}
for (const {file, record} of records) {
  for (const relation of ['related', 'supersedes', 'superseded_by']) {
    for (const target of record.relations[relation]) {
      if (!ids.has(target)) throw new Error(`${file} has dangling ${relation} relation ${target}`);
    }
  }
}
if (manifest.record_count !== files.length) throw new Error('manifest record_count does not match public records');
if (manifest.taxonomy_version !== taxonomy.taxonomy_version) throw new Error('manifest taxonomy version does not match taxonomy');
const manifestIds = [...manifest.records].sort();
const recordIds = [...ids].sort();
if (JSON.stringify(manifestIds) !== JSON.stringify(recordIds)) throw new Error('manifest record list does not match public records');
console.log(`Public data check passed: ${files.length} records, ${ids.size} unique ids.`);

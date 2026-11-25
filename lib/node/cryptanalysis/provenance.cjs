'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {resolvePaths} = require('../../../atlas.config.cjs');

// Historical receipts use logical paths from the former corpus root. Resolve
// those references without rewriting the signed/hashed scientific documents.
function evidencePath(root, reference) {
  if (typeof reference !== 'string' || path.isAbsolute(reference)
    || reference.split(/[\\/]/).includes('..')) throw new Error('Invalid evidence reference');
  const locations = resolvePaths(root);
  if (reference.startsWith('reports/')) return path.join(locations.provenance, 'legacy-reports', reference.slice(8));
  if (reference.startsWith('reviews/') || reference.startsWith('provenance/reviews/')) return path.join(locations.cryptanalysis, reference);
  if (reference.startsWith('data/schema/')) return path.join(locations.cryptanalysisSchemas, reference.slice(12));
  if (reference.startsWith('data/')) return path.join(locations.cryptanalysis, reference.slice(5));
  if (reference.startsWith('tests/fixtures/')) return path.join(root, reference);
  throw new Error('Unsupported historical evidence reference: ' + reference);
}

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function verifyReport(root, reference, sourceHash) {
  const locations = resolvePaths(root);
  const index = JSON.parse(fs.readFileSync(path.join(locations.provenance, 'legacy-reports.json'), 'utf8'));
  const receipt = index.reports.find(item => item.reference === reference);
  if (!receipt) throw new Error('Missing structured report receipt: ' + reference);
  const bytes = fs.readFileSync(evidencePath(root, reference));
  if (sha256(bytes) !== receipt.sha256) throw new Error('Historical report hash mismatch: ' + reference);
  if (sourceHash && (!receipt.source_sha256.includes(sourceHash) || !bytes.toString('utf8').includes(sourceHash))) {
    throw new Error('Historical report/source version mismatch: ' + reference);
  }
  return receipt;
}

function verifyBatchEvidence(root, batch, sources, resultIds) {
  if (!batch.provenance_receipt) return verifyReport(root, batch.audit_report);
  if (!batch.provenance_receipt.startsWith('provenance/reviews/')) throw new Error('Review receipt must be under provenance/reviews/');
  const receipt = JSON.parse(fs.readFileSync(evidencePath(root, batch.provenance_receipt), 'utf8'));
  const Ajv = require('ajv/dist/2020');
  const ajv = new Ajv({allErrors:true, strict:true});
  require('ajv-formats')(ajv);
  const valid = ajv.validate(require('../../../schemas/cryptanalysis/review-receipt.schema.json'), receipt);
  if (!valid) throw new Error('Invalid review receipt: ' + ajv.errorsText());
  if (receipt.batch_id !== batch.id || receipt.reviewed_on !== batch.reviewed_on) throw new Error('Review receipt batch identity mismatch');
  const versions = new Set();
  for (const version of receipt.source_versions) {
    if (versions.has(version.source_id)) throw new Error('Duplicate review source version');
    versions.add(version.source_id);
    if (!sources.some(source => source.id === version.source_id && source.content_sha256 === version.sha256)) throw new Error('Review receipt source version mismatch');
  }
  for (const decision of receipt.decisions) {
    if (!decision.source_ids.every(id => versions.has(id))) throw new Error('Review decision has an unverified source');
    if (!decision.result_ids.every(id => resultIds.has(id))) throw new Error('Review decision has an unknown result');
  }
  return receipt;
}

module.exports = {evidencePath, verifyReport, verifyBatchEvidence};

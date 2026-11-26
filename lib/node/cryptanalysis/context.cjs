'use strict';

// Dataset snapshots are project tooling, independent of extraction or skills.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {resolvePaths} = require('../../../atlas.config.cjs');
const {loadEntries, loadCatalogs, loadPoints} = require('./result-families.cjs');
const {readFolder} = require('./problem-analyses.cjs');
const {problemContract} = require('./problem-contract.cjs');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const canonical = x => Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' :
  x && typeof x === 'object' ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}' : JSON.stringify(x);
const fingerprint = x => hash(canonical(x));

function context(atlasRoot = path.resolve(__dirname, '../../..')) {
  const locations = resolvePaths(atlasRoot);
  const sources = read(path.join(locations.cryptanalysis, 'sources.json'));
  const manifest = read(path.join(locations.cryptanalysis, 'manifest.json'));
  const records = manifest.records.map(id => read(path.join(locations.cryptanalysis, 'results', id + '.json')));
  const entries = loadEntries(atlasRoot), catalogs = loadCatalogs(atlasRoot);
  const comparisonRecords = loadPoints(atlasRoot, records, entries);
  const schema = read(path.join(locations.cryptanalysisSchemas, 'result.schema.json'));
  const variants = read(path.join(locations.cryptanalysis, 'variants.json'));
  const problems = ['problem-analyses', 'problem-results'].map(folder => readFolder(locations.cryptanalysis, folder));
  const Ajv = require('ajv/dist/2020');
  const ajv = new Ajv({allErrors: true, strict: false});
  require('ajv-formats')(ajv);
  return {sources, records, entries, catalogs, comparisonRecords, manifest,
    byId: new Map(comparisonRecords.map(r => [r.id, r])),
    validateRecord: ajv.compile(schema), variants,
    snapshot: fingerprint({sources, records, entries, catalogs, schema, manifest, variants,
      ...(problems.some(list => list.length) ? {problems, problemSchema: problemContract(atlasRoot, 'problem-result'),
        problemCatalogSchema: problemContract(atlasRoot, 'problem-analysis')} : {})})};
}

module.exports = {hash, fingerprint, context};

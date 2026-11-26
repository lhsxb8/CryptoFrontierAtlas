'use strict';

const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {shapes} = require('./structure-contracts.cjs');

// Compose once for both scientific validation and publication classification.
// Resource units, success events, evidence and conflicts have one contract.
function problemContract(root, name) {
  const read = file => JSON.parse(readFileSync(join(root, 'schemas/cryptanalysis', file + '.schema.json'), 'utf8'));
  const result = read('result'), schema = read(name);
  schema.$defs = {...result.$defs, ...schema.$defs,
    shared_success: result.properties.success,
    shared_evidence: result.properties.evidence,
    shared_conflicts: result.properties.field_conflicts,
    shared_family: shapes.family};
  return schema;
}
module.exports = {problemContract};

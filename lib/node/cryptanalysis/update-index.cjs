'use strict';
// Mechanical index maintenance; record migrations require reviewed metadata.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const {supportedVersion, datasetVersion, definition} = require('../../cryptanalysis/result-model.cjs');
const {loadEntries} = require('./result-families.cjs');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const write = (p, value) => fs.writeFileSync(path.join(root, p), JSON.stringify(value, null, 2) + '\n');
const schema = read('schemas/cryptanalysis/result.schema.json');
const records = fs.readdirSync(path.join(root, 'data/cryptanalysis/results')).filter(p => p.endsWith('.json')).sort().map(file => {
  const relative = 'data/cryptanalysis/results/' + file;
  const record = read(relative);
  if (!supportedVersion(record.schema_version)) throw new Error('Unsupported schema version: ' + file);
  return record;
});
const version = datasetVersion([...records, ...loadEntries(root).filter(entry => entry.record_id === null)]);
function category(record) {
  const goal = definition(record);
  if (goal && !goal.legacy) return record.goal;
  if (record.result_kind === 'structural_bound') return 'structural_bound';
  if (record.result_kind === 'structural_property') return 'structural_property';
  if (record.result_kind === 'key_space_reduction') return 'key_space_reduction';
  if (record.setting.attack_surface === 'fault_injection') return record.goal === 'partial_key_recovery' ? 'fault_partial_recovery' : 'fault_key_recovery';
  if (record.setting.attack_surface === 'side_channel') return record.goal === 'partial_key_recovery' ? 'side_channel_partial_recovery' : 'side_channel_key_recovery';
  if (record.setting.computation === 'quantum') return 'quantum_key_recovery';
  if (record.result_kind === 'distinguisher') {
    if (record.setting.key_model === 'known_key') return 'known_key_distinguisher';
    if (record.setting.key_model === 'chosen_key_pair') return 'chosen_key_distinguisher';
    return record.setting.key_model === 'related_secret_keys' ? 'related_key_distinguisher' : 'secret_key_distinguisher';
  }
  if (record.result_kind === 'collision_construction') return 'key_collision';
  if (record.setting.key_model === 'related_secret_keys') return 'related_key';
  if (record.goal === 'partial_key_recovery') return 'single_key_partial_recovery';
  if (record.techniques.some(t => t.includes('biclique'))) return 'biclique';
  if (record.techniques.some(t => t.includes('boomerang'))) return 'single_key_boomerang';
  if (record.techniques.some(t => t.includes('meet-in-the-middle'))) return 'single_key_mitm';
  return 'other_key_recovery';
}
if (require.main === module) {
  const manifest = read('data/cryptanalysis/manifest.json');
  manifest.records = records.map(r => r.id).sort();
  manifest.record_count = records.length;
  manifest.source_count = read('data/cryptanalysis/sources.json').length;
  manifest.schema_version = version;
  manifest.dataset_version = version;
  manifest.reviewed_on = records.map(r => r.assessment.reviewed_on).sort().slice(-1)[0] || manifest.reviewed_on;
  write('data/cryptanalysis/manifest.json', manifest);
  const coverage = read('data/cryptanalysis/coverage.json');
  const variants = read('data/cryptanalysis/variants.json');
  const auditVariants = new Set(variants.filter(variant => coverage.family_ids.includes(variant.family)).map(variant => variant.id));
  const auditRecords = records.filter(record => record.target.variant_ids.some(id => auditVariants.has(id)));
  coverage.reviewed_on = [coverage.reviewed_on, ...auditRecords.map(record => record.assessment.reviewed_on)].sort().slice(-1)[0];
  coverage.included_counts = {};
  for (const record of auditRecords) {
    const group = category(record);
    coverage.included_counts[group] = (coverage.included_counts[group] || 0) + 1;
  }
  write('data/cryptanalysis/coverage.json', coverage);
  console.log('Indexed ' + records.length + ' records; schema ' + version + '; ' + manifest.source_count + ' source versions; ' + auditRecords.length + ' records in the declared audit families.');
}
module.exports = {category};

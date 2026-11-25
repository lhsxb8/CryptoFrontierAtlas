'use strict';

// Family definitions reference evidence points; they do not replace or duplicate them.
const fs = require('node:fs');
const path = require('node:path');
const {resolvePaths} = require('../../../atlas.config.cjs');
const assert = require('node:assert/strict');
const {shapes} = require('./structure-contracts.cjs');
const {payloadFields, materializeEntry, groupingScope, catalogStats} = require('../../cryptanalysis/result-families.cjs');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sortedFiles = (dir, suffix) => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter(name => name.endsWith(suffix)).sort() : [];
function loadEntries(root, dataDirectory = resolvePaths(root).cryptanalysis) {
  const dir = path.join(dataDirectory, 'entries');
  return sortedFiles(dir, '.jsonl').flatMap(file => fs.readFileSync(path.join(dir, file), 'utf8')
    .split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line)));
}
function loadCatalogs(root, dataDirectory = resolvePaths(root).cryptanalysis) {
  const dir = path.join(dataDirectory, 'result-families');
  return sortedFiles(dir, '.json').map(file => read(path.join(dir, file)));
}

// Optional reader-facing copy is an overlay, never part of the scientific catalog
// or its audit fingerprints. Whitelists below prohibit changing result semantics.
function projectCatalogs(catalogs, annotations) {
  const projected = structuredClone(catalogs);
  const byCipher = new Map(projected.map(catalog => [catalog.cipher_family_id, catalog]));
  const seen = new Set();
  for (const annotation of annotations) {
    shape(annotation, 'presentation');
    assert.equal(annotation.schema_version, 1, 'Unknown presentation annotation version');
    const catalog = byCipher.get(annotation.cipher_family_id);
    assert(catalog, 'Unknown presentation cipher family: ' + annotation.cipher_family_id);
    assert(!seen.has(annotation.cipher_family_id), 'Duplicate presentation cipher family');
    seen.add(annotation.cipher_family_id);
    assert(annotation.families && typeof annotation.families === 'object' && !Array.isArray(annotation.families), 'Expected family annotations');
    const byFamily = new Map(catalog.families.map(family => [family.id, family]));
    for (const [id, display] of Object.entries(annotation.families)) {
      const family = byFamily.get(id);
      assert(family, 'Unknown presentation result family: ' + id);
      shape(display, 'familyDisplay');
      if (Object.hasOwn(display, 'display_name')) {
        assert(nonempty(display.display_name), 'Empty display name');
        family.display_name = display.display_name;
      }
      if (Object.hasOwn(display, 'parameters')) {
        assert(display.parameters && typeof display.parameters === 'object' && !Array.isArray(display.parameters), 'Expected parameter annotations');
        const byParameter = new Map(family.parameters.map(parameter => [parameter.name, parameter]));
        for (const [name, fields] of Object.entries(display.parameters)) {
          const parameter = byParameter.get(name);
          assert(parameter, 'Unknown presentation parameter: ' + id + './' + name);
          shape(fields, 'parameterDisplay');
          for (const [key, value] of Object.entries(fields)) {
            assert(nonempty(value), 'Empty parameter summary');
            parameter[key] = value;
          }
        }
      }
      if (Object.hasOwn(display, 'model')) {
        assert(family.model, 'Presentation model without a source model: ' + id);
        shape(display.model, 'modelDisplay');
        if (Object.hasOwn(display.model, 'display_constraints')) {
          assert(Array.isArray(display.model.display_constraints) && display.model.display_constraints.every(nonempty), 'Invalid display conditions');
          family.model.display_constraints = [...display.model.display_constraints];
        }
        if (Object.hasOwn(display.model, 'resources')) {
          assert(display.model.resources && typeof display.model.resources === 'object' && !Array.isArray(display.model.resources), 'Expected resource annotations');
          for (const [dimension, fields] of Object.entries(display.model.resources)) {
            assert(Object.hasOwn(family.model.resources, dimension), 'Unknown presentation resource: ' + id + './' + dimension);
            shape(fields, 'resourceDisplay');
            for (const [key, value] of Object.entries(fields)) {
              assert(key === 'display_expression' && value === null || nonempty(value), 'Empty display formula or explanation');
              family.model.resources[dimension][key] = value;
            }
          }
        }
      }
    }
    assert(!/(?:\/(?:tmp|var\/tmp|home|Users|data_600G)\/|file:\/\/|[A-Za-z]:\\)/.test(JSON.stringify(annotation)), 'Machine path in presentation annotation');
  }
  return projected;
}
function loadDisplayCatalogs(root, catalogs = loadCatalogs(root), dataDirectory = resolvePaths(root).cryptanalysis) {
  const dir = path.join(dataDirectory, 'presentation');
  return projectCatalogs(catalogs, sortedFiles(dir, '.json').map(file => read(path.join(dir, file))));
}
function loadPoints(root, records, entries = loadEntries(root)) {
  if (!records) records = read(path.join(resolvePaths(root).cryptanalysis, 'manifest.json')).records
    .map(id => read(path.join(resolvePaths(root).cryptanalysis, 'results', id + '.json')));
  const points = new Map(records.map(record => [record.id, record]));
  const entryIds = new Set();
  for (const entry of entries) {
    assert(!entryIds.has(entry.id), 'Duplicate entry: ' + entry.id); entryIds.add(entry.id);
    if (entry.record_id !== null) {
      assert(entry.id === entry.record_id && points.has(entry.record_id), 'Unknown detail reference: ' + entry.id);
    } else {
      assert(!points.has(entry.id), 'Duplicate point payload: ' + entry.id);
      points.set(entry.id, materializeEntry(entry));
    }
  }
  return [...points.values()];
}

// Guard structural boundaries mechanically; the construction/evidence text carries the
// reviewed meaning of tuning-dependent descriptions, not an automatic semantic rewrite.
function shape(object, name) {
  const {required, properties} = shapes[name];
  assert(object && typeof object === 'object' && !Array.isArray(object), 'Expected object');
  assert(required.every(key => Object.hasOwn(object, key)), 'Missing fields: ' + required.join(', '));
  assert(Object.keys(object).every(key => Object.hasOwn(properties, key)),
    'Unknown family field: ' + Object.keys(object).filter(key => !Object.hasOwn(properties, key)).join(', '));
}
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const validId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);

function validateCatalog(catalog, points, sources, variants) {
  shape(catalog, 'familyCatalog');
  assert.equal(catalog.schema_version, 1, 'Unknown family catalog version');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(catalog.reviewed_on) &&
    new Date(catalog.reviewed_on).toISOString().slice(0, 10) === catalog.reviewed_on, 'Invalid family review date');
  const variantIds = new Set(variants.filter(v => v.family === catalog.cipher_family_id).map(v => v.id));
  assert(variantIds.size, 'Unknown cipher family');
  const scoped = points.filter(point => point.target.variant_ids.some(id => variantIds.has(id)));
  const byId = new Map(scoped.map(point => [point.id, point]));
  const sourceById = new Map(sources.map(source => [source.id, source]));
  const used = new Set(), familyIds = new Set();
  const claim = id => {
    assert(byId.has(id), 'Unknown/out-of-scope family point: ' + id);
    assert(!used.has(id), 'Duplicate family membership: ' + id);
    used.add(id); return byId.get(id);
  };
  for (const key of ['families', 'standalone_result_ids', 'excluded_results']) assert(Array.isArray(catalog[key]), 'Expected list: ' + key);
  for (const family of catalog.families) {
    shape(family, 'family');
    if (family.display_name !== undefined) assert(nonempty(family.display_name), 'Empty display name');
    assert(validId(family.id) && !familyIds.has(family.id) && !byId.has(family.id), 'Duplicate/invalid family ID');
    familyIds.add(family.id);
    assert(nonempty(family.title) && nonempty(family.construction), 'Describe the shared construction');
    assert(['formula', 'table'].includes(family.representation), 'Invalid family representation');
    assert(Array.isArray(family.parameters) && family.parameters.length > 0, 'Declare family parameters');
    const names = new Set();
    for (const parameter of family.parameters) {
      shape(parameter, 'parameter');
      for (const key of ['short_meaning', 'short_domain']) if (parameter[key] !== undefined) assert(nonempty(parameter[key]), 'Empty parameter summary');
      assert(/^[A-Za-z][A-Za-z0-9_]*$/.test(parameter.name) && !names.has(parameter.name), 'Invalid/duplicate parameter');
      assert(nonempty(parameter.meaning) && nonempty(parameter.domain), 'Explain parameter and domain');
      names.add(parameter.name);
    }
    assert(Array.isArray(family.points) && family.points.length > 0, 'Family has no evidenced points');
    if (family.representation === 'table') assert(family.points.length > 1, 'A one-point table is a fixed singleton');
    const members = family.points.map(point => {
      shape(point, 'point');
      assert(point.values && typeof point.values === 'object' && !Array.isArray(point.values), 'Expected parameter assignment');
      assert.deepEqual(Object.keys(point.values).sort(), [...names].sort(), 'Incomplete/unknown parameter assignment');
      assert(Object.values(point.values).every(value => nonempty(value) || typeof value === 'number' && Number.isFinite(value)), 'Invalid parameter value');
      return claim(point.result_id);
    });
    for (const member of members) assert.deepEqual(groupingScope(member), groupingScope(members[0]),
      family.id + ': incompatible target, setting, method or recovery material');
    for (const parameter of members[0].experiment?.parameters ?? []) {
      const values = members.map(member => member.experiment.parameters.find(p => p.name === parameter.name).value);
      if (values.some(value => value !== values[0])) assert(names.has(parameter.name), family.id + ': varying experiment parameter is not declared by the family: ' + parameter.name);
      if (names.has(parameter.name)) for (let i = 0; i < members.length; i++) assert.deepEqual(values[i], family.points[i].values[parameter.name], family.id + ': experiment/family parameter assignment mismatch');
    }
    assert(Array.isArray(family.evidence) && family.evidence.length, 'Family evidence required');
    for (const evidence of family.evidence) {
      shape(evidence, 'evidence');
      assert(sourceById.has(evidence.source_id) && nonempty(evidence.locator), 'Unknown family evidence source/locator');
      assert(members.some(member => member.evidence.some(e => e.source_id === evidence.source_id)), 'Family evidence disconnected from points');
    }
    for (const member of members) assert(member.evidence.some(e => family.evidence.some(f => f.source_id === e.source_id)), 'Missing member source in family evidence');
    if (family.representation === 'formula') assert(family.model, 'Formula family needs a model');
    if (family.model) {
      shape(family.model, 'model');
      if (family.model.display_constraints !== undefined) assert(Array.isArray(family.model.display_constraints) && family.model.display_constraints.every(nonempty), 'Invalid display conditions');
      assert(Array.isArray(family.model.constraints) && family.model.constraints.length > 0 && family.model.constraints.every(nonempty), 'Formula domain/constraints required');
      assert(nonempty(family.model.success) && nonempty(family.model.accounting), 'Success and cost accounting required');
      assert(family.model.resources && typeof family.model.resources === 'object' && !Array.isArray(family.model.resources) && Object.keys(family.model.resources).length, 'Resource expressions required');
      for (const [dimension, expression] of Object.entries(family.model.resources)) {
        assert(members.some(member => Object.hasOwn(member.resources, dimension)), 'Unknown model resource coordinate: ' + dimension);
        shape(expression, 'resource');
        if (expression.display_expression !== undefined && expression.display_expression !== null) assert(nonempty(expression.display_expression), 'Empty display formula');
        if (expression.note !== undefined) assert(nonempty(expression.note), 'Empty resource explanation');
        assert(nonempty(expression.expression) && nonempty(expression.unit), 'Empty resource expression/unit');
      }
    }
  }
  for (const id of catalog.standalone_result_ids) claim(id);
  for (const exclusion of catalog.excluded_results) {
    shape(exclusion, 'exclusion'); claim(exclusion.result_id);
    assert(nonempty(exclusion.reason), 'Exclusion needs a reason');
  }
  assert.deepEqual([...used].sort(), [...byId.keys()].sort(), 'Family catalog does not partition all indexed points');
  assert(!/(?:\/(?:tmp|var\/tmp|home|Users|data_600G)\/|file:\/\/|[A-Za-z]:\\)/.test(JSON.stringify(catalog)), 'Machine path in family catalog');
  return catalogStats(catalog);
}
module.exports = {loadEntries, loadCatalogs, loadDisplayCatalogs, projectCatalogs, materializeEntry, loadPoints, groupingScope,
  validateCatalog, catalogStats, payloadFields};

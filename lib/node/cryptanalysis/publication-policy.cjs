'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {shapes} = require('./structure-contracts.cjs');
const {payloadFields} = require('../../cryptanalysis/result-families.cjs');
const {publicText} = require('../publication-safety.cjs');
const escape = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
const typeOf = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
const keywords = new Set(['$schema', '$id', '$defs', '$ref', '$comment', 'title', 'description', 'examples',
  'type', 'properties', 'required', 'additionalProperties', 'items', 'allOf', 'anyOf', 'oneOf', 'if', 'then', 'else', 'not',
  'const', 'enum', 'format', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minItems', 'maxItems', 'uniqueItems', 'multipleOf', 'x-atlas-key-domain']);

// Read structural possibilities, not scientific constraints. Ajv and the shared
// semantic validators remain authoritative. Unknown schema constructs fail closed.
function structural(schemas, base, depth = 0) {
  assert(depth < 64, 'Recursive publication contract is unsupported');
  const expanded = [];
  function expand(schema, references = new Set()) {
    if (typeof schema === 'boolean') { if (schema) expanded.push({}); return; }
    assert(schema && typeof schema === 'object' && !Array.isArray(schema), 'Unsupported publication schema node');
    for (const key of Object.keys(schema)) assert(keywords.has(key), 'Unsupported publication schema keyword: ' + key);
    expanded.push(schema);
    if (schema.$ref) {
      assert(schema.$ref.startsWith('#/') && !references.has(schema.$ref), 'Unsupported publication schema reference');
      let target = base;
      for (const key of schema.$ref.slice(2).split('/').map(s => s.replaceAll('~1', '/').replaceAll('~0', '~'))) {
        assert(target && Object.hasOwn(target, key), 'Unresolved publication schema reference'); target = target[key];
      }
      expand(target, new Set([...references, schema.$ref]));
    }
    for (const key of ['allOf', 'anyOf', 'oneOf']) for (const branch of schema[key] ?? []) expand(branch, references);
    for (const key of ['if', 'then', 'else']) if (schema[key]) expand(schema[key], references);
    // A negative constraint cannot grant a field. Still reject unsupported syntax.
    if (schema.not) checkSyntax(schema.not);
  }
  for (const schema of schemas) expand(schema);
  const types = new Set(), properties = new Map(), required = new Set(), children = new Map();
  const items = [], maps = [];
  for (const schema of expanded) {
    for (const type of Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []) types.add(type);
    if (Object.hasOwn(schema, 'const')) types.add(typeOf(schema.const));
    for (const value of schema.enum ?? []) types.add(typeOf(value));
    for (const key of schema.required ?? []) required.add(key);
    if (schema.properties) {
      types.add('object');
      for (const [key, child] of Object.entries(schema.properties)) {
        assert(!['*', '__proto__', 'constructor', 'prototype'].includes(key), 'Reserved publication field');
        if (!children.has(key)) children.set(key, []);
        children.get(key).push(child);
      }
    }
    if (schema.items) {types.add('array'); items.push(schema.items);}
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') maps.push(schema.additionalProperties);
    if (schema.additionalProperties === true) maps.push({});
  }
  for (const [key, nodes] of children) properties.set(key, structural(nodes, base, depth + 1));
  // An allOf constraint on every resource does not open the closed resource
  // object declared by the base schema. Genuine dictionaries are named explicitly.
  const open = maps.length && !expanded.some(schema => schema.additionalProperties === false);
  const domain = expanded.find(schema => schema['x-atlas-key-domain'])?.['x-atlas-key-domain'];
  if (open) {types.add('object'); assert(typeof domain === 'string' && domain.length, 'Unclassified dictionary key domain');}
  return {types, properties, required, items: items.length ? structural(items, base, depth + 1) : null,
    map: open ? structural(maps, base, depth + 1) : null};
}
function checkSyntax(schema) {
  if (typeof schema === 'boolean') return;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('Unsupported publication schema node');
  for (const key of Object.keys(schema)) assert(keywords.has(key), 'Unsupported publication schema keyword: ' + key);
  for (const key of ['properties', '$defs']) for (const value of Object.values(schema[key] ?? {})) checkSyntax(value);
  for (const key of ['allOf', 'anyOf', 'oneOf']) for (const value of schema[key] ?? []) checkSyntax(value);
  for (const key of ['items', 'additionalProperties', 'if', 'then', 'else', 'not']) {
    if (schema[key] && typeof schema[key] === 'object') checkSyntax(schema[key]);
  }
}
function contractRegistry(root) {
  const read = name => JSON.parse(readFileSync(join(root, 'schemas/cryptanalysis', name + '.schema.json'), 'utf8'));
  const result = read('result'), source = read('source'), catalog = read('catalog');
  for (const schema of [result, source, catalog]) checkSyntax(schema);
  const entry = {...shapes.entry, $defs: result.$defs, properties: {...shapes.entry.properties,
    ...Object.fromEntries(payloadFields.map(key => {assert(Object.hasOwn(result.properties, key), 'Missing compact payload contract'); return [key, result.properties[key]];}))}};
  return Object.fromEntries(Object.entries({
    result: [result, result], source: [source, source], cipher: [catalog.properties.ciphers.items, catalog],
    variant: [catalog.properties.variants.items, catalog], entry: [entry, entry],
    family: [shapes.familyCatalog, shapes.familyCatalog], presentation: [shapes.presentation, shapes.presentation],
    manifest: [shapes.manifest, shapes.manifest], coverage: [shapes.coverage, shapes.coverage], witness: [shapes.witnesses, shapes.witnesses],
  }).map(([name, [schema, base]]) => [name, structural([schema], base)]));
}

function createPublicationPolicy(root, {policy = JSON.parse(readFileSync(join(root, 'schemas/cryptanalysis/publication-fields.json'), 'utf8'))} = {}) {
  assert(policy.schema_version === 1 && policy.documents && !Array.isArray(policy.documents), 'Invalid publication field policy');
  assert(Object.keys(policy).every(key => ['schema_version', 'description', 'documents'].includes(key)), 'Unknown publication policy setting');
  const contracts = contractRegistry(root), rules = new Map();
  assert.deepEqual(Object.keys(policy.documents).sort(), Object.keys(contracts).sort(), 'Publication document coverage mismatch');
  function resolveRules(name, stack = []) {
    assert(!stack.includes(name), 'Circular publication policy reuse');
    if (rules.has(name)) return rules.get(name);
    const definition = policy.documents[name];
    assert(definition && Object.keys(definition).every(key => ['public', 'internal', 'transforms', 'reuse', 'order'].includes(key)), 'Invalid publication document policy');
    const result = new Map();
    const add = (path, rule) => {
      assert(typeof path === 'string' && path.startsWith('/') && !result.has(path), 'Duplicate or invalid publication classification');
      result.set(path, rule);
    };
    for (const [other, prefixes] of Object.entries(definition.reuse ?? {})) {
      assert(Array.isArray(prefixes) && new Set(prefixes).size === prefixes.length, 'Invalid publication reuse');
      const shared = resolveRules(other, [...stack, name]);
      for (const prefix of prefixes) {
        assert(shared.has(prefix), 'Unknown publication reuse root');
        for (const [path, rule] of shared) if (path === prefix || path.startsWith(prefix + '/')) add(path, rule);
      }
    }
    for (const mode of ['public', 'internal']) {
      assert(Array.isArray(definition[mode] ?? []), 'Invalid publication classification list');
      for (const path of definition[mode] ?? []) add(path, mode);
    }
    for (const [path, transform] of Object.entries(definition.transforms ?? {})) {
      assert(['audit-text', 'public-flag', 'empty-batches'].includes(transform), 'Unknown publication transform');
      add(path, transform);
    }
    rules.set(name, result); return result;
  }
  let fieldCount = 0;
  for (const [name, contract] of Object.entries(contracts)) {
    const approved = resolveRules(name), used = new Set();
    const visit = (node, path = '', required = false) => {
      const rule = path ? approved.get(path) : 'public';
      assert(rule, `${name}${path}: unclassified publication field`);
      if (path) used.add(path);
      if (rule === 'internal') {assert(!required, `${name}${path}: required field cannot be internal`); return;}
      if (rule === 'empty-batches') {assert(node.types.has('array'), 'Batch projection requires an array'); return;}
      if (rule === 'public-flag') {assert(node.types.has('boolean'), 'Public flag requires a boolean'); return;}
      assert(node.types.size, `${name}${path}: unconstrained public value`);
      if (rule === 'audit-text') assert([...node.types].every(t => t === 'string' || t === 'null'), 'Text projection requires a text field');
      for (const [key, child] of node.properties) visit(child, path + '/' + escape(key), node.required.has(key));
      if (node.items) visit(node.items, path + '/*');
      if (node.map) visit(node.map, path + '/*');
      if (node.types.has('array')) assert(node.items, `${name}${path}: unclassified array items`);
    };
    visit(contract);
    assert.deepEqual([...approved.keys()].sort(), [...used].sort(), `${name}: stale or shadowed publication rules`);
    for (const [path, keys] of Object.entries(policy.documents[name].order ?? {})) {
      const node = path ? path.slice(1).split('/').reduce((n, key) => key === '*' ? n?.items ?? n?.map : n?.properties.get(key), contract) : contract;
      assert(node && Array.isArray(keys) && new Set(keys).size === keys.length
        && keys.every(key => node.properties.has(key)), 'Invalid publication field ordering');
    }
    fieldCount += used.size;
  }
  function walk(name, value, mode, transformText = publicText) {
    assert(Object.hasOwn(contracts, name), 'Unknown publication document');
    const approved = rules.get(name);
    function visit(node, input, path = '') {
      const rule = path ? approved.get(path) : 'public';
      assert(rule, `${name}${path}: unapproved field`);
      if (rule === 'internal') {assert(mode === 'export', `${name}${path}: internal field in public data`); return undefined;}
      if (rule === 'empty-batches') {
        assert(Array.isArray(input) && (mode === 'export' || input.length === 0), 'Public coverage must not contain ingestion receipts');
        return [];
      }
      if (rule === 'public-flag') {
        assert(mode === 'export' || input === false, 'Invalid public dataset flag'); return false;
      }
      const type = typeOf(input);
      assert(node.types.has(type) || type === 'number' && node.types.has('integer') && Number.isInteger(input), `${name}${path}: unexpected nested field or value shape`);
      if (type === 'array') return input.map(child => visit(node.items, child, path + '/*'));
      if (type === 'object') {
        const result = [], order = policy.documents[name].order?.[path] ?? [];
        const keys = [...order.filter(key => Object.hasOwn(input, key)), ...Object.keys(input).filter(key => !order.includes(key))];
        for (const key of keys) {
          assert(!['__proto__', 'constructor', 'prototype'].includes(key), `${name}${path}: unapproved field`);
          const child = node.properties.get(key) ?? node.map;
          assert(child, `${name}${path}: unapproved field`);
          const nextPath = path + '/' + (node.properties.has(key) ? escape(key) : '*');
          const output = visit(child, input[key], nextPath);
          if (output !== undefined) result.push([key, output]);
        }
        return Object.fromEntries(result);
      }
      if (rule === 'audit-text' && typeof input === 'string') {
        const projected = transformText(input);
        assert(mode === 'export' || projected === input, `${name}${path}: unprojected local reference`);
        return projected;
      }
      return input;
    }
    return visit(contracts[name], value);
  }
  return {fieldCount, project: (name, value, transformText) => walk(name, value, 'export', transformText),
    assertPublic: (name, value) => {walk(name, value, 'public');}};
}

function documentForFile(file) {
  const simple = {manifest: 'manifest', sources: 'source', ciphers: 'cipher', variants: 'variant', coverage: 'coverage', witnesses: 'witness'};
  const folder = {'results': 'result', 'entries': 'entry', 'result-families': 'family', 'presentation': 'presentation'};
  const name = file.replace(/\.jsonl?$/, '');
  const document = simple[name] ?? folder[file.split('/')[0]];
  assert(document, 'Unclassified publication file');
  return {document, many: ['sources', 'ciphers', 'variants'].includes(name)};
}
module.exports = {contractRegistry, createPublicationPolicy, documentForFile};

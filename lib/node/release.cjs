'use strict';

const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {existsSync, lstatSync, readFileSync, readdirSync} = require('node:fs');
const {resolve, join} = require('node:path');
const root = resolve(__dirname, '../..');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

function citationScalar(text, key) {
  const line = text.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))?.[1];
  if (!line) return undefined;
  return line.replace(/^(?:"(.*)"|'(.*)')$/, (_match, double, single) => double ?? single);
}

function checkVersion(projectRoot = root, {tag = '', requireCitation = false} = {}) {
  const pkg = readJson(join(projectRoot, 'package.json'));
  const lock = readJson(join(projectRoot, 'package-lock.json'));
  assert(versionPattern.test(pkg.version), 'Use a three-component application version without a v prefix');
  assert.equal(lock.version, pkg.version, 'Lockfile/application version mismatch');
  assert.equal(lock.packages?.['']?.version, pkg.version, 'Lockfile root-package version mismatch');
  const changelog = readFileSync(join(projectRoot, 'CHANGELOG.md'), 'utf8');
  const latest = changelog.match(/^## (\d+\.\d+\.\d+)(?:\s|$)/m)?.[1];
  assert.equal(latest, pkg.version, 'Latest changelog/application version mismatch');
  if (tag) assert.equal(tag, 'v' + pkg.version, 'Release tag/application version mismatch');
  const citationFile = join(projectRoot, 'CITATION.cff');
  if (requireCitation) assert(existsSync(citationFile), 'Add CITATION.cff with real authors and release metadata before publication.');
  if (existsSync(citationFile)) {
    const citation = readFileSync(citationFile, 'utf8');
    assert.equal(citationScalar(citation, 'version'), pkg.version, 'Citation/application version mismatch');
  }
  return pkg.version;
}

function publicDataRevision(projectRoot = root) {
  const hash = createHash('sha256');
  function visit(relative) {
    const file = join(projectRoot, relative), info = lstatSync(file);
    assert(!info.isSymbolicLink(), 'Public data revision refuses symlinks');
    if (info.isDirectory()) {
      for (const name of readdirSync(file).sort()) visit(relative + '/' + name);
    } else {
      assert(info.isFile(), 'Public data revision requires regular files');
      hash.update(relative + '\0'); hash.update(readFileSync(file)); hash.update('\0');
    }
  }
  for (const directory of ['data/primitives', 'data/questions', 'data/cryptanalysis-public']) visit(directory);
  return hash.digest('hex');
}

function releaseMetadata(projectRoot = root, catalog) {
  return {schema_version: 1, application_version: readJson(join(projectRoot, 'package.json')).version,
    data_revision: publicDataRevision(projectRoot), primitive_count: catalog.primitives.length,
    instance_count: catalog.instances.length, specification_count: catalog.specifications.length};
}

module.exports = {checkVersion, citationScalar, publicDataRevision, releaseMetadata};

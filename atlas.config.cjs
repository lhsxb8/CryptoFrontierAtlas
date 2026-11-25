'use strict';

const path = require('node:path');

// Paths are relative to the application root; build profiles select their inputs.
const paths = Object.freeze({
  questions: 'data/questions',
  cryptanalysis: 'data/cryptanalysis',
  publishedCryptanalysis: 'data/cryptanalysis-public',
  questionSchemas: 'schemas/questions',
  cryptanalysisSchemas: 'schemas/cryptanalysis',
  provenance: 'data/cryptanalysis/provenance',
  reports: '.cache/cryptanalysis/reports',
  local: '.local',
});

function resolvePaths(root = __dirname, profile = 'internal') {
  if (!['internal', 'public'].includes(profile)) throw new Error('Unknown analysis profile');
  const resolved = Object.fromEntries(Object.entries(paths).map(([key, relative]) => [key, path.resolve(root, relative)]));
  if (profile === 'public') resolved.cryptanalysis = resolved.publishedCryptanalysis;
  return resolved;
}

function analysisProfile(command, mode) {
  return mode === 'internal' ? 'internal' : 'public';
}

module.exports = {paths, resolvePaths, analysisProfile};

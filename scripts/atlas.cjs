#!/usr/bin/env node
'use strict';

// One CLI surface for corpus maintenance. Scientific logic lives in lib/.
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const [command, ...args] = process.argv.slice(2);
const commands = {index: 'update-index.cjs', progress: 'aes-census.cjs', report: 'build-report.cjs',
  sota: 'aes-sota.cjs', model: 'sync-result-model.cjs', ingest: 'ingest.cjs'};
try {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Atlas requires Node.js >=20.');
  if (command === 'check') {
    const data = require('../lib/node/cryptanalysis/check-data.cjs').validateDataset(root);
    console.log(`PASS: ${data.results.length} results, ${data.entries.length} compact-index entries, ${data.sources.length} sources, ${data.ciphers.length} cipher families, ${data.variants.length} instances.`);
  } else if (commands[command]) {
    const result = spawnSync(process.execPath, [path.join(root, 'lib/node/cryptanalysis', commands[command]), ...args], {stdio:'inherit', cwd:root});
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } else if (command === 'witnesses') {
    const result = spawnSync('python3', ['-B', path.join(root, 'lib/node/cryptanalysis/verify-witnesses.py'), ...args], {stdio:'inherit', cwd:root});
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } else throw new Error('Usage: node scripts/atlas.cjs <check|index|progress|report|sota|model|ingest|witnesses> [options]');
} catch (error) { console.error(error.message); process.exitCode = 1; }

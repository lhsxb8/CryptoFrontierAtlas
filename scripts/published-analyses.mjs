import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {exportPublishedDataset, checkExport, validatePublishedDataset} = createRequire(import.meta.url)('../lib/node/cryptanalysis/published.cjs');
const {createPublicationPolicy} = createRequire(import.meta.url)('../lib/node/cryptanalysis/publication-policy.cjs');
try {
  const [command, ...extra] = process.argv.slice(2);
  if (extra.length || !['export', 'check', 'check-export', 'check-policy'].includes(command)) throw new Error('Usage: published-analyses.mjs <export|check|check-export|check-policy>');
  if (command === 'check-policy') console.log(`PASS: ${createPublicationPolicy(root).fieldCount} publication field paths classified independently of scientific schemas.`);
  else {
    const counts = command === 'export' ? exportPublishedDataset(root)
      : command === 'check-export' ? checkExport(root) : validatePublishedDataset(root).publication.counts;
    console.log(`PASS: published analysis ${command}; ${counts.records} detailed records, ${counts.entries} entries, ${counts.parameterized_families} parameterized families, ${counts.sources} sources.`);
  }
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}

import {existsSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(join(root, 'data/cryptanalysis/manifest.json'))) {
  console.error('Dataset tests require a configured cryptanalysis dataset.');
  process.exitCode = 1;
} else if (!existsSync(join(root, 'tests/fixtures')) || !existsSync(join(root, 'tests/corpus'))) {
  console.error('Dataset tests require their test suites and fixtures.');
  process.exitCode = 1;
} else {
  const suites = readdirSync(join(root, 'tests/corpus')).filter(file => file.endsWith('.test.mjs')).map(file => `tests/corpus/${file}`);
  suites.push(...readdirSync(join(root, 'src/features/cryptanalysis')).filter(file => file.endsWith('.test.mjs')).map(file => `src/features/cryptanalysis/${file}`));
  const steps = [
    [process.execPath, ['scripts/atlas.cjs', 'check']],
    [process.execPath, ['--test', '--test-concurrency=2', ...suites]],
    [process.execPath, ['tests/corpus/legacy/comparison.cjs']],
    [process.execPath, ['tests/corpus/legacy/census.cjs']],
    [process.execPath, ['scripts/atlas.cjs', 'witnesses']],
  ];
  for (const [command, args] of steps) {
    const result = spawnSync(command, args, {cwd:root, stdio:'inherit'});
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
  }
}

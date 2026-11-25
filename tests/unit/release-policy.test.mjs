import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPublicBundle, checkTrackedPrivateFiles, privateWorkspacePath, publicationPatterns} from '../../scripts/check-public-bundle.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const privateDirectories = [
  '.cache', '.local', '.agents', '.codex', '.claude', '.cursor', '.windsurf',
  '.continue', '.gemini', '.opencode', '.copilot', '.clinerules', 'skills',
  'prompts', 'sessions', 'transcripts', '.github/agents', '.github/instructions',
  '.github/prompts', 'tests/fixtures', 'data/cryptanalysis', 'data/lean',
  'tests/corpus', 'tests/ui-local', 'reports', 'papers', 'archive', 'vendor',
];
const privateFiles = [
  'AGENT.md', 'AGENTS.md', 'AGENTS.override.md', 'CLAUDE.md', 'CLAUDE.local.md',
  'GEMINI.md', 'SKILL.md', 'copilot-instructions.md', '.cursorrules',
  '.windsurfrules', '.clinerules', '.aider.conf.yml', '.aider.chat.history.md',
  'docs/AGENT.md.gz', 'nested/SKILL.md.br', 'AGENTS.md.bak',
  'src/features/cryptanalysis/synthetic.test.mjs',
];

test('public artifacts reject private research and agent directories even without a corpus', async t => {
  for (const privateDirectory of privateDirectories) {
    await t.test(privateDirectory, subtest => {
      const root = mkdtempSync(join(tmpdir(), 'atlas-release-policy-'));
      subtest.after(() => rmSync(root, {recursive: true, force: true}));
      const output = join(root, 'dist');
      mkdirSync(join(output, privateDirectory), {recursive: true});
      writeFileSync(join(output, 'index.html'), '<!doctype html><div id="root"></div>');
      writeFileSync(join(output, 'app.js'), 'export {};');
      writeFileSync(join(output, 'atlas-build-profile.json'), JSON.stringify({
        schema_version: 1, profile: 'public', analysis_included: false,
        analysis_record_count: 0, analysis_source_count: 0,
      }));
      assert.throws(() => checkPublicBundle({projectRoot: root, outputDirectory: output}), /Public release rejected/);
    });
  }
});

test('publication rules are optional, validated and keep values out of errors', t => {
  const root = mkdtempSync(join(tmpdir(), 'atlas-publication-rules-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  assert.deepEqual(publicationPatterns(root), []);
  mkdirSync(join(root, '.local'));
  const file = join(root, '.local/publication-policy.json');
  writeFileSync(file, JSON.stringify({patterns:['synthetic-restricted-value']}));
  assert(publicationPatterns(root)[0].test('SYNTHETIC-RESTRICTED-VALUE'));
  for (const contents of ['{}', '{', JSON.stringify({patterns:[42]}), JSON.stringify({patterns:['[']})]) {
    writeFileSync(file, contents);
    assert.throws(() => publicationPatterns(root), {message:'Invalid local publication rules.'});
  }
});

test('public artifacts reject agent instructions and compressed skill files', async t => {
  for (const privateFile of privateFiles) {
    await t.test(privateFile, subtest => {
      const root = mkdtempSync(join(tmpdir(), 'atlas-private-instructions-'));
      subtest.after(() => rmSync(root, {recursive: true, force: true}));
      const output = join(root, 'dist'), target = join(output, privateFile);
      mkdirSync(dirname(target), {recursive: true});
      writeFileSync(join(output, 'index.html'), '<!doctype html><div id="root"></div>');
      writeFileSync(join(output, 'app.js'), 'export {};');
      writeFileSync(target, 'Synthetic private instructions; not actual workspace content.');
      assert.throws(() => checkPublicBundle({projectRoot: root, outputDirectory: output}), /Public release rejected/);
    });
  }
});

test('Git ignore rules cover private paths without hiding public project files', t => {
  const root = mkdtempSync(join(tmpdir(), 'atlas-ignore-policy-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  assert.equal(spawnSync('git', ['init', '--quiet'], {cwd:root}).status, 0);
  writeFileSync(join(root, '.gitignore'), readFileSync(join(repositoryRoot, '.gitignore')));
  const ignoredPaths = [...privateDirectories.map(directory => `${directory}/synthetic-private.txt`),
    ...privateFiles,
    'nested/.agents/skills/synthetic/SKILL.md', 'nested/AGENTS.md', '.env', '.env.production', 'secret.pem'];
  const publicPaths = ['README.md', 'CONTRIBUTING.md', 'docs/architecture.md',
    'src/components/MathText.tsx', 'schemas/cryptanalysis/result.schema.json',
    'tests/unit/result-model.test.mjs', '.env.example'];
  const git = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: root, input: ignoredPaths.concat(publicPaths).join('\n') + '\n', encoding: 'utf8',
  });
  assert.equal(git.status, 0, git.stderr);
  assert.deepEqual(new Set(git.stdout.trim().split('\n')), new Set(ignoredPaths));
  for (const path of ignoredPaths) assert(privateWorkspacePath(path), path);
  for (const path of publicPaths) assert(!privateWorkspacePath(path), path);
});

test('release checks reject force-tracked private files without deleting local content', t => {
  const root = mkdtempSync(join(tmpdir(), 'atlas-private-git-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const git = args => {
    const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
  };
  git(['init', '--quiet']);
  writeFileSync(join(root, '.gitignore'), readFileSync(join(repositoryRoot, '.gitignore')));
  writeFileSync(join(root, 'README.md'), 'Synthetic public project.');
  git(['add', '--', 'README.md']);
  checkTrackedPrivateFiles(root);
  const file = join(root, '.agents/skills/synthetic/SKILL.md');
  mkdirSync(dirname(file), {recursive: true});
  writeFileSync(file, 'Synthetic private skill, not an actual instruction.');
  git(['add', '--force', '--', '.agents/skills/synthetic/SKILL.md']);
  assert.throws(() => checkTrackedPrivateFiles(root), /private workspace files are tracked by Git/);
  assert.throws(() => checkPublicBundle({projectRoot: root}), /private workspace files are tracked by Git/);
  assert.equal(readFileSync(file, 'utf8'), 'Synthetic private skill, not an actual instruction.');
});

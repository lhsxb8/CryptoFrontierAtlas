import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import atlas from '../atlas.config.cjs';
import distribution from '../lib/distribution.cjs';
const require = createRequire(import.meta.url);
const {loadPrimitiveCatalog, validatePrimitiveCatalog} = require('../lib/node/primitive-catalog.cjs');
const {releaseMetadata, checkVersion} = require('../lib/node/release.cjs');
const {validateDiagramAssets, digest} = require('../lib/node/primitive-diagrams.cjs');
const {validatePublishedDataset} = require('../lib/node/cryptanalysis/published.cjs');
const {loadDataset} = require('../lib/node/cryptanalysis/dataset.cjs');
const {validatePublicAssets} = require('../lib/node/public-assets.cjs');
const safety = require('../lib/node/publication-safety.cjs');
const {privateWorkspacePath} = require('../lib/node/private-paths.cjs');
export {privateWorkspacePath};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const primitiveTypes = new Set(['block_cipher', 'stream_cipher', 'permutation', 'hash_function', 'aead', 'other']);
const receiptName = 'atlas-build-profile.json';
export function publicationPatterns(projectRoot = repositoryRoot) {
  return safety.publicationPatterns(projectRoot);
}

export function checkTrackedPrivateFiles(projectRoot = repositoryRoot) {
  if (!existsSync(join(projectRoot, '.git'))) return;
  const tracked = spawnSync('git', ['ls-files', '--cached', '-z'], {
    cwd: projectRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (tracked.error || tracked.status !== 0) throw new Error('Cannot inspect tracked files before publication.');
  const findings = tracked.stdout.split('\0').filter(path => path && privateWorkspacePath(path));
  if (findings.length) {
    throw new Error(`Public release rejected: private workspace files are tracked by Git:\n${findings.slice(0, 20).join('\n')}`);
  }
}

function hasPrivateCorpus(projectRoot) {
  const directory = atlas.resolvePaths(projectRoot).cryptanalysis;
  try {
    const info = lstatSync(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error('The private analysis data path must be a real directory; refusing a partial or redirected corpus.');
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function verifyPublicReceipt(projectRoot, directory) {
  let receipt;
  try {
    receipt = readJson(join(directory, receiptName));
  } catch {
    throw new Error(`Missing or invalid ${receiptName}; rebuild with the public data profile before publishing.`);
  }
  if (!receipt || Array.isArray(receipt) || receipt.schema_version !== 2 || receipt.profile !== 'public'
    || receipt.analysis_included !== true) {
    throw new Error(`Public release rejected: ${receiptName} must declare schema_version 2, profile public and analysis_included true.`);
  }
  const data = loadDataset(projectRoot, 'public');
  const expected = JSON.stringify(data);
  const expectedHash = digest(Buffer.from(expected));
  const assetName = `analysis-${expectedHash}.json`;
  const asset = join(directory, assetName);
  if (receipt.analysis_record_count !== data.results.length || receipt.analysis_source_count !== data.sources.length
    || receipt.analysis_entry_count !== data.results.length + data.compactResults.length
    || receipt.analysis_family_count !== data.familyCatalogs.reduce((sum, catalog) => sum + catalog.families.length, 0)
    || receipt.analysis_sha256 !== expectedHash || receipt.analysis_asset !== assetName
    || !existsSync(asset) || readFileSync(asset, 'utf8') !== expected) {
    throw new Error('Public release rejected: missing, changed or stale published analysis asset. Rebuild the public website.');
  }
  return assetName;
}

/**
 * Use identities and version-specific metadata, not paper titles, authors,
 * URLs, DOI/ePrint identifiers or AES variant names: those also belong in
 * legitimate public question citations.
 */
export function privateAnalysisMarkers(projectRoot = repositoryRoot, publishedRoot = projectRoot) {
  const dataRoot = atlas.resolvePaths(projectRoot).cryptanalysis;
  const manifest = readJson(join(dataRoot, 'manifest.json'));
  const sources = readJson(join(dataRoot, 'sources.json'));
  const coverage = readJson(join(dataRoot, 'coverage.json'));
  const ciphers = readJson(join(dataRoot, 'ciphers.json'));
  const variants = readJson(join(dataRoot, 'variants.json'));
  if (manifest.local_only !== true) {
    throw new Error('Analysis publication policy changed; review the public-bundle guard before publishing.');
  }
  if (!Array.isArray(manifest.records) || manifest.record_count !== manifest.records.length
    || new Set(manifest.records).size !== manifest.records.length
    || !manifest.records.every(id => typeof id === 'string' && identifierPattern.test(id))) {
    throw new Error('Invalid analysis manifest; cannot establish the private-record boundary.');
  }
  if (!Array.isArray(sources) || manifest.source_count !== sources.length
    || new Set(sources.map(source => source.id)).size !== sources.length) {
    throw new Error('Invalid analysis sources; cannot establish the private-source boundary.');
  }
  if (!Array.isArray(ciphers) || ciphers.length === 0 || !ciphers.every(cipher =>
    typeof cipher?.id === 'string' && identifierPattern.test(cipher.id)
    && typeof cipher.name === 'string' && cipher.name.trim().length > 0
    && primitiveTypes.has(cipher.primitive_type)
    && Array.isArray(cipher.aliases) && cipher.aliases.every(alias => typeof alias === 'string' && alias.trim().length > 0)
    && typeof cipher.description === 'string' && cipher.description.trim().length > 0)
    || new Set(ciphers.map(cipher => cipher.id)).size !== ciphers.length) {
    throw new Error('Invalid cipher families; refusing a partial private corpus.');
  }
  const cipherMap = new Map(ciphers.map(cipher => [cipher.id, cipher]));
  if (!Array.isArray(variants) || variants.length === 0 || !variants.every(variant => identifierPattern.test(variant?.id))
    || new Set(variants.map(variant => variant.id)).size !== variants.length) {
    throw new Error('Invalid analysis variants; refusing a partial private corpus.');
  }
  for (const variant of variants) {
    const cipher = cipherMap.get(variant.family);
    if (!cipher || !Number.isInteger(variant.full_rounds) || variant.full_rounds < 1
      || ['key_bits', 'block_bits'].some(field => variant[field] !== undefined && (!Number.isInteger(variant[field]) || variant[field] < 1))
      || (cipher.primitive_type === 'block_cipher' && (variant.key_bits === undefined || variant.block_bits === undefined))) {
      throw new Error('Invalid cipher-instance parameters or family relationship.');
    }
  }
  if (!coverage || !Array.isArray(coverage.issues) || !Array.isArray(coverage.pending_sources)
    || !Array.isArray(coverage.family_ids) || coverage.family_ids.length === 0
    || new Set(coverage.family_ids).size !== coverage.family_ids.length
    || !coverage.family_ids.every(id => cipherMap.has(id))
    || (coverage.ingestion_batches !== undefined && !Array.isArray(coverage.ingestion_batches))) {
    throw new Error('Invalid analysis coverage; refusing a partial private corpus.');
  }
  for (const id of manifest.records) {
    const record = readJson(join(dataRoot, 'results', `${id}.json`));
    if (!record || record.id !== id || !record.target || !record.setting || !record.resources || typeof record.result_kind !== 'string') {
      throw new Error('Invalid analysis record; refusing a partial private corpus.');
    }
  }

  // Approved snapshot identities and source hashes are no longer private. Only
  // exact, validated public strings may be exempted, never a substring match.
  const approved = new Set();
  if (existsSync(join(atlas.resolvePaths(publishedRoot, 'public').cryptanalysis, 'publication.json'))) {
    const visit = value => {
      if (typeof value === 'string') approved.add(value);
      else if (value && typeof value === 'object') for (const child of Object.values(value)) visit(child);
    };
    visit(validatePublishedDataset(publishedRoot).data);
  }
  const markers = new Map();
  function add(kind, value) {
    if (typeof value === 'string' && value.length > 0 && !approved.has(value)) markers.set(value, { kind, value });
  }
  for (const id of manifest.records) add('private record identifier', id);
  const entries = join(dataRoot, 'entries');
  if (existsSync(entries)) for (const file of readdirSync(entries).filter(name => name.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(entries, file), 'utf8').split(/\r?\n/).filter(Boolean)) add('private compact identifier', JSON.parse(line).id);
  }
  for (const cipher of ciphers) {
    // Family IDs, names and aliases can be as short/common as "aes"; only a
    // complete catalog description is suitable as an exact private marker.
    if (cipher.description.length >= 60) add('private cipher-catalog metadata', cipher.description);
  }
  for (const source of sources) {
    if (!identifierPattern.test(source.id)) throw new Error('Invalid private-source identifier.');
    add('private source identifier', source.id);
    for (const field of ['content_sha256', 'artifact_sha256']) {
      const value = source[field];
      if (value !== null && value !== undefined) {
        if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Invalid private-source fingerprint.');
        add('private source fingerprint', value);
      }
    }
    // Long, exact version/audit statements also catch isolated metadata leaks.
    for (const field of ['inspected_version', 'hash_note']) {
      if (typeof source[field] === 'string' && source[field].length >= 60) {
        add('private source-version metadata', source[field]);
      }
    }
  }
  for (const issue of coverage.issues ?? []) add('private coverage-issue identifier', issue.id);
  for (const source of coverage.pending_sources ?? []) add('private pending-source identifier', source.id);
  for (const batch of coverage.ingestion_batches ?? []) add('private ingestion-batch identifier', batch.id);
  return Array.from(markers.values());
}

function outputFiles(directory) {
  let info;
  try {
    info = lstatSync(directory);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Public output directory is missing: ${directory}. Run npm run build first.`);
    throw error;
  }
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Public output must be a real directory, not a symlink or file.');
  const files = [];
  function visit(parent) {
    for (const name of readdirSync(parent).sort()) {
      const path = join(parent, name);
      const entry = lstatSync(path);
      if (entry.isSymbolicLink()) throw new Error(`Public output contains an unchecked symlink: ${relative(directory, path)}`);
      if (privateWorkspacePath(relative(directory, path))) {
        throw new Error(`Public release rejected: private workspace directory or file found at ${relative(directory, path)}.`);
      }
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`Public output contains an unsupported entry: ${relative(directory, path)}`);
    }
  }
  visit(directory);
  if (!files.includes(join(directory, 'index.html')) || !files.some(path => /\.(?:m?js)$/.test(path))) {
    throw new Error('Public output is incomplete: expected index.html and a JavaScript application asset.');
  }
  return files;
}

function readableContents(path, decodeEscapes = true) {
  let bytes = readFileSync(path);
  try {
    if (extname(path) === '.gz') bytes = gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 });
    if (extname(path) === '.br') bytes = brotliDecompressSync(bytes, { maxOutputLength: 64 * 1024 * 1024 });
  } catch {
    throw new Error(`Cannot inspect compressed public asset: ${path}`);
  }
  // Source maps and JS strings can escape ASCII identifiers as \uXXXX/\xXX.
  // No code is evaluated. Ordinary Vite outputs remain plain UTF-8 text.
  const text = bytes.toString('utf8');
  if (!decodeEscapes) return text;
  return text.replace(/\\+(?:u\{([0-9a-f]{1,6})\}|u([0-9a-f]{4})|x([0-9a-f]{2}))/gi,
    (match, point, unicode, hex) => {
      const value = Number.parseInt(point ?? unicode ?? hex, 16);
      return value <= 0x10ffff ? String.fromCodePoint(value) : match;
    });
}

function containsRawAnalysisData(text) {
  let value;
  try { value = JSON.parse(text); } catch { return false; }
  const pending = [value];
  while (pending.length > 0) {
    const item = pending.pop();
    if (!item || typeof item !== 'object') continue;
    if (!Array.isArray(item) && (
      (typeof item.result_kind === 'string' && item.target && item.setting && item.resources)
      || (Array.isArray(item.records) && 'local_only' in item && 'source_count' in item)
      || (typeof item.inspected_version === 'string' && Array.isArray(item.authors) && Array.isArray(item.locators))
      || (typeof item.coverage_kind === 'string' && item.included_counts && Array.isArray(item.not_yet_covered))
      || (typeof item.id === 'string' && typeof item.primitive_type === 'string' && Array.isArray(item.aliases) && typeof item.description === 'string')
      || (typeof item.family === 'string' && typeof item.specification_source === 'string' && 'full_rounds' in item)
    )) return true;
    pending.push(...Object.values(item));
  }
  return false;
}

function verifyPublicCatalog(projectRoot, directory) {
  try {
    const expected = loadPrimitiveCatalog(projectRoot);
    const actual = validatePrimitiveCatalog(readJson(join(directory, 'atlas-catalog.json')));
    const release = readJson(join(directory, 'atlas-release.json'));
    checkVersion(projectRoot);
    if (JSON.stringify(actual) !== JSON.stringify(expected)
      || JSON.stringify(release) !== JSON.stringify(releaseMetadata(projectRoot, expected))) throw new Error();
    const diagrams = validateDiagramAssets(projectRoot, expected);
    const staticAssets = validatePublicAssets(projectRoot);
    for (const [file, expectedHash] of staticAssets) {
      if (digest(readFileSync(join(directory, file))) !== expectedHash) throw new Error('Changed static asset');
    }
    if (JSON.stringify(readJson(join(directory, 'atlas-diagrams.json'))) !== JSON.stringify(diagrams)) throw new Error();
    for (const asset of diagrams.manifest.assets) {
      if (digest(readFileSync(join(directory, asset.asset))) !== asset.svg_sha256
        || digest(readFileSync(join(directory, asset.tex))) !== asset.tex_sha256) throw new Error();
    }
  } catch {
    // Keep invalid or accidentally private payloads out of release-check errors.
    throw new Error('Public release rejected: missing, invalid or stale public catalog/release metadata or diagram assets. Rebuild the website.');
  }
}

/** Read-only regression guard; the build-time data profile is the boundary. */
export function checkPublicBundle({ projectRoot = repositoryRoot, outputDirectory = join(projectRoot, 'dist') } = {}) {
  checkTrackedPrivateFiles(projectRoot);
  const directory = resolve(outputDirectory);
  const files = outputFiles(directory);
  const analysisAsset = verifyPublicReceipt(projectRoot, directory);
  for (const file of distribution.publicAssetFiles) {
    const expected = join(projectRoot, file), actual = join(directory, file);
    if (!existsSync(actual) || !existsSync(expected) || !readFileSync(actual).equals(readFileSync(expected))) {
      throw new Error(`Public release rejected: missing or changed distribution asset ${file}. Rebuild the public website.`);
    }
  }
  verifyPublicCatalog(projectRoot, directory);
  const markerRoot = process.env.ATLAS_PRIVATE_REFERENCE || projectRoot;
  const corpusAvailable = hasPrivateCorpus(markerRoot);
  if (resolve(markerRoot) !== resolve(projectRoot) && !corpusAvailable) {
    throw new Error('The requested private reference corpus is missing; exact checks were not performed.');
  }
  const markers = corpusAvailable ? privateAnalysisMarkers(markerRoot, projectRoot) : [];
  const patterns = publicationPatterns(projectRoot);
  const findings = [];
  for (const path of files) {
    const relativePath = relative(directory, path);
    const text = `${relativePath}\n${readableContents(path)}`;
    const kinds = new Set();
    const normalizedPath = relativePath.replaceAll('\\', '/');
    if (/(?:^|\/)data\/results(?:\/|$)/i.test(normalizedPath)
      || /(?:^|\/)(?:sources|ciphers|variants|coverage)\.json(?:\.(?:gz|br))?$/i.test(normalizedPath)
      || (relativePath !== analysisAsset && /\.json(?:\.(?:gz|br))?$/i.test(path) && containsRawAnalysisData(readableContents(path, false)))) {
      kinds.add('raw analysis dataset file');
    }
    for (const marker of markers) {
      if (text.includes(marker.value)) kinds.add(marker.kind);
    }
    if (patterns.some(pattern => pattern.test(text))) kinds.add('restricted content');
    if (safety.credentialLike(text)) kinds.add('credential-like content');
    if (kinds.size > 0) findings.push({ file: relativePath, kinds: Array.from(kinds).sort() });
  }
  if (findings.length > 0) {
    // Report locations/categories without printing private scientific excerpts.
    const details = findings.slice(0, 20).map(finding => `  ${finding.file}: ${finding.kinds.join(', ')}`).join('\n');
    const remaining = findings.length > 20 ? `\n  … and ${findings.length - 20} more files` : '';
    throw new Error(`Public release rejected: restricted content found in ${findings.length} file(s).\n${details}${remaining}`);
  }
  return { fileCount: files.length, markerCount: markers.length, profile: 'public', corpusAvailable };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const arguments_ = process.argv.slice(2);
    if (arguments_.length > 1 || arguments_[0]?.startsWith('-')) {
      throw new Error('Usage: node scripts/check-public-bundle.mjs [output-directory]');
    }
    const result = checkPublicBundle(arguments_.length ? { outputDirectory: resolve(arguments_[0]) } : {});
    console.log(`PASS: Release profile and distribution assets verified; ${result.fileCount} output files inspected.`);
  } catch (error) {
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

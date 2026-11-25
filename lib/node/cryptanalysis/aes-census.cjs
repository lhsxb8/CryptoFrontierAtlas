'use strict';
// Bibliographic discovery only. Candidates never become scientific result records here.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../../..');
const {resolvePaths} = require('../../../atlas.config.cjs');
const reports = resolvePaths(root).reports;
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
function resultEntries() {
  const file = path.join(root, 'data/cryptanalysis/entries/aes.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line)) : [];
}
const normal = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\\["'`^~=.uvHckbdtr]?\s*\{?([A-Za-z])\}?/g, '$1').replace(/[^a-z0-9]/gi, '').toLowerCase();

function bibFields(entry) {
  const fields = {};
  // CryptoBib's generated quoted fields may span lines and contain protected quotes.
  const pattern = /^\s*(\w+)\s*=\s*("(?:\\.|[^"\\])*"|\{[^\n]*\}|[^,\n]+)\s*,?\s*$/gm;
  for (const match of entry.matchAll(pattern)) {
    let value = match[2].trim();
    if (value.startsWith('"') || value.startsWith('{')) value = value.slice(1, -1);
    fields[match[1].toLowerCase()] = value.replace(/\s+/g, ' ').trim();
  }
  return fields;
}

function discoverBib(text, cutoffYear) {
  const groups = new Map();
  let entryCount = 0;
  let matchingEntries = 0;
  for (const entry of text.split(/(?=^@\w+\{)/m)) {
    const header = entry.match(/^@(\w+)\{([^,]+),/);
    if (!header) continue;
    entryCount++;
    const fields = bibFields(entry);
    const title = (fields.title || '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
    const year = Number(fields.year);
    if (!/\bAES(?:\b|[-/])|rijndael|advanced encryption standard/i.test(title)) continue;
    if (!Number.isInteger(year) || year > cutoffYear) continue;
    matchingEntries++;
    const authors = fields.author || '';
    const identity = `${normal(title)}:${normal(authors)}`;
    const id = 'aes-work-' + crypto.createHash('sha256').update(identity).digest('hex').slice(0, 16);
    const work = groups.get(identity) || {
      id, title, authors_bibtex: authors, status: 'discovered', tracks: [],
      identity_basis: 'provisional-exact-normalized-title-and-author-list',
      source_ids: [], result_ids: [], editions: [], audit: null,
    };
    work.editions.push({ bibkey: header[2], year, venue: header[2].split(':')[0],
      doi: fields.doi || null, url: fields.url || (fields.doi ? `https://doi.org/${fields.doi}` : null) });
    groups.set(identity, work);
  }
  return { entry_count: entryCount, matching_entries: matchingEntries,
    works: [...groups.values()].sort((a, b) => Math.min(...a.editions.map(e => e.year)) - Math.min(...b.editions.map(e => e.year)) || a.title.localeCompare(b.title)) };
}

function validateCensus(census) {
  if (census.schema_version !== 1 || !Array.isArray(census.works) || !Array.isArray(census.tracks)) throw new Error('Invalid census structure');
  const sources = new Set(read('data/cryptanalysis/sources.json').map(source => source.id));
  const records = new Set(read('data/cryptanalysis/manifest.json').records);
  const entries = new Map(resultEntries().map(entry => [entry.id, entry]));
  const tracks = new Set(census.tracks.map(track => track.id));
  const ids = new Set();
  const statuses = new Set(['discovered', 'screened', 'review_in_progress', 'partially_ingested', 'audited', 'reference_checked', 'excluded', 'access_blocked']);
  for (const work of census.works) {
    if (ids.has(work.id) || !work.id || !work.title || !statuses.has(work.status)) throw new Error('Invalid or duplicate census work: ' + work.id);
    ids.add(work.id);
    for (const id of work.source_ids) if (!sources.has(id)) throw new Error('Unknown census source: ' + id);
    for (const id of work.result_ids) if (!records.has(id)) throw new Error('Unknown census result: ' + id);
    if (work.entry_ids !== undefined) {
      if (!Array.isArray(work.entry_ids) || new Set(work.entry_ids).size !== work.entry_ids.length) throw new Error('Invalid census entry IDs: ' + work.id);
      for (const id of work.entry_ids) {
        if (!entries.has(id)) throw new Error('Unknown census entry: ' + id);
        if (!work.source_ids.includes(entries.get(id).source_id)) throw new Error('Census entry/source mismatch: ' + id);
      }
    }
    for (const id of work.tracks) if (!tracks.has(id)) throw new Error('Unknown census track: ' + id);
    if (['audited', 'reference_checked', 'excluded', 'access_blocked'].includes(work.status) && (!work.audit || !work.audit.note || !work.audit.reviewed_on)) throw new Error('A terminal work status needs an audit: ' + work.id);
    if (work.status === 'audited' && (!work.audit.full_text_reviewed || !work.audit.result_inventory_complete || !work.audit.forward_search_checked)) throw new Error('An audited paper needs full text, result inventory and follow-up checks: ' + work.id);
  }
  if (census.status === 'complete' && (census.tracks.some(track => track.status !== 'audited') || census.works.some(work => !['audited', 'reference_checked', 'excluded'].includes(work.status)))) throw new Error('The census still has unfinished tracks or papers');
  return census;
}

function progressReport(census) {
  validateCensus(census);
  const manifest = read('data/cryptanalysis/manifest.json');
  const entries = resultEntries();
  const detailedIds = new Set(manifest.records);
  const compactOnly = entries.filter(entry => !detailedIds.has(entry.id)).length;
  const uniqueResults = new Set([...manifest.records, ...entries.map(entry => entry.id)]).size;
  const {loadCatalogs, catalogStats} = require('./result-families.cjs');
  const familyCatalog = loadCatalogs(root).find(catalog => catalog.cipher_family_id === 'aes');
  const familyCounts = familyCatalog ? catalogStats(familyCatalog) : null;
  const counts = Object.fromEntries([...new Set(census.works.map(work => work.status))].map(status => [status, census.works.filter(work => work.status === status).length]));
  const lines = ['# AES 全范围汇总进度', '', `更新：${census.updated_on}；检索截止：${census.cutoff_date}；状态：${census.status}。`, '',
    `详细结果库：${manifest.record_count} 条记录、${manifest.source_count} 个审查来源版本。紧凑索引：${entries.length} 条，其中 ${compactOnly} 条仅紧凑存储、${entries.length - compactOnly} 条引用详细记录；全库去重后 ${uniqueResults} 个证据点，不等于独立攻击数。`, '',
    ...(familyCounts ? [`结果族归纳：${familyCounts.result_families} 族，包含 ${familyCounts.parameterized_families} 个参数化族（${familyCounts.formula_families} 个公式模型、${familyCounts.table_families} 个参数表）和 ${familyCounts.standalone_points} 个固定单点；${familyCounts.grouped_points} 个证据点已归入参数化族。主动范围共 ${familyCounts.active_points} 点，另 ${familyCounts.excluded_points} 个历史量子 implementation 点保留但排除主动归纳。详见 [AES-RESULT-FAMILIES.md](AES-RESULT-FAMILIES.md)。`, '',
      '族归纳不新增攻击点，也不自动认证 SOTA；原文公式的参数域与已核验配置分开保存。', ''] : []),
    `文献清单：${census.works.length} 个候选工作分组；自动分组按标题与作者形成，全文审查时核对版本身份。${census.works.filter(work => work.entry_ids?.length).length} 个分组已建立本轮紧凑条目清单，这不等于完整论文审计。`, '',
    `相对 AES 文献汇总任务的初始基线：新增 ${manifest.record_count - census.baseline.result_count} 条详细记录、${manifest.source_count - census.baseline.source_version_count} 个来源版本；紧凑独有结果另计，不与详细引用重复相加。`, '',
    '发现数量是动态分母；逐篇完成需满足全文审查、结果清单和后续文献核对三项要求。结果数量与文献完成率分别统计。', '',
    '## 文献处理状态', '', '| 状态 | 数量 |', '| --- | ---: |',
    ...Object.entries(counts).map(([status, count]) => `| ${status} | ${count} |`), '',
    '## 分类进度', '', '| 分支 | 状态 | 当前任务 |', '| --- | --- | --- |',
    ...census.tracks.map(track => `| ${track.title} | ${track.status} | ${track.next_action} |`), '',
    '## 完成判据', '', ...census.completion_criteria.map(item => '- ' + item), '',
    '## 检索批次', '', ...census.discovery_runs.map(run => `- ${run.id}：${run.description}；${run.retrieved_on}。来源：${run.url}。SHA-256：\`${run.sha256 || '未保存字节哈希'}\`。`), '',
    '## 下一批', '', ...census.next_actions.map(item => '- ' + item), '',
    '完整候选文献、版本线索及逐篇状态见 [aes-census.json](../../../data/cryptanalysis/aes-census.json)。详细结果见 [AES-PILOT.md](AES-PILOT.md) 和逐条 JSON；历史、非前沿及待比较条目见 [aes.jsonl](../../../data/cryptanalysis/entries/aes.jsonl)。', ''];
  return lines.join('\n');
}

module.exports = { bibFields, discoverBib, validateCensus, progressReport };
if (require.main === module) {
  if (process.argv[2] === 'discover-bib') {
    process.stdout.write(JSON.stringify(discoverBib(fs.readFileSync(process.argv[3], 'utf8'), Number(process.argv[4] || 2026))));
  } else {
    const census = validateCensus(read('data/cryptanalysis/aes-census.json'));
    if (process.argv[2] === 'report') {
      const report = progressReport(census);
      if (process.argv.includes('--write')) {
        fs.mkdirSync(reports, {recursive: true});
        fs.writeFileSync(path.join(reports, 'AES-PROGRESS.md'), report);
        console.log('Updated ' + path.relative(root, path.join(reports, 'AES-PROGRESS.md')));
      } else process.stdout.write(report);
    }
    else console.log(`PASS: ${census.works.length} candidate work groups; ${census.tracks.length} tracks; census status ${census.status}.`);
  }
}

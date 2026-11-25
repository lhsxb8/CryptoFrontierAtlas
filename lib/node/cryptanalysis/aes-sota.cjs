'use strict';

// A review worklist and a reproducible projection, not a second result store.
// Cost comparisons remain owned by compare.cjs; no normalization rules live here.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {compareReportedCosts} = require('../../cryptanalysis/compare.cjs');
const {experimentScope, hasSourceConflict, resultKind, successSummary} = require('../../cryptanalysis/result-model.cjs');
const {context, fingerprint} = require('./context.cjs');
const root = path.resolve(__dirname, '../../..');
const reviewFile = 'data/cryptanalysis/reviews/AES-SOTA-2026-11-02.json';
const {paths} = require('../../../atlas.config.cjs');
const jsonFile = paths.reports + '/AES-SOTA-MATRIX.json';
const markdownFile = paths.reports + '/AES-SOTA-MATRIX.md';
const candidateFile = paths.reports + '/AES-SOTA-CANDIDATES.md';
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const unique = values => [...new Set(values)].sort();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function exactScope(point, instance) {
  return {target: {variant_ids: [instance], rounds: point.target.rounds,
    full_round: point.target.full_round, round_convention: point.target.round_convention,
    ...(point.target.round_domain ? {round_domain: point.target.round_domain} : {})},
  result_kind: point.result_kind, goal: point.goal, method: point.display.method,
  setting: point.setting, candidate_space: point.candidate_space ?? null,
  experiment: experimentScope(point), theorem: point.theorem ?? null};
}

function matches(point, scope) {
  return point.target.variant_ids.some(id => scope.variant_ids.includes(id))
    && (!scope.rounds || scope.rounds.includes(point.target.rounds))
    && (!scope.goals || scope.goals.includes(point.goal))
    && (!scope.methods || scope.methods.includes(point.display.method))
    && (!scope.full_round_only || point.target.full_round === true)
    && ['key_model', 'computation', 'attack_surface'].every(key => !scope[key] || point.setting[key] === scope[key]);
}

function validateReview(review, ctx) {
  assert.equal(review.schema_version, 1);
  assert.match(review.baseline_hash, /^[a-f0-9]{64}$/);
  assert.match(review.reviewed_on, /^\d{4}-\d{2}-\d{2}$/);
  assert(review.reviewed_on >= ctx.manifest.reviewed_on, 'Use a current, not retrospective, snapshot');
  assert.equal(review.global_sota_certified, false);
  const sources = new Map(ctx.sources.map(source => [source.id, source]));
  const variants = new Set(ctx.variants.map(variant => variant.id));
  const papers = new Set(), claims = new Map(), extractedClaims = new Set(), lanes = new Set();
  for (const paper of review.papers) {
    assert(!papers.has(paper.id), 'Duplicate review paper'); papers.add(paper.id);
    assert(paper.checked_pages.length > 0, 'Record the actual targeted reading');
    assert(paper.checked_pages.every(page => Number.isInteger(page) && page > 0 && page <= paper.pdf.pages));
    assert.match(paper.pdf.sha256, /^[a-f0-9]{64}$/);
    if (paper.source_id) {
      assert(sources.has(paper.source_id), 'Unknown registered source');
      assert.equal(sources.get(paper.source_id).content_sha256, paper.pdf.sha256, 'Changed primary edition');
    }
    assert(paper.findings.length && paper.next_action, 'Keep evidence and the next evidence task');
    for (const claim of paper.pending_claims) {
      assert(!claims.has(claim.id) && !ctx.byId.has(claim.id), 'Pending claims are not indexed result IDs');
      claims.set(claim.id, claim);
      assert.equal(claim.status, 'pending_extraction');
      assert(claim.locator && claim.accounting && claim.next_action);
      assert(claim.scope.variant_ids.every(id => variants.has(id)));
      if (claim.scope.instance_model !== 'registered_instance') {
        assert.equal(claim.scope.variant_ids.length, 0, 'Do not project independent round keys onto standard AES');
      } else {
        assert(claim.scope.variant_ids.length > 0, 'Registered pending claims need an instance');
      }
    }
    for (const claim of paper.extracted_claims ?? []) {
      assert(!extractedClaims.has(claim.id) && !claims.has(claim.id), 'Duplicate extracted/pending claim');
      extractedClaims.add(claim.id);
      assert.equal(claim.status, 'extracted');
      assert(paper.source_id && claim.result_ids?.length, 'Extracted claims need a registered source and result references');
      assert.equal(new Set(claim.result_ids).size, claim.result_ids.length, 'Duplicate extracted result reference');
      assert(claim.scope.instance_model === 'registered_instance', 'Unresolved models stay pending');
      for (const id of claim.result_ids) {
        const point = ctx.byId.get(id);
        assert(point, 'Unknown extracted result');
        assert(point.evidence.some(item => item.source_id === paper.source_id), 'Extracted result/source mismatch');
        assert.equal(point.goal, claim.scope.goal, 'Extracted claim goal mismatch');
        assert.equal(point.target.rounds, claim.scope.rounds, 'Extracted claim rounds mismatch');
        assert.deepEqual([...point.target.variant_ids].sort(), [...claim.scope.variant_ids].sort(), 'Extracted claim instance mismatch');
      }
    }
  }
  assert([...extractedClaims].every(id => !claims.has(id)), 'A claim cannot be both extracted and pending');
  for (const lane of review.lanes) {
    assert(!lanes.has(lane.id), 'Duplicate review lane'); lanes.add(lane.id);
    assert(lane.scope.variant_ids.length && lane.scope.variant_ids.every(id => variants.has(id)));
    assert(lane.source_ids.every(id => sources.has(id)), 'Unknown lane source');
    assert(lane.pending_claim_ids.every(id => claims.has(id)), 'Unknown pending claim');
    for (const id of lane.pending_claim_ids) {
      const scope = claims.get(id).scope;
      assert(scope.instance_model === 'registered_instance'
        && scope.variant_ids.some(instance => lane.scope.variant_ids.includes(instance)),
      'Pending claim model must match its navigation lane');
      assert(!lane.scope.rounds || lane.scope.rounds.includes(scope.rounds), 'Pending claim rounds must match its lane');
      assert(!lane.scope.goals || lane.scope.goals.includes(scope.goal), 'Pending claim goal must match its lane');
    }
    assert(lane.next_action && Number.isInteger(lane.priority));
    for (const id of lane.result_ids ?? []) assert(ctx.byId.has(id), 'Unknown selected result');
  }
  assert(review.batches.flatMap(batch => batch.paper_ids).length === papers.size);
  assert.deepEqual(unique(review.batches.flatMap(batch => batch.paper_ids)), [...papers].sort());
  assert(review.batches.every(batch => batch.paper_ids.length <= 5), 'At most five papers per batch');
  return true;
}

function buildMatrix(ctx, census, review) {
  validateReview(review, ctx);
  const excluded = new Set(ctx.catalogs.flatMap(catalog => catalog.excluded_results.map(item => item.result_id)));
  const active = ctx.comparisonRecords.filter(point => !excluded.has(point.id));
  const standardIds = ['aes-128', 'aes-192', 'aes-256'];
  const familyByPoint = new Map();
  for (const catalog of ctx.catalogs) {
    for (const family of catalog.families) for (const point of family.points) familyByPoint.set(point.result_id, family.id);
    for (const id of catalog.standalone_result_ids) familyByPoint.set(id, id);
  }
  const cells = new Map(), buckets = new Map(), pointReports = [];
  for (const point of active) {
    const self = compareReportedCosts(point, point);
    const type = resultKind(point)?.comparable ? 'attack_cost' : 'supporting_evidence';
    const report = {result_id: point.id, family_id: familyByPoint.get(point.id), type,
      source_ids: unique(point.evidence.map(item => item.source_id)), source_conflict: hasSourceConflict(point),
      cost_vector_eligible: self.relation === 'equal', blockers: self.reasons, cell_ids: []};
    assert(report.family_id, 'Missing active family: ' + point.id);
    for (const instance of point.target.variant_ids) {
      const scope = exactScope(point, instance), key = fingerprint(scope), cellId = 'cell-' + key;
      if (!cells.has(key)) cells.set(key, {id: cellId, scope, result_ids: [], eligible_ids: [],
        dataset_frontier_ids: [], dominated_ids: [], unresolved_ids: [], comparisons: []});
      const cell = cells.get(key); cell.result_ids.push(point.id); report.cell_ids.push(cellId);
      (report.cost_vector_eligible ? cell.eligible_ids : cell.unresolved_ids).push(point.id);
      const summary = {instance, rounds: point.target.rounds, round_domain: point.target.round_domain ?? null,
        goal: point.goal, key_model: point.setting.key_model, computation: point.setting.computation,
        attack_surface: point.setting.attack_surface, method: point.display.method};
      const bucketKey = fingerprint(summary);
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, {...summary, point_ids: [], family_ids: [], cell_ids: [],
        attack_point_ids: [], supporting_point_ids: [], candidate_ids: [], lane_ids: []});
      const bucket = buckets.get(bucketKey);
      bucket.point_ids.push(point.id); bucket.family_ids.push(report.family_id); bucket.cell_ids.push(cellId);
      bucket[type === 'attack_cost' ? 'attack_point_ids' : 'supporting_point_ids'].push(point.id);
    }
    pointReports.push(report);
  }
  const points = ctx.byId;
  for (const cell of cells.values()) {
    // Self eligibility is not a global SOTA certificate. Only exact-scope peers
    // are offered to the unchanged comparator, with all coordinates retained.
    const project = id => ({...points.get(id), target: {...points.get(id).target,
      variant_ids: cell.scope.target.variant_ids}});
    for (let i = 0; i < cell.eligible_ids.length; i++) for (let j = i + 1; j < cell.eligible_ids.length; j++) {
      const a = cell.eligible_ids[i], b = cell.eligible_ids[j];
      cell.comparisons.push({a, b, ...compareReportedCosts(project(a), project(b))});
    }
    cell.dominated_ids = unique(cell.comparisons.flatMap(pair => pair.relation === 'a_dominates_reported_costs'
      ? [pair.b] : pair.relation === 'b_dominates_reported_costs' ? [pair.a] : []));
    cell.dataset_frontier_ids = cell.eligible_ids.filter(id => !cell.dominated_ids.includes(id));
  }
  const claimById = new Map(review.papers.flatMap(paper => paper.pending_claims.map(claim => [claim.id, claim])));
  const laneReports = review.lanes.map(lane => {
    const selected = active.filter(point => matches(point, lane.scope) && ((lane.result_ids ?? []).includes(point.id)
      || point.evidence.some(item => lane.source_ids.includes(item.source_id))));
    const selectedIds = new Set(selected.map(point => point.id));
    const matchingBuckets = [...buckets.values()].filter(bucket => bucket.point_ids.some(id => selectedIds.has(id))
      && lane.scope.variant_ids.includes(bucket.instance));
    for (const bucket of matchingBuckets) {
      bucket.candidate_ids.push(...bucket.point_ids.filter(id => selectedIds.has(id))); bucket.lane_ids.push(lane.id);
    }
    const primaryConflict = selected.some(hasSourceConflict);
    return {...lane, candidate_result_ids: selected.map(point => point.id).sort(),
      family_ids: unique(selected.map(point => familyByPoint.get(point.id))),
      strict_comparable_result_ids: selected.filter(point => compareReportedCosts(point, point).relation === 'equal').map(point => point.id).sort(),
      status: primaryConflict ? 'source_conflict' : lane.pending_claim_ids.length ? 'evidence_pending' : 'candidate_not_globally_certified'};
  }).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  // Claims not yet ingested are kept outside counts of indexed points/families.
  // Missing cells are requested research scopes, never invented zero-cost rows.
  const counts = {
    indexed_unique_points: ctx.comparisonRecords.length, active_unique_points: active.length,
    standard_aes_unique_points: active.filter(point => point.target.variant_ids.some(id => standardIds.includes(id))).length,
    other_instance_unique_points: active.filter(point => !point.target.variant_ids.some(id => standardIds.includes(id))).length,
    excluded_historical_points: excluded.size, projected_instance_points: pointReports.reduce((n, point) => n + point.cell_ids.length, 0),
    exact_scope_cells: cells.size, display_buckets: buckets.size, candidate_lanes: laneReports.length,
    selected_unique_points: new Set(laneReports.flatMap(lane => lane.candidate_result_ids)).size,
    eligible_unique_points: pointReports.filter(point => point.cost_vector_eligible).length,
    eligible_instance_points: [...cells.values()].reduce((n, cell) => n + cell.eligible_ids.length, 0),
    dominated_unique_points: new Set([...cells.values()].flatMap(cell => cell.dominated_ids)).size,
    targeted_papers_checked: review.papers.length, pending_claims: claimById.size,
    extracted_worklist_claims: review.papers.reduce((sum, paper) => sum + (paper.extracted_claims?.length ?? 0), 0),
    extracted_worklist_points: new Set(review.papers.flatMap(paper => (paper.extracted_claims ?? []).flatMap(claim => claim.result_ids))).size,
    pending_standard_claims: [...claimById.values()].filter(claim => claim.scope.instance_model === 'registered_instance').length,
    certified_global_sota_cells: 0
  };
  const outputBuckets = [...buckets.values()].map(bucket => ({...bucket,
    ...Object.fromEntries(['point_ids', 'family_ids', 'cell_ids', 'attack_point_ids', 'supporting_point_ids', 'candidate_ids', 'lane_ids']
      .map(key => [key, unique(bucket[key])]))}));
  outputBuckets.sort((a, b) => a.instance.localeCompare(b.instance) || (a.rounds ?? Infinity) - (b.rounds ?? Infinity)
    || a.goal.localeCompare(b.goal) || a.key_model.localeCompare(b.key_model) || a.method.localeCompare(b.method));
  return {schema_version: 1, snapshot_date: review.reviewed_on, baseline_hash: ctx.snapshot,
    review_baseline_hash: review.baseline_hash, review_baseline_current: review.baseline_hash === ctx.snapshot,
    rules_hash: hash(fs.readFileSync(require.resolve('../../cryptanalysis/compare.cjs'))),
    broad_discovery_cutoff: census.cutoff_date, targeted_search_through: review.reviewed_on,
    status: 'candidate_worklist_and_dataset_relative_comparison', global_sota_certified: false,
    scope_note: 'Display buckets are navigation only. Exact cells preserve the complete setting and round boundary. Supporting properties and nonstandard instances are retained separately; pending claims do not count as indexed results.',
    counts, lanes: laneReports, papers: review.papers, search_log: review.search_log, gaps: review.gaps,
    next_batch: review.next_batch, points: pointReports.sort((a, b) => a.result_id.localeCompare(b.result_id)),
    buckets: outputBuckets, cells: [...cells.values()].sort((a, b) => a.id.localeCompare(b.id))};
}

const escape = value => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const labels = {single_secret_key: 'Single-key', related_secret_keys: 'Related-key',
  known_key: 'Known-key', chosen_key_pair: 'Chosen-key', fixed_round_keys: 'Fixed round keys',
  key_recovery: 'Key recovery', partial_key_recovery: 'Partial key recovery', distinguishing: 'Distinguisher',
  source_conflict: '原文争议', evidence_pending: '补证中', candidate_not_globally_certified: '候选'};
const label = value => labels[value] ?? value;
function markdown(matrix, ctx) {
  const c = matrix.counts;
  const lines = ['# AES 候选 SOTA 核验矩阵', '',
    `快照：${matrix.snapshot_date}；全库广搜截止：${matrix.broad_discovery_cutoff}；本轮仅作定向补检。`, '',
    `覆盖 ${c.active_unique_points} 个主动证据点、${c.exact_scope_cells} 个精确比较单元，另保留 ${c.excluded_historical_points} 个历史排除点。其中 ${c.standard_aes_unique_points} 个点涉及标准 AES，${c.other_instance_unique_points} 个点仅涉及其他实例。`, '',
    `优先清单包含 ${c.candidate_lanes} 条研究方向、${c.selected_unique_points} 个已入库配置/证据点。累计定向核查 ${c.targeted_papers_checked} 篇，其中 ${c.extracted_worklist_claims} 项核验清单主张已映射为 ${c.extracted_worklist_points} 个入库配置；另有 ${c.pending_claims} 项尚未正式提取（${c.pending_standard_claims} 项标准实例，${c.pending_claims - c.pending_standard_claims} 项实例/密钥模型未决）。配置入库、完整论文审核与SOTA认证分别统计。`, '',
    `严格比较可处理 ${c.eligible_unique_points} 个唯一配置（实例投影后 ${c.eligible_instance_points} 点），全局 SOTA 认证为 ${c.certified_global_sota_cells}。缺成本和来源争议仍由原比较器拒绝，没有补成零或修改比较门槛。`, '',
    '## 优先候选及下一步', '',
    '以下各行是阅读与核验方向，不是一个可以互相比大小的 setting。标题中的 CP/KP、数据预算是核验主题，不是已生效的 oracle 或 data-cap 筛选；精确轮边界、oracle、弱密钥范围、成本与成功率均在 JSON 单元和原记录中保留。', '',
    '| 优先级 | 方向 | 既有点 / 族 | 新候选项 | 状态与下一证据 |', '| --- | --- | ---: | ---: | --- |'];
  for (const lane of matrix.lanes) lines.push(`| ${lane.priority} | ${escape(lane.title)} | ${lane.candidate_result_ids.length} / ${lane.family_ids.length} | ${lane.pending_claim_ids.length} | ${label(lane.status)}：${escape(lane.next_action)} |`);
  lines.push('', `## 累计 ${matrix.papers.length} 篇定向原文核查`, '');
  for (const paper of matrix.papers) {
    lines.push('### ' + paper.label + ' — ' + paper.title, '',
      `来源：${paper.source_id ? '`' + paper.source_id + '`' : '尚未注册的具名候选'}；原文检查 PDF ${paper.checked_pages.join(', ')} / ${paper.pdf.pages} 页。`, '',
      `取得版本：${paper.pdf.provenance}；SHA256：\`${paper.pdf.sha256}\`。`, '');
    for (const finding of paper.findings) lines.push('- ' + finding);
    for (const claim of paper.extracted_claims ?? []) lines.push('',
      `已入库主张 \`${claim.id}\` → ${claim.result_ids.map(id => '\`' + id + '\`').join(', ')}。`, '',
      `原文：${claim.locator}。${claim.accounting} 后续：${claim.next_action}`);
    for (const claim of paper.pending_claims) lines.push('', `候选 \`${claim.id}\`：${claim.summary}`, '',
      `原文：${claim.locator}。${claim.accounting} 下一步：${claim.next_action}`);
    lines.push('', '后续：' + paper.next_action, '');
  }
  lines.push('## 比较口径', '',
    '已选既有候选的原公式、可行域及每个配置完整成本向量见 [AES-SOTA-CANDIDATES.md](AES-SOTA-CANDIDATES.md)，无需逐个打开结果族比较。', '',
    '- 精确单元按实例、轮边界、目标、方法及完整 setting 隔离；概览桶仅用于导航。',
    '- 原文公式及可行域仍保存在原参数族；清单引用 point/family ID，不复制或拟合科学模型。',
    '- 时间、数据、内存、预处理和成功率必须来自同一配置；Enc、MA、CPU cycles、traces 和不同内存单位不自动换算。',
    '- 结构性质、概率界、条件过滤和部分恢复不参加完整主密钥攻击排名。AES-IND 不等于标准 AES。',
    '- 库内自比较可通过，仅表示该点字段足够；没有可比对手的单点不构成文献最佳或最优性证明。', '',
    '## 全范围概览', '',
    '每行含多个不同边界/假设时仍分属多个精确单元；“证据点”不等于独立攻击数。完整 ID、来源、阻塞原因和精确单元见 [AES-SOTA-MATRIX.json](AES-SOTA-MATRIX.json)。', '',
    '| 实例 | 轮数 | 目标 | Setting | 方法 | 攻击成本点 / 支持点 | 精确单元 | 已选候选点 |', '| --- | --- | --- | --- | --- | ---: | ---: | ---: |');
  for (const bucket of matrix.buckets) lines.push(`| ${escape(bucket.instance)} | ${escape(bucket.round_domain?.domain ?? bucket.rounds)} | ${label(bucket.goal)} | ${label(bucket.key_model)} / ${bucket.computation} / ${bucket.attack_surface} | ${bucket.method} | ${bucket.attack_point_ids.length} / ${bucket.supporting_point_ids.length} | ${bucket.cell_ids.length} | ${bucket.candidate_ids.length} |`);
  lines.push('', '## 尚未覆盖的核验任务', '');
  for (const gap of matrix.gaps) lines.push(`- **${gap.title}**：${gap.action}`);
  lines.push('', '## 下批顺序（最多五篇，不受论文年份先后约束）', '');
  matrix.next_batch.forEach((item, index) => lines.push(`${index + 1}. ${item.title}：${item.task}`));
  lines.push('', '## 检索记录与重建', '',
    '本轮查询、已读一手页面和未核实线索保存于 JSON 的 search_log。未把一次定向搜索升级成全库广搜截止；没有宣称所有 setting 已覆盖当前 SOTA。', '',
    `科学基线：\`${matrix.baseline_hash}\`。`, '',
    `本轮人工核查基线${matrix.review_baseline_current ? '与当前数据一致' : '早于当前数据，新增候选需复核'}。`, '',
    '```sh', 'npm run report:sota',
    'npm run check:sota', '```', '');
  return lines.join('\n');
}

function candidateMarkdown(matrix, ctx) {
  const selected = new Set(matrix.lanes.flatMap(lane => lane.candidate_result_ids));
  const families = new Map(ctx.catalogs.flatMap(catalog => catalog.families.map(family => [family.id, family])));
  const sources = new Map(ctx.sources.map(source => [source.id, source]));
  const groups = new Map();
  for (const point of matrix.points.filter(point => selected.has(point.result_id))) {
    if (!groups.has(point.family_id)) groups.set(point.family_id, []);
    groups.get(point.family_id).push(ctx.byId.get(point.result_id));
  }
  const resource = value => value.status === 'not_reported' ? '未报告' : value.status === 'not_applicable' ? '不适用'
    : escape(value.reported) + (value.unit ? ' [' + escape(value.unit) + ']' : '') + (value.status === 'conflict' ? '（源冲突）' : '');
  const lines = ['# AES 已选候选：公式与完整成本向量', '',
    `快照 ${matrix.snapshot_date}，来自[核验矩阵](AES-SOTA-MATRIX.md)的 ${selected.size} 个既有证据点，按原结果族归纳。未正式提取的新候选另见矩阵正文。`, '',
    '每行是同一参数赋值的完整向量，不拼接不同配置的资源最小值。参数族公式仅对原文可行域成立；被选中表示优先核验，不表示已经通过SOTA认证。', ''];
  for (const [familyId, points] of groups) {
    const family = families.get(familyId), sample = points[0];
    lines.push('## ' + familyId, '', family?.title ?? sample.title, '',
      `${sample.target.variant_ids.join(' / ')}；${sample.target.round_domain?.domain ?? sample.target.rounds}轮；${label(sample.goal)}；${label(sample.setting.key_model)}；${sample.setting.computation} / ${sample.setting.attack_surface}；${sample.display.method}。`, '',
      '轮边界：' + sample.target.round_convention + '。', '',
      '相关核验方向：' + matrix.lanes.filter(lane => lane.family_ids.includes(familyId)).map(lane => lane.title).join('；') + '。', '');
    if (family?.model) {
      lines.push('原文参数模型：', '');
      for (const [dimension, expression] of Object.entries(family.model.resources)) lines.push(`- ${dimension}: \`${expression.expression}\` [${expression.unit}]`);
      for (const parameter of family.parameters) lines.push(`- ${parameter.name}: ${parameter.domain}；${parameter.meaning}`);
      lines.push('', '可行域：' + family.model.constraints.join('；'), '',
        '成功语义：' + family.model.success, '', '成本口径：' + family.model.accounting, '');
    }
    lines.push('| 配置 / 参数 | 时间 | 数据 | 内存 | 预处理 | 成功率与来源 |', '| --- | --- | --- | --- | --- | --- |');
    for (const point of points) {
      const assignment = family?.points.find(member => member.result_id === point.id)?.values;
      const name = assignment ? JSON.stringify(assignment) : point.display.name;
      const success = successSummary(point.success);
      const citation = unique(point.evidence.map(item => sources.get(item.source_id).citation_label)).join(', ');
      const link = ctx.records.some(record => record.id === point.id) ? `../../../data/cryptanalysis/results/${point.id}.json` : '../../../data/cryptanalysis/entries/aes.jsonl';
      lines.push(`| [${escape(name)}](${link})<br>\`${point.id}\` | ${resource(point.resources.time)} | ${resource(point.resources.data)} | ${resource(point.resources.memory)} | ${resource(point.resources.preprocessing)} | ${escape(success)}；${escape(citation)}${hasSourceConflict(point) ? '；原文争议保留' : ''} |`);
    }
    lines.push('');
    if (family) lines.push(`完整构造与证据：[原参数族](AES-RESULT-FAMILIES.md#${familyId})。`, '');
  }
  return lines.join('\n');
}

function run(write = false) {
  if (write) fs.mkdirSync(path.join(root, paths.reports), {recursive:true});
  const ctx = context(), census = read('data/cryptanalysis/aes-census.json'), review = read(reviewFile);
  const matrix = buildMatrix(ctx, census, review);
  const outputs = {[jsonFile]: JSON.stringify(matrix, null, 2) + '\n', [markdownFile]: markdown(matrix, ctx),
    [candidateFile]: candidateMarkdown(matrix, ctx)};
  for (const [file, content] of Object.entries(outputs)) {
    if (write) fs.writeFileSync(path.join(root, file), content);
    else assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), content, 'Stale SOTA projection; run report:sota');
  }
  console.log(JSON.stringify({status: write ? 'written' : 'verified', baseline_hash: ctx.snapshot, ...matrix.counts}));
  return matrix;
}
if (require.main === module) run(process.argv.includes('--write'));
module.exports = {exactScope, matches, validateReview, buildMatrix, markdown, candidateMarkdown, run};

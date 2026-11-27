'use strict';
async function main() {
const {publicationLabel: venue} = await import('../../cryptanalysis/publication.mjs');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const {resolvePaths} = require('../../../atlas.config.cjs');
const reports = resolvePaths(root).reports;
const dataLink = reference => path.relative(reports, path.join(resolvePaths(root).cryptanalysis, reference)).split(path.sep).join('/');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const manifest = read('data/cryptanalysis/manifest.json');
const allSources = read('data/cryptanalysis/sources.json');
const sourceById = new Map(allSources.map(source => [source.id, source]));
const allRecords = manifest.records.map(id => read('data/cryptanalysis/results/' + id + '.json'));
const variants = read('data/cryptanalysis/variants.json');
const ciphers = read('data/cryptanalysis/ciphers.json');
const {successSummary} = require('../../cryptanalysis/result-model.cjs');
const {loadPoints, loadCatalogs, catalogStats} = require('./result-families.cjs');
const escape = x => String(x).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const publications = record => [...new Set(record.evidence.map(evidence => evidence.source_id))].map(id => sourceById.get(id));
const citation = source => '[' + source.citation_label + ']';
const resultCitation = record => [...new Set(publications(record).map(citation))].join(' ');
function cost(resource) {
  if (resource.status === 'not_reported') return '未单独报告';
  if (resource.status === 'not_applicable') return '不适用';
  return escape(resource.reported) + (resource.unit ? ' [' + escape(resource.unit) + ']' : '') + (resource.status === 'conflict' ? ' **原文冲突**' : '');
}
const allPoints = loadPoints(root, allRecords);
for (const catalog of loadCatalogs(root)) {
const familyId = catalog.cipher_family_id;
const familyName = ciphers.find(cipher => cipher.id === familyId).name;
const variantIds = new Set(variants.filter(variant => variant.family === familyId).map(variant => variant.id));
const records = allRecords.filter(record => record.target.variant_ids.some(id => variantIds.has(id)));
const sourceIds = new Set(allPoints.filter(point => point.target.variant_ids.some(id => variantIds.has(id))).flatMap(point => point.evidence.map(e => e.source_id)));
const sources = allSources.filter(source => sourceIds.has(source.id));
const reportFile = familyId.toUpperCase() + '-PILOT.md';
const familyFile = familyId.toUpperCase() + '-RESULT-FAMILIES.md';
const lines = [
  '# ' + familyName + ' 分析结果与边界', '',
  '由 `npm run report:analyses` 从 JSON 生成。审查日期：' + manifest.reviewed_on + '。', '',
  '共 ' + records.length + ' 条详细证据点记录，' + sources.length + ' 个来源版本。时间、数据、内存保留论文口径；未报告项不视作零。覆盖缺口与来源冲突见 coverage.json；当前结果尚不构成完整文献检索或 best-known 排行榜。', '',
  '结果族与参数模型见 [' + familyFile + '](' + familyFile + ')。下表和逐条段落是保留稳定 ID 的详细证据档案，不以参数点数代表独立攻击数。依赖同一底层算法的不同构造分别统计，不合并其目标或排名。', '',
  '`key_recovery` 与 `partial_key_recovery` 分别表示完整主密钥和部分子密钥恢复；`distinguishing` 还需按已知密钥、秘密密钥及相关密钥实验区分。资源相近并不代表 setting 可比。', '',
  '## 结果总表', '',
  '| 名称 | 实例 | 轮数 | 基本方法 | 文献 | 目标与模型 | 时间 / T 门 | 数据 | 内存 / 逻辑量子位 | 核验范围 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
];
for (const r of records) lines.push('| [' + escape(resultCitation(r)) + '](' + dataLink('results/' + r.id + '.json') + ') | ' + r.target.variant_ids.join(', ') + ' | ' + escape(r.target.round_domain?.domain ?? r.target.rounds) + (r.target.full_round ? '（完整轮）' : '') + ' | ' + r.display.method + ' | ' + publications(r).map(source => '[' + escape(venue(source)) + '](' + source.publication.url + ')').join('; ') + ' | ' + [r.goal, r.setting.key_model, r.setting.computation, r.setting.attack_surface].join(' / ') + ' | ' + cost(r.resources.t_gates || r.resources.time) + ' | ' + cost(r.resources.data) + ' | ' + cost(r.resources.logical_qubits || r.resources.memory) + ' | ' + r.assessment.reproduction + ' |');
lines.push('', '## 结构界', '');
for (const r of records.filter(x => x.bound)) lines.push('- `' + r.id + '`：' + r.bound.metric + ' ' + r.bound.relation + ' ' + r.bound.value + '。' + r.bound.scope);
lines.push('', '## 结构性质', '');
for (const r of records.filter(x => x.property)) lines.push('- `' + r.id + '`：' + r.property.statement + ' ' + r.property.quantifier);
lines.push('', '## 逐条证据与适用条件', '');
for (const r of records) {
  lines.push('### ' + r.id, '', r.title, '', '- 引用标签：' + resultCitation(r), '- 简称：' + r.display.name, '- 基本方法：' + r.display.method + '; ' + r.techniques.join(', '), '- 发表：' + publications(r).map(venue).join('; '), '- 对象：' + r.target.description, '- 目标：' + r.goal, '- Setting：' + r.setting.key_model + '; ' + r.setting.oracle_access.join(', ') + '; ' + r.setting.plaintext_model, '- 密钥范围：' + r.setting.key_population, '- 密钥关系：' + r.setting.key_relation);
  if (r.setting.target_selection) lines.push('- 目标选择：' + r.setting.target_selection);
  if (r.setting.prior_key_knowledge) lines.push('- 先验子密钥材料：' + r.setting.prior_key_knowledge.bits + ' bits; ' + r.setting.prior_key_knowledge.material + '。' + r.setting.prior_key_knowledge.cost_accounting);
  for (const conflict of r.field_conflicts || []) {
    lines.push('- 字段冲突 ' + conflict.label + ' (' + conflict.field + ')：' + conflict.description);
    for (const observation of conflict.observations) lines.push('  - ' + observation.source_id + ', ' + observation.locator + '：' + observation.reported);
  }
  if (r.setting.key_budget) lines.push('- 密钥预算：' + r.setting.key_budget.reported + ' [' + r.setting.key_budget.unit + ']。' + r.setting.key_budget.note);
  else if (r.setting.related_key_count !== null) lines.push('- 相关密钥数量：' + r.setting.related_key_count);
  if (r.setting.reference_model) lines.push('- 对照实验：' + r.setting.reference_model);
  if (r.property) {
    lines.push('- 结构性质：' + r.property.statement, '- 量词：' + r.property.quantifier, '- 性质范围：' + r.property.scope);
    for (const parameter of r.property.parameters) lines.push('- 参数 ' + parameter.name + '：' + parameter.reported + '。' + parameter.meaning);
    lines.push('- 性质验证范围：' + r.property.validation.basis + '。' + r.property.validation.description);
  }
  if (r.candidate_space) {
    lines.push('- 剩余候选空间：' + r.candidate_space.material_bits + ' 位材料；' + r.candidate_space.material);
    for (const observation of r.candidate_space.observations) {
      const experimental = ['sample_mean', 'sample_maximum', 'observed_values'].includes(observation.statistic);
      lines.push('- 候选数 ' + observation.statistic + '：' + cost(observation.count) + '。' + observation.count.note + (experimental ? '；实验次数：' + (observation.sample_count ?? '未报告') : ''));
    }
  }
  if (r.experiment) {
    const e = r.experiment;
    lines.push('- 目标构造：' + e.construction.name + '；' + e.construction.definition,
      '- 目标关系：' + e.relation, '- 输出条件：' + e.output.scope + '；bits=' + (e.output.bits ?? '未报告') + '；mask=' + (e.output.mask ?? '未指定'),
      '- 不同输入/复用条件：' + (e.distinctness ?? '未报告'), '- 理想参考实验：' + (e.reference ?? '未报告'));
    for (const v of e.variables) lines.push('- 输入 ' + v.name + '：' + v.control + '；' + (v.domain ?? '域未报告') + '；' + (v.condition ?? '条件未报告'));
    for (const p of e.parameters) lines.push('- 实验参数 ' + p.name + '：' + (p.value ?? '符号参数') + '；' + (p.domain ?? '域未报告'));
    for (const missing of e.unresolved) lines.push('- 未决源定义：' + missing);
  }
  if (r.theorem) lines.push('- 理论命题：' + r.theorem.statement, '- 定理量词：' + r.theorem.quantifier,
    '- 定理界：' + r.theorem.metric + ' ' + r.theorem.relation + ' ' + r.theorem.expression,
    '- 轮数域：' + (r.target.round_domain?.domain ?? r.target.rounds), '- 定理假设：' + r.theorem.assumptions.join('; '));
  if (r.theorem && r.target.round_domain) lines.push('- 轮数模型：' + r.target.round_domain.scope + '；' + r.target.round_domain.definition);
  for (const p of r.theorem?.parameters ?? []) lines.push('- 定理参数 ' + p.name + '：' + p.meaning + '；' + (p.domain ?? '域未报告') + '；value=' + (p.value ?? '量化变量'));
  lines.push('- 计算模型 / 攻击面：' + r.setting.computation + ' / ' + r.setting.attack_surface);
  for (const model of ['quantum_model', 'fault_model']) if (r.setting[model]) {
    for (const [field, value] of Object.entries(r.setting[model])) lines.push('- ' + model + './' + field + '：' + value);
  }
  for (const [dimension, resource] of Object.entries(r.resources)) {
    if (!['time', 'data', 'memory', 'preprocessing'].includes(dimension)) lines.push('- ' + dimension + '：' + cost(resource) + '。' + resource.note);
  }
  lines.push('- 时间口径：' + r.resources.time.note, '- 数据口径：' + r.resources.data.note, '- 成功条件：' + r.success.description, '- 预处理：' + r.resources.preprocessing.note, '- 证据状态：' + r.assessment.claim_status + '; ' + r.assessment.reproduction, '');
  for (const e of r.evidence) lines.push('- `' + e.source_id + '`，' + e.locator + '：' + e.interpretation);
  lines.push('');
  for (const note of r.limitations) lines.push('- ' + note);
  lines.push('');
}
lines.push('## 实际审查来源', '');
for (const s of sources) lines.push('- **' + citation(s) + ' ' + s.title + '** — [' + venue(s) + '](' + s.publication.url + '), ' + s.publication.kind + '。' + s.inspected_version + '. [审查版本](' + s.url + ')。SHA-256: `' + (s.content_sha256 || '未取得本地字节哈希；见 sources.json') + '`。');
lines.push('', '## 待审与版本问题', '', '详见 [coverage.json](' + dataLink('coverage.json') + ')。已审来源、待审线索、成本口径问题和来源内部冲突分别记录；新文献在核对原文后单独收录。', '');
fs.mkdirSync(reports, {recursive: true});
fs.writeFileSync(path.join(reports, reportFile), lines.join('\n'));
console.log('Generated ' + path.relative(root, path.join(reports, reportFile)) + ' (' + records.length + ' results).');

  const pointById = new Map(allPoints.map(point => [point.id, point]));
  const detailedIds = new Set(records.map(record => record.id));
  const stats = catalogStats(catalog);
  const pointLink = id => '[' + id + '](' + dataLink(detailedIds.has(id) ? 'results/' + id + '.json' : 'entries/' + familyId + '.jsonl') + ')';
  const familyLines = ['# ' + familyName + ' 参数化结果族', '',
    '归纳日期：' + catalog.reviewed_on + '。由族目录和原始证据点生成；本次归组不新增攻击或重认证 SOTA。', '',
    `现有 ${stats.total_points} 个去重证据点：主动范围 ${stats.active_points} 点，归纳为 ${stats.result_families} 个结果族。其中 ${stats.parameterized_families} 个参数化族（${stats.formula_families} 个公式、${stats.table_families} 个参数表）覆盖 ${stats.grouped_points} 点；其余 ${stats.standalone_points} 点独立保留。${stats.excluded_points} 个历史量子 implementation 点保留原始记录，但不进入主动归纳。`, '',
    '公式保存原文数学表达与适用域，不执行文本表达式、不从采样点推断全域支配。每个参数点保留自己的成本、成功语义、冲突和原始引用；详录/紧凑格式不是 SOTA 分类。', '',
    '## 参数化族索引', '',
    '| 结果族 | 实例 | 轮数 | 方法 | 表达 | 已收录配置数 |', '| --- | --- | ---: | --- | --- | ---: |'];
  for (const family of catalog.families) {
    const point = pointById.get(family.points[0].result_id);
    familyLines.push(`| [${escape(family.title)}](#${family.id}) | ${point.target.variant_ids.join(', ')} | ${point.target.rounds} | ${point.display.method} | ${family.representation} | ${family.points.length} |`);
  }
  for (const family of catalog.families) {
    familyLines.push('', '<a id="' + family.id + '"></a>', '', '## ' + family.title, '', family.construction, '');
    for (const parameter of family.parameters) familyLines.push('- `' + parameter.name + '`：' + parameter.meaning + '；' + parameter.domain);
    if (family.model) {
      familyLines.push('', '原文模型：', '');
      for (const [dimension, expression] of Object.entries(family.model.resources)) familyLines.push('- ' + dimension + '：`' + expression.expression + '` [' + expression.unit + ']');
      familyLines.push('- 成功语义：' + family.model.success, '- 计量：' + family.model.accounting);
      for (const condition of family.model.constraints) familyLines.push('- 适用域/约束：' + condition);
    }
    familyLines.push('', '| 参数配置 | 证据点 | 时间 | 数据 | 内存 | 成功/性质 |', '| --- | --- | --- | --- | --- | --- |');
    for (const item of family.points) {
      const point = pointById.get(item.result_id);
      familyLines.push('| ' + escape(Object.entries(item.values).map(([key, value]) => key + '=' + value).join('; ')) + ' | ' + pointLink(point.id) + ' | ' +
        cost(point.resources.time) + ' | ' + cost(point.resources.data) + ' | ' + cost(point.resources.memory) + ' | ' +
        escape(successSummary(point.success)) + ' |');
    }
    familyLines.push('');
    for (const evidence of family.evidence) familyLines.push('- 来源：[' + citation(sourceById.get(evidence.source_id)) + '](' + sourceById.get(evidence.source_id).url + ')；' + evidence.locator);
  }
  familyLines.push('', '## 独立保留的固定结果', '', '这些点未因方法或数值相近而强行归并；原参数性质和中间阶段也保留独立目标。', '');
  for (const id of catalog.standalone_result_ids) familyLines.push('- ' + pointLink(id));
  familyLines.push('', '## 不进入主动归纳的历史记录', '');
  for (const exclusion of catalog.excluded_results) familyLines.push('- ' + pointLink(exclusion.result_id) + '：' + exclusion.reason);
  fs.writeFileSync(path.join(reports, familyFile), familyLines.join('\n') + '\n');
  console.log('Generated ' + path.relative(root, path.join(reports, familyFile)) + ' (' + stats.result_families + ' families; ' + stats.active_points + ' active points).');
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });

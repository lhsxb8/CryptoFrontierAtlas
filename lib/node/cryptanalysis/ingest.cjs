#!/usr/bin/env node
'use strict';

// Local evidence packets and a reversible, dataset-relative SOTA screening gate.
// Scientific comparison remains owned by the Atlas comparator, not by this skill.
const fs = require('node:fs');
const path = require('node:path');
const {hash, fingerprint, context} = require('./context.cjs');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const atlasRoot = root;
const {compareReportedCosts} = require('../../cryptanalysis/compare.cjs');
const {catalogStats, payloadFields} = require('./result-families.cjs');
const {semanticErrors, targetErrors, hasSourceConflict: isConflict} = require('../../cryptanalysis/result-model.cjs');
const POLICY = 'abstract-instance-method-pareto-v3';
const PARSER = 'pdftotext-layout-v1';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const RULES_HASH = fingerprint({policy: POLICY, parser: PARSER,
  helper: hash(fs.readFileSync(__filename)),
  context: hash(fs.readFileSync(require.resolve('./context.cjs'))),
  pointLoader: hash(fs.readFileSync(require.resolve('./result-families.cjs'))),
  familyModel: hash(fs.readFileSync(require.resolve('../../cryptanalysis/result-families.cjs'))),
  comparator: hash(fs.readFileSync(require.resolve('../../cryptanalysis/compare.cjs'))),
  semantics: hash(fs.readFileSync(require.resolve('../../cryptanalysis/result-model.cjs'))),
  taxonomy: hash(fs.readFileSync(path.join(atlasRoot, 'schemas/cryptanalysis/result-taxonomy.json')))});
const normalize = x => String(x).normalize('NFKC').replace(/\s+/g, ' ').trim();
function ensure(condition, message) { if (!condition) throw new Error(message); }
function save(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = file + '.tmp-' + process.pid;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
  fs.renameSync(temporary, file);
}
function writableOutput(file) {
  const resolved = path.resolve(file);
  // Skill runs never write scientific records, the question corpus, or frontend code.
  const allowed = [path.join(root, '.agents/skills/ingest-cryptanalysis-results/work'),
    path.join(root, '.cache/cryptanalysis-ingest'), require('node:os').tmpdir()];
  ensure(allowed.some(dir => resolved.startsWith(path.resolve(dir) + path.sep)),
    'Output must be inside skill/work, .cache/cryptanalysis-ingest, or the system temporary directory');
  let ancestor = resolved;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  ensure(fs.realpathSync(ancestor) === ancestor, 'Output path must not traverse a symlink');
  return resolved;
}
function abstractOf(pages, bounds = {}) {
  if (bounds.spans) {
    ensure(Array.isArray(bounds.spans) && bounds.spans.length > 0 && bounds.spans.length <= 8, 'Invalid abstract spans');
    const parts = bounds.spans.map(span => abstractOf(pages, span));
    const text = parts.map(p => p.text).join('\n');
    return {spans: parts.flatMap(p => p.spans), text, sha256: hash(text)};
  }
  const page = bounds.page || 1;
  ensure(Number.isInteger(page) && page > 0 && page <= pages.length, 'Invalid abstract page');
  const text = pages[page - 1];
  let start, end;
  if (bounds.start) {
    start = text.indexOf(bounds.start);
    ensure(start >= 0, 'Abstract start marker was not found; inspect the PDF page');
  } else {
    const match = /\bAbstract\s*[.:]\s*/i.exec(text);
    ensure(match, 'No abstract heading; provide explicit --start and --end markers');
    start = match.index + match[0].length;
  }
  if (bounds.end) {
    end = text.indexOf(bounds.end, start);
    ensure(end > start, 'Abstract end marker was not found');
  } else {
    const match = /\n\s*(?:Key\s*words\s*[:.]|Keywords\s*[:.]|1\.?\s+Introduction\b|1\s*$)/im.exec(text.slice(start));
    ensure(match, 'No reliable abstract end; provide an explicit --end marker');
    end = start + match.index;
  }
  const value = text.slice(start, end).trim();
  ensure(value.length >= 15 && value.length <= 12000, 'Implausible abstract span; inspect page boundaries');
  return {spans: [{page, start, end}], text: value, sha256: hash(value)};
}
function makePacket({pdf, sourceId, cache, bounds = {}, expectedSha256}, ctx) {
  ensure(sourceId && /^[a-z0-9][a-z0-9-]*$/.test(sourceId), 'A stable source ID is required');
  const bytes = fs.readFileSync(pdf);
  ensure(bytes.subarray(0, 5).toString() === '%PDF-', 'Input is not a PDF');
  const sourceSha256 = hash(bytes);
  const source = ctx.sources.find(s => s.id === sourceId);
  const expected = expectedSha256 || source?.content_sha256;
  ensure(expected && /^[a-f0-9]{64}$/.test(expected), 'Register or explicitly supply the PDF SHA-256');
  ensure(expected === sourceSha256, 'PDF hash differs from the inspected source version');
  if (source?.content_sha256) ensure(source.content_sha256 === sourceSha256, 'Source registry hash mismatch');
  const version = spawnSync('pdftotext', ['-v'], {encoding: 'utf8', timeout: 10000});
  ensure(!version.error && version.status === 0, 'pdftotext is required');
  const extractor = (version.stderr || version.stdout).split('\n')[0];
  const cacheKey = fingerprint({sourceSha256, extractor, parser: PARSER});
  const textFile = writableOutput(path.join(cache, cacheKey + '.text.json'));
  let text, reused = false;
  if (fs.existsSync(textFile)) {
    text = read(textFile);
    ensure(text.source_sha256 === sourceSha256 && text.extractor === extractor && text.parser === PARSER &&
      text.pages_sha256 === fingerprint(text.pages), 'Text cache was changed or corrupted');
    reused = true;
  } else {
    const result = spawnSync('pdftotext', ['-layout', '-enc', 'UTF-8', path.resolve(pdf), '-'],
      {encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024});
    ensure(!result.error && result.status === 0, 'PDF extraction failed: ' + (result.stderr || result.error));
    const pages = result.stdout.split('\f');
    if (!pages.at(-1).trim()) pages.pop();
    ensure(pages.length && pages.join('').trim().length > 100, 'PDF needs OCR; do not use an empty packet');
    text = {source_sha256: sourceSha256, extractor, parser: PARSER, pages, pages_sha256: fingerprint(pages)};
    save(textFile, text);
  }
  const abstract = abstractOf(text.pages, bounds);
  const packet = {schema_version: 1, source_id: sourceId, source_sha256: sourceSha256,
    parser: PARSER, extractor, page_count: text.pages.length, full_text_characters: text.pages.join('').length,
    text_file: path.basename(textFile), abstract};
  packet.packet_hash = fingerprint(packet);
  const packetFile = writableOutput(path.join(cache, packet.packet_hash + '.packet.json'));
  if (fs.existsSync(packetFile)) ensure(fingerprint(read(packetFile)) === fingerprint(packet), 'Packet cache mismatch');
  else save(packetFile, packet);
  return {packet_file: packetFile, reused_text: reused, ...packet};
}
function loadPacket(file) {
  const packet = read(file);
  const {packet_hash: expected, ...payload} = packet;
  ensure(expected === fingerprint(payload), 'Packet fingerprint mismatch');
  ensure(packet.abstract.sha256 === hash(packet.abstract.text), 'Abstract fingerprint mismatch');
  ensure(path.basename(packet.text_file) === packet.text_file, 'Invalid text-cache reference');
  const text = read(path.join(path.dirname(file), packet.text_file));
  ensure(text.source_sha256 === packet.source_sha256 && text.pages_sha256 === fingerprint(text.pages), 'Text cache fingerprint mismatch');
  const a = packet.abstract;
  ensure(a.spans.map(s => text.pages[s.page - 1]?.slice(s.start, s.end).trim()).join('\n') === a.text, 'Abstract does not match its source span');
  return {packet, text};
}
function scopedRecords(ctx, scope) {
  ensure(scope && scope.policy === 'pareto' && /^\d{4}-\d{2}-\d{2}$/.test(scope.cutoff_date), 'Declare policy=pareto and a cutoff_date');
  ensure(scope.cutoff_date >= ctx.manifest.reviewed_on, 'A retrospective cutoff needs a historical dataset snapshot');
  const variants = ctx.variants.filter(v => v.family === scope.family_id).map(v => v.id);
  ensure(variants.length > 0, 'Unknown cipher family');
  const excluded = new Set((ctx.catalogs || []).flatMap(catalog => catalog.excluded_results.map(result => result.result_id)));
  return (ctx.comparisonRecords || ctx.records).filter(r => !excluded.has(r.id) && r.target.variant_ids.some(id => variants.includes(id)));
}
function methodPeers(records, record) {
  return records.filter(other => other.display.method === record.display.method);
}
function mergePoints(records, additions) {
  const byId = new Map(records.map(record => [record.id, record]));
  for (const record of additions) {
    const existing = byId.get(record.id);
    ensure(!existing || fingerprint(existing) === fingerprint(record), 'Conflicting comparison payloads for result ID: ' + record.id);
    byId.set(record.id, record);
  }
  return [...byId.values()];
}
function withCandidates(ctx, paper, result) {
  const retainedIds = new Set(result.claims.map(claim => claim.entry.id));
  const additions = (paper.claims || []).filter(claim => claim.candidate && retainedIds.has(claim.candidate.id)).map(claim => claim.candidate);
  const comparisonRecords = mergePoints(ctx.comparisonRecords || ctx.records, additions);
  return {...ctx, comparisonRecords, byId: new Map(comparisonRecords.map(record => [record.id, record]))};
}
function projectInstance(record, variantId) {
  return {...record, target: {...record.target, variant_ids: [variantId]}};
}
function candidateComparison(candidate, pool, newCandidateIds = new Set()) {
  const peers = methodPeers(pool, candidate).filter(record => record.id !== candidate.id);
  const instances = candidate.target.variant_ids.map(variantId => {
    const projected = projectInstance(candidate, variantId);
    const checked = peers.map(record => ({record, result: record.target.variant_ids.includes(variantId)
      ? compareReportedCosts(projectInstance(record, variantId), projected)
      : {relation: 'incomparable', reasons: ['different target.variant_ids']}}));
    const dominated = checked.filter(x => x.result.relation === 'a_dominates_reported_costs');
    // Equal new points in this paper need an acyclic representative; they cannot
    // certify one another away before any representative receives further review.
    const equal = checked.filter(x => x.result.relation === 'equal' &&
      (!newCandidateIds.has(x.record.id) || x.record.id < candidate.id));
    if (dominated.length || equal.length) return {variant_id: variantId, relation: dominated.length ? 'dominated' : 'equal',
      record_ids: (dominated.length ? dominated : equal).map(x => x.record.id), reasons: []};
    const comparable = checked.filter(x => x.result.relation !== 'incomparable');
    if (comparable.length) return {variant_id: variantId, relation: 'frontier_candidate',
      record_ids: comparable.map(x => x.record.id), reasons: []};
    return {variant_id: variantId, relation: 'incomparable', record_ids: [],
      reasons: ['No comparable same-method baseline; review method coverage and comparison evidence.',
        ...new Set(checked.flatMap(x => x.result.reasons))].slice(0, 16)};
  });
  const covered = instances.every(instance => ['dominated', 'equal'].includes(instance.relation));
  const relation = covered ? (instances.some(instance => instance.relation === 'dominated') ? 'dominated' : 'equal')
    : instances.some(instance => instance.relation === 'frontier_candidate') ? 'frontier_candidate' : 'incomparable';
  return {relation, record_ids: [...new Set(instances.flatMap(instance => instance.record_ids))],
    ...(covered ? {candidate_hash: fingerprint(candidate)} : {}),
    ...(instances.some(instance => instance.reasons.length) ? {reasons: [...new Set(instances.flatMap(instance => instance.reasons))].slice(0, 16)} : {}),
    ...(instances.length > 1 ? {instances} : {})};
}
function compactEntry(claim, paper, packet, outcome, ctx, decision) {
  const record = claim.candidate || ctx.byId.get(claim.record_id);
  const detailId = claim.record_id && ctx.records.some(detail => detail.id === claim.record_id) ? claim.record_id : null;
  const originalEntry = claim.record_id && (ctx.entries || []).find(entry => entry.id === claim.record_id);
  // Loader defaults are comparison machinery, not newly reviewed scientific fields.
  const assessment = originalEntry ? originalEntry.assessment : record.assessment;
  const fields = payloadFields.filter(field => !['evidence', 'assessment'].includes(field));
  const payload = detailId ? {} : {
    ...Object.fromEntries(fields.filter(key => key in record).map(key => [key, record[key]])),
    ...(assessment ? {assessment} : {}),
    evidence: record.evidence.map(({source_id, locator, fields}) => ({source_id, locator, fields})),
  };
  return {id: record.id, source_id: paper.source_id, source_sha256: packet.source_sha256,
    method: record.display.method, record_id: detailId, ...payload,
    review: {scope: 'abstract_only', decision},
    comparison: {relation: outcome.relation, record_ids: outcome.record_ids,
      reasons: outcome.reasons || [], baseline_hash: ctx.snapshot,
      ...(outcome.instances ? {instances: outcome.instances} : {})}};
}
function claimedEvidence(claim, packet) {
  ensure(typeof claim.quote === 'string' && normalize(claim.quote).length >= 15, 'Every claim needs a source quote');
  ensure(normalize(packet.abstract.text).includes(normalize(claim.quote)), 'Claim quote is not in the inspected abstract');
}
function screening(paper, packet, ctx, scope) {
  ensure(paper.source_id === packet.source_id, 'Paper/packet source identity mismatch');
  ensure(typeof paper.reviewer === 'string' && paper.reviewer.length > 1, 'Record the extraction reviewer');
  ensure(typeof paper.rationale === 'string' && paper.rationale.length >= 15, 'Explain the screening decision');
  const registeredSource = ctx.sources.find(s => s.id === paper.source_id);
  if (registeredSource?.content_sha256) ensure(registeredSource.content_sha256 === packet.source_sha256, 'Packet is not the registered version');
  const pool = scopedRecords(ctx, scope);
  const claims = paper.claims || [];
  ensure(Array.isArray(claims) && new Set(claims.map(c => c.id)).size === claims.length && claims.every(c => c.id), 'Invalid claim identities');
  claims.forEach(claim => claimedEvidence(claim, packet));
  const signals = paper.signals || [];
  ensure(Array.isArray(signals), 'signals must be an array');
  for (const signal of signals) {
    ensure(['correction', 'new_setting', 'tradeoff', 'unmapped_result'].includes(signal.kind), 'Unknown screening signal');
    claimedEvidence(signal, packet);
  }
  const correction = /\b(?:errat\w*|counterexample\w*|correct(?:s|ed|ing)?\s+(?:an?\s+)?error|error\s+in|flaw\s+in)\b/i.test(normalize(packet.abstract.text));
  if (paper.scope_decision === 'out_of_scope') {
    ensure(paper.exclusion_quote && normalize(packet.abstract.text).includes(normalize(paper.exclusion_quote)) && normalize(paper.exclusion_quote).length >= 15,
      'An exclusion needs a quoted scope reason');
    return {decision: 'skip_out_of_scope', rationale: paper.rationale, claims: []};
  }
  ensure(['in_scope', 'uncertain'].includes(paper.scope_decision), 'Use an explicit scope_decision');
  // Validate every current-paper claim before any one of them may support another.
  const claimRecords = claims.map(claim => {
    ensure(Boolean(claim.record_id) !== Boolean(claim.candidate), 'Use exactly one of record_id or candidate');
    if (claim.record_id) {
      const record = ctx.byId.get(claim.record_id);
      ensure(record && pool.some(r => r.id === record.id), 'Unknown or out-of-scope represented record');
      // Identity reuse is not a claim of dominance or paper-level full-text completeness.
      ensure(registeredSource && registeredSource.content_sha256 === packet.source_sha256 &&
        record.evidence.some(e => e.source_id === paper.source_id), 'Already-indexed claims need the exact primary source version');
      return record;
    }
    const candidate = claim.candidate;
    ensure(ctx.validateRecord(candidate), 'Candidate fails the existing result schema: ' + JSON.stringify(ctx.validateRecord.errors));
    ensure(semanticErrors(candidate).length === 0, 'Candidate fails result semantics: ' + semanticErrors(candidate).join('; '));
    ensure(!ctx.byId.has(candidate.id) || pool.some(record => record.id === candidate.id), 'Candidate is an excluded or out-of-scope indexed point');
    ensure(candidate.evidence.some(e => e.source_id === paper.source_id), 'Candidate evidence must cite this paper');
    ensure(candidate.target.variant_ids.every(id => ctx.variants.some(v => v.id === id && v.family === scope.family_id && targetErrors(candidate, v).length === 0)),
      'Candidate target is not a valid instance of the selected family');
    return candidate;
  });
  const poolIds = new Set(pool.map(record => record.id));
  const newCandidateIds = new Set(claimRecords.filter((record, i) => claims[i].candidate && !poolIds.has(record.id)).map(record => record.id));
  const comparisonPool = mergePoints(pool, claims.flatMap((claim, i) => claim.candidate ? [claimRecords[i]] : []));
  const outcomes = claims.map((claim, i) => {
    const record = claimRecords[i];
    if (claim.record_id) return {claim_id: claim.id, relation: isConflict(record) ? 'conflict' : 'already_indexed', record_ids: [record.id]};
    if (isConflict(record)) return {claim_id: claim.id, relation: 'conflict', record_ids: []};
    return {claim_id: claim.id, ...candidateComparison(record, comparisonPool, newCandidateIds)};
  });
  const finish = (decision, rationale) => ({decision, rationale, claims: outcomes.map((outcome, i) =>
    ({...outcome, entry: compactEntry(claims[i], paper, packet, outcome, ctx, decision)}))});
  if (correction || signals.some(s => s.kind === 'correction')) return finish('audit_required', 'Abstract flags a correction; retain entries and review the affected frontier.');
  if (paper.scope_decision === 'uncertain' || paper.claims_complete !== true || !claims.length) {
    return finish('needs_details', 'Retain identified entries and complete the abstract inventory or scope.');
  }
  if (outcomes.some(x => x.relation === 'conflict')) return finish('audit_required', 'Source conflict affects an advertised result.');
  if (signals.length) return finish('needs_details', 'A model, tradeoff or other result needs explicit coverage before skipping.');
  if (outcomes.every(x => x.relation === 'already_indexed')) return finish('skip_indexed_abstract', 'All inventoried abstract claims are already represented by this exact version.');
  if (outcomes.every(x => ['dominated', 'equal', 'already_indexed'].includes(x.relation))) return finish('skip_dominated_abstract', 'Retain entries; all new claims are dominated or matched within their setting and method.');
  if (outcomes.some(x => x.relation === 'frontier_candidate')) return finish('keep_candidate', 'A result improves a comparable same-method vector or adds a tradeoff.');
  return finish('needs_details', 'Retain entries for same-method frontier review and missing comparison evidence.');
}
function decisionEntry(paper, packet, result) {
  return {paper_id: paper.id, source_id: paper.source_id, packet_hash: packet.packet_hash,
    review_scope: 'abstract_only', abstract_characters: packet.abstract.text.length, full_text_characters: packet.full_text_characters,
    reviewer: paper.reviewer, ...result};
}
function runBatch({batchFile, checkpoint, limit = 5, maxCharacters = 40000, resume = false}, ctx) {
  ensure(Number.isSafeInteger(limit) && limit >= 0 && Number.isSafeInteger(maxCharacters) && maxCharacters >= 0, 'Invalid batch budget');
  checkpoint = writableOutput(checkpoint);
  const batch = read(batchFile);
  ensure(batch.schema_version === 1 && batch.id && Array.isArray(batch.papers), 'Invalid batch');
  scopedRecords(ctx, batch.scope);
  ensure(new Set(batch.papers.map(p => p.id)).size === batch.papers.length && batch.papers.every(p => p.id), 'Duplicate or missing paper IDs');
  const loaded = batch.papers.map(p => ({paper: p, ...loadPacket(path.resolve(path.dirname(batchFile), p.packet_file))}));
  const inputHash = fingerprint({batch, packets: loaded.map(x => x.packet.packet_hash)});
  let state = {schema_version: 1, batch_id: batch.id, policy: POLICY, rules_hash: RULES_HASH, scope: batch.scope, input_hash: inputHash,
    baseline_hash: ctx.snapshot, token_usage: null, token_usage_note: 'No model billing meter is provided; characters are not tokens.',
    decisions: [], status: 'in_progress'};
  let comparisonContext = ctx;
  if (fs.existsSync(checkpoint)) {
    ensure(resume, 'Checkpoint exists; use --resume or a new output path');
    const old = read(checkpoint);
    ensure(old.schema_version === state.schema_version && fingerprint(old.scope) === fingerprint(batch.scope)
      && old.input_hash === inputHash && old.baseline_hash === ctx.snapshot && old.policy === POLICY && old.rules_hash === RULES_HASH && old.batch_id === batch.id,
      'Inputs, rules, policy or baseline changed; start a fresh checkpoint and reconsider old skips');
    ensure(Array.isArray(old.decisions) && new Set(old.decisions.map(d => d.paper_id)).size === old.decisions.length,
      'Checkpoint has duplicate or invalid decisions');
    for (const [index, decision] of old.decisions.entries()) {
      const entry = loaded[index];
      ensure(entry && entry.paper.id === decision.paper_id && decision.source_id === entry.paper.source_id
        && decision.reviewer === entry.paper.reviewer && decision.packet_hash === entry.packet.packet_hash && decision.review_scope === 'abstract_only',
        'Checkpoint paper or source identity mismatch');
      const replay = screening(entry.paper, entry.packet, comparisonContext, batch.scope);
      ensure(fingerprint(decision) === fingerprint(decisionEntry(entry.paper, entry.packet, replay)),
        'Checkpoint decision was changed; start a fresh checkpoint');
      comparisonContext = withCandidates(comparisonContext, entry.paper, replay);
    }
    state = old;
  }
  let processed = 0, characters = 0;
  const done = new Set(state.decisions.map(d => d.paper_id));
  for (const {paper, packet} of loaded) {
    if (done.has(paper.id)) continue;
    if (processed >= limit || characters + packet.abstract.text.length > maxCharacters) break;
    const result = screening(paper, packet, comparisonContext, batch.scope);
    const nextContext = withCandidates(comparisonContext, paper, result);
    state.decisions.push(decisionEntry(paper, packet, result));
    processed++; characters += packet.abstract.text.length;
    save(checkpoint, state); // An interrupted batch can resume after each completed paper.
    comparisonContext = nextContext;
  }
  state.remaining_ids = batch.papers.filter(p => !state.decisions.some(d => d.paper_id === p.id)).map(p => p.id);
  state.status = state.remaining_ids.length ? 'budget_paused' : 'screening_complete';
  state.counts = {};
  for (const d of state.decisions) state.counts[d.decision] = (state.counts[d.decision] || 0) + 1;
  state.last_run = {processed, abstract_characters: characters, paper_limit: limit, character_limit: maxCharacters};
  save(checkpoint, state);
  return state;
}
function frontier(ctx, scope) {
  const pool = scopedRecords(ctx, scope);
  const instances = ctx.variants.filter(variant => variant.family === scope.family_id && pool.some(r => r.target.variant_ids.includes(variant.id)))
    .map(variant => {
      const projected = pool.filter(r => r.target.variant_ids.includes(variant.id)).map(r => projectInstance(r, variant.id));
      const eligible = projected.filter(r => compareReportedCosts(r, r).relation === 'equal');
      const dominated = eligible.filter(r => methodPeers(eligible, r)
        .some(s => r.id !== s.id && compareReportedCosts(s, r).relation === 'a_dominates_reported_costs'));
      const ids = new Set(dominated.map(r => r.id));
      return {variant_id: variant.id, frontier_ids: eligible.filter(r => !ids.has(r.id)).map(r => r.id),
        dominated_ids: [...ids], unresolved_ids: projected.filter(r => !eligible.includes(r)).map(r => r.id)};
    });
  const frontierIds = new Set(instances.flatMap(instance => instance.frontier_ids));
  const unresolvedIds = new Set(instances.flatMap(instance => instance.unresolved_ids));
  const dominatedIds = new Set(pool.filter(record => instances.filter(instance => record.target.variant_ids.includes(instance.variant_id))
    .every(instance => instance.dominated_ids.includes(record.id))).map(record => record.id));
  const catalogs = (ctx.catalogs || []).filter(catalog => catalog.cipher_family_id === scope.family_id);
  const familyCounts = catalogs.map(catalogStats).reduce((total, counts) => {
    for (const [key, count] of Object.entries(counts)) total[key] = (total[key] || 0) + count;
    return total;
  }, {});
  const detailedIds = new Set(ctx.records.map(record => record.id));
  return {scope, grouping: 'setting_and_method', baseline_hash: ctx.snapshot, status: 'dataset_relative_not_global_sota',
    frontier_ids: pool.filter(record => frontierIds.has(record.id)).map(record => record.id), dominated_ids: [...dominatedIds],
    unresolved_ids: pool.filter(record => unresolvedIds.has(record.id)).map(record => record.id), instances,
    excluded_ids: catalogs.flatMap(catalog => catalog.excluded_results.map(result => result.result_id)),
    counts: {...familyCounts, configurations: pool.length, detailed_configurations: pool.filter(record => detailedIds.has(record.id)).length,
      compact_only_configurations: pool.filter(record => !detailedIds.has(record.id)).length,
      assessed_instance_points: instances.reduce((total, instance) => total + instance.frontier_ids.length + instance.dominated_ids.length, 0)}};
}
function argumentsOf(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    ensure(args[i].startsWith('--'), 'Expected a --named argument');
    const key = args[i].slice(2);
    ensure(!(key in opts), 'Duplicate argument: ' + key);
    opts[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
  }
  return opts;
}
function main() {
  ensure(Number(process.versions.node.split('.')[0]) >= 20, 'Use Node.js >=20, matching the parent project');
  const [command, ...args] = process.argv.slice(2), o = argumentsOf(args);
  const ctx = context();
  if (command === 'packet') {
    const result = makePacket({pdf: o.pdf, sourceId: o['source-id'], cache: o.cache,
      expectedSha256: o.sha256, bounds: o.spans ? {spans: read(o.spans)} : {page: Number(o.page || 1), start: o.start, end: o.end}}, ctx);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'read') {
    const {packet, text} = loadPacket(o.packet);
    if (!o.pages) console.log(packet.abstract.text);
    else for (const page of o.pages.split(',').map(Number)) {
      ensure(Number.isInteger(page) && page > 0 && page <= text.pages.length, 'Invalid page');
      console.log('PDF page ' + page + '\n' + text.pages[page - 1]);
    }
  } else if (command === 'screen') {
    console.log(JSON.stringify(runBatch({batchFile: path.resolve(o.batch), checkpoint: o.checkpoint,
      limit: Number(o.limit || 5), maxCharacters: Number(o['max-characters'] || 40000), resume: o.resume === true}, ctx), null, 2));
  } else if (command === 'frontier') {
    console.log(JSON.stringify(frontier(ctx, {family_id: o.family, cutoff_date: o.cutoff, policy: 'pareto'}), null, 2));
  } else throw new Error('Commands: packet, read, screen, frontier. See references/extraction-contract.md.');
}
module.exports = {POLICY, PARSER, RULES_HASH, context, fingerprint, normalize, save, writableOutput, abstractOf, makePacket, loadPacket, screening, runBatch, frontier, main};
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }

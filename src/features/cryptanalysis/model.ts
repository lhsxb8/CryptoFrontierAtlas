import type { AnalysisFamilyCatalog, AnalysisResult, AnalysisResultFamily, AnalysisSource, CipherFamily, CipherVariant } from './types';
import { resultTaxonomy } from './taxonomy';
import { quantumModelTags } from './quantum-model';
export { publicationLabel } from '../../../lib/cryptanalysis/publication.mjs';
import { publicationLabel } from '../../../lib/cryptanalysis/publication.mjs';

export const RESULT_PAGE_SIZE = 24;
export const MAX_COMPARISON_RECORDS = 4;
export const resultFilterKeys = ['q', 'rounds', 'scope', 'goal', 'key_model', 'computation', 'attack_surface', 'method', 'technique', 'oracle', 'assessment'] as const;

export const computationLabels = { classical: 'Classical', quantum: 'Quantum' };
export const surfaceLabels = resultTaxonomy.attack_surfaces;
export type AttackSurface = AnalysisResult['setting']['attack_surface'];
export const attackSurfaces: readonly AttackSurface[] = ['algorithmic', 'side_channel', 'fault_injection'];

/** One result page spans all surfaces; old tab URLs must not leave a hidden filter. */
export function resultPageParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('attack_surface');
  return next;
}
export const resourceLabels = { time: 'Time', data: 'Data', memory: 'Memory', preprocessing: 'Preprocessing', t_gates: 'T gates', clifford_gates: 'Clifford gates', t_depth: 'T depth', circuit_depth: 'Circuit depth', logical_qubits: 'Logical qubits' };
export function resourceEntries(record: AnalysisResult) {
  return Object.entries(record.resources).map(([key, resource]) => ({ key, label: resourceLabels[key as keyof typeof resourceLabels] || humanize(key), resource }));
}

/** Algorithmic quantum costs keep their native units; circuit columns require actual circuit estimates. */
export function primaryCostDimensions(records: readonly AnalysisResult[]) {
  const circuitOnly = (circuit: 't_gates' | 'logical_qubits', native: 'time' | 'memory') => records.length > 0 && records.every(record =>
    record.setting.computation === 'quantum'
    && ['reported', 'qualitative', 'conflict'].includes(record.resources[circuit]?.status ?? '')
    && !['reported', 'qualitative', 'conflict'].includes(record.resources[native].status));
  return [circuitOnly('t_gates', 'time') ? 't_gates' : 'time', circuitOnly('logical_qubits', 'memory') ? 'logical_qubits' : 'memory'] as const;
}

export const goalLabels = Object.fromEntries(Object.entries(resultTaxonomy.goals).map(([id, goal]) => [id, goal.label])) as Record<AnalysisResult['goal'], string>;
export const kindLabels = Object.fromEntries(Object.entries(resultTaxonomy.kinds).map(([id, kind]) => [id, kind.label])) as Record<AnalysisResult['result_kind'], string>;
export const keyModelLabels = resultTaxonomy.key_models;
export const methodLabels = resultTaxonomy.methods;

/** Qualify display labels without changing the scientific method taxonomy. */
export function methodLabel(method: AnalysisResult['display']['method'], surface?: string): string {
  if (surface === 'side_channel') {
    if (method === 'differential') return 'Side-channel-assisted differential';
    if (method === 'collision') return 'Collision-based side-channel analysis';
  }
  return methodLabels[method];
}

export function roundLabel(record: Pick<AnalysisResult, 'target'>): string {
  return record.target.round_domain?.domain ?? String(record.target.rounds);
}
export function roundScopeLabel(record: Pick<AnalysisResult, 'target'>): string {
  return record.target.round_domain ? 'Variable' : record.target.full_round ? 'Full' : 'Reduced';
}

/** Curated ToSC alpha labels preserve surnames, corporate keys and disambiguation. */
export function citationLabel(source: Pick<AnalysisSource, 'citation_label'>): string {
  return `[${source.citation_label}]`;
}

/** A paper may support several evidence locators but appears once in a list row. */
export function sourcesForResult(record: Pick<AnalysisResult, 'evidence'>, sources: readonly AnalysisSource[]): AnalysisSource[] {
  const byId = new Map(sources.map(source => [source.id, source]));
  return [...new Set(record.evidence.map(evidence => evidence.source_id))]
    .flatMap(id => { const source = byId.get(id); return source ? [source] : []; });
}

/** Publication identity is distinct from the number of inspected PDF versions. */
export function publicationsForResult(record: Pick<AnalysisResult, 'evidence'>, sources: readonly AnalysisSource[]) {
  const groups = new Map<string, { source: AnalysisSource; versionCount: number }>();
  for (const source of sourcesForResult(record, sources)) {
    const group = groups.get(source.publication.url) ?? { source, versionCount: 0 };
    group.versionCount++;
    groups.set(source.publication.url, group);
  }
  return [...groups.values()];
}

/** Repeated locators or inspected versions of one cited work do not repeat its label. */
export function resultCitationLabel(record: Pick<AnalysisResult, 'evidence'>, sources: readonly AnalysisSource[]): string {
  return [...new Set(sourcesForResult(record, sources).map(citationLabel))].join(' ');
}

// Display labels only: source-native identifiers and comparison semantics do not change.
const termLabels: Record<string, string> = {
  ...goalLabels, ...kindLabels, ...keyModelLabels,
  key_recovery_attack: 'Key-recovery attack',
  chosen_plaintext_encryption: 'Chosen-plaintext encryption',
  chosen_ciphertext_decryption: 'Chosen-ciphertext decryption',
  adaptive_chosen_plaintext_encryption: 'Adaptive chosen-plaintext encryption',
  adaptive_chosen_ciphertext_decryption: 'Adaptive chosen-ciphertext decryption',
  known_plaintext_ciphertext_pairs: 'Known plaintext–ciphertext pairs',
  classically_known_pairs: 'Classical known plaintext–ciphertext pairs',
  coherent_secret_oracle: 'Coherent access to a secret-key oracle',
  offline_public_cipher_evaluation: 'Offline quantum evaluation of the public cipher',
  logical_circuit: 'Logical-circuit resources',
  quantum_algorithm: 'Quantum-algorithm resources',
  related_key_chosen_plaintext_encryption: 'Related-key chosen-plaintext encryption',
  'related-key-chosen-plaintext-encryption': 'Related-key chosen-plaintext encryption',
  'related-key-chosen-ciphertext-decryption': 'Related-key chosen-ciphertext decryption',
  'adaptive-related-key-chosen-plaintext-encryption': 'Adaptive related-key chosen-plaintext encryption',
  'adaptive-related-key-chosen-ciphertext-decryption': 'Adaptive related-key chosen-ciphertext decryption',
  'related-subkey-chosen-plaintext-encryption': 'Related-subkey chosen-plaintext encryption',
  'adaptive-related-subkey-chosen-ciphertext-decryption': 'Adaptive related-subkey chosen-ciphertext decryption',
  'meet-in-the-middle': 'Meet-in-the-middle',
  'demirci-selcuk-meet-in-the-middle': 'Demirci–Selçuk meet-in-the-middle',
  'impossible-differential': 'Impossible differential',
  'related-key': 'Related-key',
  'related-key-differential': 'Related-key differential',
  'related-key-boomerang': 'Related-key boomerang',
  'related-key-impossible-differential': 'Related-key impossible differential',
  'differential-meet-in-the-middle': 'Differential meet-in-the-middle',
  'differential-fault-analysis': 'Differential fault analysis',
  'safe-error-analysis': 'Safe-error analysis',
  'key-recovery-success': 'Key-recovery success',
  distinguishing_advantage: 'Distinguishing advantage',
};

export function humanize(value: string): string {
  if (Object.prototype.hasOwnProperty.call(termLabels, value)) return termLabels[value];
  return value.replace(/[_-]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export function resolveInstance(cipherId: string, variantId: string | undefined, ciphers: readonly CipherFamily[], variants: readonly CipherVariant[]) {
  const cipher = ciphers.find((entry) => entry.id === cipherId);
  const variant = variants.find((entry) => entry.family === cipherId && (variantId === undefined || entry.id === variantId));
  return cipher && variant ? { cipher, variant } : null;
}

/** Shared results remain the same record objects; an instance is a view, not a copy. */
export function uniqueResults(records: readonly AnalysisResult[]): AnalysisResult[] {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

export function resultsForVariant(records: readonly AnalysisResult[], variantId: string): AnalysisResult[] {
  return variantId ? uniqueResults(records).filter((record) => record.target.variant_ids.includes(variantId)) : [];
}

export interface ResultFamilyView {
  id: string;
  family?: AnalysisResultFamily;
  records: AnalysisResult[];
  configurationCount: number;
}

function familiesByPoint(catalogs: readonly AnalysisFamilyCatalog[]): Map<string, AnalysisResultFamily> {
  const byPoint = new Map<string, AnalysisResultFamily>();
  for (const catalog of catalogs) for (const family of catalog.families) {
    for (const point of family.points) byPoint.set(point.result_id, family);
  }
  return byPoint;
}

/** Browsing omits reviewed exclusions; the original registry retains their URLs. */
export function activeResultPoints(records: readonly AnalysisResult[], catalogs: readonly AnalysisFamilyCatalog[] = []): AnalysisResult[] {
  const excluded = new Set(catalogs.flatMap(catalog => catalog.excluded_results.map(point => point.result_id)));
  return uniqueResults(records).filter(record => !excluded.has(record.id));
}

/** Group only curated references, after instance filtering; never aggregate costs. */
export function resultFamilyViews(records: readonly AnalysisResult[], catalogs: readonly AnalysisFamilyCatalog[] = []): ResultFamilyView[] {
  const byPoint = familiesByPoint(catalogs);
  const views = new Map<AnalysisResultFamily | string, ResultFamilyView>();
  for (const record of uniqueResults(records)) {
    const family = byPoint.get(record.id);
    const key = family ?? record.id;
    const view = views.get(key) ?? { id: family?.id ?? record.id, family, records: [], configurationCount: family?.points.length ?? 1 };
    view.records.push(record);
    views.set(key, view);
  }
  return [...views.values()];
}

export function isCostResult(record: AnalysisResult): boolean {
  return resultTaxonomy.kinds[record.result_kind]?.section === 'costs';
}

export interface ResultGroup {
  key: string;
  goal: AnalysisResult['goal'];
  keyModel: AnalysisResult['setting']['key_model'];
  computation: AnalysisResult['setting']['computation'];
  attackSurface: AnalysisResult['setting']['attack_surface'];
  records: AnalysisResult[];
}

/** Bounds and component properties never enter attack-cost tables. */
export function groupResults(records: readonly AnalysisResult[]): { groups: ResultGroup[]; bounds: AnalysisResult[]; properties: AnalysisResult[] } {
  const groups = new Map<string, ResultGroup>();
  const bounds: AnalysisResult[] = [];
  const properties: AnalysisResult[] = [];
  for (const record of uniqueResults(records)) {
    const section = resultTaxonomy.kinds[record.result_kind]?.section;
    if (section === 'bounds') { bounds.push(record); continue; }
    if (section === 'properties') { properties.push(record); continue; }
    if (section !== 'costs') continue;
    const key = `${record.goal}:${record.setting.key_model}:${record.setting.computation}:${record.setting.attack_surface}`;
    const group = groups.get(key) ?? { key, goal: record.goal, keyModel: record.setting.key_model, computation: record.setting.computation, attackSurface: record.setting.attack_surface, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  return { groups: [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)), bounds, properties };
}

export interface ComparisonSelection {
  ids: string[];
  unknownIds: string[];
  inapplicableIds: string[];
  structuralIds: string[];
  excessIds: string[];
  staleContext: boolean;
}

export const MODEL_SELECTION_PREFIX = 'model:';

export function modelSelectionId(view: ResultFamilyView): string {
  return view.family ? MODEL_SELECTION_PREFIX + view.family.id : view.id;
}

/** Model selections retain the complete evidenced construction, independent of list filters. */
export function comparisonView(id: string, records: readonly AnalysisResult[], catalogs: readonly AnalysisFamilyCatalog[] = []): ResultFamilyView | undefined {
  if (!id.startsWith(MODEL_SELECTION_PREFIX)) {
    const record = records.find(record => record.id === id);
    return record ? { id, records: [record], configurationCount: 1 } : undefined;
  }
  const family = catalogs.flatMap(catalog => catalog.families).find(family => MODEL_SELECTION_PREFIX + family.id === id);
  if (!family) return undefined;
  const byId = new Map(records.map(record => [record.id, record]));
  const points = family.points.flatMap(point => byId.get(point.result_id) ?? []);
  if (!points.length || points.length !== family.points.length) return undefined;
  return { id: family.id, family, records: points, configurationCount: points.length };
}

export function comparisonSelection(params: URLSearchParams, records: readonly AnalysisResult[], variantId: string, catalogs: readonly AnalysisFamilyCatalog[] = []): ComparisonSelection {
  const requested = [...new Set((params.get('ids') || '').split(',').filter(Boolean))];
  const selected: ComparisonSelection = { ids: [], unknownIds: [], inapplicableIds: [], structuralIds: [], excessIds: [], staleContext: Boolean(params.get('variant') && params.get('variant') !== variantId) };
  for (const id of requested) {
    const view = comparisonView(id, records, catalogs);
    if (!view) selected.unknownIds.push(id);
    else if (!view.records.every(record => record.target.variant_ids.includes(variantId))) selected.inapplicableIds.push(id);
    else if (!view.records.every(isCostResult)) selected.structuralIds.push(id);
    else if (!selected.staleContext && selected.ids.length < MAX_COMPARISON_RECORDS) selected.ids.push(id);
    else if (!selected.staleContext) selected.excessIds.push(id);
  }
  return selected;
}

export function withSelectedResults(params: URLSearchParams, ids: readonly string[]): URLSearchParams {
  const next = new URLSearchParams(params);
  const uniqueIds = [...new Set(ids)].slice(0, MAX_COMPARISON_RECORDS);
  if (uniqueIds.length) next.set('ids', uniqueIds.join(',')); else next.delete('ids');
  return next;
}

export function withVariantContext(params: URLSearchParams, variantId: string): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('variant', variantId);
  return next;
}

/** An explicit instance switch retains useful filters, but starts a fresh selection. */
export function switchInstanceParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of ['ids', 'page', 'variant']) next.delete(key);
  return next;
}

export function updateResultFilter(params: URLSearchParams, key: string, value: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value); else next.delete(key);
  if (key !== 'page' && key !== 'ids') next.delete('page');
  return next;
}

/** Clear result filters while retaining sort and comparison context. */
export function clearResultFilters(params: URLSearchParams): URLSearchParams {
  const next = resultPageParams(params);
  for (const key of resultFilterKeys) next.delete(key);
  next.delete('page');
  return next;
}

export function resultHref(id: string, params?: URLSearchParams): string {
  const query = params?.toString();
  return `#/cryptanalysis/results/${encodeURIComponent(id)}${query ? `?${query}` : ''}`;
}

export function sourceHref(id: string, variantId?: string): string {
  return `#/cryptanalysis/sources/${encodeURIComponent(id)}${variantId ? `?${new URLSearchParams({ variant: variantId })}` : ''}`;
}

export function instanceHref(cipherId: string, variantId: string, params?: URLSearchParams): string {
  const next = new URLSearchParams(params);
  // The route is the only authority for an instance list; no redundant query scope.
  next.delete('variant');
  next.delete('view');
  return `#/cryptanalysis/ciphers/${encodeURIComponent(cipherId)}/${encodeURIComponent(variantId)}${next.size ? `?${next}` : ''}`;
}

export function comparisonHref(variantId: string, ids: readonly string[], params?: URLSearchParams): string {
  const next = withVariantContext(withSelectedResults(params ?? new URLSearchParams(), ids), variantId);
  return `#/cryptanalysis/compare/${encodeURIComponent(variantId)}?${next}`;
}

/** Required path scope cannot be broadened or replaced by query parameters. */
export function filterResults(records: readonly AnalysisResult[], variantId: string, params: URLSearchParams, sources: readonly AnalysisSource[] = [], catalogs: readonly AnalysisFamilyCatalog[] = []): AnalysisResult[] {
  const bySource = new Map(sources.map((source) => [source.id, source]));
  const byPoint = familiesByPoint(catalogs);
  const terms = (params.get('q') || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const pointIds = new Set(records.map(record => record.id.toLowerCase()));
  const citationSources = new Map<string, Set<string>>();
  for (const source of sources) {
    for (const term of [source.citation_label, citationLabel(source)]) {
      const key = term.toLowerCase();
      const ids = citationSources.get(key) ?? new Set<string>();
      ids.add(source.id);
      citationSources.set(key, ids);
    }
  }
  const matches = resultsForVariant(records, variantId).filter((record) => {
    if (params.get('rounds') && String(record.target.rounds) !== params.get('rounds')) return false;
    if (params.get('scope') === 'full' && !record.target.full_round) return false;
    if (params.get('scope') === 'reduced' && record.target.full_round !== false) return false;
    if (params.get('scope') === 'variable' && !record.target.round_domain) return false;
    if (params.get('goal') && params.get('goal') !== record.goal) return false;
    if (params.get('key_model') && params.get('key_model') !== record.setting.key_model) return false;
    if (params.get('computation') && params.get('computation') !== record.setting.computation) return false;
    if (params.get('attack_surface') && params.get('attack_surface') !== 'all' && params.get('attack_surface') !== record.setting.attack_surface) return false;
    if (params.get('method') && params.get('method') !== record.display.method) return false;
    if (params.get('technique') && !record.techniques.includes(params.get('technique')!)) return false;
    if (params.get('oracle') && !record.setting.oracle_access.includes(params.get('oracle')!)) return false;
    const assessment = params.get('assessment');
    if (assessment === 'source_conflict' && record.assessment.claim_status !== 'source_conflict') return false;
    if (assessment === 'author_reported' && record.assessment.claim_status !== 'author_reported') return false;
    if (assessment === 'witness_checked' && record.assessment.reproduction !== 'collision_witness_only') return false;
    if (assessment === 'not_reproduced' && record.assessment.reproduction !== 'not_attempted') return false;
    if (terms.length) {
      const family = byPoint.get(record.id);
      // Sibling point IDs are deliberately absent: an ID search remains point-specific.
      const familyText = family ? [family.id, family.title, family.display_name, family.construction, JSON.stringify(family.parameters), JSON.stringify(family.model ?? {})].join(' ') : '';
      const sourceText = record.evidence.map((entry) => {
        const source = bySource.get(entry.source_id);
        return source ? `${citationLabel(source)} ${source.title} ${source.authors.join(' ')} ${source.year} ${source.publication.venue} ${source.publication.year} ${publicationLabel(source)} ${publicationLabel(source).replace(/\s/g, '')}` : entry.source_id;
      }).join(' ');
      const haystack = [record.id, record.title, record.display.name, record.display.method, methodLabels[record.display.method], record.target.description, JSON.stringify(record.property || {}), JSON.stringify(record.experiment || {}), JSON.stringify(record.theorem || {}), JSON.stringify(record.target.round_domain || {}), ...record.target.variant_ids,
        goalLabels[record.goal], keyModelLabels[record.setting.key_model], computationLabels[record.setting.computation], surfaceLabels[record.setting.attack_surface], ...record.techniques,
        ...Object.values(record.setting.quantum_model || {}), ...Object.values(record.setting.fault_model || {}),
        ...quantumModelTags(record).map(tag => tag.label),
        ...record.setting.oracle_access, record.setting.key_relation, record.setting.plaintext_model,
        record.setting.key_population, sourceText, familyText].join(' ').toLowerCase();
      if (!terms.every((term) => {
        if (pointIds.has(term)) return record.id.toLowerCase() === term;
        const citationIds = citationSources.get(term);
        if (citationIds) return record.evidence.some(entry => citationIds.has(entry.source_id));
        return haystack.includes(term);
      })) return false;
    }
    return true;
  });
  const newestSource = (record: AnalysisResult) => Math.max(0, ...record.evidence.map((entry) => bySource.get(entry.source_id)?.year || 0));
  return matches.sort((a, b) => {
    switch (params.get('sort')) {
      case 'title': return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
      case 'rounds-desc': return (b.target.rounds ?? -1) - (a.target.rounds ?? -1) || a.display.method.localeCompare(b.display.method) || newestSource(b) - newestSource(a) || a.id.localeCompare(b.id);
      case 'source-year-desc': return newestSource(b) - newestSource(a) || a.id.localeCompare(b.id);
      case 'reviewed-desc': return b.assessment.reviewed_on.localeCompare(a.assessment.reviewed_on) || a.id.localeCompare(b.id);
      default: return (b.target.rounds ?? -1) - (a.target.rounds ?? -1) || a.display.method.localeCompare(b.display.method) || newestSource(b) - newestSource(a) || a.id.localeCompare(b.id);
    }
  });
}

export function resultPage(params: URLSearchParams, count: number): { page: number; pageCount: number; offset: number } {
  const pageCount = Math.max(1, Math.ceil(count / RESULT_PAGE_SIZE));
  const raw = Number(params.get('page') || '1');
  const page = Math.min(pageCount, Number.isSafeInteger(raw) && raw > 0 ? raw : 1);
  return { page, pageCount, offset: (page - 1) * RESULT_PAGE_SIZE };
}

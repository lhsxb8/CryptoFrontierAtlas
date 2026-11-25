import type { Problem, Citation } from '../../features/questions/data';
import type { AnalysisResult, AnalysisSource, CipherFamily, CipherVariant } from '../../features/cryptanalysis/types';

export type Page = 'home' | 'questions' | 'question-sources' | 'ciphers' | 'cipher' | 'instance' | 'result' | 'compare' | 'analysis-sources' | 'coverage' | 'asymmetric' | 'implementation' | 'not-found';
export interface AtlasRoute {
  page: Page;
  path: string;
  id?: string;
  cipherId?: string;
  variantId?: string;
  params: URLSearchParams;
}

/** Old bookmarks resolve into the same pages; there is no legacy page stack. */
export function parseHash(hash: string, variants: readonly Pick<CipherVariant, 'id' | 'family'>[] = [], defaultInstances = variants): AtlasRoute {
  const raw = hash.replace(/^#/, '');
  const separator = raw.indexOf('?');
  let path = separator < 0 ? raw : raw.slice(0, separator);
  const params = new URLSearchParams(separator < 0 ? '' : raw.slice(separator + 1));
  if (/^question\//.test(path)) path = '/questions/' + path.slice('question/'.length);
  path = path.replace(/\/+$/, '') || '/';
  const invalid = (): AtlasRoute => ({ page: 'not-found', path, params });
  if (!path.startsWith('/')) return invalid();
  if (path === '/') return { page: 'home', path, params };
  let parts: string[];
  try { parts = path.slice(1).split('/').map(decodeURIComponent); } catch { return invalid(); }
  if (parts.some(part => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part))) return invalid();
  path = '/' + parts.join('/');
  const legacyVariant = variants.find(variant => variant.id === params.get('variant'));
  if (parts[0] === 'explore' && parts.length === 1) path = '/';
  else if (parts[0] === 'results' && parts.length <= 2) {
    path = parts[1] ? '/cryptanalysis/results/' + parts[1]
      : legacyVariant ? `/cryptanalysis/ciphers/${legacyVariant.family}/${legacyVariant.id}` : '/cryptanalysis';
    if (!parts[1]) params.delete('variant');
  } else if (parts[0] === 'objects' && parts.length <= 2) {
    path = parts[1] ? `/cryptanalysis/ciphers/${parts[1]}` : '/cryptanalysis';
    if (parts[1] && legacyVariant?.family === parts[1]) path += '/' + legacyVariant.id;
    params.delete('variant');
    params.delete('tab');
  } else if (parts[0] === 'compare' && parts.length === 1) {
    path = '/cryptanalysis/compare' + (legacyVariant ? '/' + legacyVariant.id : '');
  } else if (parts[0] === 'sources' && parts.length <= 2) {
    path = !parts[1] && params.get('tab') === 'questions' ? '/questions/sources'
      : '/cryptanalysis/sources' + (parts[1] ? '/' + parts[1] : '');
    params.delete('tab');
  } else if (parts[0] === 'coverage' && parts.length === 1) path = '/cryptanalysis/coverage';

  const base = { path, params };
  if (path === '/') return { ...base, page: 'home' };
  if (path === '/asymmetric-cryptanalysis') return { ...base, page: 'asymmetric' };
  if (path === '/implementation') return { ...base, page: 'implementation' };
  if (path === '/questions/sources') return { ...base, page: 'question-sources' };
  let match = path.match(/^\/questions(?:\/([^/]+))?$/);
  if (match) return { ...base, page: 'questions', id: match[1] };
  if (path === '/cryptanalysis') return { ...base, page: 'ciphers' };
  match = path.match(/^\/cryptanalysis\/ciphers\/([^/]+)(?:\/([^/]+))?$/);
  if (match) {
    // Preserve existing analysis defaults. Directory-only families have an
    // overview; explicit instance bookmarks always take precedence.
    const cipherId = match[1];
    const variantId = match[2] ?? (legacyVariant?.family === cipherId ? legacyVariant.id : defaultInstances.find(variant => variant.family === cipherId)?.id);
    return { ...base, page: variantId ? 'instance' : 'cipher', path: '/cryptanalysis/ciphers/' + cipherId + (variantId ? '/' + variantId : ''), cipherId, variantId };
  }
  match = path.match(/^\/cryptanalysis\/results\/([^/]+)$/);
  if (match) return { ...base, page: 'result', id: match[1] };
  match = path.match(/^\/cryptanalysis\/compare(?:\/([^/]+))?$/);
  if (match) return { ...base, page: 'compare', variantId: match[1] };
  match = path.match(/^\/cryptanalysis\/sources(?:\/([^/]+))?$/);
  if (match) return { ...base, page: 'analysis-sources', id: match[1] };
  if (path === '/cryptanalysis/coverage') return { ...base, page: 'coverage' };
  return invalid();
}

export function analysisScope(params: URLSearchParams, ciphers: readonly CipherFamily[], variants: readonly CipherVariant[], records: readonly AnalysisResult[]) {
  const variantId = params.get('variant');
  const familyId = params.get('family');
  const variant = variants.find(item => item.id === variantId);
  const family = ciphers.find(item => item.id === (familyId || variant?.family));
  const invalid = Boolean((variantId && !variant) || (familyId && !family) || (variant && (!family || variant.family !== family.id)));
  const scopedVariants = invalid ? [] : variants.filter(item => variant ? item.id === variant.id : !family || item.family === family.id);
  const ids = new Set(scopedVariants.map(item => item.id));
  const scopedRecords = invalid ? [] : [...new Map(records.filter(record => record.target.variant_ids.some(id => ids.has(id))).map(record => [record.id, record])).values()];
  return { family, variant, variants: scopedVariants, records: scopedRecords, invalid };
}

/** Collection links inherit the displayed, validated scope, never a conflicting query. */
export function routeScopeParams(route: AtlasRoute, ciphers: readonly CipherFamily[], variants: readonly CipherVariant[], records: readonly AnalysisResult[]): URLSearchParams {
  const params = new URLSearchParams();
  let variant: CipherVariant | undefined;
  if (route.page === 'instance') variant = variants.find(item => item.id === route.variantId && item.family === route.cipherId);
  else if (route.page === 'compare') variant = variants.find(item => item.id === route.variantId);
  else if (route.page === 'cipher' && ciphers.some(cipher => cipher.id === route.cipherId)) params.set('family', route.cipherId!);
  else if (route.page === 'result') {
    const record = records.find(item => item.id === route.id);
    const requested = route.params.get('variant');
    const id = requested || (record?.target.variant_ids.length === 1 ? record.target.variant_ids[0] : undefined);
    if (id && record?.target.variant_ids.includes(id)) variant = variants.find(item => item.id === id);
  } else if (route.page === 'analysis-sources' || route.page === 'coverage') {
    const scope = analysisScope(route.params, ciphers, variants, records);
    if (!scope.invalid) {
      variant = scope.variant;
      if (!variant && scope.family) params.set('family', scope.family.id);
    }
  }
  if (variant && ciphers.some(cipher => cipher.id === variant.family)) params.set('variant', variant.id);
  return params;
}

export function sourcesInScope(sources: readonly AnalysisSource[], scope: ReturnType<typeof analysisScope>): AnalysisSource[] {
  if (scope.invalid) return [];
  if (!scope.family && !scope.variant) return [...sources];
  const ids = new Set(scope.variants.map(variant => variant.specification_source));
  for (const result of scope.records) {
    for (const evidence of result.evidence) ids.add(evidence.source_id);
    for (const conflict of result.field_conflicts ?? []) {
      for (const observation of conflict.observations) ids.add(observation.source_id);
    }
  }
  return sources.filter(source => ids.has(source.id));
}

export function variantLabel(variant: CipherVariant): string {
  return variant.name ?? variant.id.toUpperCase();
}

const standardAesInstances = new Set(['aes-128', 'aes-192', 'aes-256']);

/** Navigation groups only; each instance keeps its own identity and result scope. */
export function instanceGroups(variants: readonly CipherVariant[]) {
  const primary: CipherVariant[] = [];
  const others: CipherVariant[] = [];
  for (const variant of variants) {
    (variant.family === 'aes' && !standardAesInstances.has(variant.id) ? others : primary).push(variant);
  }
  return { primary, others };
}

export function variantParameters(variant: CipherVariant): string {
  const parameters = [];
  if (variant.key_bits !== undefined) parameters.push(`${variant.key_bits}-bit key`);
  if (variant.block_bits !== undefined) parameters.push(`${variant.block_bits}-bit block`);
  parameters.push(`${variant.full_rounds} full rounds`);
  return parameters.join(' · ');
}

export function routeHref(path: string, params?: URLSearchParams): string {
  const query = params?.toString();
  return '#' + path + (query ? '?' + query : '');
}

export function enumLabel(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ');
}

export function matchesSearch(text: string, query: string): boolean {
  const normalize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[-_]/g, ' ');
  const haystack = normalize(text);
  return normalize(query).trim().split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
}

export interface CitationEntry {
  key: string;
  citation: Citation;
  questions: { id: string; title: string; role: string }[];
}

export function buildCitationIndex(records: Problem[]): CitationEntry[] {
  const index = new Map<string, CitationEntry>();
  for (const problem of records) for (const citation of problem.source.citations) {
    // Exact citation text/locator grouping only: sharing a DOI does not identify a PDF version.
    const key = JSON.stringify([citation.label, citation.locator ?? '', citation.doi ?? '', citation.eprint ?? '', citation.url ?? '']);
    const entry = index.get(key) ?? { key, citation, questions: [] };
    if (!entry.questions.some(question => question.id === problem.id && question.role === citation.role)) {
      entry.questions.push({ id: problem.id, title: problem.title, role: citation.role });
    }
    index.set(key, entry);
  }
  return [...index.values()].sort((a, b) => a.citation.label.localeCompare(b.citation.label));
}

export function externalLinks(source: { url?: string; doi?: string; eprint?: string }): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [];
  if (source.url && /^https?:\/\//i.test(source.url)) links.push({ href: source.url, label: 'Original source' });
  if (source.doi) links.push({ href: 'https://doi.org/' + source.doi.replace(/^https?:\/\/(?:dx\.)?doi.org\//i, ''), label: 'DOI' });
  if (source.eprint) {
    const arxiv = source.eprint.match(/^arXiv:\s*([\d.]+(?:v\d+)?)$/i);
    const iacr = source.eprint.match(/^(?:(?:IACR\s+)?ePrint\s+)?(\d{4}\/\d+)$/i);
    if (arxiv) links.push({ href: 'https://arxiv.org/abs/' + arxiv[1], label: 'arXiv' });
    if (iacr) links.push({ href: 'https://eprint.iacr.org/' + iacr[1], label: 'ePrint' });
  }
  return links.filter((link, i) => links.findIndex(other => other.href === link.href) === i);
}

export function pageNumber(value: string | null, totalPages: number): number {
  const parsed = Number(value ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, Math.max(1, totalPages)) : 1;
}

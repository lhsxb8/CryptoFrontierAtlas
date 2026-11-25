import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { MathText } from '../../components/MathText';
import { safeExternalUrl } from '../../components/safe-url';
import { getRelatedResults } from '../cryptanalysis/data';
import './questions.css';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  FileCheck2,
  Filter,
  Layers3,
  Link2,
  ListFilter,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { areaLabels, areaOf, domainOf, problems, researchTopicCategories, taxonomyPath } from './data';
import type { Problem } from './data';

type Status = Problem['status']['public_mathematical_status'];

const statusLabels: Record<Status, string> = {
  open: 'Open',
  partial_progress: 'Partial progress',
  resolved: 'Resolved',
  refuted: 'Refuted',
  corrected: 'Corrected',
  historically_settled: 'Historically settled',
};

const statusTone: Record<Status, string> = {
  open: 'status-open',
  partial_progress: 'status-partial',
  resolved: 'status-resolved',
  refuted: 'status-refuted',
  corrected: 'status-corrected',
  historically_settled: 'status-history',
};

const progressLabels: Record<string, string> = {
  source_statement: 'Original statement',
  restatement: 'Restatement',
  prior_result: 'Prior result',
  public_result: 'Public result',
  independent_result: 'Independent result',
  audit: 'Audit',
  machine_checked_formalization: 'Machine-checked formalization',
};

const sourceKindLabels: Record<Problem['source']['kind'], string> = {
  explicit_open_problem: 'Explicit open problem',
  explicit_conjecture: 'Explicit conjecture',
  open_challenge: 'Open challenge',
  public_thesis_conjecture: 'Public thesis conjecture',
};

const verificationLabels: Record<Problem['status']['public_verification_status'], string> = {
  none: 'None',
  computer_checked: 'Computer checked',
  externally_claimed: 'Externally claimed',
  externally_reproducible: 'Externally reproducible',
  repository_checked: 'Repository checked',
};

const peerReviewLabels: Record<Problem['status']['peer_review_status'], string> = {
  not_submitted: 'Not submitted',
  preprint: 'Preprint',
  under_review: 'Under review',
  published: 'Published',
  independently_audited: 'Independently audited',
};

const artifactRoleLabels: Record<Problem['artifacts'][number]['role'], string> = {
  canonical_manuscript: 'Canonical manuscript',
  source_code: 'Source code',
  verifier: 'Verifier',
  data: 'Data',
  superseded_draft: 'Superseded draft',
};

const artifactVisibilityLabels: Record<Problem['artifacts'][number]['visibility'], string> = {
  not_listed: 'Not listed',
  external_link: 'External link',
  repository_file: 'Repository file',
};

function classificationIds(problem: Problem) {
  return [problem.classification.primary, ...problem.classification.secondary];
}

function matchesArea(problem: Problem, area: string) {
  return area === 'all' || areaOf(problem.classification.primary) === area;
}

function matchesDomain(problem: Problem, domain: string) {
  return domain === 'all' || domainOf(problem.classification.primary) === domain;
}

function ClassificationPath({ id }: { id: string }) {
  const path = taxonomyPath(id);
  return (
    <span className="classification-path">
      <span>{path.area}</span><span aria-hidden="true">/</span>
      <span>{path.domain}</span><span aria-hidden="true">/</span>
      <strong>{path.leaf}</strong>
    </span>
  );
}

function eprintUrl(identifier: string) {
  const arxiv = identifier.match(/^arXiv:\s*([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?)$/i);
  if (arxiv) return `https://arxiv.org/abs/${arxiv[1]}`;
  const iacr = identifier.match(/^(?:(?:IACR\s+)?ePrint\s+)?([0-9]{4}\/[0-9]+)$/i);
  if (iacr) return `https://eprint.iacr.org/${iacr[1]}`;
  return null;
}

function readableEnum(value: string) {
  return value.replaceAll('_', ' ');
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '');
    return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${pathname}${url.search}${url.hash}`;
  } catch {
    return value.replace(/\/$/, '');
  }
}

function CitationLinks({ citation, iconSize = 12 }: { citation: Problem['source']['citations'][number]; iconSize?: number }) {
  const eprintHref = citation.eprint ? eprintUrl(citation.eprint) : null;
  const links = [
    citation.doi && { href: `https://doi.org/${citation.doi}`, label: 'DOI' },
    citation.eprint && eprintHref && { href: eprintHref, label: citation.eprint },
    safeExternalUrl(citation.url) && { href: safeExternalUrl(citation.url)!, label: 'Open link' },
  ].filter((item): item is { href: string; label: string } => Boolean(item));
  const seen = new Set<string>();
  const uniqueLinks = links.filter((item) => {
    const key = canonicalUrl(item.href);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <>
      {uniqueLinks.map((item) => <a href={item.href} target="_blank" rel="noreferrer" aria-label={`${citation.label}: ${item.label}`} key={item.href}>{item.label} <ExternalLink size={iconSize} /></a>)}
      {citation.eprint && !eprintHref && <span className="citation-identifier">{citation.eprint}</span>}
    </>
  );
}

type ProblemExplorerProps = {
  problemId?: string;
  searchParams: URLSearchParams;
  onParamsChange: (params: URLSearchParams, replace?: boolean) => void;
};

type FilterName = 'q' | 'area' | 'domain' | 'category' | 'status' | 'sort' | 'page';
const PAGE_SIZE = 12;

function ProblemExplorer({ problemId, searchParams, onParamsChange }: ProblemExplorerProps) {
  const query = searchParams.get('q') ?? '';
  const requestedArea = searchParams.get('area') ?? 'all';
  const area = Object.prototype.hasOwnProperty.call(areaLabels, requestedArea) ? requestedArea : 'all';
  const requestedDomain = researchTopicCategories.find((item) => item.id === searchParams.get('domain'));
  const domain = requestedDomain && (area === 'all' || requestedDomain.area === area) ? requestedDomain.id : 'all';
  const requestedCategory = searchParams.get('category') ?? 'all';
  const categoryGroup = researchTopicCategories.find((item) => item.children.some((child) => child.id === requestedCategory));
  const category = categoryGroup && (area === 'all' || categoryGroup.area === area) && (domain === 'all' || categoryGroup.id === domain)
    ? requestedCategory : 'all';
  const requestedStatus = searchParams.get('status') ?? 'all';
  const status: 'all' | Status = Object.prototype.hasOwnProperty.call(statusLabels, requestedStatus) ? requestedStatus as Status : 'all';
  const sort = searchParams.get('sort') === 'reviewed' ? 'reviewed' : 'alphabetical';
  const requestedPage = Number(searchParams.get('page') ?? 1);
  const selectedId = problemId ?? null;
  const [expandedDomain, setExpandedDomain] = useState<string | null>(domain === 'all' ? null : domain);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const listReturnRef = useRef<{ scrollY: number; recordId: string } | null>(null);

  function updateFilters(changes: Partial<Record<FilterName, string>>, replace = false) {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      if (!value || value === 'all' || (key === 'sort' && value === 'alphabetical') || (key === 'page' && value === '1')) next.delete(key);
      else next.set(key, value);
    }
    onParamsChange(next, replace);
  }

  function questionHref(id?: string) {
    const suffix = searchParams.toString();
    return `#/questions${id ? `/${encodeURIComponent(id)}` : ''}${suffix ? `?${suffix}` : ''}`;
  }

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    setExpandedDomain(domain !== 'all' ? domain : categoryGroup?.id ?? null);
  }, [domain, categoryGroup?.id]);

  useLayoutEffect(() => {
    if (selectedId) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.querySelector<HTMLElement>('.detail-heading h1')?.focus({ preventScroll: true });
      return;
    }
    const { scrollY, recordId } = listReturnRef.current ?? { scrollY: 0, recordId: '' };
    const restoreListPosition = () => {
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
      const target = (recordId ? document.querySelector<HTMLElement>(`[data-record-id="${CSS.escape(recordId)}"]`) : null)
        ?? document.querySelector<HTMLElement>('#questions-heading');
      target?.focus({ preventScroll: true });
    };

    restoreListPosition();
    const frame = window.requestAnimationFrame(restoreListPosition);
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...problems]
      .filter((problem) => matchesArea(problem, area))
      .filter((problem) => matchesDomain(problem, domain))
      .filter((problem) => category === 'all' || problem.classification.primary === category)
      .filter((problem) => status === 'all' || problem.status.public_mathematical_status === status)
      .filter((problem) => {
        if (!normalized) return true;
        const classifications = classificationIds(problem).map((id) => taxonomyPath(id));
        return [
          problem.id,
          problem.title,
          problem.summary,
          problem.formal_statement.body,
          ...classifications.flatMap((item) => [item.area, item.domain, item.leaf]),
          problem.classification.tags.join(' '),
          ...problem.source.citations.map((citation) => citation.label),
        ].join(' ').toLowerCase().includes(normalized);
      })
      .sort((a, b) => sort === 'alphabetical'
        ? a.title.localeCompare(b.title)
        : b.status.last_reviewed.localeCompare(a.status.last_reviewed));
  }, [area, category, domain, query, sort, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const selected = problems.find((problem) => problem.id === selectedId) ?? null;

  useEffect(() => {
    document.title = selected
      ? `${selected.title} · CryptoFrontierAtlas`
      : selectedId ? 'Question not found · CryptoFrontierAtlas' : 'Questions · CryptoFrontierAtlas';
  }, [selected, selectedId]);

  function openProblem(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!selectedId) listReturnRef.current = { scrollY: window.scrollY, recordId: id };
  }

  function resetFilters() {
    updateFilters({ q: '', area: 'all', domain: 'all', category: 'all', status: 'all' });
    setExpandedDomain(null);
  }

  function changePage(page: number) {
    updateFilters({ page: String(page) });
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector<HTMLElement>('#questions-heading')?.focus({ preventScroll: true });
  }

  function toggleTopicGroup(group: (typeof researchTopicCategories)[number]) {
    if (expandedDomain === group.id) {
      setExpandedDomain(null);
      return;
    }

    setExpandedDomain(group.id);
    updateFilters({ area: group.area, domain: group.id, ...(domain !== group.id ? { category: 'all' } : {}) });
  }

  function selectTopicCategory(group: (typeof researchTopicCategories)[number], categoryId: string) {
    updateFilters({ area: group.area, domain: group.id, category: categoryId });
    setExpandedDomain(group.id);
  }

  const areaCounts = Object.entries(areaLabels).map(([id, label]) => ({
    id,
    label,
    count: problems.filter((problem) => matchesArea(problem, id)).length,
  })).filter((item) => item.count > 0);
  const domainCounts = researchTopicCategories
    .filter((item) => area === 'all' || item.area === area)
    .map((item) => ({
      ...item,
      count: problems.filter((problem) => matchesDomain(problem, item.id)).length,
    })).filter((item) => item.count > 0);
  const activeTopic = category !== 'all' ? taxonomyPath(category).leaf
    : domain !== 'all' ? researchTopicCategories.find((item) => item.id === domain)?.label
    : area !== 'all' ? areaLabels[area as keyof typeof areaLabels] : null;
  const hasFilters = Boolean(query || activeTopic || status !== 'all');

  return (
    <div className="problem-explorer">
        {selectedId ? (
          <section className="detail-panel">
            {selected ? <Detail key={selected.id} problem={selected} questionHref={questionHref} onNavigate={openProblem} /> : (
              <div className="detail-inner not-found">
                <a className="back-button" href={questionHref()}><ArrowLeft size={16} /> Back to questions</a>
                <div className="detail-heading"><h1 tabIndex={-1}>Question not found</h1></div>
              </div>
            )}
          </section>
        ) : (
        <section className="workspace" aria-label="Question atlas">
          <div className="results-toolbar">
            <h1 id="questions-heading" tabIndex={-1}>Questions <span aria-live="polite">· {filtered.length}</span></h1>
            <div className="toolbar-actions">
              <div className="search-box">
                <Search size={17} aria-hidden="true" />
                <label className="sr-only" htmlFor="question-search">Search questions</label>
                <input id="question-search" type="search" value={query} onChange={(event) => updateFilters({ q: event.target.value }, true)} placeholder="Search questions…" />
                {query && <button className="icon-button" aria-label="Clear search" onClick={() => { updateFilters({ q: '' }); document.getElementById('question-search')?.focus(); }}><X size={15} /></button>}
              </div>
              <button className={`filter-toggle ${filtersOpen ? 'is-open' : ''}`} aria-expanded={filtersOpen} aria-controls="question-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
                <Filter size={15} /> Filters{(activeTopic || status !== 'all') && <span className="filter-dot" aria-label="Active filters" />}
              </button>
              <label className="sort-wrap">
                <ListFilter size={15} aria-hidden="true" />
                <span className="sr-only">Sort records</span>
                <select value={sort} onChange={(event) => updateFilters({ sort: event.target.value })}>
                  <option value="alphabetical">A–Z</option>
                  <option value="reviewed">Last reviewed</option>
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </label>
            </div>
            {hasFilters && <div className="active-filters">
              {activeTopic && <button onClick={() => { updateFilters({ area: 'all', domain: 'all', category: 'all' }); setExpandedDomain(null); }} aria-label={`Clear topic filter: ${activeTopic}`}>{activeTopic}<X size={12} /></button>}
              {status !== 'all' && <button onClick={() => updateFilters({ status: 'all' })} aria-label="Clear status filter">{statusLabels[status]}<X size={12} /></button>}
              <button className="reset-filters" onClick={resetFilters}>Reset filters</button>
            </div>}
          </div>
          <aside className={`sidebar ${filtersOpen ? 'is-open' : ''}`} id="question-filters" aria-label="Question filters">
            <div className="sidebar-label"><Filter size={15} /> Area</div>
            <div className="domain-list">
              <button className={`domain-button ${area === 'all' && domain === 'all' && category === 'all' ? 'selected' : ''}`} aria-pressed={area === 'all' && domain === 'all' && category === 'all'} onClick={() => { updateFilters({ area: 'all', domain: 'all', category: 'all' }); setExpandedDomain(null); }}>
                <span className="domain-swatch all-swatch" />
                <span>All questions</span><strong>{problems.length}</strong>
              </button>
              {areaCounts.map((item) => (
                <button key={item.id} className={`domain-button ${area === item.id && domain === 'all' && category === 'all' ? 'selected' : ''}`} aria-pressed={area === item.id && domain === 'all' && category === 'all'} onClick={() => { updateFilters({ area: item.id, domain: 'all', category: 'all' }); setExpandedDomain(null); }}>
                  <span className={`domain-swatch ${item.id}`} />
                  <span>{item.label}</span><strong>{item.count}</strong>
                </button>
              ))}
            </div>

            <div className="sidebar-divider compact-divider" />
            <div className="sidebar-label"><Layers3 size={15} /> Topics</div>
            <div className="domain-list topic-category-list">
              <button className={`domain-button ${domain === 'all' && category === 'all' ? 'selected' : ''}`} aria-pressed={domain === 'all' && category === 'all'} onClick={() => { updateFilters({ domain: 'all', category: 'all' }); setExpandedDomain(null); }}>
                <span className="domain-swatch all-domains-swatch" />
                <span>All topics</span><strong>{area === 'all' ? problems.length : problems.filter((problem) => matchesArea(problem, area)).length}</strong>
              </button>
              {domainCounts.map((item) => {
                const isExpanded = expandedDomain === item.id;
                const isActive = domain === item.id;
                const childListId = `topic-children-${item.id}`;
                return (
                  <div className={`topic-group ${isActive ? 'active' : ''}`} key={item.id}>
                    <button
                      className={`domain-button topic-group-button ${isActive && category === 'all' ? 'selected' : ''} ${isActive ? 'active-parent' : ''} ${isExpanded ? 'expanded' : ''}`}
                      type="button"
                      aria-expanded={isExpanded}
                      aria-pressed={isActive && category === 'all'}
                      aria-controls={childListId}
                      onClick={() => toggleTopicGroup(item)}
                    >
                      <span className={`domain-swatch ${item.id}`} />
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                      <ChevronDown className="topic-chevron" size={14} aria-hidden="true" />
                    </button>
                    {isExpanded && (
                      <div className="topic-child-list" id={childListId} role="group" aria-label={`${item.label} subcategories`}>
                        {item.children.map((child) => {
                          const childCount = problems.filter((problem) => problem.classification.primary === child.id).length;
                          if (!childCount) return null;
                          const isSelected = category === child.id;
                          return (
                            <button
                              className={`topic-child-button ${isSelected ? 'selected' : ''}`}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => selectTopicCategory(item, child.id)}
                              key={child.id}
                            >
                              <span>{child.label}</span>
                              <strong>{childCount}</strong>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="sidebar-divider" />
            <div className="sidebar-label"><SlidersHorizontal size={15} /> Status</div>
            <label className="select-wrap">
              <span className="sr-only">Filter by mathematical status</span>
              <select value={status} onChange={(event) => updateFilters({ status: event.target.value })}>
                <option value="all">All statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>

            <button className="apply-filters" onClick={() => { setFiltersOpen(false); document.querySelector<HTMLElement>('.filter-toggle')?.focus(); }}>Show {filtered.length} questions</button>
          </aside>

          <section className="results-column" aria-labelledby="questions-heading">
            <div className="record-list">
              {paginated.map((problem, index) => (
                <a className="record-row" href={questionHref(problem.id)} data-record-id={problem.id} aria-labelledby={`title-${problem.id}`} key={problem.id} onClick={(event) => openProblem(event, problem.id)}>
                  <span className="record-index" aria-hidden="true">{String(pageStart + index + 1).padStart(2, '0')}</span>
                  <span className="record-main">
                    <strong id={`title-${problem.id}`}>{problem.title}</strong>
                    <span className="record-topline">
                      <span className={`status-pill ${statusTone[problem.status.public_mathematical_status]}`}><span />{statusLabels[problem.status.public_mathematical_status]}</span>
                      <span className="record-category">{taxonomyPath(problem.classification.primary).leaf}</span>
                    </span>
                    <span className="record-summary"><MathText text={problem.summary} /></span>
                  </span>
                  <ChevronRight className="record-arrow" size={18} aria-hidden="true" />
                </a>
              ))}
              {!filtered.length && <div className="empty-state"><Search size={24} /><strong>No matching questions</strong><button className="text-button" onClick={resetFilters}>Reset filters</button></div>}
            </div>
            {filtered.length > 0 && (
              <nav className="pagination" aria-label="Question index pagination">
                <span className="pagination-range">Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                <div className="pagination-controls">
                  <button className="pagination-button" type="button" aria-label="Previous page" title="Previous page" disabled={currentPage === 1} onClick={() => changePage(Math.max(1, currentPage - 1))}><ChevronLeft size={16} /></button>
                  <span className="pagination-status" aria-live="polite">Page {currentPage} of {totalPages}</span>
                  <button className="pagination-button" type="button" aria-label="Next page" title="Next page" disabled={currentPage === totalPages} onClick={() => changePage(Math.min(totalPages, currentPage + 1))}><ChevronRight size={16} /></button>
                </div>
              </nav>
            )}
          </section>
        </section>
        )}
    </div>
  );
}

function Timeline({ entries, citations }: { entries: Problem['progress']; citations: Problem['source']['citations'] }) {
  return (
    <div className="timeline">
      {entries.map((entry, index) => (
        <div className="timeline-item" key={`${entry.date}-${entry.kind}-${index}`}>
          <span className="timeline-date">{entry.date}</span>
          <div>
            <strong>{progressLabels[entry.kind] ?? readableEnum(entry.kind)}</strong>
            <p><MathText text={entry.summary} /></p>
            {entry.citation_labels.length > 0 && <div className="citation-references">{entry.citation_labels.map((label) => {
              const citationIndex = citations.findIndex((citation) => citation.label === label);
              return citationIndex < 0 ? <span key={label}>{label}</span> : (
                <button key={label} className="citation-reference" title={label} aria-label={`Source ${citationIndex + 1}: ${label}`} onClick={() => {
                  const target = document.getElementById(`citation-${citationIndex}`);
                  target?.scrollIntoView({ block: 'center', behavior: 'instant' });
                  target?.focus({ preventScroll: true });
                }}>[{citationIndex + 1}]</button>
              );
            })}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Detail({ problem, questionHref, onNavigate }: {
  problem: Problem;
  questionHref: (id?: string) => string;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, id: string) => void;
}) {
  const statementHistory = problem.progress.filter((entry) => entry.kind === 'source_statement' || entry.kind === 'restatement');
  const progress = problem.progress.filter((entry) => entry.kind !== 'source_statement' && entry.kind !== 'restatement');
  const hasLean = problem.lean.status !== 'none';
  const verification = problem.status.public_verification_status;
  const review = problem.status.peer_review_status;
  const leanFields = [
    ['Source path', problem.lean.path],
    ['Commit', problem.lean.commit],
    ['Lean version', problem.lean.lean_version],
    ['Mathlib version', problem.lean.mathlib_version],
    ['Trusted base', problem.lean.trusted_base],
    ['Replay command', problem.lean.replay_command],
    ['Source tree SHA-256', problem.lean.source_tree_sha256],
    ['Source files', problem.lean.source_tree_file_count?.toString()],
  ].filter((entry) => entry[1]);
  const relationGroups = [
    { label: 'Related questions', ids: problem.relations.related },
    { label: 'Supersedes', ids: problem.relations.supersedes },
    { label: 'Superseded by', ids: problem.relations.superseded_by },
  ].filter((group) => group.ids.length > 0);
  const relatedResults = getRelatedResults(problem.id);

  return (
    <div className="detail-inner">
      <div className="detail-topbar"><a className="back-button" href={questionHref()}><ArrowLeft size={16} /> Back to questions</a><time dateTime={problem.status.last_reviewed}>Reviewed {problem.status.last_reviewed}</time></div>
      <div className="detail-heading">
        <div className="record-topline"><span className={`status-pill ${statusTone[problem.status.public_mathematical_status]}`}><span />{statusLabels[problem.status.public_mathematical_status]}</span><span className="record-category">{taxonomyPath(problem.classification.primary).leaf}</span></div>
        <h1 tabIndex={-1}>{problem.title}</h1>
        <p><MathText text={problem.summary} /></p>
        {(verification !== 'none' || review !== 'published' || hasLean) && <div className="evidence-badges" aria-label="Evidence summary">
          {verification !== 'none' && <span><ShieldCheck size={13} />{verificationLabels[verification]}</span>}
          {(review !== 'published' || verification !== 'none') && <span><BookOpen size={13} />{peerReviewLabels[review]}</span>}
          {hasLean && <span><Code2 size={13} />Lean {readableEnum(problem.lean.status)}{problem.lean.status === 'complete' && problem.status.public_mathematical_status === 'partial_progress' ? ' · scoped result' : ''}</span>}
          {hasLean && !problem.lean.available_in_repo && <span>Lean source not in repository</span>}
        </div>}
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-section">
            <h2 className="section-kicker">Formal statement</h2>
            <div className="formula-block"><MathText text={problem.formal_statement.body} /></div>
            {problem.scope.assumptions.length > 0 && <div className="conditions">
              <h3>Conditions</h3>
              <ul>{problem.scope.assumptions.map((assumption, index) => <li key={index}><MathText text={assumption} /></li>)}</ul>
            </div>}
            <details className="disclosure scope-details">
              <summary>Parameters &amp; domain <ChevronDown size={14} aria-hidden="true" /></summary>
              <dl className="metadata-list">
                <div><dt>Domain</dt><dd><MathText text={problem.scope.domain} /></dd></div>
                {problem.scope.parameters.length > 0 && <div><dt>Parameters</dt><dd><MathText text={problem.scope.parameters.join(' · ')} /></dd></div>}
              </dl>
            </details>
          </section>
          <section className="detail-section">
            <h2 className="section-kicker">Scope &amp; unresolved questions</h2>
            <p className="scope-remainder"><MathText text={problem.scope.unresolved_remainder} /></p>
          </section>
          {progress.length > 0 && <section className="detail-section progress-section">
            <h2 className="section-kicker">Progress</h2>
            <Timeline entries={progress} citations={problem.source.citations} />
          </section>}
          {relatedResults.length > 0 && <section className="detail-section question-analysis-links" aria-labelledby="related-analysis-heading">
            <h2 className="section-kicker" id="related-analysis-heading">Related analysis results</h2>
            {relatedResults.map((result) => (
              <a className="question-analysis-link" href={`#/cryptanalysis/results/${encodeURIComponent(result.id)}`} key={result.id}>
                <span><strong>{result.title}</strong><span>{result.target.round_domain?.domain ?? result.target.rounds} rounds · {readableEnum(result.goal)} · {readableEnum(result.setting.key_model)}</span></span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            ))}
          </section>}
        </div>
        <aside className="detail-side">
          <section className="side-block sources-block">
            <h2 className="section-kicker"><BookOpen size={14} /> Sources</h2>
            {problem.source.provenance?.origin_status === 'unresolved' && <p className="source-note">{problem.source.provenance.note ?? 'Original provenance unresolved.'}</p>}
            {problem.source.citations.map((citation, index) => (
              <div className="citation-entry" id={`citation-${index}`} tabIndex={-1} key={`${citation.role}-${citation.label}`}>
                <strong><span className="citation-number">[{index + 1}]</span> {citation.label}</strong>
                <span className="citation-role">{readableEnum(citation.role)}</span>
                {citation.locator && <span className="citation-locator">{citation.locator}</span>}
                <div className="citation-links"><CitationLinks citation={citation} /></div>
              </div>
            ))}
            {statementHistory.length > 0 && <details className="disclosure statement-history">
              <summary>Statement history <ChevronDown size={14} aria-hidden="true" /></summary>
              <Timeline entries={statementHistory} citations={problem.source.citations} />
            </details>}
          </section>
          {problem.artifacts.length > 0 && <section className="side-block artifact-block">
            <h2 className="section-kicker"><FileCheck2 size={14} /> Proof &amp; code</h2>
            {problem.artifacts.map((artifact, index) => (
                <div className="artifact-entry" key={`${artifact.role}-${artifact.url ?? index}`}>
                  {safeExternalUrl(artifact.url)
                    ? <a href={safeExternalUrl(artifact.url)!} target="_blank" rel="noreferrer">{artifactRoleLabels[artifact.role]} <ExternalLink size={12} /></a>
                    : <strong>{artifactRoleLabels[artifact.role]}</strong>}
                  <details className="disclosure artifact-details">
                    <summary>Artifact details <ChevronDown size={14} aria-hidden="true" /></summary>
                    <dl className="metadata-list">
                      <div><dt>Availability</dt><dd>{artifactVisibilityLabels[artifact.visibility]}</dd></div>
                      {artifact.license && <div><dt>License</dt><dd>{artifact.license}</dd></div>}
                      {artifact.sha256 && <div><dt>SHA-256</dt><dd><code>{artifact.sha256}</code></dd></div>}
                    </dl>
                  </details>
                </div>
              ))}
          </section>}
          {relationGroups.length > 0 && <section className="side-block relation-block">
            <h2 className="section-kicker"><Link2 size={14} /> Related questions</h2>
            {relationGroups.map((group) => (
                <div className="relation-group" key={group.label}>
                  {group.label !== 'Related questions' && <span>{group.label}</span>}
                  {group.ids.map((id) => {
                    const target = problems.find((candidate) => candidate.id === id);
                    return (
                      <a className="relation-link" href={questionHref(id)} key={id} onClick={(event) => onNavigate(event, id)}>
                        <span>{target?.title ?? id}</span>
                        <ArrowUpRight size={13} />
                      </a>
                    );
                  })}
                </div>
              ))}
          </section>}
          <details className="disclosure record-details">
            <summary>Record details <ChevronDown size={14} aria-hidden="true" /></summary>
            <h3>Verification</h3>
            <dl className="metadata-list">
              <div><dt>Mathematical status</dt><dd>{statusLabels[problem.status.public_mathematical_status]}</dd></div>
              <div><dt>Public verification</dt><dd>{verificationLabels[verification]}</dd></div>
              <div><dt>Peer review</dt><dd>{peerReviewLabels[review]}</dd></div>
              <div><dt>Disclosure</dt><dd>{readableEnum(problem.status.disclosure)}</dd></div>
              {hasLean && <>
                <div><dt>Lean status</dt><dd>{readableEnum(problem.lean.status)}</dd></div>
                <div><dt>Lean source in repository</dt><dd>{problem.lean.available_in_repo ? 'Available' : 'Unavailable'}</dd></div>
                {leanFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </>}
            </dl>
            <h3>Classification</h3>
            <dl className="metadata-list">
              <div><dt>Primary</dt><dd><ClassificationPath id={problem.classification.primary} /></dd></div>
              {problem.classification.secondary.length > 0 && <div><dt>Related topics</dt><dd className="taxonomy-path-list">{problem.classification.secondary.map((id) => <ClassificationPath id={id} key={id} />)}</dd></div>}
            </dl>
            {problem.classification.tags.length > 0 && <div className="tag-cloud">{problem.classification.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
            <h3>Record</h3>
            <dl className="metadata-list">
              <div><dt>ID</dt><dd>{problem.id}</dd></div>
              <div><dt>Group</dt><dd>{problem.group_id}</dd></div>
              <div><dt>Source kind</dt><dd>{sourceKindLabels[problem.source.kind]}</dd></div>
              {problem.source.provenance?.origin_status === 'confirmed' && problem.source.provenance.note && <div><dt>Provenance</dt><dd>{problem.source.provenance.note}</dd></div>}
            </dl>
          </details>
        </aside>
      </div>
    </div>
  );
}

export default ProblemExplorer;

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnalysisResult, AnalysisSource, CipherVariant } from './types';
import { AttackTable, attackRows, attackBlocks, type AttackRow } from './AttackTable';
import { StructuralTable } from './StructuralTable';
import { countLabel } from './copy';
import { isCostResult, methodLabel, methodLabels, publicationsForResult, RESULT_PAGE_SIZE, resultFilterKeys, type AttackSurface, type ResultFamilyView } from './model';

const collections = [
  { id: 'algorithmic', surface: 'algorithmic', label: 'Classical Cryptanalysis' },
  { id: 'quantum', surface: 'algorithmic', label: 'Quantum Cryptanalysis' },
  { id: 'side_channel', surface: 'side_channel', label: 'Side-Channel Analysis' },
  { id: 'fault_injection', surface: 'fault_injection', label: 'Fault-Injection Analysis' },
] as const;
type ResultCollection = typeof collections[number]['id'];

export interface ResultSection {
  id: string;
  surface: AttackSurface;
  collection: ResultCollection;
  category: string;
  label: string;
  structural: boolean;
  rows: AttackRow[];
}

const methodOrder = Object.keys(methodLabels);

/** One page, no model tabs. Quantum algorithms share a collection, not a cost-ranking scope. */
export function resultSections(views: ResultFamilyView[], query = ''): ResultSection[] {
  const sections = new Map<string, ResultSection>();
  for (const row of attackRows(views, query)) {
    const record = row.view.records[0];
    const structural = !isCostResult(record);
    const method = record.display.method;
    const surface = record.setting.attack_surface;
    const quantum = record.setting.computation === 'quantum';
    const collection: ResultCollection = surface === 'algorithmic' && quantum ? 'quantum' : surface;
    const category = structural ? 'structural' : method;
    // Quantum-assisted physical attacks retain their surface and a separate table.
    const physicalQuantum = surface !== 'algorithmic' && quantum;
    const id = `${collection}-${physicalQuantum ? 'quantum-' : ''}${category}`;
    const section = sections.get(id) ?? {
      id, surface, collection, category, structural,
      label: `${physicalQuantum ? 'Quantum · ' : ''}${structural ? 'Structural Properties & Bounds' : methodLabel(method, surface)}`, rows: [],
    };
    section.rows.push(row);
    sections.set(id, section);
  }
  const rank = (section: ResultSection) => section.structural ? methodOrder.length : methodOrder.indexOf(section.category);
  const collectionOrder = collections.map(collection => collection.id);
  return [...sections.values()].sort((a, b) => collectionOrder.indexOf(a.collection) - collectionOrder.indexOf(b.collection)
    || rank(a) - rank(b) || a.label.localeCompare(b.label));
}

type SectionTableProps = {
  section: ResultSection; sources: AnalysisSource[]; variant: CipherVariant; params: URLSearchParams;
  selected: string[]; onToggle: (id: string) => void; renderStructural: (record: AnalysisResult) => ReactNode;
};

function SectionTable({ section, sources, variant, params, selected, onToggle, renderStructural }: SectionTableProps) {
  const [requestedPage, setPage] = useState(1);
  const blocks = attackBlocks(section.rows);
  const pageCount = Math.max(1, Math.ceil(blocks.length / RESULT_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const offset = (page - 1) * RESULT_PAGE_SIZE;
  const rows = blocks.slice(offset, offset + RESULT_PAGE_SIZE).flatMap(block => block.rows);
  const label = `${collections.find(collection => collection.id === section.collection)!.label} · ${section.label}`;
  const changePage = (next: number) => {
    setPage(next);
    document.getElementById(`result-section-${section.id}`)?.scrollIntoView({ block: 'start' });
  };
  return <>
    {section.structural ? <StructuralTable rows={rows} sources={sources} variant={variant} params={params} renderStatement={renderStructural} />
      : <AttackTable rows={rows} sources={sources} variant={variant} params={params} selected={selected} onToggle={onToggle} />}
    {pageCount > 1 && <nav className="a-pagination" aria-label={`${label} pagination`}>
      <span>Results {offset + 1}–{Math.min(offset + RESULT_PAGE_SIZE, blocks.length)} of {blocks.length}</span>
      <div><button className="a-icon-button" aria-label={`Previous ${label} page`} disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={17} aria-hidden="true" /></button>
        <span>Page {page} of {pageCount}</span>
        <button className="a-icon-button" aria-label={`Next ${label} page`} disabled={page >= pageCount} onClick={() => changePage(page + 1)}><ChevronRight size={17} aria-hidden="true" /></button></div>
    </nav>}
  </>;
}

export function ResultSections({ views, ...props }: Omit<SectionTableProps, 'section'> & { views: ResultFamilyView[] }) {
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const sections = resultSections(views, props.params.get('q') || '');
  const visibleCollections = collections.filter(collection => sections.some(section => section.collection === collection.id));
  const pagingKey = [...resultFilterKeys.map(key => props.params.get(key)), props.params.get('sort')].join('|');
  const toggle = (id: string) => setOpened(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return <div className="a-result-sections">
    <div className="a-section-controls"><button className="a-text-button" disabled={sections.every(section => opened.has(section.id))} onClick={() => setOpened(new Set(sections.map(section => section.id)))}>Expand all</button>
      <button className="a-text-button" disabled={!sections.some(section => opened.has(section.id))} onClick={() => setOpened(new Set())}>Collapse all</button></div>
    {visibleCollections.map(collection => <section key={collection.id} className="a-surface-results" data-attack-surface={collection.surface} data-result-collection={collection.id} aria-label={collection.label}>
      <h3 className="a-surface-heading">{collection.label}</h3>
      {sections.filter(section => section.collection === collection.id).map(section => {
      const open = opened.has(section.id);
      const paperCount = publicationsForResult({ evidence: section.rows.flatMap(row => row.view.records.flatMap(record => record.evidence)) }, props.sources).length;
      return <section key={section.id} className={`a-result-section${section.structural ? ' a-structural-section' : ''}`} data-section-id={section.id} data-method-category={section.category} id={`result-section-${section.id}`} aria-labelledby={`result-section-heading-${section.id}`}>
        <h4 className="a-result-section-heading" id={`result-section-heading-${section.id}`}><button className="a-result-section-toggle" aria-expanded={open} aria-controls={`result-section-body-${section.id}`} onClick={() => toggle(section.id)}>
          <ChevronDown size={17} aria-hidden="true" /><span>{section.label}</span><span className="a-result-section-count"><span>{countLabel(attackBlocks(section.rows).length, 'result')}</span><span className="a-count-separator" aria-hidden="true"> · </span><span>{countLabel(paperCount, 'paper')}</span></span>
        </button></h4>
        <div id={`result-section-body-${section.id}`} className="a-result-section-body" hidden={!open}>
          <SectionTable key={pagingKey} section={section} {...props} />
        </div>
      </section>;
      })}
    </section>)}
  </div>;
}

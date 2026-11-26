import {useEffect, useId, useRef, useState} from 'react';
import {ArrowDown, ChevronDown, ChevronUp, Download, Maximize2} from 'lucide-react';
import {useLocale} from '../../app/locale';
import {titleCaseLabel} from '../../app/interface-labels';
import Modal from '../../components/Modal';
import {MathText} from '../../components/MathText';
import {primitiveCatalog, primitiveStructures} from './data';
import {parameterRows, structureBinding} from './model';
import './structures.css';

const copy = {
  en: {structure: 'Structure', expand: 'Enlarge', expandLabel: 'Enlarge diagram',
    collapse: 'Collapse', collapseLabel: 'Collapse structure', show: 'Show', showLabel: 'Show structure', parameters: 'Instance Parameters',
    sources: 'Sources', specification: 'Specification', design: 'Design Reference', close: 'Close diagram',
    svg: 'Download SVG', tex: 'Download LaTeX', jump: 'Results', jumpLabel: 'Jump to results', zoom: 'Zoom in', reset: 'Fit to view',
    pending: 'Diagram pending', error: 'Diagram unavailable',
    gallery: 'Drawing Conventions', instanceNote: 'Instance Note', scroll: 'Scroll horizontally'},
  zh: {structure: '结构', expand: '放大', expandLabel: '放大结构图',
    collapse: '收起', collapseLabel: '收起结构', show: '显示', showLabel: '显示结构', parameters: '实例参数',
    sources: '来源', specification: '规范', design: '设计资料', close: '关闭结构图',
    svg: '下载 SVG', tex: '下载 LaTeX', jump: '结果', jumpLabel: '跳至分析结果', zoom: '放大', reset: '适应窗口',
    pending: '结构图待补充', error: '结构图加载失败',
    gallery: '绘图表达参考', instanceNote: '实例说明', scroll: '横向滚动'},
};

export function StructurePanel({familyId, instanceId, resultsId}: {familyId: string; instanceId?: string; resultsId?: string}) {
  const {locale} = useLocale(), t = copy[locale];
  const id = useId();
  const [viewId, setViewId] = useState('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [failedAsset, setFailedAsset] = useState<string>();
  const viewport = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setOverflowing(element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const image = element.querySelector('img');
    if (image) observer.observe(image);
    measure();
    return () => observer.disconnect();
  }, [familyId, instanceId, viewId, collapsed, failedAsset]);
  const binding = structureBinding(primitiveStructures, familyId, instanceId, viewId);
  if (!binding) return <aside className="atlas-structure-pending"><p>{t.pending}</p></aside>;
  const {definition, view, asset} = binding;
  const viewLabel = locale === 'en' ? titleCaseLabel(view.label.en) : view.label.zh;
  const instance = primitiveCatalog.instances.find(i => i.id === instanceId && i.family_id === familyId);
  const family = primitiveCatalog.primitives.find(p => p.id === familyId)!;
  const target = instanceId ?? familyId;
  const url = import.meta.env.BASE_URL + asset.asset;
  const compactAsset = view.id === 'overview' ? primitiveStructures.manifest.assets.find(a => a.target_id === target && a.view_id === 'overview-compact') : undefined;
  const texUrl = import.meta.env.BASE_URL + asset.tex;
  const name = instance?.name ?? family.name;
  const parameters = instance ? parameterRows(instance, locale) : [];
  const jump = () => {
    const destination = resultsId ? document.getElementById(resultsId) : null;
    destination?.focus({preventScroll: true}); destination?.scrollIntoView({block: 'start'});
  };
  const figure = <img src={url} width={asset.width} height={asset.height}
    alt={`${name} · ${viewLabel}. ${view.caption[locale]}`} decoding="async"
    onError={() => setFailedAsset(url)} />;
  const downloads = <><a href={url} download={`${target}-${view.id}.svg`}><Download size={14} aria-hidden="true" />{t.svg}</a>
    <a href={texUrl} download={`${target}-${view.id}.tex`}>{t.tex}</a></>;
  const multipleViews = definition.views.length > 1;
  const enlargeButton = <button type="button" className="atlas-structure-enlarge" aria-label={t.expandLabel} onClick={() => {setExpanded(true); setZoomed(false);}}>
    <Maximize2 size={14} aria-hidden="true" /><span>{t.expand}</span>
  </button>;
  return <section className={`atlas-structure${multipleViews ? '' : ' is-single-view'}`} aria-labelledby={`${id}-heading`} data-structure-target={target}>
    <header className="atlas-structure-heading">
      <h2 id={`${id}-heading`}>{t.structure}</h2>
      <div className="atlas-structure-actions">
        {resultsId && <button type="button" onClick={jump} aria-label={t.jumpLabel}><ArrowDown size={14} aria-hidden="true" />{t.jump}</button>}
        {!multipleViews && !collapsed && enlargeButton}
        <button type="button" aria-label={collapsed ? t.showLabel : t.collapseLabel} aria-expanded={!collapsed} aria-controls={`${id}-body`} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}<span>{collapsed ? t.show : t.collapse}</span>
        </button>
      </div>
    </header>
    <div id={`${id}-body`} hidden={collapsed}>
      {multipleViews && <div className="atlas-structure-toolbar">
        <div role="tablist" aria-label={t.structure} className="atlas-structure-tabs">{definition.views.map((entry, index) =>
          <button type="button" role="tab" key={entry.id} id={`${id}-${entry.id}-tab`} aria-selected={entry.id === view.id}
            aria-controls={`${id}-${entry.id}-panel`} tabIndex={entry.id === view.id ? 0 : -1}
            onClick={() => setViewId(entry.id)} onKeyDown={event => {
              const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
              if (!direction && !['Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? definition.views.length - 1
                : (index + direction + definition.views.length) % definition.views.length;
              setViewId(definition.views[next].id);
              document.getElementById(`${id}-${definition.views[next].id}-tab`)?.focus();
            }}>{locale === 'en' ? titleCaseLabel(entry.label.en) : entry.label.zh}</button>)}</div>
        {enlargeButton}
      </div>}
      {definition.views.map(entry => <div key={entry.id} role={multipleViews ? 'tabpanel' : 'group'} id={`${id}-${entry.id}-panel`}
        aria-labelledby={multipleViews ? `${id}-${entry.id}-tab` : `${id}-heading`} tabIndex={0} hidden={entry.id !== view.id}>
        {entry.id === view.id && <div className={`atlas-structure-layout${instance ? '' : ' is-family'}`}>
          <figure className={`atlas-structure-figure is-${view.id}`}>
            <div ref={viewport} className="atlas-structure-image" tabIndex={view.id === 'detail' ? 0 : undefined} role="group" aria-label={viewLabel}>
              {failedAsset === url ? <p role="status">{t.error}</p> : compactAsset ? <picture>
                <source media="(max-width: 760px)" srcSet={import.meta.env.BASE_URL + compactAsset.asset} />{figure}
              </picture> : figure}
            </div>
            {view.id === 'detail' && overflowing && <p className="atlas-structure-scroll-hint">{t.scroll}</p>}
            <figcaption><MathText text={view.caption[locale]} /></figcaption>
          </figure>
          {instance && <aside className="atlas-structure-parameters" aria-label={t.parameters}>
            <h3 className="sr-only">{t.parameters}</h3>
            <dl>{parameters.map(p => <div key={p.key}><dt>{p.label}</dt><dd>{p.value}</dd></div>)}</dl>
            {instance.note && <p className="atlas-structure-instance-note" lang="en"><span className="sr-only">{t.instanceNote}: </span>{instance.note}</p>}
          </aside>}
        </div>}
      </div>)}
      <details className="atlas-structure-sources"><summary>{t.sources}</summary>
        <p lang="en">{definition.locator}</p>
        <ul>{definition.specification_ids.map(sourceId => {
          const source = primitiveCatalog.specifications.find(s => s.id === sourceId)!;
          return <li key={sourceId}><span>{t.specification}: </span><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · <span lang="en">{source.edition}</span></li>;
        })}{definition.design_source_ids.map(sourceId => {
          const source = primitiveStructures.registry.design_sources.find(s => s.id === sourceId)!;
          return <li key={sourceId}><span>{t.design}: </span><a href={source.url} target="_blank" rel="noreferrer" lang="en">{source.title}</a><p lang="en">{source.locator}</p></li>;
        })}</ul>
        <p>{t.gallery}: <a href={primitiveStructures.registry.style_reference.url} target="_blank" rel="noreferrer">TikZ for Cryptographers · Jérémy Jean</a></p>
        <div className="atlas-structure-downloads">{downloads}</div>
      </details>
    </div>
    {expanded && <Modal title={`${name} · ${viewLabel}`} description={view.caption[locale]} closeLabel={t.close}
      onClose={() => setExpanded(false)} footer={<div className="atlas-structure-downloads">{downloads}
        <button type="button" onClick={() => setZoomed(!zoomed)} aria-pressed={zoomed}>{zoomed ? t.reset : t.zoom}</button></div>}>
      <div className={`atlas-structure-zoom${zoomed ? ' is-zoomed' : ''}`} tabIndex={0} aria-label={t.structure}>{figure}</div>
    </Modal>}
  </section>;
}

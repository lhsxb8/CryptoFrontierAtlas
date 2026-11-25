import { useEffect, useLayoutEffect, useState } from 'react';
import { ArrowUpRight, Binary } from 'lucide-react';
import ProblemExplorer from '../features/questions/Explorer';
import { problems } from '../features/questions/data';
import { analysisEnabled, ciphers, resultPoints, variants } from '../features/cryptanalysis/data';
import { ResultsPage, ResultDetail, ComparePage } from '../features/cryptanalysis';
import { PortalPage, CipherDirectory, SourcesPage, CoveragePage, NotFound, PlannedCollection } from './atlas/pages';
import { PrimitivePage } from '../features/primitives/pages';
import { primitiveCatalog } from '../features/primitives/data';
import { directoryRoutes } from '../features/primitives/model';
import { appVersion } from './version';
import { parseHash, routeHref, routeScopeParams, variantLabel } from './atlas/model';
import HeaderTools from './HeaderTools';
import PrimaryNavigation from './PrimaryNavigation';
import { useLocale } from './locale';
import { REPOSITORY_URL } from './reporting';
import '../features/cryptanalysis/atlas.css';
import './header-tools.css';

const navigation = [
  { path: '/', label: 'home', section: 'home' },
  { path: '/questions', label: 'questions', section: 'questions' },
  { path: '/cryptanalysis', label: 'analysis', section: 'analysis' },
  { path: '/asymmetric-cryptanalysis', label: 'asymmetric', section: 'asymmetric' },
  { path: '/implementation', label: 'implementation', section: 'implementation' },
] as const;
const routeInstances = directoryRoutes(primitiveCatalog, variants);
const parseRoute = (hash: string) => parseHash(hash, routeInstances, variants);

export default function App() {
  const { text } = useLocale();
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);

  useEffect(() => {
    if (route.page === 'not-found') return;
    const canonical = routeHref(route.path, route.params);
    if (window.location.hash !== canonical) window.history.replaceState(window.history.state, '', canonical);
  }, [route]);

  const onParamsChange = (params: URLSearchParams, replace = false) => {
    const next = routeHref(route.path, params);
    if (next === window.location.hash) return;
    if (replace) window.history.replaceState(window.history.state, '', next);
    else window.history.pushState(window.history.state, '', next);
    setRoute(parseRoute(next));
  };

  useLayoutEffect(() => {
    // ProblemExplorer preserves the original question-list focus/scroll contract.
    if (route.page !== 'questions') {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
    }
    const active = document.querySelector<HTMLElement>('.atlas-section-bar [aria-current="page"]');
    const navigation = active?.parentElement;
    if (active && navigation) {
      const link = active.getBoundingClientRect(), viewport = navigation.getBoundingClientRect();
      // Reveal the current tab horizontally without changing the question explorer's scroll position.
      navigation.scrollLeft += link.left < viewport.left ? link.left - viewport.left
        : link.right > viewport.right ? link.right - viewport.right : 0;
    }
  }, [route.path, route.page]);

  useEffect(() => {
    const title = route.page === 'questions' && route.id ? problems.find(problem => problem.id === route.id)?.title
      : route.page === 'result' && route.id ? resultPoints.find(result => result.id === route.id)?.title
        : route.page === 'cipher' ? primitiveCatalog.primitives.find(p => p.id === route.cipherId)?.name ?? ciphers.find(cipher => cipher.id === route.cipherId)?.name
          : route.page === 'instance' ? primitiveCatalog.instances.find(i => i.id === route.variantId && i.family_id === route.cipherId)?.name ?? variants.filter(variant => variant.id === route.variantId && variant.family === route.cipherId).map(variantLabel)[0]
          : route.page === 'not-found' ? text.pageNotFound
            : ({ home: text.researchCollections, questions: text.questions, 'question-sources': text.questionCitations, ciphers: text.cipherDirectory, compare: text.compareResults, 'analysis-sources': text.analysisSources, coverage: text.coverage, asymmetric: text.asymmetric, implementation: text.implementation } as Record<string, string>)[route.page];
    document.title = `${title ?? text.recordNotFound} · CryptoFrontierAtlas`;
  }, [route.page, route.id, route.cipherId, route.variantId, text]);

  const pageProps = { searchParams: route.params, onParamsChange };
  const scientificTarget = analysisEnabled && ciphers.some(c => c.id === route.cipherId)
    && (!route.variantId || variants.some(v => v.id === route.variantId && v.family === route.cipherId));
  const content = route.page === 'questions' ? <ProblemExplorer problemId={route.id} {...pageProps} />
    : route.page === 'home' ? <PortalPage />
      : route.page === 'asymmetric' || route.page === 'implementation' ? <PlannedCollection collection={route.page} />
      : route.page === 'ciphers' ? <CipherDirectory {...pageProps} />
        : route.page === 'cipher' || route.page === 'instance' ? scientificTarget
          ? <ResultsPage cipherId={route.cipherId!} variantId={route.variantId} {...pageProps} />
          : <PrimitivePage cipherId={route.cipherId!} variantId={route.variantId} />
          : route.page === 'result' ? <ResultDetail id={route.id!} searchParams={route.params} />
            : route.page === 'compare' ? <ComparePage variantId={route.variantId} {...pageProps} />
              : route.page === 'question-sources' ? <SourcesPage collection="questions" {...pageProps} />
                : route.page === 'analysis-sources' ? <SourcesPage collection="analysis" id={route.id} {...pageProps} />
                  : route.page === 'coverage' ? <CoveragePage {...pageProps} /> : <NotFound />;
  const section = route.page === 'questions' || route.page === 'question-sources' ? 'questions'
    : ['ciphers', 'cipher', 'instance', 'result', 'compare', 'analysis-sources', 'coverage'].includes(route.page) ? 'analysis' : route.page;
  const scopeParams = routeScopeParams(route, ciphers, variants, resultPoints);
  const sectionNavigation = section === 'questions' ? [
    { label: text.questionIndex, href: '#/questions', active: route.page === 'questions' },
    { label: text.questionCitations, href: '#/questions/sources', active: route.page === 'question-sources' },
  ] : section === 'analysis' ? [
    { label: text.cipherDirectory, href: '#/cryptanalysis', active: ['ciphers', 'cipher', 'instance', 'result', 'compare'].includes(route.page) },
    ...(analysisEnabled ? [
      { label: text.analysisSources, href: routeHref('/cryptanalysis/sources', scopeParams), active: route.page === 'analysis-sources' },
      { label: text.coverage, href: routeHref('/cryptanalysis/coverage', scopeParams), active: route.page === 'coverage' },
    ] : []),
  ] : [];

  return <div className="app-shell atlas-shell">
    <a className="atlas-skip-link" href="#atlas-main" onClick={event => { event.preventDefault(); document.getElementById('atlas-main')?.focus(); }}>{text.skip}</a>
    <header className="atlas-header"><div className="atlas-header-inner">
      <a className="brand" href="#/" aria-label={`CryptoFrontierAtlas ${text.home}`}><span className="brand-mark"><Binary size={20} strokeWidth={2.2} /></span><span>CryptoFrontierAtlas</span></a>
      <PrimaryNavigation routeKey={route.path} entries={navigation.map(item => ({href: '#' + item.path, label: text[item.label], active: section === item.section, planned: ['asymmetric', 'implementation'].includes(item.section)}))} />
      <HeaderTools />
    </div></header>
    {sectionNavigation.length > 0 && <div className={'atlas-section-bar is-' + section}><nav aria-label={text.collectionNavigation}>{sectionNavigation.map(item => <a key={item.href} href={item.href} className={item.active ? 'is-active' : ''} aria-current={item.active ? 'page' : undefined}>{item.label}</a>)}</nav></div>}
    <main id="atlas-main" tabIndex={-1} lang={section === 'questions' || scientificTarget || analysisEnabled && ['result', 'compare', 'analysis-sources', 'coverage'].includes(route.page) ? 'en' : undefined}>{content}</main>
    <footer className="atlas-footer"><div><strong>CryptoFrontierAtlas</strong><span>v{appVersion}</span></div>{REPOSITORY_URL && <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">{text.repository} <ArrowUpRight size={13} /></a>}</footer>
  </div>;
}

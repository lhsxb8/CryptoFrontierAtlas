import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { MathText } from '../../components/MathText';
import { useLocale } from '../../app/locale';
import { routeHref } from '../../app/atlas/model';
import { primitiveCatalog } from './data';
import { directoryPath, hardProblemParameterRows, hardProblemPath, primitivePath } from './model';
import { problemAnalyses } from '../cryptanalysis/data';
import { ProblemAnalysisSection } from '../cryptanalysis/ProblemAnalysis';

export function HardProblemPage({id}: {id: string}) {
  const {locale, text} = useLocale();
  const problem = primitiveCatalog.hard_problems.find(p => p.id === id);
  const analysis = problemAnalyses.find(c => c.problem_id === id);
  const directoryHref = routeHref(directoryPath('asymmetric'));
  if (!problem) return <section className="atlas-page atlas-unavailable">
    <h1 tabIndex={-1}>{text.recordNotFound}</h1><a href={directoryHref}>{text.asymmetric}</a>
  </section>;
  return <section className="atlas-page atlas-problem-page">
    <a className="atlas-text-link" href={directoryHref}><ArrowLeft size={15} aria-hidden="true" />{text.asymmetric}</a>
    <div className="atlas-page-heading"><h1 tabIndex={-1} lang="en">{problem.name}</h1></div>
    <div className="atlas-problem-layout">
      <section className="atlas-problem-definition"><h2>{text.problemDefinition}</h2>
        <p lang="en"><MathText text={problem.statement} /></p>
        <h2>{text.problemFormulations}</h2>
        <dl className="atlas-problem-formulations">{problem.formulations.map(formulation => <div key={formulation.kind}>
          <dt>{formulation.kind === 'search' ? text.searchFormulation : text.decisionFormulation}</dt>
          <dd lang="en"><MathText text={formulation.description} /></dd>
        </div>)}</dl>
        <h2>{text.problemScope}</h2>
        {problem.qualifications.map(note => <p key={note} lang="en"><MathText text={note} /></p>)}
      </section>
      <section className="atlas-problem-parameters"><h2>{text.problemParameters}</h2>
        <dl className="atlas-metadata">{hardProblemParameterRows(problem, locale).map(parameter => <div key={parameter.key}>
          <dt>{parameter.label}</dt><dd lang="en"><MathText text={parameter.value} /></dd>
        </div>)}</dl>
      </section>
    </div>
    {analysis && <ProblemAnalysisSection key={id} catalog={analysis} />}
    {problem.related_scheme_ids.length > 0 && <section className="atlas-problem-related"><h2>{text.relatedSchemes}</h2>
      <div className="atlas-primitive-navigation">{problem.related_scheme_ids.map(schemeId => <a key={schemeId} href={routeHref(primitivePath('asymmetric', schemeId))}>
        {primitiveCatalog.primitives.find(p => p.id === schemeId)!.name}
      </a>)}</div>
    </section>}
    {problem.related_problem_ids.length > 0 && <section className="atlas-problem-related"><h2>{text.relatedProblems}</h2>
      <div className="atlas-primitive-navigation">{problem.related_problem_ids.map(problemId => <a key={problemId} href={routeHref(hardProblemPath(problemId))}>
        {primitiveCatalog.hard_problems.find(p => p.id === problemId)!.name}
      </a>)}</div>
    </section>}
    <section className="atlas-primitive-specs"><h2>{text.problemReferences}</h2>
      {problem.references.map(reference => {
        const source = primitiveCatalog.problem_sources.find(s => s.id === reference.source_id)!;
        return <article className="atlas-source-card" key={source.id} lang="en">
          <h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} <ArrowUpRight size={13} aria-hidden="true" /></a></h3>
          <p>{source.authors.join(', ')} · {source.year}</p>
          <p>{reference.locator}</p><p className="atlas-subtle">{source.edition}</p>
        </article>;
      })}
    </section>
  </section>;
}

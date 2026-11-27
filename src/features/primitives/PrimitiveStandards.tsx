import {Globe, ChevronDown, ArchiveX, Landmark, FileCheck2, ArrowUpRight} from 'lucide-react';
import {useLocale} from '../../app/locale';
import {primitiveCatalog} from './data';
import {standardsForTarget, type StandardMatch} from './standards';
import './standards.css';

type BadgeKind = 'international' | 'national' | 'recommendation' | 'historical';
const kindOf = ({standard, specification}: StandardMatch): BadgeKind => specification.status === 'withdrawn' ? 'historical'
  : standard.document_type === 'recommendation' ? 'recommendation' : standard.level;
const kinds: BadgeKind[] = ['international', 'national', 'recommendation', 'historical'];
const badgeLabels = {
  zh: {international: '国际标准', national: '国家标准', recommendation: '国家机构推荐规范', historical: '已撤销标准'},
  en: {international: 'International Standard', national: 'National Standard', recommendation: 'National Recommendation', historical: 'Withdrawn Standard'},
};

export function StandardBadges({matches, total}: {matches: StandardMatch[]; total: number}) {
  const {locale} = useLocale();
  if (!matches.length) return null;
  const selected = kinds.filter(kind => matches.some(match => kindOf(match) === kind));
  return <span className="atlas-standard-badges">{selected.map(kind => {
    const group = matches.filter(match => kindOf(match) === kind);
    const count = new Set(group.flatMap(match => match.instanceIds)).size;
    const Icon = {international: Globe, national: Landmark, recommendation: FileCheck2, historical: ArchiveX}[kind];
    const partial = total > count;
    const title = `${badgeLabels[locale][kind]}: ` + group.map(match => match.standard.designation).join(' · ')
      + (partial ? (locale === 'zh' ? `；覆盖 ${count}/${total} 个实例` : `; covers ${count}/${total} instances`) : '');
    return <span className={`atlas-standard-badge is-${kind}`} data-standard-kind={kind} key={kind} role="img" aria-label={title} title={title}>
      <Icon size={15} strokeWidth={1.7} aria-hidden="true" />
    </span>;
  })}</span>;
}

/** The collapsed source panel keeps badges verifiable without adding prose to every card. */
export function PrimitiveStandards({familyId, instanceId}: {familyId: string; instanceId?: string}) {
  const {locale} = useLocale();
  const {matches, total} = standardsForTarget(primitiveCatalog, familyId, instanceId);
  if (!matches.length) return null;
  return <details className="atlas-standard-panel">
    <summary><StandardBadges matches={matches} total={total} /><ChevronDown size={14} aria-hidden="true" />
      <span className="sr-only">{locale === 'zh' ? '标准依据' : 'Standardization Evidence'}</span></summary>
    <div className="atlas-standard-evidence">
      {matches.map(({standard, specification, bindings, instanceIds}) => <article key={standard.specification_id}>
        <h2><a href={specification.url} target="_blank" rel="noreferrer">{standard.designation}<ArrowUpRight size={13} aria-hidden="true" /></a></h2>
        <p>{badgeLabels[locale][standard.document_type === 'recommendation' ? 'recommendation' : standard.level]}
          {' · '}{standard.authority}{standard.jurisdiction ? ` · ${standard.jurisdiction}` : ''}
          {specification.status === 'withdrawn' && <span className="atlas-status-warning"> · {locale === 'zh' ? '已撤销' : 'Withdrawn'} {specification.withdrawn_on}</span>}</p>
        {!instanceId && <p>{locale === 'zh' ? '适用实例：' : 'Covered Instances: '}
          {instanceIds.map(id => primitiveCatalog.instances.find(instance => instance.id === id)?.name ?? id).join(', ')}</p>}
        {bindings.map((binding, index) => <div key={index}>
          {binding.role === 'component' && <span className="atlas-standard-component">{locale === 'zh' ? '标准中的组成部件' : 'Standardized Component'}</span>}
          <p lang="en">{binding.locator}</p>{binding.note && <p lang="en">{binding.note}</p>}
        </div>)}
      </article>)}
      <p className="atlas-standard-check">{locale === 'zh' ? '核查日期：' : 'Checked: '}{primitiveCatalog.standardization?.checked_on}
        {' · '}{locale === 'zh' ? '标准收录不等于安全性背书。' : 'Standard inclusion is not a security endorsement.'}</p>
    </div>
  </details>;
}

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CipherVariant } from '../../features/cryptanalysis/types';
import { instanceGroups, variantLabel } from './model';

interface InstanceNavigationProps {
  variants: readonly CipherVariant[];
  href: (variant: CipherVariant) => string;
  activeId?: string;
  label?: string;
  className?: string;
  current?: 'page' | 'true';
}

function InstanceLinks({ variants, href, activeId, current = 'page' }: InstanceNavigationProps) {
  const { primary, others } = instanceGroups(variants);
  const activeOther = others.some(variant => variant.id === activeId);
  const [expanded, setExpanded] = useState(activeOther);
  const panelId = useId();
  const link = (variant: CipherVariant) => <a key={variant.id} className={variant.id === activeId ? 'is-active' : undefined}
    aria-current={variant.id === activeId ? current : undefined} href={href(variant)}>{variantLabel(variant)}</a>;
  return <div className="a-instance-groups">
    <div className="a-instance-main-links">{primary.map(link)}{others.length > 0 && <button type="button"
      className={`a-instance-others-toggle${activeOther ? ' is-active' : ''}`} aria-expanded={expanded} aria-controls={panelId}
      onClick={() => setExpanded(value => !value)}>Others <ChevronDown size={14} aria-hidden="true" /></button>}</div>
    {others.length > 0 && <div className="a-instance-other-links" id={panelId} hidden={!expanded}>{others.map(link)}</div>}
  </div>;
}

export function InstanceNavigation({ className = '', label = 'Cipher instances', ...props }: InstanceNavigationProps) {
  return <nav className={`a-instance-nav ${className}`.trim()} aria-label={label}>
    <InstanceLinks key={props.activeId ?? ''} {...props} />
  </nav>;
}

/** Native selects preserve exact instance values, including within Others. */
export function InstanceOptions({ variants }: { variants: readonly CipherVariant[] }) {
  const { primary, others } = instanceGroups(variants);
  const option = (variant: CipherVariant) => <option key={variant.id} value={variant.id}>{variantLabel(variant)}</option>;
  return <>{primary.map(option)}{others.length > 0 && <optgroup label={variants.some(variant => variant.family !== 'aes') ? 'AES · Others' : 'Others'}>
    {others.map(option)}
  </optgroup>}</>;
}

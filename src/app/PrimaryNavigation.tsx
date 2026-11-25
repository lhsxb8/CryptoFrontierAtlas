import {useEffect, useId, useRef, useState} from 'react';
import {Menu, X} from 'lucide-react';
import {useLocale} from './locale';
import './primary-navigation.css';

type Entry = {href: string; label: string; active: boolean; planned: boolean};

export default function PrimaryNavigation({entries, routeKey}: {entries: Entry[]; routeKey: string}) {
  const {text} = useLocale();
  const [open, setOpen] = useState(false);
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {setOpen(false);}, [routeKey]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1251px)');
    const restoreFocus = (focused: EventTarget | null) => {
      if (!media.matches && focused instanceof Node && nav.current?.contains(focused)) toggle.current?.focus();
      if (media.matches && focused === toggle.current) nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    };
    const resize = () => {
      setOpen(false);
      restoreFocus(document.activeElement);
    };
    const hiddenFocus = (event: FocusEvent) => {
      // CSS can hide a focused control before the media-query change event fires.
      if (!event.relatedTarget && event.target instanceof HTMLElement && !event.target.getClientRects().length) restoreFocus(event.target);
    };
    const element = container.current;
    element?.addEventListener('focusout', hiddenFocus);
    media.addEventListener('change', resize);
    return () => {
      element?.removeEventListener('focusout', hiddenFocus);
      media.removeEventListener('change', resize);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={container} className="atlas-navigation" data-open={open} onKeyDown={event => {
    if (event.key === 'Escape' && open) {event.preventDefault(); setOpen(false); toggle.current?.focus();}
  }}>
    <button ref={toggle} className="atlas-navigation-toggle" type="button" aria-label={text.primaryNavigation}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span>{entries.find(entry => entry.active)?.label ?? text.home}</span>
      {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
    </button>
    <nav ref={nav} id={id} className="atlas-primary-nav" aria-label={text.primaryNavigation}>
      {entries.map(entry => <a key={entry.href} href={entry.href} className={entry.active ? 'is-active' : ''}
        aria-current={entry.active ? 'page' : undefined} onClick={() => {
          setOpen(false);
          if (window.location.hash === entry.href && toggle.current?.getClientRects().length) toggle.current.focus();
        }}>{entry.label}{entry.planned && <span className="atlas-nav-tbd">TBD</span>}</a>)}
    </nav>
  </div>;
}

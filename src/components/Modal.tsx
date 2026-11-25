import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, description, closeLabel, onClose, children, footer }: {
  title: string; description?: string; closeLabel: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={ref} className="atlas-dialog" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;
      if (event.shiftKey && (active === first || !focusable.includes(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="atlas-dialog-surface">
      <header className="atlas-dialog-heading"><div><h2 id={`${id}-title`} tabIndex={-1} autoFocus>{title}</h2>{description && <p id={`${id}-description`}>{description}</p>}</div>
        <button type="button" className="atlas-dialog-close" aria-label={closeLabel} onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
      {children}
      {footer && <footer className="atlas-dialog-footer">{footer}</footer>}
    </div>
  </dialog>;
}

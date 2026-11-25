import { useEffect, useRef, useState } from 'react';

/** Read the rendered glyphs, not source-string length: a short TeX fraction can
 * be wider than a long source string. Each expression is mounted exactly once.
 */
function mathWidth(formula: Element): number {
  return Math.max(0, ...Array.from(formula.querySelectorAll('.katex-html')).map(html =>
    Array.from(html.children).reduce((width, atom) => width + atom.getBoundingClientRect().width, 0)));
}

export function useWideCosts(contentKey: string) {
  const container = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    let frame = 0;
    let alive = true;
    const measure = () => {
      const contents = new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-cost-content]'))
        .map(element => [element.dataset.costContent!, element]));
      const next = new Set<string>();
      for (const slot of root.querySelectorAll<HTMLElement>('[data-cost-slot]')) {
        if (!slot.clientWidth) continue;
        const key = slot.dataset.costSlot!;
        const content = contents.get(key);
        if (!content) continue;
        const expressions = content.querySelectorAll('.a-expression .a-formula, .a-success-value .a-formula, .a-case-label .a-formula');
        if (content.querySelectorAll('.a-success-case').length > 3
          || Array.from(expressions).some(formula => mathWidth(formula) > slot.clientWidth - 4)) next.add(key);
      }
      setWide(current => current.size === next.size && [...current].every(key => next.has(key)) ? current : next);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    window.addEventListener('resize', schedule);
    void document.fonts.ready.then(() => { if (alive) schedule(); });
    schedule();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [contentKey]);
  return { container, wide };
}

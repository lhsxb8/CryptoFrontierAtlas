/** Reader-facing counts; storage terms stay in the data model. */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function resultCounts(groups: number, results: number): string {
  return `${countLabel(groups, 'result')} · ${countLabel(results, 'reported point')}`;
}

/** Adapt organization suffixes in group headings; retain the stored title. */
export function resultGroupTitle(title: string): string {
  return title
    .replace(/\bparameter family$/i, 'parameterized results')
    .replace(/\bfamily$/i, 'results')
    .replace(/\bconfigurations$/i, 'parameter choices');
}

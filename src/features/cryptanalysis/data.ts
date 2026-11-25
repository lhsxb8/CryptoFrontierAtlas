import dataset from 'virtual:cryptanalysis-data';
import type { AnalysisResult } from './types';

// The build adapter supplies the selected dataset before bundling.
export const analysisEnabled = dataset.enabled;
export const analysisManifest = dataset.manifest;
export const ciphers = dataset.ciphers;
export const results = dataset.results;
export const compactResults = dataset.compactResults;
export const familyCatalogs = dataset.familyCatalogs;
// Detailed payloads win if a caller supplies both views of the same point.
const pointsById = new Map(results.map(result => [result.id, result]));
for (const result of compactResults) if (!pointsById.has(result.id)) pointsById.set(result.id, result);
export const resultPoints = [...pointsById.values()];
export const sources = dataset.sources;
export const variants = dataset.variants;
export const coverage = dataset.coverage;

const relatedResults = new Map<string, AnalysisResult[]>();
for (const result of resultPoints) {
  for (const reference of result.related_problem_ids) {
    const id = reference.replace(/^cryptofrontieratlas:/, '');
    const linked = relatedResults.get(id) ?? [];
    linked.push(result);
    relatedResults.set(id, linked);
  }
}

export function getRelatedResults(problemId: string): AnalysisResult[] {
  return relatedResults.get(problemId.replace(/^cryptofrontieratlas:/, '')) ?? [];
}

// The build adapter also selects the shared comparator for the loaded dataset.
export { comparability, compareReportedCosts } from 'virtual:cryptanalysis-comparison';

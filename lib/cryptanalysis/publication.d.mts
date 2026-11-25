import type { AnalysisSource } from '../../analysis-types';
export function publicationLabel(source: Pick<AnalysisSource, 'publication'> & Partial<Pick<AnalysisSource, 'eprint'>>): string;

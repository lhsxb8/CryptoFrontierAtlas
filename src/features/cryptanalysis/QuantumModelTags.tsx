import type { AnalysisResult } from './types';
import { quantumModelTags } from './quantum-model';

export function QuantumModelTags({ record }: { record: AnalysisResult }) {
  const tags = quantumModelTags(record);
  if (!tags.length) return null;
  return <div className="a-model-tags" aria-label="Quantum model">{tags.map(tag =>
    <span className={`a-model-tag a-model-tag-${tag.tone}`} key={tag.id} data-model-tag={tag.id} title={tag.description}>{tag.label}</span>)}</div>;
}

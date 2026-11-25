import type { AnalysisResult } from './types';

type QuantumModel = NonNullable<AnalysisResult['setting']['quantum_model']>;
type ModelTag = { id: string; label: string; description: string; tone: 'query' | 'coherent' | 'memory' | 'neutral' };

export const quantumQueryTags: Record<QuantumModel['query_model'], ModelTag> = {
  classically_known_pairs: { id: 'q1', label: 'Q1', tone: 'query', description: 'Quantum computation with classical target-oracle queries.' },
  coherent_secret_oracle: { id: 'q2', label: 'Q2', tone: 'coherent', description: 'Quantum computation with superposition access to the secret-key target oracle.' },
  offline_public_cipher_evaluation: { id: 'offline', label: 'Public function', tone: 'neutral', description: 'Offline quantum evaluation of a public function; no secret-key target oracle. Q1/Q2 does not describe this target.' },
};
export const quantumMemoryTags: Record<NonNullable<QuantumModel['memory_model']>, ModelTag> = {
  qram: { id: 'qram', label: 'qRAM', tone: 'memory', description: 'Coherent random access to the source-defined memory table. See the recorded assumptions for its contents and scope.' },
  qraqm: { id: 'qraqm', label: 'QRAQM', tone: 'memory', description: 'Quantum random access to quantum memory: the table stores quantum data.' },
  no_qram: { id: 'no-qram', label: 'No qRAM', tone: 'neutral', description: 'The recorded algorithm explicitly avoids qRAM; it may still use quantum workspace and classical storage.' },
};

/** Only reviewed structured fields grant badges. Prose, IDs and cost units do not. */
export function quantumModelTags(record: AnalysisResult): ModelTag[] {
  const model = record.setting.quantum_model;
  if (record.setting.computation !== 'quantum' || !model) return [];
  return [quantumQueryTags[model.query_model], ...(model.memory_model ? [quantumMemoryTags[model.memory_model]] : [])];
}

export function quantumModelValue(key: string, value: string): string {
  if (key === 'query_model' && value in quantumQueryTags) {
    const tag = quantumQueryTags[value as QuantumModel['query_model']];
    return `${tag.label}: ${tag.description}`;
  }
  if (key === 'memory_model' && value in quantumMemoryTags) {
    const tag = quantumMemoryTags[value as NonNullable<QuantumModel['memory_model']>];
    return `${tag.label}: ${tag.description}`;
  }
  return value;
}

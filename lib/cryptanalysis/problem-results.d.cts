export const goalLabels: {
  nontrivial_factor: string; complete_factorization: string; large_order_or_factor: string;
};
export function sectionFor(record: {result_kind: string; setting: {computation: string}}): 'records' | 'quantum' | 'classical';

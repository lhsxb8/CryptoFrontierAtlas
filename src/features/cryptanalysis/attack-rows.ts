import type { AnalysisResult } from './types';
import { isCostResult, modelSelectionId, type ResultFamilyView } from './model';

export interface AttackRow {
  /** A formula selection or an original, fully paired result ID. */
  id: string;
  view: ResultFamilyView;
  formula: boolean;
  blockId: string;
}

export interface AttackBlock {
  id: string;
  view: ResultFamilyView;
  rows: AttackRow[];
}

/** Object key order is not scientific content; array order is retained. */
export function presentationKey(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

// The catalog establishes the construction and its tuning-dependent descriptions.
// Access, key population, leakage and round boundaries still partition the display.
function identityScope(record: AnalysisResult): string {
  return presentationKey([
    { ...record.target, description: undefined }, record.goal, record.result_kind, record.display.method,
    { ...record.setting, plaintext_model: undefined, assumptions: undefined },
    record.experiment?.construction, record.experiment?.output,
    record.candidate_space && [record.candidate_space.material, record.candidate_space.material_bits],
  ]);
}

function reportedOutcome(record: AnalysisResult): string | undefined {
  // Unknown coordinates remain unknown. An unevaluated expression may depend on
  // each point's parameters even when its text is identical, so keep those apart.
  const reported = Object.values(record.resources).filter(resource => resource.status === 'reported');
  if (!reported.length || reported.some(resource => resource.reported === null || resource.log2 === null)
    || record.success.status !== 'reported' || record.success.value === null) return;
  return presentationKey([
    record.target, record.setting, record.resources, record.success, record.experiment,
    record.candidate_space, record.field_conflicts, record.assessment.claim_status,
    record.assessment.primary_text, record.assessment.reproduction,
    [...new Set(record.evidence.map(evidence => evidence.source_id))].sort(),
  ]);
}

/** Display grouping only: no deletion, dominance claim, rounding or cost synthesis. */
export function attackRows(views: ResultFamilyView[], query = ''): AttackRow[] {
  const terms = new Set(query.trim().toLowerCase().split(/\s+/));
  return views.flatMap<AttackRow>(view => {
    if (!view.records.length) return [];
    const exactPoint = view.records.some(record => terms.has(record.id.toLowerCase()));
    const scopes = new Map<string, AnalysisResult[]>();
    for (const record of view.records) {
      const key = view.family && isCostResult(record) && !exactPoint ? identityScope(record) : record.id;
      const members = scopes.get(key) ?? [];
      members.push(record);
      scopes.set(key, members);
    }
    return [...scopes.values()].flatMap<AttackRow>(members => {
      const scoped = { ...view, records: members };
      if (view.family?.model && isCostResult(members[0]) && !exactPoint && scopes.size === 1) {
        const id = modelSelectionId(view);
        return [{ id, blockId: id, view: scoped, formula: true }];
      }
      const blockId = members[0].id;
      const rows: AttackRow[] = [], outcomes = new Map<string, AttackRow>();
      for (const record of members) {
        const key = view.family && !exactPoint && isCostResult(record) ? reportedOutcome(record) : undefined;
        const existing = key === undefined ? undefined : outcomes.get(key);
        if (existing) existing.view.records.push(record);
        else {
          const row = { id: record.id, blockId, view: { ...view, records: [record] }, formula: false };
          rows.push(row);
          if (key !== undefined) outcomes.set(key, row);
        }
      }
      return rows;
    });
  });
}

/** Keep construction identities together, including across category page boundaries. */
export function attackBlocks(rows: AttackRow[]): AttackBlock[] {
  const blocks = new Map<string, AttackBlock>();
  for (const row of rows) {
    const block = blocks.get(row.blockId) ?? { id: row.blockId, view: { ...row.view, records: [] }, rows: [] };
    block.rows.push(row);
    block.view.records.push(...row.view.records);
    blocks.set(row.blockId, block);
  }
  return [...blocks.values()];
}

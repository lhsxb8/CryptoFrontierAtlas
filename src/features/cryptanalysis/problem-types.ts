import type { AnalysisModelParameter, AnalysisResource, AnalysisResult, AnalysisResultFamily } from './types';

export type ProblemResource = 'time' | 'memory' | 'classical_time' | 'quantum_calls' | 'gates_per_call' | 'logical_qubits' | 'oracle_calls' | 'wall_time' | 'energy';
export interface ProblemResult {
  schema_version: 1;
  id: string; title: string; method: string; statement: string;
  result_kind: 'algorithm' | 'supporting_result' | 'computation_record';
  goal: 'nontrivial_factor' | 'complete_factorization' | 'large_order_or_factor';
  target: {
    kind: 'hard_problem'; problem_id: 'integer-factorization';
    input_class: 'general_integer' | 'composite_integer' | 'balanced_semiprime' | 'special_integer' | 'almost_all_integers' | 'named_challenge';
    description: string; parameters: AnalysisModelParameter[]; modulus_bits: number | null; instance_name: string | null;
  };
  setting: {
    computation: 'classical' | 'quantum'; model: 'deterministic' | 'randomized' | 'quantum' | 'oracle_assisted' | 'measured_implementation';
    basis: 'proved' | 'conditional' | 'heuristic' | 'experiment'; input_access: 'public_integer';
    assumptions: string[]; auxiliary_information: string[]; memory_model?: 'qram' | 'qraqm' | 'no_qram';
  };
  resources: Record<'time' | 'memory', AnalysisResource> & Partial<Record<ProblemResource, AnalysisResource>>;
  success: AnalysisResult['success']; evidence: AnalysisResult['evidence']; field_conflicts?: AnalysisResult['field_conflicts'];
  assessment: {claim_status: 'author_reported' | 'source_conflict'; review_scope: 'targeted_primary_text'; reproduction: 'not_attempted'; reviewed_on: string; frontier_status: 'not_assessed'};
  experiment?: {date: string; hardware: string; software: string; parameters: string; reported_outcome: string; verification: 'source_report_only'};
  limitations: string[]; related_result_ids: string[];
}
export interface ProblemAnalysis {
  schema_version: 1; problem_id: string; reviewed_on: string; records: string[]; results: ProblemResult[];
  families: Omit<AnalysisResultFamily, 'model'>[]; standalone_result_ids: string[];
  coverage: {
    search_cutoff: string; comparison_as_of: string; selection: string; source_ids: string[];
    exhaustive: false; latest_or_best_known_claim: false; not_yet_covered: string[];
    exclusions: {source_id: string; locator: string; reason: string}[];
  };
}

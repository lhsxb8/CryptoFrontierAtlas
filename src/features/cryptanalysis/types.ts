/** Types preserve the analysis dataset's native, version-specific claims. */
import type { AnalysisGoal, AnalysisResultKind, AnalysisMethod, KeyModel, AttackSurface } from './taxonomy';
export type { AnalysisGoal, AnalysisResultKind, AnalysisMethod, KeyModel, AttackSurface } from './taxonomy';
export type ResourceStatus = 'reported' | 'qualitative' | 'not_reported' | 'not_applicable' | 'conflict';
export type ResourceDimension = 'time' | 'data' | 'memory' | 'preprocessing';
export type QuantumResourceDimension = 't_gates' | 'clifford_gates' | 't_depth' | 'circuit_depth' | 'logical_qubits';
export type PublicationKind = 'conference' | 'journal' | 'standard' | 'submission' | 'preprint';

export interface AnalysisModelParameter {
  name: string; meaning: string; domain: string | null; value: string | number | null;
}
export interface AnalysisExperiment {
  construction: { type: 'block_cipher' | 'compression_function'; name: string; definition: string; output_bits: number };
  variables: { name: string; control: 'fixed' | 'chosen' | 'random' | 'related' | 'derived' | 'not_reported'; domain: string | null; condition: string | null }[];
  relation: string;
  output: { scope: 'full' | 'partial' | 'unspecified'; bits: number | null; mask: string | null };
  parameters: AnalysisModelParameter[];
  distinctness: string | null;
  reference: string | null;
  unresolved: string[];
}
export interface AnalysisTheorem {
  statement: string; quantifier: string; metric: string; relation: '=' | '<' | '<=' | '>' | '>=';
  expression: string; parameters: AnalysisModelParameter[]; assumptions: string[];
}

export interface AnalysisResource {
  status: ResourceStatus;
  reported: string | null;
  log2: number | null;
  unit: string | null;
  qualifier: 'estimate' | 'upper_bound' | 'lower_bound' | 'exact' | 'unspecified' | 'not_applicable';
  relation?: '=' | '<' | '<=' | '>' | '>=';
  note: string;
}

export type ProbabilityBasis = 'author_statement' | 'author_model' | 'source_proof' | 'derived_from_source' | 'reported_experiment';
export interface SuccessProbabilityComponent {
  metric: string;
  value: number | null;
  relation?: '=' | '>' | '>=' | '<' | '<=';
  expression?: string;
  basis: ProbabilityBasis;
  description: string;
}

export interface AnalysisResult {
  schema_version: string;
  id: string;
  title: string;
  display: { name: string; method: AnalysisMethod };
  result_kind: AnalysisResultKind;
  goal: AnalysisGoal;
  experiment?: AnalysisExperiment;
  theorem?: AnalysisTheorem;
  property?: {
    statement: string;
    quantifier: string;
    scope: string;
    parameters: { name: string; reported: string; meaning: string }[];
    validation: { basis: 'analytical' | 'analytical_and_reported_experiment'; description: string };
  };
  candidate_space?: {
    material: string;
    material_bits: number;
    observations: {
      statistic: 'heuristic_mean' | 'sample_mean' | 'sample_maximum' | 'observed_values' | 'reported_estimate' | 'enumerated_mean' | 'enumerated_range';
      sample_count: number | null;
      count: AnalysisResource;
    }[];
  };
  target: {
    variant_ids: string[];
    rounds: number | null;
    full_round: boolean | null;
    round_domain?: { scope: 'registered_instance' | 'round_function_extension'; definition: string; variable: string; domain: string; minimum: number | null; maximum: number | null; step: number | null };
    round_convention: string;
    description: string;
  };
  setting: {
    key_model: KeyModel;
    oracle_access: string[];
    related_key_count: number | null;
    key_budget?: {
      reported: string;
      log2: number | null;
      unit: 'tested_related_key_pairs' | 'distinct_related_keys' | 'related_subkey_oracles';
      distinct_key_count: number | null;
      note: string;
    };
    target_selection?: 'designated_target' | 'any_from_pool' | 'conditional_weak_pair' | 'attacker_selected_pair' | 'fixed_known_key';
    reference_model?: string;
    key_relation: string;
    prior_key_knowledge?: { bits: number; material: string; cost_accounting: string };
    key_population: string;
    plaintext_model: string;
    computation: 'classical' | 'quantum';
    attack_surface: AttackSurface;
    quantum_model?: {
      query_model: 'classically_known_pairs' | 'coherent_secret_oracle' | 'offline_public_cipher_evaluation';
      cost_level: 'logical_circuit' | 'quantum_algorithm';
      gate_set: string; routing: string; error_correction: string;
      oracle_parallelism: string; solution_assumption: string;
    };
    fault_model?: {
      target: string; granularity: string; timing: string; location: string;
      value_control: string; sample_pairing: string;
      feedback?: string;
      evidence_scope: 'analytical' | 'software_example' | 'software_experiment' | 'hardware_proposal' | 'physical_experiment';
    };
    assumptions: string[];
  };
  techniques: string[];
  resources: Record<ResourceDimension, AnalysisResource> & Partial<Record<QuantumResourceDimension, AnalysisResource>>;
  success: {
    status: 'reported' | 'not_reported' | 'not_applicable';
    relation?: '=' | '>' | '>=' | '<' | '<=';
    metric: string;
    value: number | null;
    description: string;
    basis?: ProbabilityBasis;
    expression?: string;
    components?: SuccessProbabilityComponent[];
    review?: {
      status: 'verified' | 'not_quantified' | 'not_stated' | 'pending';
      reviewed_on: string;
      scope: string;
    };
  };
  bound: {
    metric: 'active_sboxes';
    relation: '>=';
    value: number;
    quantifier: string;
    scope: string;
  } | null;
  evidence: {
    source_id: string;
    locator: string;
    fields: string[];
    interpretation: string;
  }[];
  field_conflicts?: { field: string; label: string; description: string; observations: { source_id: string; locator: string; reported: string }[] }[];
  assessment: {
    claim_status: 'author_reported' | 'source_conflict';
    primary_text: 'checked' | 'not_recorded';
    reproduction: 'not_attempted' | 'collision_witness_only';
    reviewed_on: string;
    frontier_status: 'not_assessed';
  };
  /** Index review metadata; a targeted check is not a full-detail extraction. */
  compact_review?: {
    scope: string;
    decision: string;
    reviewed_on?: string;
    next_action?: string;
    issue_ids?: string[];
  };
  limitations: string[];
  related_problem_ids: string[];
}

/** Curated parameterization referencing, never replacing, the original points. */
export interface AnalysisResultFamily {
  id: string;
  title: string;
  display_name?: string;
  construction: string;
  representation: 'formula' | 'table';
  parameters: { name: string; meaning: string; domain: string; short_meaning?: string; short_domain?: string }[];
  points: { result_id: string; values: Record<string, string | number> }[];
  evidence: { source_id: string; locator: string }[];
  model?: {
    resources: Partial<Record<ResourceDimension | QuantumResourceDimension, { expression: string; unit: string; display_expression?: string | null; note?: string }>>;
    constraints: string[];
    display_constraints?: string[];
    success: string;
    accounting: string;
  };
}

export interface AnalysisFamilyCatalog {
  schema_version: 1;
  cipher_family_id: string;
  reviewed_on: string;
  families: AnalysisResultFamily[];
  standalone_result_ids: string[];
  /** Kept addressable by historical URLs, but excluded from default browsing. */
  excluded_results: { result_id: string; reason: string }[];
}

export interface AnalysisManifest {
  dataset_version: string;
  schema_version: string;
  reviewed_on: string;
  local_only: boolean;
  record_count: number;
  source_count: number;
  scope: string;
  verification_scope: string;
  records: string[];
}

export interface AnalysisSource {
  id: string;
  title: string;
  authors: string[];
  year: number;
  /** Curated alphabetic bibliography label, without surrounding brackets. */
  citation_label: string;
  /** Publication association, distinct from the exact inspected manuscript. */
  publication: { venue: string; year: number; event_year?: number; kind: PublicationKind; url: string };
  inspected_version: string;
  url: string;
  doi?: string;
  eprint?: string;
  accessed_on: string;
  content_sha256: string | null;
  hash_note: string;
  artifact_url?: string;
  artifact_sha256?: string;
  locators: string[];
}

export type PrimitiveType = 'block_cipher' | 'stream_cipher' | 'permutation' | 'hash_function' | 'aead' | 'other';

export interface CipherFamily {
  id: string;
  name: string;
  primitive_type: PrimitiveType;
  aliases: string[];
  description: string;
}

export interface CipherVariant {
  id: string;
  family: string;
  name?: string;
  key_bits?: number;
  block_bits?: number;
  full_rounds: number;
  specification_source: string;
}

export interface AnalysisCoverageIssue {
  id: string;
  status: string;
  affected_records: string[];
  evidence: string[];
  original_url?: string;
  action: string;
}

export interface AnalysisPendingSource {
  id: string;
  status: string;
  url: string;
  reason: string;
  reviewed_source_id?: string;
}

export interface AnalysisCoverage {
  reviewed_on: string;
  family_ids: string[];
  exhaustive: boolean;
  latest_or_best_known_claim: boolean;
  selection: string;
  included_counts: Record<string, number>;
  review_process: Record<string, string>;
  issues: AnalysisCoverageIssue[];
  pending_sources: AnalysisPendingSource[];
  not_yet_covered: string[];
  ingestion_batches?: {
    id: string;
    reviewed_on: string;
    new_records: string[];
    indexed_existing_records: string[];
    note: string;
  }[];
}

export interface AnalysisDataset {
  enabled: boolean;
  manifest: AnalysisManifest | null;
  ciphers: CipherFamily[];
  results: AnalysisResult[];
  compactResults: AnalysisResult[];
  familyCatalogs: AnalysisFamilyCatalog[];
  sources: AnalysisSource[];
  variants: CipherVariant[];
  coverage: AnalysisCoverage | null;
}

export interface Comparability {
  comparable: boolean;
  reasons: string[];
}

export interface ReportedCostComparison {
  relation: 'incomparable' | 'equal' | 'a_dominates_reported_costs' | 'b_dominates_reported_costs' | 'tradeoff';
  reasons: string[];
}

export type PrimitiveDomain = 'symmetric' | 'asymmetric';
export type PrimitiveCategory = 'block_cipher' | 'stream_cipher' | 'hash_function' | 'xof' | 'permutation' | 'aead' | 'mac'
  | 'public_key_encryption' | 'key_agreement' | 'digital_signature' | 'kem';
export type DirectoryCategory = PrimitiveCategory | 'hard_problem';
export type HardProblemParameters =
  | { type: 'integer_factorization'; modulus: string; size: string; input_distribution: string }
  | { type: 'rsa_inversion'; modulus: string; exponent: string; input_distribution: string }
  | { type: 'discrete_logarithm'; group: string; order: string; input_distribution: string }
  | { type: 'elliptic_curve_discrete_logarithm'; curve: string; group: string; order: string; input_distribution: string }
  | { type: 'lwe'; dimension: string; modulus: string; sample_count: string; secret_distribution: string; error_distribution: string }
  | { type: 'ring_lwe'; ring: string; modulus: string; sample_count: string; secret_distribution: string; error_distribution: string; representation: string }
  | { type: 'module_lwe'; ring: string; module_rank: string; modulus: string; sample_count: string; secret_distribution: string; error_distribution: string; representation: string }
  | { type: 'sis'; dimension: string; column_count: string; modulus: string; norm: string; bound: string }
  | { type: 'module_sis'; ring: string; module_rank: string; column_count: string; modulus: string; norm: string; bound: string; representation: string };

export interface ProblemSource {
  id: string; title: string; authors: string[]; year: number; edition: string; url: string;
}
export interface HardProblemDefinition {
  id: string; name: string; category: 'hard_problem'; aliases: string[]; description: string;
  statement: string; parameters: HardProblemParameters;
  formulations: {kind: 'search' | 'decision'; description: string}[];
  qualifications: string[];
  references: {source_id: string; locator: string}[];
  related_scheme_ids: string[]; related_problem_ids: string[];
}
type Sha2Hash = 'SHA-256' | 'SHA-384' | 'SHA-512';
type NistCurve = 'P-256' | 'P-384' | 'P-521';
type Sm2Parameters = { curve: 'curveSM2'; field_bits: 256; hash: 'SM3' };
export type AsymmetricParameters =
  | { type: 'public_key_encryption'; scheme: 'rsaes_oaep'; modulus_bits: number; hash: Sha2Hash; mgf_hash: Sha2Hash; label_hex: string }
  | { type: 'digital_signature'; scheme: 'rsassa_pss'; modulus_bits: number; hash: Sha2Hash; mgf_hash: Sha2Hash; salt_bytes: number }
  | { type: 'key_agreement'; scheme: 'ffdhe'; group: 'ffdhe2048' | 'ffdhe3072' | 'ffdhe4096' | 'ffdhe6144' | 'ffdhe8192'; modulus_bits: number; generator: 2 }
  | { type: 'key_agreement'; scheme: 'ecdh'; curve: NistCurve; field_bits: number }
  | { type: 'key_agreement'; scheme: 'xdh'; function: 'X25519' | 'X448'; field_bits: number; public_key_bytes: number; shared_secret_bytes: number }
  | { type: 'digital_signature'; scheme: 'ecdsa'; curve: NistCurve; field_bits: number; hash: Sha2Hash }
  | { type: 'digital_signature'; scheme: 'eddsa'; variant: 'Ed25519' | 'Ed448'; field_bits: number; hash: 'SHA-512' | 'SHAKE256'; public_key_bytes: number; signature_bytes: number; context_hex: string }
  | (Sm2Parameters & { type: 'public_key_encryption'; scheme: 'sm2_encryption'; ciphertext_order: 'C1C3C2' })
  | (Sm2Parameters & { type: 'digital_signature'; scheme: 'sm2_signature' })
  | (Sm2Parameters & { type: 'key_agreement'; scheme: 'sm2_key_exchange'; shared_secret_bits: number })
  | { type: 'kem'; scheme: 'ml_kem'; parameter_set: 'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024'; security_category: 1 | 3 | 5; module_rank: number; public_key_bytes: number; secret_key_bytes: number; ciphertext_bytes: number; shared_secret_bytes: 32 }
  | { type: 'digital_signature'; scheme: 'ml_dsa'; parameter_set: 'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87'; security_category: 2 | 3 | 5; matrix_rows: number; matrix_columns: number; public_key_bytes: number; secret_key_bytes: number; signature_bytes: number; context_hex: string }
  | { type: 'digital_signature'; scheme: 'slh_dsa'; parameter_set: `SLH-DSA-${'SHA2' | 'SHAKE'}-${'128s' | '128f'}`; hash_family: 'SHA2' | 'SHAKE'; security_category: 1; hash_bytes: 16; hypertree_height: number; hypertree_layers: number; fors_height: number; fors_trees: number; public_key_bytes: number; secret_key_bytes: number; signature_bytes: number; context_hex: string };

export type PrimitiveParameters = AsymmetricParameters
  | { type: 'block_cipher'; key_bits: number; block_bits: number; rounds: number; stages?: number; key_encoding_bits?: number }
  | { type: 'stream_cipher'; key_bits: number; nonce_bits: number; counter_bits: number; state_bits: number; rounds: number; keystream_block_bits: number }
  | { type: 'hash_function'; output_bits: number; state_bits: number; block_bits: number; compression_steps: number }
  | { type: 'hash_function'; output_bits: number; state_bits: number; rate_bits: number; capacity_bits: number }
  | { type: 'xof'; output: 'variable'; state_bits: number; rate_bits: number; capacity_bits: number }
  | { type: 'permutation'; state_bits: number; rounds: number }
  | { type: 'aead'; key_bits: number; nonce_bits: number; tag_bits: number; state_bits?: number; rate_bits?: number }
  | { type: 'mac'; key_bits: number; block_bits: number; tag_bits: number; cipher_instance_id: string };

export interface PrimitiveSpecification {
  id: string; title: string; edition: string; url: string;
  status: 'published' | 'withdrawn'; status_note: string; checked_on: string; withdrawn_on?: string;
}

export interface PrimitiveDefinition {
  id: string; name: string; category: PrimitiveCategory; aliases: string[]; description: string;
  specification_ids: string[]; uses: string[];
}

export interface PrimitiveInstance {
  id: string; family_id: string; name: string; specification_ids: string[];
  locator: string; note?: string; parameters: PrimitiveParameters;
}

export interface PrimitiveCatalog {
  schema_version: 3;
  categories: { id: DirectoryCategory; domain: PrimitiveDomain; en: string; zh: string }[];
  specifications: PrimitiveSpecification[];
  primitives: PrimitiveDefinition[];
  instances: PrimitiveInstance[];
  problem_sources: ProblemSource[];
  hard_problems: HardProblemDefinition[];
}

export interface ReleaseMetadata {
  schema_version: 1; application_version: string; data_revision: string;
  primitive_count: number; instance_count: number; specification_count: number;
}

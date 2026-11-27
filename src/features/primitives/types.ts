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
type KemEncoding = {type: 'kem'; security_category: 1 | 2 | 3 | 4 | 5; public_key_bytes: number; ciphertext_bytes: number; shared_secret_bytes: number};
type SecretKemEncoding = {secret_key_bytes: number; secret_key_representation: 'seed' | 'encoded'};
type ExtendedKemParameters = KemEncoding & ((SecretKemEncoding & (
  | {scheme: 'hqc'; parameter_set: `HQC-${1 | 3 | 5}`; code_length: number; secret_weight: number; ephemeral_weight: number}
  | {scheme: 'frodo_kem'; parameter_set: `FrodoKEM-${640 | 976 | 1344}-${'AES' | 'SHAKE'}`; lattice_dimension: number; matrix_generator: 'AES-128' | 'SHAKE128'}
  | {scheme: 'classic_mceliece'; parameter_set: `mceliece${'348864' | '460896' | '6688128' | '6960119' | '8192128'}${'' | 'f'}`; code_length: number; field_degree: number; error_capacity: number}
  | {scheme: 'saber'; parameter_set: 'LightSaber' | 'Saber' | 'FireSaber'; module_rank: number; polynomial_degree: number; modulus: number}
  | {scheme: 'ntru'; parameter_set: 'ntruhps2048509' | 'ntruhps2048677' | 'ntruhps4096821' | 'ntruhrss701'; polynomial_degree: number; modulus: number}
  | {scheme: 'ntru_prime'; parameter_set: `sntrup${653 | 761 | 857 | 953 | 1013 | 1277}`; polynomial_degree: number; modulus: number; secret_weight: number}
)) | {scheme: 'bike'; parameter_set: `BIKE-L${1 | 3 | 5}-R4`; ring_degree: number; secret_weight: number; error_weight: number});
type StatefulSignatureParameters = {type: 'digital_signature'; stateful: true; hash: 'SHA-256'; hash_bytes: 32; tree_height: number} & (
  | {scheme: 'xmss'; parameter_set: `XMSS-SHA2_${10 | 16 | 20}_256`; tree_layers: 1; winternitz_base: 16}
  | {scheme: 'xmssmt'; parameter_set: `XMSSMT-SHA2_${'20/2' | '40/4' | '60/6'}_256`; tree_layers: number; winternitz_base: 16}
  | {scheme: 'lms'; parameter_set: `LMS_SHA256_M32_H${5 | 10 | 15 | 20 | 25}+LMOTS_SHA256_N32_W8`; tree_layers: 1; winternitz_width: 8}
  | {scheme: 'hss'; parameter_set: `HSS-L2-LMS_SHA256_M32_H${10 | 15}+LMOTS_SHA256_N32_W8`; tree_layers: 2; winternitz_width: 8}
);
export type AsymmetricParameters =
  | ExtendedKemParameters | StatefulSignatureParameters
  | {type: 'digital_signature'; scheme: 'dsa'; modulus_bits: number; subgroup_bits: number; hash: Sha2Hash}
  | {type: 'digital_signature'; scheme: 'rsassa_pkcs1_v1_5'; modulus_bits: number; hash: Sha2Hash}
  | {type: 'digital_signature'; scheme: 'bip340'; curve: 'secp256k1'; field_bits: 256; hash: 'SHA-256'; public_key_bytes: 32; signature_bytes: 64}
  | {type: 'digital_signature'; scheme: 'falcon'; parameter_set: 'Falcon-512' | 'Falcon-1024'; polynomial_degree: number; modulus: 12289; security_category: 1 | 5; public_key_bytes: number; signature_bytes: number; signature_encoding: 'padded'}
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
  | { type: 'digital_signature'; scheme: 'slh_dsa'; parameter_set: `SLH-DSA-${'SHA2' | 'SHAKE'}-${'128s' | '128f' | '192s' | '192f' | '256s' | '256f'}`; hash_family: 'SHA2' | 'SHAKE'; security_category: 1 | 3 | 5; hash_bytes: 16 | 24 | 32; hypertree_height: number; hypertree_layers: number; fors_height: number; fors_trees: number; public_key_bytes: number; secret_key_bytes: number; signature_bytes: number; context_hex: string };

export type PrimitiveParameters = AsymmetricParameters
  | { type: 'hash_function'; construction: 'block_cipher_compression'; mode: 'dm' | 'mmo' | 'mp'; cipher_instance_id: string; chaining_bits: number; message_bits: number; output_bits: number; cipher_rounds: number }
  | { type: 'block_cipher'; key_bits: number; block_bits: number; rounds: number; stages?: number; key_encoding_bits?: number; tweak_bits?: number; tweakey_bits?: number; sboxes_per_round?: number }
  | { type: 'block_cipher'; construction: 'prime_field'; field_modulus: string; block_elements: number; key_elements: number; rounds: number; sbox_exponent: number }
  | { type: 'stream_cipher'; key_bits: number; nonce_bits: number; counter_bits: number; state_bits: number; rounds: number; keystream_block_bits: number }
  | { type: 'stream_cipher'; construction: 'feedback' | 'word_oriented'; key_bits: number; nonce_bits: number; state_bits: number; output_bits_per_step: number; initialization_steps?: number }
  | { type: 'stream_cipher'; construction: 'byte_permutation'; key_bits: number; permutation_entries: 256; word_bits: 8; output_bits_per_step: 8 }
  | { type: 'hash_function'; output_bits: number; state_bits: number; block_bits: number; compression_steps: number }
  | { type: 'hash_function'; output_bits: number; state_bits: number; rate_bits: number; capacity_bits: number; squeeze_bits?: number }
  | { type: 'hash_function'; construction: 'compression' | 'tree'; output_bits: number; chaining_bits: number; block_bits: number; compression_rounds: number; working_state_bits?: number; chunk_bytes?: number }
  | { type: 'hash_function'; construction: 'prime_field_sponge'; field_modulus: string; state_elements: number; rate_elements: number; capacity_elements: number; output_elements: number; full_rounds: number; partial_rounds: number; sbox_exponent: number }
  | { type: 'xof'; output: 'variable'; state_bits: number; rate_bits: number; capacity_bits: number }
  | { type: 'xof'; construction: 'tree_sponge'; output: 'variable'; state_bits: number; rate_bits: number; capacity_bits: number; permutation_rounds: number; chunk_bytes: number }
  | { type: 'permutation'; state_bits: number; rounds: number }
  | { type: 'permutation'; state_bits: number; steps: number }
  | { type: 'aead'; key_bits: number; nonce_bits: number; tag_bits: number; state_bits?: number; rate_bits?: number }
  | { type: 'aead'; construction: 'scmac'; stream_instance_id: string; key_bits: number; nonce_bits: number; tag_bits: number; state_bits: number; stream_state_bits: number; mac_state_bits: number; rate_bits: number; initialization_steps: number }
  | { type: 'aead'; nonce_mode: 'deterministic'; key_bits: number; tag_bits: number }
  | { type: 'mac'; key_bits: number; block_bits: number; tag_bits: number; cipher_instance_id: string }
  | { type: 'mac'; construction: 'hmac'; key_input: 'variable'; hash_instance_id: string; block_bits: number; tag_bits: number }
  | { type: 'mac'; construction: 'universal_hash'; key_bits: number; tag_bits: number; key_use: 'one_time' | 'nonce_based'; block_bits?: number; nonce_bits?: number }
  | { type: 'mac'; construction: 'arx_prf'; key_bits: number; tag_bits: number; block_bits: number; compression_rounds: number; finalization_rounds: number }
  | { type: 'mac'; construction: 'sponge'; key_input: 'variable'; tag_bits: number; state_bits: number; rate_bits: number; capacity_bits: number };

export interface CitationObservation {
  provider: 'openalex' | 'semantic_scholar' | 'google_scholar'; work_id: string; title: string;
  cited_by_count: number; checked_on: string; url: string;
}
export interface PrimitiveInclusion {
  reason: 'high_citation' | 'standard' | 'competition' | 'historical' | 'research_design' | 'recent_design' | 'maintainer_request';
  specification_id: string; note: string;
}

export interface PrimitiveSpecification {
  id: string; title: string; edition: string; url: string;
  status: 'published' | 'withdrawn'; status_note: string; checked_on: string; withdrawn_on?: string;
  kind?: 'standard' | 'rfc' | 'design_paper' | 'submission' | 'designer_specification';
  doi?: string; citation_observations?: CitationObservation[];
}

export interface PrimitiveDefinition {
  id: string; name: string; category: PrimitiveCategory; aliases: string[]; description: string;
  specification_ids: string[]; uses: string[];
  inclusion?: PrimitiveInclusion[]; parameter_scope?: string;
}

export interface PrimitiveInstance {
  id: string; family_id: string; name: string; specification_ids: string[];
  locator: string; note?: string; parameters: PrimitiveParameters;
}

export interface PrimitiveStandard {
  specification_id: string; designation: string; authority: string;
  level: 'international' | 'national'; document_type: 'standard' | 'recommendation'; jurisdiction?: string;
  bindings: {instance_ids: string[]; locator: string; role: 'algorithm' | 'component'; note?: string}[];
}

export interface PrimitiveCatalog {
  schema_version: 4;
  standardization?: {checked_on: string; reviewed_instance_ids: string[]; standards: PrimitiveStandard[]};
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

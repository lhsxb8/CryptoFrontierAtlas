export type PrimitiveCategory = 'block_cipher' | 'stream_cipher' | 'hash_function' | 'xof' | 'permutation' | 'aead' | 'mac';

export type PrimitiveParameters =
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
  schema_version: 1;
  categories: { id: PrimitiveCategory; en: string; zh: string }[];
  specifications: PrimitiveSpecification[];
  primitives: PrimitiveDefinition[];
  instances: PrimitiveInstance[];
}

export interface ReleaseMetadata {
  schema_version: 1; application_version: string; data_revision: string;
  primitive_count: number; instance_count: number; specification_count: number;
}

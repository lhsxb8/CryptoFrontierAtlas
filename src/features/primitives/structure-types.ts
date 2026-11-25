type Bilingual = {en: string; zh: string};
export interface StructureView {id: string; template: string; label: Bilingual; caption: Bilingual}
export interface StructureDefinition {
  family_id: string; instance_ids: string[]; specification_ids: string[]; design_source_ids: string[];
  compact_template?: string;
  locator: string; review: {status: 'source_checked' | 'pending'; checked_on: string}; views: StructureView[];
}
export interface StructureAsset {
  target_id: string; family_id: string; view_id: string; asset: string; tex: string;
  width: number; height: number; parameters_sha256: string; source_sha256: string; svg_sha256: string; tex_sha256: string;
}
export interface StructureData {
  registry: {
    schema_version: 1;
    style_reference: {title: string; author: string; url: string; note: string};
    design_sources: {id: string; title: string; url: string; locator: string}[];
    diagrams: StructureDefinition[];
  };
  manifest: {schema_version: 1; toolchain: {latex: string; dvisvgm: string}; assets: StructureAsset[]};
}

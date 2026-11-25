declare module 'virtual:primitive-catalog' {
  const value: {
    catalog: import('./types').PrimitiveCatalog;
    release: import('./types').ReleaseMetadata;
    structures: import('./structure-types').StructureData;
  };
  export default value;
}

declare module 'virtual:cryptanalysis-data' {
  const dataset: import('./types').AnalysisDataset;
  export default dataset;
}

declare module 'virtual:cryptanalysis-comparison' {
  export function comparability(
    a: import('./types').AnalysisResult,
    b: import('./types').AnalysisResult,
  ): import('./types').Comparability;
  export function compareReportedCosts(
    a: import('./types').AnalysisResult,
    b: import('./types').AnalysisResult,
  ): import('./types').ReportedCostComparison;
}

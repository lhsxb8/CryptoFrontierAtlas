import { resolve, sep } from 'node:path';

/** Reload the complete shared validation graph after an edit, in either adapter. */
export function refreshNodeDataModules(loader: NodeRequire, runtimeRoot: string, projectRoot: string) {
  const roots = [resolve(runtimeRoot, 'lib'), resolve(runtimeRoot, 'schemas/cryptanalysis'),
    resolve(projectRoot, 'schemas/cryptanalysis')];
  for (const file of Object.keys(loader.cache)) {
    if (roots.some(root => file.startsWith(root + sep))) delete loader.cache[file];
  }
}

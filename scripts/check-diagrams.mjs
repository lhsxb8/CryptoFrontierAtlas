import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const {loadPrimitiveCatalog} = require('../lib/node/primitive-catalog.cjs');
const {validateDiagramAssets} = require('../lib/node/primitive-diagrams.cjs');
const root = fileURLToPath(new URL('..', import.meta.url));
const {manifest} = validateDiagramAssets(root, loadPrimitiveCatalog(root));
console.log(`PASS: ${manifest.assets.length} diagrams; explicit instance bindings, sources, hashes and inert SVG checked.`);

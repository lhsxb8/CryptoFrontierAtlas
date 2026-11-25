import {createRequire} from 'node:module';
const {loadPrimitiveCatalog} = createRequire(import.meta.url)('../lib/node/primitive-catalog.cjs');
const catalog = loadPrimitiveCatalog();
console.log(`PASS: ${catalog.primitives.length} public primitives, ${catalog.instances.length} instances, ${catalog.specifications.length} specifications.`);

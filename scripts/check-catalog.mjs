import {createRequire} from 'node:module';
const {loadPrimitiveCatalog} = createRequire(import.meta.url)('../lib/node/primitive-catalog.cjs');
const catalog = loadPrimitiveCatalog();
console.log(`PASS: ${catalog.primitives.length} public primitives, ${catalog.instances.length} instances, ${catalog.specifications.length} specifications, ${catalog.hard_problems.length} hard problems, ${catalog.problem_sources.length} problem references.`);
if (catalog.standardization) {
  const review = catalog.standardization;
  const covered = new Set(review.standards.flatMap(standard => standard.bindings.flatMap(binding => binding.instance_ids)));
  console.log(`PASS: standardization reviewed ${review.reviewed_instance_ids.length} instances; ${covered.size} have explicit bindings to ${review.standards.length} standards/recommendations (${review.checked_on}).`);
}

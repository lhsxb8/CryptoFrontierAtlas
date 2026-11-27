import {catalogFixture} from './primitive-catalog-fixtures.mjs';

/** Synthetic adoption evidence, independent of the scientific corpus. */
export function standardizationFixture() {
  const catalog = catalogFixture();
  const base = catalog.specifications[0];
  base.kind = 'standard';
  catalog.specifications.push(
    {...base, id: 'fixture-national', title: 'Synthetic national recommendation'},
    {...base, id: 'fixture-historical', title: 'Synthetic historical standard', status: 'withdrawn', withdrawn_on: '2025-01-01'},
    {...base, id: 'fixture-rfc', title: 'Synthetic RFC', kind: 'rfc'},
  );
  const instance = catalog.instances[0];
  catalog.instances.unshift({...instance, id: 'fixture-block-256', name: 'Fixture Block 256', parameters: {...instance.parameters, key_bits: 256, rounds: 14}});
  catalog.standardization = {
    checked_on: '2026-01-01', reviewed_instance_ids: catalog.instances.map(instance => instance.id),
    standards: [
      {specification_id: 'fixture-spec', designation: 'Synthetic International Standard', authority: 'Synthetic international body',
        level: 'international', document_type: 'standard',
        bindings: [{instance_ids: ['fixture-block-128'], locator: 'Synthetic clause for this key size only.', role: 'algorithm'}]},
      {specification_id: 'fixture-national', designation: 'Synthetic National Recommendation', authority: 'Synthetic national body',
        level: 'national', document_type: 'recommendation', jurisdiction: 'US',
        bindings: [{instance_ids: ['fixture-permutation-256'], locator: 'Synthetic normative permutation component.', role: 'component'}]},
      {specification_id: 'fixture-historical', designation: 'Synthetic Withdrawn Standard', authority: 'Synthetic national body',
        level: 'national', document_type: 'standard', jurisdiction: 'CN',
        bindings: [{instance_ids: ['fixture-mac-128'], locator: 'Synthetic withdrawn definition.', role: 'algorithm'}]},
    ],
  };
  return catalog;
}

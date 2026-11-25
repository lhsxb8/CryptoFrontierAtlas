# Extending the result model

The taxonomy registry is `schemas/cryptanalysis/result-taxonomy.json`. It is the
single authored source for kinds, goals, methods, key models and attack surfaces.
`npm run sync:analysis-model` projects it into the JSON Schema and TypeScript
taxonomy. `npm run check:analysis-model` checks for drift.

## Compatible additions

Add labels or a goal using an existing payload to the registry, then regenerate
the projections. Define required payloads, compatible result kind and any key-model
constraint in that goal's contract. Avoid adding matching branches independently
to the validator, comparator and UI.

## New scientific semantics

When an existing contract cannot express a new result:

1. Identify the missing scientific distinction using primary evidence.
2. Extend the schema with an explicit, versioned payload; retain legacy readability.
3. Add shared semantic checks in `lib/cryptanalysis/result-model.cjs`.
4. Extend comparability only where the new experiment is completely specified.
5. Update family scope and UI components to represent the new target.
6. Add synthetic valid/invalid cases and Node/browser parity tests, then corpus regressions.

Keep formulas, parameter domains, success events and resource units together.
Retain optional coordinates such as preprocessing or quantum resources during
comparison. Each comparison uses a complete source-supported assignment and
matching settings.

## Publication classification

When adding or restructuring fields, update the independent permissions in
`schemas/cryptanalysis/publication-fields.json`. A scientific schema addition
does not authorize publication, including optional fields unused by current data.
The same rule applies to the shared procedural field declarations in
`lib/node/cryptanalysis/structure-contracts.cjs`. Do not regenerate permissions
automatically from a changed schema. See [Published analysis data](published-data.md#extending-a-contract)
for field classes, transformations and synthetic regression requirements.

## Verification

```sh
npm run sync:analysis-model
npm run check:publication-fields
npm test
npm run check:types
npm run check:analyses
npm run test:corpus
```

Run the default synthetic suite for every taxonomy extension. Dataset-specific
checks apply when a dataset is configured. A scientific migration records its
scope and preserves the source versions and earlier evidence.

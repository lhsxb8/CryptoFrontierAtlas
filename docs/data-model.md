# Extending the result model

The cipher-result taxonomy registry is `schemas/cryptanalysis/result-taxonomy.json`.
It is the single authored source for cipher kinds, goals, methods, key models and attack surfaces.
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

## Compression targets

Compression analyses have distinct `hash_function` families and scientific
variants with an explicit `compression` descriptor: mode, underlying cipher
variant, construction name/definition and output width. Their full-round count
refers to the underlying cipher; they do not carry cipher `key_bits`/`block_bits`
as if a message or chaining value were a secret key. Directory instances retain
the separate message and chaining widths.

`lib/cryptanalysis/compression.cjs` checks the dependency and experiment identity.
Both detailed and compact records must target the registered construction, not
its underlying cipher. Compression records preserve their source-defined input
control, success event, round convention and resource accounting. Merely citing
a compression application does not turn a cipher result into a compression result.
Different construction targets remain incomparable; classical/quantum and
attack-surface separation applies within each target as before.

The optional descriptor and each nested field require independent publication
classification. Public validation enforces the same scientific identity without
access to the maintained corpus. Migration changes target IDs only, retains
stable result IDs and source evidence, and records a scoped internal receipt.

## Quantum models

Keep `setting.computation` independent of `setting.attack_surface`. Algorithmic
quantum results share a display section, while comparison still requires their
complete settings to match. Quantum-assisted side-channel or fault attacks keep
their physical attack surface.

`setting.quantum_model.query_model` records target access: classical queries with
quantum computation (Q1), coherent secret-key oracle access (Q2), or offline
evaluation of a public function without a secret-key oracle. Quantum circuits or
coherent memory access alone do not establish Q2.

The optional `memory_model` is `qram`, `qraqm` or `no_qram`. Preserve the source's
generic qRAM terminology unless it explicitly specifies quantum data in memory
(QRAQM). Assign `no_qram` only with positive evidence; an absent field means
unreviewed or unspecified, not zero quantum storage. Keep contents, access costs
and resource units in the detailed assumptions and evidence. The UI reads these
fields for colored tags, never title/ID substrings or guesses from memory costs.

## Publication classification

When adding or restructuring fields, update the independent permissions in
`schemas/cryptanalysis/publication-fields.json`. A scientific schema addition
does not authorize publication, including optional fields unused by current data.
The same rule applies to the shared procedural field declarations in
`lib/node/cryptanalysis/structure-contracts.cjs`. Do not regenerate permissions
automatically from a changed schema. See [Published analysis data](published-data.md#extending-a-contract)
for field classes, transformations and synthetic regression requirements.

## Hard-problem analyses

`problem-result.schema.json` defines an explicit target-discriminated branch, first
for Integer Factorization. Its closed kind/goal contract distinguishes algorithms,
supporting subroutines and reported computations. Do not add factorization methods
to cipher attack enums or use `related_problem_ids`, which links cipher analyses to
Open Questions rather than primitive hard problems.

`lib/node/cryptanalysis/problem-contract.cjs` composes the resource, probability,
parameter, evidence and conflict definitions from the existing result schema,
and the existing procedural family shape. Both AJV and the publication validator
consume that composition. `problem-analyses.cjs` validates catalog references,
complete family assignments, source fingerprints, evidence pointers and scoped
ingestion receipts. Public catalogs omit receipts but retain scientific coverage.

Comparison uses the same entry point and cost arithmetic as cipher analyses.
Different target kinds never compare. Hard-problem algorithm comparisons require
identical inputs, goals, methods, settings, numerical parameter assignments,
verified exact success and compatible complete resource vectors. Symbolic bounds,
supporting results and hardware computation records cannot certify dominance.
Quantum factorization uses a public integer input; it does not acquire Q1/Q2
secret-oracle labels from AES. A quantum-memory tag requires positive evidence.

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

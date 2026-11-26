# Architecture

CryptoFrontierAtlas has one React/TypeScript application and one root npm package.
Vite builds a static website; the application needs no database or backend.

## Dependency direction

| Layer | Responsibility | Dependencies |
| --- | --- | --- |
| `schemas/` | Data contracts and taxonomy registry | None |
| `lib/cryptanalysis/` | Pure semantics, comparison and family projections | Contracts and pure modules |
| `lib/node/` | Data loading, validation, provenance and indexing | Pure core and Node APIs |
| `build/` | Data-profile adapter and distribution assets | Node loader and Vite |
| `src/` | Routing, feature views and shared UI | Pure core and projected data |
| `scripts/` | Checks and maintenance entrypoints | Node tooling |

`check:architecture` enforces the main import directions. The Node and browser
views share one comparator; Vite handles its CommonJS conversion. Feature code
lives in `src/features/`, routing in `src/app/`, and shared UI in `src/components/`.
Typography, collection hierarchy and responsive navigation are described in
[Interface design](interface-design.md).

## Data flow

`atlas.config.cjs` defines paths relative to the application root. The build
adapter selects a dataset, validates it and projects it into browser-facing
records. The frontend and CLI share scientific validation and comparison logic.
HMR invalidates the cached projection before validating an edit.
Both build adapters refresh the shared Node module graph. Failed development
validation invalidates the served module and sends generic browser errors, while
the local terminal retains diagnostics.

Question records, their manifest and taxonomy live in `data/questions/`.
Public primitive definitions live in `data/primitives/`, with their own contract
under `schemas/primitives/`. The catalog build adapter validates them independently
of analysis availability. Public catalog instances carry type-specific parameters;
they are not synthesized into scientific analysis targets. Where IDs overlap,
both build profiles check target parameters against the public definitions.
The version-3 directory assigns symmetric/asymmetric domains at the category
level. One shared directory/detail UI uses domain-scoped routes and counts.
Asymmetric parameter contracts are purpose- and scheme-specific; no asymmetric
entry is injected into the symmetric scientific result model or comparator.
Hard-problem definitions have separate closed contracts and references within the
same catalog. The shared directory projects algorithms and problems as distinct
entry kinds; dedicated problem routes show symbolic definitions without inventing
algorithm instances. Problem/scheme associations are independent of construction
dependencies and scientific result relations.
Hard-problem analyses enter the same validated corpus, source registry, read model
and publication pipeline through `problem-results/` and `problem-analyses/`.
`target.kind = hard_problem` never fabricates a cipher instance or round count.
The schema composer shares resource, probability, evidence and family contracts;
the comparator dispatches by target kind before considering matching cost vectors.
Integer Factorization is the first supported analysis target in this branch.
The same adapter validates parameter-bound TikZ/SVG structure assets and their
explicit instance registry. Figures are compiled offline, committed and checked
without TeX in ordinary builds. The frontend shares one structure panel across
directory and analysis views; see [Structure diagrams](structure-diagrams.md).
`schemas/` defines the question and cryptanalysis contracts. Result records bind
targets, settings, parameters, costs, success events and source evidence; see
[Cryptanalysis data](cryptanalysis.md).

Maintainers collect and validate analyses in the ignored `data/cryptanalysis/`
research corpus. An explicit export produces `data/cryptanalysis-public/`, the
versioned public snapshot. Both use the same scientific validator and read model;
only the internal profile checks ingestion receipts and private audit artifacts.
Public validation checks the snapshot's allowed fields, file inventory, hashes,
counts, scientific payload and references without those artifacts. See
[Published analysis data](published-data.md) for the export boundary.

`schemas/cryptanalysis/publication-fields.json` authorizes fields independently
of the scientific contracts. The Node publication layer checks contract coverage
before export or public validation, including fields absent from current data.
Shared structural declarations serve the existing procedural validators; no
second comparator, scientific schema or result model is introduced.

Lean submissions identify a pinned source version, license, theorem scope and
replay instructions. Dataset validation checks references and source hashes;
proof replay checks the formalization. Vendored artifacts include their license,
attribution and source fingerprints.

## Builds and distribution

Default development and production builds use the public snapshot, including
detailed results, compact points, parameterized families, sources and coverage.
`dev:local` and `build:local` select the raw research corpus explicitly. Missing or
invalid public data stops the build; it does not produce an empty analysis site.
Every build emits a format-2 profile receipt in `atlas-build-profile.json`.
Production analysis data is served in a content-addressed `analysis-<sha256>.json`
asset, loaded relative to the deployment base so project Pages paths work. The
receipt binds its filename, hash and counts. Development uses an inline projection
for hot reload. A small startup view remains visible while the application loads;
failed asset requests show a reload action instead of a blank or empty-data site.
The public catalog is present in both profiles. `atlas-release.json` records the
application version and a content-derived revision of questions, primitive
definitions, diagrams and the published analysis snapshot. Directory
registration, standardization status and analysis coverage remain separate.

`check:source` validates candidate repository files and the snapshot. When the
raw corpus is available it also requires a fresh export. `check:release` compares
the emitted analysis bytes with the validated read model, then checks the
production receipt, other website assets and distribution licenses. Only that
exact analysis asset is approved; raw corpus copies and private paths remain
forbidden. The deployment artifact is `dist/`; see [Releasing](releasing.md).

The pre-enforced development boundary uses `lib/node/private-paths.cjs`, also
shared by source and bundle checks. It checks URL paths and resolved filesystem
targets before Vite serves them, retaining Vite's default deny rules. Trusted
Node data adapters are separate from raw HTTP imports. Development defaults to
loopback; use the checked static preview for LAN demonstrations.

`lib/node/public-assets.cjs` authorizes exact public asset paths and bytes: the
existing diagram manifest supplies SVG/TeX identities and the font has pinned
hashes. Unregistered files, changed bytes and symlinks fail development access,
source checks and builds. Release checks also verify the copied asset bytes.
`scripts/preview.mjs` checks the actual resolved output before opening its port;
internal output requires an explicit loopback-only local preview.

## Tests and CI

`npm test` runs unit and integration tests with synthetic result fixtures.
Browser tests exercise the production build on desktop and mobile. A
clean-checkout integration test verifies the source export and production build.

PRs and the main branch run the same checks on Node.js 24. The checks job has
read-only repository permissions. Optional Pages deployment uses its verified
artifact in a separate job with deployment permissions, with no install or rebuild.
Actions are pinned to immutable commits and updated through Dependabot.

# Published analysis data

`data/cryptanalysis-public/` is the analysis dataset distributed with the source
release. Default development and production builds use it. The maintained raw
corpus stays at the ignored `data/cryptanalysis/` path.

## Publication boundary

| Content | Public snapshot |
| --- | --- |
| Detailed results and compact configurations | All retained points, including non-frontier points |
| Parameterized families and presentation annotations | Formulas, domains, assignments and stable IDs |
| Scientific scope | Targets, settings, native costs, success events, conditions and conflicts |
| Sources | Bibliography, inspected versions, fingerprints and primary-source locations |
| Review and reproduction | Existing status and limitations, without an upgrade on publication |
| Coverage | Scope, gaps, unresolved issues and bibliographic pending-source summaries |
| Concrete witnesses | Witness bytes, round convention, source and verification scope |
| Internal workflow | No ingestion batches, private report paths, work queues or collection queries |
| Papers, local archives and credentials | Not distributed |

Paths to local audit artifacts in otherwise public statements become
`[local audit reference not distributed]`. References to internal batches become
`[local batch reference not distributed]`. Surrounding qualifications and
primary-source locations remain intact. Academic URLs are not rewritten.
These markers do not stand in for primary evidence or claim that an unavailable
audit can be replayed from the public checkout.

Schema validity and permission to publish are independent. The exporter and
public validator both use `schemas/cryptanalysis/publication-fields.json`.
It classifies fields in results, sources, target definitions, compact entries,
families, presentation annotations, manifests, coverage and witnesses. It does not
discard results based on frontier, conflict or review status. Adding a primitive
to the directory still does not imply that it has analysis coverage.

## Extending a contract

Before adding a field, classify its path in the publication policy:

- `public`: retain the value. Public objects require classifications for their
  children; an approved parent never grants permission to a new nested field.
- `internal`: omit the whole field or subtree. It must not be required by the
  shared public scientific contract.
- `transforms`: use a named, narrowly scoped projection. Audit-reference text is
  projected only at explicitly approved paths; other scientific and citation
  text is not silently rewritten. The public flag and empty ingestion-batch list
  also have explicit transformations.

Paths use JSON Pointer escaping. `*` identifies schema-declared array elements or
dictionary values, not arbitrary descendants. Dictionaries have declared key
domains and retain the existing scientific checks on parameters, resources and
family references. Compact entries explicitly reuse selected result-policy
subtrees. Permissions are reviewed source, not generated from the schemas.

`lib/node/cryptanalysis/publication-policy.cjs` checks the complete structural
contract, including optional fields and inactive conditional branches, before
inspecting records. An unclassified field therefore fails even when no current
record uses it. Stale or duplicate rules, unsupported schema constructs and
required/internal conflicts also fail. After classification, the existing
scientific validators still check meanings, constraints and references.

JSON Schema remains authoritative where present. Procedural validators share
field declarations from `structure-contracts.cjs`; this layer describes shape,
not a second scientific model. New fields in these declarations require the same
publication review. A wholly internal subtree remains excluded as a unit.

```sh
npm run check:publication-fields
npm run check:published-data
```

Both commands run in a clean public checkout, and the field-policy check is part
of `npm test` and CI. When changing classification, add synthetic cases for export
and independent public validation. Updating an integrity receipt must never make
an internal field publishable.

## Maintainer workflow

```sh
npm run check:analyses
npm run check:progress
npm run check:publication-fields
npm run export:analyses
npm run check:analysis-export
npm run check
npm run build
npm run check:release
```

Export first validates the original corpus, including its ingestion evidence.
It writes and validates a staged snapshot before replacing the public directory.
The previous snapshot is retained under `.local/publication/previous-*/snapshot`.
A failed validation leaves the current public snapshot unchanged. The raw corpus
is never modified by export. Review the resulting data diff before publication.

Output is deterministic: an unchanged corpus produces identical files, without
an export timestamp. `check:analysis-export` compares the expected export with
every published file; changes to source evidence, costs or editorial data require
a new export. `check:source` also performs this freshness check when the raw corpus
is present. Do not hand-edit generated files or remove provenance checks to force
an export through.

## Independent checkout

The snapshot includes its manifest, sources, targets, results, compact entries,
families, presentation annotations, coverage, witnesses and a license-scope notice.
`publication.json` binds the allowed file inventory, each file's SHA-256 hash,
counts, scientific fingerprint and content revision. These are integrity checks,
not a signature or a certificate of scientific correctness.

```sh
npm ci
npm run check:published-data
npm run build
npm run check:release
```

These checks require neither the private corpus nor PDFs, ingestion reports or
agent skills. Missing, stale or invalid data fails validation rather than
silently producing an empty site. Public validation reuses the scientific
contracts and checks source references, families and witness/result alignment.

To independently replay the included concrete AES collision witnesses with
Python 3 and its standard library:

```sh
python3 -B lib/node/cryptanalysis/verify-witnesses.py --witnesses data/cryptanalysis-public/witnesses.json
```

This checks witness equalities and negative cases; it does not reproduce full
attacks or verify their claimed costs. Python is not required for the website
build.

## Build and revision

Production emits a content-addressed `analysis-<sha256>.json` read model. The
format-2 `atlas-build-profile.json` records the public profile, its filename,
hash and counts. Release checks compare its complete bytes against the validated
snapshot. Upload the entire `dist/` directory so the app can load this asset at
either a domain root or a project subpath.

`atlas-release.json` incorporates the snapshot into the public data revision.
Data updates change that revision without changing the application version.
The initial application release remains v1.0.0; scientific schema and historical
source versions retain their own numbering. See [Version policy](versioning.md).

The existing license combination is unchanged: Apache-2.0 for code and CC BY 4.0
for original curated data. The generated directory's README states its scope
under the existing CC BY 4.0 terms. Third-party publications and artifacts retain
their own rights and attribution requirements.

## Development and preview

The data profile selects what the application loads; it does not authorize raw
HTTP file access. Both development profiles block private workspace paths,
including direct URLs, `/@fs/`, aliases and symlinks. The internal profile still
intentionally exposes its projected research data to its browser client through
the trusted Node loader. Keep development services local.

Policy, schema and validator edits invalidate the development projection before
revalidation. Failed edits do not serve the cached analysis module. Browser
errors are generic; detailed diagnostics remain in the local terminal.

Use the checked public static preview for a LAN demonstration, not a development
server. See [Releasing](releasing.md#checked-preview) for the commands and limits.

# Question data contract

The unit of the dataset is an atomic mathematical question with a traceable
public source. A source paper can contribute several questions; versions of the
same question share one record with explicit lineage.

## Required fields

`schemas/questions/problem.schema.json` defines the machine-readable contract.
Records contain a stable ID and group, title and summary, a Markdown/LaTeX
statement, assumptions and parameter scope, classification, source citations,
status dimensions, progress, artifacts, formalization metadata and relations.

The manifest lists exactly the records in a release. Relations must resolve
within that release. Keep related questions separate when their quantifiers,
assumptions or unresolved cases differ.

## Evidence and status

Mathematical status, publication status, verification and disclosure are separate
coordinates. Publication does not itself prove a claim; a finite computation
verifies its stated case. Formalization evidence identifies the theorem,
definitions, trust dependencies, toolchain and exact source version.

Each confirmed lineage has one original-source citation and one source-statement
event. Restatements cite their antecedent. Unresolved origins are recorded
explicitly rather than assigned an inferred original source. Progress is dated,
ordered and linked to matching citation roles.

## Artifacts

Evidence links use absolute HTTP(S) URLs. External code and data retain their
licenses. Record an inspected source version, immutable location and checksum
when available. Hashes identify bytes, not permission or mathematical validity.

External formalizations are supported by the reporting workflow. Cleared vendored
formalizations use `data/formalizations/`, a source-tree fingerprint and an
explicit license. Data validation checks their identity; build and theorem replay
are recorded independently.

## Validation and change policy

Run `npm run check:data` and `npm test` for public-data changes. Preserve existing
IDs and routes. Explain corrections with source locators and keep scientific
reinterpretation separate from structural migrations. See
[LICENSE-DATA.md](../LICENSE-DATA.md) for the license boundary.

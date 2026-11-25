# Primitive and construction directory

`data/primitives/catalog.json` is the public directory. It includes category
labels, algorithm families, concrete instances and versioned specification links.
It is available even when the selected release contains no analysis results.

## Contract

`schemas/primitives/catalog.schema.json` defines a closed contract: unknown fields
are rejected. `lib/node/primitive-catalog.cjs` also checks unique IDs, references,
acyclic construction dependencies, matching categories and parameter consistency.

Instances use type-specific parameters. Hash outputs, permutation states, stream
cipher nonces and AEAD tags are not block-cipher key/block parameters. Compression
steps, primitive rounds and stages of a composite construction remain distinct.
An unregistered instance is different from a registered instance with zero results.

Each instance names its specifications and precise locations. Status belongs to
the cited specification and has a check date. A withdrawn standard remains useful
for historical research; registration is not deployment advice or a security claim.
The initial collection separates Keccak permutations, SHA-3 hashes and SHAKE XOFs.

The directory currently registers 19 families and 39 instances. In addition to
AES, TDEA and the initial hash/construction entries, it includes SM3, SM4,
Camellia, ARIA, SEED, PRESENT and full-round Salsa20. SHA-1 and MD5 are retained
as historical research targets with visible collision-resistance warnings.
Their published specifications are not incorrectly marked withdrawn. This is a
curated directory, not an exhaustive list of symmetric primitives.

Key-size variants have separate instance IDs. Camellia's FL layers do not count
as Feistel rounds; PRESENT's final key addition is not another SP round; MD5's
four rounds contain 64 compression steps. Salsa20 retains its original 64-bit
nonce/counter layout rather than inheriting the IETF ChaCha20 parameters. The
Chinese aliases for SM3 and SM4 are searchable.

## Adding entries

1. Inspect a primary specification and record the edition, URL and locations.
2. Add a stable family ID and concrete instances with the appropriate parameters.
3. Link underlying families through `uses`; retain distinct construction identities.
4. Register explicit structure bindings and source locations in `diagrams.json`,
   then run `npm run diagrams:build`. See [Structure diagrams](structure-diagrams.md).
5. Run `npm run check:catalog`, `npm run check:diagrams`, `npm test` and affected browser tests.

A supported-category addition is a data update and does not increment the
application version. A new parameter contract or display capability is a framework
change under the [version policy](versioning.md). For new scientific experiments,
extend the [result model](data-model.md) with dedicated tests before ingesting results.

## Analysis integration

Existing analysis instance IDs and deep links are preserved. A compatibility
adapter checks overlapping definitions, including AES key sizes, block sizes and
round counts. It rejects conflicting definitions rather than silently overriding
them. Directory-only instances never enter the cost comparator or audit totals.

The public build reads only public definitions and questions. It exports a
validated `atlas-catalog.json`; release checks compare that asset to its source and
continue scanning every asset for restricted material. The data revision in
`atlas-release.json` identifies the public input bytes, independently of the
application version. Original directory metadata uses the dataset license;
linked specifications retain their own rights and are not vendored.

Family and instance pages share a structure panel with analysis pages. Family
views use one symbolic drawing and an instance comparison; instance views use
exact catalog parameters. Attack filters do not change the primitive diagram.
Research variants without an explicitly checked binding show a pending notice.

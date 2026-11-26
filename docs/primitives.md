# Primitive, Construction and Hard-Problem Directory

`data/primitives/catalog.json` is the public directory. It includes category
labels, algorithm families, concrete instances, hard-problem definitions and source links.
It is available even when the selected release contains no analysis results.

## Contract

`schemas/primitives/catalog.schema.json` defines the version-3 closed contract: unknown fields
are rejected. `lib/node/primitive-catalog.cjs` also checks unique IDs, references,
acyclic construction dependencies, matching categories and parameter consistency.
Every category declares exactly one domain, `symmetric` or `asymmetric`. Families
and instances inherit that domain; pages, filters and route builders use the same
classification. This directory contract version is independent of the application
version and scientific result schema.

Instances use type-specific parameters. Hash outputs, permutation states, stream
cipher nonces and AEAD tags are not block-cipher key/block parameters. Compression
steps, primitive rounds and stages of a composite construction remain distinct.
An unregistered instance is different from a registered instance with zero results.

Each instance names its specifications and precise locations. Status belongs to
the cited specification and has a check date. A withdrawn standard remains useful
for historical research; registration is not deployment advice or a security claim.
The initial collection separates Keccak permutations, SHA-3 hashes and SHAKE XOFs.

The symmetric directory registers 19 families and 39 instances. In addition to
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

The asymmetric directory adds 13 families and 32 instances across public-key
encryption, key agreement, digital signatures and key encapsulation. RSA-OAEP and
RSA-PSS have separate families and explicit SHA-256/MGF1 profiles. SM2 encryption,
signatures and key exchange also have distinct identities. ECDH and X25519/X448
are separate from ECDSA and EdDSA, even where their mathematical foundations are
related. ML-KEM, ML-DSA and SLH-DSA use the final FIPS parameter-set names rather
than treating pre-standard proposals as identical algorithms.

Hard Problems is the first asymmetric category, at the same level as Public-Key
Encryption. Its initial nine entries are Integer Factorization, RSA Problem,
Discrete Logarithm, Elliptic-Curve Discrete Logarithm, LWE, Ring-LWE, Module-LWE,
SIS and Module-SIS. They live in `hard_problems`, not `primitives` or `instances`.
The asymmetric directory counts entries; algorithm instance counts remain separate.

Problem definitions contain a statement, type-specific symbolic parameters,
search/decision formulations, qualifications and locators into `problem_sources`.
Research references have authors and an inspected edition rather than a standard's
publication/withdrawal status. No numerical parameter sets, diagrams, attack costs
or security levels are invented for these definitions. Ring/module problems retain
their ring, representation, distribution and norm distinctions. A category called
Hard Problems does not assert unconditional hardness for every parameter choice.

`related_scheme_ids` and `related_problem_ids` supply navigable associations.
Related schemes must be asymmetric; problem links must resolve and cannot refer
to themselves. These links are not construction dependencies, equivalence claims
or executable reductions. For example, RSA inversion and factorization are
separate entries. `uses` keeps its existing algorithm-dependency meaning.

Asymmetric parameters have a second discriminator, `scheme`, inside each purpose
category. Closed contracts and semantic checks validate named curves, groups,
encodings and standard parameter sets. Byte lengths, field/modulus bits and NIST
security categories have distinct labels and units. They do not imply measured
attack costs. RSA profiles do not fix a public exponent; ECDSA profiles do not fix
a nonce-generation mode or signature serialization. A concrete analysis must
state those assumptions when relevant.

The shared directory and detail components receive an explicit domain. Existing
`/cryptanalysis/ciphers/:family/:instance` routes are unchanged. Asymmetric routes
use `/asymmetric-cryptanalysis/algorithms/:family/:instance`; family-only routes
open an overview. Mismatched domains or family/instance pairs are rejected.
Dependency links may cross domains, for example SM2 to SM3. Only the symmetric
directory merges the existing scientific target registry; asymmetric registration
does not create scientific variants, coverage totals or comparator inputs.
Hard-problem detail routes use `/asymmetric-cryptanalysis/problems/:id`; an
algorithm cannot resolve through that route, or vice versa. These pages show
definitions, parameters, related links and references without instance counts,
diagram placeholders or empty analysis tables. Integer Factorization additionally
shows populated analysis sections, with stable detail routes at
`/asymmetric-cryptanalysis/problems/integer-factorization/results/:id`.
Other hard problems remain definition-only. The compatibility adapter rejects
problem identities in the existing symmetric scientific target model; analyses
use the dedicated hard-problem branch of the shared corpus and export pipeline.

## Adding entries

1. Inspect a primary specification and record the edition, URL and locations.
2. Add a stable family ID in the appropriate domain category, and concrete instances
   with the appropriate parameters. Keep different schemes in separate families.
3. Link underlying families through `uses`; retain distinct construction identities.
4. Register explicit structure bindings and source locations in `diagrams.json`,
   then run `npm run diagrams:build`. See [Structure diagrams](structure-diagrams.md).
5. Run `npm run check:catalog`, `npm run check:diagrams`, `npm test` and affected browser tests.

For a hard problem, add a `problem_sources` entry and a `hard_problems` definition
with a supported parameter type, exact locators, formulations and scope conditions.
Do not create an algorithm instance or a structure binding. For Integer
Factorization, use the existing [hard-problem result contract](integer-factorization.md).
Extend its target semantics and comparison policy with tests before adding
analyses for another hard problem.

A supported-category addition is a data update and does not increment the
application version. A new parameter contract or display capability is a framework
change under the [version policy](versioning.md). For new scientific experiments,
extend the [result model](data-model.md) with dedicated tests before ingesting results.

## Analysis integration

Existing analysis instance IDs and deep links are preserved. A compatibility
adapter checks overlapping definitions, including AES key sizes, block sizes and
round counts. It rejects conflicting definitions rather than silently overriding
them. Directory-only instances never enter the cost comparator or audit totals.

The public build reads public definitions, questions and the validated public
analysis snapshot. It exports a
validated `atlas-catalog.json`; release checks compare that asset to its source and
continue scanning every asset for restricted material. The data revision in
`atlas-release.json` identifies the public input bytes, independently of the
application version. Original directory metadata uses the dataset license;
linked specifications retain their own rights and are not vendored.

Family and instance pages share a structure panel with analysis pages. Family
views use one symbolic drawing and an instance comparison; instance views use
exact catalog parameters. Attack filters do not change the primitive diagram.
Research variants without an explicitly checked binding show a pending notice.

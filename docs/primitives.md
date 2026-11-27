# Primitive, Construction and Hard-Problem Directory

`data/primitives/catalog.json` is the public directory. It includes category
labels, algorithm families, concrete instances, hard-problem definitions and source links.
It is available even when the selected release contains no analysis results.

## Contract

`schemas/primitives/catalog.schema.json` defines the version-4 closed contract: unknown fields
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

Explicit instance-level standardization bindings drive evidence-backed badges and
standard-first, withdrawn-last directory ordering. A citation, shared family or dependency never
grants adoption automatically. International standards, national standards,
national recommendations and withdrawn historical evidence remain distinct. See
[Primitive standardization](primitive-standardization.md) for the dated review,
scope rules and maintenance workflow.

The symmetric directory registers 144 families and 309 instances across seven
categories. It covers historical ciphers, AES candidates, lightweight designs,
stream ciphers, hashes, XOFs, permutations, AEAD constructions and MACs, including
ARADI. Six arithmetic-oriented families remain definition-only until exact
field/constant profiles are selected. See [Symmetric catalog coverage](symmetric-catalog-coverage.md)
for the dated inventory, inclusion policy and outstanding work. SHA-1 and MD5
retain visible collision-resistance warnings; their published specifications
are not incorrectly marked withdrawn.

Key-size variants have separate instance IDs. Camellia's FL layers do not count
as Feistel rounds; PRESENT's final key addition is not another SP round; MD5's
four rounds contain 64 compression steps. Salsa20 retains its original 64-bit
nonce/counter layout rather than inheriting the IETF ChaCha20 parameters. The
Chinese aliases for SM3 and SM4 are searchable.

Hash includes complete hashes and explicitly tagged **Compression Function**
entries; its stable category ID remains `hash_function`. AES-DM has AES-128/192/256
instances; AES-MMO and AES-MP currently bind AES-128. These are single compression
steps, not complete variable-length hashes: no iteration, padding rule or secret
key is implied. The `block_cipher_compression` contract records mode, exact cipher
instance, message/chaining/output widths and underlying cipher rounds. MMO/MP
with unequal key/block widths require a separately defined mapping and are not
silently generated. HMAC accepts complete hashes, not compression components.

Scientific targets bind the same dependency and construction definition. Explicit
compression experiments belong to that construction; chosen-key/known-key cipher
analyses remain under AES even when their discussion mentions hashing. Dependency
links connect pages without copying results or combining counts. An old result
URL with an underlying AES instance normalizes only when the record has one
matching compression target; ordinary AES pages and ambiguous/mismatched contexts
are not redirected.

Version 4 preserves native units and construction boundaries. Public tweaks and
total tweakeys are separate from secret keys. Feedback and word-oriented stream
ciphers record state sizes, output per step and initialization steps without
inventing counter fields or block-cipher rounds. RC4 profiles have no implicit
nonce. Compression hashes distinguish chaining values, internal working states,
rounds and tree chunks; sponge input/output rates remain separate when necessary.
Permutation steps are not silently converted to rounds. HMAC binds an actual
hash instance and accepts variable-length keys; one-time MAC keys and
nonce-based MACs are distinct. Deterministic SIV has no fabricated nonce length.
Prime-field contracts use exact decimal modulus strings and field-element units,
with probable-prime and exponent-invertibility checks. These structural checks
do not certify a parameter set's security.

Source metadata can identify a standard, RFC, design paper, competition submission
or designer specification. Optional citation observations retain the provider,
work identity, title, count, evidence URL and observation date. Family-level
inclusion reasons are independent of standardization and analysis coverage.
The `high_citation` reason requires an identified source with a recorded count
strictly above 300. Neither a shared schema nor a citation threshold creates an
analysis target or a security endorsement.

The asymmetric directory registers 41 families and 100 instances across public-key
encryption, key agreement, digital signatures and key encapsulation. RSA-OAEP and
RSA-PSS have separate families and explicit SHA-256/MGF1 profiles. SM2 encryption,
signatures and key exchange also have distinct identities. ECDH and X25519/X448
are separate from ECDSA and EdDSA, even where their mathematical foundations are
related. ML-KEM, ML-DSA and SLH-DSA use the final FIPS parameter-set names rather
than treating pre-standard proposals as identical algorithms.

The expansion includes classical encryption and authenticated key-agreement
definitions, SM9's three distinct purposes, additional signature schemes and
code-/lattice-based KEMs. Thirteen generic families have source-backed definitions
and explicit parameter scopes rather than arbitrary numerical profiles. SLH-DSA
now includes all twelve FIPS sets. See [Asymmetric catalog coverage](asymmetric-catalog-coverage.md)
for the inventory, pinned source editions and remaining profile work.

LOL2.0 includes Mini and Double LFSR2 stream profiles and separate 128-bit-tag
SCMAC AEAD profiles; original LOL is not registered. The SCMAC contract binds the
exact stream instance and checks its key, IV, output rate, initialization steps
and separate stream/authentication state sizes. uBlock includes its three
original block/key profiles.

Named KEM encodings are checked against the source-edition tables in
`lib/node/primitive-parameter-sets.cjs`. HQC v5.1's seed key, salted FrodoKEM's
ciphertexts and the selected NTRU/NTRU Prime submission editions remain distinct.
BIKE does not acquire a fictitious fixed private-key encoding from a bit-storage
bound. Stateful signature contracts require signing state and distinguish WOTS+
Winternitz bases from LM-OTS digit widths. Falcon's padded signature length is not
an average compressed length.

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
   Review each new instance for standardization, updating the explicit review
   inventory and any source-backed adoption bindings; no binding means unverified.
4. Register explicit structure bindings and source locations in `diagrams.json`.
   A not-yet-drawn instance needs an explicit `pending` binding with empty views,
   not a generic or guessed diagram. Definition-only families have no instance
   binding. Run `npm run diagrams:build` after registry changes; see
   [Structure diagrams](structure-diagrams.md).
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
New parameter constructions require a dedicated scientific adapter before they
can overlap with the existing analysis registry; the validator rejects implicit
reinterpretation of their fields as the old key/block/round contract.

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
Instances awaiting a drawing expose their parameter table directly. Definition-only
families expose the source and parameter scope without manufacturing a numeric
instance or figure.

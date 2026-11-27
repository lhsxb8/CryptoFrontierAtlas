# Symmetric Catalog Coverage

Snapshot: **November 27, 2026**. This inventory describes algorithm definitions,
not a cryptanalysis survey or a recommendation to deploy an algorithm.

## Inventory

| Category | Families | Concrete instances |
| --- | ---: | ---: |
| Block Ciphers | 53 | 124 |
| Stream Ciphers | 16 | 20 |
| Hash Functions | 29 | 61 |
| Extendable-Output Functions | 6 | 10 |
| Permutations | 6 | 17 |
| Authenticated Encryption (AEAD) | 25 | 55 |
| Message Authentication Codes | 9 | 22 |
| **Total** | **144** | **309** |

The November 26 expansion grew the directory from 19 families / 39 instances
to 138 / 297. Separate AES compression targets and the November 27 uBlock/LOL2.0
additions bring it to the inventory above. Scientific attack records are unchanged
by the latest algorithm-definition expansion. Application and data contract
versions follow their independent policies.

The inventory includes SQUARE, the AES finalists, SIMON/SPECK, SKINNY/MANTIS,
GIFT, QARMA, ARADI, Trivium, Grain, HC-128/256, Rabbit, SNOW, ZUC, RIPEMD,
BLAKE/BLAKE2/BLAKE3, SHA-3 finalists, PHOTON/SPONGENT/Quark, Ascon functions,
KangarooTwelve, NIST LWC finalists, CAESAR designs and common MAC constructions.
Family names, instances, sources and precise parameters are maintained in
`data/primitives/catalog.json`; this document is not a second parameter registry.

## Inclusion and citation evidence

The November 27 follow-up adds uBlock-128/128, uBlock-128/256 and uBlock-256/256;
LOL2.0-Mini and LOL2.0-Double with their default LFSR2 configuration; and their
separate 128-bit-tag SCMAC constructions. Mini's IV is 128 bits, Double's 256 bits.
Authentication-state sizes are not folded into the stream-state values. Only
LOL2.0 is registered; original LOL and its earlier variants are excluded.

There are two independent routes into the directory:

1. **High-citation reference.** An identified original design, specification or
   standard has more than 300 citations in a dated bibliometric observation.
2. **Coverage value.** A standard/RFC, design competition, historical design,
   research construction, recent proposal or maintainer-requested algorithm can
   be included independently of its citation count.

The current snapshot assigns `high_citation` to 36 families. OpenAlex observations
preserve the matched work ID, source title, count and date. Multiple algorithms
may share one design paper, but counts from different editions or providers are
never added. Search hits about attacks on a design do not count as its design
paper. A count of exactly 300 does not qualify. Source-level observations remain
available even when a family enters through a different route.

Citation counts are dated selection evidence, not live counters or security
rankings. This batch is a bounded screening pass, **not a certified census of
every symmetric algorithm whose design has over 300 citations**. Name ambiguity,
split editions and incomplete indexing need further matching. Additional
bibliometric queries were stopped by the provider's daily anonymous quota.
No inferred counts or aggregated preprint/proceedings counts fill those gaps.
Follow-up candidates include SIMECK, SEA and HAVAL; other profile-level additions
include Grain-128a, ZUC-256 and XXTEA. Their absence is not a subthreshold claim.

ARADI is registered from its 2024 design specification as a recent research
proposal, not as a selected standard or an asserted standardization candidate.
Its block cipher is separate from LLAMA. Historical designs and withdrawn
standards remain searchable with their source-specific status and qualifications.

## Parameter and figure boundaries

MiMC, Poseidon, Poseidon2, Rescue, Rescue-Prime and Anemoi have family definitions
and parameter-scope notes but no invented concrete field profiles. Selecting a
profile requires its field, width, round schedule, constants and encoding to be
fixed against an exact source version. A named security target alone is not an
instance definition.

Round conventions are retained explicitly: for example, TEA cycles are not
single Feistel updates, QARMA's central nonlinear layers are counted, and
SPARKLE steps are not relabeled as generic cipher rounds. PHOTON hashes and
their permutations are separate entries. HMAC keys, Poly1305 one-time keys and
deterministic SIV nonce handling keep their native semantics.

New concrete instances have explicit pending diagram bindings. No generic image
is presented as a source-checked structure. The 219 existing reviewed figure
assets remain available; new instance pages show parameter tables while their
drawings await authoring and review. No attack results, SOTA claims or analysis
comparisons are created by directory registration.

## Updating this inventory

### November 27, 2026: compression-target correction

The Hash category now includes AES-DM, AES-MMO and AES-MP as tagged compression
functions, with five concrete instances and eight source-checked overview assets.
That compression-target change brought the symmetric directory to **141 families / 302 instances**
and the full figure library to **227 assets**. The November 26 inventory above
remains the expansion-batch baseline. Sixteen existing compression results moved
from AES to their construction targets, with IDs, claims and reviews preserved;
this correction adds no attacks and makes no new bibliometric claim.

### Maintenance

Use the [directory authoring workflow](primitives.md#adding-entries). Match the
primary source and version before recording parameters; preserve the provider
identity and observation date before asserting citation qualification. Run catalog,
diagram, source/bundle and browser checks, and update this inventory after a
coherent batch. Public data contains source metadata, not downloaded papers,
research-session notes or raw bibliometric API responses.

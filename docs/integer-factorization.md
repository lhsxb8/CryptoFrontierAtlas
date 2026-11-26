# Integer Factorization

The Hard Problems directory opens a definition followed by Classical Algorithms,
Quantum Algorithms and Factorization Records on one page, without tabs.
Search and goal filters do not merge these sections. Each result has a stable
detail route, source-edition evidence, coupled parameters, native resource units,
success semantics and review limitations.

## Initial extraction

The November 26, 2026 batch selects ten papers with a publication or inspected
revision in 2023–2026. These are examples, not an exhaustive census or a claim to
the ten globally latest papers. Exact PDF SHA-256 hashes and checked passages are
registered in the shared sources registry. The collection contains eight
algorithm-level configurations, one supporting subroutine and one reported
computation; all ten are organized as singleton parameterized families.

| Work | Inspected version | Selected contribution |
| --- | --- | --- |
| Regev | arXiv 2308.06572v3, 2024 | Conditional nontrivial-factor algorithm; probability conflict retained |
| Ragavan–Vaikuntanathan | arXiv 2310.00899v5, 2025 | Noise-robust postprocessing under its stated sample/noise model |
| Pilatte | arXiv 2404.16450v3, 2026 | Unconditional modified-base nontrivial-factor algorithm |
| Ekerå | arXiv 2201.07791v2, 2022; associated publication 2024 | Complete-factorization success with one quantum order-finding run |
| Kahanamoku-Meyer et al. | arXiv 2412.12558v4, 2026 | Complete factorization of integers with distinct prime exponents |
| Harvey–Hittmeir | arXiv 2601.11131v2, 2026 | Large-order element **or** nontrivial factor |
| Gao et al. | arXiv 2512.19076v1, 2025 | Deterministic balanced-semiprime factorization |
| Stănică | arXiv 2611.06580v1, 2026 | Author-proved general deterministic asymptotic bound |
| Dąbrowski–Pomykała–Shparlinski | arXiv 1912.00345v4, 2023 | Oracle-assisted nontrivial factor for almost all inputs |
| Januszewski–Heinrichs | arXiv 2610.07126v1, 2026 | Reported July 14, 2026 CUDA-MPQS computation on RSA-155 |

The checked unit is the cited theorem, algorithm or run, not every result in each
paper. Standalone quantum circuit/implementation optimizations in the mixed
Ragavan–Vaikuntanathan and Jacobi papers remain excluded. The collection retains
their algorithm-level contributions separately. Historical GNFS/SNFS, ECM,
quadratic-sieve and Shor baselines and the remaining parameter tradeoffs need
further extraction before any broad frontier assessment.

The Regev edition gives inconsistent numerical statements for a lattice-event
probability in its corollary and theorem proof. The primary success remains
unresolved. Pilatte's modified algorithm is not recorded as an unconditional
proof of Regev's original deterministic small-base choice. The Jacobi input class
excludes ordinary RSA semiprimes. Oracle-assisted bounds exclude the computation
of the assumed oracle. An exceptional-set density is not a probability of success
on a particular RSA input.

The RSA-155 run retains GPU-hours, elapsed hours and GPU-board energy separately,
including the CPU coordination boundary. A reported successful run does not
establish a general success probability, a new general-factorization record, or
an independently checked factor witness.

## Maintainer updates

Add detailed configurations to `problem-results/` and family references to
`problem-analyses/integer-factorization.json` inside the maintained corpus.
Register each inspected source once in `sources.json`. Do not synthesize cipher
variants, round counts or Q1/Q2 labels for public-integer quantum computation.

The first extraction uses two five-paper batches with pre-ingestion fingerprints
and structured receipts under the existing provenance mechanism. The legacy
cipher screening payload cannot represent a hard-problem target; these examples
use the scoped direct-review handoff, not fabricated cipher records. Receipt
decisions retain why targeted reading was required. Extraction completion does
not imply a full-paper audit, independent reproduction or a numerical frontier.

Run scientific checks, export, field-policy checks and independent public
validation through the normal pipeline. New fields require explicit publication
classification. Public builds need no PDFs, private corpus or review receipts.
The existing licenses and application version policy are unchanged.

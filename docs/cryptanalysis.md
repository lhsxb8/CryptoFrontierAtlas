# Cryptanalysis data

The cryptanalysis model describes attacks, distinguishers, structural properties
and bounds. A result connects a precise target and setting to its parameters,
resources, success event and source evidence.

## Records

| Record | Purpose |
| --- | --- |
| Result | Detailed statement, target, setting, costs, success and evidence |
| Entry | Compact configuration, with a detailed-record reference when available |
| Result family | Formula, discrete table or fixed point from one construction |
| Source | Bibliography, inspected version, result locations and content hash |
| Cipher and instance | Algorithm identity, parameters and round conventions |
| Manifest | Dataset version and canonical record list |
| Problem result | Hard-problem target, input class, output goal and algorithm/run evidence |
| Problem analysis catalog | Family references, bounded coverage and internal ingestion receipts |

Contracts live in `schemas/cryptanalysis/`. The taxonomy registry defines result
kinds, goals, methods, key models and attack surfaces. See
[Extending the result model](data-model.md) for compatible additions.

## Parameters and comparison

Keep time, data, memory, preprocessing and success attached to the same parameter
assignment. Formula families include parameter meanings and feasible domains;
discrete tables represent distinct source-reported choices.

Compare matching instances, round boundaries, goals, settings, methods, success
events and cost accounting. Preserve native resource units. Structural properties
and algebraic representations have their own result kinds.

Success identifies the source-defined primary event. Component probabilities,
false-positive rates and experimental frequencies are recorded separately.
Unquantified values retain their evidence status.

## Data tooling

The public snapshot is in `data/cryptanalysis-public/`. It includes the retained
detailed records and compact configurations, not only frontier points. Publication
preserves source conflicts, qualifications and reproduction status. See
[Published analysis data](published-data.md) for its scope and validation.

Run these commands from the application root:

| Command | Purpose |
| --- | --- |
| `npm run check:published-data` | Validate the public snapshot independently |
| `npm run export:analyses` | Export a reviewed local corpus to the public snapshot |
| `npm run check:analysis-export` | Require an exact, up-to-date export of the local corpus |
| `npm run check:analyses` | Validate local records, references, families and ingestion evidence |
| `npm run check:progress` | Check local literature and review progress |
| `npm run index:analyses` | Update derived indexes |
| `npm run report:analyses` | Generate collection and progress reports |
| `npm run report:sota` | Generate the frontier review report |
| `npm run check:sota` | Validate frontier review inputs |

Validation is read-only. Exporting updates the public snapshot and removes its
temporary rollback copy after success. Indexing updates derived metadata;
report commands write generated outputs. All commands except public validation
require the maintained local corpus configured through `atlas.config.cjs`.
The CLI and build adapter share scientific validation and comparison logic.
Hard-problem catalogs have their own review/search dates; adding their sources does
not advance the AES census cutoff or imply a new AES review. The current report
and progress commands retain their AES-specific scope. See
[Integer Factorization](integer-factorization.md) for the bounded example collection.

## Contributions

Use [Report](result-submissions.md) to submit results, corrections or verification
evidence. Include the source version and exact locations supporting each claim.

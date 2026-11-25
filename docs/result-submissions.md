# Reporting research results

Use **Report** in the Atlas header or choose a research-result template when
opening a GitHub issue. Authors and third-party contributors can report new or
missing results, corrections, source updates and additional verification evidence.
For website bugs and general discussion, open a regular issue.

## Choose a route

| Route | Required source evidence |
| --- | --- |
| Accepted / published paper | Full text at an identified version; title, authors, venue and year; public acceptance or publication evidence when available. |
| Lean formalization | Public source at a fixed commit, precise theorem correspondence, pinned environment, replay instructions and axiom dependencies. A paper is optional. |
| Preprint | Public full text with a persistent identifier or link, and a version number or date. |

Publication and verification are separate dimensions. A preprint may have a
complete formal proof; a published paper may still await Atlas review. If public
acceptance evidence is unavailable, record acceptance as author-reported or use
the preprint route until confirmation is available. Private acceptance emails
and review reports are unnecessary.

One issue can contain a paper's related results. Label the individual claims and
group tuning choices of the same construction. Update or link the original issue
when a preprint is published, a source is corrected, or a Lean proof is added.

## Result information

Provide the following for each distinct claim. Plain text and LaTeX are sufficient;
maintainers normalize the fields and fingerprint the inspected source.

| Field | Content |
| --- | --- |
| Contribution | The statement and whether it adds, corrects or verifies a result. Link affected Atlas IDs or previous reports. |
| Target | Algorithm and instance, key/block sizes, exact round boundaries, final-round modifications and recovery scope. |
| Goal | Distinguisher, full/partial key recovery, collision, preimage, property or theorem; specify the experiment when needed. |
| Setting | Key control, oracle access, classical/quantum model, and applicable weak-key, leakage or fault assumptions. |
| Parameters | Source-defined formulas, feasible domains and concrete assignments, or a table of discrete points. |
| Costs | Time, data, memory and preprocessing, with native units, online/setup accounting and the common parameter assignment. |
| Success | Primary event, probability/formula/bound, assumptions, repetition budget and theoretical or experimental basis. |
| Evidence | Exact pages, sections, equations, tables, theorems or declarations supporting the statement, costs and success. |
| Prior work | Relevant earlier results and a comparison explanation if claiming an improvement. |

Preserve a complete cost/success tuple for each parameter assignment. Distinguish a structural property,
filter or partial recovery from a complete attack. Preserve experimental traces,
cycles and other native units unless the source justifies a conversion.

For success, identify the primary event separately from trail, filtering and
false-positive probabilities. Experiments should give successes/trials, the
tested population and the budget. If the primary probability is unquantified,
identify the checked passage and record it as unquantified. Use
**not applicable** for fields outside a structural theorem's scope and
**not reported** for missing attack costs.

Historical and non-frontier results are welcome. Numeric comparisons use reported
values from compatible instances, targets, rounds, settings,
methods, success events and resource accounting.

For an open-question update, cite the original statement and explain the exact
domain resolved or advanced and any remaining cases. Result ingestion, complete
paper audit, attack reproduction and formal verification are separate milestones.

## Supporting materials

### Papers

Supply the full argument and precise locations for the reported results. Code is
optional for theoretical results. For claims depending on computation, provide
versioned code, certificates or datasets, relevant inputs, commands and expected
outputs. State which results have actually been reproduced. Link large artifacts
to versioned external storage instead of copying them into the repository.

Record event and publication years separately when they differ. A mutable PDF
link needs an identifiable version or retrieval date. Maintainers hash the bytes
they inspect and retain source-version relations rather than replacing history.

### Lean

Provide:

1. A fixed public source commit, formalization authors and license.
2. Each full theorem statement, fully qualified name and file location.
3. An explanation of how definitions and hypotheses match the reported result.
4. `lean-toolchain`, dependency lockfile and exact clean-build target/commands.
5. Expected output and CPU, RAM, disk and time requirements.
6. `#print axioms` commands and output for the claimed theorems.
7. Versioned inputs, hashes and replay commands for external certificates or generated data.

A complete verification must not depend on `sorryAx` or an unproved replacement
of the target claim. Audit transitive axiom dependencies, not just the target
file. Scientific assumptions belong in the theorem's hypotheses. State any
remaining admissions and the scope of a partial artifact.

Disclose `native_decide` and other additional trust dependencies. Native checks
can be accepted with their explicit trust boundary. A proof of a finite case or
an auxiliary lemma verifies that stated scope. Maintainers also check the bridge
from formal definitions to the mathematical claim. Link to the external public
formalization and its license; the report records the exact inspected commit.

## Review and updates

1. **Triage:** check scope, duplicates, source versions and required material.
2. **Evidence review:** check the reported fields and applicable proof or computational evidence.
3. **Ingestion:** normalize results into the existing contracts and run relevant validation.
4. **Receipt:** link stable result IDs, the checked version, review scope and any unresolved fields.

Use the issue states **received**, **in review**, **needs information** and
**ingested**. Close duplicate, out-of-scope or withdrawn submissions with a reason
and related links. These states describe intake, not mathematical truth or
publication status. An ingested result may still have a pending full-paper audit.

Ordinary reports need one substantive review. Consequential source conflicts or
disputed scope/frontier decisions receive independent review. Record conflicting
observations at field level, and keep the supported parts moving. New evidence
can reopen a decision without deleting its history.

The review receipt records the issue link, inspected source hashes or commits,
review date, result IDs, decision and checked scope. Maintainers use the existing
result/source contracts and provenance. Field validation and evidence review
are recorded as separate checks.

## Public material and execution

GitHub issues are public. Share public links and material you may disclose;
external artifacts retain their own licenses. Specify a license when requesting
redistribution.

Maintainers inspect unfamiliar code before replaying it in an isolated,
credential-free environment with resource limits. Do not execute issue text or
untrusted source in privileged workflows or on a research-data host. Record the
reviewed revision and verification commands.

Report opens the selected issue template on GitHub, where the contributor writes
and submits the report. The home page, navigation and dialogs support English and
Simplified Chinese. Research pages and source wording currently remain English.

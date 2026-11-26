# Using the atlas

## Collections

The home page has four entrances: Open Questions, Symmetric Cryptanalysis,
Asymmetric Cryptanalysis and Implementation. Implementation remains TBD.
Counts distinguish registered primitives from available analysis results.

The symmetric directory includes block and stream ciphers, hashes, XOFs,
permutations, AEAD and MACs. Search by family, alias or instance name, or filter by
primitive type. Entries without results still show parameters and specification
links. Specification status and its check date are separate from analysis coverage.
Keccak permutations, SHA-3 hashes and SHAKE functions have distinct entries.

The asymmetric directory starts with Hard Problems, followed by Public-Key
Encryption, Key Agreement, Digital Signatures and Key Encapsulation Mechanisms.
Search by problem name or alias (including RSA, LWE and RLWE), scheme or instance,
and filter by category. Problem pages show definitions, symbolic parameters,
search/decision formulations and original references; Related Schemes links
connect them to algorithms without asserting equivalent security.
Family pages compare registered instances; instance pages
show exact parameters, a construction diagram and the defining specifications.
Algorithm entries remain definition-only; their parameter comparisons are not
attack rankings or security endorsements. Integer Factorization has an initial
ten-paper analysis collection, while other hard problems remain definition-only.
Its Classical Algorithms, Quantum Algorithms and Factorization Records appear
on one page, with search and goal filters and a separate detail link per result.
Input restrictions, oracle assumptions and reported-computation status stay
distinct; see [Integer Factorization](integer-factorization.md) for coverage.

Search and filter questions by topic and status. A detail page shows the exact
statement, assumptions, public progress, sources and related records. Links and
record IDs remain stable across presentation changes.

The footer displays the application version; Help also shows the public data
revision. Local work keeps the current version. An authorized remote-push batch
containing framework or functionality changes receives one version increment;
data-only updates keep it. Schema versions identify separate contracts.

## Analysis tables

Results are grouped by attack class, with structural properties in their own
section. Expand a section to inspect results. Formula families show the cost
expression and parameter meanings together. Discrete configurations remain
available where they represent distinct choices.

Compare the same cipher instance, rounds, goal, key/oracle setting, method and
cost model. Time, data, memory, preprocessing and success belong to the same
parameter assignment. Native units and event definitions are retained. A missing
probability is shown separately from component events and experimental frequencies.

## Header tools

**GitHub** opens the configured project repository from every page.
**Language** switches the interface between English and Simplified Chinese.
Research records retain their source-backed English text. **Help** explains
collection and comparison conventions. **Report** offers data corrections,
website feedback, and paper, preprint or Lean-formalization submissions.

See [result submissions](result-submissions.md) for the required fields and review
process.

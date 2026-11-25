# Question dataset

English-language records in `data/questions/problems/` describe source-backed
open questions and their public progress. `manifest.json` is the canonical list
and count. `taxonomy.json` defines the classification.

Every record has an atomic statement, scope, source lineage, independent status
dimensions, dated progress and relations. Each status update cites the supporting
publication or versioned artifact and identifies the exact scope established.

`npm run check:data` validates the schema, provenance, taxonomy, timeline,
citations, manifest and relations. The frontend imports the same canonical JSON;
integration tests check exact equality and inclusion.

See the [data contract](data-contract.md), [submission guide](result-submissions.md)
and [dataset license](../LICENSE-DATA.md).

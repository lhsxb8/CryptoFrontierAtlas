# Version policy

The initial application release is **v1.0.0**. `package.json.version` is the
authoritative application version, without the `v` prefix. The lockfile, website,
build metadata and release citation must agree with it. Release tags use `v`.

## When to increment

- Questions, analysis results, primitive directory entries, source corrections,
  editorial changes and documentation-only updates keep the application version.
- Framework, functionality and runtime behavior changes increment the application
  version. An agent defaults to the patch component: `1.0.0` becomes `1.0.1`.
- Only an explicit maintainer instruction authorizes a major or minor increment.
  Explain compatibility-breaking changes and obtain direction before making them.
- Increment once per release batch, not once per commit, retry or agent session.
  All preparation for the initial release remains at `1.0.0`.

This is the project's release policy; new features do not automatically require a
minor increment. Builds and data-maintenance commands never increment versions.
Keep a matching application entry in `CHANGELOG.md` and run `npm run check:version`.

## Data revisions and contracts

`atlas-release.json` records the application version and a deterministic
`data_revision` derived from the public question and primitive-directory files.
The same application version can serve successive data revisions. Use the data
revision or exact repository commit when citing a particular dataset snapshot.

Scientific `schema_version`, taxonomy versions, inspected source versions and
historical dataset metadata identify separate contracts and evidence. Preserve
them; an application release is not a scientific data migration. A schema change
requires compatible readers, validation and regression tests.

## Release identity

Keep release tags immutable. Data-only updates do not move `v1.0.0` or create a
new application version. Record the actual application release date in
`CITATION.cff`; a later data update does not change that historical date.
Before publication, run `npm run check:publication`. Release-tag CI also checks
that the tag matches the application version, independently of Pages deployment.

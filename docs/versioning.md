# Version policy

The initial application release is **v1.0.0**. `package.json.version` is the
authoritative application version, without the `v` prefix. The lockfile, website,
build metadata and release citation must agree with it. Release tags use `v`.

## When to increment

- Questions, analysis results, primitive directory entries, source corrections,
  editorial changes and documentation-only updates keep the application version.
- Local edits, local commits, agent sessions, tests and builds keep the current
  application version. Collect pending work under `Unreleased` in `CHANGELOG.md`.
- When preparing an explicitly authorized push to the remote repository, review
  the complete outgoing batch. If it changes the framework, functionality or
  runtime behavior, increment the application version once, before the final
  checks and commit. An agent defaults to the patch component: `1.0.1` becomes
  `1.0.2`. A data-only or editorial push still keeps the version.
- Only an explicit maintainer instruction authorizes a major or minor increment.
  Explain compatibility-breaking changes and obtain direction before making them.
- Increment once per outgoing change batch, not once per commit, push retry,
  branch synchronization or CI run. A failed or rejected push reuses the already
  prepared version. Pushing the same checked commits or their release tag again
  is not a new version event.
  All preparation for the initial release remains at `1.0.0`.

This is the project's release policy; new features do not automatically require a
minor increment. Do not install version-bumping Git hooks or build/CI side effects.
Version preparation does not authorize a push, merge, deployment or tag creation.
Keep a matching application entry in `CHANGELOG.md` and run `npm run check:version`.
The check is read-only and permits pending `Unreleased` notes above that entry.

At the authorized push boundary, update `package.json`, both root lockfile version
fields, the README release label and `CITATION.cff` together; move this batch's
notes into the new changelog entry. Use the actual release date, and rerun version,
publication and affected application checks. Do not predate a local work-in-progress
as a released version.

## Data revisions and contracts

`atlas-release.json` records the application version and a deterministic
`data_revision` derived from the public question, primitive-directory and
published-analysis files.
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

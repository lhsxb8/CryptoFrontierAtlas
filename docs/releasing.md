# Publishing a release

## Application and data versions

Follow the [version policy](versioning.md). The initial application release is
v1.0.0. Data-only updates retain the application version and receive a different
content-derived data revision. Keep existing release tags immutable.

`npm run check:version` checks the package, lockfile, changelog and any citation.
The build publishes `atlas-release.json` with its application version and data
revision, and `atlas-catalog.json` with validated public primitive definitions.
Release checks reject stale metadata, a catalog that differs from its source,
or an analysis asset that differs from the validated public snapshot.

## Publish analysis updates

In the maintainer workspace, finish research review before exporting:

```sh
npm run check:analyses
npm run check:progress
npm run test:corpus
npm run export:analyses
npm run check:analysis-export
```

Review and commit `data/cryptanalysis-public/` with the application source. Keep
`data/cryptanalysis/` ignored: it remains the maintained research corpus, including
internal ingestion history. Do not copy downloaded papers, reports, credentials
or local agent instructions into the public repository. The exporter preserves
scientific records and public evidence while separating private workflow material;
see [Published analysis data](published-data.md).

A clean checkout uses the committed snapshot and does not run the export command.
`npm run check:published-data` and `npm run build` work without private files.
The default build includes analyses. `build:local` is a maintainer-only build and
is rejected by the public distribution check.

## Checked preview

For a local public preview:

```sh
npm run build
npm run preview
```

`preview` defaults to `127.0.0.1:4173`. Before listening it runs the public bundle
check on the actual resolved output directory, including explicit `--outDir`
selection. Missing or internal output, stale analysis/catalog metadata and changed
registered assets are refused. A LAN
demonstration may explicitly use `npm run preview -- --host 0.0.0.0 --strictPort`
after a successful public build. Keep the checked output unchanged while served;
stop the preview before replacing files and restart it to revalidate them.

Internal inspection uses `npm run build:local` followed by `npm run preview:local`.
It requires an internal build receipt and a loopback host. Never use an internal
build for public deployment, or a development server for a LAN demonstration.
The development data profile controls the application projection, not permission
to download workspace files. Both development profiles deny private file access.

Use these npm entrypoints rather than calling `vite preview` directly, which
bypasses the preview wrapper's checks. For internet deployment, upload the checked
`dist/` to a static host; the preview is a local verification tool.

Public static files must be registered in the checked asset inventory. Adding an
unregistered file or a symlink under `public/` fails checks and builds; changing
a registered asset requires its reviewed fingerprint to be updated as well.

## Project identity

Set the canonical repository URL in `project.config.json`. The website uses it
for repository and reporting links.

Maintain `CITATION.cff` with the authors or authoring organization, release version
and date, configured `repository-code`, and CC-BY-4.0 dataset license. Use CFF 1.2.0.
`npm run check:publication` validates these fields and the matching application
version. Keep identity pending until the maintainer supplies it; do not invent
authors, repository URLs or publication dates.

## Validate the release

```sh
npm ci
npm run check
npm audit --audit-level=low
npm run build
npm run check:release
npx playwright install chromium
npm run test:ui
npm run check:publication
```

Review the candidate file list and Git diff. Tag the checked revision with the
release version. Publish the repository source and deploy the generated `dist/`
artifact.
The checked artifact includes its analysis JSON, profile and release receipts,
diagram assets, and all license notices. Publish them together; do not upload
only the JavaScript and HTML files.

Run the publication check for source-only releases too. CI runs on `v*` tags and
checks both identity and tag/version agreement even when Pages is disabled.
In a workspace without Git, initialize the repository and configure its remote
only after the publication destination is confirmed. Review the candidate source
list before staging; a source release includes the public snapshot, not the raw
research corpus. Git initialization, pushing and deployment are separate,
explicitly authorized operations.

After dependency updates, regenerate notices with `npm run licenses:generate` and
commit the lockfile and generated notices together. The build includes complete
software, data and third-party license materials.

## GitHub settings

In the repository, open **Settings → Rules → Rulesets → New ruleset → New branch
ruleset**. You need repository administration permission. Name it `protect-main`,
set **Enforcement status** to **Active**, and target the default branch (or the
exact branch name `main`). Keep the bypass list empty for routine work.

Enable:

- **Restrict deletions**.
- **Block force pushes**.
- **Require a pull request before merging**. Use **0 required approvals** for a
  sole maintainer; require 1 when an independent reviewer is available. GitHub
  does not count approval of one's own PR.
- **Require status checks to pass**, selecting the existing **Public checks**
  check from GitHub Actions, and **Require branches to be up to date before
  merging**. If the check is not offered, run the existing CI workflow and select
  its completed check; do not invent a check name.

Save the ruleset. Do not enable **Restrict updates**: it would also prevent normal
PR merges without bypass permission. Do not require **Deploy verified artifact**
on PRs; deployment only runs after trusted `main` updates. Repository files and
this guide do not activate protection on GitHub by themselves.

The deploy key can still push work branches if it has write access. Open a PR
from a work branch into `main`, wait for **Public checks**, and merge through the
GitHub UI. A deploy key is not a GitHub API credential for changing rulesets.
Verify protection with the saved rule summary and a normal PR, not a destructive
force-push or branch-deletion experiment.

See GitHub's [ruleset creation guide](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
and [available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

For optional Pages hosting, select GitHub Actions as the Pages source and
restrict the `github-pages` environment to `main`.

Set the repository Actions variable `ATLAS_PAGES_ENABLED` to `true` when deployment
is wanted. Trusted main-branch runs upload the checked artifact; a separate job
deploys it. PR runs have no deployment step. Enable dependency alerts and private
vulnerability reporting.

After enabling Pages, run **Actions → Public checks and Pages → Run workflow**
on `main`, or push a reviewed update to `main`. Confirm that both **Public checks**
and **Deploy verified artifact** succeed; a green checks job alone does not mean
the website was deployed. Verify the version and data revision in the live
`atlas-release.json` and check the actual website. Keep the README website link
and the repository's **About → Website** field aligned with the Pages URL.

Dependabot checks npm and GitHub Actions weekly. Routine minor and patch version
updates are grouped by ecosystem, with at most two open version-update PRs per
ecosystem. Major upgrades remain separate and require review; there is no
automatic merge. Security updates remain enabled independently of these
version-update groups. Enable **Automatically delete head branches** in the
repository settings to remove merged work branches.

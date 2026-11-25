# Contributing

## Research results

Submit an issue using the accepted/published paper, Lean formalization or preprint
template. The [submission guide](docs/result-submissions.md) describes the shared
fields, evidence requirements and review process. Keep related claims from one
paper in one report and update it when a new version becomes available.

Keep mathematical status, publication status and verification status separate.
Preserve result IDs, inspected source versions, evidence locators, native cost
units and success events. Costs and success must refer to the same parameter
assignment. Record source conflicts explicitly.

Contributions are licensed under the existing license for their respective
files: Apache-2.0 for software and CC BY 4.0 for original curated question,
primitive-directory and published analysis data. The analysis snapshot carries
its [scope notice](data/cryptanalysis-public/README.md).
Identify third-party material and its license. Submit only material you are
authorized to share.

## Application changes

Use Node.js 24 and the root lockfile:

```sh
npm ci
npm run check
npm run build
npm run check:release
npm run test:ui
```

Add synthetic regression tests for behavior changes. Browser tests cover desktop
and mobile layouts using the production build. Install Chromium once with
`npx playwright install chromium`.

Keep scientific logic in `lib/cryptanalysis/`, filesystem adapters in
`lib/node/`, and views in `src/`. Author taxonomy changes in
`schemas/cryptanalysis/result-taxonomy.json`, then run `npm run sync:analysis-model`.
See [architecture](docs/architecture.md) and [model extensions](docs/data-model.md).

Follow the [version policy](docs/versioning.md). Data-only updates keep the
application version. Framework and functionality changes default to a patch
increment; major and minor increments require explicit maintainer direction.
Increment once per release batch. The initial release is v1.0.0.

Directory-only additions use the [primitive catalog contract](docs/primitives.md).
Adding a primitive does not establish result-model support or literature coverage.

## Files and assets

Commit source files, documented data and reproducible tests. The generated
`data/cryptanalysis-public/` snapshot is committed so independent checkouts can
build the full site. Do not edit it directly: submit research evidence or
corrections through an issue; maintainers update the research corpus, review it,
and regenerate the snapshot with `npm run export:analyses`. See
[Published analysis data](docs/published-data.md).

Keep build outputs, raw research material, internal audit reports and
machine-specific configuration in ignored paths. Run `npm run check:release`
before publishing a website build.

## Pull requests

Describe the change and the checks run. Keep structural migrations separate from
scientific reinterpretation. Preserve existing record IDs and routes. Use a small
module within the existing application when it covers the feature.

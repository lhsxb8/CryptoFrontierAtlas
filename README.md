# CryptoFrontierAtlas

A source-backed cryptography research atlas with searchable open questions,
a symmetric primitive directory and cryptanalytic result views.

Explore precise statements, attack settings, complexity bounds, success
probabilities and the literature behind them. Records connect related questions
and results through stable links.

The initial application release is **v1.0.0**. Open questions currently focus on
symmetric cryptography. The symmetric directory includes block and stream
ciphers, hashes, XOFs, permutations, AEAD and MACs, including entries with no
catalogued analysis results. Asymmetric cryptanalysis and implementation have
dedicated **TBD** entrances.

Data updates retain the application version; see the [version policy](docs/versioning.md).
The public source includes a validated cryptanalysis snapshot. A fresh checkout
builds the analysis tables, comparisons, sources and coverage views without the
maintainer's research workspace or downloaded papers.

## Quick start

Use Node.js 24 LTS and npm:

```sh
npm ci
npm run dev
```

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run check` | Run tests, type checking and data validation |
| `npm run build` | Build the website in `dist/` |
| `npm run preview` | Validate and preview the public build on loopback |
| `npm run test:ui` | Run desktop and mobile browser tests |
| `npm run check:release` | Validate release files and assets |
| `npm run check:published-data` | Validate the included analysis snapshot |
| `npm run check:publication-fields` | Check independent field-publication permissions |

See [Contributing](CONTRIBUTING.md) for the development workflow and
[Cryptanalysis data](docs/cryptanalysis.md) for data tooling.

## Project layout

```text
src/             React application, feature views and shared components
lib/             scientific semantics and Node data adapters
build/           Vite integration and distribution assets
schemas/         data contracts and the result taxonomy
data/questions/  question records, manifest and taxonomy
data/primitives/ public primitive definitions, instances and specification links
data/cryptanalysis-public/ published analysis snapshot and content manifest
scripts/         checks and maintenance commands
tests/           unit, integration and browser tests
docs/            architecture, data contracts, contribution and release guides
```

## Contribute

Use **Report** in the website header or an issue template to submit an accepted
paper, a Lean formalization or a preprint. Include the exact source version,
claim, assumptions, costs, success event and supporting evidence. See the
[submission guide](docs/result-submissions.md) and [contributor guide](CONTRIBUTING.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Using the atlas](docs/usage.md)
- [Question dataset](docs/questions.md) and [data contract](docs/data-contract.md)
- [Analysis model](docs/data-model.md) and [cryptanalysis data](docs/cryptanalysis.md)
- [Published analysis data](docs/published-data.md)
- [Primitive directory](docs/primitives.md) and [version policy](docs/versioning.md)
- [Release guide](docs/releasing.md)
- [Security policy](SECURITY.md)

## License

Software and schemas: [Apache-2.0](LICENSE).
Original curated question and primitive-directory data: [CC BY 4.0](LICENSE-DATA.md).
Original curated analysis data uses the same CC BY 4.0 terms; see its
[scope notice](data/cryptanalysis-public/README.md).
Cited publications and external artifacts retain their own rights.
Website dependency licenses are included in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).

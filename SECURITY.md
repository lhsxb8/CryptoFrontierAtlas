# Security policy

Report vulnerabilities through this repository's **Security → Report a
vulnerability** entry when enabled. For issues containing credentials or private
material, arrange a private maintainer channel before sharing details.
Use public issues for reproducible problems that contain no sensitive material.

Include the affected version, reproduction steps, impact and a minimal example.
The maintained version is the current main branch and its latest public build.

The website is static. Development and preview servers are local tools; use a
static host for public deployment. Keep dependencies current, retain the public
build profile, and run source and release checks before publication.

Development defaults to loopback and blocks raw private workspace files in both
data profiles. The internal profile still intentionally serves its projected
research data to its browser client. Use `npm run preview` for a checked public
static preview; `preview:local` is loopback-only. Keep previewed files unchanged
until the server is stopped and revalidated. See the
[release guide](docs/releasing.md#checked-preview).

# Interface design

The interface combines an editorial heading hierarchy with compact research
controls. English page and chapter headings use the self-hosted Source Serif 4
Semibold face. Primitive names, controls, metadata and scientific body text use
the existing system sans-serif stack. Chinese headings use the system UI stack
with a separate size scale. Mathematical typography remains unchanged.

The home masthead contains only the project title and a divider, followed by two
primary collection cards and two compact TBD entrances. Collection artwork is
decorative and hidden from assistive technology.
The four locally bundled WebP illustrations in `src/assets/home/` share muted
colors, fine contours and shallow, matte dimensionality. Open questions uses a
folded mathematical surface; symmetric cryptanalysis uses a Feistel-round motif;
asymmetric cryptanalysis uses a lattice with an off-lattice target; implementation
uses an exploded chip. These are thematic illustrations, not theorem statements,
measured results or complete cipher specifications.

Artwork occupies a separate upper-right area, clear of the HTML heading and TBD
badge. Planned cards keep smaller, quieter illustrations and remain labelled TBD.
Primary artwork lifts slightly on hover or keyboard focus; reduced-motion mode
disables the movement. Every image has empty alt text and ignores pointer input;
the link's real heading remains its accessible label. No promotional paragraphs
or aggregate research statistics are added to the home page.

Images are generated offline, with transparent backgrounds and a common 1200 by
800 canvas. No image API or credential is used in the website. The user's original
upload is retained but not imported; replaced generated art and generation
records remain local. Browser checks verify all four assets load and their visible
pixels stay clear of headings at narrow and wide viewport sizes.

The primitive directory uses section rules and larger chapter headings, two
columns on wide screens and one on narrow screens. A singleton category uses a
horizontal entry on desktop. Instance and result counts remain distinct; a
withdrawal badge carries text and retains its full label as a title.

Below 1251 CSS pixels the primary navigation becomes a labelled disclosure.
It retains the same links and supports keyboard activation, Escape, outside
pointer dismissal, route changes and breakpoint changes. Secondary navigation
can scroll horizontally, without widening the page. Scientific routes, query
state and comparison semantics are unchanged.

## Analysis attack surfaces

Instance result pages show all attack surfaces together, with no attack-surface
tabs or selector. Algorithmic, Side-channel and Fault injection are section
headings, not navigation modes. Search and filters apply across the whole instance.

Every result section is keyed by attack surface and method or structural kind.
Each surface has its own heading. Supporting properties and bounds remain
inside their own surface, and fault methods retain individual subsections.
Scientific methods, result IDs, costs and source-native conditions are unchanged.

Old `attack_surface` URL parameters are ignored by list, detail and comparison
pages and are not propagated by their generated links. Other filters, exact IDs
and comparison selections remain intact. Clearing filters restores the whole
instance. Section expansion and pagination remain independent. The low-level
filter still supports explicit surface queries for research tools; only the UI's
retired tab state is discarded.

Side-channel method labels identify the leakage-assisted setting. Recorded power
or EM access stays visible beside the costs; full cipher rounds are not replaced
by leakage-observation depth. Partial recovery retains its stated output width.
Comparisons preserve the scientific comparator's cross-surface rejection.

## Review

- Check English and Chinese at 320, 375, 768 and 1440 pixels.
- Confirm chapter/entry hierarchy in color and grayscale.
- Check complete long names, status labels and public/internal counts.
- Test navigation, keyboard focus, font fallback and reduced motion.
- Verify public and local builds and affected browser regressions.

## Font provenance

Source Serif 4 is distributed unmodified under its bundled SIL Open Font License
1.1. The upstream file is `WOFF2/OTF/SourceSerif4-Semibold.otf.woff2` at
`adobe-fonts/source-serif`, commit
`80d3f8894c09c937bebfa9011247d2e1c79fd6f4` (font version 4.327).
The font and complete upstream license live in `public/fonts/source-serif/`.
The font SHA-256 is
`7eff2d2fde32c42992e723eb24dcc6dc5b640ef0da97ce373cd38e0604202e30`;
unit tests verify both the original font and license bytes.
The license is also included in the generated distribution notices. Browsing
and ordinary builds never download a font from a third-party service.

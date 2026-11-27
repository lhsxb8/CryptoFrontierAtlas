# Primitive Standardization

The directory records adoption of specific algorithm profiles, not certification
of an implementation or a claim of present-day security. The review dated
November 27, 2026 covers all 409 registered instances. Its 40 standard and
recommendation records bind 159 instances in 62 families. Counts overlap across
international and national adoption.

## Evidence and scope

`data/primitives/catalog.json` contains the complete evidence registry under
`standardization`. Each record identifies a registered specification, its issuing
authority, designation, level and document type. National records identify their
jurisdiction. Explicit instance bindings retain the source location and whether
the target is an algorithm or a normative component.

The review uses ISO/IEC publication records and standard previews, NIST final
publications, Chinese national-standard records, the Korean standards catalogue
and the Russian national block-cipher specification. Source links are stored with
the specifications and exposed in each instance's expandable badge panel. Source
text and paid standards are not redistributed.

The International Standard globe requires a confirmed ISO/IEC binding in this
review. FIPS, GB/T, KS and GOST R evidence receives a separate National Standard
icon. NIST Special Publications explicitly titled recommendations receive a
National Recommendation icon, not an international globe. SP 800-232 explicitly
publishes Ascon standards and is classified accordingly. An RFC, a 3GPP/ETSI
technical specification, a competition submission, or a high citation count does
not by itself qualify for these international/national labels. Other categories
of standardization can be added with their own evidence and labels.

This is a dated verified-adoption registry, not an exhaustive claim about every
standard in every jurisdiction. An instance without a binding has no confirmed
adoption in this registry; it is not asserted to be non-standard. Planned revisions
or proposed withdrawals do not change a final publication's status. A withdrawn
source remains visible as historical evidence.

## Instance boundaries

- AES's FIPS or ISO adoption does not transfer to AES-DM, AES-MMO or AES-MP.
- The 2026 ISO RFID editions cover five SIMON and five SPECK profiles: block/key
  sizes 64/96, 96/96, 64/128, 128/128 and 128/256. They do not cover all ten
  registered profiles in either family.
- ISO/IEC 18033-3 binds the 128-bit-key CAST-128 profile; its 80-bit-key profile
  is not awarded a badge from that reference.
- ISO/IEC 10118-3 binds RIPEMD-128 and RIPEMD-160, not RIPEMD-256 or RIPEMD-320.
- Keccak-p and Ascon-p bindings explicitly identify standardized components.
  A component binding is not a complete hash, AEAD or protocol conformance claim.
- HMAC and KMAC retain their variable-key interfaces. The ISO binding states the
  additional minimum-key-length requirement; it does not certify every input to
  that interface. RSA-OAEP and ECDH similarly retain primitive/protocol boundaries.
- OCB3 does not inherit the status of an older, different OCB definition. Nor do
  pre-standard Ascon variants inherit the final SP 800-232 profiles.
- SKINNY's all-secret, zero-public-tweak directory profiles do not acquire a badge
  solely from an ISO specification of tweakable SKINNY constructions.
- DSA's FIPS 186-4 binding is withdrawn and sorts last. FIPS 186-5 permitting
  legacy DSA verification does not approve new DSA signature generation.
- XMSS/XMSSMT and LMS/HSS bindings cover the selected SP 800-208 parameter sets,
  not every profile in their RFCs or an implementation's state-management safety.
- ISO/IEC 18033-2:2006/Amd 2:2026 is registered as published adoption evidence for
  FrodoKEM and Classic McEliece. The inspected preview does not expose the complete
  selected-parameter tables; exact directory-profile bindings remain pending.
  A citation to this standard therefore does not yet add an instance badge.
- Falcon and HQC submission/specification profiles do not inherit a national
  standard badge from a NIST selection announcement. Non-selection of a proposal
  is not a withdrawal of its specification.

## Display and ordering

Category order is unchanged, including Hard Problems first in the asymmetric
directory. Within each category, families with published standard or national
recommendation bindings appear first, profiles without verified bindings next,
and families with any withdrawn binding last. Withdrawal takes precedence even
when another bound standard remains published, as with TDEA. This ordering does
not imply that the other standard has been withdrawn. Existing analysis-coverage and alphabetical
ordering breaks ties in large directories. Pagination runs after this ordering.
Instance navigation and comparison tables apply the same priority while retaining
their existing order within a tier. Attack tables and scientific comparisons are
unaffected.

Cards, comparison tables and page headings use icon-only badges: a globe for
international standards, a civic building for national standards, a checked
document for national recommendations, and an archive with a cross for withdrawn
standards. All applicable kinds remain visible; a current-standard icon never
hides a withdrawal icon. Hover text and accessible names include the meaning,
designation and partial coverage fraction. No sibling instance inherits adoption.

Open a family or instance page and expand its badge panel for the standard type,
authority, source link, covered profiles, location, component scope and withdrawal
date. The native disclosure supports touch and keyboard access without relying
on hover. Withdrawal display and sorting use the same explicit instance bindings,
not merely a citation to a withdrawn document.

## Maintenance and checks

1. Check a final primary publication and its status; register its source as
   `kind: standard`. A draft or selection announcement is insufficient.
2. Bind exact instance IDs, source locations and scope. Do not derive adoption
   from names, shared sources, family membership, citations or `uses` dependencies.
3. Update `reviewed_instance_ids` and the review date after assessing added or
   removed profiles. Recheck the source status when refreshing the review date.
4. Run `npm run check:catalog` and the standardization unit/browser tests.

Validation rejects missing review coverage, duplicate or unknown bindings,
non-standard source kinds, stale status checks, invalid national jurisdiction
metadata and mislabelled permutation/compression components. The optional
version-4 directory extension does not change any scientific result schema,
publication permission, comparison rule, route or algorithm parameter.

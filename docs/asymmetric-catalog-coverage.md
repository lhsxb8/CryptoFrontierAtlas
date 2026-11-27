# Asymmetric Catalog Coverage

Snapshot: **November 27, 2026**. This directory describes schemes and selected
profiles. Algorithm registration does not create an attack record.

| Category | Families | Concrete Instances |
| --- | ---: | ---: |
| Public-Key Encryption | 8 | 4 |
| Key Agreement | 7 | 11 |
| Digital Signatures | 18 | 47 |
| Key Encapsulation Mechanisms | 8 | 38 |
| **Total** | **41** | **100** |

Nine separately modelled Hard Problems appear first. The overview shows up to
six entries per category. View All and search reach the complete directory;
24-entry pagination limits long lists without adding tabs.

## Included Schemes

Encryption includes RSA-OAEP, SM2, ElGamal, Rabin, Paillier, Cramer–Shoup, ECIES
and SM9. Key agreement includes FFDHE, ECDH, X25519/X448, SM2, MQV/ECMQV, HMQV
and SM9. Encryption, signatures and agreement remain separate scheme identities.

Signatures include RSA-PSS and RSASSA-PKCS1-v1_5, ECDSA, EdDSA, DSA, generic
Schnorr, BIP340, BLS, GOST R 34.10-2012, SM2, SM9, ML-DSA, all twelve SLH-DSA
sets, Falcon, XMSS, XMSSMT, LMS and HSS. Stateful hash signatures are explicitly
marked as stateful; their one-time signing keys must not be reused.

KEMs include ML-KEM, HQC, Classic McEliece, FrodoKEM, NTRU, NTRU Prime, SABER
and BIKE. The catalog stores exact source editions and locators. In particular:

- HQC v5.1 (November 9, 2026) uses HQC-1/3/5 identities, updated weights and
  32-byte seeded decapsulation keys, not the old HQC-128/192/256 encodings.
- Salted FrodoKEM follows the September 29, 2025 proposal, not eFrodoKEM.
- Classic McEliece follows the October 23, 2022 unconfirmed, narrowly decoded
  KEM specification, including the `f` key-generation variants.
- NTRU pins the four inspected March 30, 2019 HPS/HRSS KEM profiles. This is
  neither original NTRUEncrypt nor an assertion that every later revision is covered.
- NTRU Prime includes six Streamlined profiles from October 7, 2020. Their
  categories reproduce the submitters' Section 8 strategy #1; NTRU LPRime is not
  silently treated as the same construction.
- SABER uses its round-three full secret-key encodings. BIKE pins the inspected
  October 10, 2022 round-four profiles and leaves representation-dependent private
  key storage unspecified.
- Falcon v1.2 selects padded signatures; a compressed average is not a fixed
  signature size. These records are not renamed to final FN-DSA profiles.

## Definitions and Remaining Work

ElGamal, Rabin, Paillier, Cramer–Shoup, ECIES, MQV/ECMQV, HMQV, generic Schnorr,
BLS, GOST R 34.10 and the three SM9 families are parameterized definitions.
Their pages specify the group/curve, encoding, hash, protocol and other choices
required before a concrete profile can be registered. No arbitrary modulus length,
curve or cipher suite is presented as the original design's unique instance.

Further work includes pinned SM9 and GOST profiles, modern BLS ciphersuites,
additional NTRU revisions and LPRime, and the additional-signature competition
families. Their absence is not a security judgment. No claim is made to cover
every highly cited asymmetric scheme.

Standard badges require exact instance evidence. DSA retains a withdrawn
FIPS 186-4 binding; the selected stateful-signature sets carry the SP 800-208
recommendation. FrodoKEM and Classic McEliece's 2026 ISO amendment is cited, but
mapping the registered profiles to its complete final parameter tables remains
pending. NIST selection alone does not grant a standard badge.

All concrete instances have explicit drawing-registry bindings. Existing
parameterized FFDHE and SLH-DSA templates cover their added standard profiles;
new families await reviewed drawings and display parameters in the meantime.
No generic picture is presented as a checked structure diagram.

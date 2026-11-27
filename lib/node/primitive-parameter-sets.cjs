'use strict';

// Pinned design profiles, not security estimates or scientific attack targets.
// A new revision with different encodings needs a distinct profile, not an
// unreviewed change to these values. Source editions are recorded in the catalog.
const kemSets = {};
function add(scheme, parameter_set, parameters) {
  kemSets[parameter_set] = Object.freeze({type: 'kem', scheme, parameter_set, ...parameters});
}

// HQC specification v5.1 (2026-11-09), Tables 8–9. dkKEM is a seed.
for (const [category, code_length, secret_weight, ephemeral_weight, pk, ct] of [
  [1, 17669, 67, 76, 2241, 4433], [3, 35851, 101, 114, 4514, 8978], [5, 57637, 132, 150, 7237, 14421],
]) add('hqc', `HQC-${category}`, {security_category: category, code_length, secret_weight, ephemeral_weight,
  public_key_bytes: pk, secret_key_bytes: 32, secret_key_representation: 'seed', ciphertext_bytes: ct, shared_secret_bytes: 32});

// FrodoKEM 2025-09-29, Tables A.1 and A.5 (salted FrodoKEM, NOT eFrodoKEM).
for (const [n, category, pk, sk, ct, ss] of [
  [640, 1, 9616, 19888, 9752, 16], [976, 3, 15632, 31296, 15792, 24], [1344, 5, 21520, 43088, 21696, 32],
]) for (const generator of ['AES', 'SHAKE']) add('frodo_kem', `FrodoKEM-${n}-${generator}`, {
  security_category: category, lattice_dimension: n, matrix_generator: generator === 'AES' ? 'AES-128' : 'SHAKE128',
  public_key_bytes: pk, secret_key_bytes: sk, secret_key_representation: 'encoded', ciphertext_bytes: ct, shared_secret_bytes: ss,
});

// Classic McEliece 2022-10-23, Sections 6–7. Narrowly decoded, unconfirmed KEM.
for (const [n, m, t, category] of [[3488,12,64,1],[4608,13,96,3],[6688,13,128,5],[6960,13,119,5],[8192,13,128,5]]) {
  for (const suffix of ['', 'f']) add('classic_mceliece', `mceliece${n}${t}${suffix}`, {
    security_category: category, code_length: n, field_degree: m, error_capacity: t,
    public_key_bytes: m * t * Math.ceil((n - m * t) / 8),
    secret_key_bytes: 40 + 2 * t + (2 * m - 1) * 2 ** (m - 4) + n / 8,
    secret_key_representation: 'encoded', ciphertext_bytes: Math.ceil(m * t / 8), shared_secret_bytes: 32,
  });
}

// SABER round-three specification, Table 2; uncompressed secret-key encoding.
for (const [name, rank, category, pk, sk, ct] of [
  ['LightSaber',2,1,672,1568,736],['Saber',3,3,992,2304,1088],['FireSaber',4,5,1312,3040,1472],
]) add('saber', name, {security_category: category, module_rank: rank, polynomial_degree: 256, modulus: 8192,
  public_key_bytes: pk, secret_key_bytes: sk, secret_key_representation: 'encoded', ciphertext_bytes: ct, shared_secret_bytes: 32});

// NTRU 2019-03-30, Section 1.6 (the four explicitly pinned round-two profiles).
for (const [name, n, q, category, pk, sk] of [
  ['ntruhps2048509',509,2048,1,699,935], ['ntruhps2048677',677,2048,3,930,1234],
  ['ntruhps4096821',821,4096,5,1230,1590], ['ntruhrss701',701,8192,3,1138,1450],
]) add('ntru', name, {security_category: category, polynomial_degree: n, modulus: q,
  public_key_bytes: pk, secret_key_bytes: sk, secret_key_representation: 'encoded', ciphertext_bytes: pk, shared_secret_bytes: 32});

const slhSets = {
  '128s': [1,16,63,7,12,14,7856], '128f': [1,16,66,22,6,33,17088],
  '192s': [3,24,63,7,14,17,16224], '192f': [3,24,66,22,8,33,35664],
  '256s': [5,32,64,8,14,22,29792], '256f': [5,32,68,17,9,35,49856],
};

// NTRU Prime round three (2020-10-07), Sections 3.4–3.9, 8.1–8.6 and Table 1.
// Categories reproduce the submitters' strategy #1, not an Atlas security claim.
for (const [n,q,w,category,pk,sk,ct] of [
  [653,4621,288,1,994,1518,897], [761,4591,286,2,1158,1763,1039], [857,5167,322,3,1322,1999,1184],
  [953,6343,396,4,1505,2254,1349], [1013,7177,448,4,1623,2417,1455], [1277,7879,492,5,2067,3059,1847],
]) add('ntru_prime', `sntrup${n}`, {security_category: category, polynomial_degree:n, modulus:q, secret_weight:w,
  public_key_bytes:pk, secret_key_bytes:sk, secret_key_representation:'encoded', ciphertext_bytes:ct, shared_secret_bytes:32});

// BIKE round four (2022-10-10), Section 2.6, Tables 4–5. No fixed private-key
// encoding: Table 5 reports a bit-storage bound, NOT the implementation's sk bytes.
for (const [category,r,w,t] of [[1,12323,142,134],[3,24659,206,199],[5,40973,274,264]]) {
  add('bike', `BIKE-L${category}-R4`, {security_category:category, ring_degree:r, secret_weight:w, error_weight:t,
    public_key_bytes:Math.ceil(r/8), ciphertext_bytes:Math.ceil(r/8)+32, shared_secret_bytes:32});
}

module.exports = {kemSets: Object.freeze(kemSets), slhSets: Object.freeze(slhSets)};

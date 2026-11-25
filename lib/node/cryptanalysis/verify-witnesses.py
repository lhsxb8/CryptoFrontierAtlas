#!/usr/bin/env python3
"""Independently verify concrete AES collision witnesses using only stdlib.

This is deliberately a witness-only checker, not an attack implementation or a
complexity check. The S-box is generated mathematically; no author verifier,
third-party crypto package, network connection, or Lean installation is used.
"""

import argparse
import copy
import json
from pathlib import Path
import re
import sys


ATLAS_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_WITNESSES = ATLAS_ROOT / "data" / "cryptanalysis" / "witnesses.json"
FULL_ROUNDS = {16: 10, 24: 12, 32: 14}
ROUND_CONVENTION = "aes_prefix_initial_ark_last_round_without_mc"


def gf_multiply(left, right):
    """Multiply in GF(2^8), modulo x^8 + x^4 + x^3 + x + 1."""
    product = 0
    for _ in range(8):
        if right & 1:
            product ^= left
        left = ((left << 1) ^ (0x11B if left & 0x80 else 0)) & 0xFF
        right >>= 1
    return product


def gf_power(value, exponent):
    result = 1
    while exponent:
        if exponent & 1:
            result = gf_multiply(result, value)
        value = gf_multiply(value, value)
        exponent >>= 1
    return result


def rotate_byte(value, count):
    return ((value << count) | (value >> (8 - count))) & 0xFF


def make_sbox():
    """Field inversion (0 maps to 0), followed by the AES affine map."""
    values = []
    for value in range(256):
        inverse = gf_power(value, 254) if value else 0
        transformed = inverse ^ 0x63
        for shift in range(1, 5):
            transformed ^= rotate_byte(inverse, shift)
        values.append(transformed)
    return tuple(values)


SBOX = make_sbox()


def expand_key(key):
    """Return the standard AES round keys, each in column-major byte order."""
    if not isinstance(key, bytes) or len(key) not in FULL_ROUNDS:
        raise ValueError("AES key must be bytes of length 16, 24, or 32")
    nk = len(key) // 4
    words = [list(key[offset:offset + 4]) for offset in range(0, len(key), 4)]
    round_constant = 1
    for index in range(nk, 4 * (FULL_ROUNDS[len(key)] + 1)):
        temp = words[index - 1][:]
        if index % nk == 0:
            temp = [SBOX[value] for value in temp[1:] + temp[:1]]
            temp[0] ^= round_constant
            round_constant = gf_multiply(round_constant, 2)
        elif nk == 8 and index % nk == 4:
            temp = [SBOX[value] for value in temp]
        words.append([words[index - nk][row] ^ temp[row] for row in range(4)])
    return [
        [value for word in words[offset:offset + 4] for value in word]
        for offset in range(0, len(words), 4)
    ]


def shift_rows(state):
    # The byte at row r, column c has linear position 4*c+r.
    return [state[4 * ((column + row) % 4) + row]
            for column in range(4) for row in range(4)]


def mix_columns(state):
    result = []
    matrix = ((2, 3, 1, 1), (1, 2, 3, 1), (1, 1, 2, 3), (3, 1, 1, 2))
    for column in range(4):
        values = state[4 * column:4 * column + 4]
        for coefficients in matrix:
            mixed = 0
            for coefficient, value in zip(coefficients, values):
                mixed ^= gf_multiply(coefficient, value)
            result.append(mixed)
    return result


def aes_encrypt_block(plaintext, key, rounds=None):
    """Encrypt a prefix of AES, always omitting MixColumns in its last round."""
    if not isinstance(plaintext, bytes) or len(plaintext) != 16:
        raise ValueError("AES plaintext must contain exactly 16 bytes")
    round_keys = expand_key(key)
    maximum_rounds = FULL_ROUNDS[len(key)]
    if rounds is None:
        rounds = maximum_rounds
    if type(rounds) is not int or not 1 <= rounds <= maximum_rounds:
        raise ValueError("round count must be an integer within this AES variant")
    state = [value ^ mask for value, mask in zip(plaintext, round_keys[0])]
    for round_index in range(1, rounds + 1):
        state = shift_rows([SBOX[value] for value in state])
        if round_index != rounds:
            state = mix_columns(state)
        state = [value ^ mask for value, mask in zip(state, round_keys[round_index])]
    return bytes(state)


def run_known_answer_tests():
    """FIPS 197 (2001), Appendix C.1, C.2, C.3 full-round examples."""
    plaintext = bytes.fromhex("00112233445566778899aabbccddeeff")
    expected_by_key_bytes = {
        16: "69c4e0d86a7b0430d8cdb78070b4c55a",
        24: "dda97ca4864cdfe06eaf70a0ec0d7191",
        32: "8ea2b7ca516745bfeafc49904b496089",
    }
    for key_bytes, expected in expected_by_key_bytes.items():
        actual = aes_encrypt_block(plaintext, bytes(range(key_bytes))).hex()
        if actual != expected:
            raise ValueError("FIPS AES-{} KAT failed: {} != {}".format(
                key_bytes * 8, actual, expected))
        print("PASS FIPS AES-{} known-answer test ({} rounds)".format(
            key_bytes * 8, FULL_ROUNDS[key_bytes]))


def parse_hex(record, field, byte_count):
    value = record.get(field)
    if not isinstance(value, str) or not re.fullmatch(
            r"[0-9a-fA-F]{%d}" % (2 * byte_count), value):
        raise ValueError("{} must be exactly {} hexadecimal bytes".format(
            field, byte_count))
    return bytes.fromhex(value)


def verify_witness(record):
    if not isinstance(record, dict):
        raise ValueError("witness must be an object")
    result_id = record.get("result_id")
    if not isinstance(result_id, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", result_id):
        raise ValueError("unknown or missing witness result_id")
    if record.get("id") != "witness-" + result_id:
        raise ValueError("witness id does not match its result_id")
    expected_bits = record.get("key_bits")
    expected_rounds = record.get("rounds")
    expected_control = record.get("plaintext_control")
    if type(expected_bits) is not int or expected_bits not in (128, 192, 256):
        raise ValueError("unsupported AES key_bits")
    if type(expected_rounds) is not int or not 1 <= expected_rounds <= FULL_ROUNDS[expected_bits // 8]:
        raise ValueError("unsupported AES round count")
    if expected_control not in ("fixed_zero", "free_common_plaintext"):
        raise ValueError("unsupported plaintext control")
    plaintext = parse_hex(record, "plaintext", 16)
    key1 = parse_hex(record, "key1", expected_bits // 8)
    key2 = parse_hex(record, "key2", expected_bits // 8)
    expected = parse_hex(record, "expected_ciphertext", 16)
    if key1 == key2:
        raise ValueError("a key-collision witness must contain distinct keys")
    if expected_control == "fixed_zero" and plaintext != bytes(16):
        raise ValueError("fixed-zero witness has a nonzero plaintext")
    ciphertext1 = aes_encrypt_block(plaintext, key1, expected_rounds)
    ciphertext2 = aes_encrypt_block(plaintext, key2, expected_rounds)
    if ciphertext1 != ciphertext2 or ciphertext1 != expected:
        raise ValueError("{} collision failed: E(K1,P)={}, E(K2,P)={}, expected={}".format(
            result_id, ciphertext1.hex(), ciphertext2.hex(), expected.hex()))
    return ciphertext1


def verify_bundle(bundle):
    if not isinstance(bundle, dict) or bundle.get("scope") != "witness_only":
        raise ValueError("bundle must declare witness_only scope")
    if bundle.get("schema_version") != "0.1.0":
        raise ValueError("unsupported witness schema version")
    convention = bundle.get("round_convention")
    if not isinstance(convention, dict) or any(
        convention.get(field) != expected for field, expected in {
            "id": ROUND_CONVENTION,
            "key_schedule": "standard_aes",
            "round_selection": "first_r_rounds",
        }.items()
    ) or convention.get("initial_add_round_key") is not True or convention.get(
            "last_round_mix_columns") is not False:
        raise ValueError("unsupported or contradictory AES round convention")
    records = bundle.get("witnesses")
    if not isinstance(records, list) or not records:
        raise ValueError("bundle requires at least one witness record")
    seen = set()
    outputs = []
    for record in records:
        ciphertext = verify_witness(record)
        result_id = record["result_id"]
        if result_id in seen:
            raise ValueError("duplicate witness result_id: " + result_id)
        seen.add(result_id)
        outputs.append((record, ciphertext))
    return outputs


def run_negative_tests(bundle):
    """Mutation tests run in memory: malformed or false witnesses must fail."""
    mutations = (
        ("identical keys", lambda item: item.update(key2=item["key1"])),
        ("wrong key length", lambda item: item.update(key1=item["key1"][:-2])),
        ("wrong key_bits", lambda item: item.update(key_bits=129)),
        ("wrong rounds", lambda item: item.update(rounds=0)),
        ("wrong plaintext length", lambda item: item.update(plaintext="00")),
        ("wrong ciphertext", lambda item: item.update(expected_ciphertext=(bytes([int(item["expected_ciphertext"][:2], 16) ^ 1]) + bytes.fromhex(item["expected_ciphertext"])[1:]).hex())),
        ("invalid hex", lambda item: item.update(key1="zz" + item["key1"][2:])),
        ("wrong input control", lambda item: item.update(plaintext_control="unsupported")),
    )
    canonical_index = 0
    cases = []
    for name, mutate in mutations:
        altered = copy.deepcopy(bundle)
        mutate(altered["witnesses"][canonical_index])
        cases.append((name, altered))
    missing = copy.deepcopy(bundle)
    missing["witnesses"] = []
    cases.append(("empty witness set", missing))
    duplicate = copy.deepcopy(bundle)
    duplicate["witnesses"].append(copy.deepcopy(duplicate["witnesses"][0]))
    cases.append(("duplicate witness", duplicate))
    wrong_convention = copy.deepcopy(bundle)
    wrong_convention["round_convention"]["last_round_mix_columns"] = True
    cases.append(("wrong round convention", wrong_convention))
    for name, altered in cases:
        try:
            verify_bundle(altered)
        except ValueError:
            continue
        raise ValueError("negative test incorrectly accepted " + name)
    print("PASS {} negative validation tests".format(len(cases)))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--witnesses", type=Path, default=DEFAULT_WITNESSES,
                        help="optional witness JSON path (default is relative to this script)")
    args = parser.parse_args(argv)
    try:
        # Test the AES implementation first, before opening the witness input.
        run_known_answer_tests()
        with args.witnesses.open(encoding="utf-8") as source:
            bundle = json.load(source)
        outputs = verify_bundle(bundle)
        for record, ciphertext in outputs:
            print("PASS {}: E(K1,P)=E(K2,P)={}".format(
                record["result_id"], ciphertext.hex()))
            if record["plaintext_control"] == "free_common_plaintext":
                plaintext = bytes.fromhex(record["plaintext"])
                feedforward = bytes(left ^ right for left, right in zip(ciphertext, plaintext))
                print("  Semi-free-start DM at this freely chosen P: {} (not fixed IV)".format(
                    feedforward.hex()))
        run_negative_tests(bundle)
    except (OSError, ValueError, TypeError, KeyError) as error:
        print("FAIL: {}".format(error), file=sys.stderr)
        return 1
    print("PASS: 3 FIPS known-answer tests and {} independent collision-witness checks.".format(len(outputs)))
    print("Scope: witness only; attack cost, search procedure, and success probability not verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

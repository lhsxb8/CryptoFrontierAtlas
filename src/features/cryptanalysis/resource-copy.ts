/** Curated display equivalents. Source strings, units and accounting stay intact.
 * No general-purpose prose stripping: an unfamiliar expression is displayed as-is.
 */
const labels = new Map<string, string>([
  ['2^50 in Table 1 and derivation; 2^46 in Section 4.1 summary', '{2^50,2^46}'],
  ['256 per active-byte structure', '256 / structure'],
  ['2^67 encryption queries + 2^99 decryption queries, approximately 2^99 total', '\\(2^{67}Q_E+2^{99}Q_D\\approx2^{99}Q\\)'],
  ['approximately 2^60.8 (Table 1 rounds to 2^61)', '≈2^60.8'],
  ['2^58.7 (Table 1 rounds to 2^59)', '2^58.7'],
  ['2^105/5 (source simplifies to2^103)', '2^105/5'],
  ['2^123 encryption equivalents (2^125 byte-function evaluations)', '\\(2^{123}E=2^{125}F_{\\mathrm{byte}}\\)'],
  ['four-byte exhaustive searches: about 5 days on a 1 GHz Pentium', '≈5 days · 1 GHz Pentium'],
  ['small; longer-key completion not separately priced', 'Small; key-completion cost unreported'],
  ['2^144 AES executions in abstract; about2^144 cheaper operations in Section5.3', '2^144 · AES / cheaper operations'],
  ['2^42-pair wrong-key-elimination table construction', '2^42-pair elimination table'],
  ['2^40 admissible actual-value pairs per column table', '2^40 / column table'],
  ['2^186.8 preprocessing + 2^186.4 online ≈ 2^187.6 total', '2^186.8+2^186.4≈2^187.6'],
  ['2^187.1 preprocessing + 2^186.4 online ≈ 2^187.7 total', '2^187.1+2^186.4≈2^187.7'],
  ['same headline as Section 5.1: approximately 2^187.6 total', '≈2^187.6'],
  ['2^227.8 (Table 1 / Appendix B); 2^224.3 (conclusion)', '{2^227.8,2^224.3}'],
  ['2^85 (Table 1) versus 2^77 (Sections 4.3 and 4.5)', '{2^85,2^77}'],
  ['Table 1: 2^77; Section 5.2: 2^77.5', '{2^77,2^77.5}'],
  ['2^96 encryption queries across the selected pair', '2^96'],
  ['2^131 dominant first-stage encryption queries, followed by 2^91 decryption queries for a selected pair', '\\(2^{131}Q_E+2^{91}Q_D\\)'],
  ['Table 1 at s=0 and Section 4.3 Complexity: 2^92.5; Section 4.3 More Tradeoffs at s=0 with 2^17 keys: 2^92', '{2^92.5,2^92}'],
  ['Table 1 at s=0 and Section 4.3 Complexity: 2^92; Section 4.3 More Tradeoffs at s=0 with 2^17 keys: 2^91', '{2^92,2^91}'],
  ['2^177.1 total, source headline', '2^177.1'],
  ['2^178.5 (online); source total is 2^187.1 + 2^178.5', 'T_on=2^178.5; T_total=2^187.1+2^178.5'],
  ['2^194.5 online; total 2^203.1 + 2^194.5', 'T_on=2^194.5; T_total=2^203.1+2^194.5'],
  ['approximately 2^253.4 total, including preprocessing', '≈2^253.4'],
  ['approximately 2^255 total, including preprocessing', '≈2^255'],
  ['2^153 (detailed total; introduction says2^152)', '{2^153,2^152}'],
  ['2^126 pairs for each key', '2^126 / key'],
  ['2^127 pairs for each key (body); Table3 says2^126', '{2^127,2^126} / key'],
  ['Table 1: 2^26.14 bytes; Appendix A: 2^26.11 bytes', '{2^26.14,2^26.11}'],
  ['2^111.82 table lookups ≈2^104.92 six-round encryptions', '\\(2^{111.82}L\\approx2^{104.92}E_6\\)'],
  ['2^106 online filtering; complete master-key cost unresolved', '2^106 · filtering'],
  ['2^96.6 Enc + 2^92.8 MA (source-named offline phase)', '\\(2^{96.6}\\mathrm{Enc}+2^{92.8}\\mathrm{MA}\\)'],
]);

export function resourceExpression(reported: string): string {
  const curated = labels.get(reported);
  if (curated) return curated;
  const operations = /^4xy memory accesses \+ (2?xy) XOR operations =(2\^[\d.]+) MAs\+(2\^[\d.]+) XORs$/.exec(reported);
  if (operations) return `\\(${operations[2].replace('^', '^{')}}\\,\\mathrm{MA}+${operations[3].replace('^', '^{')}}\\,\\mathrm{XOR}\\)`;
  const online = /^(2\^[\d.]+) online; total (2\^[\d.]+)$/.exec(reported);
  if (online) return `T_on=${online[1]}; T_total=${online[2]}`;
  const originalClaim = /^Original claim(2\^[\d.]+); exact corrected whole-key cost unresolved$/.exec(reported);
  if (originalClaim) return originalClaim[1];
  return reported;
}

export function resourceLegend(reported: string): string | null {
  if (/encryption queries.*decryption queries/.test(reported)) return 'Q_E: encryption queries; Q_D: decryption queries';
  if (reported === '2^123 encryption equivalents (2^125 byte-function evaluations)') return 'E: encryption equivalents; F_byte: byte-function evaluations';
  if (reported === '2^111.82 table lookups ≈2^104.92 six-round encryptions') return 'L: table lookups; E_6: six-round encryptions';
  if (/^Original claim/.test(reported)) return 'Original claim · correction unresolved';
  return null;
}

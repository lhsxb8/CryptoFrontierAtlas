/** Readable unit labels, without unit conversion or changing source accounting. */
export function formatResourceUnit(unit: string): string {
  return unit
    .replace(/\baes(128|192|256)-(\d+)r\b/gi, '$2-round AES-$1')
    .replace(/\baes-?(128|192|256)\b/gi, 'AES-$1')
    .replace(/\baes\b/gi, 'AES')
    .replace(/[-_]/g, ' ')
    .replace(/\bAES (128|192|256)\b/g, 'AES-$1')
    .replace(/\b(\d+) (bit|round)\b/g, '$1-$2')
    .replace(/\b(six|seven|eight|nine|ten) round\b/g, '$1-round')
    .replace(/\bsbox\b/gi, 'S-box')
    .replace(/\bsuper sbox\b/gi, 'super S-box')
    .replace(/\bplaintext ciphertext\b/g, 'plaintext–ciphertext')
    .replace(/\bcorrect faulty\b/g, 'correct–faulty')
    .replace(/\bwall clock\b/g, 'wall-clock');
}

export function ResourceUnit({ unit }: { unit: string }) {
  return <span className="a-unit" data-native-unit={unit} title={`Source unit: ${unit}`}>{formatResourceUnit(unit)}</span>;
}

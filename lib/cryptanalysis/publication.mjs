// Shared by browser views and the generated bibliography. The inspected
// manuscript and its publication association remain separate in source data.
const journals = [
  [/^(?:IACR Transactions on Symmetric Cryptology|ToSC)\b/i, 'ToSC'],
  [/^(?:IACR Transactions on Cryptographic Hardware and Embedded Systems|TCHES)\b/i, 'TCHES'],
  [/^(?:IACR Communications in Cryptology|CiC)\b/i, 'CiC'],
  [/^(?:Journal of Cryptology|J\. Cryptology|JoC)\b/i, 'Journal of Cryptology'],
  [/^(?:Designs, Codes and Cryptography|DCC)\b/i, 'DCC'],
  [/^IEEE Transactions on Information Theory\b/i, 'IEEE TIT'],
  [/^Cryptography and Communications/i, 'Cryptography and Communications'],
  [/^IEICE Transactions on Fundamentals/i, 'IEICE Trans. Fundamentals'],
];

export function publicationLabel(source) {
  const { venue, year: publicationYear, event_year, kind } = source.publication;
  const year = kind === 'conference' ? event_year ?? publicationYear : publicationYear;
  const name = venue.trim();
  if (kind === 'preprint' && /eprint/i.test(name)) {
    const report = (source.eprint ?? name).match(/\b(?:19|20)\d{2}\/\d+\b/);
    return `ePrint ${report?.[0] ?? year}`;
  }
  if (kind === 'conference') {
    const base = name.split(';')[0].replace(/\s*(?:19|20)\d{2}(?=\b|,)[\s\S]*$/, '').trim();
    return `${base} ${year}`;
  }
  if (kind === 'journal') {
    const alias = journals.find(([pattern]) => pattern.test(name))?.[1];
    const issue = name.match(new RegExp(`${publicationYear}\\s*\\((\\d+)\\)`))?.[1];
    const base = alias ?? name.replace(new RegExp(`\\s*${publicationYear}(?=\\b|\\()[\\s\\S]*$`), '').trim();
    return `${base} ${year}${issue ? `(${issue})` : ''}`;
  }
  // Standards retain identifying numbers such as FIPS 197 and 197-upd1.
  return new RegExp(`(?:^|\\D)${year}(?:\\D|$)`).test(name) ? name : `${name} ${year}`;
}

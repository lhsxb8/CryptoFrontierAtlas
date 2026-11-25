'use strict';

const {existsSync, readFileSync} = require('node:fs');
const {join} = require('node:path');

function publicationPatterns(root) {
  const file = join(root, '.local/publication-policy.json');
  if (!existsSync(file)) return [];
  try {
    const policy = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(policy.patterns) || !policy.patterns.every(value => typeof value === 'string' && value.length > 0)) throw new Error();
    return policy.patterns.map(value => new RegExp(value, 'i'));
  } catch { throw new Error('Invalid local publication rules.'); }
}

// Public URLs may legitimately contain /papers/ or /reports/. Inspect local
// references outside URLs; never replace an academic URL by substring matching.
const withoutUrls = text => text.replace(/https?:\/\/[^\s<>"`]+/g, '');
const localReference = /(?:^|[^A-Za-z0-9_/])(?:reports|reviews|provenance|tests\/fixtures|papers|\.local|\.cache|\.agents|\.codex)\/[A-Za-z0-9_.\/-]+/;
const machinePath = /(?:\/(?:tmp|var\/tmp|home|Users|data_600G)\/|file:\/\/|[A-Za-z]:\\)/;
function credentialLike(text) {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
    || /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16})\b/.test(text);
}
function assertPublicText(text, label, patterns = []) {
  if (patterns.some(pattern => pattern.test(text))) throw new Error(`${label}: restricted content`);
  if (credentialLike(text)) throw new Error(`${label}: credential-like content`);
  const localText = withoutUrls(text);
  if (machinePath.test(localText) || localReference.test(localText)) throw new Error(`${label}: local artifact reference`);
}

function publicText(text) {
  // Only substitute the path token, keeping the surrounding claim, qualification,
  // source page/table locator and explicit statement that the audit is local.
  return text.replace(/https?:\/\/[^\s<>"`]+|(?:reports|reviews|provenance|tests\/fixtures|papers|\.local|\.cache|\.agents|\.codex)\/[A-Za-z0-9_.\/-]+/g,
    token => /^https?:/.test(token) ? token : '[local audit reference not distributed]');
}
function publicCopy(value) {
  if (typeof value === 'string') return publicText(value);
  if (Array.isArray(value)) return value.map(publicCopy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, publicCopy(item)]));
  return value;
}

module.exports = {publicationPatterns, credentialLike, assertPublicText, publicText, publicCopy};

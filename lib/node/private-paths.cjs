'use strict';

// Shared publication policy. HTTP adds development outputs, not a second copy
// of these rules. Git ignore rules remain independently tested against this list.
const privateDirectories = new Set([
  '.cache', '.local', '.lake', '.agents', '.codex', '.claude', '.cursor', '.windsurf',
  '.continue', '.gemini', '.opencode', '.copilot', '.clinerules',
  'skills', 'prompts', 'sessions', 'transcripts',
]);
const instructionName = /^(?:agents?(?:\.override)?|claude(?:\.local)?|gemini|skill|copilot-instructions)\.md.*$/i;
const assistantFile = /^(?:\.cursorrules|\.windsurfrules|\.clinerules|\.aider)/i;
function privateWorkspacePath(path) {
  const parts = path.replaceAll('\\', '/').toLowerCase().split('/');
  return /^src\/features\/cryptanalysis\/[^/]+\.test\.mjs$/.test(parts.join('/'))
    || parts.some((part, index) => privateDirectories.has(part)
      || instructionName.test(part) || assistantFile.test(part)
      || part === 'cryptanalysisfrontieratlas'
      || part === 'cryptanalysis' && parts[index - 1] === 'data'
      || part === 'fixtures' && parts[index - 1] === 'tests'
      || part === 'lean' && parts[index - 1] === 'data'
      || ['corpus', 'ui-local'].includes(part) && parts[index - 1] === 'tests'
      || /^(?:reports|papers|archives?|vendor)$/.test(part)
      || /^\.env(?:\..*)?$/.test(part) && part !== '.env.example'
      || /\.(?:pem|key|p12|pfx|jks|keystore|crt|cer)$/.test(part)
      || /^(?:pagefile|swapfile|hiberfil)\.sys$/.test(part)
      || parts[index - 1] === '.github' && ['agents', 'instructions'].includes(part));
}
function privateHttpPath(path) {
  return privateWorkspacePath(path) || path.replaceAll('\\', '/').split('/').some(part =>
    /^(?:\.git|\.env(?:\..*)?|\.npmrc|\.yarnrc\.yml|dist-local|test-results|playwright-report|blob-report|coverage)$/i.test(part)
    || /\.(?:der|log|tsbuildinfo)$/i.test(part));
}
module.exports = {privateWorkspacePath, privateHttpPath};

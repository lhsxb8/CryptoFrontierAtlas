import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const bundle = await build({entryPoints: [fileURLToPath(new URL('../../src/features/cryptanalysis/Formula.tsx', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic'});
const compiled = {exports: {}};
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const {Formula, formatNativeExpression} = compiled.exports;
const render = expression => renderToStaticMarkup(createElement(Formula, {expression, readable: true}));

test('native prose power repair is visibly separated while the original field is retained', () => {
  for (const expression of ['approximately2^32 operations', 'number of2^64-plaintext structures', 'No0.98^4 independence product']) {
    const html = render(expression);
    assert.ok(html.includes(`data-native-expression="${expression}"`));
    assert.match(html, /math-text-gap/);
    assert.doesNotMatch(html, /katex-error/);
  }
});

test('parenthetical mathematical explanations do not absorb English words as function names', () => {
  for (const word of ['and', 'for', 'the', 'per', 'see']) {
    const value = formatNativeExpression(`${word}(2^32)`);
    assert.equal(value, word + String.raw`\(\left(2^{32}\right)\)`);
    const html = render(`${word}(2^32)`);
    assert.match(html, /math-text-gap/);
    assert.doesNotMatch(html, new RegExp(`\\\\operatorname\\{${word}\\}`));
    assert.match(html, /\\bigl\(/);
    assert.match(html, /\\bigr\)/);
  }
  for (const expression of ['Pr(x)', 'Phi(x)', 'pf(n)', 'max(2^32,n)']) {
    assert.ok(formatNativeExpression(expression));
    assert.doesNotMatch(render(expression), /katex-error|math-text-gap/);
  }
});

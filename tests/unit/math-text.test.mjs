import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/components/MathText.tsx', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
});
const localRequire = createRequire(import.meta.url);
function loadMathText(requireModule = localRequire) {
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(requireModule, compiled, compiled.exports);
  return compiled.exports.MathText;
}
const MathText = loadMathText();
const render = (text) => renderToStaticMarkup(createElement(MathText, { text }));
const count = (html, className) => (html.match(new RegExp(`class="${className}"`, 'g')) || []).length;

test('MathText preserves empty and ordinary text without introducing math markup', () => {
  assert.equal(render(''), '');
  assert.equal(render('AES-128 has ten rounds.'), '<span>AES-128 has ten rounds.</span>');
  assert.equal(render('A & B < C'), '<span>A &amp; B &lt; C</span>');
});

test('dollar and parenthesis delimiters both render inline math', () => {
  for (const text of ['$x^2 + 1$', String.raw`\(x^2 + 1\)`]) {
    const html = render(text);
    assert.equal(count(html, 'math-inline'), 1, text);
    assert.equal(count(html, 'math-display'), 0, text);
    assert.equal(count(html, 'katex'), 1, text);
    assert.match(html, /<annotation encoding="application\/x-tex">x\^2 \+ 1<\/annotation>/);
  }
});

test('double-dollar and bracket delimiters both render display math, including multiline input', () => {
  for (const text of ['$$x +\ny$$', '\\[x +\ny\\]']) {
    const html = render(text);
    assert.equal(count(html, 'math-display'), 1, text);
    assert.equal(count(html, 'math-inline'), 0, text);
    assert.equal(count(html, 'katex-display'), 1, text);
    assert.match(html, /<annotation encoding="application\/x-tex">x \+\ny<\/annotation>/);
  }
});

test('readable display math wraps presentation groups without changing source operations or enabling trust', () => {
  const html = renderToStaticMarkup(createElement(MathText, {
    text: String.raw`\(w\cdot\left(D_1+2^{72.74}n+2^{69.32}\right)\)`, readable: true, display: true,
  }));
  assert.equal(count(html, 'math-display'), 1);
  assert.match(html, /\\bigl/);
  for (const term of ['72.74', '69.32', 'D_']) assert.ok(html.includes(term));
  assert.doesNotMatch(html, /katex-error/);
  const untrusted = renderToStaticMarkup(createElement(MathText, { text: String.raw`$\href{javascript:alert(1)}{x}$`, readable: true, display: true }));
  assert.doesNotMatch(untrusted, /<a\b|\bhref="javascript:/);
});

test('display preference does not turn mathematical fragments inside prose into standalone equations', () => {
  const html = renderToStaticMarkup(createElement(MathText, { text: 'Cost $a+b$ and probability $p$.', readable: true, display: true }));
  assert.equal(count(html, 'math-inline'), 2);
  assert.equal(count(html, 'math-display'), 0);
  assert.match(html, /Cost /);
  assert.match(html, / and probability /);
});

test('mixed delimiters retain surrounding prose and render each formula once', () => {
  const html = render(String.raw`Before $a$ / \(b\) / $$c$$ / \[d\] after.`);
  assert.equal(count(html, 'math-inline'), 2);
  assert.equal(count(html, 'math-display'), 2);
  assert.equal(count(html, 'katex'), 4);
  assert.ok(html.startsWith('<span>Before </span>'));
  assert.ok(html.endsWith('<span> after.</span>'));
  assert.equal((html.match(/<span> \/ <\/span>/g) || []).length, 3);
  for (const formula of ['a', 'b', 'c', 'd']) {
    assert.equal((html.match(new RegExp(`<annotation encoding="application/x-tex">${formula}</annotation>`, 'g')) || []).length, 1);
  }
});

test('unmatched delimiters and multiline single-dollar text remain literal', () => {
  for (const text of ['Unclosed $x', String.raw`Unclosed \(x`, String.raw`Unclosed \[x`, '$x\ny$', '$$']) {
    const html = render(text);
    assert.equal(count(html, 'math-inline'), 0, text);
    assert.equal(count(html, 'math-display'), 0, text);
    assert.equal(html, `<span>${text}</span>`);
  }
});

test('inline math separates attached English and Chinese prose without changing formulas', () => {
  for (const text of [String.raw`approximately\(2^{32}\)`, String.raw`number of\(2^{64}\)-plaintext structures`,
    String.raw`代价\(2^{32}\)次查询`, '$x$operations']) {
    const html = render(text);
    assert.match(html, /class="math-text-gap">\u2009<\/span>/);
    assert.equal(count(html, 'math-inline'), 1);
    assert.doesNotMatch(html, /katex-error/);
  }
  assert.equal(count(render(String.raw`代价\(2^{32}\)次查询`), 'math-text-gap'), 2);
});

test('explicit parentheses, punctuation, hyphenated units and function products stay intact', () => {
  for (const text of [String.raw`cost (\(2^{32}\)), then $x$.`, String.raw`（\(n+1\)）`,
    'f$(x)$', '$x$-bit', 'AES-$128$', '$x$$y$', 'cost $x$ operations', 'cost$$x$$']) {
    assert.equal(count(render(text), 'math-text-gap'), 0, text);
  }
  const html = render(String.raw`cost (\(2^{32}\)), then $x$.`);
  assert.match(html, /<span>cost \(<\/span>/);
  assert.match(html, /<span>\), then <\/span>/);
});

test('HTML and event-handler text outside math is escaped by React', () => {
  const html = render('<script>alert("unsafe")</script><img src=x onerror=alert(1)> & $x$ <svg onload=alert(2)>');
  assert.doesNotMatch(html, /<(?:script|img|svg)\b/i);
  assert.match(html, /&lt;script&gt;alert\(&quot;unsafe&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;svg onload=alert\(2\)&gt;/);
  assert.equal(count(html, 'math-inline'), 1);
});

test('untrusted KaTeX URL and image commands cannot create executable links or remote images', () => {
  const expressions = [
    String.raw`\href{javascript:alert(1)}{click}`,
    String.raw`\url{javascript:alert(1)}`,
    String.raw`\href{https://example.invalid/test}{click}`,
    String.raw`\includegraphics{https://example.invalid/track.png}`,
  ];
  for (const expression of expressions) {
    const html = render(`$${expression}$`);
    assert.equal(count(html, 'math-inline'), 1, expression);
    // TeX may appear in inert MathML annotation text, but never as an active tag or URL attribute.
    assert.doesNotMatch(html, /<(?:a|img|script|iframe|object|embed)\b/i, expression);
    assert.doesNotMatch(html, /\b(?:href|src|xlink:href)\s*=\s*["'](?:javascript:|https:\/\/example\.invalid)/i, expression);
  }
});

test('every KaTeX call explicitly disables trust and uses the matching display mode', () => {
  const calls = [];
  const checkedMathText = loadMathText((id) => id === 'katex' ? {
    renderToString(formula, options) {
      calls.push({ formula, options });
      return '<span>rendered safely</span>';
    },
  } : localRequire(id));
  renderToStaticMarkup(createElement(checkedMathText, { text: String.raw`$a$ \(b\) $$c$$ \[d\]` }));
  assert.deepEqual(calls.map(({ formula }) => formula), ['a', 'b', 'c', 'd']);
  assert.deepEqual(calls.map(({ options }) => options.displayMode), [false, false, true, true]);
  for (const { options } of calls) {
    assert.equal(options.trust, false);
    assert.equal(options.throwOnError, false);
    assert.equal(options.maxSize, 20);
    assert.equal(options.maxExpand, 200);
  }
});

test('untrusted KaTeX HTML extensions cannot inject classes, IDs, styles or data attributes', () => {
  const expressions = [
    String.raw`\htmlClass{attacker-class}{x}`,
    String.raw`\htmlId{attacker-id}{x}`,
    String.raw`\htmlStyle{color:magenta;background-image:url(javascript:alert(1))}{x}`,
    String.raw`\htmlData{attack=payload}{x}`,
  ];
  for (const expression of expressions) {
    const html = render(`$${expression}$`);
    assert.doesNotMatch(html, /class="attacker-class"|id="attacker-id"|data-attack=/i, expression);
    assert.doesNotMatch(html, /style="[^"]*(?:magenta|background-image|javascript:)/i, expression);
    assert.doesNotMatch(html, /<(?:script|iframe|object|embed)\b/i, expression);
  }
});

test('invalid math renders safe error output without aborting surrounding prose', () => {
  let html;
  assert.doesNotThrow(() => { html = render(String.raw`Before $\unknowncommand{<script>alert(1)</script>}$ after.`); });
  assert.ok(html.startsWith('<span>Before </span>'));
  assert.ok(html.endsWith('<span> after.</span>'));
  assert.doesNotMatch(html, /<script\b/i);
  assert.equal(count(html, 'math-inline'), 1);
});

test('unexpected renderer errors fall back to escaped literal tokens', () => {
  const failingMathText = loadMathText((id) => id === 'katex' ? {
    renderToString() { throw new Error('Deliberate test failure'); },
  } : localRequire(id));
  const html = renderToStaticMarkup(createElement(failingMathText, { text: 'Before $<img src=x onerror=alert(1)>$ after.' }));
  assert.equal(html, '<span>Before </span><span>$&lt;img src=x onerror=alert(1)&gt;$</span><span> after.</span>');
  assert.doesNotMatch(html, /<img\b/i);
});

test('recursive macros stop at the expansion budget and preserve surrounding text', () => {
  const html = render(String.raw`Before $\def\loop{\loop}\loop$ after.`);
  assert.match(html, /katex-error/);
  assert.match(html, /Too many expansions/);
  assert.ok(html.startsWith('<span>Before </span>'));
  assert.ok(html.endsWith('<span> after.</span>'));
});

test('explicit TeX dimensions are capped without changing the retained source', () => {
  const html = render(String.raw`$\rule{1000em}{1000em}$`);
  assert.match(html, /width="20em" height="20em"/);
  assert.doesNotMatch(html, /(?:style|width|height)="[^"]*1000em/);
  assert.match(html, /<annotation encoding="application\/x-tex">\\rule\{1000em\}\{1000em\}<\/annotation>/);
});

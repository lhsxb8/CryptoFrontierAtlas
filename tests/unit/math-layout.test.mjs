import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import katex from 'katex';

const bundled = await build({ entryPoints: [fileURLToPath(new URL('../../src/components/math-layout.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs' });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { readableMath } = compiled.exports;
const tokens = latex => latex.replace(/\\(?:left|right|bigl|bigr|allowbreak)\s*/g, '').replace(/\s+/g, '');

test('readable math exposes sum and list breaks without changing mathematical tokens', () => {
  for (const latex of [
    String.raw`w\cdot\left(D_1+2^{72.74}n+\left(1+2^{12}\operatorname{pf}(n)\right)2^{69.32}\right)`,
    String.raw`C_{\mathrm{full}}=2^{n-2d}\left(C_{\mathrm{biclique}}+C_{\mathrm{precomp}}+C_{\mathrm{recomp}}+C_{\mathrm{falsepos}}\right)`,
    String.raw`n\in\{1,2,3,4,5,6\}`, String.raw`\Phi^{-1}\left(1-\alpha_0\right)`,
  ]) {
    const flow = readableMath(latex);
    assert.equal(tokens(flow), tokens(latex));
    assert.doesNotThrow(() => katex.renderToString(flow, { throwOnError: true }));
  }
  assert.match(readableMath(String.raw`\left(a+b+c\right)`), /\\bigl\(a\+b\+c\\bigr\)/);
  assert.match(readableMath('1,2,3'), /\\allowbreak/);
});

test('scripts, fractions, text, escaped braces and authored multiline environments stay atomic', () => {
  for (const latex of [
    String.raw`2^{\left(n+2^c\right)}`, String.raw`\frac{\left(a+b\right)}{\left(c+d\right)}`,
    String.raw`\text{one, two, \left(three\right)}`, String.raw`\begin{aligned}T&=a+b\\&=c\end{aligned}`,
    String.raw`\left.\frac{a+b}{2}\right)`, String.raw`\left(\frac{a+b}{2}\right|_{n=3}`,
  ]) assert.equal(readableMath(latex), latex);
  assert.equal(tokens(readableMath(String.raw`x\in\{1,2\}`)), tokens(String.raw`x\in\{1,2\}`));
});

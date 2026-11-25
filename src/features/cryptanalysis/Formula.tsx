import { MathText } from '../../components/MathText';

const MAX_EXPRESSION_LENGTH = 4096;
const MAX_TOKENS = 512;
const MAX_DEPTH = 32;
const delimitedMath = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/;
const operators: Record<string, { precedence: number; latex: string }> = {
  '=': { precedence: 1, latex: '=' }, '<': { precedence: 1, latex: '<' }, '>': { precedence: 1, latex: '>' },
  '<=': { precedence: 1, latex: '\\leq' }, '>=': { precedence: 1, latex: '\\geq' },
  '≤': { precedence: 1, latex: '\\leq' }, '≥': { precedence: 1, latex: '\\geq' },
  '≈': { precedence: 1, latex: '\\approx' }, '≃': { precedence: 1, latex: '\\simeq' },
  'in': { precedence: 1, latex: '\\in' }, '∈': { precedence: 1, latex: '\\in' },
  '!=': { precedence: 1, latex: '\\neq' }, '≠': { precedence: 1, latex: '\\neq' },
  '->': { precedence: 1, latex: '\\to' }, '→': { precedence: 1, latex: '\\to' },
  '..': { precedence: 0, latex: '\\ldots' },
  '+': { precedence: 2, latex: '+' }, '-': { precedence: 2, latex: '-' }, '−': { precedence: 2, latex: '-' },
  'XOR': { precedence: 2, latex: '\\oplus' },
  '*': { precedence: 3, latex: '\\cdot' }, '×': { precedence: 3, latex: '\\times' },
  '·': { precedence: 3, latex: '\\cdot' }, '/': { precedence: 3, latex: '/' },
};
const closing: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const greekNames = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'];
const namedSymbols: Record<string, string> = Object.fromEntries([
  ...greekNames.flatMap(name => {
    const capital = name[0].toUpperCase() + name.slice(1);
    return [[name, `\\${name}`], [capital, `\\${capital}`]];
  }),
  ...['ell', 'varepsilon', 'vartheta', 'varpi', 'varrho', 'varsigma', 'varphi', 'varkappa'].map(name => [name, `\\${name}`]),
  ['infinity', '\\infty'],
]);
const largeOperators: Record<string, string> = { integral: '\\int', sum: '\\sum', prod: '\\prod', product: '\\prod' };
const specialFunctions = new Set(['sqrt', 'binom', 'ceil', 'floor']);
const standardFunctions = new Set(['exp', 'ln', 'log', 'sin', 'cos', 'tan', 'min', 'max', 'Pr', 'erf', 'erfc', 'erfinv']);
// Short English words before a parenthetical formula are prose, not functions.
const proseWords = new Set(['and', 'for', 'the', 'not', 'but', 'per', 'are', 'can', 'has', 'its', 'was', 'our', 'any', 'all', 'one', 'two', 'via', 'use', 'see']);
// Keep multi-letter source identifiers intact; do not infer an unrecorded subscript.
const nativeIdentifiers = new Set(['Ns', 'ns', 'Ps', 'PS', 'nB', 'mB', 'mF', 'nF', 'ni', 'nj', 'prand', 'pAES', 'Nstr', 'Enc', 'MA', 'hugeMA']);
// Extracted prose sometimes omits the space before a numeric power. Restrict
// this lexical repair to prose words, never Greek or source variable names.
const prosePowerWords = 'approximately|about|headline|body|to|than|says|original|sum|least|claim|aggregate|repeated|overall|repeating|hence|source|stores|as|with|stated|overhead|storage|memory|of|by|initial|and|cardinality|scale|remains|cap|is|has|normalization|exactly|writes|no';
const prosePowerPrefix = new RegExp(String.raw`^(${prosePowerWords})(\d+(?:\.\d+)?)$`, 'i');
function nativeSymbol(value: string): { latex: string; subscript: boolean; named: boolean } | null {
  const match = /^([A-Za-z]+)(\d*)(_?\$)?$/.exec(value);
  if (!match) return null;
  const [, name, index, dollar] = match;
  const named = Object.prototype.hasOwnProperty.call(namedSymbols, name);
  if (!named && name.length !== 1) {
    if (!nativeIdentifiers.has(name) && !/^[a-z][A-Z]$/.test(name)) return null;
    return { latex: `\\mathit{${name}${index}}${dollar ? '\\$' : ''}`, subscript: false, named: false };
  }
  const base = named ? namedSymbols[name] : name;
  return { latex: base + (index ? `_{${index}}` : '') + (dollar === '_$' ? '_{\\$}' : dollar ? '\\$' : ''), subscript: Boolean(index || dollar === '_$'), named };
}
type Token = { value: string; start: number; end: number; prose?: boolean };
type Fragment = { latex: string; next: number; strong: boolean; grouped?: string; subscript?: boolean; callable?: boolean; functionKind?: string; integral?: boolean; large?: boolean };

/** A bounded typesetter, not an evaluator: every numeral and operation stays source-native. */
function nativeTokens(expression: string): Token[] | null {
  const tokens: Token[] = [];
  // Keep a complete decimal base when extracted prose omits its leading space
  // (e.g. No0.98^4); never typeset only the fractional digits as the power base.
  const pattern = new RegExp(String.raw`(?:${prosePowerWords})\d+(?:\.\d+)?(?=\^)|\d+(?:\.\d+)?|[A-Za-z][A-Za-z0-9]*(?:_?\$)?|\.\.\.|\.\.|<=|>=|!=|->|[^\s]`, 'gi');
  for (const match of expression.matchAll(pattern)) {
    if (tokens.length >= MAX_TOKENS) return null;
    const start = match.index!;
    const split = expression[start + match[0].length] === '^' && !nativeSymbol(match[0]) ? prosePowerPrefix.exec(match[0]) : null;
    if (split) {
      if (tokens.length + 2 > MAX_TOKENS) return null;
      const boundary = start + split[1].length;
      tokens.push({ value: split[1], start, end: boundary, prose: true }, { value: split[2], start: boundary, end: start + match[0].length });
    } else tokens.push({ value: match[0], start, end: start + match[0].length });
  }
  return tokens;
}

function parseNative(tokens: Token[], start: number, minimum = 0, depth = 0, mathContext = false): Fragment | null {
  if (depth >= MAX_DEPTH) return null;
  const value = tokens[start]?.value;
  if (!value) return null;
  const symbol = nativeSymbol(value);
  let left: Fragment | null = null;

  if (value === '+' || value === '-' || value === '−' || ['<', '>', '<=', '>=', '≤', '≥'].includes(value)) {
    const argument = parseNative(tokens, start + 1, 4, depth + 1, mathContext);
    if (argument) left = { latex: `${operators[value].latex} ${argument.latex}`, next: argument.next, strong: argument.strong || value.length > 1 || /[<>≤≥]/.test(value) };
  } else if (closing[value]) {
    const inner = parseNative(tokens, start + 1, 0, depth + 1, mathContext);
    if (inner) {
      const entries = [inner.latex];
      let next = inner.next;
      while (tokens[next]?.value === ',') {
        const entry = parseNative(tokens, next + 1, 0, depth + 1, mathContext);
        if (!entry) return null;
        entries.push(entry.latex);
        next = entry.next;
      }
      if (tokens[next]?.value !== closing[value]) return null;
      const open = value === '{' ? '\\{' : value;
      const close = value === '{' ? '\\}' : closing[value];
      const content = entries.join(', ');
      left = { latex: `\\left${open}${content}\\right${close}`, grouped: content, next: next + 1, strong: inner.strong || entries.length > 1 };
    }
  } else if (value === '...') {
    left = { latex: '\\ldots', next: start + 1, strong: true };
  } else if (/^\d+(?:\.\d+)?$/.test(value)) {
    left = { latex: value, next: start + 1, strong: false };
  } else if (Object.prototype.hasOwnProperty.call(largeOperators, value) && ['_', '^'].includes(tokens[start + 1]?.value)) {
    left = { latex: largeOperators[value], next: start + 1, strong: true, integral: value === 'integral', large: value !== 'integral' };
  } else if (symbol || specialFunctions.has(value) || standardFunctions.has(value)
    || /^[A-Za-z]{2,3}$/.test(value) && !proseWords.has(value.toLowerCase()) && ['(', '['].includes(tokens[start + 1]?.value)
    || mathContext && /^[A-Za-z][A-Za-z0-9]*$/.test(value)) {
    // A function's explicit arguments are mathematical identifiers. Preserve
    // multi-letter names such as CON, pA and XI; do not guess their subscripts
    // or interpret ordinary words elsewhere in prose as variables.
    const latex = symbol?.latex ?? (standardFunctions.has(value) && !['erf', 'erfc', 'erfinv'].includes(value) ? `\\${value}`
      : mathContext && !['(', '['].includes(tokens[start + 1]?.value) && !specialFunctions.has(value) && !standardFunctions.has(value)
        ? `\\mathit{${value}}` : `\\operatorname{${value}}`);
    left = { latex, next: start + 1, strong: Boolean(symbol?.named || value.endsWith('$')), subscript: symbol?.subscript, callable: true, functionKind: specialFunctions.has(value) ? value : undefined };
  }
  if (!left) return null;

  while (left.next < tokens.length) {
    const operation: string = tokens[left.next].value;
    if (operation === '!' && minimum <= 4) {
      left = { ...left, latex: `${left.latex}!`, next: left.next + 1, strong: true };
      continue;
    }
    if (['(', '['].includes(operation) && minimum <= 4 && left.callable && tokens[left.next].start === tokens[left.next - 1].end) {
      const args: string[] = [];
      let next: number = left.next + 1;
      while (true) {
        const argument = parseNative(tokens, next, 0, depth + 1, true);
        if (!argument) return null;
        args.push(argument.latex);
        next = argument.next;
        if (tokens[next]?.value !== ',') break;
        next++;
      }
      if (tokens[next]?.value !== closing[operation]) return null;
      if (left.functionKind) {
        if (args.length !== (left.functionKind === 'binom' ? 2 : 1)) return null;
        const latex: string = left.functionKind === 'sqrt' ? `\\sqrt{${args[0]}}`
          : left.functionKind === 'binom' ? `\\binom{${args[0]}}{${args[1]}}`
            : left.functionKind === 'ceil' ? `\\left\\lceil ${args[0]}\\right\\rceil` : `\\left\\lfloor ${args[0]}\\right\\rfloor`;
        left = { latex, next: next + 1, strong: true };
      } else left = { latex: `${left.latex}\\left${operation}${args.join(', ')}\\right${closing[operation]}`, next: next + 1, strong: true };
      continue;
    }
    if ((operation === '^' || operation === '_') && minimum <= 4) {
      // C3_11 and n_1_2 have ambiguous source-native coordinates. Do not
      // invent a grouping or emit invalid TeX such as C_{3}_{11}.
      if (operation === '_' && left.subscript) return null;
      const argument: Fragment | null = parseNative(tokens, left.next + 1, operation === '_' ? 5 : 4, depth + 1, operation === '^' || mathContext)
        ?? (operation === '_' && /^[A-Za-z]+$/.test(tokens[left.next + 1]?.value ?? '')
          ? { latex: `\\mathrm{${tokens[left.next + 1].value}}`, next: left.next + 2, strong: false } : null);
      if (!argument) return null;
      let subscript = argument.grouped ?? argument.latex;
      let next: number = argument.next;
      // Explicit textual subscripts such as D_per_delta are one literal index;
      // ambiguous numeric coordinates (C3_11, n_1_2) retain their fallback.
      if (operation === '_' && /^\\mathrm\{[A-Za-z]+\}$/.test(subscript)) {
        while (tokens[next]?.value === '_' && /^[A-Za-z]+$/.test(tokens[next + 1]?.value ?? '')) {
          subscript = subscript.slice(0, -1) + '\\_' + tokens[next + 1].value + '}';
          next += 2;
        }
      }
      const range: RegExpExecArray | null | false = operation === '_' && Boolean(left.large) && /^(.+?) = (.+?) \\ldots (.+)$/.exec(subscript);
      const suffix: string = range ? `_{${range[1]} = ${range[2]}}^{${range[3]}}` : `${operation}{${subscript}}`;
      left = { ...left, latex: `${left.latex}${suffix}`, next, strong: true, subscript: operation === '_' || left.subscript, functionKind: undefined };
      continue;
    }
    if (left.integral) {
      const integrand = parseNative(tokens, left.next, 0, depth + 1, true);
      const differential = integrand && /^d([A-Za-z])$/.exec(tokens[integrand.next]?.value ?? '');
      if (integrand && differential) {
        left = { latex: `${left.latex}\\,${integrand.latex}\\,\\mathrm{d}${differential[1]}`, next: integrand.next + 1, strong: true };
        continue;
      }
    }
    if (left.large && !['^', '_'].includes(operation)) {
      const argument = parseNative(tokens, left.next, 2, depth + 1, true);
      if (argument) { left = { latex: `${left.latex}\\,${argument.latex}`, next: argument.next, strong: true }; continue; }
    }
    // Preserve adjacent products such as 2d, binom(4,t)2^(-32t), and
    // (2^s-1)(q_(1-alpha0)+q_(1-alpha1)), without inventing an operator.
    if (minimum <= 3 && tokens[left.next].start === tokens[left.next - 1].end
      && (operation === '(' || nativeSymbol(operation) || /^\d+(?:\.\d+)?$/.test(operation))) {
      const right = parseNative(tokens, left.next, 4, depth + 1, mathContext);
      if (!right) break;
      left = { latex: `${left.latex}${right.latex}`, next: right.next, strong: true };
      continue;
    }
    const operator: { precedence: number; latex: string } | undefined = operators[operation];
    if (!operator || operator.precedence < minimum) break;
    const right = parseNative(tokens, left.next + 1, operator.precedence + 1, depth + 1, mathContext);
    if (!right) break;
    left = { latex: `${left.latex} ${operator.latex} ${right.latex}`, next: right.next, strong: true };
  }
  return left;
}

/** Returns delimiter-marked text for MathText, or null when safe recognition is unavailable. */
export function formatNativeExpression(expression: string, display = false): string | null {
  if (!expression || expression.length > MAX_EXPRESSION_LENGTH) return null;
  // Some native probability identifiers contain a literal dollar (p$). Only
  // recognize these when every dollar is an identifier suffix followed by a
  // native value/operator; genuine authored $...$ math stays untouched.
  const dollarIdentifiers = expression.includes('$') && !expression.includes('\\') && [...expression.matchAll(/\$/g)].every(match => {
    const name = expression.slice(0, match.index).match(/[A-Za-z][A-Za-z0-9]*_?$/)?.[0];
    return name && nativeSymbol(`${name}$`) && /^[\d=≈≃<>+\-,;.]/.test(expression.slice(match.index! + 1));
  });
  if (!dollarIdentifiers && delimitedMath.test(expression)) {
    // Preserve explicitly authored TeX, while also formatting native notation in
    // the surrounding prose. Never rewrite inside \text or another TeX command.
    const chunks = expression.split(new RegExp(delimitedMath.source, 'g'));
    return chunks.map(chunk => delimitedMath.test(chunk) ? chunk : formatNativeExpression(chunk) ?? chunk).join('');
  }
  const wrap = (latex: string, block = false) => block ? `\\[${latex}\\]` : `\\(${latex}\\)`;

  // Bare, explicit TeX is supported too. Longer words outside text/operator commands
  // make this ambiguous prose, which is deliberately not fed wholesale to KaTeX.
  if (/\\[A-Za-z]+/.test(expression)) {
    // Keep command boundaries: adjacent commands (e.g. \\quad\\lambda) are
    // mathematical tokens, not a prose word formed by their placeholders.
    const symbols = expression.replace(/\\(?:text|mathrm|mathit|operatorname)\{[^{}]*\}/g, ' x ').replace(/\\[A-Za-z]+|\\[^A-Za-z]/g, ' x ');
    return /[A-Za-z]{2,}/.test(symbols) ? null : wrap(expression, display);
  }
  // Unmatched TeX delimiters must stay literal, not combine with generated ones.
  if (/[\\$]/.test(expression) && !dollarIdentifiers) return null;
  const tokens = nativeTokens(expression);
  if (!tokens?.length) return null;
  const nesting: string[] = [];
  for (const token of tokens) {
    if (closing[token.value]) nesting.push(closing[token.value]);
    else if ([')', ']', '}'].includes(token.value) && nesting.pop() !== token.value) return null;
    if (nesting.length >= MAX_DEPTH) return null;
  }
  if (nesting.length) return null;
  const entire = parseNative(tokens, 0);
  if (entire?.next === tokens.length) return wrap(entire.latex, display);
  if (!entire && !tokens.some(token => token.prose || proseWords.has(token.value.toLowerCase())) && tokens.every(token => nativeSymbol(token.value) || specialFunctions.has(token.value) || standardFunctions.has(token.value)
    || /^(?:[A-Za-z]{2,3}|\d+(?:\.\d+)?|[()+\-−*/×·^_{}\[\],=<>≤≥]|<=|>=|XOR|\.\.\.)$/.test(token.value))) return null;

  // In prose, only expressions carrying explicit mathematical structure are
  // typeset. Isolated numbers, letters, units and explanatory words stay intact.
  const parts: string[] = [];
  let cursor = 0;
  for (let index = 0; index < tokens.length;) {
    const fragment = parseNative(tokens, index);
    if (fragment?.strong) {
      const first = tokens[index];
      const last = tokens[fragment.next - 1];
      parts.push(expression.slice(cursor, first.start), wrap(fragment.latex));
      cursor = last.end;
      index = fragment.next;
    } else index++;
  }
  if (!parts.length) return null;
  parts.push(expression.slice(cursor));
  return parts.join('');
}

/** The original field remains inspectable even when its mathematical fragments are typeset. */
export function Formula({ expression, display = false, readable = false }: { expression: string; display?: boolean; readable?: boolean }) {
  const formatted = formatNativeExpression(expression, display);
  return <span className={display ? 'a-formula a-formula-display' : 'a-formula'} data-native-expression={expression} title={expression}>{formatted === null ? expression : <MathText text={formatted} readable={readable} display={display} />}</span>;
}

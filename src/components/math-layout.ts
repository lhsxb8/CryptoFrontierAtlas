/** Presentation only: expose safe line breaks without changing any math tokens.
 * Script/command arguments stay atomic. Fixed-size parentheses let KaTeX break
 * a long parenthesized sum; \left...\right would make the entire sum one box.
 */
export function readableMath(latex: string): string {
  if (/\\(?:begin|tag)\b/.test(latex)) return latex;
  const pairs = new Set<number>();
  const stack: RegExpExecArray[] = [];
  for (const match of latex.matchAll(/\\(left|right)\s*(\\[A-Za-z]+|\\.|[^\s])/g)) {
    if (match[1] === 'left') stack.push(match);
    else {
      const left = stack.pop();
      // Never convert only half a pair, e.g. \left. ... \right).
      if (left && [left[2], match[2]].every(delimiter => /^(?:[()[\]]|\\[{}])$/.test(delimiter))) {
        pairs.add(left.index!);
        pairs.add(match.index!);
      }
    }
  }
  let depth = 0;
  let result = '';
  for (let index = 0; index < latex.length;) {
    const rest = latex.slice(index);
    if (latex[index] === '\\') {
      const delimiter = depth === 0 && pairs.has(index) && /^\\(left|right)\s*([()[\]]|\\[{}])/.exec(rest);
      if (delimiter) {
        result += `\\${delimiter[1] === 'left' ? 'bigl' : 'bigr'}${delimiter[2]}`;
        index += delimiter[0].length;
        continue;
      }
      const command = /^\\(?:[A-Za-z]+|.)/.exec(rest)?.[0] ?? '\\';
      result += command;
      index += command.length;
      continue;
    }
    const character = latex[index++];
    if (character === '{') depth++;
    if (character === '}') depth--;
    result += character;
    if (character === ',' && depth === 0) result += '\\allowbreak ';
  }
  return result;
}

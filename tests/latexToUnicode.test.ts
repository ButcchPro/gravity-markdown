import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latexToUnicode } from '../src/utils/latexToUnicode.ts';

test('converts greek letters and relations', () => {
  assert.equal(latexToUnicode('\\alpha + \\beta = \\gamma'), 'α + β = γ');
  assert.equal(latexToUnicode('a \\le b \\ge c'), 'a ≤ b ≥ c');
  assert.equal(latexToUnicode('x \\neq y \\approx z'), 'x ≠ y ≈ z');
});

test('converts operators, arrows and big symbols', () => {
  assert.equal(latexToUnicode('a \\times b \\div c'), 'a × b ÷ c');
  assert.equal(latexToUnicode('a \\to b \\Rightarrow c'), 'a → b ⇒ c');
  assert.equal(latexToUnicode('\\sum_{i} \\int f'), '∑ᵢ ∫ f');
});

test('renders fractions as numerator/denominator', () => {
  assert.equal(latexToUnicode('\\frac{a}{b}'), 'a/b');
  assert.equal(latexToUnicode('\\dfrac{1}{2}'), '1/2');
  assert.equal(latexToUnicode('\\tfrac{x+1}{y-1}'), 'x+1/y-1');
});

test('renders sqrt (braces are treated as grouping)', () => {
  assert.equal(latexToUnicode('\\sqrt{x}'), '√x');
  assert.equal(latexToUnicode('\\sqrt 2'), '√ 2');
});

test('maps braced superscripts to unicode when possible', () => {
  assert.equal(latexToUnicode('x^{2}'), 'x²');
  assert.equal(latexToUnicode('x^{n+1}'), 'xⁿ⁺¹');
});

test('falls back to plain text for unmappable superscripts', () => {
  assert.equal(latexToUnicode('x^{\\alpha}'), 'xα');
});

test('maps single-character subscripts and superscripts', () => {
  assert.equal(latexToUnicode('a_{i}'), 'aᵢ');
  assert.equal(latexToUnicode('v^2'), 'v²');
  assert.equal(latexToUnicode('x_i'), 'xᵢ');
});

test('unwraps accent and font commands', () => {
  assert.equal(latexToUnicode('\\overline{AB}'), 'AB');
  assert.equal(latexToUnicode('\\vec{v}'), 'v');
  assert.equal(latexToUnicode('\\textbf{Bold}'), 'Bold');
  assert.equal(latexToUnicode('\\mathrm{d}x'), 'dx');
});

test('drops delimiter sizing commands', () => {
  assert.equal(latexToUnicode('\\left( x \\right)'), '( x )');
  assert.equal(latexToUnicode('\\big[ y \\Big]'), '[ y ]');
});

test('handles escaped special characters', () => {
  assert.equal(latexToUnicode('100\\%'), '100%');
  assert.equal(latexToUnicode('\\$5'), '$5');
  assert.equal(latexToUnicode('a\\&b'), 'a&b');
});

test('skips unknown commands but keeps their braced argument', () => {
  assert.equal(latexToUnicode('\\unknowncmd{kept}'), 'kept');
  assert.equal(latexToUnicode('\\foo bar'), 'bar');
});

test('handles a single-character escape and spacing commands', () => {
  assert.equal(latexToUnicode('a\\+b'), 'a+b');
  assert.equal(latexToUnicode('a\\,b\\;c'), 'a b c');
  assert.equal(latexToUnicode('a\\!b'), 'ab');
});

test('drops standalone grouping braces and trims the result', () => {
  assert.equal(latexToUnicode('  {x}  '), 'x');
});

test('keeps plain text untouched', () => {
  assert.equal(latexToUnicode('E = mc^2'), 'E = mc²');
  assert.equal(latexToUnicode('plain text'), 'plain text');
});

test('survives unbalanced braces without looping', () => {
  // The unterminated {b is consumed as standalone grouping characters.
  assert.equal(latexToUnicode('\\frac{a}{b'), 'ab');
});
test('renders superscript commands without braces', () => {
  assert.equal(latexToUnicode('x^\\alpha'), 'xα');
  assert.equal(latexToUnicode('x^\\pi'), 'xπ');
});

test('does not loop on an unbalanced superscript brace', () => {
  // The stray brace is dropped as grouping; the digit stays literal.
  assert.equal(latexToUnicode('x^{2'), 'x^2');
});

test('renders subscript commands without braces', () => {
  assert.equal(latexToUnicode('a_\\beta'), 'aβ');
});

test('does not loop on an unbalanced subscript brace', () => {
  assert.equal(latexToUnicode('a_{i'), 'a_i');
});
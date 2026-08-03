/**
 * Converts common LaTeX math expressions to Unicode characters.
 * Used during DOCX export to render formulas as readable text.
 * Not exhaustive — covers the most frequently used LaTeX commands.
 */

const SYMBOLS: Record<string, string> = {
  // Greek lowercase
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
  '\\theta': 'θ', '\\vartheta': 'ϑ', '\\iota': 'ι', '\\kappa': 'κ',
  '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ',
  '\\pi': 'π', '\\varpi': 'ϖ', '\\rho': 'ρ', '\\varrho': 'ϱ',
  '\\sigma': 'σ', '\\varsigma': 'ς', '\\tau': 'τ', '\\upsilon': 'υ',
  '\\phi': 'φ', '\\varphi': 'ϕ', '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
  // Greek uppercase
  '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
  '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
  '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
  // Relations
  '\\le': '≤', '\\leq': '≤', '\\ge': '≥', '\\geq': '≥',
  '\\ne': '≠', '\\neq': '≠', '\\approx': '≈', '\\equiv': '≡',
  '\\sim': '∼', '\\simeq': '≃', '\\propto': '∝',
  '\\ll': '≪', '\\gg': '≫',
  '\\subset': '⊂', '\\supset': '⊃', '\\subseteq': '⊆', '\\supseteq': '⊇',
  '\\in': '∈', '\\notin': '∉', '\\ni': '∋',
  '\\perp': '⊥', '\\parallel': '∥',
  // Operators
  '\\pm': '±', '\\mp': '∓', '\\times': '×', '\\div': '÷',
  '\\cdot': '·', '\\ast': '∗', '\\star': '⋆',
  '\\circ': '°', '\\degree': '°',
  '\\bullet': '•', '\\dagger': '†', '\\ddagger': '‡',
  // Arrows
  '\\leftarrow': '←', '\\gets': '←', '\\rightarrow': '→', '\\to': '→',
  '\\leftrightarrow': '↔',
  '\\Leftarrow': '⇐', '\\Rightarrow': '⇒', '\\Leftrightarrow': '⇔',
  '\\uparrow': '↑', '\\downarrow': '↓', '\\updownarrow': '↕',
  '\\Uparrow': '⇑', '\\Downarrow': '⇓', '\\Updownarrow': '⇕',
  // Misc symbols
  '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
  '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄',
  '\\emptyset': '∅', '\\varnothing': '∅',
  '\\sum': '∑', '\\prod': '∏', '\\coprod': '∐',
  '\\int': '∫', '\\iint': '∬', '\\iiint': '∭', '\\oint': '∮',
  '\\sqrt': '√',
  '\\angle': '∠', '\\triangle': '△',
  '\\clubsuit': '♣', '\\diamondsuit': '♦', '\\heartsuit': '♥', '\\spadesuit': '♠',
  '\\ell': 'ℓ', '\\hbar': 'ℏ', '\\Re': 'ℜ', '\\Im': 'ℑ',
  '\\aleph': 'ℵ',
  // Overline/hat/tilde/bar (simplified — just output the content)
  '\\overline': '', '\\bar': '', '\\hat': '', '\\tilde': '', '\\vec': '',
  '\\dot': '', '\\ddot': '', '\\widehat': '', '\\widetilde': '',
  '\\overrightarrow': '', '\\overleftarrow': '',
  // Escaped special chars
  '\\%': '%', '\\$': '$', '\\&': '&', '\\#': '#', '\\_': '_',
  '\\{': '{', '\\}': '}', '\\\\': ' ',
  // Spacing
  '\\,': ' ', '\\:': ' ', '\\;': ' ', '\\!': '', '\\quad': '  ', '\\qquad': '    ',
  // Font commands (no-op, just consume)
  '\\mathrm': '', '\\mathbf': '', '\\mathit': '', '\\mathsf': '', '\\mathtt': '',
  '\\mathcal': '', '\\mathbb': '', '\\mathfrak': '', '\\text': '', '\\textbf': '',
  '\\textit': '', '\\textrm': '', '\\rm': '', '\\bf': '', '\\it': '', '\\sf': '', '\\tt': '',
  '\\operatorname': '', '\\mathop': '', '\\mathbin': '', '\\mathrel': '',
  '\\left': '', '\\right': '', '\\big': '', '\\Big': '', '\\bigg': '', '\\Bigg': '',
  // Fractions (simplified — just output numerator/denominator)
  '\\frac': '', '\\dfrac': '', '\\tfrac': '',
  // Limits, etc.
  '\\limits': '', '\\nolimits': '',
  // Common text commands
  '\\textdegree': '°', '\\textcelsius': '°C',
  '\\prime': '′', '\\second': '″',
};

// Unicode superscript and subscript mappings (extended)
const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ',
  'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ',
  'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ',
  'T': 'ᵀ', 'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ',
  '°': '°', '′': '′', '″': '″',
  '.': '·', ',': '‚', ':': '⁚',
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
  '°': '°',
};

/**
 * Check if all characters in a string have Unicode subscript/superscript equivalents.
 */
function canConvertToSubSuper(text: string, map: Record<string, string>): boolean {
  for (const ch of text) {
    if (!map[ch]) return false;
  }
  return true;
}

/**
 * Convert text to Unicode superscript or subscript if possible.
 * Returns null if conversion is not possible for some characters.
 */
function toSubSuper(text: string, map: Record<string, string>): string | null {
  if (!canConvertToSubSuper(text, map)) return null;
  return Array.from(text).map(ch => map[ch]).join('');
}

/**
 * Extract content inside balanced braces: {content}
 * Returns [content, indexAfterClosingBrace] or null if no braces found.
 */
function extractBracedContent(text: string, startIdx: number): [string, number] | null {
  if (startIdx >= text.length || text[startIdx] !== '{') return null;
  let depth = 0;
  let i = startIdx;
  while (i < text.length) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        return [text.slice(startIdx + 1, i), i + 1];
      }
    }
    i++;
  }
  return null; // Unbalanced braces
}

/**
 * Convert a LaTeX math string to Unicode text.
 */
export function latexToUnicode(latex: string): string {
  let result = '';
  let i = 0;

  while (i < latex.length) {
    // Handle backslash commands
    if (latex[i] === '\\') {
      // Try to match the longest known command
      let matched = false;
      for (let len = Math.min(20, latex.length - i); len >= 2; len--) {
        const cmd = latex.slice(i, i + len);
        if (SYMBOLS[cmd] !== undefined) {
          const replacement = SYMBOLS[cmd];
          // Font/no-op commands: consume the following {content}
          if (replacement === '' && cmd !== '\\\\' && cmd !== '\\!') {
            result += replacement;
            i += len;
            // Skip optional whitespace
            while (i < latex.length && latex[i] === ' ') i++;
            // Handle \frac special case: {numerator}{denominator}
            if (cmd === '\\frac' || cmd === '\\dfrac' || cmd === '\\tfrac') {
              const numBraced = extractBracedContent(latex, i);
              if (numBraced) {
                result += latexToUnicode(numBraced[0]);
                i = numBraced[1];
                while (i < latex.length && latex[i] === ' ') i++;
                const denBraced = extractBracedContent(latex, i);
                if (denBraced) {
                  result += '/' + latexToUnicode(denBraced[0]);
                  i = denBraced[1];
                }
              }
            }
            // Handle \overline, \bar, \hat, etc. — consume {content}
            else if (cmd === '\\overline' || cmd === '\\bar' || cmd === '\\hat' ||
                     cmd === '\\tilde' || cmd === '\\vec' || cmd === '\\dot' ||
                     cmd === '\\ddot' || cmd === '\\widehat' || cmd === '\\widetilde' ||
                     cmd === '\\overrightarrow' || cmd === '\\overleftarrow') {
              const braced = extractBracedContent(latex, i);
              if (braced) {
                result += latexToUnicode(braced[0]);
                i = braced[1];
              }
            }
            // Handle \left, \right, \big, etc. — just skip, no content
            else if (cmd === '\\left' || cmd === '\\right' || cmd === '\\big' ||
                     cmd === '\\Big' || cmd === '\\bigg' || cmd === '\\Bigg' ||
                     cmd === '\\limits' || cmd === '\\nolimits') {
              // These are delimiters/modifiers, just skip them
            }
            // Other no-op commands: consume {content} if present
            else {
              const braced = extractBracedContent(latex, i);
              if (braced) {
                result += latexToUnicode(braced[0]);
                i = braced[1];
              }
            }
          } else {
            result += replacement;
            i += len;
          }
          matched = true;
          break;
        }
      }

      // Unknown command: try to extract command name and skip it
      if (!matched) {
        let cmdEnd = i + 1;
        while (cmdEnd < latex.length && /[a-zA-Z]/.test(latex[cmdEnd])) {
          cmdEnd++;
        }
        if (cmdEnd > i + 1) {
          // Unknown command like \foo — skip it, consume {arg} if present
          i = cmdEnd;
          while (i < latex.length && latex[i] === ' ') i++;
          const braced = extractBracedContent(latex, i);
          if (braced) {
            result += latexToUnicode(braced[0]);
            i = braced[1];
          }
        } else {
          // Single non-alpha escape like \+ — just output the char
          result += latex[i + 1] ?? '';
          i += 2;
        }
      }
      continue;
    }

    // Handle superscript ^
    if (latex[i] === '^') {
      i++;
      while (i < latex.length && latex[i] === ' ') i++;
      if (i < latex.length && latex[i] === '{') {
        const braced = extractBracedContent(latex, i);
        if (braced) {
          // First resolve LaTeX commands inside braces, then try superscript
          const resolved = latexToUnicode(braced[0]);
          const converted = toSubSuper(resolved, SUPERSCRIPTS);
          result += converted ?? resolved;
          i = braced[1];
        } else {
          result += '^';
        }
      } else if (i < latex.length) {
        // Single char superscript — could be a LaTeX command starting with \
        if (latex[i] === '\\') {
          // Resolve the command first, then try superscript
          const remaining = latex.slice(i);
          const resolved = latexToUnicode(remaining);
          // Find how much of the string was consumed by looking for the first resolved char
          // Actually, just use latexToUnicode on the single element
          const ch = resolved.charAt(0);
          const converted = toSubSuper(ch, SUPERSCRIPTS);
          result += converted ?? ch;
          // Advance past the command — find where it ends
          let cmdEnd = i + 1;
          while (cmdEnd < latex.length && /[a-zA-Z]/.test(latex[cmdEnd])) {
            cmdEnd++;
          }
          i = cmdEnd;
        } else {
          const ch = latex[i];
          const converted = toSubSuper(ch, SUPERSCRIPTS);
          result += converted ?? ch;
          i++;
        }
      }
      continue;
    }

    // Handle subscript _
    if (latex[i] === '_') {
      i++;
      while (i < latex.length && latex[i] === ' ') i++;
      if (i < latex.length && latex[i] === '{') {
        const braced = extractBracedContent(latex, i);
        if (braced) {
          // First resolve LaTeX commands inside braces, then try subscript
          const resolved = latexToUnicode(braced[0]);
          const converted = toSubSuper(resolved, SUBSCRIPTS);
          result += converted ?? resolved;
          i = braced[1];
        } else {
          result += '_';
        }
      } else if (i < latex.length) {
        // Single char subscript — could be a LaTeX command starting with \
        if (latex[i] === '\\') {
          const ch = latexToUnicode(latex.slice(i)).charAt(0);
          const converted = toSubSuper(ch, SUBSCRIPTS);
          result += converted ?? ch;
          let cmdEnd = i + 1;
          while (cmdEnd < latex.length && /[a-zA-Z]/.test(latex[cmdEnd])) {
            cmdEnd++;
          }
          i = cmdEnd;
        } else {
          const ch = latex[i];
          const converted = toSubSuper(ch, SUBSCRIPTS);
          result += converted ?? ch;
          i++;
        }
      }
      continue;
    }

    // Skip braces that are not part of a command (standalone grouping)
    if (latex[i] === '{' || latex[i] === '}') {
      i++;
      continue;
    }

    // Regular character
    result += latex[i];
    i++;
  }

  return result.trim();
}

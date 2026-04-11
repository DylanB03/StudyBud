import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

type RichMessageContentProps = {
  content: string;
};

const superscriptChars = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ';
const subscriptChars = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ';
const latexCommandPattern =
  /\\(?:times|cdots|ldots|frac|sqrt|sum|prod|int|left|right|alpha|beta|gamma|delta|theta|lambda|mu|sigma|pi|sin|cos|tan|log|ln|leq|geq|neq|approx|to|infty|cdot|pm|mp|mathbf|mathrm|text)/;
const mathOnlyLinePattern = /^[A-Za-z0-9\\{}_^()[\]+\-*/=<>|,.:;\s]+$/;

const superscriptMap: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  'n': 'ⁿ',
  'i': 'ⁱ',
};

const subscriptMap: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  'a': 'ₐ',
  'e': 'ₑ',
  'h': 'ₕ',
  'i': 'ᵢ',
  'j': 'ⱼ',
  'k': 'ₖ',
  'l': 'ₗ',
  'm': 'ₘ',
  'n': 'ₙ',
  'o': 'ₒ',
  'p': 'ₚ',
  'r': 'ᵣ',
  's': 'ₛ',
  't': 'ₜ',
  'u': 'ᵤ',
  'v': 'ᵥ',
  'x': 'ₓ',
};

const superscriptToAsciiMap: Record<string, string> = Object.fromEntries(
  Object.entries(superscriptMap).map(([ascii, unicode]) => [unicode, ascii]),
) as Record<string, string>;

const subscriptToAsciiMap: Record<string, string> = Object.fromEntries(
  Object.entries(subscriptMap).map(([ascii, unicode]) => [unicode, ascii]),
) as Record<string, string>;

const replaceExponentNotation = (value: string): string => {
  return value.replace(
    /([A-Za-z0-9)\]])\^([+-]?[0-9ni()=+-]+)/g,
    (fullMatch, base: string, exponent: string) => {
      const translated = exponent
        .split('')
        .map((character) => superscriptMap[character] ?? '')
        .join('');

      if (!translated || translated.length !== exponent.length) {
        return fullMatch;
      }

      return `${base}${translated}`;
    },
  );
};

const replaceSubscriptNotation = (value: string): string => {
  return value.replace(
    /([A-Za-z0-9)\]])_([A-Za-z0-9()+-=]+)/g,
    (fullMatch, base: string, subscript: string) => {
      const translated = subscript
        .split('')
        .map((character) => subscriptMap[character] ?? '')
        .join('');

      if (!translated || translated.length !== subscript.length) {
        return fullMatch;
      }

      return `${base}${translated}`;
    },
  );
};

const normalizeUnicodeSuperscripts = (value: string): string => {
  const pattern = new RegExp(`([A-Za-z0-9)\\]])([${superscriptChars}]+)`, 'g');
  return value.replace(pattern, (fullMatch, base: string, superscriptGroup: string) => {
    const translated = superscriptGroup
      .split('')
      .map((character) => superscriptToAsciiMap[character] ?? '')
      .join('');

    if (!translated || translated.length !== superscriptGroup.length) {
      return fullMatch;
    }

    return `${base}^${translated.length > 1 ? `{${translated}}` : translated}`;
  });
};

const normalizeUnicodeSubscripts = (value: string): string => {
  const pattern = new RegExp(`([A-Za-z0-9)\\]])([${subscriptChars}]+)`, 'g');
  return value.replace(pattern, (fullMatch, base: string, subscriptGroup: string) => {
    const translated = subscriptGroup
      .split('')
      .map((character) => subscriptToAsciiMap[character] ?? '')
      .join('');

    if (!translated || translated.length !== subscriptGroup.length) {
      return fullMatch;
    }

    return `${base}_${translated.length > 1 ? `{${translated}}` : translated}`;
  });
};

const wrapMathLikeLines = (value: string): string => {
  return value
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes('$')) {
        return line;
      }

      if (!latexCommandPattern.test(trimmed)) {
        return line;
      }

      if (!mathOnlyLinePattern.test(trimmed)) {
        return line;
      }

      const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
      const trailingWhitespace = line.match(/\s*$/)?.[0] ?? '';

      return `${leadingWhitespace}$${trimmed}$${trailingWhitespace}`;
    })
    .join('\n');
};

const applyPlainTextMathFallback = (value: string): string => {
  return value
    .split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$)/g)
    .map((segment) => {
      if (
        (segment.startsWith('$$') && segment.endsWith('$$')) ||
        (segment.startsWith('$') && segment.endsWith('$'))
      ) {
        return segment;
      }

      return replaceSubscriptNotation(replaceExponentNotation(segment));
    })
    .join('');
};

const normalizeMathFriendlyText = (value: string): string => {
  return value
    .split(/(```[\s\S]*?```)/g)
    .map((block) => {
      if (block.startsWith('```')) {
        return block;
      }

      return block
        .split(/(`[^`]*`)/g)
        .map((segment) => {
          if (segment.startsWith('`') && segment.endsWith('`')) {
            return segment;
          }

          const normalizedForLatex = wrapMathLikeLines(
            normalizeUnicodeSubscripts(normalizeUnicodeSuperscripts(segment)),
          );

          return applyPlainTextMathFallback(normalizedForLatex);
        })
        .join('');
    })
    .join('');
};

export const RichMessageContent = ({ content }: RichMessageContentProps) => {
  return (
    <div className="chat-message-rich">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {normalizeMathFriendlyText(content)}
      </ReactMarkdown>
    </div>
  );
};

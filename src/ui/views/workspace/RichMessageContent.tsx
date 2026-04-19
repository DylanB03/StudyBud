import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { cn } from '../../theme/cn';

type RichMessageContentProps = {
  content: string;
  compact?: boolean;
};

const superscriptChars = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ';
const subscriptChars = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ';
const latexCommandPattern =
  /\\(?:times|cdots|ldots|frac|sqrt|sum|prod|int|left|right|alpha|beta|gamma|delta|theta|lambda|mu|sigma|pi|sin|cos|tan|log|ln|leq|geq|neq|approx|to|infty|cdot|pm|mp|mathbf|mathrm|text)/;
const mathOnlyLinePattern = /^[A-Za-z0-9\\{}_^()[\]+\-*/=<>|,.:;\s]+$/;

const superscriptMap: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  n: 'ⁿ', i: 'ⁱ',
};

const subscriptMap: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ',
  l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ',
  s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};

const superscriptToAsciiMap: Record<string, string> = Object.fromEntries(
  Object.entries(superscriptMap).map(([ascii, unicode]) => [unicode, ascii]),
) as Record<string, string>;

const subscriptToAsciiMap: Record<string, string> = Object.fromEntries(
  Object.entries(subscriptMap).map(([ascii, unicode]) => [unicode, ascii]),
) as Record<string, string>;

const replaceExponentNotation = (value: string): string =>
  value.replace(
    /([A-Za-z0-9)\]])\^([+-]?[0-9ni()=+-]+)/g,
    (fullMatch, base: string, exponent: string) => {
      const translated = exponent
        .split('')
        .map((c) => superscriptMap[c] ?? '')
        .join('');
      if (!translated || translated.length !== exponent.length) return fullMatch;
      return `${base}${translated}`;
    },
  );

const replaceSubscriptNotation = (value: string): string =>
  value.replace(
    /([A-Za-z0-9)\]])_([A-Za-z0-9()+-=]+)/g,
    (fullMatch, base: string, subscript: string) => {
      const translated = subscript
        .split('')
        .map((c) => subscriptMap[c] ?? '')
        .join('');
      if (!translated || translated.length !== subscript.length) return fullMatch;
      return `${base}${translated}`;
    },
  );

const normalizeUnicodeSuperscripts = (value: string): string => {
  const pattern = new RegExp(`([A-Za-z0-9)\\]])([${superscriptChars}]+)`, 'g');
  return value.replace(pattern, (fullMatch, base: string, group: string) => {
    const translated = group
      .split('')
      .map((c) => superscriptToAsciiMap[c] ?? '')
      .join('');
    if (!translated || translated.length !== group.length) return fullMatch;
    return `${base}^${translated.length > 1 ? `{${translated}}` : translated}`;
  });
};

const normalizeUnicodeSubscripts = (value: string): string => {
  const pattern = new RegExp(`([A-Za-z0-9)\\]])([${subscriptChars}]+)`, 'g');
  return value.replace(pattern, (fullMatch, base: string, group: string) => {
    const translated = group
      .split('')
      .map((c) => subscriptToAsciiMap[c] ?? '')
      .join('');
    if (!translated || translated.length !== group.length) return fullMatch;
    return `${base}_${translated.length > 1 ? `{${translated}}` : translated}`;
  });
};

const wrapMathLikeLines = (value: string): string =>
  value
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes('$')) return line;
      if (!latexCommandPattern.test(trimmed)) return line;
      if (!mathOnlyLinePattern.test(trimmed)) return line;
      const leading = line.match(/^\s*/)?.[0] ?? '';
      const trailing = line.match(/\s*$/)?.[0] ?? '';
      return `${leading}$${trimmed}$${trailing}`;
    })
    .join('\n');

const normalizeLatexDelimiters = (value: string): string =>
  value
    .replace(/\\\[((?:.|\n|\r)*?)\\\]/g, (_m, c: string) => `$$${c.trim()}$$`)
    .replace(/\\\(((?:.|\n|\r)*?)\\\)/g, (_m, c: string) => `$${c.trim()}$`);

const applyPlainTextMathFallback = (value: string): string =>
  value
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

const normalizeMathFriendlyText = (value: string): string =>
  value
    .split(/(```[\s\S]*?```)/g)
    .map((block) => {
      if (block.startsWith('```')) return block;
      return block
        .split(/(`[^`]*`)/g)
        .map((segment) => {
          if (segment.startsWith('`') && segment.endsWith('`')) return segment;
          return applyPlainTextMathFallback(
            wrapMathLikeLines(
              normalizeLatexDelimiters(
                normalizeUnicodeSubscripts(
                  normalizeUnicodeSuperscripts(segment),
                ),
              ),
            ),
          );
        })
        .join('');
    })
    .join('');

export const RichMessageContent = ({
  content,
  compact = false,
}: RichMessageContentProps) => (
  <div
    className={cn(
      'rich-message font-body leading-relaxed text-inherit',
      compact ? 'text-body-xs' : 'text-body-sm',
    )}
  >
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {children}
          </a>
        ),
        p: ({ children }) => (
          <p className="mb-2 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>
        ),
        code: ({ children, className }) => (
          <code
            className={cn(
              'rounded bg-surface-container-high px-1 py-0.5 font-mono text-[0.9em]',
              className,
            )}
          >
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="mb-2 overflow-x-auto rounded-md bg-surface-container-high p-3 font-mono text-body-xs last:mb-0">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-4 border-primary/40 pl-3 italic text-on-surface-variant last:mb-0">
            {children}
          </blockquote>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-on-surface">{children}</strong>
        ),
      }}
    >
      {normalizeMathFriendlyText(content)}
    </ReactMarkdown>
  </div>
);

/**
 * Design tokens extracted from stitch-references/study_bud_library (light)
 * and stitch-references/library_dark_mode (dark). Values here are the
 * single source of truth for Tailwind colors and the CSS variable layer
 * consumed by non-Tailwind surfaces (PDF viewer chrome, KaTeX, etc).
 *
 * Colors are stored as "R G B" triplets so tailwind.config.ts can emit
 * `rgb(var(--token) / <alpha-value>)` and support utilities like
 * `bg-surface/80` across both themes.
 */

export type ColorTokenName =
  | 'background'
  | 'on-background'
  | 'surface'
  | 'surface-dim'
  | 'surface-bright'
  | 'surface-variant'
  | 'surface-container-lowest'
  | 'surface-container-low'
  | 'surface-container'
  | 'surface-container-high'
  | 'surface-container-highest'
  | 'surface-tint'
  | 'on-surface'
  | 'on-surface-variant'
  | 'inverse-surface'
  | 'inverse-on-surface'
  | 'primary'
  | 'primary-dim'
  | 'primary-container'
  | 'primary-fixed'
  | 'primary-fixed-dim'
  | 'on-primary'
  | 'on-primary-container'
  | 'on-primary-fixed'
  | 'on-primary-fixed-variant'
  | 'inverse-primary'
  | 'secondary'
  | 'secondary-dim'
  | 'secondary-container'
  | 'secondary-fixed'
  | 'secondary-fixed-dim'
  | 'on-secondary'
  | 'on-secondary-container'
  | 'on-secondary-fixed'
  | 'on-secondary-fixed-variant'
  | 'tertiary'
  | 'tertiary-dim'
  | 'tertiary-container'
  | 'tertiary-fixed'
  | 'tertiary-fixed-dim'
  | 'on-tertiary'
  | 'on-tertiary-container'
  | 'on-tertiary-fixed'
  | 'on-tertiary-fixed-variant'
  | 'error'
  | 'error-dim'
  | 'error-container'
  | 'on-error'
  | 'on-error-container'
  | 'outline'
  | 'outline-variant'
  | 'lecture'
  | 'homework'
  | 'success'
  | 'warning';

export type ColorTriplet = `${number} ${number} ${number}`;

export type ColorPalette = Record<ColorTokenName, ColorTriplet>;

const hexToTriplet = (hex: string): ColorTriplet => {
  const raw = hex.replace('#', '');
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `${r} ${g} ${b}` as ColorTriplet;
};

const t = hexToTriplet;

export const lightPalette: ColorPalette = {
  background: t('#f9f9fc'),
  'on-background': t('#1a1c1e'),
  surface: t('#f9f9fc'),
  'surface-dim': t('#dadadc'),
  'surface-bright': t('#f9f9fc'),
  'surface-variant': t('#e2e2e5'),
  'surface-container-lowest': t('#ffffff'),
  'surface-container-low': t('#f3f3f6'),
  'surface-container': t('#eeeef0'),
  'surface-container-high': t('#e8e8ea'),
  'surface-container-highest': t('#e2e2e5'),
  'surface-tint': t('#2a3fff'),
  'on-surface': t('#1a1c1e'),
  'on-surface-variant': t('#444557'),
  'inverse-surface': t('#2f3133'),
  'inverse-on-surface': t('#f0f0f3'),
  primary: t('#0018c3'),
  'primary-dim': t('#0018c3'),
  'primary-container': t('#0b28ff'),
  'primary-fixed': t('#dfe0ff'),
  'primary-fixed-dim': t('#bdc2ff'),
  'on-primary': t('#ffffff'),
  'on-primary-container': t('#bfc4ff'),
  'on-primary-fixed': t('#000866'),
  'on-primary-fixed-variant': t('#001de0'),
  'inverse-primary': t('#bdc2ff'),
  secondary: t('#3d4eca'),
  'secondary-dim': t('#3d4eca'),
  'secondary-container': t('#5768e4'),
  'secondary-fixed': t('#dfe0ff'),
  'secondary-fixed-dim': t('#bcc2ff'),
  'on-secondary': t('#ffffff'),
  'on-secondary-container': t('#fffbff'),
  'on-secondary-fixed': t('#000c61'),
  'on-secondary-fixed-variant': t('#2336b4'),
  tertiary: t('#00480b'),
  'tertiary-dim': t('#00480b'),
  'tertiary-container': t('#006213'),
  'tertiary-fixed': t('#72ff72'),
  'tertiary-fixed-dim': t('#00e63c'),
  'on-tertiary': t('#ffffff'),
  'on-tertiary-container': t('#04e73d'),
  'on-tertiary-fixed': t('#002203'),
  'on-tertiary-fixed-variant': t('#00530f'),
  error: t('#ba1a1a'),
  'error-dim': t('#ba1a1a'),
  'error-container': t('#ffdad6'),
  'on-error': t('#ffffff'),
  'on-error-container': t('#93000a'),
  outline: t('#757689'),
  'outline-variant': t('#c5c5da'),
  lecture: t('#0ea5e9'),
  homework: t('#f59e0b'),
  success: t('#16a34a'),
  warning: t('#f59e0b'),
};

export const darkPalette: ColorPalette = {
  background: t('#060e20'),
  'on-background': t('#dee5ff'),
  surface: t('#060e20'),
  'surface-dim': t('#060e20'),
  'surface-bright': t('#1f2b49'),
  'surface-variant': t('#192540'),
  'surface-container-lowest': t('#091328'),
  'surface-container-low': t('#091328'),
  'surface-container': t('#0f1930'),
  'surface-container-high': t('#141f38'),
  'surface-container-highest': t('#192540'),
  'surface-tint': t('#9ea7ff'),
  'on-surface': t('#dee5ff'),
  'on-surface-variant': t('#a3aac4'),
  'inverse-surface': t('#faf8ff'),
  'inverse-on-surface': t('#4d556b'),
  primary: t('#9ea7ff'),
  'primary-dim': t('#5161ff'),
  'primary-container': t('#8d98ff'),
  'primary-fixed': t('#8d98ff'),
  'primary-fixed-dim': t('#7c89ff'),
  'on-primary': t('#00119b'),
  'on-primary-container': t('#000b7a'),
  'on-primary-fixed': t('#000000'),
  'on-primary-fixed-variant': t('#001095'),
  'inverse-primary': t('#0525fe'),
  secondary: t('#d5e3fc'),
  'secondary-dim': t('#c7d5ed'),
  'secondary-container': t('#3a485b'),
  'secondary-fixed': t('#d5e3fc'),
  'secondary-fixed-dim': t('#c7d5ed'),
  'on-secondary': t('#455367'),
  'on-secondary-container': t('#c3d1e9'),
  'on-secondary-fixed': t('#324053'),
  'on-secondary-fixed-variant': t('#4e5c71'),
  tertiary: t('#e0ecff'),
  'tertiary-dim': t('#c1d0e6'),
  'tertiary-container': t('#cfdef5'),
  'tertiary-fixed': t('#cfdef5'),
  'tertiary-fixed-dim': t('#c1d0e6'),
  'on-tertiary': t('#49586b'),
  'on-tertiary-container': t('#414f62'),
  'on-tertiary-fixed': t('#2e3d4e'),
  'on-tertiary-fixed-variant': t('#4a596c'),
  error: t('#ff6e84'),
  'error-dim': t('#d73357'),
  'error-container': t('#a70138'),
  'on-error': t('#490013'),
  'on-error-container': t('#ffb2b9'),
  outline: t('#6d758c'),
  'outline-variant': t('#40485d'),
  lecture: t('#7dd3fc'),
  homework: t('#fbbf24'),
  success: t('#86efac'),
  warning: t('#fde68a'),
};

export const tailwindColorVars: Record<ColorTokenName, string> = (
  Object.keys(lightPalette) as ColorTokenName[]
).reduce(
  (acc, key) => {
    acc[key] = `rgb(var(--sb-${key}) / <alpha-value>)`;
    return acc;
  },
  {} as Record<ColorTokenName, string>,
);

export const fontFamily = {
  display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  editorial: ['"Newsreader Variable"', '"Newsreader"', 'ui-serif', 'Georgia', 'serif'],
  mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
};

export const fontSize: Record<string, [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }]> = {
  'display-lg': ['3.25rem', { lineHeight: '1.04', letterSpacing: '-0.02em', fontWeight: '800' }],
  'display-md': ['2.5rem', { lineHeight: '1.08', letterSpacing: '-0.02em', fontWeight: '800' }],
  'display-sm': ['2rem', { lineHeight: '1.12', letterSpacing: '-0.015em', fontWeight: '700' }],
  'title-lg': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
  'title-md': ['1.25rem', { lineHeight: '1.25', fontWeight: '600' }],
  'title-sm': ['1.0625rem', { lineHeight: '1.3', fontWeight: '600' }],
  'body-lg': ['1rem', { lineHeight: '1.55' }],
  'body-md': ['0.9375rem', { lineHeight: '1.5' }],
  'body-sm': ['0.875rem', { lineHeight: '1.5' }],
  'label-md': ['0.8125rem', { lineHeight: '1.35', fontWeight: '500' }],
  'label-sm': ['0.75rem', { lineHeight: '1.35', fontWeight: '500', letterSpacing: '0.02em' }],
};

export const borderRadius = {
  card: '1.5rem',
  'card-sm': '1rem',
  button: '9999px',
  'button-md': '0.375rem',
};

export const boxShadow = {
  ambient: '0 4px 40px rgba(26,28,30,0.06)',
  'ambient-dark': '0 4px 40px rgba(0,0,0,0.08)',
  elevated: '0 18px 45px -15px rgba(0, 24, 195, 0.22)',
};

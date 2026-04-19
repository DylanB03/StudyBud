import type { Config } from 'tailwindcss';

import {
  borderRadius,
  boxShadow,
  fontFamily,
  fontSize,
  tailwindColorVars,
} from './src/ui/theme/tokens';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: tailwindColorVars,
      fontFamily,
      fontSize,
      borderRadius,
      boxShadow,
      backdropBlur: {
        glass: '20px',
      },
    },
  },
  plugins: [],
};

export default config;

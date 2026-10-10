import type { Config } from 'tailwindcss';

import { tokens } from './src/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nativewind = require('nativewind/preset');

const config: Config = {
  // Uygulama şimdilik sadece açık tema; 'class' modu Appearance.setColorScheme hatasını önler.
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [nativewind],
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.radius,
      spacing: tokens.spacing,
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
    },
  },
  plugins: [],
};

export default config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f8fa',
          100: '#eceff4',
          200: '#d8dde6',
          300: '#b3bccb',
          400: '#7d8a9f',
          500: '#566375',
          600: '#3c4757',
          700: '#2a3240',
          800: '#1c222d',
          900: '#11151c',
          950: '#0a0d12',
        },
        highlight: {
          yellow: 'rgba(252, 211, 77, 0.35)',
          green: 'rgba(74, 222, 128, 0.30)',
          blue: 'rgba(96, 165, 250, 0.30)',
          pink: 'rgba(244, 114, 182, 0.30)',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

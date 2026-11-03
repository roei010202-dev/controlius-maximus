/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Rubik', 'system-ui', 'Arial', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#0f1b2d', 700: '#1b2a41', 600: '#2a3b56' },
        signal: { DEFAULT: '#f2a900', soft: '#fff4d6' },
        brand: { DEFAULT: '#1d4ed8', dark: '#1e3a8a', soft: '#e8eefc' },
        danger: { DEFAULT: '#b42318', soft: '#fdecea' },
        ok: { DEFAULT: '#067647', soft: '#e6f4ec' },
        warn: { DEFAULT: '#93370d', soft: '#fef0e1' },
        muted: '#475467',
        line: '#d9dee6',
        canvas: '#f4f6f9',
      },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08)' },
    },
  },
  plugins: [],
}

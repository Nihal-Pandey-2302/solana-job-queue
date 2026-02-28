/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        background: '#0a0a0a',
        surface: '#171717',
        surfaceHover: '#262626',
        border: '#333333',
        textPrimary: '#ededed',
        textSecondary: '#a3a3a3',
        primary: '#3b82f6',
        primaryHover: '#2563eb',
        danger: '#ef4444',
      }
    },
  },
  plugins: [],
}

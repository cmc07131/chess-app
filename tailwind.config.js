/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'chess-bg': '#1a1a2e',
        'chess-panel': '#262421',
        'chess-light': '#eeeed2',
        'chess-dark': '#769656',
        'chess-accent': '#4caf50',
        'chess-text': '#ffffff',
        'chess-text-muted': '#b0b0b0',
      }
    },
  },
  plugins: [],
}
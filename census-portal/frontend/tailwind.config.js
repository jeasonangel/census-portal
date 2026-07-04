/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cam-green': '#006B3F',
        'cam-red': '#EF3340',
        'cam-yellow': '#FCD116',
        'cam-ink': '#101815',
        'cam-panel': '#1a2520',
        'cam-line': '#2a3a33',
        'cam-muted': '#8ba39a',
      },
    },
  },
  plugins: [],
}
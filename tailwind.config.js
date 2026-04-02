/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ca: {
          bg:           "#0a0a0a",
          surface:      "#111111",
          border:       "#2a2418",
          "amber-bg":   "#2a1f00",
          "amber-border": "#3a2e00",
          text:         "#f5f5f0",
          body:         "#c5b08a",
          muted:        "#6a5a3a",
        },
      },
    },
  },
  plugins: [],
}

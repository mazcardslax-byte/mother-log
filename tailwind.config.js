/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ag: {
          bg: "#000000",
          surface: "#1c1c1e",
          "surface-2": "#2c2c2e",
          border: "rgba(255,255,255,0.08)",
          accent: "#0a84ff",
          green: "#30d158",
          red: "#ff453a",
          orange: "#ff9f0a",
          yellow: "#ffd60a",
          text: "rgba(255,255,255,0.92)",
          body: "rgba(235,235,245,0.6)",
          muted: "rgba(235,235,245,0.3)",
        },
      },
    },
  },
  plugins: [],
};

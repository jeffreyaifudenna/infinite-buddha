/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        buddha: {
          dark: "#0a0b0e",
          card: "#13151c",
          gold: "#d4af37",
          goldLight: "#f3e5ab",
          muted: "#9ca3af",
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        serif: ["Cinzel", "serif"],
      },
    },
  },
  plugins: [],
}

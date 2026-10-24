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

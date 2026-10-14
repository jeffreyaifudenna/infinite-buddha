/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        buddha: {
          dark: '#0f1115',     // Deep charcoal background
          surface: '#181b22',  // Card / modal surface gray
          border: '#272b36',   // Subtle divider borders
          gold: '#d4af37',     // Soft gold primary accent
          amber: '#f59e0b',    // Warm amber secondary accent
          muted: '#9ca3af',    // Muted metadata text
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// base "./" makes built asset paths relative, so the site works at a domain root
// or under a subpath (e.g. GitHub Pages project sites).
export default defineConfig({
  base: "./",
  plugins: [react()],
})

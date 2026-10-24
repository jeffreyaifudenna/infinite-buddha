import fs from "node:fs"
import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const SITE_NAME = "The Infinite Buddha"
const SITE_DESCRIPTION =
  "A new AI-generated Buddha every day, rendered in stone, wood and soft natural light."

// Absolute site URL for link previews (og:image must be absolute). Set SITE_URL to
// override; on Vercel it falls back to the project's production domain.
const siteUrl = () => {
  const raw =
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  return raw ? raw.replace(/\/+$/, "") + "/" : null
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

const metaTags = ({ title, description, pagePath, imagePath, base }) => {
  const abs = (p) => (base ? new URL(String(p).replace(/^\/+/, ""), base).href : null)
  const tags = [
    ["property", "og:site_name", SITE_NAME],
    ["property", "og:type", "website"],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:url", abs(pagePath)],
    ["property", "og:image", imagePath && abs(imagePath)],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
    ["name", "twitter:image", imagePath && abs(imagePath)],
  ]
  return tags
    .filter(([, , value]) => value)
    .map(([attr, key, value]) => `    <meta ${attr}="${key}" content="${escapeHtml(value)}" />`)
    .join("\n")
}

// After the build, add link-preview tags to index.html and write one copy of it per
// piece ("<id>.html"), so a shared link previews that piece's image. The pages sit
// next to index.html, so the relative asset paths from base "./" keep working.
function sharePages() {
  let outDir
  return {
    name: "infinite-buddha-share-pages",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const indexPath = path.join(outDir, "index.html")
      const manifestPath = path.join(outDir, "data", "manifest.json")
      if (!fs.existsSync(indexPath) || !fs.existsSync(manifestPath)) return

      const html = fs.readFileSync(indexPath, "utf-8")
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
      const base = siteUrl()
      if (!base) console.warn("[share-pages] No SITE_URL set; link previews will have no image.")

      const withMeta = (page, { title, description, pagePath, imagePath }) =>
        page
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
          .replace(
            /<meta name="description"[^>]*>/,
            `<meta name="description" content="${escapeHtml(description)}" />`
          )
          .replace(/\s*<\/head>/, `\n${metaTags({ title, description, pagePath, imagePath, base })}\n  </head>`)

      const latest = Array.isArray(manifest) ? manifest[0] : null
      fs.writeFileSync(
        indexPath,
        withMeta(html, {
          title: `${SITE_NAME} | Generative Art Feed`,
          description: SITE_DESCRIPTION,
          pagePath: "",
          imagePath: latest?.imageUrl,
        })
      )

      let count = 0
      for (const art of Array.isArray(manifest) ? manifest : []) {
        if (!art?.id || !/^[\w-]+$/.test(art.id)) continue
        fs.writeFileSync(
          path.join(outDir, `${art.id}.html`),
          withMeta(html, {
            title: `${art.title} · ${SITE_NAME}`,
            description: SITE_DESCRIPTION,
            pagePath: art.id,
            imagePath: art.imageUrl,
          })
        )
        count++
      }
      console.log(`[share-pages] Wrote ${count} piece pages${base ? ` for ${base}` : ""}`)
    },
  }
}

// base "./" makes built asset paths relative, so the site works at a domain root
// or under a subpath (e.g. GitHub Pages project sites).
export default defineConfig({
  base: "./",
  plugins: [react(), sharePages()],
})

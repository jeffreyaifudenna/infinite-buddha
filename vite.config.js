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

// Shorten text for a meta description, cutting at a word boundary.
const shorten = (text, max = 160) => {
  const s = String(text || "").replace(/\s+/g, " ").trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`
}

// Pixel size of a JPEG, PNG or WebP file, read from its header; null if unknown.
const imageSize = (file) => {
  let b
  try {
    b = fs.readFileSync(file)
  } catch {
    return null
  }
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16)
    if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) }
    if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
    if (kind === "VP8L") {
      const bits = b.readUInt32LE(21)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    return null
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]
      const len = b.readUInt16BE(i + 2)
      // SOF0-SOF15 hold the frame size (C4 = DHT, C8 = JPG, CC = DAC are not frames).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) }
      }
      i += 2 + len
    }
  }
  return null
}

const metaTags = ({ title, description, pagePath, imagePath, imageAlt, imageDims, base }) => {
  const abs = (p) => (base ? new URL(String(p).replace(/^\/+/, ""), base).href : null)
  const image = imagePath && abs(imagePath)
  const tags = [
    ["property", "og:site_name", SITE_NAME],
    ["property", "og:type", "website"],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:url", abs(pagePath)],
    ["property", "og:image", image],
    ["property", "og:image:width", image && imageDims?.width],
    ["property", "og:image:height", image && imageDims?.height],
    ["property", "og:image:alt", image && imageAlt],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
    ["name", "twitter:image", image],
    ["name", "twitter:image:alt", image && imageAlt],
  ]
  const canonical = abs(pagePath)
  return [
    ...(canonical ? [`    <link rel="canonical" href="${escapeHtml(canonical)}" />`] : []),
    ...tags
      .filter(([, , value]) => value)
      .map(([attr, key, value]) => `    <meta ${attr}="${key}" content="${escapeHtml(value)}" />`),
  ].join("\n")
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

      // Preload the image the page opens on, so the browser starts fetching it with
      // the HTML instead of waiting for the JS and manifest to load first.
      const preloadTag = (art) => {
        const src = art && (art.displayUrl || art.imageUrl)
        return src
          ? `\n    <link rel="preload" as="image" href="./${escapeHtml(String(src).replace(/^\/+/, ""))}" fetchpriority="high" />`
          : ""
      }

      const dimsOf = (p) => (p ? imageSize(path.join(outDir, String(p).replace(/^\/+/, ""))) : null)
      const altOf = (art) => shorten(art?.prompt ? `${art.title}: ${art.prompt}` : art?.title, 200)

      const withMeta = (page, { title, description, pagePath, imagePath, imageAlt, preload }) =>
        // Function replacers, so "$&" or "$'" inside a prompt is inserted literally.
        page
          .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
          .replace(
            /<meta name="description"[^>]*>/,
            () => `<meta name="description" content="${escapeHtml(description)}" />`
          )
          .replace(
            /\s*<\/head>/,
            () => `${preloadTag(preload)}\n${metaTags({
              title,
              description,
              pagePath,
              imagePath,
              imageAlt,
              imageDims: dimsOf(imagePath),
              base,
            })}\n  </head>`
          )

      const latest = Array.isArray(manifest) ? manifest[0] : null
      fs.writeFileSync(
        indexPath,
        withMeta(html, {
          title: `${SITE_NAME} | Generative Art Feed`,
          description: SITE_DESCRIPTION,
          pagePath: "",
          imagePath: latest?.imageUrl,
          imageAlt: latest && altOf(latest),
          preload: latest,
        })
      )

      let count = 0
      for (const art of Array.isArray(manifest) ? manifest : []) {
        if (!art?.id || !/^[\w-]+$/.test(art.id)) continue
        fs.writeFileSync(
          path.join(outDir, `${art.id}.html`),
          withMeta(html, {
            title: `${art.title} · ${SITE_NAME}`,
            description: art.prompt ? shorten(art.prompt) : SITE_DESCRIPTION,
            pagePath: art.id,
            imagePath: art.imageUrl,
            imageAlt: altOf(art),
            preload: art,
          })
        )
        count++
      }
      console.log(`[share-pages] Wrote ${count} piece pages${base ? ` for ${base}` : ""}`)

      // Sitemap and robots.txt, so search engines can find every piece page.
      // A sitemap needs absolute URLs, so it is only written when the site URL is known.
      const pieces = (Array.isArray(manifest) ? manifest : []).filter((a) => a?.id && /^[\w-]+$/.test(a.id))
      if (base) {
        const urlTag = (loc, lastmod) =>
          `  <url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : ""}</url>`
        const sitemap = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          urlTag(base, latest?.date),
          ...pieces.map((a) => urlTag(new URL(a.id, base).href, a.date)),
          "</urlset>",
          "",
        ].join("\n")
        fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap)
      }
      fs.writeFileSync(
        path.join(outDir, "robots.txt"),
        `User-agent: *\nAllow: /\n${base ? `\nSitemap: ${new URL("sitemap.xml", base).href}\n` : ""}`
      )
    },
  }
}

// base "./" makes built asset paths relative, so the site works at a domain root
// or under a subpath (e.g. GitHub Pages project sites).
export default defineConfig({
  base: "./",
  plugins: [react(), sharePages()],
})

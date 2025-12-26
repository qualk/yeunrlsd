import { join } from "node:path"
import type { DataFile } from "./types"

// Load music data from JSON file
// Use local data for development, CDN data for production
const isProduction = Bun.env.NODE_ENV === "production" || Bun.env.BUN_ENV === "production"
const dataFile = isProduction ? "data-jsdelivr.json" : "data.json"
const dataPath = join(import.meta.dir, `../${dataFile}`)
const file = Bun.file(dataPath)
const musicData: DataFile = JSON.parse(await file.text())

const publicDir = join(import.meta.dir, "../public")
const CDN_URL = "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public"

// Warn in server console when Last.fm credentials are not configured
if (!Bun.env.LASTFM_API_KEY || !Bun.env.LASTFM_API_SECRET) {
  console.warn(
    "⚠️  Last.fm credentials are not configured. Last.fm features (scrobbling) will be disabled. Set LASTFM_API_KEY and LASTFM_API_SECRET to enable.",
  )
}

// MIME type map for static files
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".avif": "image/avif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
}

function getContentType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase()
  return MIME_TYPES[ext] || "application/octet-stream"
}

function normalizeRequestPath(rawPath: string): string {
  try {
    const decoded = decodeURIComponent(rawPath)
    const segments = decoded.split("/").filter((segment) => segment && segment !== "..")
    return segments.join("/") || "index.html"
  } catch {
    return "index.html"
  }
}

async function handleLastFmRequest(body: unknown): Promise<Response> {
  const apiKey = Bun.env.LASTFM_API_KEY
  const apiSecret = Bun.env.LASTFM_API_SECRET

  if (!apiKey || !apiSecret) {
    return new Response(JSON.stringify({ error: "Last.fm credentials not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const requestBody = body as Record<string, unknown>
    const params: Record<string, string> = { api_key: apiKey }

    for (const [key, value] of Object.entries(requestBody)) {
      params[key] = String(value)
    }

    // Generate MD5 signature
    const sortedKeys = Object.keys(params).sort()
    const signatureString = sortedKeys.map((k) => k + params[k]).join("") + apiSecret

    const hasher = new Bun.CryptoHasher("md5")
    hasher.update(signatureString)
    const signature = Array.from(hasher.digest())
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    const formData = new URLSearchParams({
      ...params,
      api_sig: signature,
      format: "json",
    })

    const response = await fetch("https://ws.audioscrobbler.com/2.0/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    })

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Last.fm proxy error:", error)
    return new Response(JSON.stringify({ error: "Last.fm request failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

async function handleStaticFile(filePath: string): Promise<Response> {
  const normalizedPath = normalizeRequestPath(filePath)
  const fullPath = join(publicDir, normalizedPath)

  try {
    const file = Bun.file(fullPath)
    if (await file.exists()) {
      return new Response(file, {
        headers: { "Content-Type": getContentType(fullPath) },
      })
    }

    // SPA routing: serve index.html for home and album pages
    if (filePath === "/" || filePath.startsWith("/album/")) {
      const indexFile = Bun.file(join(publicDir, "index.html"))
      return new Response(indexFile, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    // For other non-file paths, serve 404.html
    if (!filePath.includes(".")) {
      const notFoundFile = Bun.file(join(publicDir, "404.html"))
      if (await notFoundFile.exists()) {
        return new Response(notFoundFile, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
          status: 404,
        })
      } else {
        return new Response("Not found", { status: 404 })
      }
    }

    // 404 handling for actual file requests that don't exist
    return new Response("Not found", { status: 404 })
  } catch (error) {
    console.error("Error serving file:", error)
    return new Response("Not found", { status: 404 })
  }
}

const port = parseInt(Bun.env.PORT || "3000", 10)

const server = Bun.serve({
  port,
  async fetch(req: Request) {
    const url = new URL(req.url)
    const pathname = url.pathname

    // API Routes
    if (pathname === "/api/albums" && req.method === "GET") {
      return new Response(
        JSON.stringify({
          version: musicData.version || "1.0.0",
          albums: musicData.albums.map((album) => ({
            id: album.id,
            name: album.name,
            image: album.image,
            anim: album.anim,
            hasSongs: album.songs.length > 0,
            songCount: album.songs.length,
          })),
        }),
        { headers: { "Content-Type": "application/json" } },
      )
    }

    if (pathname.startsWith("/api/albums/") && req.method === "GET") {
      const albumId = pathname.split("/").pop()
      const album = musicData.albums.find((a) => a.id === albumId)
      if (!album) {
        return new Response(JSON.stringify({ error: "Album not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify(album), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (pathname === "/api/lastfm" && req.method === "POST") {
      const body = await req.json()
      return handleLastFmRequest(body)
    }

    if (pathname === "/api/lastfm-key" && req.method === "GET") {
      return new Response(JSON.stringify({ api_key: Bun.env.LASTFM_API_KEY || "" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // Static files and SPA routing
    // Redirect icon requests to jsDelivr in production to avoid origin delivery
    if (isProduction && pathname.startsWith("/icons/")) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${CDN_URL}${pathname}` },
      })
    }

    return handleStaticFile(pathname)
  },
})

console.log(`🎵 Server running on http://localhost:${server.port}`)

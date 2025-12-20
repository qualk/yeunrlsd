import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Elysia } from "elysia"

interface Song {
  title: string
  file: string
  credits: string | null
}

interface Album {
  id: string
  name: string
  image: string | null
  anim: string | null
  songs: Song[]
}

interface MusicData {
  albums: Album[]
}

// Load music data from JSON file
// Use local data for development, CDN data for production
const isProduction = process.env.NODE_ENV === "production" || process.env.BUN_ENV === "production"
const dataFile = isProduction ? "data-jsdelivr.json" : "data.json"
const dataPath = join(import.meta.dir, `../${dataFile}`)
const musicData: MusicData = JSON.parse(readFileSync(dataPath, "utf-8"))

const publicDir = join(import.meta.dir, "../public")

const app = new Elysia()

// API Routes
app.get("/api/albums", () => {
  return {
    albums: musicData.albums.map((album) => ({
      id: album.id,
      name: album.name,
      image: album.image,
      anim: album.anim,
      hasSongs: album.songs.length > 0,
    })),
  }
})

app.get("/api/albums/:id", ({ params }) => {
  const album = musicData.albums.find((a) => a.id === params.id)
  if (!album) {
    return { error: "Album not found" }
  }
  return album
})

// Serve static files
app.get("/*", async ({ params }) => {
  const relativePath = normalizeRequestPath(params["*"])
  const fullPath = join(publicDir, relativePath)

  try {
    const file = Bun.file(fullPath)
    const exists = await file.exists()

    if (!exists) {
      // Fall back to index.html for SPA routing
      const indexPath = join(publicDir, "index.html")
      return new Response(Bun.file(indexPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    // Determine content type
    const contentType = getContentType(fullPath)
    return new Response(file, {
      headers: { "Content-Type": contentType },
    })
  } catch (error) {
    console.error("Error serving file:", error)
    return new Response("Not found", { status: 404 })
  }
})

function normalizeRequestPath(rawPath?: string) {
  const decoded = tryDecodeURIComponent(rawPath ?? "")
  const segments = decoded.split("/").filter((segment) => segment && segment !== "..")
  return segments.join("/") || "index.html"
}

function tryDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch (_error) {
    return value
  }
}

function getContentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8"
  if (filePath.endsWith(".js")) return "application/javascript"
  if (filePath.endsWith(".json")) return "application/json"
  if (filePath.endsWith(".css")) return "text/css"
  if (filePath.endsWith(".avif")) return "image/avif"
  if (filePath.endsWith(".png")) return "image/png"
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg"
  if (filePath.endsWith(".gif")) return "image/gif"
  if (filePath.endsWith(".svg")) return "image/svg+xml"
  if (filePath.endsWith(".mp3")) return "audio/mpeg"
  if (filePath.endsWith(".woff2")) return "font/woff2"
  return "application/octet-stream"
}

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`🎵 Server running on http://localhost:${port}`)
})

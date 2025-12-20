#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const CDN_URL = "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public"

interface Song {
  title: string
  file: string
  credits?: string
}

interface Album {
  id: string
  name: string
  image: string | null
  anim: string | null
  songs?: Song[]
}

interface DataFile {
  albums: Album[]
}

function transformPath(path: string): string {
  if (!path) return path
  return `${CDN_URL}${path}`
}

function buildJsDelivrFile(): void {
  try {
    const dataPath = join(import.meta.dir, "..", "data.json")
    const data: DataFile = JSON.parse(readFileSync(dataPath, "utf-8"))

    const transformed: DataFile = {
      albums: data.albums.map((album) => ({
        id: album.id,
        name: album.name,
        image: album.image ? transformPath(album.image) : null,
        anim: album.anim ? transformPath(album.anim) : null,
        songs: album.songs
          ? album.songs.map((song) => ({
              title: song.title,
              file: transformPath(song.file),
              credits: song.credits,
            }))
          : undefined,
      })),
    }

    const outputPath = join(import.meta.dir, "..", "data-jsdelivr.json")
    writeFileSync(outputPath, `${JSON.stringify(transformed, null, 2)}\n`)

    console.log("✓ Built data-jsdelivr.json successfully")
  } catch (error) {
    console.error("✗ Failed to build data-jsdelivr.json:", error)
    process.exit(1)
  }
}

buildJsDelivrFile()

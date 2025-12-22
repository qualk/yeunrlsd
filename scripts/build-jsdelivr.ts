#!/usr/bin/env bun
import { join } from "node:path"

const CDN_URL = "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public"

interface Song {
  title: string
  file: string
  credits?: string
  artist?: string
}

interface Album {
  id: string
  name: string
  image: string | null
  anim: string | null
  songs?: Song[]
}

interface DataFile {
  version?: string
  albums: Album[]
}

function transformPath(path: string): string {
  if (!path) return path
  return `${CDN_URL}${path}`
}

async function buildJsDelivrFile(): Promise<void> {
  try {
    const dataPath = join(import.meta.dir, "..", "data.json")
    const data: DataFile = JSON.parse(await Bun.file(dataPath).text())

    const transformed: DataFile = {
      version: data.version,
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
              artist: song.artist,
            }))
          : undefined,
      })),
    }

    const outputPath = join(import.meta.dir, "..", "data-jsdelivr.json")
    await Bun.write(outputPath, `${JSON.stringify(transformed, null, 2)}\n`)

    console.log("✓ Built data-jsdelivr.json successfully")
  } catch (error) {
    console.error("✗ Failed to build data-jsdelivr.json:", error)
    process.exit(1)
  }
}

buildJsDelivrFile()

#!/usr/bin/env bun
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { type IAudioMetadata, parseFile } from "music-metadata"
import type { Album, DataFile, Song, SongMeta } from "../src/types"

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

function sortAndMapSongs(songMetas: SongMeta[]): Song[] {
  songMetas.sort((a, b) => {
    if (a.track != null && b.track != null) return a.track - b.track
    if (a.track != null) return -1
    if (b.track != null) return 1
    return a.file.localeCompare(b.file, undefined, { numeric: true })
  })
  return songMetas.map((s) => ({
    title: s.title,
    file: s.file,
    artist: s.artist,
    year: s.year ?? null,
  }))
}

async function getFirstSongMetadata(
  songMetas: SongMeta[],
  files: string[],
  albumDir: string
): Promise<IAudioMetadata | null> {
  if (songMetas.length === 0) return null
  const firstFile = files[0]
  if (!firstFile) return null
  return (await parseFile(join(albumDir, firstFile)).catch(() => null)) as IAudioMetadata | null
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

function inferAttributeFromGenre(meta: IAudioMetadata | null): string | null {
  if (!meta?.common?.genre) return null
  const g = meta.common.genre
  const genres = Array.isArray(g) ? g : typeof g === "string" ? [g] : []
  const first = genres[0]
  return first && /gospel/i.test(String(first)) ? "Gospel" : null
}

function extractYearFromMetadata(
  meta: IAudioMetadata | null,
  fallbackYear?: number | null
): number | undefined {
  if (fallbackYear != null) return fallbackYear
  const commonYear = meta?.common?.year as unknown
  if (commonYear != null) {
    if (typeof commonYear === "number") return commonYear
    if (typeof commonYear === "string") {
      const m = String(commonYear).match(/\d{4}/)
      return m ? parseInt(m[0], 10) : undefined
    }
    if (Array.isArray(commonYear) && commonYear.length) {
      const first = commonYear[0] as unknown
      if (typeof first === "number") return first as number
      if (typeof first === "string") {
        const m = String(first).match(/\d{4}/)
        return m ? parseInt(m[0], 10) : undefined
      }
    }
  }
  return undefined
}

async function processSongFile(
  file: string,
  fullPath: string,
  albumId: string,
  albumSongs?: Song[]
): Promise<{
  title: string
  file: string
  artist?: string
  track?: number
  year?: number
} | null> {
  try {
    const st = statSync(fullPath)
    if (st.size > MAX_FILE_SIZE_BYTES) {
      console.error(`✗ Audio file too large: ${fullPath}`)
      return null
    }
    const meta = (await parseFile(fullPath).catch(() => null)) as IAudioMetadata | null
    const title = (meta?.common?.title as string) ?? file.replace(/\.[^.]+$/, "")
    const artist = (meta?.common?.artist as string) ?? undefined
    const track = meta?.common?.track?.no as number | undefined
    const year = extractYearFromMetadata(
      meta,
      albumSongs?.find((s) => s.file?.endsWith(`/${file}`))?.year
    )
    return { title, file: `/music/${albumId}/${file}`, artist, track, year }
  } catch (err) {
    console.error(`✗ Failed to parse ${fullPath}:`, err)
    return null
  }
}

async function updateDataFromMetadata(): Promise<void> {
  try {
    const dataPath = join(process.cwd(), "data.json")
    const raw = await Bun.file(dataPath).text()
    const data: DataFile = JSON.parse(raw)

    const updatedAlbums: Album[] = []

    for (const album of data.albums) {
      const albumDir = join(process.cwd(), "public", "music", album.id)
      let songs: Song[] | undefined
      let attribute: string | null = album.attribute ?? null

      if (existsSync(albumDir)) {
        const files = readdirSync(albumDir).filter((f) => /\.(mp3|m4a|wav|flac|aac|ogg)$/i.test(f))

        const songPromises = files.map((file) =>
          processSongFile(file, join(albumDir, file), album.id, album.songs)
        )
        const songResults = await Promise.all(songPromises)
        const songMetas: SongMeta[] = songResults.filter((s): s is SongMeta => s != null)

        // Infer attribute from first song's metadata if not already set
        const firstMeta = await getFirstSongMetadata(songMetas, files, albumDir)
        if (!attribute && firstMeta) {
          attribute = inferAttributeFromGenre(firstMeta)
        }

        songs = sortAndMapSongs(songMetas)
      } else {
        // keep existing songs if directory missing
        songs = album.songs
      }

      updatedAlbums.push({
        id: album.id,
        name: album.name,
        image: album.image ?? null,
        anim: album.anim ?? null,
        year: album.year ?? undefined,
        attribute: attribute ?? null,
        songs: songs || [],
      })
    }

    // Get existing album IDs
    const existingIds = new Set(data.albums.map((a) => a.id))

    // Scan for new albums
    const musicDir = join(process.cwd(), "public", "music")
    if (existsSync(musicDir)) {
      const dirs = readdirSync(musicDir).filter(
        (d) => statSync(join(musicDir, d)).isDirectory() && !existingIds.has(d)
      )
      for (const dir of dirs) {
        const answer = await prompt(`Add new album "${dir}"? (y/n): `)
        if (answer === "y" || answer === "yes") {
          const newAlbum = await createAlbumFromDir(dir, musicDir)
          if (newAlbum) updatedAlbums.push(newAlbum)
        }
      }
    }

    // Sort albums by year (ascending, nulls last)
    updatedAlbums.sort((a, b) => {
      if (a.year == null && b.year == null) return 0
      if (a.year == null) return 1
      if (b.year == null) return -1
      return a.year - b.year
    })

    const updated: DataFile = {
      version: data.version,
      albums: updatedAlbums,
    }

    writeFileSync(dataPath, `${JSON.stringify(updated, null, 2)}\n`)
    console.log("✓ Updated data.json from metadata successfully")
  } catch (error) {
    console.error("✗ Failed to update data.json:", error)
    process.exit(1)
  }
}

async function createAlbumFromDir(dir: string, musicDir: string): Promise<Album | null> {
  const albumDir = join(musicDir, dir)
  const files = readdirSync(albumDir).filter((f) => /\.(mp3|m4a|wav|flac|aac|ogg)$/i.test(f))
  if (files.length === 0) return null

  let albumName: string = dir // fallback
  let attribute: string | null = null
  let year: number | undefined

  const songPromises = files.map((file) => processSongFile(file, join(albumDir, file), dir))
  const songResults = await Promise.all(songPromises)
  const songMetas: SongMeta[] = songResults.filter((s): s is SongMeta => s != null)

  // Get album name and attribute from first song's metadata
  const firstMeta = await getFirstSongMetadata(songMetas, files, albumDir)
  if (firstMeta) {
    if (firstMeta.common?.album) albumName = firstMeta.common.album as string
    attribute = inferAttributeFromGenre(firstMeta)
    year = extractYearFromMetadata(firstMeta)
  }

  const songs = sortAndMapSongs(songMetas)

  // Check for images
  const imgDir = join(process.cwd(), "public", "img")
  const animDir = join(process.cwd(), "public", "anim")
  const image = existsSync(join(imgDir, `${dir}.avif`)) ? `/img/${dir}.avif` : null
  const anim = existsSync(join(animDir, `${dir}.avif`)) ? `/anim/${dir}.avif` : null

  return {
    id: dir,
    name: albumName,
    image,
    anim,
    year,
    attribute,
    songs: songs,
  }
}

updateDataFromMetadata()

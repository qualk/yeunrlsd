#!/usr/bin/env bun
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { type IAudioMetadata, parseFile } from "music-metadata"

interface Song {
  title: string
  file: string
  artist?: string
  year?: number
}

interface Album {
  id: string
  name: string
  image: string | null
  anim: string | null
  year?: number
  attribute?: string | null
  songs?: Song[]
}

interface DataFile {
  version?: string
  albums: Album[]
}

async function updateDataFromMetadata(): Promise<void> {
  try {
    const dataPath = join(import.meta.dir, "..", "data.json")
    const raw = await Bun.file(dataPath).text()
    const data: DataFile = JSON.parse(raw)

    const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

    const updatedAlbums: Album[] = []

    for (const album of data.albums) {
      const albumDir = join(import.meta.dir, "..", "public", "music", album.id)
      let songs: Song[] | undefined
      // preserve existing attribute if present; otherwise infer from metadata
      let attribute: string | null = album.attribute ?? null

      if (existsSync(albumDir)) {
        const files = readdirSync(albumDir).filter((f) => /\.(mp3|m4a|wav|flac|aac|ogg)$/i.test(f))

        const songMetas: Array<{
          file: string
          title: string
          artist?: string
          track?: number
          size: number
          year?: number
        }> = []

        for (const file of files) {
          const full = join(albumDir, file)
          try {
            const st = statSync(full)
            if (st.size > MAX_FILE_SIZE_BYTES) {
              console.error(
                `✗ Failed to update: audio file too large: /music/${album.id}/${file} (${(st.size / (1024 * 1024)).toFixed(2)} MB). Maximum allowed is 20 MB.`
              )
              process.exit(1)
            }
            const meta = (await parseFile(full).catch(() => null)) as IAudioMetadata | null
            const title = (meta?.common?.title as string) ?? file.replace(/\.[^.]+$/, "")
            const artist = (meta?.common?.artist as string) ?? undefined
            const track = meta?.common?.track?.no as number | undefined
            // infer attribute from genre if missing
            if (!attribute) {
              const g = meta?.common?.genre
              if (Array.isArray(g) && g.length > 0) attribute = String(g[0])
            }

            // determine year: prefer metadata, fall back to existing song.year if present
            let year: number | undefined
            const commonYear = meta?.common?.year as unknown
            if (commonYear != null) {
              if (typeof commonYear === "number") year = commonYear
              else if (typeof commonYear === "string") {
                const str = commonYear as string
                const m = str.match(/\d{4}/)
                if (m) year = parseInt(m[0], 10)
              } else if (Array.isArray(commonYear) && commonYear.length) {
                const first = commonYear[0] as unknown
                if (typeof first === "number") year = first as number
                else if (typeof first === "string") {
                  const m = String(first).match(/\d{4}/)
                  if (m) year = parseInt(m[0], 10)
                }
              }
            }
            if (year == null && album.songs) {
              const orig = album.songs.find((s) => s.file?.endsWith(`/${file}`))
              if (orig?.year) year = orig.year
            }

            songMetas.push({
              file: `/music/${album.id}/${file}`,
              title,
              artist,
              track,
              size: st.size,
              year,
            })
          } catch (err) {
            console.error(`✗ Failed to stat/parse ${full}:`, err)
            process.exit(1)
          }
        }

        // sort by track number if available, else by filename
        songMetas.sort((a, b) => {
          if (a.track != null && b.track != null) return a.track - b.track
          if (a.track != null) return -1
          if (b.track != null) return 1
          return a.file.localeCompare(b.file, undefined, { numeric: true })
        })

        songs = songMetas.map((s) => ({
          title: s.title,
          file: s.file,
          artist: s.artist,
          year: s.year,
        }))
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
        songs: songs?.length ? songs : undefined,
      })
    }

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

updateDataFromMetadata()

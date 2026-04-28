#!/usr/bin/env bun
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import type { DataFile } from "../src/types"

const CDN_URL = "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public"

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
        year: album.year ?? undefined,
        attribute: album.attribute ?? null,
        songs: album.songs.map((song) => ({
          title: song.title,
          file: transformPath(song.file),
          artist: song.artist,
          year: song.year ?? undefined,
        })),
      })),
    }

    // Include icons from public/icons as CDN URLs
    try {
      const iconsDir = join(import.meta.dir, "..", "public", "icons")
      if (existsSync(iconsDir)) {
        const iconFiles = execSync(`ls ${iconsDir}`, { encoding: "utf8" })
          .split(/\r?\n/)
          .filter(Boolean)
        const icons: Record<string, string> = {}
        for (const f of iconFiles) {
          icons[`/icons/${f}`] = transformPath(`/icons/${f}`)
        }
        ;(transformed as DataFile).icons = icons
      }
    } catch (_err) {
      // best effort: if we can't read icons, skip adding them
    }

    const outputPath = join(import.meta.dir, "..", "data-jsdelivr.json")
    await Bun.write(outputPath, `${JSON.stringify(transformed, null, 2)}\n`)

    console.log("✓ Built data-jsdelivr.json successfully")

    // Output jsDelivr URLs for modified files (unstaged, staged, unpushed)
    const getDiff = (args: string): string[] => {
      try {
        return execSync(`git ${args}`, { encoding: "utf8" }).split(/\r?\n/).filter(Boolean)
      } catch {
        return []
      }
    }

    try {
      const modifiedRaw = getDiff("diff --name-only")
      const stagedRaw = getDiff("diff --cached --name-only --diff-filter=M")

      let unpushedRaw: string[] = []
      try {
        const upstream = execSync("git rev-parse --abbrev-ref --symbolic-full-name @{u}", {
          encoding: "utf8",
        }).trim()
        unpushedRaw = getDiff(`diff --name-only --diff-filter=M ${upstream}..HEAD`)
      } catch (_e) {
        try {
          const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim()
          const originRef = `origin/${branch}`
          execSync(`git rev-parse --verify ${originRef}`, { stdio: "ignore" })
          unpushedRaw = getDiff(`diff --name-only --diff-filter=M ${originRef}..HEAD`)
        } catch (_) {}
      }

      const allSet = new Set([...modifiedRaw, ...stagedRaw, ...unpushedRaw])
      const all = Array.from(allSet)
      const publicModified = all
        .filter(
          (p) =>
            p.startsWith("public/img/") ||
            p.startsWith("public/anim/") ||
            p.startsWith("public/music/") ||
            p.startsWith("public/icons/"),
        )
        .sort()

      if (publicModified.length === 0) {
        console.log("No modified files under public/img, public/anim or public/music")
      } else {
        console.log("Modified files under public/img, public/anim, public/music (jsDelivr URLs):")
        let count = 0
        for (const p of publicModified) {
          const rel = p.replace(/^public/, "")
          const fullLocal = join(import.meta.dir, "..", p)
          if (!existsSync(fullLocal)) continue
          console.log(transformPath(rel))
          count++
          if (count % 10 === 0) console.log("")
        }
        if (count % 10 !== 0) console.log("")
      }
    } catch (err) {
      console.error("✗ Failed to determine git modified files:", err)
    }
  } catch (error) {
    console.error("✗ Failed to build data-jsdelivr.json:", error)
    process.exit(1)
  }
}

buildJsDelivrFile()

export interface Song {
  title: string
  file: string
  artist?: string | null
  year?: number | null
}

export interface SongMeta {
  title: string
  file: string
  artist?: string
  track?: number
  year?: number
}

export interface Album {
  id: string
  name: string
  image: string | null
  anim: string | null
  year?: number
  attribute?: string | null
  songs: Song[]
}

export interface DataFile {
  version?: string
  albums: Album[]
  icons?: Record<string, string>
}

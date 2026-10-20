const f = (...v) => v.find(x => x != null && x !== '')
const url = x => (typeof x === 'string' ? x : x?.url || x?.src || '')
const img = x => {
  if (Array.isArray(x)) {
    const o = x.filter(v => v && typeof v === 'object').sort((a, b) => (b.width || b.height || 0) - (a.width || a.height || 0))[0]
    return url(o) || url(x[0])
  }
  return url(x)
}
const str = x => (typeof x === 'string' ? x : '')
export const norm = (t, type = 'track') => {
  const ar = Array.isArray(t.artists) ? t.artists.map(a => a?.name || a).join(', ') : str(f(t.artist?.name, t.artist, t.artists?.name, t.owner, ''))
  const title = str(f(t.name, t.title, 'Untitled'))
  const d = +f(t.duration_ms, t.durationMs, t.duration, 0) || 0
  return {
    id: String(f(t.id, t.spotify_id, t.uri, t.url, title + ar)), type, title, artist: ar,
    album: str(f(t.album?.name, t.album, '')),
    cover: str(f(img(t.cover), img(t.image), img(t.images), img(t.thumbnail), img(t.album?.images), img(t.album?.cover), img(t.img), img(t.cover_url), img(t.coverUrl), img(t.image_url), img(t.imageUrl), img(t.artwork), img(t.picture), img(t.poster), img(t.thumb), img(t.album?.image), img(t.album?.cover_url), '')),
    duration: d && d < 10000 ? d * 1000 : d,
    audio: f(t.preview_url, t.previewUrl, t.audio, t.audio_url, t.stream, t.mp3, null)
  }
}

import axios from 'axios'
import { uid } from '../../../lib/auth'
import { LIVE } from '../../../lib/norm'
export const runtime = 'nodejs'
export const maxDuration = 60
const BASE = 'https://spotsaver.net'
const H = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', Referer: BASE + '/', Origin: BASE }
const cache = new Map()
const TTL = 15 * 60 * 1000
const n = s => String(s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]|- *(remaster(ed)?|live|mono|stereo).*$/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const nonLive = (list, get, wanted) => { if (LIVE.test(wanted)) return list; const f = list.filter(x => !LIVE.test(get(x))); return f.length ? f : list }

async function spotsaver(title, artist) {
  const q = await axios.get(`${BASE}/api/spotify/?q=${encodeURIComponent(title + ' ' + artist)}`, { headers: H, timeout: 30000 })
  const items = nonLive(q.data?.items || [], x => `${x.title || ''} ${x.album || ''}`, title)
  const t = n(title), a = n(artist).split(' ')[0]
  const it = items.find(x => n(x.title) === t && n(x.artist).includes(a)) || items.find(x => n(x.title) === t) || items[0]
  if (!it) return null
  let videoId = it.videoId, cands = []
  if (!videoId) {
    const g = (await axios.post(`${BASE}/api/get-id/`, { title: it.title || title, artist: it.artist || artist }, { headers: H, timeout: 30000 })).data
    if (g?.success) { videoId = g.videoId; cands = g.candidateIds || [] }
  }
  if (!videoId) return null
  const d = (await axios.post(`${BASE}/api/download/`, { videoId, candidateIds: cands, format: 'mp3', title: it.title || title }, { headers: H, timeout: 60000 })).data
  return d?.downloadUrl || d?.url || d?.fileUrl || d?.mediaUrl || null
}

async function itunes(title, artist) {
  const r = await fetch('https://itunes.apple.com/search?' + new URLSearchParams({ term: title + ' ' + artist, media: 'music', entity: 'song', limit: '10' }), { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const list = nonLive((await r.json()).results || [], x => `${x.trackName || ''} ${x.collectionName || ''}`, title)
  const t = n(title), a = n(artist).split(' ')[0]
  const b = list.find(x => n(x.trackName) === t && n(x.artistName).includes(a)) || list.find(x => n(x.trackName).includes(t) && n(x.artistName).includes(a)) || list.find(x => n(x.trackName) === t) || list[0]
  return b?.previewUrl || null
}

export async function GET(req) {
  if (!(await uid())) return Response.json({ url: null }, { status: 401 })
  const s = new URL(req.url).searchParams, title = s.get('title') || '', artist = s.get('artist') || ''
  const k = n(title) + '|' + n(artist), hit = cache.get(k), fresh = s.get('fresh')
  if (hit && !fresh && Date.now() - hit.t < TTL) return Response.json(hit.v)
  let out = { url: null, full: false }
  try { const u = await spotsaver(title, artist); if (u) out = { url: u, full: true } } catch {}
  if (!out.url) { try { const u = await itunes(title, artist); if (u) out = { url: u, full: false } } catch {} }
  if (out.url) cache.set(k, { t: Date.now(), v: out })
  return Response.json(out)
}

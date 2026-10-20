import axios from 'axios'
import { uid } from '../../../lib/auth'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const cache = new Map()
const TTL = 6 * 3600 * 1000
const BASE = 'https://translate.googleapis.com/translate_a'
const H = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36' }
const LANG = /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/
async function batch(lines, to) {
  const body = new URLSearchParams()
  lines.forEach(l => body.append('q', l))
  const r = await axios.post(`${BASE}/t?client=gtx&sl=auto&tl=${to}&dt=t`, body.toString(), { timeout: 15000, headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded' } })
  const d = r.data
  if (!Array.isArray(d) || d.length !== lines.length) throw new Error('mismatch')
  return d.map(x => (Array.isArray(x) ? x[0] : x))
}
async function single(line, to) {
  const r = await axios.get(`${BASE}/single`, { params: { client: 'gtx', sl: 'auto', tl: to, dt: 't', q: line }, timeout: 10000, headers: H })
  return Array.isArray(r.data?.[0]) ? r.data[0].map(s => s?.[0] || '').join('') : ''
}
async function each(lines, to) {
  const out = new Array(lines.length).fill('')
  let i = 0
  const worker = async () => {
    while (i < lines.length) {
      const k = i++
      try { out[k] = await single(lines[k], to) } catch {}
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return out
}
export async function POST(req) {
  if (!(await uid())) return Response.json({}, { status: 401 })
  let b
  try { b = await req.json() } catch { return Response.json({}, { status: 400 }) }
  const to = String(b.to || '')
  const src = (Array.isArray(b.lines) ? b.lines : []).slice(0, 250).map(x => String(x || '').slice(0, 300))
  if (!LANG.test(to) || !src.length) return Response.json({}, { status: 400 })
  const key = to + '|' + src.join('\n')
  const hit = cache.get(key)
  if (hit && Date.now() - hit.t < TTL) return Response.json({ lines: hit.v })
  const idx = src.map((x, k) => (x.trim() ? k : -1)).filter(k => k >= 0)
  const texts = idx.map(k => src[k])
  let res
  try { res = await batch(texts, to) } catch { res = await each(texts, to) }
  const out = src.map(() => '')
  idx.forEach((k, n) => { out[k] = String(res[n] || '') })
  if (out.some(Boolean)) {
    cache.set(key, { t: Date.now(), v: out })
    if (cache.size > 200) cache.delete(cache.keys().next().value)
  }
  return Response.json({ lines: out })
}

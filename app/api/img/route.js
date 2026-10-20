import axios from 'axios'
import { uid } from '../../../lib/auth'
export const runtime = 'nodejs'
const bad = h => /^(localhost|.*\.local|.*\.internal)$/i.test(h) || /^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')
const fix = s => { s = String(s || '').trim(); return s.startsWith('//') ? 'https:' + s : s.replace(/^http:\/\//i, 'https://') }
const H = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36', Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' }
async function grab(href, n = 0) {
  const url = new URL(href)
  if (url.protocol !== 'https:' || bad(url.hostname)) throw new Error('blocked')
  const r = await axios.get(url.href, { responseType: 'arraybuffer', timeout: 8000, maxContentLength: 5e6, maxRedirects: 0, validateStatus: c => c < 400, headers: H })
  if (r.status >= 300 && r.headers.location && n < 3) return grab(new URL(r.headers.location, url).href, n + 1)
  return r
}
export async function GET(req) {
  if (!(await uid())) return new Response(null, { status: 401 })
  let href
  try { href = new URL(fix(new URL(req.url).searchParams.get('u'))).href } catch { return new Response(null, { status: 400 }) }
  try {
    const r = await grab(href)
    const ct = String(r.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (!ct.startsWith('image/') || ct.includes('svg')) return new Response(null, { status: 415 })
    return new Response(r.data, { headers: { 'Content-Type': ct, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } })
  } catch { return new Response(null, { status: 502 }) }
}

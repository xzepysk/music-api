import m from '../../../lib/mscrape'
import { norm } from '../../../lib/norm'
import { uid } from '../../../lib/auth'
export const runtime = 'nodejs'
const cache = new Map()
export async function GET(req) {
  if (!(await uid())) return Response.json({ results: [] }, { status: 401 })
  const s = new URL(req.url).searchParams, q = s.get('q') || '', type = s.get('type') || 'track'
  const k = type + q.toLowerCase(), hit = cache.get(k)
  if (hit && Date.now() - hit.t < 6e5) return Response.json({ results: hit.r })
  try {
    const r = (await m.searchSpotify(q, type)).map(x => norm(x, type))
    cache.set(k, { t: Date.now(), r })
    return Response.json({ results: r })
  } catch (e) { return Response.json({ results: [], error: e.message }, { status: 500 }) }
}

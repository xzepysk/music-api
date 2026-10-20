import m from '../../../lib/mscrape'
import { uid } from '../../../lib/auth'
export const runtime = 'nodejs'
export async function GET(req) {
  if (!(await uid())) return Response.json({}, { status: 401 })
  try {
    const r = await m.searchLyrics(new URL(req.url).searchParams.get('q'))
    const b = r.find(x => x.syncedLyrics) || r[0]
    return Response.json({ synced: b?.syncedLyrics || null, plain: b?.plainLyrics || null })
  } catch { return Response.json({ synced: null, plain: null }) }
}

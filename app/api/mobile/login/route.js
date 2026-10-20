import { encode } from 'next-auth/jwt'
export const runtime = 'nodejs'
export async function POST(req) {
  const { idToken } = await req.json().catch(() => ({}))
  if (!idToken) return Response.json({ error: 'missing token' }, { status: 400 })
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken))
  const g = await r.json()
  if (!r.ok || g.aud !== process.env.GOOGLE_CLIENT_ID || g.email_verified !== 'true') return Response.json({ error: 'invalid token' }, { status: 401 })
  const token = await encode({ token: { sub: g.sub, name: g.name, email: g.email, picture: g.picture }, secret: process.env.NEXTAUTH_SECRET, maxAge: 30 * 86400 })
  return Response.json({ token, user: { name: g.name, email: g.email, picture: g.picture } })
}

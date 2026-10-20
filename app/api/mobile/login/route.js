import { encode } from 'next-auth/jwt'
export const runtime = 'nodejs'
export async function POST() {
  const token = await encode({ token: { sub: 'guest-' + crypto.randomUUID(), name: 'Guest' }, secret: process.env.NEXTAUTH_SECRET, maxAge: 360 * 86400 })
  return Response.json({ token })
}

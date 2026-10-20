import { getServerSession } from 'next-auth'
import Google from 'next-auth/providers/google'
export const authOptions = {
  providers: [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })],
  session: { strategy: 'jwt' },
  callbacks: { session({ session, token }) { session.user.id = token.sub; return session } }
}
export const me = async () => {
  const u = (await getServerSession(authOptions))?.user
  return u?.id ? u : null
}
export const uid = async () => (await me())?.id

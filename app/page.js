import { getServerSession } from 'next-auth'
import { authOptions } from '../lib/auth'
import App, { Login } from '../components/App'
export const dynamic = 'force-dynamic'
export default async function Page() {
  const s = await getServerSession(authOptions)
  return s?.user ? <App user={s.user} /> : <Login />
}

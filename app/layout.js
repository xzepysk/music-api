import { Outfit } from 'next/font/google'
import './globals.css'
const f = Outfit({ subsets: ['latin'], variable: '--f' })
export const metadata = { title: 'Sync-musiC', description: 'Music without ads' }
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#050816' }
export default function L({ children }) { return <html lang="en" className={f.variable}><body>{children}</body></html> }

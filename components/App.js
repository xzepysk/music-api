'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { signIn, signOut } from 'next-auth/react'

const J = (u, o) => fetch(u, o).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok && !j.error) j.error = 'HTTP ' + r.status; return j })
const fmt = s => (isFinite(s) && s > 0 ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00')
const SHELVES = ['Top hits', 'Pop hits', 'Chill vibes', 'Workout']
const TYPES = [['track', 'Songs'], ['album', 'Albums'], ['artist', 'Artists']]
const st = fn => e => { e.stopPropagation(); fn(e) }
const LANGS = [['', 'Off'], ['id', 'Indonesian'], ['en', 'English'], ['ms', 'Malay'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh-CN', 'Chinese'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['th', 'Thai'], ['vi', 'Vietnamese'], ['tr', 'Turkish'], ['ru', 'Russian']]
const parseLyr = l => {
  const synced = (l?.synced || '').split('\n').map(x => { const m = x.match(/^\[(\d+):(\d+\.?\d*)\](.*)/); return m && { t: +m[1] * 60 + +m[2], x: m[3].trim() } }).filter(Boolean)
  const plain = synced.length ? [] : String(l?.plain || '').split('\n').map(x => x.trim()).filter((x, k, a) => x || (k > 0 && a[k - 1]))
  return { synced, plain }
}
const EMO = { heart: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2764.svg', note: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3b5.svg' }
const Em = ({ n }) => <img className="em" src={EMO[n]} alt="" draggable="false" />
const px = u => (u ? '/api/img?u=' + encodeURIComponent(u) : '')
const IC = {
  play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zM14 5h4v14h-4z', prev: 'M6 5h2v14H6zM20 5v14L9 12z', next: 'M16 5h2v14h-2zM4 5v14l11-7z',
  down: 'M6 9l6 6 6-6', share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13', dl: 'M12 3v12M7 10l5 5 5-5M5 21h14', shuffle: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  repeat: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3', plus: 'M12 5v14M5 12h14', check: 'M5 13l4 4L19 7', up: 'M6 15l6-6 6 6', x: 'M6 6l12 12M18 6L6 18', expand: 'M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7', lang: 'M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z'
}
const FILLED = ['play', 'pause', 'prev', 'next', 'lang']
const Ic = ({ n, w = 24 }) => { const f = FILLED.includes(n); return <svg width={w} height={w} viewBox="0 0 24 24" fill={f ? 'currentColor' : 'none'} stroke={f ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={IC[n]} /></svg> }

const hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255
  const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2, d = M - m
  let h = 0, s = 0
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = M === r ? ((g - b) / d + 6) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60 }
  return [h, s, l]
}
const pick = img => {
  const c = document.createElement('canvas'); c.width = c.height = 40
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 40, 40)
  const d = x.getImageData(0, 0, 40, 40).data
  const bins = Array.from({ length: 24 }, () => ({ w: 0, hx: 0, hy: 0, s: 0 }))
  let gray = 0, gn = 0
  for (let k = 0; k < d.length; k += 4) {
    if (d[k + 3] < 200) continue
    const [h, s, l] = hsl(d[k], d[k + 1], d[k + 2])
    gray += l; gn++
    if (l < 0.1 || l > 0.93) continue
    const w = s * s * (1 - Math.abs(2 * l - 1)) + 0.002, b = bins[Math.floor(h / 15) % 24], a = h * Math.PI / 180
    b.w += w; b.hx += Math.cos(a) * w; b.hy += Math.sin(a) * w; b.s += s * w
  }
  const top = bins.reduce((a, b) => (b.w > a.w ? b : a))
  const s = top.w ? top.s / top.w : 0
  if (s < 0.18) { const l = Math.min(0.3, Math.max(0.16, (gray / (gn || 1)) * 0.5)); return `hsl(0 0% ${(l * 100).toFixed(0)}%)` }
  const h = ((Math.atan2(top.hy, top.hx) * 180 / Math.PI) + 360) % 360
  return `hsl(${h.toFixed(0)} ${(Math.min(0.85, Math.max(0.4, s)) * 100).toFixed(0)}% 32%)`
}
const DEF = '#123a9c'

function Img({ src, className = '', icon, eager }) {
  const [m, setM] = useState(0)
  const [ok, setOk] = useState(false)
  useEffect(() => { setM(0); setOk(false) }, [src])
  if (!src || m > 1) return <span className={'im ph ' + className}>{icon || <Em n="note" />}</span>
  return <img className={'im ' + className + (ok ? '' : ' ld')} src={m ? src : px(src)} alt="" loading={eager ? 'eager' : 'lazy'} referrerPolicy="no-referrer" onLoad={() => setOk(true)} onError={() => { setOk(false); setM(m + 1) }} />
}

function Av({ src, name, className = '' }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [src])
  if (bad || !src) return <span className={'av ' + className}>{(name || '?').trim().charAt(0).toUpperCase()}</span>
  return <img className={'av ' + className} src={src.startsWith('data:') ? src : px(src)} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} />
}

const Eq = () => <span className="eq"><i /><i /><i /></span>

const SkRows = ({ n = 7 }) => <div>{Array.from({ length: n }, (_, k) => <div key={k} className="row sk" style={{ '--d': k * 60 + 'ms' }}><span className="im shm" /><div className="tt"><span className="shm l1" /><span className="shm l2" /></div></div>)}</div>
const SkCards = ({ n = 6, grid }) => <div className={grid ? 'grid' : 'shelf'}>{Array.from({ length: n }, (_, k) => <div key={k} className="card" style={{ '--d': k * 60 + 'ms' }}><span className="im shm" /><span className="shm l1" /><span className="shm l2" /></div>)}</div>
const SkHead = () => <div className="hd"><span className="im shm big" /><div className="skhd"><span className="shm l2" /><span className="shm l3" /></div></div>
const LySk = () => <div className="lysk">{[80, 60, 90, 50, 70].map((w, k) => <span key={k} className="shm" style={{ width: w + '%', animationDelay: k * 120 + 'ms' }} />)}</div>

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="mdl" onClick={onClose}>
      <div className="mbox" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

const LINKS = [['Donate', 'https://www.zeppeli.my.id', EMO.heart], ['Telegram', 'https://t.me/DasyncH', 'https://cdn.simpleicons.org/telegram/ffffff'], ['GitHub', 'https://github.com/XazepysK', 'https://cdn.simpleicons.org/github/ffffff']]
function DevLinks() {
  return <div className="dl">{LINKS.map(([l, h, i], k) => <a key={l} href={h} target="_blank" rel="noopener noreferrer" className={'dla' + (k === 0 ? ' don' : '')}><img src={i} alt="" />{l}</a>)}</div>
}

function Account({ user, onOut }) {
  return (
    <div className="pf">
      <h1>Account</h1>
      <div className="pfh"><Av src={user.image} name={user.name} className="lg" /><div className="tt"><b>{user.name}</b><small>{user.email}</small></div></div>
      <div className="acts"><button className="tab" onClick={onOut}>Sign out</button></div>
    </div>
  )
}

export function Login() {
  return (
    <div className="login">
      <div className="logo"><img src="/logo.png" alt="" />Sync-musiC</div>
      <h1>Music without ads.</h1>
      <button className="pill" onClick={() => signIn('google')}>Sign in with Google</button>
      <div className="ft lf"><DevLinks /></div>
    </div>
  )
}

export default function App({ user }) {
  const [view, setView] = useState({ n: 'home' })
  const [q, setQ] = useState('')
  const [type, setType] = useState('track')
  const [res, setRes] = useState([])
  const [shelves, setShelves] = useState(null)
  const [queue, setQueue] = useState([])
  const [i, setI] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [vol, setVol] = useState(0.8)
  const [shuf, setShuf] = useState(false)
  const [rep, setRep] = useState(false)
  const [lyr, setLyr] = useState(null)
  const [showL, setShowL] = useState(false)
  const [tl, setTl] = useState('')
  const [tr, setTr] = useState(null)
  const [trb, setTrb] = useState(false)
  const [lx, setLx] = useState(false)
  const [lm, setLm] = useState(false)
  const [msg, setMsg] = useState('')
  const [full, setFull] = useState(false)
  const [out, setOut] = useState(false)
  const [th, setTh] = useState(DEF)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [buf, setBuf] = useState(false)
  const [tick, setTick] = useState(0)
  const [promo, setPromo] = useState(true)
  const thc = useRef(new Map())
  const au = useRef(null)
  const curRef = useRef(null)
  const tt = useRef(0)
  const tries = useRef(0)
  const cur = queue[i]
  const D = isFinite(dur) && dur > 0 ? dur : (cur?.duration || 0) / 1000

  const toast = (m, ms = 2800) => { setMsg(m); clearTimeout(tt.current); tt.current = setTimeout(() => setMsg(''), ms) }
  const closeP = useCallback(() => setPromo(false), [])
  const closeLm = useCallback(() => setLm(false), [])
  const go = n => setView(n)

  useEffect(() => {
    setReady(true)
    Promise.all(SHELVES.map(s => J('/api/search?type=track&q=' + encodeURIComponent(s)).then(r => ({ s, r: r.results || [] })))).then(setShelves).catch(() => setShelves([]))
  }, [])

  useEffect(() => setRes([]), [type])

  useEffect(() => {
    if (!q.trim()) { setBusy(false); return setRes([]) }
    let dead = false
    setBusy(true)
    const h = setTimeout(() => J(`/api/search?type=${type}&q=${encodeURIComponent(q)}`).then(r => !dead && setRes(r.results || [])).catch(() => {}).finally(() => !dead && setBusy(false)), 350)
    return () => { dead = true; clearTimeout(h) }
  }, [q, type])

  useEffect(() => { au.current.volume = vol }, [vol])

  useEffect(() => {
    if (!cur) return
    const a = au.current
    const ac = new AbortController()
    let dead = false
    curRef.current = cur
    tries.current = 0
    a.pause()
    a.removeAttribute('src')
    a.load()
    setLyr(null); setT(0); setDur(0); setBuf(true)
    J('/api/lyrics?q=' + encodeURIComponent(cur.title + ' ' + cur.artist), { signal: ac.signal }).then(r => !dead && setLyr(r)).catch(() => !dead && setLyr({ synced: null, plain: null }))
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: cur.title, artist: cur.artist, artwork: cur.cover ? [{ src: new URL(px(cur.cover), location.origin).href }] : [] })
    const miss = () => { if (dead) return; setBuf(false); a.removeAttribute('src'); a.load(); setPlaying(false); toast('No audio source available for this song') }
    ;(cur.audio ? Promise.resolve(cur.audio) : J('/api/audio?title=' + encodeURIComponent(cur.title) + '&artist=' + encodeURIComponent(cur.artist), { signal: ac.signal }).then(r => r.url))
      .then(u => { if (dead) return; if (!u) return miss(); a.src = u; a.play().catch(() => {}) }).catch(miss)
    return () => { dead = true; ac.abort() }
  }, [cur?.id, i, tick])

  const onAuErr = () => {
    const a = au.current, c = curRef.current
    setBuf(false)
    if (!c || !a.getAttribute('src')) return
    if (c.audio || tries.current >= 1) return toast('Could not load this song')
    tries.current++
    setBuf(true)
    J('/api/audio?title=' + encodeURIComponent(c.title) + '&artist=' + encodeURIComponent(c.artist) + '&fresh=1')
      .then(r => { if (curRef.current !== c) return; if (!r.url) throw new Error('none'); a.src = r.url; a.play().catch(() => {}) })
      .catch(() => { if (curRef.current === c) { setBuf(false); toast('Could not load this song') } })
  }
  const play = (list, k) => { setQueue(list); setI(k); setTick(x => x + 1) }
  const next = useCallback(() => { if (!queue.length) return; setI(p => (shuf ? Math.floor(Math.random() * queue.length) : (p + 1) % queue.length)); setTick(x => x + 1) }, [queue, shuf])
  const prev = () => { if (t > 3) au.current.currentTime = 0; else if (queue.length) { setI(p => (p - 1 + queue.length) % queue.length); setTick(x => x + 1) } }
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const m = navigator.mediaSession, a = au.current
    const set = (k, f) => { try { m.setActionHandler(k, f) } catch {} }
    set('play', () => a.play()); set('pause', () => a.pause()); set('previoustrack', prev); set('nexttrack', next)
    set('seekto', e => { a.currentTime = e.seekTime })
  })
  const toggle = () => { const a = au.current; if (!a.getAttribute('src')) return buf || toast('No audio source available'); a.paused ? a.play() : a.pause() }
  const closeFull = useCallback(() => { setOut(true); setTimeout(() => { setFull(false); setOut(false); setLx(false) }, 260) }, [])

  useEffect(() => {
    const u = cur?.cover
    if (!u) return setTh(DEF)
    if (thc.current.has(u)) return setTh(thc.current.get(u))
    let dead = false
    const im = new Image()
    im.onload = () => { try { const c = pick(im); thc.current.set(u, c); !dead && setTh(c) } catch {} }
    im.onerror = () => {}
    im.src = px(u)
    return () => { dead = true }
  }, [cur?.cover])

  useEffect(() => {
    if (!full) return
    const h = e => e.key === 'Escape' && (lx ? setLx(false) : closeFull())
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [full, closeFull, lx])

  const parsed = parseLyr(lyr)
  const lines = parsed.synced
  const act = lines.findLastIndex(l => l.t <= t)
  useEffect(() => {
    document.querySelectorAll('.ly, .fpl, .lxb').forEach(box => {
      const el = box.querySelector('.cl')
      if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' })
    })
  }, [act, full, showL, lx, tr])

  const row = (list, k) => {
    const x = list[k], on = cur?.id === x.id
    return (
      <div key={x.id + k} className={'row' + (on ? ' on' : '')} style={{ '--d': Math.min(k, 14) * 30 + 'ms' }} onClick={() => play(list, k)}>
        <span className="n">{on && playing ? <Eq /> : on ? <Ic n="play" w={14} /> : k + 1}</span>
        <Img src={x.cover} />
        <div className="tt"><b>{x.title}</b><small>{x.artist}</small></div>
        <small className="al">{x.album}</small>
        <small>{fmt(x.duration / 1000)}</small>
      </div>
    )
  }
  const rows = list => list.length ? list.map((x, k) => row(list, k)) : <small>No songs here yet.</small>

  useEffect(() => { try { setTl(localStorage.getItem('sm:tl') || '') } catch {} }, [])
  useEffect(() => {
    const p = new URLSearchParams(location.search), ti = p.get('t'), ar = p.get('a') || ''
    if (!ti) return
    history.replaceState(null, '', '/')
    J('/api/search?type=track&q=' + encodeURIComponent(ti + ' ' + ar)).then(r => {
      const l = r.results || [], k = Math.max(0, l.findIndex(x => x.title.toLowerCase() === ti.toLowerCase()))
      if (l.length) play(l, k)
    }).catch(() => toast('Could not open shared song'))
  }, [])

  useEffect(() => {
    setTr(null)
    const { synced, plain } = parseLyr(lyr)
    const src = synced.length ? synced.map(l => l.x) : plain
    if (!tl || !src.some(Boolean)) return
    const ac = new AbortController()
    let dead = false
    setTrb(true)
    J('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: tl, lines: src }), signal: ac.signal })
      .then(r => { if (dead) return; if (Array.isArray(r.lines) && r.lines.some(Boolean)) setTr(r.lines); else toast('Could not translate lyrics') })
      .catch(() => {})
      .finally(() => !dead && setTrb(false))
    return () => { dead = true; ac.abort() }
  }, [tl, lyr])

  const pickLang = c => { setTl(c); setLm(false); try { localStorage.setItem('sm:tl', c) } catch {} }
  const langBtn = (
    <button className="lang" aria-label="Translate lyrics" onClick={() => setLm(true)}>
      {trb ? <span className="spin sm" /> : <Ic n="lang" w={18} />}<b>{tl ? tl.split('-')[0].toUpperCase() : 'OFF'}</b>
    </button>
  )
  const shareSong = async () => {
    if (!cur) return
    const d = { title: cur.title, text: `${cur.title} - ${cur.artist}`, url: `${location.origin}/?t=${encodeURIComponent(cur.title)}&a=${encodeURIComponent(cur.artist)}` }
    try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(`${d.text} ${d.url}`); toast('Link copied') } } catch {}
  }
  const dlLyr = () => {
    const { synced, plain } = parsed
    if (!cur || !(synced.length || plain.some(Boolean))) return toast('No lyrics to download')
    const ts = s => `[${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0')}]`
    const head = `[ti:${cur.title}]\n[ar:${cur.artist}]\n`
    const body = synced.length
      ? synced.map((l, k) => ts(l.t) + l.x + (tr?.[k] ? '\n' + ts(l.t) + tr[k] : '')).join('\n')
      : plain.map((x, k) => x + (tr?.[k] ? '\n' + tr[k] : '')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([head + body], { type: 'text/plain;charset=utf-8' }))
    a.download = `${cur.artist} - ${cur.title}.${synced.length ? 'lrc' : 'txt'}`.replace(/[\\/:*?"<>|]/g, '_')
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const actBtns = <>
    <button className="rb" aria-label="Download lyrics" onClick={dlLyr}><Ic n="dl" w={20} /></button>
    <button className="rb" aria-label="Share" onClick={shareSong}><Ic n="share" w={20} /></button>
  </>
  const lyricBody = () => {
    if (!lyr) return <LySk />
    if (lines.length) return lines.map((l, k) => (
      <p key={k} className={'lyl' + (k === act ? ' cl' : '')} onClick={() => { au.current.currentTime = l.t }}>
        <span className="lo">{l.x || '...'}</span>
        {l.x && tr?.[k] && <span className="lt">{tr[k]}</span>}
      </p>
    ))
    if (parsed.plain.some(Boolean)) return parsed.plain.map((x, k) => x ? <p key={k} className="lyl"><span className="lo">{x}</span>{tr?.[k] && <span className="lt">{tr[k]}</span>}</p> : <div key={k} className="gap" />)
    return <p className="lyl">Lyrics not found.</p>
  }

  const hour = new Date().getHours()
  const hi = hour < 11 ? 'Good morning' : hour < 15 ? 'Good afternoon' : hour < 19 ? 'Good evening' : 'Good night'
  return (
    <div className="app" style={{ '--pc': th }}>
      {(!ready || busy || shelves === null) && <div className="tb" />}
      <nav className="side">
        <div className="logo"><img src="/logo.png" alt="" />Sync-musiC</div>
        <button className={'nv' + (view.n === 'home' ? ' on' : '')} onClick={() => go({ n: 'home' })}>Home</button>
        <button className={'nv' + (view.n === 'search' ? ' on' : '')} onClick={() => go({ n: 'search' })}>Search</button>
        <div className="me" onClick={() => go({ n: 'profile' })}>
          <Av src={user.image} name={user.name} />
          <span>{user.name}</span>
          <button onClick={st(() => signOut())}>Sign out</button>
        </div>
      </nav>

      <main className="main">
        <div className="vw" key={view.n + (view.id || '')}>
          {view.n === 'home' && <>
            <h1>{hi}</h1>
            {shelves === null && <><section><div className="shm skh" /><SkCards /></section><section><div className="shm skh" /><SkCards /></section></>}
            {(shelves || []).map(({ s, r }) => r.length > 0 && <section key={s}><h2>{s}</h2><div className="shelf">{r.slice(0, 12).map((x, k) => <div key={x.id + k} className="card" style={{ '--d': Math.min(k, 12) * 40 + 'ms' }} onClick={() => play(r, k)}><Img src={x.cover} /><b>{x.title}</b><small>{x.artist}</small></div>)}</div></section>)}
          </>}

          {view.n === 'search' && <>
            <input className="sb" autoFocus placeholder="Search songs, albums, artists" value={q} onChange={e => setQ(e.target.value)} />
            <div className="tabs">{TYPES.map(([k, l]) => <button key={k} className={'tab' + (type === k ? ' on' : '')} onClick={() => setType(k)}>{l}</button>)}</div>
            {busy && !res.length && (type === 'track' ? <SkRows /> : <SkCards n={8} grid />)}
            {type === 'track' && !(busy && !res.length) && rows(res)}
            {(type === 'album' || type === 'artist') && <div className="grid">{res.map((x, k) => <div key={x.id + k} className="card" style={{ '--d': Math.min(k, 12) * 40 + 'ms' }} onClick={() => { setType('track'); setQ(x.title) }}><Img className={type === 'artist' ? 'rd' : ''} src={x.cover} /><b>{x.title}</b><small>{x.artist}</small></div>)}</div>}
            {!q.trim() && <small>Type something to start searching.</small>}
          </>}

          {view.n === 'profile' && <Account user={user} onOut={() => signOut()} />}
          <div className="ft"><small>Support the dev</small><DevLinks /></div>
        </div>
      </main>

      <footer className="bar">
        <div className={'np' + (playing ? ' go' : '')} onClick={() => cur && setFull(true)} style={{ cursor: cur ? 'pointer' : 'default' }}>
          {cur && <div className="npi" key={cur.id}><Img src={cur.cover} eager /><div className="tt"><b>{cur.title}</b><small>{cur.artist}</small></div>
</div>}
        </div>
        <div className="ctl">
          <div className="btns">
            <button className={'x' + (shuf ? ' on' : '')} aria-label="Shuffle" onClick={() => setShuf(!shuf)}><Ic n="shuffle" w={20} /></button>
            <button aria-label="Previous" onClick={prev}><Ic n="prev" w={22} /></button>
            <button className="pp" aria-label="Play/pause" onClick={toggle}>{buf ? <span className="spin" /> : <Ic n={playing ? 'pause' : 'play'} w={20} />}</button>
            <button aria-label="Next" onClick={next}><Ic n="next" w={22} /></button>
            <button className={'x' + (rep ? ' on' : '')} aria-label="Repeat" onClick={() => setRep(!rep)}><Ic n="repeat" w={20} /></button>
          </div>
          <div className="seek"><span>{fmt(t)}</span><input type="range" min="0" max={D} step="0.1" value={Math.min(t, D)} onChange={e => { au.current.currentTime = +e.target.value }} /><span>{fmt(D)}</span></div>
        </div>
        <div className="rt">
          <button aria-label="Open player" style={{ color: 'var(--mu)' }} onClick={() => cur && setFull(true)}><Ic n="up" w={20} /></button>
          <button className={showL ? 'on' : ''} style={{ color: showL ? 'var(--ac2)' : 'var(--mu)' }} onClick={() => setShowL(!showL)}>Lyrics</button>
          <input type="range" min="0" max="1" step="0.01" value={vol} aria-label="Volume" onChange={e => setVol(+e.target.value)} />
        </div>
        <div className="mp" style={{ '--p': (D ? (t / D) * 100 : 0) + '%' }} />
        <audio ref={au} onTimeUpdate={e => setT(e.target.currentTime)} onLoadedMetadata={e => setDur(e.target.duration)} onDurationChange={e => setDur(e.target.duration)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onWaiting={() => setBuf(true)} onPlaying={() => setBuf(false)} onCanPlay={() => setBuf(false)} onError={onAuErr}
          onEnded={() => (rep ? (au.current.currentTime = 0, au.current.play()) : next())} />
      </footer>

      <div className="mnav">
        <button className={view.n === 'home' ? 'on' : ''} onClick={() => go({ n: 'home' })}>Home</button>
        <button className={view.n === 'search' ? 'on' : ''} onClick={() => go({ n: 'search' })}>Search</button>
        <button className={view.n === 'profile' ? 'on' : ''} onClick={() => go({ n: 'profile' })}>Account</button>
      </div>

      {full && cur && <div className={'fp' + (out ? ' out' : '')} role="dialog" aria-label="Now playing">
        <div className="aura" />
        {lx && <div className="lx">
          <div className="lxh">
            <button className="fb" aria-label="Close lyrics" onClick={() => setLx(false)}><Ic n="down" /></button>
            <div className="ctxt"><b>{cur.title}</b><small>{cur.artist}</small></div>
            <span className="fb" />
          </div>
          <div className="lxb">{lyricBody()}</div>
          <div className="lxf">
            <div className="lxr">{langBtn}<span className="rbs">{actBtns}</span></div>
            <div className="fsk">
              <input type="range" min="0" max={D} step="0.1" value={Math.min(t, D)} aria-label="Seek" style={{ '--p': (D ? (t / D) * 100 : 0) + '%' }} onChange={e => { au.current.currentTime = +e.target.value }} />
              <div><span>{fmt(t)}</span><span>{fmt(D)}</span></div>
            </div>
            <button className="lxp" aria-label="Play/pause" onClick={toggle}>{buf ? <span className="spin" /> : <Ic n={playing ? 'pause' : 'play'} w={30} />}</button>
          </div>
        </div>}
        <div className="fsc">
          <div className="fpi">
            <div className="fph">
              <button className="fb" aria-label="Close player" onClick={closeFull}><Ic n="down" /></button>
              <div className="ctxt"><small>Now playing</small><b>{cur.album || cur.artist}</b></div>
              <span className="fb" />
            </div>
            <div className={'artw' + (playing ? ' go' : '')}><Img className="art" src={cur.cover} eager /></div>
            <p key={act} className="ll">{lines[act]?.x || '\u00a0'}</p>
            <div className="fpt">
              <div className="tt"><b>{cur.title}</b><small>{cur.artist}</small></div>
            </div>
            <div className="fsk">
              <input type="range" min="0" max={D} step="0.1" value={Math.min(t, D)} aria-label="Seek" style={{ '--p': (D ? (t / D) * 100 : 0) + '%' }} onChange={e => { au.current.currentTime = +e.target.value }} />
              <div><span>{fmt(t)}</span><span>{fmt(D)}</span></div>
            </div>
            <div className="fpc">
              <button className={shuf ? 'on' : ''} aria-label="Shuffle" onClick={() => setShuf(!shuf)}><Ic n="shuffle" /></button>
              <button aria-label="Previous" onClick={prev}><Ic n="prev" w={32} /></button>
              <button className={'big' + (playing ? ' pl' : '')} aria-label="Play/pause" onClick={toggle}>{buf ? <span className="spin" /> : <Ic n={playing ? 'pause' : 'play'} w={30} />}</button>
              <button aria-label="Next" onClick={next}><Ic n="next" w={32} /></button>
              <button className={rep ? 'on' : ''} aria-label="Repeat" onClick={() => setRep(!rep)}><Ic n="repeat" /></button>
            </div>
            <section className="fpl">
              <div className="fplh">
                <h3 onClick={e => e.currentTarget.closest('section').scrollIntoView({ behavior: 'smooth', block: 'start' })}>Lyrics</h3>
                <div className="fpla">{langBtn}<button className="lang" aria-label="Fullscreen lyrics" onClick={() => setLx(true)}><Ic n="expand" w={18} /></button></div>
              </div>
              {lyricBody()}
            </section>
          </div>
        </div>
      </div>}

      {showL && <aside className="ly">
        {!cur ? <p className="lyl">Play a song to see its lyrics.</p> : <>
          <div className="lyh"><b>Lyrics</b><span className="rbs">{langBtn}{actBtns}</span></div>
          {lyricBody()}
        </>}
      </aside>}

      {promo && ready && <Modal title="Support the dev" onClose={closeP}>
        <small>Enjoying Sync-musiC? Your support keeps it running and growing.</small>
        <DevLinks />
        <div className="ma"><button className="tab on" onClick={closeP}>Continue</button></div>
      </Modal>}
      {lm && <Modal title="Translate lyrics" onClose={closeLm}>
        <div className="langs">{LANGS.map(([c, n]) => <button key={c || 'off'} className={'tab' + (tl === c ? ' on' : '')} onClick={() => pickLang(c)}>{n}</button>)}</div>
      </Modal>}
      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  )
}

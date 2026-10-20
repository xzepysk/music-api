const axios = require('axios')
const crypto = require('crypto')

const BASE = 'https://spotubedl.com'
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
const te = new TextEncoder()

const rand = n => crypto.randomBytes(n)
const b64 = b => Buffer.from(b).toString('base64')
const unb64 = s => Buffer.from(String(s).trim(), 'base64')
const hex = b => Buffer.from(b).toString('hex')
const cat = (...a) => Buffer.concat(a.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)))
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b }
const rpath = () => `/${hex(rand(6))}/${hex(rand(8))}/${hex(rand(6))}`
const rhdr = () => 'x-' + hex(rand(8))

function info(kind, path, rid, ver, exp) {
	const prefix = { env: 'spdl-env:1:', req: 'spdl-req:1:', aad: 'spdl-aad:', raqd: 'spdl-req-aad:' }[kind]
	if (kind === 'env' || kind === 'req') return cat(te.encode(prefix), te.encode(path), Buffer.from([0]), rid)
	return cat(te.encode(prefix), Buffer.from([ver, 0, 0, 0, 0]), u32(exp), te.encode(path), Buffer.from([0]), rid)
}

function keyPair() {
	return crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
}

function exportPub(pub) {
	const j = pub.export({ format: 'jwk' })
	return cat(Buffer.from([4]), Buffer.from(j.x, 'base64url'), Buffer.from(j.y, 'base64url'))
}

function importPub(raw) {
	if (raw.length !== 65 || raw[0] !== 4) throw new Error('Invalid public key')
	return crypto.createPublicKey({
		key: {
			kty: 'EC',
			crv: 'P-256',
			x: raw.subarray(1, 33).toString('base64url'),
			y: raw.subarray(33).toString('base64url')
		},
		format: 'jwk'
	})
}

function shared(priv, peer) {
	return crypto.diffieHellman({ privateKey: priv, publicKey: importPub(peer) })
}

function hkdf(sec, salt, input) {
	return Buffer.from(crypto.hkdfSync('sha256', sec, salt, input, 32))
}

function gcmEnc(key, iv, plain, aad) {
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
	cipher.setAAD(aad)
	return cat(cipher.update(plain), cipher.final(), cipher.getAuthTag())
}

function gcmDec(key, iv, cipherText, aad) {
	const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
	decipher.setAAD(aad)
	decipher.setAuthTag(cipherText.subarray(-16))
	return cat(decipher.update(cipherText.subarray(0, -16)), decipher.final())
}

function pack(e) {
	return cat(Buffer.from([e.v, e.f]), u32(e.exp), e.rid, e.salt, e.pub, e.iv, u32(e.ct.length), e.ct)
}

function unpack(buf) {
	if (buf.length < 119) throw new Error('Encrypted response is too short')

	let o = 0
	const v = buf[o++]
	const f = buf[o++]
	const exp = buf.readUInt32BE(o)
	o += 4

	const rid = buf.subarray(o, o += 16)
	const salt = buf.subarray(o, o += 16)
	const pub = buf.subarray(o, o += 65)
	const iv = buf.subarray(o, o += 12)
	const len = buf.readUInt32BE(o)
	o += 4
	const ct = buf.subarray(o)

	if (ct.length !== len) throw new Error('Ciphertext length mismatch')
	return { v, f, exp, rid, salt, pub, iv, ct }
}

class SpotubeDL {
	constructor(base = BASE) {
		this.base = base.replace(/\/$/, '')
		this.serverKey = null
		this.headers = {
			'User-Agent': UA,
			Origin: this.base,
			Referer: this.base + '/'
		}
	}

	async serverPub() {
		if (this.serverKey) return this.serverKey

		const response = await axios.get(this.base + rpath(), {
			headers: { ...this.headers, Accept: 'text/plain', 'Cache-Control': 'no-store' },
			responseType: 'text',
			timeout: 30000
		})

		const key = unb64(response.data)
		if (key.length !== 65) throw new Error('Invalid server public key')

		this.serverKey = key
		return key
	}

	async securePost(apiPath, body = null) {
		const postPath = rpath()
		const postUrl = this.base + postPath
		const payload = JSON.stringify({
			path: apiPath.startsWith('/') ? apiPath : '/' + apiPath,
			method: 'POST',
			body
		})

		const serverPub = await this.serverPub()
		const { privateKey, publicKey } = keyPair()
		const clientPub = exportPub(publicKey)
		const secret = shared(privateKey, serverPub)
		const rid = rand(16)
		const salt = rand(16)
		const iv = rand(12)
		const exp = Math.floor(Date.now() / 1000) + 60

		const key = hkdf(secret, salt, info('req', postPath, rid))
		const aad = info('raqd', postPath, rid, 1, exp)
		const ct = gcmEnc(key, iv, Buffer.from(payload), aad)
		const envelope = pack({ v: 1, f: 2, exp, rid, salt, pub: clientPub, iv, ct })

		const response = await axios.post(postUrl, envelope, {
			headers: {
				...this.headers,
				[rhdr()]: b64(clientPub),
				'Content-Type': 'application/octet-stream',
				Accept: 'application/octet-stream, application/json'
			},
			responseType: 'arraybuffer',
			timeout: 30000
		})

		const env = unpack(Buffer.from(response.data))
		if (env.v !== 1) throw new Error('Unsupported envelope version')

		const key2 = hkdf(shared(privateKey, env.pub), env.salt, info('env', postPath, env.rid))
		const plain = gcmDec(key2, env.iv, env.ct, info('aad', postPath, env.rid, env.v, env.exp))

		return { ok: true, data: JSON.parse(plain.toString('utf8')) }
	}

	search(query) {
		return this.securePost('/api/info/search', { query })
	}
}

async function searchSpotify(query, type = 'track') {
	query = String(query || '').trim()
	type = String(type || 'track').toLowerCase()

	if (!query) throw new Error('Search query must not be empty.')

	const keys = {
		track: ['tracks', 'results'],
		album: ['albums'],
		playlist: ['playlists'],
		artist: ['artists']
	}

	if (!keys[type]) throw new Error('Search type must be track, album, playlist, or artist.')

	const client = new SpotubeDL()
	const response = await client.search(query)

	if (!response.ok) throw new Error('Spotify search failed')

	const data = response.data || {}
	let results = []

	for (const key of keys[type]) {
		if (Array.isArray(data[key])) {
			results = data[key]
			break
		}
	}

	return results
}

const LRC = 'https://lrclib.net/api'

async function request(url) {
	const res = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'Lrclib-Client': 'SearchLyricsScraper/1.0 (Node.js)',
			'User-Agent': 'SearchLyricsScraper/1.0'
		}
	})

	const body = await res.text()
	let data

	try {
		data = JSON.parse(body)
	} catch {
		throw new Error(`Response is not JSON (${res.status})`)
	}

	if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
	return data
}

async function searchLyrics(query) {
	query = String(query || '').trim()
	if (!query) throw new Error('Song title must not be empty.')

	return request(`${LRC}/search?${new URLSearchParams({ q: query })}`)
}

async function getLyricsById(id) {
	id = String(id || '').trim()
	if (!/^\d+$/.test(id)) throw new Error('Song ID must be numeric.')

	return request(`${LRC}/get/${id}`)
}
module.exports = { SpotubeDL, searchSpotify, searchLyrics, getLyricsById }

// 使用 Web Crypto API 實作密碼雜湊與 JWT，避免依賴 Node.js 專屬模組（Cloudflare Workers 邊緣執行環境不支援）

function toBase64Url(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=')
  const str = atob(b64)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes
}

const PBKDF2_ITERATIONS = 100_000

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return `${toBase64Url(salt)}.${toBase64Url(new Uint8Array(derived))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split('.')
  if (!saltB64 || !hashB64) return false
  const salt = fromBase64Url(saltB64)
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const derivedB64 = toBase64Url(new Uint8Array(derived))
  if (derivedB64.length !== hashB64.length) return false
  let diff = 0
  for (let i = 0; i < derivedB64.length; i++) diff |= derivedB64.charCodeAt(i) ^ hashB64.charCodeAt(i)
  return diff === 0
}

export interface JwtPayload {
  sub: string
  email: string
  role: string
  exp: number
  [key: string]: unknown
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(header)))
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const data = `${headerB64}.${payloadB64}`
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${toBase64Url(new Uint8Array(sig))}`
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts
  const key = await hmacKey(secret)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    fromBase64Url(sigB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  )
  if (!valid) return null
  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64))) as JwtPayload
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

export async function verifyLineSignature(rawBody: string, signature: string, channelSecret: string): Promise<boolean> {
  const key = await hmacKey(channelSecret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  let str = ''
  for (const b of new Uint8Array(sig)) str += String.fromCharCode(b)
  const expected = btoa(str)
  return expected === signature
}

export function newId(): string {
  return crypto.randomUUID()
}

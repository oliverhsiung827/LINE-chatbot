import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import type { Env } from '../../lib/env'
import { hashPassword, newId, signJwt, verifyPassword } from '../../lib/crypto'
import { AUTH_COOKIE, requireAuth, type AuthVariables } from '../middleware/auth'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 天

export const authRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

interface AdminRow {
  id: string
  email: string
  password_hash: string
  name: string
  role: string
}

authRoutes.post('/login', async (c) => {
  const body = await c.req
    .json<{ email?: string; password?: string }>()
    .catch(() => ({}) as { email?: string; password?: string })
  const email = body.email?.trim().toLowerCase()
  const password = body.password
  if (!email || !password) return c.json({ error: '請輸入帳號密碼' }, 400)

  let admin = await c.env.DB.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first<AdminRow>()

  // 首次部署時，若尚無任何管理員帳號，且輸入的帳密符合初始設定的環境變數，則自動建立第一個管理員（owner）
  if (!admin) {
    const { count } = (await c.env.DB.prepare('SELECT COUNT(*) as count FROM admins').first<{ count: number }>()) ?? {
      count: 0,
    }
    const initEmail = c.env.ADMIN_INIT_EMAIL?.trim().toLowerCase()
    const initPassword = c.env.ADMIN_INIT_PASSWORD
    if (count === 0 && initEmail && initPassword && email === initEmail && password === initPassword) {
      const id = newId()
      const passwordHash = await hashPassword(password)
      await c.env.DB.prepare('INSERT INTO admins (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
        .bind(id, email, passwordHash, '系統管理員', 'owner')
        .run()
      admin = { id, email, password_hash: passwordHash, name: '系統管理員', role: 'owner' }
    }
  }

  if (!admin) return c.json({ error: '帳號或密碼錯誤' }, 401)
  const valid = await verifyPassword(password, admin.password_hash)
  if (!valid) return c.json({ error: '帳號或密碼錯誤' }, 401)

  const token = await signJwt(
    {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    },
    c.env.JWT_SECRET
  )

  setCookie(c, AUTH_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })

  return c.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role })
})

authRoutes.post('/logout', async (c) => {
  deleteCookie(c, AUTH_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

authRoutes.get('/me', requireAuth, async (c) => {
  const admin = c.get('admin')
  const row = await c.env.DB.prepare('SELECT id, email, name, role, created_at FROM admins WHERE id = ?')
    .bind(admin.sub)
    .first()
  if (!row) return c.json({ error: '找不到帳號' }, 404)
  return c.json(row)
})

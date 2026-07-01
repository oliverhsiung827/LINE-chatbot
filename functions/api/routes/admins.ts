import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'
import { hashPassword, newId, verifyPassword } from '../../lib/crypto'

export const adminRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
adminRoutes.use('*', requireAuth)

adminRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, email, name, role, created_at FROM admins ORDER BY created_at ASC').all()
  return c.json(rows.results)
})

adminRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { email, name, password } = body as { email?: string; name?: string; password?: string }
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail || !name?.trim() || !password) return c.json({ error: '請填寫帳號、姓名與密碼' }, 400)
  if (password.length < 8) return c.json({ error: '密碼長度至少需要 8 碼' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM admins WHERE email = ?').bind(normalizedEmail).first()
  if (existing) return c.json({ error: '此帳號已存在' }, 409)

  const id = newId()
  const passwordHash = await hashPassword(password)
  await c.env.DB.prepare('INSERT INTO admins (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
    .bind(id, normalizedEmail, passwordHash, name.trim(), 'admin')
    .run()
  return c.json({ id }, 201)
})

adminRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const admin = c.get('admin')
  if (id === admin.sub) return c.json({ error: '不能刪除自己的帳號' }, 400)

  const { count } = (await c.env.DB.prepare('SELECT COUNT(*) as count FROM admins').first<{ count: number }>()) ?? {
    count: 0,
  }
  if (count <= 1) return c.json({ error: '至少需要保留一個管理者帳號' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM admins WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: '找不到帳號' }, 404)

  await c.env.DB.prepare('DELETE FROM admins WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

adminRoutes.patch('/me/password', async (c) => {
  const admin = c.get('admin')
  const body = await c.req.json().catch(() => ({}))
  const { current_password, new_password } = body as { current_password?: string; new_password?: string }
  if (!current_password || !new_password) return c.json({ error: '請輸入目前密碼與新密碼' }, 400)
  if (new_password.length < 8) return c.json({ error: '新密碼長度至少需要 8 碼' }, 400)

  const row = await c.env.DB.prepare('SELECT password_hash FROM admins WHERE id = ?').bind(admin.sub).first<{
    password_hash: string
  }>()
  if (!row) return c.json({ error: '找不到帳號' }, 404)
  const valid = await verifyPassword(current_password, row.password_hash)
  if (!valid) return c.json({ error: '目前密碼不正確' }, 401)

  const newHash = await hashPassword(new_password)
  await c.env.DB.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').bind(newHash, admin.sub).run()
  return c.json({ ok: true })
})

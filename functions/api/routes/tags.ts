import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'

export const tagRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
tagRoutes.use('*', requireAuth)

tagRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM member_tags mt WHERE mt.tag_id = t.id) as member_count
     FROM tags t ORDER BY t.created_at DESC`
  ).all()
  return c.json(rows.results)
})

tagRoutes.post('/', async (c) => {
  const { name, color } = await c.req.json<{ name?: string; color?: string }>().catch(() => ({}) as { name?: string; color?: string })
  if (!name?.trim()) return c.json({ error: '請輸入標籤名稱' }, 400)
  try {
    const result = await c.env.DB.prepare('INSERT INTO tags (name, color) VALUES (?, ?)')
      .bind(name.trim(), color ?? '#3B82F6')
      .run()
    return c.json({ id: result.meta.last_row_id, name: name.trim(), color: color ?? '#3B82F6' }, 201)
  } catch {
    return c.json({ error: '標籤名稱已存在' }, 409)
  }
})

tagRoutes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const { name, color } = await c.req.json<{ name?: string; color?: string }>().catch(() => ({}) as { name?: string; color?: string })
  const existing = await c.env.DB.prepare('SELECT * FROM tags WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: '找不到標籤' }, 404)
  await c.env.DB.prepare('UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?')
    .bind(name ?? null, color ?? null, id)
    .run()
  return c.json({ ok: true })
})

tagRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

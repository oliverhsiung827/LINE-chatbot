import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'

export const memberRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
memberRoutes.use('*', requireAuth)

memberRoutes.get('/', async (c) => {
  const query = c.req.query('query')?.trim()
  const tagId = c.req.query('tag')
  const page = Math.max(1, Number(c.req.query('page') ?? '1'))
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize') ?? '20')))
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: unknown[] = []

  if (query) {
    conditions.push('u.display_name LIKE ?')
    params.push(`%${query}%`)
  }
  if (tagId) {
    conditions.push('u.id IN (SELECT user_id FROM member_tags WHERE tag_id = ?)')
    params.push(Number(tagId))
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM line_users u ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>()

  const rows = await c.env.DB.prepare(
    `SELECT u.* FROM line_users u ${whereClause} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, offset)
    .all()

  const userIds = rows.results.map((r) => (r as { id: string }).id)
  let tagsByUser: Record<string, unknown[]> = {}
  if (userIds.length) {
    const placeholders = userIds.map(() => '?').join(',')
    const tagRows = await c.env.DB.prepare(
      `SELECT mt.user_id, t.id, t.name, t.color FROM member_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.user_id IN (${placeholders})`
    )
      .bind(...userIds)
      .all()
    tagsByUser = tagRows.results.reduce((acc: Record<string, unknown[]>, row) => {
      const r = row as { user_id: string; id: number; name: string; color: string }
      acc[r.user_id] = acc[r.user_id] ?? []
      acc[r.user_id].push({ id: r.id, name: r.name, color: r.color })
      return acc
    }, {})
  }

  return c.json({
    items: rows.results.map((r) => ({ ...(r as object), tags: tagsByUser[(r as { id: string }).id] ?? [] })),
    page,
    pageSize,
    total: totalRow?.count ?? 0,
  })
})

memberRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const user = await c.env.DB.prepare('SELECT * FROM line_users WHERE id = ?').bind(id).first()
  if (!user) return c.json({ error: '找不到會員' }, 404)
  const tags = await c.env.DB.prepare(
    'SELECT t.id, t.name, t.color FROM member_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.user_id = ?'
  )
    .bind(id)
    .all()
  const messages = await c.env.DB.prepare(
    'SELECT * FROM message_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  )
    .bind(id)
    .all()
  return c.json({ ...user, tags: tags.results, recent_messages: messages.results })
})

memberRoutes.post('/:id/tags', async (c) => {
  const id = c.req.param('id')
  const { tagId } = await c.req.json<{ tagId?: number }>().catch(() => ({}) as { tagId?: number })
  if (!tagId) return c.json({ error: '缺少 tagId' }, 400)
  const user = await c.env.DB.prepare('SELECT id FROM line_users WHERE id = ?').bind(id).first()
  if (!user) return c.json({ error: '找不到會員' }, 404)
  await c.env.DB.prepare('INSERT OR IGNORE INTO member_tags (user_id, tag_id) VALUES (?, ?)').bind(id, tagId).run()
  return c.json({ ok: true })
})

memberRoutes.delete('/:id/tags/:tagId', async (c) => {
  const id = c.req.param('id')
  const tagId = Number(c.req.param('tagId'))
  await c.env.DB.prepare('DELETE FROM member_tags WHERE user_id = ? AND tag_id = ?').bind(id, tagId).run()
  return c.json({ ok: true })
})

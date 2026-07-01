import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'
import { newId } from '../../lib/crypto'

export const audienceRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
audienceRoutes.use('*', requireAuth)

interface AudienceRow {
  id: string
  name: string
  tag_ids: string
  match_type: 'any' | 'all'
  created_at: string
}

async function countMembers(env: Env, tagIds: number[], matchType: 'any' | 'all'): Promise<number> {
  if (!tagIds.length) return 0
  const placeholders = tagIds.map(() => '?').join(',')
  if (matchType === 'any') {
    const row = await env.DB.prepare(
      `SELECT COUNT(DISTINCT mt.user_id) as count FROM member_tags mt
       JOIN line_users u ON u.id = mt.user_id
       WHERE mt.tag_id IN (${placeholders}) AND u.is_blocked = 0`
    )
      .bind(...tagIds)
      .first<{ count: number }>()
    return row?.count ?? 0
  }
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM (
       SELECT mt.user_id FROM member_tags mt
       JOIN line_users u ON u.id = mt.user_id
       WHERE mt.tag_id IN (${placeholders}) AND u.is_blocked = 0
       GROUP BY mt.user_id
       HAVING COUNT(DISTINCT mt.tag_id) = ?
     )`
  )
    .bind(...tagIds, tagIds.length)
    .first<{ count: number }>()
  return row?.count ?? 0
}

audienceRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM audiences ORDER BY created_at DESC').all<AudienceRow>()
  const results = await Promise.all(
    rows.results.map(async (r) => {
      const tagIds = JSON.parse(r.tag_ids) as number[]
      return { ...r, tag_ids: tagIds, member_count: await countMembers(c.env, tagIds, r.match_type) }
    })
  )
  return c.json(results)
})

audienceRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { name, tag_ids, match_type } = body as { name?: string; tag_ids?: number[]; match_type?: string }
  if (!name?.trim()) return c.json({ error: '請輸入群眾名稱' }, 400)
  if (!tag_ids?.length) return c.json({ error: '請至少選擇一個標籤' }, 400)
  const id = newId()
  await c.env.DB.prepare('INSERT INTO audiences (id, name, tag_ids, match_type) VALUES (?, ?, ?, ?)')
    .bind(id, name.trim(), JSON.stringify(tag_ids), match_type === 'all' ? 'all' : 'any')
    .run()
  return c.json({ id }, 201)
})

audienceRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM audiences WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: '找不到群眾' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const { name, tag_ids, match_type } = body as { name?: string; tag_ids?: number[]; match_type?: string }
  await c.env.DB.prepare(
    'UPDATE audiences SET name = COALESCE(?, name), tag_ids = COALESCE(?, tag_ids), match_type = COALESCE(?, match_type) WHERE id = ?'
  )
    .bind(name ?? null, tag_ids ? JSON.stringify(tag_ids) : null, match_type ?? null, id)
    .run()
  return c.json({ ok: true })
})

audienceRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM audiences WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

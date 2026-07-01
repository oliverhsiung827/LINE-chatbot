import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'
import { newId } from '../../lib/crypto'
import { resolveAudienceUserIds } from '../../lib/audience'

export const audienceRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
audienceRoutes.use('*', requireAuth)

interface AudienceRow {
  id: string
  name: string
  tag_groups: string
  created_at: string
}

function validTagGroups(tagGroups: unknown): tagGroups is number[][] {
  return (
    Array.isArray(tagGroups) &&
    tagGroups.length > 0 &&
    tagGroups.every((g) => Array.isArray(g) && g.length > 0 && g.every((id) => typeof id === 'number'))
  )
}

audienceRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM audiences ORDER BY created_at DESC').all<AudienceRow>()
  const results = await Promise.all(
    rows.results.map(async (r) => {
      const tagGroups = JSON.parse(r.tag_groups) as number[][]
      const userIds = await resolveAudienceUserIds(c.env, tagGroups)
      return { ...r, tag_groups: tagGroups, member_count: userIds.length }
    })
  )
  return c.json(results)
})

audienceRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { name, tag_groups } = body as { name?: string; tag_groups?: unknown }
  if (!name?.trim()) return c.json({ error: '請輸入群眾名稱' }, 400)
  if (!validTagGroups(tag_groups)) return c.json({ error: '請至少設定一組標籤條件' }, 400)
  const id = newId()
  await c.env.DB.prepare('INSERT INTO audiences (id, name, tag_groups) VALUES (?, ?, ?)')
    .bind(id, name.trim(), JSON.stringify(tag_groups))
    .run()
  return c.json({ id }, 201)
})

audienceRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM audiences WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: '找不到群眾' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const { name, tag_groups } = body as { name?: string; tag_groups?: unknown }
  if (tag_groups !== undefined && !validTagGroups(tag_groups)) return c.json({ error: '請至少設定一組標籤條件' }, 400)
  await c.env.DB.prepare('UPDATE audiences SET name = COALESCE(?, name), tag_groups = COALESCE(?, tag_groups) WHERE id = ?')
    .bind(name ?? null, tag_groups ? JSON.stringify(tag_groups) : null, id)
    .run()
  return c.json({ ok: true })
})

audienceRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM audiences WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

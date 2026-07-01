import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'
import { newId } from '../../lib/crypto'
import { applyTag } from '../../lib/clickTracking'
import { verifyLineIdToken } from '../../lib/lineAuth'

export const joinLinkRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

// 建立/管理連結需要登入
joinLinkRoutes.get('/', requireAuth, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT jl.*, t.name as tag_name, (SELECT COUNT(*) FROM join_events je WHERE je.join_link_id = jl.id) as join_count
     FROM join_links jl LEFT JOIN tags t ON t.id = jl.tag_id
     ORDER BY jl.created_at DESC`
  ).all()
  return c.json(rows.results)
})

joinLinkRoutes.post('/', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { name, tag_id } = body as { name?: string; tag_id?: number }
  if (!name?.trim()) return c.json({ error: '請輸入名稱' }, 400)
  const id = newId()
  await c.env.DB.prepare('INSERT INTO join_links (id, name, tag_id) VALUES (?, ?, ?)')
    .bind(id, name.trim(), tag_id ?? null)
    .run()
  return c.json({ id }, 201)
})

joinLinkRoutes.delete('/:id', requireAuth, async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM join_links WHERE id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM join_events WHERE join_link_id = ?').bind(id).run()
  return c.json({ ok: true })
})

// 這個端點不需要登入 —— 是 LIFF 頁面（使用者手機瀏覽器）呼叫的公開端點
joinLinkRoutes.post('/:id/track', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT id, tag_id FROM join_links WHERE id = ?').bind(id).first<{
    id: string
    tag_id: number | null
  }>()
  if (!row) return c.json({ error: '找不到連結' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const { idToken } = body as { idToken?: string }
  if (!idToken || !c.env.LIFF_CHANNEL_ID) return c.json({ error: '缺少驗證資訊' }, 400)

  const verified = await verifyLineIdToken(idToken, c.env.LIFF_CHANNEL_ID)
  if (!verified) return c.json({ error: '驗證失敗' }, 401)

  await c.env.DB.prepare('INSERT INTO join_events (join_link_id, user_id) VALUES (?, ?)').bind(id, verified.userId).run()
  if (row.tag_id) await applyTag(c.env, verified.userId, row.tag_id)

  return c.json({ ok: true })
})

import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { applyTag } from '../../lib/clickTracking'
import { verifyLineIdToken } from '../../lib/lineAuth'

// 這裡的路由不需要登入驗證 —— 是給 LIFF 轉址頁（使用者手機瀏覽器）呼叫的公開端點
export const clickTargetRoutes = new Hono<{ Bindings: Env }>()

clickTargetRoutes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT target_url FROM click_targets WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ target_url: string }>()
  if (!row) return c.json({ error: '找不到連結' }, 404)
  return c.json({ target_url: row.target_url })
})

clickTargetRoutes.post('/:id/track', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT id, tag_id FROM click_targets WHERE id = ?')
    .bind(id)
    .first<{ id: string; tag_id: number | null }>()
  if (!row) return c.json({ error: '找不到連結' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const { idToken } = body as { idToken?: string }
  if (!idToken || !c.env.LINE_CHANNEL_ID) return c.json({ error: '缺少驗證資訊' }, 400)

  const verified = await verifyLineIdToken(idToken, c.env.LINE_CHANNEL_ID)
  if (!verified) return c.json({ error: '驗證失敗' }, 401)

  await c.env.DB.prepare('INSERT INTO click_events (click_target_id, user_id) VALUES (?, ?)').bind(id, verified.userId).run()
  if (row.tag_id) await applyTag(c.env, verified.userId, row.tag_id)

  return c.json({ ok: true })
})

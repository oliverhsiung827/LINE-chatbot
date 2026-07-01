import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'
import { newId } from '../../lib/crypto'
import { materializeUriAction } from '../../lib/clickTracking'

export const richMessageRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
richMessageRoutes.use('*', requireAuth)

interface TrackableAction {
  type: string
  uri?: string
  label?: string
  tag_id?: number
  click_target_id?: string
}

// 存檔時處理有設定標籤的「開啟連結」動作（imagemap actions 或 carousel 卡片按鈕），
// 建立/更新對應的 click_targets 紀錄，這樣送出訊息時才知道要換成哪個追蹤連結
async function materializeContent(env: Env, type: string, content: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (type === 'imagemap' && Array.isArray(content.actions)) {
    const actions = await Promise.all(
      (content.actions as TrackableAction[]).map((a) => materializeUriAction(env, a))
    )
    return { ...content, actions }
  }
  if (type === 'flex_carousel' && Array.isArray(content.cards)) {
    const cards = await Promise.all(
      (content.cards as Array<{ buttons?: Array<{ action: TrackableAction }> }>).map(async (card) => ({
        ...card,
        buttons: card.buttons
          ? await Promise.all(card.buttons.map(async (b) => ({ ...b, action: await materializeUriAction(env, b.action) })))
          : card.buttons,
      }))
    )
    return { ...content, cards }
  }
  return content
}

interface RichMessageRow {
  id: string
  type: string
  name: string
  content: string
  created_at: string
  updated_at: string
}

function toResponse(row: RichMessageRow) {
  return { ...row, content: JSON.parse(row.content) }
}

function assetKeyFor(id: string, suffix: string) {
  return `rich-message/${id}/${suffix}`
}

richMessageRoutes.get('/', async (c) => {
  const type = c.req.query('type')
  const rows = type
    ? await c.env.DB.prepare('SELECT * FROM rich_messages WHERE type = ? ORDER BY created_at DESC').bind(type).all()
    : await c.env.DB.prepare('SELECT * FROM rich_messages ORDER BY created_at DESC').all()
  return c.json(rows.results.map((r) => toResponse(r as unknown as RichMessageRow)))
})

richMessageRoutes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM rich_messages WHERE id = ?').bind(c.req.param('id')).first<RichMessageRow>()
  if (!row) return c.json({ error: '找不到素材' }, 404)
  return c.json(toResponse(row))
})

richMessageRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { type, name, content } = body as { type?: string; name?: string; content?: unknown }
  if (type !== 'imagemap' && type !== 'flex_carousel') return c.json({ error: '不支援的類型' }, 400)
  if (!name?.trim()) return c.json({ error: '請輸入名稱' }, 400)
  const id = newId()
  const defaultContent =
    type === 'imagemap'
      ? { altText: name, baseSize: { width: 1040, height: 1040 }, image_key: null, actions: [], video: null }
      : { altText: name, cards: [] }
  const materialized = await materializeContent(c.env, type, (content as Record<string, unknown>) ?? defaultContent)
  await c.env.DB.prepare('INSERT INTO rich_messages (id, type, name, content) VALUES (?, ?, ?, ?)')
    .bind(id, type, name.trim(), JSON.stringify(materialized))
    .run()
  return c.json({ id }, 201)
})

richMessageRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT type FROM rich_messages WHERE id = ?').bind(id).first<{ type: string }>()
  if (!existing) return c.json({ error: '找不到素材' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const { name, content } = body as { name?: string; content?: unknown }
  const materialized = content ? await materializeContent(c.env, existing.type, content as Record<string, unknown>) : null
  await c.env.DB.prepare(
    "UPDATE rich_messages SET name = COALESCE(?, name), content = COALESCE(?, content), updated_at = datetime('now') WHERE id = ?"
  )
    .bind(name ?? null, materialized ? JSON.stringify(materialized) : null, id)
    .run()
  return c.json({ ok: true })
})

richMessageRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM rich_messages WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: '找不到素材' }, 404)
  const objects = await c.env.MEDIA.list({ prefix: `rich-message/${id}/` })
  await Promise.all(objects.objects.map((o) => c.env.MEDIA.delete(o.key)))
  await c.env.DB.prepare('DELETE FROM rich_messages WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

richMessageRoutes.post('/:id/image', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT * FROM rich_messages WHERE id = ?').bind(id).first<RichMessageRow>()
  if (!row) return c.json({ error: '找不到素材' }, 404)
  const form = await c.req.formData()
  const fileEntry = form.get('file')
  if (!fileEntry || typeof fileEntry === 'string') return c.json({ error: '請上傳圖片檔案' }, 400)
  const file = fileEntry as File
  const key = assetKeyFor(id, 'base')
  await c.env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } })
  const content = JSON.parse(row.content)
  content.image_key = key
  await c.env.DB.prepare("UPDATE rich_messages SET content = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(JSON.stringify(content), id)
    .run()
  return c.json({ ok: true })
})

richMessageRoutes.post('/:id/video', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT * FROM rich_messages WHERE id = ?').bind(id).first<RichMessageRow>()
  if (!row) return c.json({ error: '找不到素材' }, 404)
  const form = await c.req.formData()
  const fileEntry = form.get('file')
  if (!fileEntry || typeof fileEntry === 'string') return c.json({ error: '請上傳影片檔案' }, 400)
  const file = fileEntry as File
  const key = assetKeyFor(id, 'video')
  await c.env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } })
  const content = JSON.parse(row.content)
  content.video = { area: content.video?.area ?? { x: 0, y: 0, width: 100, height: 100 }, video_key: key, preview_key: content.video?.preview_key ?? null, external_link: content.video?.external_link }
  await c.env.DB.prepare("UPDATE rich_messages SET content = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(JSON.stringify(content), id)
    .run()
  return c.json({ ok: true })
})

richMessageRoutes.post('/:id/video-preview', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT * FROM rich_messages WHERE id = ?').bind(id).first<RichMessageRow>()
  if (!row) return c.json({ error: '找不到素材' }, 404)
  const form = await c.req.formData()
  const fileEntry = form.get('file')
  if (!fileEntry || typeof fileEntry === 'string') return c.json({ error: '請上傳預覽圖片' }, 400)
  const file = fileEntry as File
  const key = assetKeyFor(id, 'video-preview')
  await c.env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } })
  const content = JSON.parse(row.content)
  content.video = { area: content.video?.area ?? { x: 0, y: 0, width: 100, height: 100 }, video_key: content.video?.video_key ?? null, preview_key: key, external_link: content.video?.external_link }
  await c.env.DB.prepare("UPDATE rich_messages SET content = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(JSON.stringify(content), id)
    .run()
  return c.json({ ok: true })
})

richMessageRoutes.post('/:id/card-image/:index', async (c) => {
  const id = c.req.param('id')
  const index = Number(c.req.param('index'))
  const row = await c.env.DB.prepare('SELECT * FROM rich_messages WHERE id = ?').bind(id).first<RichMessageRow>()
  if (!row) return c.json({ error: '找不到素材' }, 404)
  const form = await c.req.formData()
  const fileEntry = form.get('file')
  if (!fileEntry || typeof fileEntry === 'string') return c.json({ error: '請上傳圖片檔案' }, 400)
  const file = fileEntry as File
  const content = JSON.parse(row.content)
  if (!content.cards?.[index]) return c.json({ error: '找不到對應卡片' }, 404)
  const key = assetKeyFor(id, `card-${index}`)
  await c.env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } })
  content.cards[index].image_key = key
  await c.env.DB.prepare("UPDATE rich_messages SET content = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(JSON.stringify(content), id)
    .run()
  return c.json({ ok: true })
})

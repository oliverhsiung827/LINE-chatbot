import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'
import { createLineClient } from '../../lib/line'
import { newId } from '../../lib/crypto'

export const richMenuRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
richMenuRoutes.use('*', requireAuth)

interface RichMenuRow {
  id: string
  line_rich_menu_id: string | null
  name: string
  chat_bar_text: string
  image_key: string | null
  size_width: number
  size_height: number
  areas: string
  is_default: number
  status: string
  created_at: string
}

function toResponse(row: RichMenuRow) {
  return {
    id: row.id,
    line_rich_menu_id: row.line_rich_menu_id,
    name: row.name,
    chat_bar_text: row.chat_bar_text,
    image_url: row.image_key ? `/api/rich-menus/${row.id}/image` : null,
    size_width: row.size_width,
    size_height: row.size_height,
    areas: JSON.parse(row.areas),
    is_default: row.is_default,
    status: row.status,
    created_at: row.created_at,
  }
}

richMenuRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM rich_menus ORDER BY created_at DESC').all()
  return c.json(rows.results.map((r) => toResponse(r as unknown as RichMenuRow)))
})

richMenuRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { name, chatBarText, sizeWidth, sizeHeight, areas } = body as {
    name?: string
    chatBarText?: string
    sizeWidth?: number
    sizeHeight?: number
    areas?: unknown[]
  }
  if (!name?.trim()) return c.json({ error: '請輸入選單名稱' }, 400)
  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO rich_menus (id, name, chat_bar_text, size_width, size_height, areas, status)
     VALUES (?, ?, ?, ?, ?, ?, 'draft')`
  )
    .bind(id, name.trim(), chatBarText ?? '選單', sizeWidth ?? 2500, sizeHeight ?? 1686, JSON.stringify(areas ?? []))
    .run()
  return c.json({ id }, 201)
})

richMenuRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM rich_menus WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: '找不到選單' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const { name, chatBarText, areas } = body as { name?: string; chatBarText?: string; areas?: unknown[] }
  await c.env.DB.prepare(
    `UPDATE rich_menus SET name = COALESCE(?, name), chat_bar_text = COALESCE(?, chat_bar_text), areas = COALESCE(?, areas) WHERE id = ?`
  )
    .bind(name ?? null, chatBarText ?? null, areas ? JSON.stringify(areas) : null, id)
    .run()
  return c.json({ ok: true })
})

richMenuRoutes.post('/:id/image', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM rich_menus WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: '找不到選單' }, 404)
  const form = await c.req.formData()
  const fileEntry = form.get('image')
  if (!fileEntry || typeof fileEntry === 'string') return c.json({ error: '請上傳圖片檔案' }, 400)
  const file = fileEntry as File
  const key = `richmenu/${id}`
  await c.env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } })
  await c.env.DB.prepare('UPDATE rich_menus SET image_key = ? WHERE id = ?').bind(key, id).run()
  return c.json({ ok: true, image_url: `/api/rich-menus/${id}/image` })
})

richMenuRoutes.get('/:id/image', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT image_key FROM rich_menus WHERE id = ?').bind(id).first<{
    image_key: string | null
  }>()
  if (!row?.image_key) return c.json({ error: '尚未上傳圖片' }, 404)
  const object = await c.env.MEDIA.get(row.image_key)
  if (!object) return c.json({ error: '找不到圖片' }, 404)
  return new Response(object.body, {
    headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'image/png' },
  })
})

richMenuRoutes.post('/:id/publish', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT * FROM rich_menus WHERE id = ?').bind(id).first<RichMenuRow>()
  if (!row) return c.json({ error: '找不到選單' }, 404)
  if (!row.image_key) return c.json({ error: '請先上傳選單圖片' }, 400)
  const areas = JSON.parse(row.areas)
  const object = await c.env.MEDIA.get(row.image_key)
  if (!object) return c.json({ error: '找不到選單圖片檔案' }, 404)

  const line = createLineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN)
  const { richMenuId } = await line.createRichMenu({
    size: { width: row.size_width, height: row.size_height },
    selected: false,
    name: row.name,
    chatBarText: row.chat_bar_text,
    areas,
  })
  await line.uploadRichMenuImage(
    richMenuId,
    await object.arrayBuffer(),
    object.httpMetadata?.contentType ?? 'image/png'
  )

  await c.env.DB.prepare("UPDATE rich_menus SET line_rich_menu_id = ?, status = 'published' WHERE id = ?")
    .bind(richMenuId, id)
    .run()
  return c.json({ ok: true, line_rich_menu_id: richMenuId })
})

richMenuRoutes.post('/:id/set-default', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT * FROM rich_menus WHERE id = ?').bind(id).first<RichMenuRow>()
  if (!row) return c.json({ error: '找不到選單' }, 404)
  if (!row.line_rich_menu_id) return c.json({ error: '請先發佈選單' }, 400)

  const line = createLineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN)
  await line.setDefaultRichMenu(row.line_rich_menu_id)

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE rich_menus SET is_default = 0'),
    c.env.DB.prepare('UPDATE rich_menus SET is_default = 1 WHERE id = ?').bind(id),
  ])
  return c.json({ ok: true })
})

richMenuRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT * FROM rich_menus WHERE id = ?').bind(id).first<RichMenuRow>()
  if (!row) return c.json({ error: '找不到選單' }, 404)

  if (row.line_rich_menu_id) {
    const line = createLineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN)
    await line.deleteRichMenu(row.line_rich_menu_id).catch(() => {})
  }
  if (row.image_key) {
    await c.env.MEDIA.delete(row.image_key).catch(() => {})
  }
  await c.env.DB.prepare('DELETE FROM rich_menus WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

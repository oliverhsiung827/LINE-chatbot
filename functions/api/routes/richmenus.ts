import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'
import { createLineClient, LineApiError } from '../../lib/line'
import { newId } from '../../lib/crypto'

export const richMenuRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
richMenuRoutes.use('*', requireAuth)

interface RichMenuAreaAction {
  type?: string
  text?: string
  uri?: string
  data?: string
  richMenuAliasId?: string
}

function validateAreas(areas: unknown): string | null {
  if (!Array.isArray(areas)) return '區塊格式錯誤'
  for (const area of areas) {
    if (typeof area !== 'object' || area === null) return '區塊格式錯誤'
    const a = area as { bounds?: unknown; action?: RichMenuAreaAction }
    if (!a.bounds) return '區塊缺少座標設定'
    const action = a.action
    if (!action?.type) return '區塊缺少動作設定'
    if (action.type === 'message' && !action.text?.trim()) return '「傳送文字訊息」動作請填寫要傳送的文字'
    if (action.type === 'uri' && !action.uri?.trim()) return '「開啟連結」動作請填寫網址'
    if (action.type === 'postback' && !action.data?.trim()) return '「Postback」動作請填寫 data'
    if (action.type === 'richmenuswitch' && !action.richMenuAliasId?.trim()) return '「切換選單頁面」動作請選擇要切換到的選單'
  }
  return null
}

function describeLineError(err: unknown): string {
  if (err instanceof LineApiError) {
    if (err.status === 413) return '圖片檔案過大，請壓縮至 1MB 以內後重新上傳'
    try {
      const parsed = JSON.parse(err.body) as { message?: string; details?: Array<{ message?: string; property?: string }> }
      const details = parsed.details?.map((d) => (d.property ? `${d.property}: ${d.message}` : d.message)).filter(Boolean)
      if (details?.length) return `${parsed.message ?? ''}${details.join('；')}`
      if (parsed.message) return parsed.message
    } catch {
      // ignore parse failure, fall back to raw body
    }
    return err.body || err.message
  }
  return err instanceof Error ? err.message : '未知錯誤'
}

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
  is_selected: number
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
    is_selected: row.is_selected,
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
  const { name, chatBarText, sizeWidth, sizeHeight, areas, selected } = body as {
    name?: string
    chatBarText?: string
    sizeWidth?: number
    sizeHeight?: number
    areas?: unknown[]
    selected?: boolean
  }
  if (!name?.trim()) return c.json({ error: '請輸入選單名稱' }, 400)
  if (areas?.length) {
    const err = validateAreas(areas)
    if (err) return c.json({ error: err }, 400)
  }
  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO rich_menus (id, name, chat_bar_text, size_width, size_height, areas, is_selected, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`
  )
    .bind(id, name.trim(), chatBarText ?? '選單', sizeWidth ?? 2500, sizeHeight ?? 1686, JSON.stringify(areas ?? []), selected ? 1 : 0)
    .run()
  return c.json({ id }, 201)
})

richMenuRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM rich_menus WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: '找不到選單' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const { name, chatBarText, areas, selected } = body as {
    name?: string
    chatBarText?: string
    areas?: unknown[]
    selected?: boolean
  }
  if (areas?.length) {
    const err = validateAreas(areas)
    if (err) return c.json({ error: err }, 400)
  }
  await c.env.DB.prepare(
    `UPDATE rich_menus SET name = COALESCE(?, name), chat_bar_text = COALESCE(?, chat_bar_text), areas = COALESCE(?, areas), is_selected = COALESCE(?, is_selected) WHERE id = ?`
  )
    .bind(name ?? null, chatBarText ?? null, areas ? JSON.stringify(areas) : null, selected === undefined ? null : selected ? 1 : 0, id)
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
  const areaError = validateAreas(areas)
  if (areaError) return c.json({ error: areaError }, 400)
  const object = await c.env.MEDIA.get(row.image_key)
  if (!object) return c.json({ error: '找不到選單圖片檔案' }, 404)

  // LINE 的 richMenuAliasId 限制在 32 字元以內，不能直接用含連字號的 UUID（36 碼），
  // 所以送給 LINE 時一律去除連字號（正好變成 32 碼的 16 進位字串）
  const toAliasId = (localId: string) => localId.replace(/-/g, '')
  const lineAreas = areas.map((area: { action: { type: string; richMenuAliasId?: string } }) =>
    area.action.type === 'richmenuswitch' && area.action.richMenuAliasId
      ? { ...area, action: { ...area.action, richMenuAliasId: toAliasId(area.action.richMenuAliasId) } }
      : area
  )

  const line = createLineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN)
  const previousLineRichMenuId = row.line_rich_menu_id

  let richMenuId: string
  try {
    const created = await line.createRichMenu({
      size: { width: row.size_width, height: row.size_height },
      selected: !!row.is_selected,
      name: row.name,
      chatBarText: row.chat_bar_text,
      areas: lineAreas,
    })
    richMenuId = created.richMenuId
    await line.uploadRichMenuImage(
      richMenuId,
      await object.arrayBuffer(),
      object.httpMetadata?.contentType ?? 'image/png'
    )
    // 用本地 UUID（去連字號）當作 alias，讓其他選單的「切換頁面」按鈕有穩定不變的目標，
    // 之後即使這個選單重新發佈換了新的 LINE richMenuId，別的選單也不用跟著改
    await line.upsertRichMenuAlias(toAliasId(id), richMenuId)
  } catch (err) {
    return c.json({ error: `發佈到 LINE 失敗：${describeLineError(err)}` }, 502)
  }

  if (previousLineRichMenuId && previousLineRichMenuId !== richMenuId) {
    await line.deleteRichMenu(previousLineRichMenuId).catch(() => {})
  }

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
  try {
    await line.setDefaultRichMenu(row.line_rich_menu_id)
  } catch (err) {
    return c.json({ error: `設為預設失敗：${describeLineError(err)}` }, 502)
  }

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

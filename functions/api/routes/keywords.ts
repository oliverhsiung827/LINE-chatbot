import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'

export const keywordRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
keywordRoutes.use('*', requireAuth)

function parseRow(row: Record<string, unknown>) {
  return {
    ...row,
    keywords: JSON.parse(row.keywords as string),
    reply_content: JSON.parse(row.reply_content as string),
  }
}

keywordRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM keyword_rules ORDER BY priority DESC, created_at DESC').all()
  return c.json(rows.results.map((r) => parseRow(r as Record<string, unknown>)))
})

keywordRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { name, match_type, keywords, reply_type, reply_content, is_active, priority, tag_id, start_at, end_at } = body as {
    name?: string
    match_type?: string
    keywords?: string[]
    reply_type?: string
    reply_content?: unknown
    is_active?: boolean
    priority?: number
    tag_id?: number | null
    start_at?: string | null
    end_at?: string | null
  }
  if (!name?.trim() || !keywords?.length || !reply_content) {
    return c.json({ error: '請填寫名稱、關鍵字與回覆內容' }, 400)
  }
  if (start_at && end_at && start_at >= end_at) return c.json({ error: '生效結束時間必須晚於開始時間' }, 400)
  const result = await c.env.DB.prepare(
    `INSERT INTO keyword_rules (name, match_type, keywords, reply_type, reply_content, is_active, priority, tag_id, start_at, end_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      name.trim(),
      match_type ?? 'contains',
      JSON.stringify(keywords),
      reply_type ?? 'text',
      JSON.stringify(reply_content),
      is_active === false ? 0 : 1,
      priority ?? 0,
      tag_id ?? null,
      start_at ?? null,
      end_at ?? null
    )
    .run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

keywordRoutes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT * FROM keyword_rules WHERE id = ?').bind(id).first<{
    tag_id: number | null
    start_at: string | null
    end_at: string | null
  }>()
  if (!existing) return c.json({ error: '找不到規則' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const { name, match_type, keywords, reply_type, reply_content, is_active, priority, tag_id, start_at, end_at } = body as {
    name?: string
    match_type?: string
    keywords?: string[]
    reply_type?: string
    reply_content?: unknown
    is_active?: boolean
    priority?: number
    tag_id?: number | null
    start_at?: string | null
    end_at?: string | null
  }
  const nextStartAt = start_at === undefined ? existing.start_at : start_at
  const nextEndAt = end_at === undefined ? existing.end_at : end_at
  if (nextStartAt && nextEndAt && nextStartAt >= nextEndAt) return c.json({ error: '生效結束時間必須晚於開始時間' }, 400)
  await c.env.DB.prepare(
    `UPDATE keyword_rules SET
      name = COALESCE(?, name),
      match_type = COALESCE(?, match_type),
      keywords = COALESCE(?, keywords),
      reply_type = COALESCE(?, reply_type),
      reply_content = COALESCE(?, reply_content),
      is_active = COALESCE(?, is_active),
      priority = COALESCE(?, priority),
      tag_id = ?,
      start_at = ?,
      end_at = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      name ?? null,
      match_type ?? null,
      keywords ? JSON.stringify(keywords) : null,
      reply_type ?? null,
      reply_content ? JSON.stringify(reply_content) : null,
      is_active === undefined ? null : is_active ? 1 : 0,
      priority ?? null,
      tag_id === undefined ? existing.tag_id : tag_id,
      nextStartAt,
      nextEndAt,
      id
    )
    .run()
  return c.json({ ok: true })
})

keywordRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM keyword_rules WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

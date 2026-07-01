import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'
import { createLineClient, type LineMessage } from '../../lib/line'

export const broadcastRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
broadcastRoutes.use('*', requireAuth)

interface BroadcastRow {
  id: number
  title: string
  message_type: string
  message_content: string
  target_type: string
  target_tag_ids: string | null
  status: string
  scheduled_at: string | null
  sent_at: string | null
  recipient_count: number
  created_by: string | null
  created_at: string
}

function toResponse(row: BroadcastRow) {
  return {
    ...row,
    message_content: JSON.parse(row.message_content),
    target_tag_ids: row.target_tag_ids ? JSON.parse(row.target_tag_ids) : null,
  }
}

function toLineMessage(messageType: string, content: Record<string, unknown>): LineMessage {
  if (messageType === 'text') return { type: 'text', text: content.text as string }
  if (messageType === 'image')
    return {
      type: 'image',
      originalContentUrl: content.originalContentUrl as string,
      previewImageUrl: content.previewImageUrl as string,
    }
  if (messageType === 'flex') return { type: 'flex', altText: content.altText as string, contents: content.contents }
  return { type: 'text', text: JSON.stringify(content) }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

broadcastRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM broadcasts ORDER BY created_at DESC').all()
  return c.json(rows.results.map((r) => toResponse(r as unknown as BroadcastRow)))
})

broadcastRoutes.post('/', async (c) => {
  const admin = c.get('admin')
  const body = await c.req.json().catch(() => ({}))
  const { title, message_type, message_content, target_type, target_tag_ids } = body as {
    title?: string
    message_type?: string
    message_content?: unknown
    target_type?: string
    target_tag_ids?: number[]
  }
  if (!title?.trim() || !message_content) return c.json({ error: '請填寫標題與訊息內容' }, 400)
  const result = await c.env.DB.prepare(
    `INSERT INTO broadcasts (title, message_type, message_content, target_type, target_tag_ids, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      title.trim(),
      message_type ?? 'text',
      JSON.stringify(message_content),
      target_type ?? 'all',
      target_tag_ids?.length ? JSON.stringify(target_tag_ids) : null,
      admin.sub
    )
    .run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

broadcastRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT status FROM broadcasts WHERE id = ?').bind(id).first<{
    status: string
  }>()
  if (!row) return c.json({ error: '找不到群發訊息' }, 404)
  if (row.status !== 'draft') return c.json({ error: '只能刪除草稿狀態的群發訊息' }, 400)
  await c.env.DB.prepare('DELETE FROM broadcasts WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

broadcastRoutes.post('/:id/send', async (c) => {
  const id = Number(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT * FROM broadcasts WHERE id = ?').bind(id).first<BroadcastRow>()
  if (!row) return c.json({ error: '找不到群發訊息' }, 404)
  if (row.status === 'sent' || row.status === 'sending') return c.json({ error: '此訊息已發送過' }, 400)

  await c.env.DB.prepare("UPDATE broadcasts SET status = 'sending' WHERE id = ?").bind(id).run()

  const line = createLineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN)
  const message = toLineMessage(row.message_type, JSON.parse(row.message_content))

  try {
    let recipientCount = 0
    if (row.target_type === 'all') {
      await line.broadcastToAll([message])
      const countRow = await c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM line_users WHERE is_blocked = 0'
      ).first<{ count: number }>()
      recipientCount = countRow?.count ?? 0
    } else {
      const tagIds = row.target_tag_ids ? (JSON.parse(row.target_tag_ids) as number[]) : []
      if (!tagIds.length) throw new Error('未選擇目標標籤')
      const placeholders = tagIds.map(() => '?').join(',')
      const users = await c.env.DB.prepare(
        `SELECT DISTINCT u.id FROM line_users u
         JOIN member_tags mt ON mt.user_id = u.id
         WHERE mt.tag_id IN (${placeholders}) AND u.is_blocked = 0`
      )
        .bind(...tagIds)
        .all()
      const userIds = users.results.map((r) => (r as { id: string }).id)
      for (const batch of chunk(userIds, 500)) {
        await line.multicast(batch, [message])
      }
      recipientCount = userIds.length
    }

    await c.env.DB.prepare(
      "UPDATE broadcasts SET status = 'sent', sent_at = datetime('now'), recipient_count = ? WHERE id = ?"
    )
      .bind(recipientCount, id)
      .run()
    return c.json({ ok: true, recipient_count: recipientCount })
  } catch (err) {
    await c.env.DB.prepare("UPDATE broadcasts SET status = 'failed' WHERE id = ?").bind(id).run()
    return c.json({ error: err instanceof Error ? err.message : '發送失敗' }, 500)
  }
})

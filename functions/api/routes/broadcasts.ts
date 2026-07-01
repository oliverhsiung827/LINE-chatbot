import { Hono } from 'hono'
import type { Env } from '../../lib/env'
import { requireAuth, type AuthVariables } from '../middleware/auth'
import { createLineClient, LineApiError, type LineMessage } from '../../lib/line'
import { buildLineMessage, type RichMessageRow } from '../../lib/richMessage'

export const broadcastRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
broadcastRoutes.use('*', requireAuth)

interface BroadcastRow {
  id: number
  title: string
  message_type: string
  message_content: string
  target_type: string
  target_tag_ids: string | null
  target_audience_id: string | null
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

async function resolveTagUserIds(env: Env, tagIds: number[], matchType: 'any' | 'all'): Promise<string[]> {
  if (!tagIds.length) return []
  const placeholders = tagIds.map(() => '?').join(',')
  if (matchType === 'any') {
    const users = await env.DB.prepare(
      `SELECT DISTINCT u.id FROM line_users u
       JOIN member_tags mt ON mt.user_id = u.id
       WHERE mt.tag_id IN (${placeholders}) AND u.is_blocked = 0`
    )
      .bind(...tagIds)
      .all()
    return users.results.map((r) => (r as { id: string }).id)
  }
  const users = await env.DB.prepare(
    `SELECT u.id FROM line_users u
     JOIN member_tags mt ON mt.user_id = u.id
     WHERE mt.tag_id IN (${placeholders}) AND u.is_blocked = 0
     GROUP BY u.id
     HAVING COUNT(DISTINCT mt.tag_id) = ?`
  )
    .bind(...tagIds, tagIds.length)
    .all()
  return users.results.map((r) => (r as { id: string }).id)
}

async function toLineMessage(env: Env, origin: string, messageType: string, content: Record<string, unknown>): Promise<LineMessage | null> {
  if (messageType === 'text') return { type: 'text', text: content.text as string }
  if (messageType === 'image')
    return {
      type: 'image',
      originalContentUrl: content.originalContentUrl as string,
      previewImageUrl: content.previewImageUrl as string,
    }
  if (messageType === 'flex' || messageType === 'imagemap') {
    const richMessageId = content.rich_message_id as string | undefined
    if (!richMessageId) return null
    const row = await env.DB.prepare('SELECT id, type, content FROM rich_messages WHERE id = ?')
      .bind(richMessageId)
      .first<RichMessageRow>()
    if (!row) return null
    return buildLineMessage(env, row, origin)
  }
  return { type: 'text', text: JSON.stringify(content) }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

function describeLineError(err: unknown): string {
  if (err instanceof LineApiError) {
    try {
      const parsed = JSON.parse(err.body) as { message?: string }
      if (parsed.message) return parsed.message
    } catch {
      // ignore parse failure, fall back to raw body
    }
    return err.body || err.message
  }
  return err instanceof Error ? err.message : '未知錯誤'
}

broadcastRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM broadcasts ORDER BY created_at DESC').all()
  return c.json(rows.results.map((r) => toResponse(r as unknown as BroadcastRow)))
})

broadcastRoutes.post('/', async (c) => {
  const admin = c.get('admin')
  const body = await c.req.json().catch(() => ({}))
  const { title, message_type, message_content, target_type, target_tag_ids, target_audience_id } = body as {
    title?: string
    message_type?: string
    message_content?: unknown
    target_type?: string
    target_tag_ids?: number[]
    target_audience_id?: string
  }
  if (!title?.trim() || !message_content) return c.json({ error: '請填寫標題與訊息內容' }, 400)
  const result = await c.env.DB.prepare(
    `INSERT INTO broadcasts (title, message_type, message_content, target_type, target_tag_ids, target_audience_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      title.trim(),
      message_type ?? 'text',
      JSON.stringify(message_content),
      target_type ?? 'all',
      target_tag_ids?.length ? JSON.stringify(target_tag_ids) : null,
      target_audience_id ?? null,
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
  const origin = new URL(c.req.url).origin
  const message = await toLineMessage(c.env, origin, row.message_type, JSON.parse(row.message_content))
  if (!message) {
    await c.env.DB.prepare("UPDATE broadcasts SET status = 'failed' WHERE id = ?").bind(id).run()
    return c.json({ error: '找不到對應的進階訊息素材，請確認素材是否已被刪除' }, 400)
  }

  try {
    let recipientCount = 0
    if (row.target_type === 'all') {
      await line.broadcastToAll([message])
      const countRow = await c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM line_users WHERE is_blocked = 0'
      ).first<{ count: number }>()
      recipientCount = countRow?.count ?? 0
    } else if (row.target_type === 'audience') {
      if (!row.target_audience_id) throw new Error('未選擇目標群眾')
      const audience = await c.env.DB.prepare('SELECT tag_ids, match_type FROM audiences WHERE id = ?')
        .bind(row.target_audience_id)
        .first<{ tag_ids: string; match_type: 'any' | 'all' }>()
      if (!audience) throw new Error('找不到目標群眾，可能已被刪除')
      const tagIds = JSON.parse(audience.tag_ids) as number[]
      const userIds = await resolveTagUserIds(c.env, tagIds, audience.match_type)
      for (const batch of chunk(userIds, 500)) {
        await line.multicast(batch, [message])
      }
      recipientCount = userIds.length
    } else {
      const tagIds = row.target_tag_ids ? (JSON.parse(row.target_tag_ids) as number[]) : []
      if (!tagIds.length) throw new Error('未選擇目標標籤')
      const userIds = await resolveTagUserIds(c.env, tagIds, 'any')
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
    return c.json({ error: `發送失敗：${describeLineError(err)}` }, 502)
  }
})

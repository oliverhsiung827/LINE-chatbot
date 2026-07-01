import type { Env } from '../lib/env'
import { verifyLineSignature } from '../lib/crypto'
import { createLineClient, type LineMessage, type LineWebhookEvent } from '../lib/line'
import { buildLineMessage, type RichMessageRow } from '../lib/richMessage'
import { applyTag, decodePostbackData } from '../lib/clickTracking'

interface KeywordRuleRow {
  id: number
  match_type: 'exact' | 'contains' | 'regex'
  keywords: string
  reply_type: 'text' | 'image' | 'flex' | 'sticker' | 'imagemap'
  reply_content: string
  tag_id: number | null
}

function matchesRule(text: string, rule: KeywordRuleRow): boolean {
  const keywords = JSON.parse(rule.keywords) as string[]
  if (rule.match_type === 'exact') return keywords.some((k) => text === k)
  if (rule.match_type === 'contains') return keywords.some((k) => text.includes(k))
  if (rule.match_type === 'regex') {
    return keywords.some((pattern) => {
      try {
        return new RegExp(pattern).test(text)
      } catch {
        return false
      }
    })
  }
  return false
}

async function ruleToLineMessage(env: Env, origin: string, rule: KeywordRuleRow): Promise<LineMessage | null> {
  const content = JSON.parse(rule.reply_content) as Record<string, unknown>
  if (rule.reply_type === 'text') return { type: 'text', text: content.text as string }
  if (rule.reply_type === 'image')
    return {
      type: 'image',
      originalContentUrl: content.originalContentUrl as string,
      previewImageUrl: content.previewImageUrl as string,
    }
  if (rule.reply_type === 'flex' || rule.reply_type === 'imagemap') {
    const richMessageId = content.rich_message_id as string | undefined
    if (!richMessageId) return null
    const row = await env.DB.prepare('SELECT id, type, content FROM rich_messages WHERE id = ?')
      .bind(richMessageId)
      .first<RichMessageRow>()
    if (!row) return null
    return buildLineMessage(env, row, origin)
  }
  return { type: 'sticker', packageId: content.packageId as string, stickerId: content.stickerId as string }
}

async function upsertFollower(env: Env, userId: string) {
  const line = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN)
  const profile = await line.getProfile(userId).catch(() => null)
  await env.DB.prepare(
    `INSERT INTO line_users (id, display_name, picture_url, status_message, followed_at, unfollowed_at, is_blocked, last_interaction_at)
     VALUES (?, ?, ?, ?, datetime('now'), NULL, 0, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       display_name = excluded.display_name,
       picture_url = excluded.picture_url,
       status_message = excluded.status_message,
       followed_at = datetime('now'),
       unfollowed_at = NULL,
       is_blocked = 0,
       last_interaction_at = datetime('now')`
  )
    .bind(userId, profile?.displayName ?? null, profile?.pictureUrl ?? null, profile?.statusMessage ?? null)
    .run()
}

async function markUnfollowed(env: Env, userId: string) {
  await env.DB.prepare(
    "UPDATE line_users SET is_blocked = 1, unfollowed_at = datetime('now') WHERE id = ?"
  )
    .bind(userId)
    .run()
}

async function touchLastInteraction(env: Env, userId: string) {
  await env.DB.prepare(
    `INSERT INTO line_users (id, followed_at, last_interaction_at) VALUES (?, datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET last_interaction_at = datetime('now')`
  )
    .bind(userId)
    .run()
}

async function logMessage(env: Env, userId: string, direction: 'inbound' | 'outbound', type: string, content: string) {
  await env.DB.prepare('INSERT INTO message_logs (user_id, direction, message_type, content) VALUES (?, ?, ?, ?)')
    .bind(userId, direction, type, content)
    .run()
}

async function handleEvent(env: Env, origin: string, event: LineWebhookEvent) {
  const userId = event.source.userId
  if (!userId) return

  if (event.type === 'follow') {
    await upsertFollower(env, userId)
    return
  }

  if (event.type === 'unfollow') {
    await markUnfollowed(env, userId)
    return
  }

  if (event.type === 'message' && event.message?.type === 'text' && event.replyToken) {
    const text = event.message.text ?? ''
    await Promise.all([touchLastInteraction(env, userId), logMessage(env, userId, 'inbound', 'text', text)])

    const rules = await env.DB.prepare(
      `SELECT id, match_type, keywords, reply_type, reply_content, tag_id FROM keyword_rules
       WHERE is_active = 1
         AND (start_at IS NULL OR start_at <= datetime('now'))
         AND (end_at IS NULL OR end_at >= datetime('now'))
       ORDER BY priority DESC, id ASC`
    ).all<KeywordRuleRow>()

    const matched = rules.results.find((rule) => matchesRule(text, rule))
    if (matched) {
      if (matched.tag_id) await applyTag(env, userId, matched.tag_id)
      const message = await ruleToLineMessage(env, origin, matched)
      if (message) {
        const line = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN)
        await line.replyMessage(event.replyToken, [message])
        await logMessage(env, userId, 'outbound', matched.reply_type, JSON.stringify(message))
      }
    }
    return
  }

  if (event.type === 'postback') {
    await touchLastInteraction(env, userId)
    const { tagId } = decodePostbackData(event.postback?.data ?? '')
    if (tagId) await applyTag(env, userId, tagId)
    return
  }

  // 其他事件類型（image、sticker...）僅記錄互動時間，供未來擴充使用
  await touchLastInteraction(env, userId)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const signature = request.headers.get('x-line-signature')
  const rawBody = await request.text()

  if (!signature || !(await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET))) {
    return new Response('Invalid signature', { status: 401 })
  }

  const origin = new URL(request.url).origin
  const body = JSON.parse(rawBody) as { events: LineWebhookEvent[] }
  await Promise.all(body.events.map((event) => handleEvent(env, origin, event)))

  return new Response('OK', { status: 200 })
}

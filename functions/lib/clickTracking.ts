import type { Env } from './env'
import { newId } from './crypto'

// 「開啟連結」按鈕若設定了標籤，會把真正的網址存進 click_targets，
// 送給 LINE 的網址則改成我們自己的 LIFF 轉址頁，點擊當下才能辨識使用者並貼標籤。
// 之後編輯同一個按鈕時沿用同一筆 click_targets（同一個 token），LIFF 連結才不會一直變動。
export async function upsertClickTarget(
  env: Env,
  existingId: string | undefined,
  targetUrl: string,
  tagId: number | undefined,
  label: string | undefined
): Promise<string> {
  if (existingId) {
    await env.DB.prepare('UPDATE click_targets SET target_url = ?, tag_id = ?, label = ? WHERE id = ?')
      .bind(targetUrl, tagId ?? null, label ?? null, existingId)
      .run()
    return existingId
  }
  const id = newId()
  await env.DB.prepare('INSERT INTO click_targets (id, target_url, tag_id, label) VALUES (?, ?, ?, ?)')
    .bind(id, targetUrl, tagId ?? null, label ?? null)
    .run()
  return id
}

export function liffUrl(env: Env, clickTargetId: string): string | null {
  if (!env.LIFF_ID) return null
  return `https://liff.line.me/${env.LIFF_ID}?t=${clickTargetId}`
}

interface TrackableUriAction {
  type: string
  uri?: string
  label?: string
  tag_id?: number
  click_target_id?: string
}

// 存檔時呼叫：如果是有設定標籤的「開啟連結」動作，建立/更新對應的 click_targets 紀錄
export async function materializeUriAction<T extends TrackableUriAction>(env: Env, action: T): Promise<T> {
  if (action.type !== 'uri' || !action.tag_id || !action.uri) return action
  const clickTargetId = await upsertClickTarget(env, action.click_target_id, action.uri, action.tag_id, action.label)
  return { ...action, click_target_id: clickTargetId }
}

// 實際送給 LINE 前呼叫：把有追蹤的「開啟連結」動作換成 LIFF 轉址網址
export function resolveUriForSend(env: Env, action: TrackableUriAction): string | undefined {
  if (action.type === 'uri' && action.click_target_id) {
    const url = liffUrl(env, action.click_target_id)
    if (url) return url
  }
  return action.uri
}

// postback 的 data 欄位若設定了標籤，編碼成同時帶有原始 data 與標籤 id 的格式，
// 存檔時仍保留使用者原本輸入的 data + tag_id（方便之後編輯），只在送出前才編碼
export function encodePostbackData(rawData: string, tagId?: number): string {
  if (!tagId) return rawData
  const params = new URLSearchParams()
  params.set('__d', rawData)
  params.set('__tag', String(tagId))
  return params.toString()
}

export function decodePostbackData(data: string): { data: string; tagId: number | null } {
  if (!data.includes('__tag=')) return { data, tagId: null }
  const params = new URLSearchParams(data)
  const tag = params.get('__tag')
  return { data: params.get('__d') ?? data, tagId: tag ? Number(tag) : null }
}

export async function applyTag(env: Env, userId: string, tagId: number) {
  await env.DB.prepare('INSERT OR IGNORE INTO member_tags (user_id, tag_id) VALUES (?, ?)').bind(userId, tagId).run()
}

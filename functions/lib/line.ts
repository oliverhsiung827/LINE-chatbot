// LINE Messaging API 客戶端 — 直接以 fetch 呼叫，避免使用 Node.js 專屬 SDK（Workers 邊緣執行環境相容性考量）

const API_BASE = 'https://api.line.me/v2/bot'
const DATA_API_BASE = 'https://api-data.line.me/v2/bot'

export type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'image'; originalContentUrl: string; previewImageUrl: string }
  | { type: 'sticker'; packageId: string; stickerId: string }
  | { type: 'flex'; altText: string; contents: unknown }

export interface LineProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

export interface LineWebhookEvent {
  type: string
  timestamp: number
  source: { type: string; userId?: string }
  replyToken?: string
  message?: { id: string; type: string; text?: string }
  postback?: { data: string }
}

class LineApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`LINE API error ${status}: ${body}`)
  }
}

async function callLineApi(token: string, path: string, init: RequestInit, base = API_BASE) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new LineApiError(res.status, body)
  }
  return res
}

export function createLineClient(channelAccessToken: string) {
  return {
    async replyMessage(replyToken: string, messages: LineMessage[]) {
      await callLineApi(channelAccessToken, '/message/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyToken, messages }),
      })
    },

    async pushMessage(to: string, messages: LineMessage[]) {
      await callLineApi(channelAccessToken, '/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, messages }),
      })
    },

    async multicast(to: string[], messages: LineMessage[]) {
      await callLineApi(channelAccessToken, '/message/multicast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, messages }),
      })
    },

    async broadcastToAll(messages: LineMessage[]) {
      await callLineApi(channelAccessToken, '/message/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
    },

    async getProfile(userId: string): Promise<LineProfile> {
      const res = await callLineApi(channelAccessToken, `/profile/${userId}`, { method: 'GET' })
      return res.json()
    },

    async createRichMenu(menu: {
      size: { width: number; height: number }
      selected: boolean
      name: string
      chatBarText: string
      areas: unknown[]
    }): Promise<{ richMenuId: string }> {
      const res = await callLineApi(channelAccessToken, '/richmenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menu),
      })
      return res.json()
    },

    async uploadRichMenuImage(richMenuId: string, image: ArrayBuffer, contentType: string) {
      await callLineApi(
        channelAccessToken,
        `/richmenu/${richMenuId}/content`,
        { method: 'POST', headers: { 'Content-Type': contentType }, body: image },
        DATA_API_BASE
      )
    },

    async setDefaultRichMenu(richMenuId: string) {
      await callLineApi(channelAccessToken, `/user/all/richmenu/${richMenuId}`, { method: 'POST' })
    },

    async deleteRichMenu(richMenuId: string) {
      await callLineApi(channelAccessToken, `/richmenu/${richMenuId}`, { method: 'DELETE' })
    },

    async linkRichMenuToUser(userId: string, richMenuId: string) {
      await callLineApi(channelAccessToken, `/user/${userId}/richmenu/${richMenuId}`, { method: 'POST' })
    },
  }
}

export type LineClient = ReturnType<typeof createLineClient>

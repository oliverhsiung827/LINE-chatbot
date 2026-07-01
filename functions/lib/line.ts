// LINE Messaging API 客戶端 — 直接以 fetch 呼叫，避免使用 Node.js 專屬 SDK（Workers 邊緣執行環境相容性考量）

const API_BASE = 'https://api.line.me/v2/bot'
const DATA_API_BASE = 'https://api-data.line.me/v2/bot'

type ImagemapBounds = { x: number; y: number; width: number; height: number }

export type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'image'; originalContentUrl: string; previewImageUrl: string }
  | { type: 'sticker'; packageId: string; stickerId: string }
  | { type: 'flex'; altText: string; contents: unknown }
  | {
      type: 'imagemap'
      baseUrl: string
      altText: string
      baseSize: { width: number; height: number }
      video?: {
        originalContentUrl: string
        previewImageUrl: string
        area: ImagemapBounds
        externalLink?: { linkUri: string; label: string }
      }
      actions: Array<
        | { type: 'uri'; linkUri: string; area: ImagemapBounds; label?: string }
        | { type: 'message'; text: string; area: ImagemapBounds; label?: string }
      >
    }

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

export class LineApiError extends Error {
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

    // Rich Menu Alias：用來讓「切換頁面」按鈕(richmenuswitch)有一個穩定不變的目標 ID，
    // 這樣即使選單重新發佈（LINE richMenuId 會變），其他選單的切換按鈕也不用跟著改。
    async createRichMenuAlias(richMenuAliasId: string, richMenuId: string) {
      await callLineApi(channelAccessToken, '/richmenu/alias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ richMenuId, richMenuAliasId }),
      })
    },

    async updateRichMenuAlias(richMenuAliasId: string, richMenuId: string) {
      await callLineApi(channelAccessToken, `/richmenu/alias/${richMenuAliasId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ richMenuId }),
      })
    },

    async upsertRichMenuAlias(richMenuAliasId: string, richMenuId: string) {
      try {
        await this.createRichMenuAlias(richMenuAliasId, richMenuId)
      } catch (err) {
        if (err instanceof LineApiError && err.status === 400) {
          await this.updateRichMenuAlias(richMenuAliasId, richMenuId)
        } else {
          throw err
        }
      }
    },
  }
}

export type LineClient = ReturnType<typeof createLineClient>

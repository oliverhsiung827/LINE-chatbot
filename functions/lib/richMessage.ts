import type { Env } from './env'
import type { LineMessage } from './line'
import type { FlexCarouselContent, ImagemapContent } from '../../shared/types'
import { encodePostbackData, resolveUriForSend } from './clickTracking'

export interface RichMessageRow {
  id: string
  type: string
  content: string
}

// 把「進階訊息素材庫」裡建好的內容，轉換成實際送給 LINE 的訊息物件。
// origin 為目前部署的網域（例如 https://xxx.pages.dev），用來組出 LINE 伺服器可直接拜訪的公開素材網址。
export function buildLineMessage(env: Env, row: RichMessageRow, origin: string): LineMessage {
  if (row.type === 'imagemap') {
    const c = JSON.parse(row.content) as ImagemapContent
    const message: LineMessage = {
      type: 'imagemap',
      baseUrl: `${origin}/api/rm-assets/${row.id}/imagemap`,
      altText: c.altText,
      baseSize: c.baseSize,
      actions: c.actions.map((a) =>
        a.type === 'uri'
          ? { type: 'uri', linkUri: resolveUriForSend(env, a) ?? '', area: a.area, ...(a.label ? { label: a.label } : {}) }
          : { type: 'message', text: a.text ?? '', area: a.area, ...(a.label ? { label: a.label } : {}) }
      ),
    }
    if (c.video?.video_key) {
      message.video = {
        originalContentUrl: `${origin}/api/rm-assets/${row.id}/video`,
        previewImageUrl: `${origin}/api/rm-assets/${row.id}/video-preview`,
        area: c.video.area,
        ...(c.video.external_link ? { externalLink: c.video.external_link } : {}),
      }
    }
    return message
  }

  const c = JSON.parse(row.content) as FlexCarouselContent
  const bubbles = c.cards.map((card, i) => ({
    type: 'bubble',
    ...(card.image_key
      ? { hero: { type: 'image', url: `${origin}/api/rm-assets/${row.id}/carousel/${i}`, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } }
      : {}),
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: card.title || ' ', weight: 'bold', size: 'lg', wrap: true },
        ...(card.text ? [{ type: 'text', text: card.text, size: 'sm', color: '#666666', wrap: true, margin: 'md' }] : []),
      ],
    },
    ...(card.buttons.length
      ? {
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: card.buttons.map((b) => ({
              type: 'button',
              style: 'primary',
              height: 'sm',
              action:
                b.action.type === 'uri'
                  ? { type: 'uri', label: b.label, uri: resolveUriForSend(env, b.action) ?? '' }
                  : b.action.type === 'message'
                    ? { type: 'message', label: b.label, text: b.action.text }
                    : { type: 'postback', label: b.label, data: encodePostbackData(b.action.data, b.action.tag_id) },
            })),
          },
        }
      : {}),
  }))

  return { type: 'flex', altText: c.altText || '多頁訊息', contents: { type: 'carousel', contents: bubbles } }
}

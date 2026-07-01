import { Hono } from 'hono'
import type { Env } from '../../lib/env'

// 這裡的路由不需要登入驗證 —— LINE 的伺服器會直接對這些網址發送請求來抓取圖片/影片，
// 所以必須是公開可存取的（跟其他 /api/* 後台管理路由不同）。
export const richMessageAssetRoutes = new Hono<{ Bindings: Env }>()

// 影片需要支援 HTTP Range request（分段讀取），LINE 客戶端播放影片時會用 Range 拉取內容，
// 若伺服器只會整包回傳，LINE 會顯示「讀取影片失敗」。
async function serveAsset(request: Request, env: Env, key: string) {
  const rangeHeader = request.headers.get('range')
  const object = await env.MEDIA.get(key, rangeHeader ? { range: request.headers } : undefined)
  if (!object) return new Response('Not Found', { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  if (!headers.get('Content-Type')) headers.set('Content-Type', 'application/octet-stream')

  const body = request.method === 'HEAD' ? null : object.body

  const range = object.range as { offset: number; length: number } | undefined
  if (rangeHeader && range) {
    headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`)
    headers.set('Content-Length', String(range.length))
    return new Response(body, { status: 206, headers })
  }

  headers.set('Content-Length', String(object.size))
  return new Response(body, { status: 200, headers })
}

// LINE 的 imagemap 訊息會對 baseUrl 附加 /240、/300、/460、/700、/1040 等不同寬度來拉取圖片，
// 這裡不做真正的多尺寸縮放，統一回傳同一張原圖（LINE 客戶端會自行縮放顯示）。
// 同時支援 HEAD，因為部分影片播放器會先用 HEAD 檢查 Accept-Ranges/Content-Length 再用 GET+Range 拉取內容。
richMessageAssetRoutes.on(['GET', 'HEAD'], '/:id/imagemap/:width', async (c) => {
  return serveAsset(c.req.raw, c.env, `rich-message/${c.req.param('id')}/base`)
})

richMessageAssetRoutes.on(['GET', 'HEAD'], '/:id/video', async (c) => {
  return serveAsset(c.req.raw, c.env, `rich-message/${c.req.param('id')}/video`)
})

richMessageAssetRoutes.on(['GET', 'HEAD'], '/:id/video-preview', async (c) => {
  return serveAsset(c.req.raw, c.env, `rich-message/${c.req.param('id')}/video-preview`)
})

richMessageAssetRoutes.on(['GET', 'HEAD'], '/:id/carousel/:index', async (c) => {
  return serveAsset(c.req.raw, c.env, `rich-message/${c.req.param('id')}/card-${c.req.param('index')}`)
})

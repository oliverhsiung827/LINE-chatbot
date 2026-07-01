import { Hono } from 'hono'
import type { Env } from '../../lib/env'

// 這裡的路由不需要登入驗證 —— LINE 的伺服器會直接對這些網址發送請求來抓取圖片/影片，
// 所以必須是公開可存取的（跟其他 /api/* 後台管理路由不同）。
export const richMessageAssetRoutes = new Hono<{ Bindings: Env }>()

async function serveAsset(env: Env, key: string) {
  const object = await env.MEDIA.get(key)
  if (!object) return new Response('Not Found', { status: 404 })
  return new Response(object.body, {
    headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream' },
  })
}

// LINE 的 imagemap 訊息會對 baseUrl 附加 /240、/300、/460、/700、/1040 等不同寬度來拉取圖片，
// 這裡不做真正的多尺寸縮放，統一回傳同一張原圖（LINE 客戶端會自行縮放顯示）。
richMessageAssetRoutes.get('/:id/imagemap/:width', async (c) => {
  return serveAsset(c.env, `rich-message/${c.req.param('id')}/base`)
})

richMessageAssetRoutes.get('/:id/video', async (c) => {
  return serveAsset(c.env, `rich-message/${c.req.param('id')}/video`)
})

richMessageAssetRoutes.get('/:id/video-preview', async (c) => {
  return serveAsset(c.env, `rich-message/${c.req.param('id')}/video-preview`)
})

richMessageAssetRoutes.get('/:id/carousel/:index', async (c) => {
  return serveAsset(c.env, `rich-message/${c.req.param('id')}/card-${c.req.param('index')}`)
})

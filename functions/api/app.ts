import { Hono } from 'hono'
import type { Env } from '../lib/env'
import type { AuthVariables } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { memberRoutes } from './routes/members'
import { tagRoutes } from './routes/tags'
import { keywordRoutes } from './routes/keywords'
import { richMenuRoutes } from './routes/richmenus'
import { broadcastRoutes } from './routes/broadcasts'
import { dashboardRoutes } from './routes/dashboard'
import { richMessageRoutes } from './routes/richMessages'
import { richMessageAssetRoutes } from './routes/richMessageAssets'
import { clickTargetRoutes } from './routes/clickTargets'
import { joinLinkRoutes } from './routes/joinLinks'
import { audienceRoutes } from './routes/audiences'
import { createLineClient } from '../lib/line'

export const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>().basePath('/api')

app.route('/auth', authRoutes)
app.route('/members', memberRoutes)
app.route('/tags', tagRoutes)
app.route('/keywords', keywordRoutes)
app.route('/rich-menus', richMenuRoutes)
app.route('/broadcasts', broadcastRoutes)
app.route('/dashboard', dashboardRoutes)
app.route('/rich-messages', richMessageRoutes)
app.route('/rm-assets', richMessageAssetRoutes)
app.route('/click-targets', clickTargetRoutes)
app.route('/join-links', joinLinkRoutes)
app.route('/audiences', audienceRoutes)

app.get('/liff-config', async (c) => {
  const line = createLineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN)
  const botInfo = await line.getBotInfo().catch(() => null)
  return c.json({ liffId: c.env.LIFF_ID ?? null, basicId: botInfo?.basicId ?? null })
})

app.notFound((c) => c.json({ error: 'Not Found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: '伺服器發生錯誤' }, 500)
})

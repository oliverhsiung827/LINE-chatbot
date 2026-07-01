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

app.notFound((c) => c.json({ error: 'Not Found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: '伺服器發生錯誤' }, 500)
})

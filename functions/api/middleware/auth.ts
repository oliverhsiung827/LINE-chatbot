import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Env } from '../../lib/env'
import { verifyJwt, type JwtPayload } from '../../lib/crypto'

export const AUTH_COOKIE = 'lc_session'

export interface AuthVariables {
  admin: JwtPayload
}

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  const token = getCookie(c, AUTH_COOKIE)
  if (!token) return c.json({ error: '未登入' }, 401)
  const payload = await verifyJwt(token, c.env.JWT_SECRET)
  if (!payload) return c.json({ error: '登入已過期，請重新登入' }, 401)
  c.set('admin', payload)
  await next()
}

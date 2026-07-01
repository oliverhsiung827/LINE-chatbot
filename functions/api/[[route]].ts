import type { Env } from '../lib/env'
import { app } from './app'

export const onRequest: PagesFunction<Env> = (context) => {
  return app.fetch(context.request, context.env, context as unknown as ExecutionContext)
}

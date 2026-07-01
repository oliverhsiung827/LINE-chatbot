export interface Env {
  DB: D1Database
  MEDIA: R2Bucket
  LINE_CHANNEL_ACCESS_TOKEN: string
  LINE_CHANNEL_SECRET: string
  JWT_SECRET: string
  ADMIN_INIT_EMAIL?: string
  ADMIN_INIT_PASSWORD?: string
}

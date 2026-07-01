export interface Env {
  DB: D1Database
  MEDIA: R2Bucket
  LINE_CHANNEL_ACCESS_TOKEN: string
  LINE_CHANNEL_SECRET: string
  JWT_SECRET: string
  ADMIN_INIT_EMAIL?: string
  ADMIN_INIT_PASSWORD?: string
  // 點擊追蹤（開啟連結類型按鈕的自動貼標籤）用。
  // LINE 已不允許在 Messaging API channel 底下建立 LIFF App，須另外建立一個「LINE Login channel」
  // （跟 Messaging API channel 同一個 Provider 底下）來掛 LIFF App。
  // LIFF_CHANNEL_ID 是那個 LINE Login channel 的 Channel ID，不是 Messaging API 的。
  // 只要兩個 channel 同一個 Provider，LIFF 取得的 userId 就會跟 Messaging API 的 userId 一致。
  LIFF_ID?: string
  LIFF_CHANNEL_ID?: string
  // 定時 Worker 呼叫 /api/broadcasts/process-scheduled 用的共用密鑰
  INTERNAL_CRON_SECRET?: string
}

export interface Env {
  DB: D1Database
  MEDIA: R2Bucket
  LINE_CHANNEL_ACCESS_TOKEN: string
  LINE_CHANNEL_SECRET: string
  JWT_SECRET: string
  ADMIN_INIT_EMAIL?: string
  ADMIN_INIT_PASSWORD?: string
  // 點擊追蹤（開啟連結類型按鈕的自動貼標籤）用，須在 LINE Developers Console 建立 LIFF App 後取得
  LIFF_ID?: string
  LINE_CHANNEL_ID?: string
}

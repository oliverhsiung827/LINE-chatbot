// 後台所有時間輸入/顯示一律以台灣時間（UTC+8）為準，資料庫內部仍統一存 UTC。
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000

function toUtcMs(value: string): number {
  // 兼容 SQLite 的 "YYYY-MM-DD HH:MM:SS"（視為 UTC）與 ISO 字串
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withZone = /Z$|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}Z`
  return Date.parse(withZone)
}

// 顯示用：把後端回傳的 UTC 時間字串轉成台灣時間的可讀格式
export function formatTaipei(value: string | null | undefined, withTime = true): string {
  if (!value) return '-'
  const ms = toUtcMs(value)
  if (Number.isNaN(ms)) return value
  const d = new Date(ms + TAIPEI_OFFSET_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`
  if (!withTime) return date
  return `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

// <input type="datetime-local"> 的值本身沒有時區資訊；一律當作使用者輸入的是台灣時間，
// 轉換成 UTC 字串存到後端。格式刻意對齊 SQLite 的 datetime('now')（"YYYY-MM-DD HH:MM:SS"），
// 這樣後端可以直接用字串比較大小，不用擔心 ISO 格式（含 T/Z/毫秒）跟 SQLite 格式混用導致比較錯誤
export function taipeiInputToUtcSql(localValue: string): string | null {
  if (!localValue) return null
  const ms = Date.parse(`${localValue}:00Z`) - TAIPEI_OFFSET_MS
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

// 後端 UTC 時間字串 → <input type="datetime-local"> 需要的台灣時間字串
export function utcToTaipeiInput(value: string | null | undefined): string {
  if (!value) return ''
  const ms = toUtcMs(value)
  if (Number.isNaN(ms)) return ''
  const d = new Date(ms + TAIPEI_OFFSET_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

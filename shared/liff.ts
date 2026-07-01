// 建立 LIFF 啟動網址。一般在網址後面直接加 ?key=value 的參數，
// 在使用者「尚未加好友、需要先跳出加好友確認畫面」的流程中會被 LINE 弄丟，
// 所以一律改用 LINE 官方文件建議的 liff.state 包裝方式，確保參數在整個流程中不會遺失。
export function buildLiffUrl(liffId: string, query: Record<string, string>): string {
  const qs = new URLSearchParams(query).toString()
  const state = encodeURIComponent(`?${qs}`)
  return `https://liff.line.me/${liffId}?liff.state=${state}`
}

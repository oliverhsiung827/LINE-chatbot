// 驗證 LIFF 前端傳回的 ID Token，確認真的是 LINE 本人送出的請求，
// 避免有心人直接呼叫追蹤 API、偽造任意 userId 來亂貼標籤
export async function verifyLineIdToken(idToken: string, channelId: string): Promise<{ userId: string } | null> {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { sub?: string; aud?: string }
  if (!data.sub || data.aud !== channelId) return null
  return { userId: data.sub }
}

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../lib/api'
import type { JoinLink, Tag } from '../../shared/types'
import { buildLiffUrl } from '../../shared/liff'

export default function JoinLinks() {
  const [links, setLinks] = useState<JoinLink[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [liffId, setLiffId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [tagId, setTagId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})

  async function load() {
    setLinks(await api.get<JoinLink[]>('/join-links'))
  }

  useEffect(() => {
    load()
    api.get<Tag[]>('/tags').then(setTags)
    api.get<{ liffId: string | null }>('/liff-config').then((c) => setLiffId(c.liffId))
  }, [])

  function urlFor(link: JoinLink) {
    if (!liffId) return null
    return buildLiffUrl(liffId, { j: link.id })
  }

  useEffect(() => {
    if (!liffId) return
    links.forEach((link) => {
      const url = urlFor(link)
      if (url && !qrCodes[link.id]) {
        QRCode.toDataURL(url, { width: 300, margin: 1 }).then((dataUrl) => {
          setQrCodes((prev) => ({ ...prev, [link.id]: dataUrl }))
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, liffId])

  async function createLink() {
    setError(null)
    if (!name.trim()) {
      setError('請輸入名稱')
      return
    }
    try {
      await api.post('/join-links', { name: name.trim(), tag_id: tagId ? Number(tagId) : null })
      setName('')
      setTagId('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗')
    }
  }

  async function removeLink(id: string) {
    if (!confirm('確定要刪除此連結嗎？刪除後這組網址與 QR code 就會失效。')) return
    await api.delete(`/join-links/${id}`)
    load()
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url)
  }

  return (
    <div>
      <h2 className="mb-2 text-xl font-bold text-slate-800">會員來源追蹤</h2>
      <p className="mb-6 text-sm text-slate-500">
        為不同的推廣管道（例如 IG 貼文、店面海報、活動看板）各自產生一組專屬網址與 QR code，透過這組連結加入好友的使用者會自動被貼上指定標籤，方便追蹤各管道成效並做分眾行銷。
      </p>

      {!liffId && (
        <p className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">
          尚未設定 LIFF App，這個功能需要先完成 LIFF 設定才能產生連結與 QR code。
        </p>
      )}

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mb-6 flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-slate-600">名稱（例如：IG 貼文）</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createLink()}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-slate-600">自動貼上標籤（選填）</span>
          <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5">
            <option value="">不貼標籤</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button onClick={createLink} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700">
          建立連結
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {links.map((link) => {
          const url = urlFor(link)
          return (
            <div key={link.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold text-slate-800">{link.name}</h4>
                <button onClick={() => removeLink(link.id)} className="text-xs text-red-500 hover:underline">
                  刪除
                </button>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                標籤：{link.tag_name ?? '無'} · 已加入 {link.join_count} 人
              </p>
              {qrCodes[link.id] ? (
                <img src={qrCodes[link.id]} className="mb-3 h-40 w-40 rounded border border-slate-100" />
              ) : (
                <div className="mb-3 flex h-40 w-40 items-center justify-center rounded border border-slate-100 bg-slate-50 text-xs text-slate-400">
                  {liffId ? '產生中...' : '尚未設定 LIFF'}
                </div>
              )}
              {url && (
                <div className="space-y-2 text-xs">
                  <input readOnly value={url} className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-500" />
                  <div className="flex gap-2">
                    <button onClick={() => copyUrl(url)} className="flex-1 rounded border border-slate-300 py-1 hover:bg-slate-50">
                      複製連結
                    </button>
                    {qrCodes[link.id] && (
                      <a
                        href={qrCodes[link.id]}
                        download={`${link.name}-qrcode.png`}
                        className="flex-1 rounded border border-slate-300 py-1 text-center hover:bg-slate-50"
                      >
                        下載 QR code
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {links.length === 0 && <p className="col-span-3 text-center text-slate-400">尚無追蹤連結，於上方建立第一組</p>}
      </div>
    </div>
  )
}

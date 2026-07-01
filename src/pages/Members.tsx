import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { LineUser, MemberDetail as MemberDetailType, Tag } from '../../shared/types'
import Modal from '../components/Modal'
import { formatTaipei } from '../lib/time'

interface MembersResponse {
  items: LineUser[]
  page: number
  pageSize: number
  total: number
}

export default function Members() {
  const [members, setMembers] = useState<LineUser[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<LineUser | null>(null)

  async function loadTags() {
    setTags(await api.get<Tag[]>('/tags'))
  }

  async function loadMembers() {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (query) params.set('query', query)
    if (tagFilter) params.set('tag', tagFilter)
    const res = await api.get<MembersResponse>(`/members?${params.toString()}`)
    setMembers(res.items)
    setTotal(res.total)
  }

  useEffect(() => {
    loadTags()
  }, [])

  useEffect(() => {
    loadMembers()
  }, [page, tagFilter])

  const totalPages = Math.max(1, Math.ceil(total / 20))

  function handleSearch() {
    if (page !== 1) setPage(1)
    else loadMembers()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">會員管理</h2>
        <Link
          to="/tags"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          管理標籤
        </Link>
      </div>

      <div className="mb-4 flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜尋暱稱..."
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <select
          value={tagFilter}
          onChange={(e) => {
            setPage(1)
            setTagFilter(e.target.value)
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">所有標籤</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button onClick={handleSearch} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700">
          搜尋
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">會員</th>
              <th className="px-4 py-2">標籤</th>
              <th className="px-4 py-2">狀態</th>
              <th className="px-4 py-2">加入時間</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  尚無會員資料
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="flex items-center gap-2 px-4 py-2">
                  {m.picture_url && <img src={m.picture_url} className="h-8 w-8 rounded-full" />}
                  <span>{m.display_name ?? '（未知）'}</span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(m.tags ?? []).map((t) => (
                      <span
                        key={t.id}
                        className="rounded-full px-2 py-0.5 text-xs text-white"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {m.is_blocked ? <span className="text-red-500">已封鎖</span> : <span className="text-emerald-600">正常</span>}
                </td>
                <td className="px-4 py-2 text-slate-500">{formatTaipei(m.followed_at)}</td>
                <td className="px-4 py-2">
                  <button onClick={() => setSelected(m)} className="text-emerald-600 hover:underline">
                    詳情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>共 {total} 位會員</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30">
            上一頁
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30">
            下一頁
          </button>
        </div>
      </div>

      {selected && (
        <MemberDetail
          member={selected}
          allTags={tags}
          onClose={() => setSelected(null)}
          onChanged={() => {
            loadMembers()
          }}
        />
      )}
    </div>
  )
}

function renderMessageContent(m: { direction: string; message_type: string; content: string }): string {
  // inbound 訊息的 content 是純文字；outbound 訊息的 content 是完整 LINE 訊息物件的 JSON
  if (m.direction === 'inbound') return m.content
  try {
    const parsed = JSON.parse(m.content) as { text?: string; altText?: string }
    return parsed.text ?? parsed.altText ?? `[${m.message_type}]`
  } catch {
    return m.content
  }
}

function MemberDetail({
  member,
  allTags,
  onClose,
  onChanged,
}: {
  member: LineUser
  allTags: Tag[]
  onClose: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<MemberDetailType | null>(null)
  const [tags, setTags] = useState<Tag[]>(member.tags ?? [])
  const [addTagId, setAddTagId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthday, setBirthday] = useState('')
  const [notes, setNotes] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoSaved, setInfoSaved] = useState(false)

  useEffect(() => {
    api.get<MemberDetailType>(`/members/${member.id}`).then((d) => {
      setDetail(d)
      setPhone(d.phone ?? '')
      setEmail(d.email ?? '')
      setBirthday(d.birthday ?? '')
      setNotes(d.notes ?? '')
    })
  }, [member.id])

  async function addTag() {
    if (!addTagId) return
    await api.post(`/members/${member.id}/tags`, { tagId: Number(addTagId) })
    const tag = allTags.find((t) => t.id === Number(addTagId))
    if (tag) setTags((prev) => [...prev, tag])
    setAddTagId('')
    onChanged()
  }

  async function removeTag(tagId: number) {
    await api.delete(`/members/${member.id}/tags/${tagId}`)
    setTags((prev) => prev.filter((t) => t.id !== tagId))
    onChanged()
  }

  async function saveInfo() {
    setSavingInfo(true)
    setInfoSaved(false)
    try {
      await api.patch(`/members/${member.id}`, {
        phone: phone || null,
        email: email || null,
        birthday: birthday || null,
        notes: notes || null,
      })
      setInfoSaved(true)
    } finally {
      setSavingInfo(false)
    }
  }

  return (
    <Modal title={member.display_name ?? '會員詳情'} onClose={onClose}>
      <div className="max-h-[75vh] space-y-4 overflow-y-auto text-sm">
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t.id}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
              style={{ backgroundColor: t.color }}
            >
              {t.name}
              <button onClick={() => removeTag(t.id)} className="text-white/80 hover:text-white">
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={addTagId} onChange={(e) => setAddTagId(e.target.value)} className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">選擇標籤加入...</option>
            {allTags
              .filter((t) => !tags.some((mt) => mt.id === t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
          <button onClick={addTag} className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700">
            加入
          </button>
        </div>

        <p className="text-slate-500">LINE User ID：{member.id}</p>
        <p className="text-slate-500">加入時間：{formatTaipei(member.followed_at)}</p>
        <p className="text-slate-500">最後互動：{formatTaipei(member.last_interaction_at)}</p>

        <div className="rounded-md border border-slate-200 p-3">
          <p className="mb-2 text-xs font-medium text-slate-600">個人資訊（手動記錄，LINE 不提供）</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="mb-1 block text-slate-500">電話</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-slate-500">Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-slate-500">生日</span>
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
            </label>
          </div>
          <label className="mt-2 block text-xs">
            <span className="mb-1 block text-slate-500">備註</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded border border-slate-300 px-2 py-1" />
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={saveInfo} disabled={savingInfo} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50">
              {savingInfo ? '儲存中...' : '儲存資料'}
            </button>
            {infoSaved && <span className="text-xs text-emerald-600">已儲存</span>}
          </div>
        </div>

        {detail && detail.join_sources.length > 0 && (
          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-2 text-xs font-medium text-slate-600">來源追蹤</p>
            <ul className="space-y-1 text-xs text-slate-600">
              {detail.join_sources.map((s, i) => (
                <li key={i}>
                  {formatTaipei(s.joined_at)} 透過「{s.name}」加入
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-md border border-slate-200 p-3">
          <p className="mb-2 text-xs font-medium text-slate-600">對話訊息歷史（最近 50 筆）</p>
          {!detail ? (
            <p className="text-xs text-slate-400">載入中...</p>
          ) : detail.recent_messages.length === 0 ? (
            <p className="text-xs text-slate-400">尚無訊息紀錄</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {detail.recent_messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-2 py-1 text-xs ${
                      m.direction === 'outbound' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{renderMessageContent(m)}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{formatTaipei(m.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}


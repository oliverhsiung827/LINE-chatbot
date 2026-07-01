import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { LineUser, Tag } from '../../shared/types'
import Modal from '../components/Modal'

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
  const [showTagManager, setShowTagManager] = useState(false)

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
        <button
          onClick={() => setShowTagManager(true)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          管理標籤
        </button>
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
                <td className="px-4 py-2 text-slate-500">{m.followed_at ?? '-'}</td>
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

      {showTagManager && (
        <TagManager
          tags={tags}
          onClose={() => setShowTagManager(false)}
          onChanged={() => {
            loadTags()
            loadMembers()
          }}
        />
      )}
    </div>
  )
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
  const [tags, setTags] = useState<Tag[]>(member.tags ?? [])
  const [addTagId, setAddTagId] = useState('')

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

  return (
    <Modal title={member.display_name ?? '會員詳情'} onClose={onClose}>
      <div className="space-y-4 text-sm">
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
        <p className="text-slate-500">加入時間：{member.followed_at ?? '-'}</p>
        <p className="text-slate-500">最後互動：{member.last_interaction_at ?? '-'}</p>
      </div>
    </Modal>
  )
}

function TagManager({ tags, onClose, onChanged }: { tags: Tag[]; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6')

  async function createTag() {
    if (!name.trim()) return
    await api.post('/tags', { name: name.trim(), color })
    setName('')
    onChanged()
  }

  async function deleteTag(id: number) {
    if (!confirm('確定要刪除此標籤嗎？')) return
    await api.delete(`/tags/${id}`)
    onChanged()
  }

  return (
    <Modal title="標籤管理" onClose={onClose}>
      <div className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新標籤名稱"
          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 rounded" />
        <button onClick={createTag} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700">
          新增
        </button>
      </div>
      <ul className="space-y-2 text-sm">
        {tags.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
              <span className="text-xs text-slate-400">（{t.member_count ?? 0} 人）</span>
            </span>
            <button onClick={() => deleteTag(t.id)} className="text-red-500 hover:underline">
              刪除
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

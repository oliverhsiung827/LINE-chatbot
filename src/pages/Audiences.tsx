import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Audience, AudienceMatchType, Tag } from '../../shared/types'
import Modal from '../components/Modal'

const MATCH_LABEL: Record<AudienceMatchType, string> = { any: '符合任一標籤即算', all: '需同時符合所有標籤' }

export default function Audiences() {
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [editing, setEditing] = useState<Audience | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setAudiences(await api.get<Audience[]>('/audiences'))
  }

  useEffect(() => {
    load()
    api.get<Tag[]>('/tags').then(setTags)
  }, [])

  async function remove(id: string) {
    if (!confirm('確定要刪除此群眾嗎？使用它的群發訊息設定將需要重新選擇目標。')) return
    await api.delete(`/audiences/${id}`)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">群眾管理</h2>
        <button onClick={() => setEditing('new')} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700">
          新增群眾
        </button>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        把多個標籤組合成一個可重複使用的群發目標，例如「A 標籤或 B 標籤或 C 標籤的人」算同一群眾，之後在「群發訊息」直接選擇這個群眾即可，不用每次重新勾選標籤。
      </p>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {audiences.map((a) => (
          <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="mb-1 font-semibold text-slate-800">{a.name}</h4>
            <p className="mb-2 text-xs text-slate-500">{MATCH_LABEL[a.match_type]} · 約 {a.member_count ?? 0} 人</p>
            <div className="mb-3 flex flex-wrap gap-1">
              {a.tag_ids.map((tagId) => {
                const tag = tags.find((t) => t.id === tagId)
                return tag ? (
                  <span key={tagId} className="rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: tag.color }}>
                    {tag.name}
                  </span>
                ) : null
              })}
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setEditing(a)} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                編輯
              </button>
              <button onClick={() => remove(a.id)} className="rounded border border-red-300 px-2 py-1 text-red-500 hover:bg-red-50">
                刪除
              </button>
            </div>
          </div>
        ))}
        {audiences.length === 0 && <p className="col-span-3 text-center text-slate-400">尚無群眾，點擊右上角新增</p>}
      </div>

      {editing && (
        <AudienceForm
          audience={editing === 'new' ? null : editing}
          tags={tags}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
          onError={setError}
        />
      )}
    </div>
  )
}

function AudienceForm({
  audience,
  tags,
  onClose,
  onSaved,
  onError,
}: {
  audience: Audience | null
  tags: Tag[]
  onClose: () => void
  onSaved: () => void
  onError: (msg: string | null) => void
}) {
  const [name, setName] = useState(audience?.name ?? '')
  const [tagIds, setTagIds] = useState<number[]>(audience?.tag_ids ?? [])
  const [matchType, setMatchType] = useState<AudienceMatchType>(audience?.match_type ?? 'any')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleTag(id: number) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  async function save() {
    setError(null)
    if (!name.trim()) return setError('請輸入群眾名稱')
    if (tagIds.length === 0) return setError('請至少選擇一個標籤')
    setSaving(true)
    try {
      const payload = { name, tag_ids: tagIds, match_type: matchType }
      if (audience) await api.patch(`/audiences/${audience.id}`, payload)
      else await api.post('/audiences', payload)
      onSaved()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '儲存失敗'
      setError(msg)
      onError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={audience ? '編輯群眾' : '新增群眾'} onClose={onClose}>
      <div className="space-y-3 text-sm">
        {error && <p className="rounded bg-red-50 px-3 py-2 text-red-600">{error}</p>}
        <label className="block">
          <span className="mb-1 block text-slate-600">群眾名稱</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">比對方式</span>
          <select value={matchType} onChange={(e) => setMatchType(e.target.value as AudienceMatchType)} className="w-full rounded-md border border-slate-300 px-2 py-1.5">
            <option value="any">符合任一標籤即算（OR）</option>
            <option value="all">需同時符合所有標籤（AND）</option>
          </select>
        </label>
        <div>
          <span className="mb-1 block text-slate-600">選擇標籤</span>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTag(t.id)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  tagIds.includes(t.id) ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600'
                }`}
              >
                {t.name}
              </button>
            ))}
            {tags.length === 0 && <p className="text-xs text-slate-400">尚無標籤，請先至「標籤管理」建立</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600">
            取消
          </button>
          <button onClick={save} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

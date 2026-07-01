import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Tag } from '../../shared/types'

export default function Tags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#3B82F6')

  async function load() {
    setTags(await api.get<Tag[]>('/tags'))
  }

  useEffect(() => {
    load()
  }, [])

  async function createTag() {
    setError(null)
    if (!name.trim()) return
    try {
      await api.post('/tags', { name: name.trim(), color })
      setName('')
      setColor('#3B82F6')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失敗')
    }
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
  }

  async function saveEdit(id: number) {
    setError(null)
    if (!editName.trim()) return
    try {
      await api.patch(`/tags/${id}`, { name: editName.trim(), color: editColor })
      setEditingId(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失敗')
    }
  }

  async function deleteTag(id: number) {
    if (!confirm('確定要刪除此標籤嗎？已貼在會員身上的這個標籤也會一併移除。')) return
    await api.delete(`/tags/${id}`)
    load()
  }

  return (
    <div>
      <h2 className="mb-2 text-xl font-bold text-slate-800">標籤管理</h2>
      <p className="mb-6 text-sm text-slate-500">
        標籤可用於會員分眾、群發訊息的目標對象，也能設定在圖文選單／訊息按鈕與關鍵字自動回覆上，點擊或命中時自動貼標。
      </p>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mb-6 flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-slate-600">新標籤名稱</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTag()}
            placeholder="例如：VIP、已點擊活動連結"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">顏色</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 rounded" />
        </label>
        <button onClick={createTag} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700">
          新增標籤
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">標籤</th>
              <th className="px-4 py-2">會員人數</th>
              <th className="px-4 py-2">建立時間</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {tags.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  尚無標籤，於上方建立第一個標籤
                </td>
              </tr>
            )}
            {tags.map((t) =>
              editingId === t.id ? (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-7 w-7 rounded" />
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{t.member_count ?? 0}</td>
                  <td className="px-4 py-2 text-slate-500">{t.created_at}</td>
                  <td className="space-x-3 px-4 py-2">
                    <button onClick={() => saveEdit(t.id)} className="text-emerald-600 hover:underline">
                      儲存
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-slate-500 hover:underline">
                      取消
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{t.member_count ?? 0}</td>
                  <td className="px-4 py-2 text-slate-500">{t.created_at}</td>
                  <td className="space-x-3 px-4 py-2">
                    <button onClick={() => startEdit(t)} className="text-emerald-600 hover:underline">
                      編輯
                    </button>
                    <button onClick={() => deleteTag(t.id)} className="text-red-500 hover:underline">
                      刪除
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

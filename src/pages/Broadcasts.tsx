import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Broadcast, ReplyType, Tag } from '../../shared/types'
import Modal from '../components/Modal'

const STATUS_LABEL: Record<string, string> = { draft: '草稿', scheduled: '排程中', sending: '發送中', sent: '已發送', failed: '失敗' }

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [showForm, setShowForm] = useState(false)

  async function load() {
    const [b, t] = await Promise.all([api.get<Broadcast[]>('/broadcasts'), api.get<Tag[]>('/tags')])
    setBroadcasts(b)
    setTags(t)
  }

  useEffect(() => {
    load()
  }, [])

  async function send(id: number) {
    if (!confirm('確定要立即發送這則群發訊息嗎？發送後無法撤回。')) return
    try {
      await api.post(`/broadcasts/${id}/send`)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : '發送失敗')
    }
  }

  async function remove(id: number) {
    if (!confirm('確定要刪除此草稿嗎？')) return
    await api.delete(`/broadcasts/${id}`)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">群發訊息</h2>
        <button onClick={() => setShowForm(true)} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700">
          新增群發訊息
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">標題</th>
              <th className="px-4 py-2">對象</th>
              <th className="px-4 py-2">狀態</th>
              <th className="px-4 py-2">收件人數</th>
              <th className="px-4 py-2">建立時間</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {broadcasts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  尚無群發訊息
                </td>
              </tr>
            )}
            {broadcasts.map((b) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{b.title}</td>
                <td className="px-4 py-2 text-slate-500">{b.target_type === 'all' ? '所有好友' : `${b.target_tag_ids?.length ?? 0} 個標籤`}</td>
                <td className="px-4 py-2">{STATUS_LABEL[b.status]}</td>
                <td className="px-4 py-2">{b.recipient_count}</td>
                <td className="px-4 py-2 text-slate-500">{b.created_at}</td>
                <td className="space-x-3 px-4 py-2">
                  {b.status === 'draft' && (
                    <>
                      <button onClick={() => send(b.id)} className="text-emerald-600 hover:underline">
                        發送
                      </button>
                      <button onClick={() => remove(b.id)} className="text-red-500 hover:underline">
                        刪除
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <BroadcastForm
          tags={tags}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function BroadcastForm({ tags, onClose, onSaved }: { tags: Tag[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [messageType, setMessageType] = useState<ReplyType>('text')
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [targetType, setTargetType] = useState<'all' | 'tag'>('all')
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function toggleTag(id: number) {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  async function save() {
    setError(null)
    if (!title.trim()) return setError('請輸入標題')
    if (messageType === 'text' && !text.trim()) return setError('請輸入訊息內容')
    if (messageType === 'image' && !imageUrl.trim()) return setError('請輸入圖片網址')
    if (targetType === 'tag' && selectedTags.length === 0) return setError('請選擇至少一個標籤')

    const message_content = messageType === 'text' ? { text } : { originalContentUrl: imageUrl, previewImageUrl: imageUrl }

    setSaving(true)
    try {
      await api.post('/broadcasts', {
        title,
        message_type: messageType,
        message_content,
        target_type: targetType,
        target_tag_ids: targetType === 'tag' ? selectedTags : undefined,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="新增群發訊息" onClose={onClose}>
      <div className="space-y-3 text-sm">
        {error && <p className="rounded bg-red-50 px-3 py-2 text-red-600">{error}</p>}
        <label className="block">
          <span className="mb-1 block text-slate-600">標題（僅內部識別用）</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">訊息類型</span>
          <select value={messageType} onChange={(e) => setMessageType(e.target.value as ReplyType)} className="w-full rounded-md border border-slate-300 px-2 py-1.5">
            <option value="text">文字</option>
            <option value="image">圖片</option>
          </select>
        </label>
        {messageType === 'text' && (
          <label className="block">
            <span className="mb-1 block text-slate-600">訊息內容</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
        )}
        {messageType === 'image' && (
          <label className="block">
            <span className="mb-1 block text-slate-600">圖片網址（https）</span>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-slate-600">發送對象</span>
          <select value={targetType} onChange={(e) => setTargetType(e.target.value as 'all' | 'tag')} className="w-full rounded-md border border-slate-300 px-2 py-1.5">
            <option value="all">所有好友</option>
            <option value="tag">依標籤分眾</option>
          </select>
        </label>
        {targetType === 'tag' && (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTag(t.id)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  selectedTags.includes(t.id) ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600'
                }`}
              >
                {t.name}
              </button>
            ))}
            {tags.length === 0 && <p className="text-xs text-slate-400">尚無標籤，請先至會員管理建立標籤</p>}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600">
            取消
          </button>
          <button onClick={save} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? '建立中...' : '建立草稿'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

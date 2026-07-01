import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { KeywordRule, MatchType, ReplyType, RichMessage, RichMessageRefContent, Tag } from '../../shared/types'
import Modal from '../components/Modal'
import { formatTaipei, taipeiInputToUtcSql, utcToTaipeiInput } from '../lib/time'

const MATCH_LABEL: Record<MatchType, string> = { exact: '完全符合', contains: '包含關鍵字', regex: '正規表示式' }
const REPLY_LABEL: Record<ReplyType, string> = { text: '文字', image: '圖片', imagemap: '圖文／影片訊息', flex: '多頁訊息', sticker: '貼圖' }

export default function Keywords() {
  const [rules, setRules] = useState<KeywordRule[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [editing, setEditing] = useState<KeywordRule | 'new' | null>(null)

  async function load() {
    setRules(await api.get<KeywordRule[]>('/keywords'))
  }

  useEffect(() => {
    load()
    api.get<Tag[]>('/tags').then(setTags)
  }, [])

  async function toggleActive(rule: KeywordRule) {
    await api.patch(`/keywords/${rule.id}`, { is_active: !rule.is_active })
    load()
  }

  async function remove(id: number) {
    if (!confirm('確定要刪除此規則嗎？')) return
    await api.delete(`/keywords/${id}`)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">關鍵字自動回覆</h2>
        <button onClick={() => setEditing('new')} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700">
          新增規則
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">名稱</th>
              <th className="px-4 py-2">比對方式</th>
              <th className="px-4 py-2">關鍵字</th>
              <th className="px-4 py-2">回覆類型</th>
              <th className="px-4 py-2">貼標籤</th>
              <th className="px-4 py-2">生效期間</th>
              <th className="px-4 py-2">狀態</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  尚無自動回覆規則
                </td>
              </tr>
            )}
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2">{MATCH_LABEL[r.match_type]}</td>
                <td className="px-4 py-2 text-slate-500">{r.keywords.join('、')}</td>
                <td className="px-4 py-2">{REPLY_LABEL[r.reply_type]}</td>
                <td className="px-4 py-2 text-slate-500">{tags.find((t) => t.id === r.tag_id)?.name ?? '-'}</td>
                <td className="px-4 py-2 text-slate-500">
                  {r.start_at || r.end_at ? (
                    <>
                      {r.start_at ? formatTaipei(r.start_at) : '不限'} ~ {r.end_at ? formatTaipei(r.end_at) : '不限'}
                    </>
                  ) : (
                    '永久'
                  )}
                </td>
                <td className="px-4 py-2">
                  <button onClick={() => toggleActive(r)} className={r.is_active ? 'text-emerald-600' : 'text-slate-400'}>
                    {r.is_active ? '啟用中' : '已停用'}
                  </button>
                </td>
                <td className="space-x-3 px-4 py-2">
                  <button onClick={() => setEditing(r)} className="text-emerald-600 hover:underline">
                    編輯
                  </button>
                  <button onClick={() => remove(r.id)} className="text-red-500 hover:underline">
                    刪除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <KeywordForm
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function KeywordForm({ rule, onClose, onSaved }: { rule: KeywordRule | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(rule?.name ?? '')
  const [matchType, setMatchType] = useState<MatchType>(rule?.match_type ?? 'contains')
  const [keywords, setKeywords] = useState(rule?.keywords.join(', ') ?? '')
  const [replyType, setReplyType] = useState<ReplyType>(rule?.reply_type ?? 'text')
  const [text, setText] = useState(rule?.reply_type === 'text' ? (rule.reply_content as { text: string }).text : '')
  const [imageUrl, setImageUrl] = useState(
    rule?.reply_type === 'image' ? (rule.reply_content as { originalContentUrl: string }).originalContentUrl : ''
  )
  const [richMessageId, setRichMessageId] = useState(
    rule?.reply_type === 'imagemap' || rule?.reply_type === 'flex' ? (rule.reply_content as RichMessageRefContent).rich_message_id : ''
  )
  const [imagemaps, setImagemaps] = useState<RichMessage[]>([])
  const [carousels, setCarousels] = useState<RichMessage[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tagId, setTagId] = useState(rule?.tag_id ?? '')
  const [priority, setPriority] = useState(rule?.priority ?? 0)
  const [hasSchedule, setHasSchedule] = useState(!!(rule?.start_at || rule?.end_at))
  const [startAt, setStartAt] = useState(utcToTaipeiInput(rule?.start_at))
  const [endAt, setEndAt] = useState(utcToTaipeiInput(rule?.end_at))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<RichMessage[]>('/rich-messages?type=imagemap').then(setImagemaps)
    api.get<RichMessage[]>('/rich-messages?type=flex_carousel').then(setCarousels)
    api.get<Tag[]>('/tags').then(setTags)
  }, [])

  async function save() {
    setError(null)
    const keywordList = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    if (!name.trim() || keywordList.length === 0) {
      setError('請填寫名稱與至少一個關鍵字')
      return
    }
    if ((replyType === 'imagemap' || replyType === 'flex') && !richMessageId) {
      setError('請選擇要發送的素材')
      return
    }
    const start_at = hasSchedule ? taipeiInputToUtcSql(startAt) : null
    const end_at = hasSchedule ? taipeiInputToUtcSql(endAt) : null
    if (hasSchedule && start_at && end_at && start_at >= end_at) {
      setError('生效結束時間必須晚於開始時間')
      return
    }
    let reply_content: unknown
    if (replyType === 'text') reply_content = { text }
    else if (replyType === 'image') reply_content = { originalContentUrl: imageUrl, previewImageUrl: imageUrl }
    else if (replyType === 'imagemap' || replyType === 'flex') reply_content = { rich_message_id: richMessageId }
    else reply_content = { text }

    const payload = {
      name,
      match_type: matchType,
      keywords: keywordList,
      reply_type: replyType,
      reply_content,
      priority,
      tag_id: tagId ? Number(tagId) : null,
      start_at,
      end_at,
    }
    if (rule) await api.patch(`/keywords/${rule.id}`, payload)
    else await api.post('/keywords', payload)
    onSaved()
  }

  return (
    <Modal title={rule ? '編輯規則' : '新增規則'} onClose={onClose}>
      <div className="space-y-3 text-sm">
        {error && <p className="rounded bg-red-50 px-3 py-2 text-red-600">{error}</p>}
        <label className="block">
          <span className="mb-1 block text-slate-600">規則名稱</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">比對方式</span>
          <select value={matchType} onChange={(e) => setMatchType(e.target.value as MatchType)} className="w-full rounded-md border border-slate-300 px-2 py-1.5">
            {Object.entries(MATCH_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">關鍵字（逗號分隔）</span>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">回覆類型</span>
          <select value={replyType} onChange={(e) => setReplyType(e.target.value as ReplyType)} className="w-full rounded-md border border-slate-300 px-2 py-1.5">
            <option value="text">文字</option>
            <option value="image">圖片</option>
            <option value="imagemap">圖文／影片訊息</option>
            <option value="flex">多頁訊息</option>
          </select>
        </label>
        {replyType === 'text' && (
          <label className="block">
            <span className="mb-1 block text-slate-600">回覆文字</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
        )}
        {replyType === 'image' && (
          <label className="block">
            <span className="mb-1 block text-slate-600">圖片網址（https，正方形建議 1024x1024）</span>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
        )}
        {(replyType === 'imagemap' || replyType === 'flex') && (
          <label className="block">
            <span className="mb-1 block text-slate-600">選擇素材（在「進階訊息素材庫」建立）</span>
            <select value={richMessageId} onChange={(e) => setRichMessageId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5">
              <option value="">請選擇...</option>
              {(replyType === 'imagemap' ? imagemaps : carousels).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {(replyType === 'imagemap' ? imagemaps : carousels).length === 0 && (
              <p className="mt-1 text-xs text-amber-600">尚未建立任何素材，請先到「進階訊息素材庫」建立。</p>
            )}
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-slate-600">優先權（數字越大越優先比對）</span>
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <div className="rounded-md border border-slate-200 p-3">
          <label className="mb-2 flex items-center gap-2 text-slate-700">
            <input type="checkbox" checked={hasSchedule} onChange={(e) => setHasSchedule(e.target.checked)} />
            設定生效期間（不勾選 = 永久有效）
          </label>
          {hasSchedule && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs">
                <span className="mb-1 block text-slate-500">開始時間（台灣時間，留空 = 不限開始）</span>
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-slate-500">結束時間（台灣時間，留空 = 不限結束）</span>
                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
              </label>
            </div>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-slate-600">命中規則時貼標籤（選填，可用於後續分眾行銷）</span>
          <select value={tagId} onChange={(e) => setTagId(e.target.value ? Number(e.target.value) : '')} className="w-full rounded-md border border-slate-300 px-2 py-1.5">
            <option value="">不貼標籤</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600">
            取消
          </button>
          <button onClick={save} className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700">
            儲存
          </button>
        </div>
      </div>
    </Modal>
  )
}

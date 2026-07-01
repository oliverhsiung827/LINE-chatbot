import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { RichMenu, RichMenuArea } from '../../shared/types'
import Modal from '../components/Modal'

const STATUS_LABEL: Record<string, string> = { draft: '草稿', published: '已發佈' }

export default function RichMenus() {
  const [menus, setMenus] = useState<RichMenu[]>([])
  const [editing, setEditing] = useState<RichMenu | 'new' | null>(null)

  async function load() {
    setMenus(await api.get<RichMenu[]>('/rich-menus'))
  }

  useEffect(() => {
    load()
  }, [])

  async function publish(id: string) {
    try {
      await api.post(`/rich-menus/${id}/publish`)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : '發佈失敗')
    }
  }

  async function setDefault(id: string) {
    await api.post(`/rich-menus/${id}/set-default`)
    load()
  }

  async function remove(id: string) {
    if (!confirm('確定要刪除此圖文選單嗎？')) return
    await api.delete(`/rich-menus/${id}`)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">圖文選單</h2>
        <button onClick={() => setEditing('new')} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700">
          新增選單
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {menus.map((m) => (
          <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4">
            {m.image_url ? (
              <img src={m.image_url} className="mb-3 h-32 w-full rounded object-cover" />
            ) : (
              <div className="mb-3 flex h-32 w-full items-center justify-center rounded bg-slate-100 text-xs text-slate-400">尚未上傳圖片</div>
            )}
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold text-slate-800">{m.name}</h4>
              {m.is_default ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">預設選單</span> : null}
            </div>
            <p className="mb-3 text-xs text-slate-500">
              {STATUS_LABEL[m.status]} · {m.areas.length} 個區塊
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button onClick={() => setEditing(m)} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                編輯
              </button>
              {m.status === 'draft' && (
                <button onClick={() => publish(m.id)} className="rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700">
                  發佈到 LINE
                </button>
              )}
              {m.status === 'published' && !m.is_default && (
                <button onClick={() => setDefault(m.id)} className="rounded border border-emerald-600 px-2 py-1 text-emerald-600 hover:bg-emerald-50">
                  設為預設
                </button>
              )}
              <button onClick={() => remove(m.id)} className="rounded border border-red-300 px-2 py-1 text-red-500 hover:bg-red-50">
                刪除
              </button>
            </div>
          </div>
        ))}
        {menus.length === 0 && <p className="col-span-3 text-center text-slate-400">尚無圖文選單，點擊右上角新增</p>}
      </div>

      {editing && (
        <RichMenuForm
          menu={editing === 'new' ? null : editing}
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

function RichMenuForm({ menu, onClose, onSaved }: { menu: RichMenu | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(menu?.name ?? '')
  const [chatBarText, setChatBarText] = useState(menu?.chat_bar_text ?? '選單')
  const [areas, setAreas] = useState<RichMenuArea[]>(menu?.areas ?? [])
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  function addArea() {
    setAreas((prev) => [...prev, { bounds: { x: 0, y: 0, width: 1250, height: 843 }, action: { type: 'message', text: '' } }])
  }

  function updateArea(index: number, area: RichMenuArea) {
    setAreas((prev) => prev.map((a, i) => (i === index ? area : a)))
  }

  function removeArea(index: number) {
    setAreas((prev) => prev.filter((_, i) => i !== index))
  }

  async function save() {
    setSaving(true)
    try {
      let id = menu?.id
      if (!id) {
        const created = await api.post<{ id: string }>('/rich-menus', {
          name,
          chatBarText,
          sizeWidth: 2500,
          sizeHeight: 1686,
          areas,
        })
        id = created.id
      } else {
        await api.patch(`/rich-menus/${id}`, { name, chatBarText, areas })
      }
      if (file) {
        const form = new FormData()
        form.append('image', file)
        await api.upload(`/rich-menus/${id}/image`, form)
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={menu ? '編輯圖文選單' : '新增圖文選單'} onClose={onClose}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
        <label className="block">
          <span className="mb-1 block text-slate-600">選單名稱</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">聊天室選單列文字</span>
          <input value={chatBarText} onChange={(e) => setChatBarText(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">選單圖片（建議 2500x1686 px）</span>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-slate-600">點擊區塊設定</span>
            <button onClick={addArea} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
              + 新增區塊
            </button>
          </div>
          <div className="space-y-3">
            {areas.map((area, i) => (
              <AreaEditor key={i} area={area} onChange={(a) => updateArea(i, a)} onRemove={() => removeArea(i)} />
            ))}
            {areas.length === 0 && <p className="text-xs text-slate-400">尚未設定任何點擊區塊</p>}
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

function AreaEditor({ area, onChange, onRemove }: { area: RichMenuArea; onChange: (a: RichMenuArea) => void; onRemove: () => void }) {
  const actionType = area.action.type

  function updateBounds(key: 'x' | 'y' | 'width' | 'height', value: number) {
    onChange({ ...area, bounds: { ...area.bounds, [key]: value } })
  }

  function updateActionType(type: string) {
    if (type === 'uri') onChange({ ...area, action: { type: 'uri', uri: '' } })
    else if (type === 'postback') onChange({ ...area, action: { type: 'postback', data: '' } })
    else onChange({ ...area, action: { type: 'message', text: '' } })
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 grid grid-cols-4 gap-2">
        {(['x', 'y', 'width', 'height'] as const).map((key) => (
          <label key={key} className="block text-xs">
            <span className="mb-0.5 block text-slate-500">{key}</span>
            <input
              type="number"
              value={area.bounds[key]}
              onChange={(e) => updateBounds(key, Number(e.target.value))}
              className="w-full rounded border border-slate-300 px-1.5 py-1"
            />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <select value={actionType} onChange={(e) => updateActionType(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">
          <option value="message">傳送文字訊息</option>
          <option value="uri">開啟連結</option>
          <option value="postback">Postback</option>
        </select>
        {actionType === 'message' && (
          <input
            placeholder="要傳送的文字"
            value={(area.action as { text: string }).text}
            onChange={(e) => onChange({ ...area, action: { type: 'message', text: e.target.value } })}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
          />
        )}
        {actionType === 'uri' && (
          <input
            placeholder="https://..."
            value={(area.action as { uri: string }).uri}
            onChange={(e) => onChange({ ...area, action: { type: 'uri', uri: e.target.value } })}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
          />
        )}
        {actionType === 'postback' && (
          <input
            placeholder="postback data"
            value={(area.action as { data: string }).data}
            onChange={(e) => onChange({ ...area, action: { type: 'postback', data: e.target.value } })}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
          />
        )}
        <button onClick={onRemove} className="rounded border border-red-300 px-2 py-1 text-xs text-red-500 hover:bg-red-50">
          移除
        </button>
      </div>
    </div>
  )
}

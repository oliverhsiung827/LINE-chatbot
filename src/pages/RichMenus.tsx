import { useEffect, useState } from 'react'
import { api, ApiRequestError } from '../lib/api'
import type { RichMenu, RichMenuArea } from '../../shared/types'
import Modal from '../components/Modal'

const STATUS_LABEL: Record<string, string> = { draft: '草稿', published: '已發佈' }

const SIZE_PRESETS = [
  { label: '大尺寸（2500 x 1686）', width: 2500, height: 1686 },
  { label: '小尺寸（2500 x 843）', width: 2500, height: 843 },
]

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

function distribute(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const remainder = total - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0))
}

function buildGrid(width: number, height: number, cols: number, rows: number): Bounds[] {
  const colWidths = distribute(width, cols)
  const rowHeights = distribute(height, rows)
  const areas: Bounds[] = []
  let y = 0
  for (let r = 0; r < rows; r++) {
    let x = 0
    for (let c = 0; c < cols; c++) {
      areas.push({ x, y, width: colWidths[c], height: rowHeights[r] })
      x += colWidths[c]
    }
    y += rowHeights[r]
  }
  return areas
}

function topFullBottomSplit(width: number, height: number, bottomCount: number): Bounds[] {
  const topHeight = Math.round(height / 2)
  const bottomHeight = height - topHeight
  const bottomWidths = distribute(width, bottomCount)
  const areas: Bounds[] = [{ x: 0, y: 0, width, height: topHeight }]
  let x = 0
  for (const w of bottomWidths) {
    areas.push({ x, y: topHeight, width: w, height: bottomHeight })
    x += w
  }
  return areas
}

function bottomFullTopSplit(width: number, height: number, topCount: number): Bounds[] {
  const bottomHeight = Math.round(height / 2)
  const topHeight = height - bottomHeight
  const topWidths = distribute(width, topCount)
  const areas: Bounds[] = []
  let x = 0
  for (const w of topWidths) {
    areas.push({ x, y: 0, width: w, height: topHeight })
    x += w
  }
  areas.push({ x: 0, y: topHeight, width, height: bottomHeight })
  return areas
}

interface Template {
  label: string
  build: (width: number, height: number) => Bounds[]
}

const LARGE_TEMPLATES: Template[] = [
  { label: '整張（1 個區塊）', build: (w, h) => buildGrid(w, h, 1, 1) },
  { label: '左右各半（2 欄）', build: (w, h) => buildGrid(w, h, 2, 1) },
  { label: '上下各半（2 列）', build: (w, h) => buildGrid(w, h, 1, 2) },
  { label: '三欄並排', build: (w, h) => buildGrid(w, h, 3, 1) },
  { label: '2 x 2 九宮格', build: (w, h) => buildGrid(w, h, 2, 2) },
  { label: '2 列 x 3 欄', build: (w, h) => buildGrid(w, h, 3, 2) },
  { label: '上 1 大 + 下 2 小', build: (w, h) => topFullBottomSplit(w, h, 2) },
  { label: '上 2 小 + 下 1 大', build: (w, h) => bottomFullTopSplit(w, h, 2) },
  { label: '上 1 大 + 下 3 小', build: (w, h) => topFullBottomSplit(w, h, 3) },
]

const COMPACT_TEMPLATES: Template[] = [
  { label: '整張（1 個區塊）', build: (w, h) => buildGrid(w, h, 1, 1) },
  { label: '左右各半（2 欄）', build: (w, h) => buildGrid(w, h, 2, 1) },
  { label: '三欄並排', build: (w, h) => buildGrid(w, h, 3, 1) },
  { label: '四欄並排', build: (w, h) => buildGrid(w, h, 4, 1) },
]

function defaultAreaFor(bounds: Bounds): RichMenuArea {
  return { bounds, action: { type: 'message', text: '' } }
}

function isAreaIncomplete(area: RichMenuArea): boolean {
  const action = area.action
  if (action.type === 'message') return !action.text?.trim()
  if (action.type === 'uri') return !action.uri?.trim()
  if (action.type === 'postback') return !action.data?.trim()
  if (action.type === 'richmenuswitch') return !action.richMenuAliasId?.trim()
  return true
}

const AREA_COLORS = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16']

export default function RichMenus() {
  const [menus, setMenus] = useState<RichMenu[]>([])
  const [editing, setEditing] = useState<RichMenu | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setMenus(await api.get<RichMenu[]>('/rich-menus'))
  }

  useEffect(() => {
    load()
  }, [])

  async function publish(id: string) {
    setError(null)
    try {
      await api.post(`/rich-menus/${id}/publish`)
      load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : '發佈失敗')
    }
  }

  async function setDefault(id: string) {
    setError(null)
    try {
      await api.post(`/rich-menus/${id}/set-default`)
      load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : '設定失敗')
    }
  }

  async function remove(id: string) {
    if (!confirm('確定要刪除此圖文選單嗎？')) return
    await api.delete(`/rich-menus/${id}`)
    load()
  }

  async function duplicateAsPage2(menu: RichMenu) {
    const created = await api.post<{ id: string }>('/rich-menus', {
      name: `${menu.name}（第2頁）`,
      chatBarText: menu.chat_bar_text,
      sizeWidth: menu.size_width,
      sizeHeight: menu.size_height,
      areas: [],
    })
    setMenus((prev) => [
      {
        id: created.id,
        line_rich_menu_id: null,
        name: `${menu.name}（第2頁）`,
        chat_bar_text: menu.chat_bar_text,
        image_url: null,
        size_width: menu.size_width,
        size_height: menu.size_height,
        areas: [],
        is_default: 0,
        status: 'draft',
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">圖文選單</h2>
        <button onClick={() => setEditing('new')} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700">
          新增選單
        </button>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <p className="mb-4 text-xs text-slate-500">
        想做「多頁選單」：先建立兩個選單，各自發佈後，在區塊動作選擇「切換到其他選單頁面」互相連結即可（就像 LINE 官方選單下方的頁籤切換）。
      </p>

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
              {STATUS_LABEL[m.status]} · {m.size_width}x{m.size_height} · {m.areas.length} 個區塊
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
              {m.status === 'published' && (
                <button onClick={() => publish(m.id)} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                  重新發佈
                </button>
              )}
              {m.status === 'published' && !m.is_default && (
                <button onClick={() => setDefault(m.id)} className="rounded border border-emerald-600 px-2 py-1 text-emerald-600 hover:bg-emerald-50">
                  設為預設
                </button>
              )}
              <button onClick={() => duplicateAsPage2(m)} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                複製為第2頁
              </button>
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
          allMenus={menus}
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

function RichMenuForm({
  menu,
  allMenus,
  onClose,
  onSaved,
}: {
  menu: RichMenu | null
  allMenus: RichMenu[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(menu?.name ?? '')
  const [chatBarText, setChatBarText] = useState(menu?.chat_bar_text ?? '選單')
  const [sizeWidth, setSizeWidth] = useState(menu?.size_width ?? SIZE_PRESETS[0].width)
  const [sizeHeight, setSizeHeight] = useState(menu?.size_height ?? SIZE_PRESETS[0].height)
  const [areas, setAreas] = useState<RichMenuArea[]>(menu?.areas ?? [])
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(menu?.image_url ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const templates = sizeHeight <= 900 ? COMPACT_TEMPLATES : LARGE_TEMPLATES
  const otherMenus = allMenus.filter((m) => m.id !== menu?.id)

  function handleFileChange(f: File | null) {
    if (f && f.size > 1024 * 1024) {
      setError('圖片檔案大小需小於 1MB，請先壓縮圖片後再上傳（LINE 圖文選單圖片大小限制）')
      return
    }
    setError(null)
    setFile(f)
    if (f) setPreviewUrl(URL.createObjectURL(f))
  }

  function applyTemplate(t: Template) {
    if (areas.length > 0 && !confirm('套用範本會取代目前的區塊設定，確定要繼續嗎？')) return
    setAreas(t.build(sizeWidth, sizeHeight).map(defaultAreaFor))
  }

  function addArea() {
    setAreas((prev) => [...prev, defaultAreaFor({ x: 0, y: 0, width: Math.round(sizeWidth / 2), height: sizeHeight })])
  }

  function updateArea(index: number, area: RichMenuArea) {
    setAreas((prev) => prev.map((a, i) => (i === index ? area : a)))
  }

  function removeArea(index: number) {
    setAreas((prev) => prev.filter((_, i) => i !== index))
  }

  async function save() {
    setError(null)
    if (!name.trim()) {
      setError('請輸入選單名稱')
      return
    }
    setSaving(true)
    try {
      let id = menu?.id
      if (!id) {
        const created = await api.post<{ id: string }>('/rich-menus', {
          name,
          chatBarText,
          sizeWidth,
          sizeHeight,
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
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={menu ? '編輯圖文選單' : '新增圖文選單'} onClose={onClose}>
      <div className="max-h-[75vh] space-y-4 overflow-y-auto text-sm">
        {error && <p className="rounded bg-red-50 px-3 py-2 text-red-600">{error}</p>}

        <label className="block">
          <span className="mb-1 block text-slate-600">選單名稱</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">聊天室選單列文字</span>
          <input value={chatBarText} onChange={(e) => setChatBarText(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>

        {!menu && (
          <label className="block">
            <span className="mb-1 block text-slate-600">選單尺寸</span>
            <select
              value={`${sizeWidth}x${sizeHeight}`}
              onChange={(e) => {
                const preset = SIZE_PRESETS.find((p) => `${p.width}x${p.height}` === e.target.value)
                if (preset) {
                  setSizeWidth(preset.width)
                  setSizeHeight(preset.height)
                  setAreas([])
                }
              }}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5"
            >
              {SIZE_PRESETS.map((p) => (
                <option key={p.label} value={`${p.width}x${p.height}`}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-slate-600">選單圖片（建議 {sizeWidth}x{sizeHeight} px）</span>
          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} className="w-full text-xs" />
        </label>

        <div>
          <span className="mb-2 block text-slate-600">分割範本（點擊套用，可再手動微調）</span>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.label}
                onClick={() => applyTemplate(t)}
                className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-slate-600">即時預覽（紅色虛線代表區塊尚未設定完成）</span>
          <RichMenuPreview imageUrl={previewUrl} sizeWidth={sizeWidth} sizeHeight={sizeHeight} areas={areas} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-slate-600">點擊區塊設定（{areas.length} 個）</span>
            <button onClick={addArea} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
              + 手動新增區塊
            </button>
          </div>
          <div className="space-y-3">
            {areas.map((area, i) => (
              <AreaEditor
                key={i}
                index={i}
                area={area}
                otherMenus={otherMenus}
                onChange={(a) => updateArea(i, a)}
                onRemove={() => removeArea(i)}
              />
            ))}
            {areas.length === 0 && <p className="text-xs text-slate-400">尚未設定任何點擊區塊，可套用上方範本或手動新增</p>}
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

function RichMenuPreview({
  imageUrl,
  sizeWidth,
  sizeHeight,
  areas,
}: {
  imageUrl: string | null
  sizeWidth: number
  sizeHeight: number
  areas: RichMenuArea[]
}) {
  return (
    <div
      className="relative w-full max-w-md overflow-hidden rounded border border-slate-300 bg-slate-100"
      style={{ aspectRatio: `${sizeWidth} / ${sizeHeight}` }}
    >
      {imageUrl ? (
        <img src={imageUrl} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">尚未上傳圖片</div>
      )}
      {areas.map((area, i) => {
        const incomplete = isAreaIncomplete(area)
        return (
          <div
            key={i}
            className="absolute flex items-start justify-start text-[10px] font-bold text-white"
            style={{
              left: `${(area.bounds.x / sizeWidth) * 100}%`,
              top: `${(area.bounds.y / sizeHeight) * 100}%`,
              width: `${(area.bounds.width / sizeWidth) * 100}%`,
              height: `${(area.bounds.height / sizeHeight) * 100}%`,
              border: incomplete ? '2px dashed #ef4444' : `2px solid ${AREA_COLORS[i % AREA_COLORS.length]}`,
              backgroundColor: incomplete ? 'rgba(239,68,68,0.15)' : `${AREA_COLORS[i % AREA_COLORS.length]}33`,
              boxSizing: 'border-box',
            }}
          >
            <span className="m-0.5 rounded bg-black/50 px-1">{i + 1}</span>
          </div>
        )
      })}
    </div>
  )
}

function AreaEditor({
  index,
  area,
  otherMenus,
  onChange,
  onRemove,
}: {
  index: number
  area: RichMenuArea
  otherMenus: RichMenu[]
  onChange: (a: RichMenuArea) => void
  onRemove: () => void
}) {
  const actionType = area.action.type

  function updateBounds(key: 'x' | 'y' | 'width' | 'height', value: number) {
    onChange({ ...area, bounds: { ...area.bounds, [key]: value } })
  }

  function updateActionType(type: string) {
    if (type === 'uri') onChange({ ...area, action: { type: 'uri', uri: '' } })
    else if (type === 'postback') onChange({ ...area, action: { type: 'postback', data: '' } })
    else if (type === 'richmenuswitch') onChange({ ...area, action: { type: 'richmenuswitch', richMenuAliasId: '', data: 'switch' } })
    else onChange({ ...area, action: { type: 'message', text: '' } })
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: AREA_COLORS[index % AREA_COLORS.length] }}
        />
        <span className="flex-1 px-2">區塊 {index + 1}</span>
      </div>
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
      <div className="flex flex-wrap gap-2">
        <select value={actionType} onChange={(e) => updateActionType(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">
          <option value="message">傳送文字訊息</option>
          <option value="uri">開啟連結</option>
          <option value="postback">Postback</option>
          <option value="richmenuswitch">切換到其他選單頁面</option>
        </select>
        {actionType === 'message' && (
          <input
            placeholder="要傳送的文字"
            value={(area.action as { text: string }).text}
            onChange={(e) => onChange({ ...area, action: { type: 'message', text: e.target.value } })}
            className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
          />
        )}
        {actionType === 'uri' && (
          <input
            placeholder="https://..."
            value={(area.action as { uri: string }).uri}
            onChange={(e) => onChange({ ...area, action: { type: 'uri', uri: e.target.value } })}
            className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
          />
        )}
        {actionType === 'postback' && (
          <input
            placeholder="postback data"
            value={(area.action as { data: string }).data}
            onChange={(e) => onChange({ ...area, action: { type: 'postback', data: e.target.value } })}
            className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
          />
        )}
        {actionType === 'richmenuswitch' && (
          <select
            value={(area.action as { richMenuAliasId: string }).richMenuAliasId}
            onChange={(e) =>
              onChange({ ...area, action: { type: 'richmenuswitch', richMenuAliasId: e.target.value, data: 'switch' } })
            }
            className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">選擇要切換到的選單...</option>
            {otherMenus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.status !== 'published' ? '（尚未發佈）' : ''}
              </option>
            ))}
          </select>
        )}
        <button onClick={onRemove} className="rounded border border-red-300 px-2 py-1 text-xs text-red-500 hover:bg-red-50">
          移除
        </button>
      </div>
      {actionType === 'richmenuswitch' && (
        <p className="mt-1 text-[10px] text-slate-400">提醒：切換的目標選單也需要先發佈到 LINE，切換按鈕才會生效。</p>
      )}
    </div>
  )
}

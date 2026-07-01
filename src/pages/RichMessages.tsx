import { useEffect, useState } from 'react'
import { api, ApiRequestError } from '../lib/api'
import type {
  RichMessage,
  RichMessageType,
  ImagemapContent,
  ImagemapAction,
  FlexCarouselContent,
  FlexCarouselCard,
  FlexCarouselButton,
} from '../../shared/types'
import Modal from '../components/Modal'

const TYPE_LABEL: Record<RichMessageType, string> = { imagemap: '圖文／影片訊息', flex_carousel: '多頁訊息' }

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export default function RichMessages() {
  const [items, setItems] = useState<RichMessage[]>([])
  const [editing, setEditing] = useState<{ type: RichMessageType; id: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setItems(await api.get<RichMessage[]>('/rich-messages'))
  }

  useEffect(() => {
    load()
  }, [])

  async function remove(id: string) {
    if (!confirm('確定要刪除這個素材嗎？使用它的自動回覆或群發訊息將無法正常發送。')) return
    await api.delete(`/rich-messages/${id}`)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">進階訊息素材庫</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing({ type: 'imagemap', id: null })}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
          >
            新增圖文／影片訊息
          </button>
          <button
            onClick={() => setEditing({ type: 'flex_carousel', id: null })}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
          >
            新增多頁訊息
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <p className="mb-4 text-xs text-slate-500">
        這裡建立的內容可以在「關鍵字自動回覆」與「群發訊息」選擇發送。圖文／影片訊息對應 LINE 的 Imagemap（含進階影片訊息），多頁訊息採用 Flex Carousel 格式。
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
            {item.type === 'imagemap' ? (
              (item.content as ImagemapContent).image_key ? (
                <img src={`/api/rm-assets/${item.id}/imagemap/460`} className="mb-3 h-32 w-full rounded object-cover" />
              ) : (
                <div className="mb-3 flex h-32 w-full items-center justify-center rounded bg-slate-100 text-xs text-slate-400">尚未上傳圖片</div>
              )
            ) : (item.content as FlexCarouselContent).cards[0]?.image_key ? (
              <img src={`/api/rm-assets/${item.id}/carousel/0`} className="mb-3 h-32 w-full rounded object-cover" />
            ) : (
              <div className="mb-3 flex h-32 w-full items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                {(item.content as FlexCarouselContent).cards.length} 張卡片
              </div>
            )}
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold text-slate-800">{item.name}</h4>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{TYPE_LABEL[item.type]}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button onClick={() => setEditing({ type: item.type, id: item.id })} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                編輯
              </button>
              <button onClick={() => remove(item.id)} className="rounded border border-red-300 px-2 py-1 text-red-500 hover:bg-red-50">
                刪除
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="col-span-3 text-center text-slate-400">尚無素材，點擊右上角新增</p>}
      </div>

      {editing?.type === 'imagemap' && (
        <ImagemapEditor
          id={editing.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
          onError={setError}
        />
      )}
      {editing?.type === 'flex_carousel' && (
        <CarouselEditor
          id={editing.id}
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

function defaultImagemapAction(): ImagemapAction {
  return { type: 'message', area: { x: 0, y: 0, width: 520, height: 520 }, text: '' }
}

function ImagemapEditor({
  id,
  onClose,
  onSaved,
  onError,
}: {
  id: string | null
  onClose: () => void
  onSaved: () => void
  onError: (msg: string | null) => void
}) {
  const [loaded, setLoaded] = useState(id === null)
  const [name, setName] = useState('')
  const [altText, setAltText] = useState('')
  const [width, setWidth] = useState(1040)
  const [height, setHeight] = useState(1040)
  const [actions, setActions] = useState<ImagemapAction[]>([])
  const [baseFile, setBaseFile] = useState<File | null>(null)
  const [basePreview, setBasePreview] = useState<string | null>(null)
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [videoArea, setVideoArea] = useState<Bounds>({ x: 0, y: 0, width: 1040, height: 1040 })
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreviewFile, setVideoPreviewFile] = useState<File | null>(null)
  const [hasExistingVideo, setHasExistingVideo] = useState(false)
  const [hasExistingPreview, setHasExistingPreview] = useState(false)
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUri, setCtaUri] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.get<RichMessage>(`/rich-messages/${id}`).then((row) => {
      const c = row.content as ImagemapContent
      setName(row.name)
      setAltText(c.altText)
      setWidth(c.baseSize.width)
      setHeight(c.baseSize.height)
      setActions(c.actions)
      if (c.image_key) setBasePreview(`/api/rm-assets/${id}/imagemap/1040`)
      if (c.video) {
        setVideoEnabled(true)
        setVideoArea(c.video.area)
        setHasExistingVideo(!!c.video.video_key)
        setHasExistingPreview(!!c.video.preview_key)
        if (c.video.external_link) {
          setCtaLabel(c.video.external_link.label)
          setCtaUri(c.video.external_link.linkUri)
        }
      }
      setLoaded(true)
    })
  }, [id])

  function handleBaseFile(f: File | null) {
    setBaseFile(f)
    if (f) setBasePreview(URL.createObjectURL(f))
  }

  function addAction() {
    setActions((prev) => [...prev, defaultImagemapAction()])
  }
  function updateAction(i: number, a: ImagemapAction) {
    setActions((prev) => prev.map((x, idx) => (idx === i ? a : x)))
  }
  function removeAction(i: number) {
    setActions((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    setError(null)
    if (!name.trim()) return setError('請輸入名稱')
    if (actions.some((a) => (a.type === 'uri' && !a.uri?.trim()) || (a.type === 'message' && !a.text?.trim()))) {
      return setError('請完整填寫每個區塊的動作內容')
    }
    if (videoEnabled && (ctaLabel.trim() && !ctaUri.trim())) return setError('CTA 按鈕請同時填寫文字與網址')
    if (videoEnabled && !videoFile && !hasExistingVideo) return setError('已啟用進階影片訊息，請上傳影片檔案')
    if (videoEnabled && !videoPreviewFile && !hasExistingPreview) {
      return setError('已啟用進階影片訊息，請上傳影片預覽圖片（LINE 要求影片訊息必須有預覽圖，否則會顯示「讀取影片失敗」）')
    }

    setSaving(true)
    try {
      const content: ImagemapContent = {
        altText: altText || name,
        baseSize: { width, height },
        image_key: null,
        actions,
        video: videoEnabled
          ? { area: videoArea, video_key: null, preview_key: null, external_link: ctaLabel.trim() ? { label: ctaLabel, linkUri: ctaUri } : undefined }
          : null,
      }
      let rowId = id
      if (!rowId) {
        const created = await api.post<{ id: string }>('/rich-messages', { type: 'imagemap', name, content })
        rowId = created.id
      } else {
        await api.patch(`/rich-messages/${rowId}`, { name, content })
      }
      if (baseFile) {
        const form = new FormData()
        form.append('file', baseFile)
        await api.upload(`/rich-messages/${rowId}/image`, form)
      }
      if (videoEnabled && videoFile) {
        const form = new FormData()
        form.append('file', videoFile)
        await api.upload(`/rich-messages/${rowId}/video`, form)
      }
      if (videoEnabled && videoPreviewFile) {
        const form = new FormData()
        form.append('file', videoPreviewFile)
        await api.upload(`/rich-messages/${rowId}/video-preview`, form)
      }
      onSaved()
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : '儲存失敗'
      setError(msg)
      onError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  return (
    <Modal title={id ? '編輯圖文／影片訊息' : '新增圖文／影片訊息'} onClose={onClose}>
      <div className="max-h-[75vh] space-y-4 overflow-y-auto text-sm">
        {error && <p className="rounded bg-red-50 px-3 py-2 text-red-600">{error}</p>}

        <label className="block">
          <span className="mb-1 block text-slate-600">名稱（僅內部識別用）</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">替代文字（通知/找不到圖片時顯示）</span>
          <input value={altText} onChange={(e) => setAltText(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>

        {!id && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-slate-600">底圖寬度</span>
              <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">底圖高度</span>
              <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
            </label>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-slate-600">底圖（建議 {width}x{height} px）</span>
          <input type="file" accept="image/*" onChange={(e) => handleBaseFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
        </label>

        <div>
          <span className="mb-2 block text-slate-600">即時預覽</span>
          <div
            className="relative w-full max-w-md overflow-hidden rounded border border-slate-300 bg-slate-100"
            style={{ aspectRatio: `${width} / ${height}` }}
          >
            {basePreview ? (
              <img src={basePreview} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">尚未上傳圖片</div>
            )}
            {actions.map((a, i) => {
              const incomplete = (a.type === 'uri' && !a.uri?.trim()) || (a.type === 'message' && !a.text?.trim())
              return (
                <div
                  key={i}
                  className="absolute text-[10px] font-bold text-white"
                  style={{
                    left: `${(a.area.x / width) * 100}%`,
                    top: `${(a.area.y / height) * 100}%`,
                    width: `${(a.area.width / width) * 100}%`,
                    height: `${(a.area.height / height) * 100}%`,
                    border: incomplete ? '2px dashed #ef4444' : '2px solid #3b82f6',
                    backgroundColor: incomplete ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.2)',
                    boxSizing: 'border-box',
                  }}
                >
                  <span className="m-0.5 rounded bg-black/50 px-1">{i + 1}</span>
                </div>
              )
            })}
            {videoEnabled && (
              <div
                className="absolute border-2 border-dashed border-purple-500 bg-purple-500/10 text-[10px] font-bold text-white"
                style={{
                  left: `${(videoArea.x / width) * 100}%`,
                  top: `${(videoArea.y / height) * 100}%`,
                  width: `${(videoArea.width / width) * 100}%`,
                  height: `${(videoArea.height / height) * 100}%`,
                  boxSizing: 'border-box',
                }}
              >
                <span className="m-0.5 rounded bg-black/50 px-1">影片</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-slate-600">點擊區塊（{actions.length} 個）</span>
            <button onClick={addAction} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
              + 新增區塊
            </button>
          </div>
          <div className="space-y-3">
            {actions.map((a, i) => (
              <div key={i} className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 grid grid-cols-4 gap-2">
                  {(['x', 'y', 'width', 'height'] as const).map((key) => (
                    <label key={key} className="block text-xs">
                      <span className="mb-0.5 block text-slate-500">{key}</span>
                      <input
                        type="number"
                        value={a.area[key]}
                        onChange={(e) => updateAction(i, { ...a, area: { ...a.area, [key]: Number(e.target.value) } })}
                        className="w-full rounded border border-slate-300 px-1.5 py-1"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={a.type}
                    onChange={(e) =>
                      updateAction(i, e.target.value === 'uri' ? { type: 'uri', area: a.area, uri: '' } : { type: 'message', area: a.area, text: '' })
                    }
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="message">傳送文字訊息</option>
                    <option value="uri">開啟連結</option>
                  </select>
                  {a.type === 'message' ? (
                    <input
                      placeholder="要傳送的文字"
                      value={a.text ?? ''}
                      onChange={(e) => updateAction(i, { ...a, text: e.target.value })}
                      className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  ) : (
                    <input
                      placeholder="https://..."
                      value={a.uri ?? ''}
                      onChange={(e) => updateAction(i, { ...a, uri: e.target.value })}
                      className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  )}
                  <button onClick={() => removeAction(i)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-500 hover:bg-red-50">
                    移除
                  </button>
                </div>
              </div>
            ))}
            {actions.length === 0 && <p className="text-xs text-slate-400">尚未設定任何點擊區塊</p>}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <label className="mb-2 flex items-center gap-2 text-slate-700">
            <input type="checkbox" checked={videoEnabled} onChange={(e) => setVideoEnabled(e.target.checked)} />
            進階影片訊息（在底圖上疊加一段自動播放的影片）
          </label>
          {videoEnabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((key) => (
                  <label key={key} className="block text-xs">
                    <span className="mb-0.5 block text-slate-500">{key}</span>
                    <input
                      type="number"
                      value={videoArea[key]}
                      onChange={(e) => setVideoArea({ ...videoArea, [key]: Number(e.target.value) })}
                      className="w-full rounded border border-slate-300 px-1.5 py-1"
                    />
                  </label>
                ))}
              </div>
              <label className="block text-xs">
                <span className="mb-1 block text-slate-500">影片檔案（mp4，長度需在 1 分鐘內）{hasExistingVideo && !videoFile ? '（已上傳）' : ''}</span>
                <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-slate-500">影片預覽圖片（LINE 必填，播放前顯示的封面圖）{hasExistingPreview && !videoPreviewFile ? '（已上傳）' : ''}</span>
                <input type="file" accept="image/*" onChange={(e) => setVideoPreviewFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">
                  <span className="mb-1 block text-slate-500">播放完畢按鈕文字（選填）</span>
                  <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-slate-500">按鈕連結網址</span>
                  <input value={ctaUri} onChange={(e) => setCtaUri(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
                </label>
              </div>
            </div>
          )}
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

function defaultButton(): FlexCarouselButton {
  return { label: '', action: { type: 'uri', uri: '' } }
}

function defaultCard(): FlexCarouselCard {
  return { image_key: null, title: '', text: '', buttons: [] }
}

function CarouselEditor({
  id,
  onClose,
  onSaved,
  onError,
}: {
  id: string | null
  onClose: () => void
  onSaved: () => void
  onError: (msg: string | null) => void
}) {
  const [loaded, setLoaded] = useState(id === null)
  const [name, setName] = useState('')
  const [altText, setAltText] = useState('')
  const [cards, setCards] = useState<FlexCarouselCard[]>([defaultCard()])
  const [cardFiles, setCardFiles] = useState<Record<number, File>>({})
  const [cardPreviews, setCardPreviews] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.get<RichMessage>(`/rich-messages/${id}`).then((row) => {
      const c = row.content as FlexCarouselContent
      setName(row.name)
      setAltText(c.altText)
      setCards(c.cards.length ? c.cards : [defaultCard()])
      const previews: Record<number, string> = {}
      c.cards.forEach((card, i) => {
        if (card.image_key) previews[i] = `/api/rm-assets/${id}/carousel/${i}`
      })
      setCardPreviews(previews)
      setLoaded(true)
    })
  }, [id])

  function updateCard(i: number, card: FlexCarouselCard) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? card : c)))
  }
  function addCard() {
    if (cards.length >= 10) return
    setCards((prev) => [...prev, defaultCard()])
  }
  function removeCard(i: number) {
    setCards((prev) => prev.filter((_, idx) => idx !== i))
  }
  function handleCardFile(i: number, f: File | null) {
    if (!f) return
    setCardFiles((prev) => ({ ...prev, [i]: f }))
    setCardPreviews((prev) => ({ ...prev, [i]: URL.createObjectURL(f) }))
  }

  function addButton(cardIndex: number) {
    const card = cards[cardIndex]
    if (card.buttons.length >= 3) return
    updateCard(cardIndex, { ...card, buttons: [...card.buttons, defaultButton()] })
  }
  function updateButton(cardIndex: number, buttonIndex: number, button: FlexCarouselButton) {
    const card = cards[cardIndex]
    updateCard(cardIndex, { ...card, buttons: card.buttons.map((b, i) => (i === buttonIndex ? button : b)) })
  }
  function removeButton(cardIndex: number, buttonIndex: number) {
    const card = cards[cardIndex]
    updateCard(cardIndex, { ...card, buttons: card.buttons.filter((_, i) => i !== buttonIndex) })
  }

  async function save() {
    setError(null)
    if (!name.trim()) return setError('請輸入名稱')
    if (cards.length === 0) return setError('請至少新增一張卡片')
    if (cards.some((c) => !c.title.trim())) return setError('每張卡片請填寫標題')
    if (cards.some((c) => c.buttons.some((b) => !b.label.trim() || (b.action.type === 'uri' && !b.action.uri) || (b.action.type === 'message' && !b.action.text) || (b.action.type === 'postback' && !b.action.data)))) {
      return setError('請完整填寫每個按鈕的文字與內容')
    }

    setSaving(true)
    try {
      const content: FlexCarouselContent = { altText: altText || name, cards }
      let rowId = id
      if (!rowId) {
        const created = await api.post<{ id: string }>('/rich-messages', { type: 'flex_carousel', name, content })
        rowId = created.id
      } else {
        await api.patch(`/rich-messages/${rowId}`, { name, content })
      }
      for (const [indexStr, file] of Object.entries(cardFiles)) {
        const form = new FormData()
        form.append('file', file)
        await api.upload(`/rich-messages/${rowId}/card-image/${indexStr}`, form)
      }
      onSaved()
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : '儲存失敗'
      setError(msg)
      onError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  return (
    <Modal title={id ? '編輯多頁訊息' : '新增多頁訊息'} onClose={onClose}>
      <div className="max-h-[75vh] space-y-4 overflow-y-auto text-sm">
        {error && <p className="rounded bg-red-50 px-3 py-2 text-red-600">{error}</p>}

        <label className="block">
          <span className="mb-1 block text-slate-600">名稱（僅內部識別用）</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-600">替代文字（通知時顯示）</span>
          <input value={altText} onChange={(e) => setAltText(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5" />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-slate-600">卡片（{cards.length} / 10）</span>
            <button onClick={addCard} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
              + 新增卡片
            </button>
          </div>
          <div className="space-y-4">
            {cards.map((card, i) => (
              <div key={i} className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>卡片 {i + 1}</span>
                  {cards.length > 1 && (
                    <button onClick={() => removeCard(i)} className="text-red-500 hover:underline">
                      移除卡片
                    </button>
                  )}
                </div>
                <div className="mb-2 flex gap-3">
                  {cardPreviews[i] && <img src={cardPreviews[i]} className="h-16 w-16 rounded object-cover" />}
                  <div className="flex-1 space-y-2">
                    <input type="file" accept="image/*" onChange={(e) => handleCardFile(i, e.target.files?.[0] ?? null)} className="w-full text-xs" />
                    <input
                      placeholder="標題"
                      value={card.title}
                      onChange={(e) => updateCard(i, { ...card, title: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <textarea
                      placeholder="內文（選填）"
                      value={card.text}
                      onChange={(e) => updateCard(i, { ...card, text: e.target.value })}
                      rows={2}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>按鈕（{card.buttons.length} / 3）</span>
                    <button onClick={() => addButton(i)} className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">
                      + 新增按鈕
                    </button>
                  </div>
                  {card.buttons.map((b, bi) => (
                    <div key={bi} className="flex flex-wrap gap-2">
                      <input
                        placeholder="按鈕文字"
                        value={b.label}
                        onChange={(e) => updateButton(i, bi, { ...b, label: e.target.value })}
                        className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <select
                        value={b.action.type}
                        onChange={(e) => {
                          const type = e.target.value
                          updateButton(i, bi, {
                            ...b,
                            action: type === 'uri' ? { type: 'uri', uri: '' } : type === 'message' ? { type: 'message', text: '' } : { type: 'postback', data: '' },
                          })
                        }}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="uri">開啟連結</option>
                        <option value="message">傳送文字訊息</option>
                        <option value="postback">Postback</option>
                      </select>
                      {b.action.type === 'uri' && (
                        <input
                          placeholder="https://..."
                          value={b.action.uri}
                          onChange={(e) => updateButton(i, bi, { ...b, action: { type: 'uri', uri: e.target.value } })}
                          className="min-w-[8rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      )}
                      {b.action.type === 'message' && (
                        <input
                          placeholder="要傳送的文字"
                          value={b.action.text}
                          onChange={(e) => updateButton(i, bi, { ...b, action: { type: 'message', text: e.target.value } })}
                          className="min-w-[8rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      )}
                      {b.action.type === 'postback' && (
                        <input
                          placeholder="postback data"
                          value={b.action.data}
                          onChange={(e) => updateButton(i, bi, { ...b, action: { type: 'postback', data: e.target.value } })}
                          className="min-w-[8rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      )}
                      <button onClick={() => removeButton(i, bi)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-500 hover:bg-red-50">
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

// 圖文選單／圖文訊息共用的分割範本產生器：把一個矩形依格線切成多個區塊座標

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Template {
  label: string
  build: (width: number, height: number) => Bounds[]
}

function distribute(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const remainder = total - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0))
}

export function buildGrid(width: number, height: number, cols: number, rows: number): Bounds[] {
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

export function topFullBottomSplit(width: number, height: number, bottomCount: number): Bounds[] {
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

export function bottomFullTopSplit(width: number, height: number, topCount: number): Bounds[] {
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

export const LARGE_TEMPLATES: Template[] = [
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

export const COMPACT_TEMPLATES: Template[] = [
  { label: '整張（1 個區塊）', build: (w, h) => buildGrid(w, h, 1, 1) },
  { label: '左右各半（2 欄）', build: (w, h) => buildGrid(w, h, 2, 1) },
  { label: '三欄並排', build: (w, h) => buildGrid(w, h, 3, 1) },
  { label: '四欄並排', build: (w, h) => buildGrid(w, h, 4, 1) },
]

export function templatesForSize(width: number, height: number): Template[] {
  return width / height >= 2 ? COMPACT_TEMPLATES : LARGE_TEMPLATES
}

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import './paint-canvas.css'

interface PaintCanvasProps {
  editor: Editor | null
  onClose: () => void
}

type Tool =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'fill'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'eyedropper'
  | 'select'

const TOOLS: ReadonlyArray<{ id: Tool; label: string; title: string }> = [
  { id: 'pen', label: '펜', title: '펜 — 부드러운 자유 곡선 (필압 지원)' },
  { id: 'highlighter', label: '형광펜', title: '형광펜 — 반투명 굵은 선' },
  { id: 'eraser', label: '지우개', title: '지우개 — 원형 범위, 크기 조절 가능' },
  { id: 'fill', label: '채우기', title: '채우기 — 클릭한 영역을 현재 색으로 채우기' },
  { id: 'eyedropper', label: '스포이드', title: '스포이드 — 캔버스에서 색 추출' },
  { id: 'line', label: '직선', title: '직선 (Shift: 수평/수직/45°)' },
  { id: 'arrow', label: '화살표', title: '화살표' },
  { id: 'rect', label: '사각형', title: '사각형 (Shift: 정사각형)' },
  { id: 'ellipse', label: '타원', title: '타원 (Shift: 정원)' },
  { id: 'text', label: '텍스트', title: '텍스트 — 캔버스를 클릭해 입력' },
  { id: 'select', label: '선택', title: '선택 — 영역을 끌어 선택 후 이동·삭제·복사' },
]

const PALETTE = [
  '#000000', '#6B7280', '#E53935', '#FB8C00', '#FDD835', '#43A047',
  '#00897B', '#1E88E5', '#3949AB', '#8E24AA', '#D81B60', '#6D4C41',
  '#FFFFFF', '#BDBDBD', '#FF80AB', '#FFD180', '#FFF59D', '#A5D6A7',
]

const CANVAS_SIZES = [
  { key: 'small', label: '소', title: '캔버스 크기 소 (640×400)', w: 640, h: 400 },
  { key: 'medium', label: '중', title: '캔버스 크기 중 (900×560)', w: 900, h: 560 },
  { key: 'large', label: '대', title: '캔버스 크기 대 (1200×720)', w: 1200, h: 720 },
] as const
type SizeKey = (typeof CANVAS_SIZES)[number]['key']

const MAX_HISTORY = 50
const FILL_TOLERANCE = 32
const FONT_SIZES = [12, 16, 20, 28, 36, 48, 64]

interface Pt { x: number; y: number; p: number }
interface Rect { x: number; y: number; w: number; h: number }
interface TextDraft { cx: number; cy: number; dx: number; dy: number; scale: number; value: string }
interface Selection { rect: Rect; data: ImageData; dragging: boolean; offsetX: number; offsetY: number; floated: boolean }

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
}

/** 반복형 스캔라인 플러드 필. 변화가 있으면 true. */
function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, hex: string): boolean {
  const { width, height } = ctx.canvas
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false
  const img = ctx.getImageData(0, 0, width, height)
  const d = img.data
  const startIdx = (sy * width + sx) * 4
  const tr = d[startIdx], tg = d[startIdx + 1], tb = d[startIdx + 2], ta = d[startIdx + 3]
  const [fr, fg, fb] = hexToRgb(hex)
  if (Math.abs(tr - fr) <= FILL_TOLERANCE && Math.abs(tg - fg) <= FILL_TOLERANCE && Math.abs(tb - fb) <= FILL_TOLERANCE && ta === 255) return false
  const visited = new Uint8Array(width * height)
  const matches = (i: number): boolean => {
    const j = i * 4
    return Math.abs(d[j] - tr) <= FILL_TOLERANCE && Math.abs(d[j + 1] - tg) <= FILL_TOLERANCE && Math.abs(d[j + 2] - tb) <= FILL_TOLERANCE && Math.abs(d[j + 3] - ta) <= FILL_TOLERANCE
  }
  const paint = (i: number): void => { const j = i * 4; d[j] = fr; d[j + 1] = fg; d[j + 2] = fb; d[j + 3] = 255 }
  const stack: number[] = [sx, sy]
  while (stack.length > 0) {
    const y = stack.pop() as number
    const x = stack.pop() as number
    let x0 = x
    while (x0 >= 0 && visited[y * width + x0] === 0 && matches(y * width + x0)) x0--
    x0++
    let spanAbove = false, spanBelow = false
    for (let xi = x0; xi < width && visited[y * width + xi] === 0 && matches(y * width + xi); xi++) {
      const i = y * width + xi
      paint(i); visited[i] = 1
      if (y > 0) {
        const up = (y - 1) * width + xi
        const m = visited[up] === 0 && matches(up)
        if (m && !spanAbove) { stack.push(xi, y - 1); spanAbove = true } else if (!m) spanAbove = false
      }
      if (y < height - 1) {
        const down = (y + 1) * width + xi
        const m = visited[down] === 0 && matches(down)
        if (m && !spanBelow) { stack.push(xi, y + 1); spanBelow = true } else if (!m) spanBelow = false
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  return true
}

function pad(n: number): string { return String(n).padStart(2, '0') }

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  const head = Math.max(8, w * 3)
  const ang = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6))
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6))
  ctx.closePath(); ctx.fill()
}

function toolHint(tool: Tool): string {
  switch (tool) {
    case 'select': return '영역을 끌어 선택 → 안쪽을 드래그해 이동, Delete 삭제, Ctrl+C 복사'
    case 'text': return '캔버스를 클릭해 위치를 정하고 입력하세요 (여러 줄 가능)'
    case 'eyedropper': return '캔버스를 클릭하면 그 지점 색을 가져옵니다'
    case 'fill': return '닫힌 영역을 클릭해 현재 색으로 채웁니다'
    case 'eraser': return '원형 지우개 — 굵기 슬라이더로 크기 조절'
    default: return '이미지 붙여넣기(Ctrl+V)·파일 열기(Ctrl+O) 지원'
  }
}

/** 그림판 — 윈도우 그림판 수준: 펜/형광펜/지우개/채우기/스포이드/도형/텍스트/선택, 파일 열기, 클립보드, undo·redo */
export function PaintCanvas({ editor, onClose }: PaintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState(4)
  const [fontSize, setFontSize] = useState(28)
  const [sizeKey, setSizeKey] = useState<SizeKey>('medium')
  const [recent, setRecent] = useState<string[]>([])
  const [histLen, setHistLen] = useState({ undo: 0, redo: 0 })
  const [dirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState<'none' | 'clear' | 'close'>('none')
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)

  const drawing = useRef(false)
  const startPt = useRef<Pt | null>(null)
  const lastPt = useRef<Pt | null>(null)
  const prevMid = useRef<Pt | null>(null)
  const snapshot = useRef<ImageData | null>(null)
  const undoStack = useRef<ImageData[]>([])
  const redoStack = useRef<ImageData[]>([])
  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  const sizeRef = useRef(size)
  const fontSizeRef = useRef(fontSize)
  const shiftRef = useRef(false)
  const selection = useRef<Selection | null>(null)
  const textDraftRef = useRef<TextDraft | null>(null)

  toolRef.current = tool
  colorRef.current = color
  sizeRef.current = size
  fontSizeRef.current = fontSize
  textDraftRef.current = textDraft

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null, [])
  const getOverlay = useCallback(() => overlayRef.current?.getContext('2d') ?? null, [])
  const syncHistLen = useCallback(() => setHistLen({ undo: undoStack.current.length, redo: redoStack.current.length }), [])

  useEffect(() => {
    const ctx = getCtx()
    const c = canvasRef.current
    if (!c || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearOverlay() {
    const octx = getOverlay()
    const ov = overlayRef.current
    if (octx && ov) octx.clearRect(0, 0, ov.width, ov.height)
  }

  function pushHistory() {
    const ctx = getCtx()
    const c = canvasRef.current
    if (!ctx || !c) return
    undoStack.current.push(ctx.getImageData(0, 0, c.width, c.height))
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift()
    redoStack.current = []
    syncHistLen()
  }

  function commitFloatingSelection() {
    const sel = selection.current
    const ctx = getCtx()
    if (!sel || !sel.floated || !ctx) return
    ctx.putImageData(sel.data, Math.round(sel.rect.x), Math.round(sel.rect.y))
    selection.current = null
    clearOverlay()
  }

  function commitText() {
    const draft = textDraftRef.current
    const ctx = getCtx()
    if (!draft || !ctx) { setTextDraft(null); return }
    if (draft.value.trim()) {
      pushHistory()
      ctx.fillStyle = colorRef.current
      ctx.font = `${fontSizeRef.current}px "Malgun Gothic", "맑은 고딕", sans-serif`
      ctx.textBaseline = 'top'
      draft.value.split('\n').forEach((line, i) => ctx.fillText(line, draft.cx, draft.cy + i * fontSizeRef.current * 1.25))
      setDirty(true)
      rememberColor(colorRef.current)
    }
    setTextDraft(null)
  }

  const undo = useCallback(() => {
    const ctx = getCtx()
    const c = canvasRef.current
    if (!ctx || !c || undoStack.current.length === 0) return
    commitFloatingSelection()
    redoStack.current.push(ctx.getImageData(0, 0, c.width, c.height))
    const prev = undoStack.current.pop()!
    if (prev.width !== c.width || prev.height !== c.height) {
      c.width = prev.width; c.height = prev.height
      const ov = overlayRef.current
      if (ov) { ov.width = prev.width; ov.height = prev.height }
      const found = CANVAS_SIZES.find((s) => s.w === prev.width && s.h === prev.height)
      if (found) setSizeKey(found.key)
    }
    ctx.putImageData(prev, 0, 0)
    selection.current = null
    clearOverlay()
    syncHistLen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCtx])

  const redo = useCallback(() => {
    const ctx = getCtx()
    const c = canvasRef.current
    if (!ctx || !c || redoStack.current.length === 0) return
    undoStack.current.push(ctx.getImageData(0, 0, c.width, c.height))
    const next = redoStack.current.pop()!
    if (next.width !== c.width || next.height !== c.height) {
      c.width = next.width; c.height = next.height
      const ov = overlayRef.current
      if (ov) { ov.width = next.width; ov.height = next.height }
      const found = CANVAS_SIZES.find((s) => s.w === next.width && s.h === next.height)
      if (found) setSizeKey(found.key)
    }
    ctx.putImageData(next, 0, 0)
    syncHistLen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCtx])

  function rememberColor(hex: string) {
    setRecent((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 8))
  }

  function toCanvas(e: React.PointerEvent): Pt {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const sx = c.width / r.width
    const sy = c.height / r.height
    const pressure = e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 0.5
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy, p: pressure }
  }

  function penWidth(p: number): number {
    return Math.max(0.5, sizeRef.current * (0.6 + p * 0.8))
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!e.isPrimary || e.button !== 0) return
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    setConfirm('none')
    const pt = toCanvas(e)
    const t = toolRef.current

    if (t === 'eyedropper') {
      const px = ctx.getImageData(Math.max(0, Math.floor(pt.x)), Math.max(0, Math.floor(pt.y)), 1, 1).data
      const hex = rgbToHex(px[0], px[1], px[2])
      setColor(hex); rememberColor(hex); setTool('pen')
      return
    }

    if (t === 'text') {
      if (textDraftRef.current) commitText()
      const r = c.getBoundingClientRect()
      setTextDraft({ cx: pt.x, cy: pt.y, dx: e.clientX - r.left, dy: e.clientY - r.top, scale: r.width / c.width, value: '' })
      return
    }
    if (textDraftRef.current) commitText()

    if (t === 'fill') {
      pushHistory()
      const changed = floodFill(ctx, Math.floor(pt.x), Math.floor(pt.y), colorRef.current)
      if (changed) { setDirty(true); rememberColor(colorRef.current) }
      else { undoStack.current.pop(); syncHistLen() }
      return
    }

    if (t === 'select') {
      const sel = selection.current
      if (sel && pt.x >= sel.rect.x && pt.x <= sel.rect.x + sel.rect.w && pt.y >= sel.rect.y && pt.y <= sel.rect.y + sel.rect.h) {
        if (!sel.floated) {
          pushHistory()
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h)
          sel.floated = true
          setDirty(true)
        }
        sel.dragging = true
        sel.offsetX = pt.x - sel.rect.x
        sel.offsetY = pt.y - sel.rect.y
        try { c.setPointerCapture(e.pointerId) } catch { /* 합성/무포인터 시 무시 */ }
        return
      }
      commitFloatingSelection()
      selection.current = { rect: { x: pt.x, y: pt.y, w: 0, h: 0 }, data: new ImageData(1, 1), dragging: false, offsetX: 0, offsetY: 0, floated: false }
      drawing.current = true
      startPt.current = pt
      try { c.setPointerCapture(e.pointerId) } catch { /* 무시 */ }
      return
    }

    pushHistory()
    drawing.current = true
    try { c.setPointerCapture(e.pointerId) } catch { /* 무시 */ }
    startPt.current = pt
    lastPt.current = pt
    prevMid.current = pt
    snapshot.current = ctx.getImageData(0, 0, c.width, c.height)

    if (t === 'pen') {
      ctx.fillStyle = colorRef.current
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, penWidth(pt.p) / 2, 0, Math.PI * 2)
      ctx.fill()
    } else if (t === 'eraser') {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, sizeRef.current * 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    const pt = toCanvas(e)
    const t = toolRef.current

    drawCursorPreview(pt)

    if (t === 'select' && selection.current?.dragging) {
      const sel = selection.current
      sel.rect.x = pt.x - sel.offsetX
      sel.rect.y = pt.y - sel.offsetY
      renderSelectionOverlay()
      return
    }
    if (t === 'select' && drawing.current && startPt.current && selection.current) {
      const s = startPt.current
      selection.current.rect = { x: Math.min(s.x, pt.x), y: Math.min(s.y, pt.y), w: Math.abs(pt.x - s.x), h: Math.abs(pt.y - s.y) }
      renderSelectionOverlay()
      return
    }

    if (!drawing.current) return
    const start = startPt.current
    if (!start) return

    if (t === 'pen' || t === 'highlighter' || t === 'eraser') {
      const last = lastPt.current ?? pt
      const mid = { x: (last.x + pt.x) / 2, y: (last.y + pt.y) / 2, p: pt.p }
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (t === 'highlighter') {
        ctx.strokeStyle = colorRef.current; ctx.globalAlpha = 0.35; ctx.lineWidth = sizeRef.current * 3
      } else if (t === 'eraser') {
        ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 1; ctx.lineWidth = sizeRef.current * 3
      } else {
        ctx.strokeStyle = colorRef.current; ctx.globalAlpha = 1; ctx.lineWidth = penWidth(pt.p)
      }
      ctx.beginPath()
      ctx.moveTo((prevMid.current ?? last).x, (prevMid.current ?? last).y)
      ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y)
      ctx.stroke()
      ctx.globalAlpha = 1
      prevMid.current = mid
      lastPt.current = pt
      return
    }

    if (snapshot.current) ctx.putImageData(snapshot.current, 0, 0)
    let ex = pt.x, ey = pt.y
    if (shiftRef.current) {
      if (t === 'line' || t === 'arrow') {
        const dx = pt.x - start.x, dy = pt.y - start.y
        if (Math.abs(dx) > Math.abs(dy) * 2) ey = start.y
        else if (Math.abs(dy) > Math.abs(dx) * 2) ex = start.x
        else { const d = Math.min(Math.abs(dx), Math.abs(dy)); ex = start.x + Math.sign(dx) * d; ey = start.y + Math.sign(dy) * d }
      } else {
        const d = Math.min(Math.abs(pt.x - start.x), Math.abs(pt.y - start.y))
        ex = start.x + Math.sign(pt.x - start.x) * d
        ey = start.y + Math.sign(pt.y - start.y) * d
      }
    }
    ctx.strokeStyle = colorRef.current
    ctx.fillStyle = colorRef.current
    ctx.lineWidth = sizeRef.current
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (t === 'line') { ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(ex, ey); ctx.stroke() }
    else if (t === 'arrow') drawArrow(ctx, start.x, start.y, ex, ey, sizeRef.current)
    else if (t === 'rect') ctx.strokeRect(start.x, start.y, ex - start.x, ey - start.y)
    else if (t === 'ellipse') {
      ctx.beginPath()
      ctx.ellipse((start.x + ex) / 2, (start.y + ey) / 2, Math.abs(ex - start.x) / 2, Math.abs(ey - start.y) / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current
    const ctx = getCtx()
    const t = toolRef.current

    if (t === 'select') {
      if (selection.current?.dragging) {
        selection.current.dragging = false
        renderSelectionOverlay()
      } else if (drawing.current && selection.current && ctx && c) {
        drawing.current = false
        const rc = selection.current.rect
        if (rc.w >= 3 && rc.h >= 3) {
          const rx = Math.max(0, Math.round(rc.x)), ry = Math.max(0, Math.round(rc.y))
          const rw = Math.min(c.width - rx, Math.round(rc.w)), rh = Math.min(c.height - ry, Math.round(rc.h))
          selection.current.data = ctx.getImageData(rx, ry, rw, rh)
          selection.current.rect = { x: rx, y: ry, w: rw, h: rh }
          renderSelectionOverlay()
        } else {
          selection.current = null
          clearOverlay()
        }
      }
      try { if (c) c.releasePointerCapture(e.pointerId) } catch { /* 이미 해제됨 */ }
      return
    }

    if (drawing.current) {
      drawing.current = false
      setDirty(true)
      if (t !== 'eraser') rememberColor(colorRef.current)
      try { if (c) c.releasePointerCapture(e.pointerId) } catch { /* 이미 해제됨 */ }
    }
  }

  function handlePointerLeave() {
    if (!drawing.current && toolRef.current !== 'select') clearOverlay()
  }

  function drawCursorPreview(pt: Pt) {
    const octx = getOverlay()
    const ov = overlayRef.current
    if (!octx || !ov) return
    const t = toolRef.current
    if (t === 'select') { renderSelectionOverlay(); return }
    octx.clearRect(0, 0, ov.width, ov.height)
    if (t === 'eraser' || t === 'pen' || t === 'highlighter') {
      const radius = t === 'eraser' ? sizeRef.current * 1.5 : t === 'highlighter' ? sizeRef.current * 1.5 : penWidth(pt.p) / 2
      octx.beginPath()
      octx.arc(pt.x, pt.y, Math.max(2, radius), 0, Math.PI * 2)
      octx.strokeStyle = t === 'eraser' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)'
      octx.lineWidth = 1
      octx.setLineDash(t === 'eraser' ? [4, 3] : [])
      octx.stroke()
      octx.setLineDash([])
    }
  }

  function renderSelectionOverlay() {
    const octx = getOverlay()
    const ov = overlayRef.current
    const sel = selection.current
    if (!octx || !ov) return
    octx.clearRect(0, 0, ov.width, ov.height)
    if (!sel) return
    if (sel.floated) {
      const tmp = document.createElement('canvas')
      tmp.width = sel.data.width; tmp.height = sel.data.height
      tmp.getContext('2d')!.putImageData(sel.data, 0, 0)
      octx.drawImage(tmp, Math.round(sel.rect.x), Math.round(sel.rect.y))
    }
    octx.strokeStyle = '#1E88E5'
    octx.lineWidth = 1
    octx.setLineDash([5, 4])
    octx.strokeRect(sel.rect.x + 0.5, sel.rect.y + 0.5, sel.rect.w, sel.rect.h)
    octx.setLineDash([])
  }

  function openImageFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const img = new Image()
      img.onload = () => {
        const c = canvasRef.current
        const ctx = getCtx()
        if (!c || !ctx) return
        pushHistory()
        const scale = Math.min(1, c.width / img.width, c.height / img.height)
        const w = img.width * scale, h = img.height * scale
        ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h)
        setDirty(true)
        URL.revokeObjectURL(img.src)
      }
      img.src = URL.createObjectURL(file)
    }
    input.click()
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (textDraftRef.current) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          e.preventDefault()
          const img = new Image()
          img.onload = () => {
            const c = canvasRef.current
            const ctx = getCtx()
            if (!c || !ctx) return
            pushHistory()
            ctx.drawImage(img, 10, 10)
            setDirty(true)
            URL.revokeObjectURL(img.src)
          }
          img.src = URL.createObjectURL(file)
          return
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (textDraftRef.current) return
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }
      if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); openImageFile(); return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.current) {
        e.preventDefault()
        const ctx = getCtx()
        const sel = selection.current
        if (ctx) {
          if (!sel.floated) { pushHistory(); ctx.fillStyle = '#ffffff'; ctx.fillRect(sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h) }
          setDirty(true)
        }
        selection.current = null
        clearOverlay()
        return
      }
      if (ctrl && e.key.toLowerCase() === 'c' && selection.current) { e.preventDefault(); copySelectionToClipboard(); return }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (textDraftRef.current) { commitText(); return }
        if (selection.current) { commitFloatingSelection(); return }
        requestClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo])

  async function copySelectionToClipboard() {
    const sel = selection.current
    if (!sel) return
    try {
      const tmp = document.createElement('canvas')
      tmp.width = sel.data.width; tmp.height = sel.data.height
      tmp.getContext('2d')!.putImageData(sel.data, 0, 0)
      const blob = await new Promise<Blob | null>((res) => tmp.toBlob(res, 'image/png'))
      if (blob && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      }
    } catch { /* 클립보드 권한 없으면 무시 */ }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  function changeSize(key: SizeKey) {
    const target = CANVAS_SIZES.find((s) => s.key === key)!
    const c = canvasRef.current
    const ov = overlayRef.current
    const ctx = getCtx()
    if (!c || !ctx || (c.width === target.w && c.height === target.h)) { setSizeKey(key); return }
    commitFloatingSelection()
    pushHistory()
    const old = document.createElement('canvas')
    old.width = c.width; old.height = c.height
    old.getContext('2d')!.drawImage(c, 0, 0)
    c.width = target.w; c.height = target.h
    if (ov) { ov.width = target.w; ov.height = target.h }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(old, 0, 0)
    setSizeKey(key)
    setDirty(true)
  }

  function clearCanvas() {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    pushHistory()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    selection.current = null
    clearOverlay()
    setDirty(false)
    setConfirm('none')
  }

  function fileStamp(): string {
    const d = new Date()
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  }

  function downloadPng() {
    commitText(); commitFloatingSelection()
    const c = canvasRef.current
    if (!c) return
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `그림-${fileStamp()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function insertToMemo() {
    commitText(); commitFloatingSelection()
    const c = canvasRef.current
    if (!c || !editor) return
    editor.chain().focus().setImage({ src: c.toDataURL('image/png') }).run()
    setDirty(false)
    onClose()
  }

  function requestClose() {
    if (textDraftRef.current) commitText()
    if (dirty) { setConfirm('close'); return }
    onClose()
  }

  const activeSize = CANVAS_SIZES.find((s) => s.key === sizeKey)!

  return (
    <div className="jan-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose() }}>
      <div className="jan-modal jan-paint-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>그림판</h3>
          <button className="jan-modal-close" onClick={requestClose} aria-label="닫기">닫기</button>
        </div>

        <div className="pcx-body">
          <div className="pcx-toolbar" role="toolbar" aria-label="그리기 도구">
            <button type="button" className="pcx-btn" onClick={openImageFile} aria-label="이미지 파일 열기" title="이미지 파일 열기 (Ctrl+O)">열기</button>
            <span className="pcx-sep" />
            {TOOLS.map((tl) => (
              <button
                key={tl.id}
                type="button"
                className={'pcx-tool' + (tool === tl.id ? ' is-active' : '')}
                aria-pressed={tool === tl.id}
                aria-label={tl.label}
                title={tl.title}
                onClick={() => { commitText(); setTool(tl.id) }}
              >{tl.label}</button>
            ))}
            <span className="pcx-sep" />
            <button type="button" className="pcx-btn" onClick={undo} disabled={histLen.undo === 0} aria-label="되돌리기" title="되돌리기 (Ctrl+Z)">되돌리기</button>
            <button type="button" className="pcx-btn" onClick={redo} disabled={histLen.redo === 0} aria-label="다시 실행" title="다시 실행 (Ctrl+Y)">다시 실행</button>
            <button type="button" className="pcx-btn" onClick={() => setConfirm('clear')} aria-label="전체 지우기" title="전체 지우기">전체 지우기</button>
          </div>

          <div className="pcx-options">
            <div className="pcx-swatches" role="group" aria-label="색상 팔레트">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={'pcx-swatch' + (color === c ? ' is-active' : '')}
                  style={{ background: c }}
                  aria-label={`색상 ${c}`}
                  aria-pressed={color === c}
                  title={c}
                  onClick={() => setColor(c)}
                />
              ))}
              <label className="pcx-color-custom" title="사용자 지정 색상">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="사용자 지정 색상" />
                <span>+</span>
              </label>
            </div>

            {recent.length > 0 && (
              <div className="pcx-recent" role="group" aria-label="최근 사용 색상">
                {recent.map((c, i) => (
                  <button key={c + i} type="button" className="pcx-swatch pcx-swatch-sm" style={{ background: c }} aria-label={`최근 색상 ${c}`} title={c} onClick={() => setColor(c)} />
                ))}
              </div>
            )}

            <div className="pcx-slider">
              <label>
                <span>굵기</span>
                <input type="range" min={1} max={40} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="선 굵기" />
                <i className="pcx-size-dot" style={{ width: Math.min(28, size), height: Math.min(28, size), background: color }} />
                <b>{size}</b>
              </label>
            </div>

            {tool === 'text' && (
              <div className="pcx-slider">
                <label>
                  <span>글자 크기</span>
                  <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} aria-label="글자 크기">
                    {FONT_SIZES.map((n) => <option key={n} value={n}>{n}px</option>)}
                  </select>
                </label>
              </div>
            )}

            <div className="pcx-canvas-sizes" role="group" aria-label="캔버스 크기">
              {CANVAS_SIZES.map((s) => (
                <button key={s.key} type="button" className={'pcx-btn' + (sizeKey === s.key ? ' is-active' : '')} aria-pressed={sizeKey === s.key} title={s.title} onClick={() => changeSize(s.key)}>{s.label}</button>
              ))}
            </div>
          </div>

          <div className="pcx-canvas-scroll">
            <div className="pcx-canvas-box" style={{ width: activeSize.w, height: activeSize.h }}>
              <canvas
                ref={canvasRef}
                width={activeSize.w}
                height={activeSize.h}
                className={'pcx-canvas pcx-tool-' + tool}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                style={{ touchAction: 'none' }}
              />
              <canvas ref={overlayRef} width={activeSize.w} height={activeSize.h} className="pcx-overlay" aria-hidden="true" />
              {textDraft && (
                <textarea
                  className="pcx-text-input"
                  autoFocus
                  value={textDraft.value}
                  onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                  onBlur={commitText}
                  onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); commitText() } e.stopPropagation() }}
                  aria-label="캔버스에 넣을 텍스트 입력"
                  placeholder="입력 후 바깥 클릭"
                  style={{ left: textDraft.dx, top: textDraft.dy, color, fontSize: fontSize * textDraft.scale, lineHeight: 1.25 }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="pcx-foot">
          <span className="pcx-foot-note">{toolHint(tool)}</span>
          <span className="flex-spacer" />
          <button type="button" className="pcx-btn" onClick={downloadPng} aria-label="PNG 파일로 다운로드" title="PNG 다운로드">PNG 다운로드</button>
          <button type="button" className="pcx-btn pcx-btn-primary" onClick={insertToMemo} disabled={!editor} aria-label="메모에 삽입" title="메모에 이미지로 삽입">메모에 삽입</button>
        </div>

        {confirm === 'clear' && (
          <div className="pcx-confirm" role="alertdialog" aria-label="전체 지우기 확인">
            <span>캔버스를 모두 지울까요? (되돌리기 가능)</span>
            <button type="button" className="pcx-btn pcx-btn-primary" onClick={clearCanvas}>지우기</button>
            <button type="button" className="pcx-btn" onClick={() => setConfirm('none')}>취소</button>
          </div>
        )}
        {confirm === 'close' && (
          <div className="pcx-confirm" role="alertdialog" aria-label="닫기 확인">
            <span>그림이 저장되지 않았습니다 — 삽입하지 않고 닫을까요?</span>
            <button type="button" className="pcx-btn pcx-btn-primary" onClick={onClose}>닫기</button>
            <button type="button" className="pcx-btn" onClick={() => setConfirm('none')}>계속 그리기</button>
          </div>
        )}
      </div>
    </div>
  )
}

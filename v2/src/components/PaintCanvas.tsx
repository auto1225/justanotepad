import { useEffect, useRef, useState } from 'react'
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

const TOOLS: ReadonlyArray<{ id: Tool; label: string; title: string }> = [
  { id: 'pen', label: '펜', title: '펜 — 부드러운 자유 곡선 (필압 지원)' },
  { id: 'highlighter', label: '형광펜', title: '형광펜 — 반투명 굵은 선' },
  { id: 'eraser', label: '지우개', title: '지우개' },
  { id: 'fill', label: '채우기', title: '채우기 — 클릭한 영역을 현재 색으로 채우기' },
  { id: 'line', label: '직선', title: '직선' },
  { id: 'arrow', label: '화살표', title: '화살표' },
  { id: 'rect', label: '사각형', title: '사각형' },
  { id: 'ellipse', label: '타원', title: '타원' },
  { id: 'text', label: '텍스트', title: '텍스트 — 캔버스를 클릭해 입력' },
]

const PALETTE = [
  '#000000',
  '#6B7280',
  '#E53935',
  '#FB8C00',
  '#FDD835',
  '#43A047',
  '#00897B',
  '#1E88E5',
  '#3949AB',
  '#8E24AA',
  '#D81B60',
  '#6D4C41',
]

const CANVAS_SIZES = [
  { key: 'small', label: '소', title: '캔버스 크기 소 (640×400)', w: 640, h: 400 },
  { key: 'medium', label: '중', title: '캔버스 크기 중 (800×500)', w: 800, h: 500 },
  { key: 'large', label: '대', title: '캔버스 크기 대 (1024×640)', w: 1024, h: 640 },
] as const
type SizeKey = (typeof CANVAS_SIZES)[number]['key']

const MAX_HISTORY = 40 // undo 스택 최대 깊이
const FILL_TOLERANCE = 32 // 채우기 색상 허용 오차(안티앨리어싱 경계 흡수용)

interface Pt {
  x: number
  y: number
  p: number // 필압 (0~1, 마우스는 0.5)
}

interface TextDraft {
  cx: number // 캔버스 좌표
  cy: number
  dx: number // 캔버스 박스 기준 표시 좌표(px)
  dy: number
  scale: number // 표시 크기 / 실제 픽셀 크기
  value: string
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

/**
 * 반복형(스택 기반) 스캔라인 플러드 필.
 * 재귀를 쓰지 않으므로 큰 영역에서도 스택 오버플로 없음.
 * 변화가 있었으면 true를 반환.
 */
function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, hex: string): boolean {
  const { width, height } = ctx.canvas
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false
  const img = ctx.getImageData(0, 0, width, height)
  const d = img.data
  const startIdx = (sy * width + sx) * 4
  const tr = d[startIdx]
  const tg = d[startIdx + 1]
  const tb = d[startIdx + 2]
  const ta = d[startIdx + 3]
  const [fr, fg, fb] = hexToRgb(hex)
  // 대상 색이 채우기 색과 사실상 같으면 아무 것도 하지 않음
  if (
    Math.abs(tr - fr) <= FILL_TOLERANCE &&
    Math.abs(tg - fg) <= FILL_TOLERANCE &&
    Math.abs(tb - fb) <= FILL_TOLERANCE &&
    ta === 255
  ) {
    return false
  }

  const visited = new Uint8Array(width * height)
  const matches = (i: number): boolean => {
    const j = i * 4
    return (
      Math.abs(d[j] - tr) <= FILL_TOLERANCE &&
      Math.abs(d[j + 1] - tg) <= FILL_TOLERANCE &&
      Math.abs(d[j + 2] - tb) <= FILL_TOLERANCE &&
      Math.abs(d[j + 3] - ta) <= FILL_TOLERANCE
    )
  }
  const paint = (i: number): void => {
    const j = i * 4
    d[j] = fr
    d[j + 1] = fg
    d[j + 2] = fb
    d[j + 3] = 255
  }

  // 스택에는 (x, y) 쌍을 평탄하게 저장
  const stack: number[] = [sx, sy]
  while (stack.length > 0) {
    const y = stack.pop() as number
    const x = stack.pop() as number
    // 스팬의 왼쪽 끝까지 이동
    let x0 = x
    while (x0 >= 0 && visited[y * width + x0] === 0 && matches(y * width + x0)) x0--
    x0++
    let spanAbove = false
    let spanBelow = false
    for (let xi = x0; xi < width && visited[y * width + xi] === 0 && matches(y * width + xi); xi++) {
      const i = y * width + xi
      paint(i)
      visited[i] = 1
      if (y > 0) {
        const up = (y - 1) * width + xi
        const m = visited[up] === 0 && matches(up)
        if (m && !spanAbove) {
          stack.push(xi, y - 1)
          spanAbove = true
        } else if (!m) {
          spanAbove = false
        }
      }
      if (y < height - 1) {
        const down = (y + 1) * width + xi
        const m = visited[down] === 0 && matches(down)
        if (m && !spanBelow) {
          stack.push(xi, y + 1)
          spanBelow = true
        } else if (!m) {
          spanBelow = false
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  return true
}

/** 그림판 — 펜/형광펜/도형/텍스트/채우기, undo·redo, 크기 변경, 더티 가드 지원 */
export function PaintCanvas({ editor, onClose }: PaintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState(4)
  const [sizeKey, setSizeKey] = useState<SizeKey>('medium')
  const [recent, setRecent] = useState<string[]>([])
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [confirm, setConfirm] = useState<'none' | 'clear' | 'close'>('none')
  const [dirty, setDirty] = useState(false)
  // undo/redo 스택 본체는 ref에 두고, 버튼 활성화용 길이만 상태로 미러링
  const [histLen, setHistLen] = useState({ undo: 0, redo: 0 })

  const undoStack = useRef<ImageData[]>([])
  const redoStack = useRef<ImageData[]>([])
  const drawing = useRef(false)
  const startPt = useRef<Pt | null>(null)
  const lastPt = useRef<Pt | null>(null)
  const prevMid = useRef<Pt | null>(null)
  const strokePts = useRef<Pt[]>([])
  const snapshot = useRef<ImageData | null>(null)
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => undefined)

  const canUndo = histLen.undo > 0
  const canRedo = histLen.redo > 0
  const isDirty = dirty || (textDraft !== null && textDraft.value.trim() !== '')

  function syncHistLen() {
    setHistLen({ undo: undoStack.current.length, redo: redoStack.current.length })
  }

  function getCtx(): CanvasRenderingContext2D | null {
    return canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null
  }

  // 최초 마운트 시 흰 배경으로 초기화
  useEffect(() => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d', { willReadFrequently: true })
    if (!c || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }, [])

  function pushHistory() {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    undoStack.current.push(ctx.getImageData(0, 0, c.width, c.height))
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift()
    redoStack.current = []
    syncHistLen()
  }

  // 스냅샷 복원 — 크기 변경 이전 상태면 캔버스 크기까지 함께 되돌림
  function applyHistory(img: ImageData) {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    if (c.width !== img.width || c.height !== img.height) {
      c.width = img.width
      c.height = img.height
      const match = CANVAS_SIZES.find((s) => s.w === img.width && s.h === img.height)
      if (match) setSizeKey(match.key)
    }
    ctx.putImageData(img, 0, 0)
  }

  function undo() {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx || undoStack.current.length === 0) return
    redoStack.current.push(ctx.getImageData(0, 0, c.width, c.height))
    const img = undoStack.current.pop()
    if (img) applyHistory(img)
    syncHistLen()
  }

  function redo() {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx || redoStack.current.length === 0) return
    undoStack.current.push(ctx.getImageData(0, 0, c.width, c.height))
    const img = redoStack.current.pop()
    if (img) applyHistory(img)
    syncHistLen()
  }

  function rememberColor(c: string) {
    setRecent((prev) => [c, ...prev.filter((x) => x !== c)].slice(0, 6))
  }

  function toCanvas(e: React.PointerEvent<HTMLCanvasElement>): Pt {
    const c = canvasRef.current
    if (!c) return { x: 0, y: 0, p: 0.5 }
    const r = c.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
      p: e.pressure > 0 ? e.pressure : 0.5,
    }
  }

  // 필압에 따른 펜 굵기 (마우스 기본 필압 0.5 → 슬라이더 값 그대로)
  function penWidth(p: number): number {
    return Math.max(0.5, size * (0.4 + p * 1.2))
  }

  function highlighterWidth(): number {
    return Math.max(size * 2, 8)
  }

  function textFontSize(): number {
    return 12 + size * 2
  }

  function drawHighlightPath(ctx: CanvasRenderingContext2D) {
    const pts = strokePts.current
    if (pts.length === 0) return
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = highlighterWidth()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (pts.length === 1) {
      ctx.beginPath()
      ctx.arc(pts[0].x, pts[0].y, highlighterWidth() / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2
        const my = (pts[i].y + pts[i + 1].y) / 2
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
      }
      const last = pts[pts.length - 1]
      ctx.lineTo(last.x, last.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawArrowHead(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    const len = Math.max(12, size * 3)
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(b.x - len * Math.cos(angle - Math.PI / 7), b.y - len * Math.sin(angle - Math.PI / 7))
    ctx.lineTo(b.x - len * Math.cos(angle + Math.PI / 7), b.y - len * Math.sin(angle + Math.PI / 7))
    ctx.closePath()
    ctx.fill()
  }

  function drawShapePreview(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (tool === 'line' || tool === 'arrow') {
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      if (tool === 'arrow') drawArrowHead(ctx, a, b)
    } else if (tool === 'rect') {
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y)
    } else if (tool === 'ellipse') {
      ctx.beginPath()
      ctx.ellipse(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        Math.abs(b.x - a.x) / 2,
        Math.abs(b.y - a.y) / 2,
        0,
        0,
        Math.PI * 2,
      )
      ctx.stroke()
    }
  }

  function commitText() {
    const draft = textDraft
    setTextDraft(null)
    if (!draft || draft.value.trim() === '') return
    const ctx = getCtx()
    if (!ctx) return
    pushHistory()
    ctx.fillStyle = color
    ctx.font = `${textFontSize()}px "Noto Sans KR", "Malgun Gothic", sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(draft.value, draft.cx, draft.cy)
    setDirty(true)
    rememberColor(color)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!e.isPrimary || e.button !== 0) return
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    setConfirm('none')
    const pt = toCanvas(e)

    if (tool === 'text') {
      if (textDraft) commitText() // 입력 중이던 텍스트는 커밋하고 새 위치에서 시작
      const r = c.getBoundingClientRect()
      setTextDraft({
        cx: pt.x,
        cy: pt.y,
        dx: e.clientX - r.left,
        dy: e.clientY - r.top,
        scale: r.width / c.width,
        value: '',
      })
      return
    }
    if (textDraft) commitText()

    if (tool === 'fill') {
      pushHistory()
      const changed = floodFill(ctx, Math.floor(pt.x), Math.floor(pt.y), color)
      if (changed) {
        setDirty(true)
        rememberColor(color)
      } else {
        // 변화가 없으면 방금 쌓은 히스토리를 되돌림
        undoStack.current.pop()
        syncHistLen()
      }
      return
    }

    pushHistory()
    drawing.current = true
    c.setPointerCapture(e.pointerId)
    startPt.current = pt
    lastPt.current = pt
    prevMid.current = pt
    strokePts.current = [pt]
    snapshot.current = ctx.getImageData(0, 0, c.width, c.height)

    // 탭(클릭)만 해도 점이 찍히도록 시작점을 렌더
    if (tool === 'pen') {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, penWidth(pt.p) / 2, 0, Math.PI * 2)
      ctx.fill()
    } else if (tool === 'eraser') {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2)
      ctx.fill()
    } else if (tool === 'highlighter') {
      drawHighlightPath(ctx)
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !e.isPrimary) return
    const c = canvasRef.current
    const ctx = getCtx()
    const start = startPt.current
    const last = lastPt.current
    if (!c || !ctx || !start || !last) return
    const pt = toCanvas(e)

    if (tool === 'pen' || tool === 'eraser') {
      // 중간점을 제어점으로 쓰는 이차 곡선으로 부드럽게 연결
      const mid = { x: (last.x + pt.x) / 2, y: (last.y + pt.y) / 2, p: pt.p }
      const pm = prevMid.current ?? last
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
      ctx.lineWidth = tool === 'eraser' ? size * 2 : penWidth(pt.p)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(pm.x, pm.y)
      ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y)
      ctx.stroke()
      prevMid.current = mid
      lastPt.current = pt
      return
    }

    if (tool === 'highlighter') {
      // 반투명 선은 겹침 얼룩을 막기 위해 매번 전체 스트로크를 다시 그림
      strokePts.current.push(pt)
      if (snapshot.current) ctx.putImageData(snapshot.current, 0, 0)
      drawHighlightPath(ctx)
      lastPt.current = pt
      return
    }

    // 도형 미리보기: 스냅샷 복원 후 다시 그림
    if (snapshot.current) ctx.putImageData(snapshot.current, 0, 0)
    drawShapePreview(ctx, start, pt)
    lastPt.current = pt
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !e.isPrimary) return
    drawing.current = false
    setDirty(true)
    if (tool !== 'eraser') rememberColor(color)
    startPt.current = null
    lastPt.current = null
    prevMid.current = null
    strokePts.current = []
    snapshot.current = null
  }

  function clearAll() {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    if (textDraft) setTextDraft(null)
    pushHistory()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    setDirty(false)
    setConfirm('none')
  }

  function changeCanvasSize(key: SizeKey) {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    const preset = CANVAS_SIZES.find((s) => s.key === key)
    if (!preset) return
    if (c.width === preset.w && c.height === preset.h) {
      setSizeKey(key)
      return
    }
    if (textDraft) commitText()
    pushHistory()
    // 기존 그림을 임시 캔버스에 복사해 두었다가 새 크기 위에 다시 그림
    const old = document.createElement('canvas')
    old.width = c.width
    old.height = c.height
    old.getContext('2d')?.drawImage(c, 0, 0)
    c.width = preset.w
    c.height = preset.h
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(old, 0, 0)
    setSizeKey(key)
  }

  function insertToEditor() {
    if (textDraft) commitText()
    const c = canvasRef.current
    if (!editor || !c) return
    editor.chain().focus().setImage({ src: c.toDataURL('image/png') }).run()
    setDirty(false)
    onClose()
  }

  function downloadPng() {
    if (textDraft) commitText()
    const c = canvasRef.current
    if (!c) return
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const name = `그림-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function requestClose() {
    if (isDirty) {
      setConfirm('close')
      return
    }
    onClose()
  }

  // 키보드: Esc(더티 가드 포함), Ctrl+Z / Ctrl+Y(Ctrl+Shift+Z)
  // 렌더마다 최신 상태를 캡처한 핸들러를 ref에 갱신해 stale closure를 방지
  useEffect(() => {
    keyHandlerRef.current = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (textDraft) {
          setTextDraft(null)
          return
        }
        if (confirm !== 'none') {
          setConfirm('none')
          return
        }
        requestClose()
        return
      }
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault()
        redo()
      }
    }
  })

  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandlerRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const defaultSize = CANVAS_SIZES.find((s) => s.key === 'medium') ?? CANVAS_SIZES[0]

  return (
    <div
      className="jan-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="jan-modal jan-paint-modal" role="dialog" aria-label="그림판" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>그림판</h3>
          <button type="button" className="jan-modal-close" onClick={requestClose} aria-label="그림판 닫기" title="닫기 (Esc)">
            닫기
          </button>
        </div>
        <div className="jan-modal-body">
          {confirm === 'close' && (
            <div className="pcx-confirm" role="alertdialog" aria-label="닫기 확인">
              <span>그림이 저장되지 않았습니다 — 삽입하지 않고 닫을까요?</span>
              <span className="pcx-confirm-actions">
                <button type="button" className="pcx-btn pcx-btn-danger" onClick={onClose} aria-label="저장하지 않고 닫기">
                  닫기
                </button>
                <button type="button" className="pcx-btn" onClick={() => setConfirm('none')} aria-label="계속 그리기">
                  계속 그리기
                </button>
              </span>
            </div>
          )}
          {confirm === 'clear' && (
            <div className="pcx-confirm" role="alertdialog" aria-label="전체 지우기 확인">
              <span>캔버스 전체를 지울까요? 이 동작은 되돌리기로 복구할 수 있습니다.</span>
              <span className="pcx-confirm-actions">
                <button type="button" className="pcx-btn pcx-btn-danger" onClick={clearAll} aria-label="전체 지우기 실행">
                  전체 지우기
                </button>
                <button type="button" className="pcx-btn" onClick={() => setConfirm('none')} aria-label="전체 지우기 취소">
                  취소
                </button>
              </span>
            </div>
          )}

          <div className="pcx-toolbar" role="toolbar" aria-label="그리기 도구 모음">
            <div className="pcx-row">
              <div className="pcx-group" role="group" aria-label="도구 선택">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={'pcx-btn' + (tool === t.id ? ' is-active' : '')}
                    aria-label={t.label}
                    aria-pressed={tool === t.id}
                    title={t.title}
                    onClick={() => setTool(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <span className="pcx-divider" aria-hidden="true" />
              <div className="pcx-group" role="group" aria-label="편집">
                <button
                  type="button"
                  className="pcx-btn"
                  onClick={undo}
                  disabled={!canUndo}
                  aria-label="되돌리기"
                  title="되돌리기 (Ctrl+Z)"
                >
                  되돌리기
                </button>
                <button
                  type="button"
                  className="pcx-btn"
                  onClick={redo}
                  disabled={!canRedo}
                  aria-label="다시 실행"
                  title="다시 실행 (Ctrl+Y)"
                >
                  다시 실행
                </button>
                <button
                  type="button"
                  className="pcx-btn"
                  onClick={() => setConfirm(confirm === 'clear' ? 'none' : 'clear')}
                  aria-label="전체 지우기"
                  title="캔버스 전체 지우기"
                >
                  전체 지우기
                </button>
              </div>
            </div>

            <div className="pcx-row">
              <div className="pcx-group" role="group" aria-label="색상 팔레트">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={'pcx-swatch' + (c === color ? ' is-active' : '')}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={`색상 ${c}`}
                    aria-pressed={c === color}
                    title={c}
                  />
                ))}
                <input
                  type="color"
                  className="pcx-color-picker"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="사용자 지정 색상 선택"
                  title="사용자 지정 색상"
                />
              </div>
              {recent.length > 0 && (
                <>
                  <span className="pcx-divider" aria-hidden="true" />
                  <span className="pcx-recent-label">최근</span>
                  <div className="pcx-group" role="group" aria-label="최근 사용 색상">
                    {recent.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={'pcx-swatch' + (c === color ? ' is-active' : '')}
                        style={{ background: c }}
                        onClick={() => setColor(c)}
                        aria-label={`최근 색상 ${c}`}
                        title={c}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="pcx-row">
              <label className="pcx-size-label">
                굵기
                <input
                  type="range"
                  min={1}
                  max={32}
                  value={size}
                  onChange={(e) => setSize(parseInt(e.target.value, 10))}
                  aria-label="선 굵기"
                  title={`선 굵기 ${size}px`}
                />
              </label>
              <span className="pcx-size-preview" aria-hidden="true">
                <span
                  className="pcx-size-dot"
                  style={{ width: Math.min(size, 32), height: Math.min(size, 32), background: color }}
                />
              </span>
              <span className="pcx-size-value">{size}px</span>
              <span className="pcx-divider" aria-hidden="true" />
              <div className="pcx-group" role="group" aria-label="캔버스 크기">
                <span className="pcx-recent-label">크기</span>
                {CANVAS_SIZES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={'pcx-btn' + (sizeKey === s.key ? ' is-active' : '')}
                    onClick={() => changeCanvasSize(s.key)}
                    aria-label={s.title}
                    aria-pressed={sizeKey === s.key}
                    title={s.title}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pcx-canvas-scroll">
            <div className="pcx-canvas-box">
              <canvas
                ref={canvasRef}
                width={defaultSize.w}
                height={defaultSize.h}
                className={'pcx-canvas' + (tool === 'text' ? ' is-text' : '')}
                aria-label="그리기 캔버스"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
              {textDraft && (
                <input
                  className="pcx-text-input"
                  style={{
                    left: textDraft.dx,
                    top: textDraft.dy,
                    fontSize: Math.max(10, textFontSize() * textDraft.scale),
                    color,
                  }}
                  value={textDraft.value}
                  onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                  onBlur={commitText}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      commitText()
                    } else if (e.key === 'Escape') {
                      e.stopPropagation()
                      setTextDraft(null)
                    }
                  }}
                  aria-label="캔버스에 넣을 텍스트 입력"
                  placeholder="텍스트 입력 후 Enter"
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="pcx-footer">
            <button type="button" className="pcx-btn" onClick={downloadPng} aria-label="PNG 파일로 다운로드" title="PNG 다운로드">
              PNG 다운로드
            </button>
            <button
              type="button"
              className="pcx-btn pcx-btn-primary"
              onClick={insertToEditor}
              disabled={!editor}
              aria-label="그림을 메모에 삽입"
              title="메모에 삽입"
            >
              메모에 삽입
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

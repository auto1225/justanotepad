import { useEffect, useRef, useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { flash } from '../lib/flash'
import './paint-canvas.css'

interface PaintCanvasProps {
  editor: Editor | null
  onClose: () => void
}

type ShapeType =
  | 'line' | 'curve' | 'ellipse' | 'rect' | 'rrect'
  | 'triangle' | 'rtriangle' | 'diamond' | 'pentagon' | 'hexagon'
  | 'arrow' | 'star' | 'heart' | 'lightning' | 'callout'
  | 'arrowL' | 'arrowR' | 'arrowU' | 'arrowD' | 'plus' | 'star4' | 'star6'

type BrushType = 'round' | 'highlighter' | 'marker' | 'airbrush' | 'crayon' | 'calligraphy'
type Tool = 'pen' | 'brush' | 'eraser' | 'fill' | 'eyedropper' | 'text' | 'select' | 'zoom' | 'shape'
type FillMode = 'outline' | 'both' | 'fill'
type LineStyle = 'solid' | 'dash' | 'dot'
type MenuKey = 'brush' | 'transform' | 'filter' | 'size' | 'export' | null

const SHAPES: ReadonlyArray<{ id: ShapeType; label: string; icon: string }> = [
  { id: 'line', label: '직선', icon: 'line' },
  { id: 'curve', label: '곡선', icon: 'curve' },
  { id: 'ellipse', label: '타원', icon: 'ellipse' },
  { id: 'rect', label: '직사각형', icon: 'rect' },
  { id: 'rrect', label: '둥근 직사각형', icon: 'rrect' },
  { id: 'triangle', label: '삼각형', icon: 'triangle' },
  { id: 'rtriangle', label: '직각삼각형', icon: 'rtriangle' },
  { id: 'diamond', label: '마름모', icon: 'diamond' },
  { id: 'pentagon', label: '오각형', icon: 'pentagon' },
  { id: 'hexagon', label: '육각형', icon: 'hexagon' },
  { id: 'arrow', label: '화살표', icon: 'arrow' },
  { id: 'arrowR', label: '오른쪽 블록화살표', icon: 'arrowR' },
  { id: 'arrowL', label: '왼쪽 블록화살표', icon: 'arrowL' },
  { id: 'arrowU', label: '위쪽 블록화살표', icon: 'arrowU' },
  { id: 'arrowD', label: '아래쪽 블록화살표', icon: 'arrowD' },
  { id: 'plus', label: '십자', icon: 'plus' },
  { id: 'star', label: '별 (5)', icon: 'star' },
  { id: 'star4', label: '별 (4)', icon: 'star4' },
  { id: 'star6', label: '별 (6)', icon: 'star6' },
  { id: 'heart', label: '하트', icon: 'heart' },
  { id: 'lightning', label: '번개', icon: 'lightning' },
  { id: 'callout', label: '말풍선', icon: 'callout' },
]

const BRUSHES: ReadonlyArray<{ id: BrushType; label: string }> = [
  { id: 'round', label: '둥근 붓' },
  { id: 'highlighter', label: '형광펜' },
  { id: 'marker', label: '마커' },
  { id: 'airbrush', label: '에어브러시' },
  { id: 'crayon', label: '크레용' },
  { id: 'calligraphy', label: '캘리그래피' },
]

const FILTERS: ReadonlyArray<{ label: string; f: string }> = [
  { label: '흑백', f: 'grayscale(1)' },
  { label: '색 반전', f: 'invert(1)' },
  { label: '세피아', f: 'sepia(0.85)' },
  { label: '밝게', f: 'brightness(1.15)' },
  { label: '어둡게', f: 'brightness(0.85)' },
  { label: '대비 높이기', f: 'contrast(1.25)' },
  { label: '대비 낮추기', f: 'contrast(0.82)' },
  { label: '채도 높이기', f: 'saturate(1.4)' },
  { label: '채도 낮추기', f: 'saturate(0.65)' },
  { label: '흐리게', f: 'blur(2px)' },
]

const FONT_FAMILIES: ReadonlyArray<{ label: string; css: string }> = [
  { label: '맑은 고딕', css: '"Malgun Gothic", "맑은 고딕", sans-serif' },
  { label: '굴림', css: 'Gulim, "굴림", sans-serif' },
  { label: '바탕', css: 'Batang, "바탕", serif' },
  { label: '세리프', css: 'Georgia, "Times New Roman", serif' },
  { label: '고정폭', css: 'Consolas, "D2Coding", monospace' },
]

const CANVAS_SIZES = [
  { key: 'small', label: '소', title: '캔버스 크기 소 (640×400)', w: 640, h: 400 },
  { key: 'medium', label: '중', title: '캔버스 크기 중 (900×560)', w: 900, h: 560 },
  { key: 'large', label: '대', title: '캔버스 크기 대 (1200×720)', w: 1200, h: 720 },
] as const

const MAX_HISTORY = 50
const FILL_TOLERANCE = 32
const FONT_SIZES = [12, 16, 20, 28, 36, 48, 64]
const ZOOM_MIN = 25
const ZOOM_MAX = 800

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

// ── 도형 기하 ──────────────────────────────────────────────
function boxPolygon(x0: number, y0: number, x1: number, y1: number, n: number): [number, number][] {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const rx = (x1 - x0) / 2, ry = (y1 - y0) / 2
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
  }
  return pts
}
function starPolygon(x0: number, y0: number, x1: number, y1: number, points: number, innerRatio: number): [number, number][] {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const rx = (x1 - x0) / 2, ry = (y1 - y0) / 2
  const pts: [number, number][] = []
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points
    const r = i % 2 === 0 ? 1 : innerRatio
    pts.push([cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)])
  }
  return pts
}
function heartPolygon(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const rx = (x1 - x0) / 2, ry = (y1 - y0) / 2
  const pts: [number, number][] = []
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * Math.PI * 2
    const hx = 16 * Math.pow(Math.sin(t), 3)
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    pts.push([cx + (hx / 17) * rx, cy - (hy / 17) * ry])
  }
  return pts
}
function lightningPolygon(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const unit: [number, number][] = [
    [0.55, 0], [0.15, 0.55], [0.45, 0.55], [0.1, 1], [0.9, 0.42], [0.55, 0.42], [0.85, 0],
  ]
  return unit.map(([ux, uy]) => [x0 + ux * (x1 - x0), y0 + uy * (y1 - y0)])
}
/** 단위 좌표(0..1) 다각형을 드래그 박스에 매핑 */
function unitPolygon(unit: ReadonlyArray<[number, number]>, x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0)
  return unit.map(([ux, uy]) => [x + ux * w, y + uy * h])
}
const ARROW_R_UNIT: ReadonlyArray<[number, number]> = [[0, 0.32], [0.62, 0.32], [0.62, 0.05], [1, 0.5], [0.62, 0.95], [0.62, 0.68], [0, 0.68]]
const ARROW_L_UNIT: ReadonlyArray<[number, number]> = ARROW_R_UNIT.map(([x, y]) => [1 - x, y] as [number, number])
const ARROW_U_UNIT: ReadonlyArray<[number, number]> = ARROW_R_UNIT.map(([x, y]) => [y, 1 - x] as [number, number])
const ARROW_D_UNIT: ReadonlyArray<[number, number]> = ARROW_R_UNIT.map(([x, y]) => [y, x] as [number, number])
const PLUS_UNIT: ReadonlyArray<[number, number]> = [
  [0.35, 0], [0.65, 0], [0.65, 0.35], [1, 0.35], [1, 0.65], [0.65, 0.65], [0.65, 1], [0.35, 1], [0.35, 0.65], [0, 0.65], [0, 0.35], [0.35, 0.35],
]

function tracePolygon(ctx: CanvasRenderingContext2D, pts: [number, number][], close = true) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  if (close) ctx.closePath()
}
function roundedRectPath(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, r: number) {
  const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0)
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
function calloutPath(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0)
  const bodyH = h * 0.72
  const r = Math.min(14, w / 2, bodyH / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + bodyH, r)
  ctx.arcTo(x + w, y + bodyH, x, y + bodyH, r)
  ctx.lineTo(x + w * 0.34, y + bodyH)
  ctx.lineTo(x + w * 0.2, y + h)
  ctx.lineTo(x + w * 0.22, y + bodyH)
  ctx.arcTo(x, y + bodyH, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawArrowLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  const head = Math.max(8, w * 3)
  const ang = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.save()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6))
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6))
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

const CLOSED_SHAPES: ReadonlyArray<ShapeType> = [
  'rect', 'rrect', 'ellipse', 'triangle', 'rtriangle', 'diamond', 'pentagon', 'hexagon',
  'star', 'star4', 'star6', 'heart', 'lightning', 'callout', 'arrowL', 'arrowR', 'arrowU', 'arrowD', 'plus',
]

interface ShapePaint { fillMode: FillMode; fg: string; bg: string }

function drawShape(ctx: CanvasRenderingContext2D, type: ShapeType, x0: number, y0: number, x1: number, y1: number, lineW: number, paintOpt: ShapePaint, curveCtrl?: { x: number; y: number }) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = paintOpt.fg
  const closed = CLOSED_SHAPES.includes(type)
  const finish = () => {
    if (closed) {
      if (paintOpt.fillMode !== 'outline') { ctx.fillStyle = paintOpt.fillMode === 'both' ? paintOpt.bg : paintOpt.fg; ctx.fill() }
      if (paintOpt.fillMode !== 'fill') ctx.stroke()
    } else ctx.stroke()
  }
  switch (type) {
    case 'line': ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); return
    case 'curve': {
      const cx = curveCtrl ? curveCtrl.x : (x0 + x1) / 2
      const cy = curveCtrl ? curveCtrl.y : (y0 + y1) / 2
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke(); return
    }
    case 'arrow': ctx.fillStyle = paintOpt.fg; drawArrowLine(ctx, x0, y0, x1, y1, lineW); return
    case 'rect': ctx.beginPath(); ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); finish(); return
    case 'rrect': roundedRectPath(ctx, x0, y0, x1, y1, Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 0.2); finish(); return
    case 'ellipse':
      ctx.beginPath()
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2)
      finish(); return
    case 'triangle': tracePolygon(ctx, [[(x0 + x1) / 2, Math.min(y0, y1)], [Math.min(x0, x1), Math.max(y0, y1)], [Math.max(x0, x1), Math.max(y0, y1)]]); finish(); return
    case 'rtriangle': tracePolygon(ctx, [[Math.min(x0, x1), Math.min(y0, y1)], [Math.min(x0, x1), Math.max(y0, y1)], [Math.max(x0, x1), Math.max(y0, y1)]]); finish(); return
    case 'diamond': tracePolygon(ctx, boxPolygon(x0, y0, x1, y1, 4)); finish(); return
    case 'pentagon': tracePolygon(ctx, boxPolygon(x0, y0, x1, y1, 5)); finish(); return
    case 'hexagon': tracePolygon(ctx, boxPolygon(x0, y0, x1, y1, 6)); finish(); return
    case 'star': tracePolygon(ctx, starPolygon(x0, y0, x1, y1, 5, 0.42)); finish(); return
    case 'star4': tracePolygon(ctx, starPolygon(x0, y0, x1, y1, 4, 0.35)); finish(); return
    case 'star6': tracePolygon(ctx, starPolygon(x0, y0, x1, y1, 6, 0.55)); finish(); return
    case 'heart': tracePolygon(ctx, heartPolygon(x0, y0, x1, y1)); finish(); return
    case 'lightning': tracePolygon(ctx, lightningPolygon(x0, y0, x1, y1)); finish(); return
    case 'callout': calloutPath(ctx, x0, y0, x1, y1); finish(); return
    case 'arrowR': tracePolygon(ctx, unitPolygon(ARROW_R_UNIT, x0, y0, x1, y1)); finish(); return
    case 'arrowL': tracePolygon(ctx, unitPolygon(ARROW_L_UNIT, x0, y0, x1, y1)); finish(); return
    case 'arrowU': tracePolygon(ctx, unitPolygon(ARROW_U_UNIT, x0, y0, x1, y1)); finish(); return
    case 'arrowD': tracePolygon(ctx, unitPolygon(ARROW_D_UNIT, x0, y0, x1, y1)); finish(); return
    case 'plus': tracePolygon(ctx, unitPolygon(PLUS_UNIT, x0, y0, x1, y1)); finish(); return
  }
}

function toolHint(tool: Tool, shape: ShapeType, brush: BrushType): string {
  switch (tool) {
    case 'select': return '드래그 선택 → 안쪽 드래그·화살표 키로 이동, Delete 삭제, Ctrl+C 복사'
    case 'text': return '캔버스를 클릭해 입력 → Enter 확정 (Shift+Enter 줄바꿈)'
    case 'eyedropper': return '클릭: 전경색 추출 · 우클릭: 배경색 추출'
    case 'fill': return '클릭: 전경색 채우기 · 우클릭: 배경색 채우기'
    case 'eraser': return '원형 지우개 — 배경색으로 지움, 굵기로 크기 조절'
    case 'zoom': return '클릭 확대 · 우클릭 축소 (Ctrl+휠, Ctrl+= / Ctrl+- 도 가능)'
    case 'brush': return `${BRUSHES.find((b) => b.id === brush)?.label ?? '붓'} — 우클릭은 배경색으로 그리기`
    case 'shape': {
      if (shape === 'curve') return '① 드래그로 선 → ② 마우스로 휘고 클릭 확정'
      return `${SHAPES.find((s) => s.id === shape)?.label ?? '도형'} — Shift: 정비율, 우클릭: 배경색`
    }
    default: return '펜 — 우클릭은 배경색 · 붙여넣기(Ctrl+V) · 열기(Ctrl+O)'
  }
}

/** 도구/동작 아이콘 — 크기 명시, 이모지 미사용 */
function ToolIcon({ name }: { name: string }) {
  const p = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'select': return <svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" strokeDasharray="3 3" /></svg>
    case 'selectAll': return <svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" strokeDasharray="3 3" /><rect x="8" y="8" width="8" height="8" rx="1" /></svg>
    case 'open': return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="M21 16l-5-5-5 5-2-2-4 4" /></svg>
    case 'crop': return <svg {...p}><path d="M6 2v16h16" /><path d="M2 6h16v16" /></svg>
    case 'transform': return <svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v6h-6" /><path d="M8 12l-3 3 3 3" opacity="0.001" /></svg>
    case 'filter': return <svg {...p}><path d="M3 5h18l-7 8v5l-4 2v-7z" /></svg>
    case 'resize': return <svg {...p}><rect x="3" y="3" width="14" height="14" rx="1" /><path d="M21 21l-6-6M21 15v6h-6" /></svg>
    case 'pen': return <svg {...p}><path d="M4 20l1.2-4L16 5.2a2 2 0 0 1 2.8 2.8L8 18.8 4 20z" /><path d="M14 7l3 3" /></svg>
    case 'brush': return <svg {...p}><path d="M4 20c2 0 3-1 3-3 0-1.2 1-2 2-2s2 .8 2 2c0 3-3 4-7 3z" /><path d="M9 15L18 6a2 2 0 0 0-3-3L6 12" /></svg>
    case 'eraser': return <svg {...p}><path d="M8.5 20H20" /><path d="M15.5 4.5l4 4L10 18H6.5L4 15.5z" /><path d="M9.5 8.5l6 6" /></svg>
    case 'fill': return <svg {...p}><path d="M11 3l8 8-7.2 7.2a2 2 0 0 1-2.8 0L3.8 12a2 2 0 0 1 0-2.8z" /><path d="M6 8h10" /><path d="M20 14s2 2.4 2 3.8a2 2 0 1 1-4 0c0-1.4 2-3.8 2-3.8z" fill="currentColor" stroke="none" /></svg>
    case 'eyedropper': return <svg {...p}><path d="M15 5l4 4" /><path d="M14 6L5 15l-1.2 4L8 17.8 17 8.8" /><path d="M13.5 4.5a2.1 2.1 0 0 1 3 3L15 9l-3-3z" fill="currentColor" stroke="none" /></svg>
    case 'text': return <svg {...p}><path d="M6 19L11 5h2l5 14" /><path d="M8.2 13.5h7.6" /></svg>
    case 'zoom': return <svg {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /><path d="M10.5 7.5v6M7.5 10.5h6" /></svg>
    case 'undo': return <svg {...p}><path d="M4 9h9a6 6 0 0 1 0 12H9" /><path d="M8 5L4 9l4 4" /></svg>
    case 'redo': return <svg {...p}><path d="M20 9h-9a6 6 0 0 0 0 12h4" /><path d="M16 5l4 4-4 4" /></svg>
    case 'clear': return <svg {...p}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6.5 7l1 13h9l1-13" /></svg>
    case 'swap': return <svg {...p}><path d="M7 10L3 14l4 4" /><path d="M3 14h13" /><path d="M17 4l4 4-4 4" /><path d="M21 8H8" /></svg>
    // 도형 아이콘
    case 'line': return <svg {...p}><path d="M4 20L20 4" /></svg>
    case 'curve': return <svg {...p}><path d="M4 18c6-14 10 0 16-12" /></svg>
    case 'rect': return <svg {...p}><rect x="4" y="6.5" width="16" height="11" rx="1" /></svg>
    case 'rrect': return <svg {...p}><rect x="4" y="6.5" width="16" height="11" rx="4" /></svg>
    case 'ellipse': return <svg {...p}><ellipse cx="12" cy="12" rx="8" ry="6" /></svg>
    case 'triangle': return <svg {...p}><path d="M12 4l8 15H4z" /></svg>
    case 'rtriangle': return <svg {...p}><path d="M5 4v15h14z" /></svg>
    case 'diamond': return <svg {...p}><path d="M12 3l9 9-9 9-9-9z" /></svg>
    case 'pentagon': return <svg {...p}><path d="M12 3l8.5 6.2-3.2 10H6.7l-3.2-10z" /></svg>
    case 'hexagon': return <svg {...p}><path d="M7 4h10l5 8-5 8H7l-5-8z" /></svg>
    case 'arrow': return <svg {...p}><path d="M4 20L20 4" /><path d="M11 4h9v9" /></svg>
    case 'arrowR': return <svg {...p}><path d="M3 9h9V5l9 7-9 7v-4H3z" /></svg>
    case 'arrowL': return <svg {...p}><path d="M21 9h-9V5l-9 7 9 7v-4h9z" /></svg>
    case 'arrowU': return <svg {...p}><path d="M9 21v-9H5l7-9 7 9h-4v9z" /></svg>
    case 'arrowD': return <svg {...p}><path d="M9 3v9H5l7 9 7-9h-4V3z" /></svg>
    case 'plus': return <svg {...p}><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></svg>
    case 'star': return <svg {...p}><path d="M12 3l2.6 5.6L21 9.3l-4.5 4.3 1.1 6.4L12 17l-5.6 3 1.1-6.4L3 9.3l6.4-.7z" /></svg>
    case 'star4': return <svg {...p}><path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" /></svg>
    case 'star6': return <svg {...p}><path d="M12 3l2.2 4.4L19 8l-3 3.6L17.2 17 12 14.8 6.8 17 8 11.6 5 8l4.8-.6z" /></svg>
    case 'heart': return <svg {...p}><path d="M12 20S4 14.5 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5.5-8 11-8 11z" /></svg>
    case 'lightning': return <svg {...p}><path d="M13 3L5 13h5l-1 8 8-11h-5z" /></svg>
    case 'callout': return <svg {...p}><path d="M4 5h16v10H10l-4 4v-4H4z" /></svg>
    default: return null
  }
}

/** 그림판 — 리본 UI + 변형/필터/자유줌/전경·배경색/선스타일/불투명도 등 확장판 */
export function PaintCanvas({ editor, onClose }: PaintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cursorPosRef = useRef<HTMLSpanElement>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [shape, setShape] = useState<ShapeType>('rect')
  const [brush, setBrush] = useState<BrushType>('round')
  const [fillMode, setFillMode] = useState<FillMode>('outline')
  const [lineStyle, setLineStyle] = useState<LineStyle>('solid')
  const [color, setColor] = useState('#000000')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [hexDraft, setHexDraft] = useState('#000000')
  const [opacity, setOpacity] = useState(100)
  const [size, setSize] = useState(4)
  const [fontSize, setFontSize] = useState(28)
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].css)
  const [fontBold, setFontBold] = useState(false)
  const [fontItalic, setFontItalic] = useState(false)
  const [dims, setDims] = useState({ w: 900, h: 560 })
  const [zoomPct, setZoomPct] = useState(100)
  const [showGrid, setShowGrid] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [histLen, setHistLen] = useState({ undo: 0, redo: 0 })
  const [dirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState<'none' | 'clear' | 'close'>('none')
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [menuOpen, setMenuOpen] = useState<MenuKey>(null)
  const [customW, setCustomW] = useState('900')
  const [customH, setCustomH] = useState('560')
  const [scalePct, setScalePct] = useState('100')

  const drawing = useRef(false)
  const startPt = useRef<Pt | null>(null)
  const lastPt = useRef<Pt | null>(null)
  const prevMid = useRef<Pt | null>(null)
  const snapshot = useRef<ImageData | null>(null)
  const undoStack = useRef<ImageData[]>([])
  const redoStack = useRef<ImageData[]>([])
  const toolRef = useRef(tool)
  const shapeRef = useRef(shape)
  const brushRef = useRef(brush)
  const fillModeRef = useRef(fillMode)
  const lineStyleRef = useRef(lineStyle)
  const colorRef = useRef(color)
  const bgColorRef = useRef(bgColor)
  const opacityRef = useRef(opacity)
  const sizeRef = useRef(size)
  const fontSizeRef = useRef(fontSize)
  const fontFamilyRef = useRef(fontFamily)
  const fontBoldRef = useRef(fontBold)
  const fontItalicRef = useRef(fontItalic)
  const shiftRef = useRef(false)
  const selection = useRef<Selection | null>(null)
  const textDraftRef = useRef<TextDraft | null>(null)
  const curveStage = useRef<0 | 1>(0)
  const curveLine = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const strokeColor = useRef('#000000') // pointerdown 때 결정 (좌클릭 전경/우클릭 배경)

  toolRef.current = tool
  shapeRef.current = shape
  brushRef.current = brush
  fillModeRef.current = fillMode
  lineStyleRef.current = lineStyle
  colorRef.current = color
  bgColorRef.current = bgColor
  opacityRef.current = opacity
  sizeRef.current = size
  fontSizeRef.current = fontSize
  fontFamilyRef.current = fontFamily
  fontBoldRef.current = fontBold
  fontItalicRef.current = fontItalic
  textDraftRef.current = textDraft

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null, [])
  const getOverlay = useCallback(() => overlayRef.current?.getContext('2d') ?? null, [])
  const syncHistLen = useCallback(() => setHistLen({ undo: undoStack.current.length, redo: redoStack.current.length }), [])

  useEffect(() => { setHexDraft(color) }, [color])

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

  function floatSelection() {
    const sel = selection.current
    const ctx = getCtx()
    if (!sel || sel.floated || !ctx) return
    pushHistory()
    ctx.fillStyle = bgColorRef.current
    ctx.fillRect(sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h)
    sel.floated = true
    setDirty(true)
  }

  function commitText() {
    const draft = textDraftRef.current
    const ctx = getCtx()
    if (!draft || !ctx) { setTextDraft(null); return }
    if (draft.value.trim()) {
      pushHistory()
      ctx.fillStyle = colorRef.current
      ctx.font = `${fontItalicRef.current ? 'italic ' : ''}${fontBoldRef.current ? 'bold ' : ''}${fontSizeRef.current}px ${fontFamilyRef.current}`
      ctx.textBaseline = 'top'
      draft.value.split('\n').forEach((line, i) => ctx.fillText(line, draft.cx, draft.cy + i * fontSizeRef.current * 1.25))
      setDirty(true)
      rememberColor(colorRef.current)
    }
    setTextDraft(null)
  }

  function applyDims(w: number, h: number) {
    setDims({ w, h })
    setCustomW(String(w)); setCustomH(String(h))
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
      applyDims(prev.width, prev.height)
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
      applyDims(next.width, next.height)
    }
    ctx.putImageData(next, 0, 0)
    syncHistLen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCtx])

  function rememberColor(hex: string) {
    setRecent((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 10))
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

  function dashFor(style: LineStyle, w: number): number[] {
    if (style === 'dash') return [Math.max(4, w * 3), Math.max(3, w * 2)]
    if (style === 'dot') return [Math.max(1, w), Math.max(3, w * 1.8)]
    return []
  }

  // ── 자유곡선(연필/브러시/지우개) 렌더 ──
  function paintFreehand(ctx: CanvasRenderingContext2D, last: Pt, pt: Pt) {
    const t = toolRef.current
    const s = sizeRef.current
    const col = strokeColor.current
    const op = opacityRef.current / 100
    if (t === 'eraser') {
      ctx.globalAlpha = 1; ctx.strokeStyle = bgColorRef.current; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 3
      strokeQuad(ctx, last, pt); return
    }
    if (t === 'pen') {
      ctx.globalAlpha = op; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = penWidth(pt.p)
      strokeQuad(ctx, last, pt); ctx.globalAlpha = 1; return
    }
    const b = brushRef.current
    if (b === 'highlighter') {
      ctx.globalAlpha = 0.32 * op; ctx.strokeStyle = col; ctx.lineCap = 'square'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 3
      strokeQuad(ctx, last, pt); ctx.globalAlpha = 1; return
    }
    if (b === 'marker') {
      ctx.globalAlpha = 0.9 * op; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 2
      strokeQuad(ctx, last, pt); ctx.globalAlpha = 1; return
    }
    if (b === 'round') {
      ctx.globalAlpha = op; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 1.6
      strokeQuad(ctx, last, pt); ctx.globalAlpha = 1; return
    }
    if (b === 'calligraphy') {
      const steps = Math.max(1, Math.hypot(pt.x - last.x, pt.y - last.y) / 2)
      ctx.strokeStyle = col; ctx.globalAlpha = op; ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(1, s * 0.5)
      const nib = s * 1.4
      for (let i = 0; i <= steps; i++) {
        const x = last.x + (pt.x - last.x) * (i / steps)
        const y = last.y + (pt.y - last.y) * (i / steps)
        ctx.beginPath(); ctx.moveTo(x - nib * 0.7, y + nib * 0.7); ctx.lineTo(x + nib * 0.7, y - nib * 0.7); ctx.stroke()
      }
      ctx.globalAlpha = 1
      return
    }
    if (b === 'airbrush') {
      ctx.fillStyle = col; ctx.globalAlpha = op
      const radius = s * 2
      const dots = Math.round(radius * 1.5)
      for (let i = 0; i < dots; i++) {
        const a = Math.random() * Math.PI * 2
        const rr = Math.sqrt(Math.random()) * radius
        ctx.beginPath(); ctx.arc(pt.x + Math.cos(a) * rr, pt.y + Math.sin(a) * rr, 0.6, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
      return
    }
    if (b === 'crayon') {
      ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      const steps = Math.max(1, Math.hypot(pt.x - last.x, pt.y - last.y) / 1.5)
      for (let i = 0; i <= steps; i++) {
        const x = last.x + (pt.x - last.x) * (i / steps)
        const y = last.y + (pt.y - last.y) * (i / steps)
        ctx.globalAlpha = (0.25 + Math.random() * 0.35) * op
        const jx = (Math.random() - 0.5) * s, jy = (Math.random() - 0.5) * s
        ctx.lineWidth = 1 + Math.random() * (s * 0.4)
        ctx.beginPath(); ctx.moveTo(x + jx, y + jy); ctx.lineTo(x + jx + 0.1, y + jy + 0.1); ctx.stroke()
      }
      ctx.globalAlpha = 1
      return
    }
  }

  function strokeQuad(ctx: CanvasRenderingContext2D, last: Pt, pt: Pt) {
    const mid = { x: (last.x + pt.x) / 2, y: (last.y + pt.y) / 2 }
    ctx.beginPath()
    ctx.moveTo((prevMid.current ?? last).x, (prevMid.current ?? last).y)
    ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y)
    ctx.stroke()
    prevMid.current = { x: mid.x, y: mid.y, p: pt.p }
  }

  function snapEnd(start: Pt, pt: Pt): { ex: number; ey: number } {
    let ex = pt.x, ey = pt.y
    if (!shiftRef.current) return { ex, ey }
    const s = shapeRef.current
    if (s === 'line' || s === 'arrow' || s === 'curve') {
      const dx = pt.x - start.x, dy = pt.y - start.y
      if (Math.abs(dx) > Math.abs(dy) * 2) ey = start.y
      else if (Math.abs(dy) > Math.abs(dx) * 2) ex = start.x
      else { const d = Math.min(Math.abs(dx), Math.abs(dy)); ex = start.x + Math.sign(dx) * d; ey = start.y + Math.sign(dy) * d }
    } else {
      const d = Math.min(Math.abs(pt.x - start.x), Math.abs(pt.y - start.y))
      ex = start.x + Math.sign(pt.x - start.x) * d
      ey = start.y + Math.sign(pt.y - start.y) * d
    }
    return { ex, ey }
  }

  function shapePaintOpt(): ShapePaint {
    // 우클릭 드로잉이면 전경/배경 역할을 맞바꾼다 (MS 그림판 방식)
    const swapped = strokeColor.current === bgColorRef.current && bgColorRef.current !== colorRef.current
    return {
      fillMode: fillModeRef.current,
      fg: strokeColor.current,
      bg: swapped ? colorRef.current : bgColorRef.current,
    }
  }

  function drawShapePreview(ctx: CanvasRenderingContext2D, start: Pt, ex: number, ey: number) {
    const sh = shapeRef.current
    ctx.globalAlpha = opacityRef.current / 100
    ctx.lineWidth = sizeRef.current
    ctx.setLineDash(dashFor(lineStyleRef.current, sizeRef.current))
    drawShape(ctx, sh, start.x, start.y, ex, ey, sizeRef.current, shapePaintOpt())
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!e.isPrimary) return
    if (e.button !== 0 && e.button !== 2) return
    const rightBtn = e.button === 2
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    setConfirm('none')
    setMenuOpen(null)
    const pt = toCanvas(e)
    const t = toolRef.current
    strokeColor.current = rightBtn ? bgColorRef.current : colorRef.current

    if (t === 'zoom') {
      setZoomPct((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, rightBtn ? z / 2 : z * 2)))
      return
    }

    if (t === 'eyedropper') {
      const px = ctx.getImageData(Math.max(0, Math.floor(pt.x)), Math.max(0, Math.floor(pt.y)), 1, 1).data
      const hex = rgbToHex(px[0], px[1], px[2])
      if (rightBtn) { setBgColor(hex) } else { setColor(hex); rememberColor(hex); setTool('pen') }
      return
    }

    if (t === 'text') {
      // 클릭 기본동작이 포커스를 빼앗아 입력창이 즉시 blur→닫히는 것을 막는다
      e.preventDefault()
      if (textDraftRef.current) commitText()
      const r = c.getBoundingClientRect()
      setTextDraft({ cx: pt.x, cy: pt.y, dx: e.clientX - r.left, dy: e.clientY - r.top, scale: r.width / c.width, value: '' })
      return
    }
    if (textDraftRef.current) commitText()

    if (t === 'fill') {
      pushHistory()
      const changed = floodFill(ctx, Math.floor(pt.x), Math.floor(pt.y), strokeColor.current)
      if (changed) { setDirty(true); rememberColor(strokeColor.current) }
      else { undoStack.current.pop(); syncHistLen() }
      return
    }

    // 곡선 2단계: 이미 선을 그린 상태에서 클릭하면 확정
    if (t === 'shape' && shapeRef.current === 'curve' && curveStage.current === 1) {
      curveStage.current = 0
      curveLine.current = null
      snapshot.current = null
      setDirty(true)
      rememberColor(strokeColor.current)
      return
    }

    if (t === 'select') {
      if (rightBtn) return
      const sel = selection.current
      if (sel && pt.x >= sel.rect.x && pt.x <= sel.rect.x + sel.rect.w && pt.y >= sel.rect.y && pt.y <= sel.rect.y + sel.rect.h) {
        floatSelection()
        sel.dragging = true
        sel.offsetX = pt.x - sel.rect.x
        sel.offsetY = pt.y - sel.rect.y
        try { c.setPointerCapture(e.pointerId) } catch { /* 무시 */ }
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
      ctx.globalAlpha = opacityRef.current / 100
      ctx.fillStyle = strokeColor.current
      ctx.beginPath(); ctx.arc(pt.x, pt.y, penWidth(pt.p) / 2, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    } else if (t === 'brush' && brushRef.current !== 'airbrush') {
      paintFreehand(ctx, pt, pt)
    } else if (t === 'eraser') {
      ctx.fillStyle = bgColorRef.current
      ctx.beginPath(); ctx.arc(pt.x, pt.y, sizeRef.current * 1.5, 0, Math.PI * 2); ctx.fill()
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    const pt = toCanvas(e)
    const t = toolRef.current

    // 상태바 좌표 (리렌더 없이 직접 갱신)
    if (cursorPosRef.current) cursorPosRef.current.textContent = `${Math.max(0, Math.round(pt.x))}, ${Math.max(0, Math.round(pt.y))}px`

    // 곡선 2단계 미리보기
    if (t === 'shape' && shapeRef.current === 'curve' && curveStage.current === 1 && curveLine.current) {
      if (snapshot.current) ctx.putImageData(snapshot.current, 0, 0)
      const l = curveLine.current
      ctx.globalAlpha = opacityRef.current / 100
      ctx.strokeStyle = strokeColor.current; ctx.lineWidth = sizeRef.current
      ctx.setLineDash(dashFor(lineStyleRef.current, sizeRef.current))
      drawShape(ctx, 'curve', l.x0, l.y0, l.x1, l.y1, sizeRef.current, shapePaintOpt(), { x: pt.x, y: pt.y })
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      return
    }

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

    if (t === 'pen' || t === 'brush' || t === 'eraser') {
      const last = lastPt.current ?? pt
      paintFreehand(ctx, last, pt)
      lastPt.current = pt
      return
    }

    if (t === 'shape') {
      if (snapshot.current) ctx.putImageData(snapshot.current, 0, 0)
      const { ex, ey } = snapEnd(start, pt)
      drawShapePreview(ctx, start, ex, ey)
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

    // 곡선 1단계 종료 → 휘게 하는 2단계로 진입 (아직 커밋 아님)
    if (t === 'shape' && shapeRef.current === 'curve' && drawing.current && startPt.current && c && ctx) {
      drawing.current = false
      const s = startPt.current
      const end = toCanvas(e)
      const { ex, ey } = snapEnd(s, end)
      curveLine.current = { x0: s.x, y0: s.y, x1: ex, y1: ey }
      curveStage.current = 1
      try { c.releasePointerCapture(e.pointerId) } catch { /* 무시 */ }
      return
    }

    if (drawing.current) {
      drawing.current = false
      setDirty(true)
      if (t !== 'eraser') rememberColor(strokeColor.current)
      try { if (c) c.releasePointerCapture(e.pointerId) } catch { /* 이미 해제됨 */ }
    }
  }

  function handlePointerLeave() {
    if (!drawing.current && toolRef.current !== 'select') clearOverlay()
    if (cursorPosRef.current) cursorPosRef.current.textContent = '—'
  }

  function drawCursorPreview(pt: Pt) {
    const octx = getOverlay()
    const ov = overlayRef.current
    if (!octx || !ov) return
    const t = toolRef.current
    if (t === 'select') { renderSelectionOverlay(); return }
    octx.clearRect(0, 0, ov.width, ov.height)
    if (t === 'eraser' || t === 'pen' || t === 'brush') {
      const radius = t === 'eraser' ? sizeRef.current * 1.5 : t === 'brush' ? sizeRef.current * 1.5 : penWidth(pt.p) / 2
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

  function selectTool(t: Tool) {
    commitText()
    curveStage.current = 0; curveLine.current = null
    setMenuOpen(null)
    setTool(t)
  }
  function pickShape(s: ShapeType) {
    commitText()
    curveStage.current = 0; curveLine.current = null
    setShape(s); setTool('shape'); setMenuOpen(null)
  }
  function pickBrush(b: BrushType) {
    commitText()
    setBrush(b); setTool('brush'); setMenuOpen(null)
  }

  function openImageFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    const cleanup = () => { input.remove() }
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { cleanup(); return }
      const img = new Image()
      img.onload = () => {
        const c = canvasRef.current
        const ctx = getCtx()
        if (!c || !ctx) { cleanup(); return }
        pushHistory()
        const scale = Math.min(1, c.width / img.width, c.height / img.height)
        const w = img.width * scale, h = img.height * scale
        ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h)
        setDirty(true)
        URL.revokeObjectURL(img.src)
        cleanup()
      }
      img.onerror = () => { flash('이미지를 불러오지 못했습니다'); URL.revokeObjectURL(img.src); cleanup() }
      img.src = URL.createObjectURL(file)
    }
    const onFocusBack = () => { window.removeEventListener('focus', onFocusBack); setTimeout(() => { if (!input.files?.length) cleanup() }, 400) }
    window.addEventListener('focus', onFocusBack)
    document.body.appendChild(input)
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
      if (ctrl && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll(); return }
      if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoomPct((z) => Math.min(ZOOM_MAX, z + 25)); return }
      if (ctrl && (e.key === '-' || e.key === '_')) { e.preventDefault(); setZoomPct((z) => Math.max(ZOOM_MIN, z - 25)); return }
      if (selection.current && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
        floatSelection()
        const step = e.shiftKey ? 10 : 1
        const sel = selection.current!
        if (e.key === 'ArrowLeft') sel.rect.x -= step
        else if (e.key === 'ArrowRight') sel.rect.x += step
        else if (e.key === 'ArrowUp') sel.rect.y -= step
        else sel.rect.y += step
        renderSelectionOverlay()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.current) {
        e.preventDefault()
        const ctx = getCtx()
        const sel = selection.current
        if (ctx) {
          if (!sel.floated) { pushHistory(); ctx.fillStyle = bgColorRef.current; ctx.fillRect(sel.rect.x, sel.rect.y, sel.rect.w, sel.rect.h) }
          setDirty(true)
        }
        selection.current = null
        clearOverlay()
        return
      }
      if (ctrl && e.key.toLowerCase() === 'c' && selection.current) { e.preventDefault(); copySelectionToClipboard(); return }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (menuOpen) { setMenuOpen(null); return }
        if (textDraftRef.current) { commitText(); return }
        if (curveStage.current === 1) { curveStage.current = 0; curveLine.current = null; snapshot.current = null; setDirty(true); return }
        if (selection.current) { commitFloatingSelection(); return }
        requestClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, menuOpen])

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
        flash('선택 영역을 복사했습니다')
      }
    } catch { /* 클립보드 권한 없으면 무시 */ }
  }

  async function copyCanvasToClipboard() {
    const c = canvasRef.current
    if (!c) return
    commitText(); commitFloatingSelection()
    try {
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
      if (blob && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        flash('캔버스를 클립보드에 복사했습니다')
      }
    } catch { flash('클립보드 복사에 실패했습니다') }
    setMenuOpen(null)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.('.pcx-dd')) setMenuOpen(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  // Ctrl+휠 줌 (스크롤 영역)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setZoomPct((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + (e.deltaY < 0 ? 25 : -25))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function resizeCanvasTo(w: number, h: number) {
    const c = canvasRef.current
    const ov = overlayRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    w = Math.round(Math.min(4000, Math.max(50, w)))
    h = Math.round(Math.min(4000, Math.max(50, h)))
    if (c.width === w && c.height === h) return
    commitFloatingSelection()
    pushHistory()
    const old = document.createElement('canvas')
    old.width = c.width; old.height = c.height
    old.getContext('2d')!.drawImage(c, 0, 0)
    c.width = w; c.height = h
    if (ov) { ov.width = w; ov.height = h }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(old, 0, 0)
    applyDims(w, h)
    setDirty(true)
  }

  /** 이미지 배율 조절 — 내용까지 함께 확대/축소 */
  function scaleImage(pct: number) {
    const c = canvasRef.current
    const ov = overlayRef.current
    const ctx = getCtx()
    if (!c || !ctx || !Number.isFinite(pct)) return
    const f = Math.min(4, Math.max(0.1, pct / 100))
    if (Math.abs(f - 1) < 0.001) return
    commitFloatingSelection()
    pushHistory()
    const old = document.createElement('canvas')
    old.width = c.width; old.height = c.height
    old.getContext('2d')!.drawImage(c, 0, 0)
    const nw = Math.max(50, Math.round(c.width * f))
    const nh = Math.max(50, Math.round(c.height * f))
    c.width = nw; c.height = nh
    if (ov) { ov.width = nw; ov.height = nh }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, nw, nh)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(old, 0, 0, nw, nh)
    applyDims(nw, nh)
    setScalePct('100')
    setDirty(true)
    setMenuOpen(null)
  }

  // ── 변형 ──
  type TransformKind = 'cw' | 'ccw' | 'r180' | 'flipH' | 'flipV'
  function applyTransform(kind: TransformKind) {
    const c = canvasRef.current
    const ov = overlayRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    commitFloatingSelection()
    pushHistory()
    const old = document.createElement('canvas')
    old.width = c.width; old.height = c.height
    old.getContext('2d')!.drawImage(c, 0, 0)
    const rotated = kind === 'cw' || kind === 'ccw'
    const nw = rotated ? c.height : c.width
    const nh = rotated ? c.width : c.height
    c.width = nw; c.height = nh
    if (ov) { ov.width = nw; ov.height = nh }
    ctx.save()
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, nw, nh)
    switch (kind) {
      case 'cw': ctx.translate(nw, 0); ctx.rotate(Math.PI / 2); break
      case 'ccw': ctx.translate(0, nh); ctx.rotate(-Math.PI / 2); break
      case 'r180': ctx.translate(nw, nh); ctx.rotate(Math.PI); break
      case 'flipH': ctx.translate(nw, 0); ctx.scale(-1, 1); break
      case 'flipV': ctx.translate(0, nh); ctx.scale(1, -1); break
    }
    ctx.drawImage(old, 0, 0)
    ctx.restore()
    if (rotated) applyDims(nw, nh)
    setDirty(true)
    setMenuOpen(null)
  }

  // ── 필터 ──
  function applyFilter(f: string) {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    commitFloatingSelection()
    pushHistory()
    const old = document.createElement('canvas')
    old.width = c.width; old.height = c.height
    old.getContext('2d')!.drawImage(c, 0, 0)
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.filter = f
    ctx.drawImage(old, 0, 0)
    ctx.restore()
    ctx.filter = 'none'
    setDirty(true)
    setMenuOpen(null)
  }

  function cropToSelection() {
    const sel = selection.current
    const c = canvasRef.current
    const ctx = getCtx()
    const ov = overlayRef.current
    if (!sel || !c || !ctx) { flash('먼저 선택 도구로 영역을 지정하세요'); return }
    const { x, y, w, h } = sel.rect
    if (w < 3 || h < 3) { flash('선택 영역이 너무 작습니다'); return }
    const cut = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
    pushHistory()
    c.width = Math.round(w); c.height = Math.round(h)
    if (ov) { ov.width = c.width; ov.height = c.height }
    ctx.putImageData(cut, 0, 0)
    selection.current = null
    clearOverlay()
    applyDims(c.width, c.height)
    setDirty(true)
  }

  function selectAll() {
    const c = canvasRef.current
    const ctx = getCtx()
    if (!c || !ctx) return
    commitFloatingSelection()
    selection.current = { rect: { x: 0, y: 0, w: c.width, h: c.height }, data: ctx.getImageData(0, 0, c.width, c.height), dragging: false, offsetX: 0, offsetY: 0, floated: false }
    setTool('select')
    renderSelectionOverlay()
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

  function downloadAs(type: 'png' | 'jpeg' | 'webp') {
    commitText(); commitFloatingSelection()
    const c = canvasRef.current
    if (!c) return
    const ext = type === 'jpeg' ? 'jpg' : type
    const a = document.createElement('a')
    a.href = c.toDataURL(`image/${type}`, type === 'png' ? undefined : 0.92)
    a.download = `그림-${fileStamp()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setMenuOpen(null)
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

  function applyHex(v: string) {
    const s = v.trim()
    if (/^#[0-9a-fA-F]{6}$/.test(s)) { setColor(s.toLowerCase()); rememberColor(s.toLowerCase()) }
    else setHexDraft(color)
  }

  const zoom = zoomPct / 100
  const dispW = dims.w * zoom
  const dispH = dims.h * zoom
  const isShapeTool = tool === 'shape' && CLOSED_SHAPES.includes(shape)
  const tileClass = (active: boolean) => 'pcx-tile' + (active ? ' is-active' : '')

  const PALETTE = [
    '#000000', '#7F7F7F', '#880015', '#ED1C24', '#FF7F27', '#FFF200', '#22B14C', '#00A2E8', '#3F48CC', '#A349A4',
    '#FFFFFF', '#C3C3C3', '#B97A57', '#FFAEC9', '#FFC90E', '#EFE4B0', '#B5E61D', '#99D9EA', '#7092BE', '#C8BFE7',
  ]

  return (
    <div className="jan-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose() }}>
      <div className="jan-modal jan-paint-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>그림판</h3>
          <button className="jan-modal-close" onClick={requestClose} aria-label="닫기">닫기</button>
        </div>

        <div className="pcx-body">
          {/* ── 리본 ── */}
          <div className="pcx-ribbon" role="toolbar" aria-label="그림판 도구">
            {/* 편집 */}
            <div className="pcx-group">
              <div className="pcx-tiles">
                <button type="button" className="pcx-tile" onClick={undo} disabled={histLen.undo === 0} title="되돌리기 (Ctrl+Z)" aria-label="되돌리기"><ToolIcon name="undo" /></button>
                <button type="button" className="pcx-tile" onClick={redo} disabled={histLen.redo === 0} title="다시 실행 (Ctrl+Y)" aria-label="다시 실행"><ToolIcon name="redo" /></button>
                <button type="button" className="pcx-tile" onClick={() => setConfirm('clear')} title="전체 지우기" aria-label="전체 지우기"><ToolIcon name="clear" /></button>
              </div>
              <div className="pcx-group-label">편집</div>
            </div>
            <span className="pcx-group-sep" />

            {/* 선택 */}
            <div className="pcx-group">
              <div className="pcx-tiles">
                <button type="button" className={tileClass(tool === 'select')} onClick={() => selectTool('select')} title="사각형 선택" aria-label="선택"><ToolIcon name="select" /></button>
                <button type="button" className="pcx-tile" onClick={selectAll} title="전체 선택 (Ctrl+A)" aria-label="전체 선택"><ToolIcon name="selectAll" /></button>
              </div>
              <div className="pcx-group-label">선택</div>
            </div>
            <span className="pcx-group-sep" />

            {/* 이미지 */}
            <div className="pcx-group">
              <div className="pcx-tiles pcx-tiles-grid">
                <button type="button" className="pcx-tile" onClick={openImageFile} title="이미지 파일 열기 (Ctrl+O)" aria-label="열기"><ToolIcon name="open" /></button>
                <button type="button" className="pcx-tile" onClick={cropToSelection} title="선택 영역으로 자르기" aria-label="자르기"><ToolIcon name="crop" /></button>

                <div className="pcx-dd">
                  <button type="button" className="pcx-tile" aria-haspopup="menu" aria-expanded={menuOpen === 'transform'} title="회전·대칭" aria-label="회전·대칭" onClick={() => setMenuOpen(menuOpen === 'transform' ? null : 'transform')}><ToolIcon name="transform" /></button>
                  {menuOpen === 'transform' && (
                    <div className="pcx-menu" role="menu" aria-label="회전·대칭">
                      <button type="button" onClick={() => applyTransform('cw')}>시계 방향 90°</button>
                      <button type="button" onClick={() => applyTransform('ccw')}>반시계 방향 90°</button>
                      <button type="button" onClick={() => applyTransform('r180')}>180° 회전</button>
                      <button type="button" onClick={() => applyTransform('flipH')}>좌우 대칭</button>
                      <button type="button" onClick={() => applyTransform('flipV')}>상하 대칭</button>
                    </div>
                  )}
                </div>

                <div className="pcx-dd">
                  <button type="button" className="pcx-tile" aria-haspopup="menu" aria-expanded={menuOpen === 'filter'} title="필터·색 보정" aria-label="필터" onClick={() => setMenuOpen(menuOpen === 'filter' ? null : 'filter')}><ToolIcon name="filter" /></button>
                  {menuOpen === 'filter' && (
                    <div className="pcx-menu" role="menu" aria-label="필터">
                      {FILTERS.map((f) => (
                        <button key={f.label} type="button" onClick={() => applyFilter(f.f)}>{f.label}</button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pcx-dd">
                  <button type="button" className="pcx-tile" aria-haspopup="menu" aria-expanded={menuOpen === 'size'} title="캔버스·이미지 크기" aria-label="크기" onClick={() => setMenuOpen(menuOpen === 'size' ? null : 'size')}><ToolIcon name="resize" /></button>
                  {menuOpen === 'size' && (
                    <div className="pcx-menu pcx-panel" role="menu" aria-label="크기 조절">
                      <div className="pcx-panel-title">캔버스 크기</div>
                      <div className="pcx-panel-row">
                        {CANVAS_SIZES.map((s) => (
                          <button key={s.key} type="button" className="pcx-mini" title={s.title} onClick={() => { resizeCanvasTo(s.w, s.h); setMenuOpen(null) }}>{s.label}</button>
                        ))}
                      </div>
                      <div className="pcx-panel-row">
                        <input type="number" min={50} max={4000} value={customW} onChange={(e) => setCustomW(e.target.value)} aria-label="캔버스 너비" />
                        <span>×</span>
                        <input type="number" min={50} max={4000} value={customH} onChange={(e) => setCustomH(e.target.value)} aria-label="캔버스 높이" />
                        <button type="button" className="pcx-mini" onClick={() => { resizeCanvasTo(Number(customW), Number(customH)); setMenuOpen(null) }}>적용</button>
                      </div>
                      <div className="pcx-panel-title">이미지 배율 (내용 포함)</div>
                      <div className="pcx-panel-row">
                        <input type="number" min={10} max={400} value={scalePct} onChange={(e) => setScalePct(e.target.value)} aria-label="이미지 배율 %" />
                        <span>%</span>
                        <button type="button" className="pcx-mini" onClick={() => scaleImage(Number(scalePct))}>적용</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="pcx-group-label">이미지</div>
            </div>
            <span className="pcx-group-sep" />

            {/* 도구 */}
            <div className="pcx-group">
              <div className="pcx-tiles pcx-tiles-grid">
                <button type="button" className={tileClass(tool === 'pen')} onClick={() => selectTool('pen')} title="연필" aria-label="연필"><ToolIcon name="pen" /></button>
                <button type="button" className={tileClass(tool === 'fill')} onClick={() => selectTool('fill')} title="채우기" aria-label="채우기"><ToolIcon name="fill" /></button>
                <button type="button" className={tileClass(tool === 'text')} onClick={() => selectTool('text')} title="텍스트" aria-label="텍스트"><ToolIcon name="text" /></button>
                <button type="button" className={tileClass(tool === 'eraser')} onClick={() => selectTool('eraser')} title="지우개" aria-label="지우개"><ToolIcon name="eraser" /></button>
                <button type="button" className={tileClass(tool === 'eyedropper')} onClick={() => selectTool('eyedropper')} title="스포이드 (클릭: 전경, 우클릭: 배경)" aria-label="스포이드"><ToolIcon name="eyedropper" /></button>
                <button type="button" className={tileClass(tool === 'zoom')} onClick={() => selectTool('zoom')} title="돋보기 (클릭 확대·우클릭 축소)" aria-label="돋보기"><ToolIcon name="zoom" /></button>
              </div>
              <div className="pcx-group-label">도구</div>
            </div>
            <span className="pcx-group-sep" />

            {/* 브러시 */}
            <div className="pcx-group">
              <div className="pcx-tiles">
                <div className="pcx-dd">
                  <button type="button" className={'pcx-brush-big' + (tool === 'brush' ? ' is-active' : '')} aria-haspopup="menu" aria-expanded={menuOpen === 'brush'} title="브러시 선택" onClick={() => setMenuOpen(menuOpen === 'brush' ? null : 'brush')}>
                    <ToolIcon name="brush" />
                    <span className="pcx-brush-name">{BRUSHES.find((b) => b.id === brush)?.label ?? '붓'}</span>
                    <svg className="pcx-caret" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {menuOpen === 'brush' && (
                    <div className="pcx-menu" role="menu" aria-label="브러시 종류">
                      {BRUSHES.map((b) => (
                        <button key={b.id} type="button" role="menuitemradio" aria-checked={tool === 'brush' && brush === b.id} className={tool === 'brush' && brush === b.id ? 'is-active' : ''} onClick={() => pickBrush(b.id)}>{b.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="pcx-group-label">브러시</div>
            </div>
            <span className="pcx-group-sep" />

            {/* 도형 */}
            <div className="pcx-group">
              <div className="pcx-tiles pcx-shape-wrap">
                <div className="pcx-shape-grid" role="group" aria-label="도형">
                  {SHAPES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={'pcx-shape-cell' + (tool === 'shape' && shape === s.id ? ' is-active' : '')}
                      aria-pressed={tool === 'shape' && shape === s.id}
                      title={s.label}
                      aria-label={s.label}
                      onClick={() => pickShape(s.id)}
                    ><ToolIcon name={s.icon} /></button>
                  ))}
                </div>
                <select
                  className="pcx-fill-select"
                  value={fillMode}
                  disabled={!isShapeTool}
                  onChange={(e) => setFillMode(e.target.value as FillMode)}
                  aria-label="도형 채우기 방식"
                  title="도형 채우기 — 윤곽선: 전경색 / 채우기: 배경색"
                >
                  <option value="outline">윤곽선</option>
                  <option value="both">윤곽+채움</option>
                  <option value="fill">채우기만</option>
                </select>
              </div>
              <div className="pcx-group-label">도형</div>
            </div>
            <span className="pcx-group-sep" />

            {/* 색 */}
            <div className="pcx-group">
              <div className="pcx-color-area">
                <div className="pcx-fgbg" title="전경색(위)·배경색(아래) — 우클릭 그리기는 배경색">
                  <button type="button" className="pcx-fg" style={{ background: color }} aria-label={`전경색 ${color}`} onClick={() => setMenuOpen(null)} />
                  <button type="button" className="pcx-bg" style={{ background: bgColor }} aria-label={`배경색 ${bgColor}`} onClick={() => setMenuOpen(null)} />
                  <button type="button" className="pcx-swap" title="전경·배경색 교환" aria-label="전경 배경색 교환" onClick={() => { const f = color; setColor(bgColor); setBgColor(f) }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 10L3 14l4 4" /><path d="M3 14h13" /><path d="M17 4l4 4-4 4" /><path d="M21 8H8" /></svg>
                  </button>
                </div>
                <div className="pcx-swatch-grid" role="group" aria-label="색상 팔레트 (클릭: 전경, 우클릭: 배경)">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={'pcx-swatch' + (color === c ? ' is-active' : '')}
                      style={{ background: c }}
                      aria-label={`색상 ${c}`}
                      aria-pressed={color === c}
                      title={`${c} (클릭: 전경 / 우클릭: 배경)`}
                      onClick={() => setColor(c)}
                      onContextMenu={(e) => { e.preventDefault(); setBgColor(c) }}
                    />
                  ))}
                </div>
                <label className="pcx-color-custom" title="사용자 지정 색상 (전경색)">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="사용자 지정 색상" />
                  <span>+</span>
                </label>
                {recent.length > 0 && (
                  <div className="pcx-recent" role="group" aria-label="최근 색상">
                    {recent.slice(0, 10).map((c, i) => (
                      <button key={c + i} type="button" className="pcx-swatch pcx-swatch-sm" style={{ background: c }} aria-label={`최근 색상 ${c}`} title={c} onClick={() => setColor(c)} onContextMenu={(e) => { e.preventDefault(); setBgColor(c) }} />
                    ))}
                  </div>
                )}
              </div>
              <div className="pcx-group-label">색</div>
            </div>
          </div>

          {/* ── 서브바 ── */}
          <div className="pcx-subbar">
            <div className="pcx-slider">
              <label>
                <span>굵기</span>
                <input type="range" min={1} max={40} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="선 굵기" />
                <span className="pcx-size-preview"><i className="pcx-size-dot" style={{ width: Math.min(28, size), height: Math.min(28, size), background: color }} /></span>
                <b>{size}</b>
              </label>
            </div>
            <div className="pcx-slider">
              <label>
                <span>불투명도</span>
                <input type="range" min={5} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} aria-label="불투명도" style={{ width: 90 }} />
                <b>{opacity}%</b>
              </label>
            </div>
            <div className="pcx-slider">
              <label>
                <span>선 스타일</span>
                <select value={lineStyle} onChange={(e) => setLineStyle(e.target.value as LineStyle)} aria-label="선 스타일 (도형·직선에 적용)">
                  <option value="solid">실선</option>
                  <option value="dash">파선</option>
                  <option value="dot">점선</option>
                </select>
              </label>
            </div>
            <div className="pcx-slider">
              <label>
                <span>HEX</span>
                <input
                  className="pcx-hex"
                  value={hexDraft}
                  onChange={(e) => setHexDraft(e.target.value)}
                  onBlur={(e) => applyHex(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyHex((e.target as HTMLInputElement).value) } e.stopPropagation() }}
                  aria-label="HEX 색상 코드"
                  placeholder="#000000"
                  maxLength={7}
                />
              </label>
            </div>
            {tool === 'text' && (
              <>
                <div className="pcx-slider">
                  <label>
                    <span>글꼴</span>
                    <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} aria-label="글꼴">
                      {FONT_FAMILIES.map((f) => <option key={f.label} value={f.css}>{f.label}</option>)}
                    </select>
                    <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} aria-label="글자 크기">
                      {FONT_SIZES.map((n) => <option key={n} value={n}>{n}px</option>)}
                    </select>
                  </label>
                </div>
                <button type="button" className={'pcx-mini pcx-b' + (fontBold ? ' is-active' : '')} aria-pressed={fontBold} title="굵게" onClick={() => setFontBold((v) => !v)}>B</button>
                <button type="button" className={'pcx-mini pcx-i' + (fontItalic ? ' is-active' : '')} aria-pressed={fontItalic} title="기울임" onClick={() => setFontItalic((v) => !v)}>I</button>
              </>
            )}
            <label className="pcx-grid-toggle" title="20px 격자 표시 (그리기 보조선, 저장에는 포함되지 않음)">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              <span>격자</span>
            </label>
            <span className="flex-spacer" />
            <div className="pcx-zoom" role="group" aria-label="확대">
              <span>확대</span>
              <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={25} value={zoomPct} onChange={(e) => setZoomPct(Number(e.target.value))} aria-label="확대 비율" style={{ width: 120 }} />
              <b className="pcx-zoom-val">{zoomPct}%</b>
              <button type="button" className="pcx-mini" onClick={() => setZoomPct(100)} title="100%로 재설정">100%</button>
            </div>
          </div>

          <div className="pcx-canvas-scroll" ref={scrollRef}>
            <div className="pcx-canvas-box" style={{ width: dispW, height: dispH }}>
              <canvas
                ref={canvasRef}
                width={dims.w}
                height={dims.h}
                className={'pcx-canvas pcx-tool-' + tool}
                style={{ width: dispW, height: dispH, touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onContextMenu={(e) => e.preventDefault()}
              />
              <canvas ref={overlayRef} width={dims.w} height={dims.h} className="pcx-overlay" style={{ width: dispW, height: dispH }} aria-hidden="true" />
              {showGrid && (
                <div
                  className="pcx-grid-overlay"
                  aria-hidden="true"
                  style={{ backgroundSize: `${20 * zoom}px ${20 * zoom}px` }}
                />
              )}
              {textDraft && (
                <textarea
                  className="pcx-text-input"
                  autoFocus
                  value={textDraft.value}
                  onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                  onBlur={commitText}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { e.preventDefault(); commitText() }
                    else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); commitText() }
                    e.stopPropagation()
                  }}
                  aria-label="캔버스에 넣을 텍스트 입력"
                  placeholder="입력 후 Enter (Shift+Enter 줄바꿈)"
                  style={{
                    left: textDraft.dx,
                    top: textDraft.dy,
                    color,
                    fontSize: fontSize * textDraft.scale,
                    lineHeight: 1.25,
                    fontFamily,
                    fontWeight: fontBold ? 700 : 400,
                    fontStyle: fontItalic ? 'italic' : 'normal',
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="pcx-foot">
          <span className="pcx-foot-note">{toolHint(tool, shape, brush)}</span>
          <span className="flex-spacer" />
          <span className="pcx-status" aria-label="상태">
            <span ref={cursorPosRef}>—</span>
            <span className="pcx-status-sep" />
            <span>{dims.w}×{dims.h}px</span>
            <span className="pcx-status-sep" />
            <span>{zoomPct}%</span>
          </span>
          <div className="pcx-dd">
            <button type="button" className="pcx-btn" aria-haspopup="menu" aria-expanded={menuOpen === 'export'} onClick={() => setMenuOpen(menuOpen === 'export' ? null : 'export')} title="다른 형식으로 내보내기">내보내기</button>
            {menuOpen === 'export' && (
              <div className="pcx-menu pcx-menu-up" role="menu" aria-label="내보내기">
                <button type="button" onClick={() => downloadAs('png')}>PNG 다운로드</button>
                <button type="button" onClick={() => downloadAs('jpeg')}>JPG 다운로드</button>
                <button type="button" onClick={() => downloadAs('webp')}>WebP 다운로드</button>
                <button type="button" onClick={copyCanvasToClipboard}>클립보드에 복사</button>
              </div>
            )}
          </div>
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

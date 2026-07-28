import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { flash } from './flash'
import { SHAPES, WORDART, shapeByKey } from './shapeLibrary'

/**
 * 그리기 개체 다루기 — 워드의 「도형 서식」 탭에 있는 일.
 * 그림(imageWord)과 같은 이름·같은 결로 맞춰 두어, 키보드 조작과 상황 메뉴가
 * 두 개체를 가리지 않고 똑같이 움직인다.
 */

export interface ShapeHit { node: PMNode; pos: number }

export function currentShape(editor: Editor | null): ShapeHit | null {
  if (!editor) return null
  const sel = editor.state.selection
  if (sel instanceof NodeSelection && sel.node.type.name === 'janShape') return { node: sel.node, pos: sel.from }
  const { $from } = sel
  const before = $from.nodeBefore
  if (before?.type.name === 'janShape') return { node: before, pos: $from.pos - before.nodeSize }
  const after = $from.nodeAfter
  if (after?.type.name === 'janShape') return { node: after, pos: $from.pos }
  return null
}

const GUARDED = new Set(['width', 'height', 'rotate', 'dx', 'dy', 'flipH', 'flipV'])

export function setShapeAttrs(editor: Editor | null, attrs: Record<string, unknown>, note?: string): boolean {
  const hit = currentShape(editor)
  if (!editor || !hit) return false
  if (hit.node.attrs.locked && Object.keys(attrs).some((k) => GUARDED.has(k))) {
    flash('개체 보호가 걸려 있다 — Alt+L 로 푼다')
    return false
  }
  const tr = editor.state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.node.attrs, ...attrs })
  tr.setSelection(NodeSelection.create(tr.doc, hit.pos))
  editor.view.dispatch(tr)
  editor.view.focus()
  if (note) flash(note)
  return true
}

/** 도형·글상자·아이콘·글맵시를 넣는다 */
export function insertShape(
  editor: Editor | null,
  kind: 'shape' | 'textbox' | 'icon' | 'wordart',
  shape: string,
  extra: Record<string, unknown> = {}
): boolean {
  if (!editor) return false
  const base: Record<string, unknown> = { kind, shape, ...extra }
  if (kind === 'textbox') {
    base.width = base.width ?? 300
    base.height = base.height ?? 120
    base.fill = base.fill ?? 'transparent'
    base.stroke = base.stroke ?? '#94a3b8'
    base.text = base.text ?? '여기에 글을 쓴다'
    base.textAlign = 'left'
    base.vAlign = 'top'
  } else if (kind === 'icon') {
    base.width = base.width ?? 96
    base.height = base.height ?? 96
    base.strokeWidth = base.strokeWidth ?? 5
  } else if (kind === 'wordart') {
    base.width = base.width ?? 420
    base.height = base.height ?? 130
    base.text = base.text ?? '글맵시'
    base.fontSize = base.fontSize ?? 46
    base.strokeWidth = base.strokeWidth ?? 0
  }
  const ok = editor.chain().focus().insertContent({ type: 'janShape', attrs: base }).run()
  if (ok) flash(`${{ shape: '도형', textbox: '글상자', icon: '아이콘', wordart: '글맵시' }[kind]}을 넣었다 — Alt+/ 로 단축키를 본다`)
  return ok
}

/* ── 크기·자리 ─────────────────────────────────────── */

export function resizeShape(editor: Editor | null, dw: number, dh: number): boolean {
  const hit = currentShape(editor)
  if (!hit) return false
  return setShapeAttrs(editor, {
    width: Math.max(24, Number(hit.node.attrs.width) + dw),
    height: Math.max(24, Number(hit.node.attrs.height) + dh),
  })
}

export function setShapeSize(editor: Editor | null, w: number, h: number): boolean {
  return setShapeAttrs(editor, { width: Math.max(24, Math.round(w)), height: Math.max(24, Math.round(h)) })
}

export function nudgeShape(editor: Editor | null, dx: number, dy: number): boolean {
  const hit = currentShape(editor)
  if (!hit) return false
  return setShapeAttrs(editor, {
    dx: Number(hit.node.attrs.dx || 0) + dx,
    dy: Number(hit.node.attrs.dy || 0) + dy,
  })
}

export function rotateShape(editor: Editor | null, deg: number): boolean {
  const hit = currentShape(editor)
  if (!hit) return false
  const next = (((Number(hit.node.attrs.rotate) || 0) + deg) % 360 + 360) % 360
  return setShapeAttrs(editor, { rotate: next }, `${next}° 회전`)
}

export function flipShape(editor: Editor | null, axis: 'h' | 'v'): boolean {
  const hit = currentShape(editor)
  if (!hit) return false
  const key = axis === 'h' ? 'flipH' : 'flipV'
  return setShapeAttrs(editor, { [key]: !hit.node.attrs[key] }, axis === 'h' ? '좌우 대칭' : '상하 대칭')
}

export function setShapeWrap(editor: Editor | null, wrap: string | null, note?: string): boolean {
  return setShapeAttrs(editor, { wrap }, note)
}

export function setShapeAlign(editor: Editor | null, align: string | null): boolean {
  return setShapeAttrs(editor, { align })
}

export function toggleShapeLock(editor: Editor | null): boolean {
  const hit = currentShape(editor)
  if (!editor || !hit) return false
  const next = !hit.node.attrs.locked
  const tr = editor.state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.node.attrs, locked: next })
  tr.setSelection(NodeSelection.create(tr.doc, hit.pos))
  editor.view.dispatch(tr)
  flash(next ? '개체를 보호했다' : '개체 보호를 풀었다')
  return true
}

/* ── 모양·글자 ─────────────────────────────────────── */

export function setShapeText(editor: Editor | null, text: string): boolean {
  return setShapeAttrs(editor, { text }, text ? '글을 넣었다' : '글을 지웠다')
}

/** 크기·서식은 그대로 두고 모양만 바꾼다 (워드의 「도형 변경」) */
export function changeShape(editor: Editor | null, shape: string): boolean {
  const def = shapeByKey(shape) || WORDART.find((w) => w.key === shape)
  return setShapeAttrs(editor, { shape }, def ? `${def.label} 으로 바꿨다` : '모양을 바꿨다')
}

/** 도형 스타일 — 채우기·선을 한 벌로 (워드의 「도형 스타일」 갤러리) */
export const SHAPE_STYLES: { key: string; label: string; fill: string; stroke: string; textColor: string }[] = [
  { key: 'blue-soft', label: '파랑 (연한 채움)', fill: '#dbeafe', stroke: '#2563eb', textColor: '#12305e' },
  { key: 'blue-solid', label: '파랑 (진한 채움)', fill: '#2563eb', stroke: '#1d4ed8', textColor: '#ffffff' },
  { key: 'gray-soft', label: '회색 (연한 채움)', fill: '#eef1f5', stroke: '#64748b', textColor: '#1f2937' },
  { key: 'gray-solid', label: '회색 (진한 채움)', fill: '#475569', stroke: '#334155', textColor: '#ffffff' },
  { key: 'green-soft', label: '초록 (연한 채움)', fill: '#dcfce7', stroke: '#16a34a', textColor: '#14532d' },
  { key: 'green-solid', label: '초록 (진한 채움)', fill: '#16a34a', stroke: '#15803d', textColor: '#ffffff' },
  { key: 'amber-soft', label: '주황 (연한 채움)', fill: '#fef3c7', stroke: '#d97706', textColor: '#78350f' },
  { key: 'amber-solid', label: '주황 (진한 채움)', fill: '#f59e0b', stroke: '#b45309', textColor: '#3b2503' },
  { key: 'red-soft', label: '빨강 (연한 채움)', fill: '#fee2e2', stroke: '#dc2626', textColor: '#7f1d1d' },
  { key: 'red-solid', label: '빨강 (진한 채움)', fill: '#dc2626', stroke: '#b91c1c', textColor: '#ffffff' },
  { key: 'outline', label: '테두리만', fill: 'transparent', stroke: '#334155', textColor: '#1f2937' },
  { key: 'ghost', label: '채움만 (선 없음)', fill: '#e2e8f0', stroke: 'transparent', textColor: '#1f2937' },
]

export function applyShapeStyle(editor: Editor | null, key: string): boolean {
  const st = SHAPE_STYLES.find((s) => s.key === key)
  if (!st) return false
  return setShapeAttrs(editor, { fill: st.fill, stroke: st.stroke, textColor: st.textColor }, `도형 스타일: ${st.label}`)
}

export function setShapeFill(editor: Editor | null, fill: string | null): boolean {
  return setShapeAttrs(editor, { fill: fill || 'transparent' }, fill ? '채우기 색을 바꿨다' : '채우기를 없앴다')
}

export function setShapeStroke(
  editor: Editor | null,
  stroke: { color?: string | null; width?: number; style?: string }
): boolean {
  const patch: Record<string, unknown> = {}
  if ('color' in stroke) patch.stroke = stroke.color || 'transparent'
  if (stroke.width != null) patch.strokeWidth = stroke.width
  if (stroke.style) patch.strokeStyle = stroke.style
  return setShapeAttrs(editor, patch, '선을 바꿨다')
}

/** 글자 방향 — 워드의 「텍스트 방향」, 한글의 세로쓰기 */
export function cycleTextDirection(editor: Editor | null): boolean {
  const hit = currentShape(editor)
  if (!hit) return false
  const order = ['horizontal', 'rotate90', 'vertical', 'rotate270']
  const names: Record<string, string> = {
    horizontal: '가로', rotate90: '90° 돌려 세로', vertical: '세로쓰기 (글자는 바로)', rotate270: '270° 돌려 세로',
  }
  const cur = String(hit.node.attrs.textDir || 'horizontal')
  const next = order[(order.indexOf(cur) + 1) % order.length]
  return setShapeAttrs(editor, { textDir: next }, `글자 방향: ${names[next]}`)
}

/** 글자 세로 맞춤 — 워드의 「텍스트 맞춤」 */
export function cycleVAlign(editor: Editor | null): boolean {
  const hit = currentShape(editor)
  if (!hit) return false
  const order = ['top', 'middle', 'bottom']
  const names: Record<string, string> = { top: '위', middle: '가운데', bottom: '아래' }
  const cur = String(hit.node.attrs.vAlign || 'middle')
  const next = order[(order.indexOf(cur) + 1) % order.length]
  return setShapeAttrs(editor, { vAlign: next }, `글자 맞춤: ${names[next]}`)
}

/* ── 문서 안에서 ───────────────────────────────────── */

export function moveShape(editor: Editor | null, dir: -1 | 1): boolean {
  const hit = currentShape(editor)
  if (!editor || !hit) return false
  const $pos = editor.state.doc.resolve(hit.pos)
  const parent = $pos.parent
  const index = $pos.index()
  const target = index + dir
  if (target < 0 || target >= parent.childCount) { flash('더 옮길 곳이 없다'); return false }
  const tr = editor.state.tr
  const node = hit.node
  tr.delete(hit.pos, hit.pos + node.nodeSize)
  const insertAt = dir === -1 ? $pos.posAtIndex(index - 1) : hit.pos + parent.child(target).nodeSize
  const mapped = tr.mapping.map(insertAt, -1)
  tr.insert(mapped, node)
  try { tr.setSelection(NodeSelection.create(tr.doc, mapped)) } catch { /* 자리를 못 잡으면 그대로 둔다 */ }
  editor.view.dispatch(tr)
  editor.view.focus()
  return true
}

/** 문서 안 그리기 개체를 차례로 고른다 */
export function selectNextShape(editor: Editor | null, dir: 1 | -1): boolean {
  if (!editor) return false
  const spots: number[] = []
  editor.state.doc.descendants((node, pos) => { if (node.type.name === 'janShape') spots.push(pos) })
  if (!spots.length) { flash('문서에 그리기 개체가 없다'); return false }
  const here = currentShape(editor)?.pos ?? -1
  const from = editor.state.selection.from
  let target: number
  if (here >= 0) target = spots[(spots.indexOf(here) + dir + spots.length) % spots.length]
  else if (dir === 1) target = spots.find((p) => p > from) ?? spots[0]
  else target = [...spots].reverse().find((p) => p < from) ?? spots[spots.length - 1]
  const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, target))
  tr.scrollIntoView()
  editor.view.dispatch(tr)
  editor.view.focus()
  return true
}

/** 도형 목록 — 갤러리에서 쓰기 좋게 갈래별로 */
export function shapesByGroup(group: string) {
  return SHAPES.filter((s) => s.group === group)
}

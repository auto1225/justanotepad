import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { ADJUST_DEFAULT, adjustToString, cropToString, parseAdjust, parseCrop } from '../extensions/ImageObject'
import type { Adjust, Crop } from '../extensions/ImageObject'
import { flash } from './flash'

/**
 * 그림 다루기 — 워드의 「그림 서식」 탭에 있는 일을 그대로 옮긴 것.
 * 한글에만 있는 것(개체 보호, 캡션 일체화, 앞 개체 속성 적용)도 함께 담았다.
 *
 * 규칙 하나: 모든 명령은 마우스가 없어도 된다. 리본·상황 메뉴·단축키가
 * 같은 함수를 부른다.
 */

export interface ImageHit { node: PMNode; pos: number }

/**
 * 그림을 문서에 넣기 전에 미리 풀어 둔다 — 디코딩을 조판 트랜잭션에서 떼어 놓는 것.
 *
 * 큰 그림을 넣으면 그 자리에서 곧바로 타자가 늦어진다. 재어 보니(4000×3000 WebP,
 * 넣은 뒤 2초 동안 가장 오래 붙들린 프레임):
 *   아무것도 안 넣었을 때        18ms
 *   data: 주소로 넣기          219ms
 *   object 주소로 넣기         250ms   ← 글자값이 아니라 디코딩이 붙든다
 *   미리 풀어 두고 넣기          37ms
 * 8MB 짜리 data: 글자를 다루는 값이 아니었다. 같은 그림을 짧은 object 주소로 넣어도
 * 250ms 붙들렸으니, 붙드는 것은 디코딩이다. 미리 풀어 두면 브라우저가 그림판을
 * 손에 쥔 채로 조판에 들어가 250ms 가 37ms 가 된다 (바닥값 18ms).
 *
 * 못 풀어도 그냥 넘어간다 — 넣는 일 자체를 막을 만한 이유가 아니다.
 */
export async function decodeBeforeInsert(src: string): Promise<void> {
  if (!src || typeof Image === 'undefined') return
  try {
    const img = new Image()
    img.src = src
    if (typeof img.decode !== 'function') return
    await img.decode()
  } catch { /* 못 풀면 예전처럼 넣는다 */ }
}

/** 지금 다루는 그림 (없으면 null) */
export function currentImage(editor: Editor | null): ImageHit | null {
  if (!editor) return null
  const { state } = editor
  const sel = state.selection
  if (sel instanceof NodeSelection && sel.node.type.name === 'image') return { node: sel.node, pos: sel.from }
  // 커서가 그림 바로 옆에 있을 때도 그 그림을 다룬다 (워드와 같은 느낌)
  const { $from } = sel
  const before = $from.nodeBefore
  if (before?.type.name === 'image') return { node: before, pos: $from.pos - before.nodeSize }
  const after = $from.nodeAfter
  if (after?.type.name === 'image') return { node: after, pos: $from.pos }
  return null
}

/** 그림 속성 고치기 — 보호가 걸려 있으면 크기·위치는 건드리지 않는다 */
const GUARDED = new Set(['width', 'height', 'rotate', 'dx', 'dy', 'crop', 'flipH', 'flipV'])

export function setImageAttrs(editor: Editor | null, attrs: Record<string, unknown>, note?: string): boolean {
  const hit = currentImage(editor)
  if (!editor || !hit) return false
  if (hit.node.attrs.locked && Object.keys(attrs).some((k) => GUARDED.has(k))) {
    flash('개체 보호가 걸려 있다 — 「개체 보호 풀기」 를 먼저 하라 (Alt+L)')
    return false
  }
  const tr = editor.state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.node.attrs, ...attrs })
  tr.setSelection(NodeSelection.create(tr.doc, hit.pos))
  editor.view.dispatch(tr)
  /* 이미 편집기에 있으면 다시 focus 하지 않는다.
     focus() 는 브라우저의 커서를 다시 읽어 들이는데, 그림처럼 글자가 아닌 것을 고른 상태는
     브라우저 커서로 나타낼 수 없어 곧바로 글자 고름으로 덮어써진다. 손잡이를 끌면
     한 걸음마다 이 함수가 불리므로, 첫 걸음에서 고름이 풀리고 그 뒤로는 아무 일도
     일어나지 않았다 — 「조금 줄어들다 풀려버린다」 가 이것이다.
     리본이나 메뉴에서 부른 경우에는 초점이 밖에 있으므로 그때만 되돌린다. */
  if (!editor.view.hasFocus()) editor.view.focus()
  if (note) flash(note)
  return true
}

/** 그림을 고른 상태로 만든다 (키보드 조작의 출발점) */
export function selectImage(editor: Editor | null): boolean {
  const hit = currentImage(editor)
  if (!editor || !hit) return false
  const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, hit.pos))
  editor.view.dispatch(tr)
  editor.view.focus()
  return true
}

/* ── 크기 ───────────────────────────────────────────── */

/** 본문 한 줄의 너비 (px) — 「본문 너비에 맞춤」 이 쓴다 */
export function bodyWidthPx(editor: Editor | null): number {
  if (!editor) return 640
  const el = editor.view.dom as HTMLElement
  const page = el.closest('.jan-page') || el
  return Math.max(120, Math.round(page.getBoundingClientRect().width || 640))
}

/**
 * 화면에서 「그림 상자」 노릇을 하는 요소 — 크기를 재고 손잡이를 붙일 자리.
 *
 * 자른 그림은 안쪽 img 가 상자보다 크다(잘려 나갈 만큼 넘쳐 있다). 그것을 재면
 * 자르기 전 크기가 나와 속성 창의 너비·높이와 손잡이 테두리가 함께 어긋난다.
 * 캡션이 붙은 그림도 마찬가지로 바깥 span 에는 캡션 글까지 들어 있어 높이가 더 나온다.
 * 그래서 잘라 내는 span → 그림 → 바깥 span 차례로 찾는다.
 */
export function imageBoxEl(editor: Editor | null, pos: number): HTMLElement | null {
  if (!editor) return null
  const dom = editor.view.nodeDOM(pos)
  if (!(dom instanceof HTMLElement)) return null
  if (dom.tagName === 'IMG') return dom
  return dom.querySelector<HTMLElement>('.jan-img-clip') || dom.querySelector<HTMLElement>('img') || dom
}

/** 그 자리 그림 상자의 화면 크기 */
function boxSizeAt(editor: Editor | null, pos: number): { w: number; h: number } | null {
  const el = imageBoxEl(editor, pos)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height) }
}

/** 지금 화면에 그려진 그림 상자의 크기 */
export function renderedSize(editor: Editor | null): { w: number; h: number } | null {
  const hit = currentImage(editor)
  if (!editor || !hit) return null
  return boxSizeAt(editor, hit.pos)
}

export function setImageWidth(editor: Editor | null, width: string | null, note?: string): boolean {
  return setImageAttrs(editor, { width, height: null }, note)
}

/** 픽셀로 늘리고 줄이기 — 비율 고정이면 높이는 알아서 따라온다 */
export function resizeImage(editor: Editor | null, deltaW: number, deltaH = 0): boolean {
  const hit = currentImage(editor)
  const size = renderedSize(editor)
  if (!hit || !size) return false
  const lock = hit.node.attrs.lock !== false
  const w = Math.max(24, size.w + deltaW)
  if (lock || deltaH === 0) return setImageAttrs(editor, { width: `${Math.round(w)}px`, height: null })
  const h = Math.max(24, size.h + deltaH)
  return setImageAttrs(editor, { width: `${Math.round(w)}px`, height: `${Math.round(h)}px` })
}

/** 원래 크기로 (워드의 「그림 원래대로 · 크기 다시 설정」) */
export function resetImageSize(editor: Editor | null): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  const nw = Number(hit.node.attrs.nw) || 0
  if (!nw) return setImageAttrs(editor, { width: null, height: null }, '원래 크기로 되돌렸다')
  return setImageAttrs(editor, { width: `${nw}px`, height: null }, `원래 크기 ${nw}px 로 되돌렸다`)
}

/** 원래 크기의 몇 % 로 (워드 「크기」 대화상자의 배율) */
export function scaleImage(editor: Editor | null, percent: number): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  const nw = Number(hit.node.attrs.nw) || renderedSize(editor)?.w || 0
  if (!nw) return false
  return setImageAttrs(editor, { width: `${Math.round(nw * percent / 100)}px`, height: null }, `원래 크기의 ${percent}%`)
}

/** 본문 너비에 맞춤 */
export function fitImageToBody(editor: Editor | null): boolean {
  return setImageWidth(editor, '100%', '본문 너비에 맞췄다')
}

/** 표 칸 크기에 맞춰 넣기 (한글에만 있는 것) */
export function fitImageToCell(editor: Editor | null): boolean {
  const hit = currentImage(editor)
  if (!editor || !hit) return false
  const dom = editor.view.nodeDOM(hit.pos)
  const cell = dom instanceof HTMLElement ? dom.closest('td, th') : null
  if (!cell) { flash('표 안의 그림에만 쓸 수 있다'); return false }
  const pad = 8
  const w = Math.max(24, Math.round(cell.getBoundingClientRect().width - pad))
  return setImageAttrs(editor, { width: `${w}px`, height: null }, `칸 너비 ${w}px 에 맞췄다`)
}

/* ── 자르기 ─────────────────────────────────────────── */

export function currentCrop(editor: Editor | null): Crop {
  const hit = currentImage(editor)
  return parseCrop(hit?.node.attrs.crop) || { t: 0, r: 0, b: 0, l: 0 }
}

const NO_CROP: Crop = { t: 0, r: 0, b: 0, l: 0 }

/**
 * 길이를 곱해서 돌려준다 — px 도 % 도 단위를 지키며 줄인다.
 *
 * 「본문 너비에 맞춤」 을 한 그림은 너비가 100% 다. % 를 건드리지 않고 두었더니
 * 자를수록 상자는 그대로인 채 그림만 확대되어, 자르기 손잡이가 커서를 따라오지
 * 못하고 오른쪽 끝에 붙박여 있었다 (무거운 문서의 그림이 모두 그렇다).
 * % 끼리도 비율은 그대로 곱해지므로 단위만 지켜 주면 된다 — 100% → 60% 는
 * 본문에 대한 몫이 줄 뿐, 그림의 배율은 그대로다.
 */
function scaleLen(value: unknown, factor: number): string | null {
  const m = /^(-?[\d.]+)(px|%)$/.exec(String(value ?? '').trim())
  if (!m || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-6) return null
  /* 소수 둘째 자리까지 남긴다. 정수로 반올림하면 한 걸음마다 최대 0.5px 씩 어긋나고,
     자르기는 방향키로 스무 번 서른 번 조금씩 하는 일이라 그 부스러기가 쌓인다 —
     자른 만큼 되돌려도 320px 이 325px 로 돌아오지 않았다. */
  const n = Math.max(m[2] === '%' ? 1 : 8, Number(m[1]) * factor)
  return `${Math.round(n * 100) / 100}${m[2]}`
}

/**
 * 자르기를 새로 건다 — 워드처럼 보이는 상자가 잘린 만큼 줄어든다.
 *
 * 워드에서 자르기는 그림을 확대하지 않는다. 남는 몫이 kw 배로 줄면 상자도 kw 배로 줄어
 * 그림의 배율이 그대로 남는다. 크기를 손으로 정해 둔 그림(width:300px)은 그 값을 함께
 * 줄여 줘야 그렇게 된다 — 안 그러면 상자가 그대로라 자를수록 그림만 확대된다.
 * 너비를 %로 준 그림(본문 너비에 맞춤)은 셈할 수 없어 그대로 둔다.
 */
function cropPatch(editor: Editor | null, hit: ImageHit, crop: Crop): Record<string, unknown> {
  const before = parseCrop(hit.node.attrs.crop) || NO_CROP
  const empty = !crop.t && !crop.r && !crop.b && !crop.l
  const patch: Record<string, unknown> = { crop: empty ? null : cropToString(crop) }
  const fw = (1 - crop.l - crop.r) / (1 - before.l - before.r)
  const fh = (1 - crop.t - crop.b) / (1 - before.t - before.b)
  const w = scaleLen(hit.node.attrs.width, fw)
  if (w) patch.width = w
  else if (hit.node.attrs.width == null && Math.abs(fw - 1) > 1e-6) {
    /* 너비를 손으로 정한 적이 없는 그림은 화면에 그려진 상자를 못박고 그만큼 줄인다.
       그냥 원본 너비에서 셈하면 안 된다 — 본문보다 넓은 그림은 max-width:100% 에 걸려
       화면에서는 이미 줄어 있기 때문이다. 강의 노트의 그림은 원본이 1640px 인데 본문은
       730px 이라, 절반 넘게 잘라 낼 때까지 상자가 꿈쩍도 하지 않아 자르기 손잡이가
       오른쪽 끝에 붙박여 커서를 따라오지 못했다. */
    const box = boxSizeAt(editor, hit.pos)
    if (box?.w) patch.width = `${Math.max(8, Math.round(box.w * fw * 100) / 100)}px`
  }
  const h = scaleLen(hit.node.attrs.height, fh)
  if (h) patch.height = h
  return patch
}

export function setCrop(editor: Editor | null, crop: Crop, note?: string): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  return setImageAttrs(editor, cropPatch(editor, hit, crop), note)
}

/** 한쪽을 조금 더/덜 자른다 (되돌리면 원본이 그대로 돌아온다 — 비파괴) */
export function cropSide(editor: Editor | null, side: keyof Crop, delta: number): boolean {
  const crop = { ...currentCrop(editor) }
  crop[side] = Math.min(0.9, Math.max(0, crop[side] + delta))
  if (crop.l + crop.r >= 0.95 || crop.t + crop.b >= 0.95) return false
  return setCrop(editor, crop)
}

export function clearCrop(editor: Editor | null): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  /* 자르기를 풀면 상자가 잘려 나갔던 몫만큼 다시 늘어난다 (그림의 배율은 그대로) */
  return setImageAttrs(editor, { ...cropPatch(editor, hit, NO_CROP), shape: null }, '자르기를 지웠다 — 원본 그대로')
}

/** 가로세로 비율에 맞춰 가운데를 남기고 자른다 (워드의 「가로 세로 비율」) */
export function cropToRatio(editor: Editor | null, ratio: number, label: string): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  const nw = Number(hit.node.attrs.nw) || 0
  const nh = Number(hit.node.attrs.nh) || 0
  if (!nw || !nh) { flash('그림 크기를 아직 읽지 못했다 — 잠시 뒤 다시 하라'); return false }
  const cur = nw / nh
  if (Math.abs(cur - ratio) < 0.001) return setCrop(editor, { t: 0, r: 0, b: 0, l: 0 }, `${label} — 이미 맞다`)
  if (cur > ratio) {
    const keep = ratio / cur
    const side = (1 - keep) / 2
    return setCrop(editor, { t: 0, r: side, b: 0, l: side }, `${label} 비율로 잘랐다`)
  }
  const keep = cur / ratio
  const side = (1 - keep) / 2
  return setCrop(editor, { t: side, r: 0, b: side, l: 0 }, `${label} 비율로 잘랐다`)
}

/**
 * 워드의 자르기 ▸ 「채우기」 — 상자는 그대로 두고 그림이 상자에 꽉 차게 잘라 낸다.
 * 상자의 가로세로비에 맞춰 가운데를 남기므로 그림이 찌그러지지 않는다.
 *
 * 상자와 그림의 비율이 같으면 잘라 낼 것이 없다. 그래서 높이를 손으로 정해 둔
 * 그림에서만 뜻이 있다 — 비율 고정을 풀고 너비·높이를 준 다음에 쓰는 단추다.
 */
export function fillBox(editor: Editor | null): boolean {
  const hit = currentImage(editor)
  const size = renderedSize(editor)
  if (!hit || !size || !size.w || !size.h) return false
  const nw = Number(hit.node.attrs.nw) || 0
  const nh = Number(hit.node.attrs.nh) || 0
  if (!nw || !nh) { flash('그림 크기를 아직 읽지 못했다 — 잠시 뒤 다시 하라'); return false }
  const boxRatio = size.w / size.h
  const picRatio = nw / nh
  const crop: Crop = { t: 0, r: 0, b: 0, l: 0 }
  if (picRatio > boxRatio) {
    const side = (1 - boxRatio / picRatio) / 2
    crop.l = side; crop.r = side
  } else if (picRatio < boxRatio) {
    const side = (1 - picRatio / boxRatio) / 2
    crop.t = side; crop.b = side
  }
  /* setCrop 은 자른 만큼 상자를 줄인다 — 채우기는 상자를 지켜야 하므로 크기를 되돌려 준다 */
  return setImageAttrs(
    editor,
    { crop: crop.t || crop.l ? cropToString(crop) : null, width: `${size.w}px`, height: `${size.h}px` },
    '상자에 꽉 차게 잘랐다',
  )
}

/** 워드의 자르기 ▸ 「맞춤」 — 자르기를 풀고 그림 전체가 상자 안에 들어오게 줄인다 */
export function fitBox(editor: Editor | null): boolean {
  const hit = currentImage(editor)
  const size = renderedSize(editor)
  if (!hit || !size || !size.w || !size.h) return false
  const nw = Number(hit.node.attrs.nw) || 0
  const nh = Number(hit.node.attrs.nh) || 0
  if (!nw || !nh) { flash('그림 크기를 아직 읽지 못했다 — 잠시 뒤 다시 하라'); return false }
  const scale = Math.min(size.w / nw, size.h / nh)
  return setImageAttrs(
    editor,
    { crop: null, width: `${Math.max(8, Math.round(nw * scale))}px`, height: null },
    '상자 안에 그림 전체가 들어오게 맞췄다',
  )
}

/* ── 회전·대칭 ──────────────────────────────────────── */

export function rotateImage(editor: Editor | null, deg: number): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  const next = (((Number(hit.node.attrs.rotate) || 0) + deg) % 360 + 360) % 360
  return setImageAttrs(editor, { rotate: next }, `${next}° 회전`)
}

export function setRotation(editor: Editor | null, deg: number): boolean {
  const next = ((Math.round(deg) % 360) + 360) % 360
  return setImageAttrs(editor, { rotate: next }, `${next}° 로 돌렸다`)
}

export function flipImage(editor: Editor | null, axis: 'h' | 'v'): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  const key = axis === 'h' ? 'flipH' : 'flipV'
  return setImageAttrs(editor, { [key]: !hit.node.attrs[key] }, axis === 'h' ? '좌우 대칭' : '상하 대칭')
}

/* ── 배치 ───────────────────────────────────────────── */

export function setImageWrap(editor: Editor | null, wrap: string | null, note?: string): boolean {
  return setImageAttrs(editor, { wrap }, note)
}

export function setImageAlign(editor: Editor | null, align: 'left' | 'center' | 'right' | null): boolean {
  return setImageAttrs(editor, { align })
}

/** 미세 이동 — 한글의 방향키 이동 (감싸기·글 앞뒤에서 자리를 조금 옮긴다) */
export function nudgeImage(editor: Editor | null, dx: number, dy: number): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  return setImageAttrs(editor, {
    dx: (Number(hit.node.attrs.dx) || 0) + dx,
    dy: (Number(hit.node.attrs.dy) || 0) + dy,
  })
}

export function resetPosition(editor: Editor | null): boolean {
  return setImageAttrs(editor, { dx: 0, dy: 0 }, '제자리로 되돌렸다')
}

/* ── 모양 ───────────────────────────────────────────── */

export function setImageStyle(editor: Editor | null, style: string | null, label?: string): boolean {
  return setImageAttrs(editor, { style: style === 'none' ? null : style }, label ? `그림 스타일: ${label}` : undefined)
}

export function setImageBorder(
  editor: Editor | null,
  border: { color?: string | null; width?: number | null; style?: string | null }
): boolean {
  const next: Record<string, unknown> = {}
  if ('color' in border) next.borderColor = border.color
  if ('width' in border) next.borderWidth = border.width
  if ('style' in border) next.borderStyle = border.style
  return setImageAttrs(editor, next)
}

export function setImageShape(editor: Editor | null, shape: string | null, label?: string): boolean {
  return setImageAttrs(editor, { shape }, shape ? `${label} 모양으로 잘랐다` : '도형 자르기를 풀었다')
}

/* ── 보정 (밝기·대비·채도·색조) ───────────────────────── */

export function currentAdjust(editor: Editor | null): Adjust {
  const hit = currentImage(editor)
  return parseAdjust(hit?.node.attrs.adjust)
}

export function setAdjust(editor: Editor | null, patch: Partial<Adjust>, note?: string): boolean {
  const next = { ...currentAdjust(editor), ...patch }
  const value = adjustToString(next)
  return setImageAttrs(editor, { adjust: value || null }, note)
}

export function bumpAdjust(editor: Editor | null, key: keyof Adjust, delta: number): boolean {
  const cur = currentAdjust(editor)
  const limits: Record<keyof Adjust, [number, number]> = {
    bright: [10, 300], contrast: [10, 300], sat: [0, 300], hue: [-180, 180], blur: [0, 20], gray: [0, 100], sepia: [0, 100],
  }
  const [lo, hi] = limits[key]
  const value = Math.min(hi, Math.max(lo, cur[key] + delta))
  const names: Record<keyof Adjust, string> = {
    bright: '밝기', contrast: '대비', sat: '채도', hue: '색조', blur: '흐림', gray: '회색조', sepia: '세피아',
  }
  return setAdjust(editor, { [key]: value }, `${names[key]} ${Math.round(value)}`)
}

/** 다시 칠하기 프리셋 — 워드의 「색」 */
export const RECOLORS: { key: string; label: string; patch: Partial<Adjust> }[] = [
  { key: 'none', label: '원래 색', patch: { ...ADJUST_DEFAULT } },
  { key: 'gray', label: '회색조', patch: { gray: 100, sepia: 0 } },
  { key: 'sepia', label: '세피아', patch: { sepia: 80, gray: 0 } },
  { key: 'washout', label: '워시아웃 (배경용)', patch: { bright: 145, contrast: 60, sat: 60 } },
  { key: 'bw', label: '흑백 (뚜렷하게)', patch: { gray: 100, contrast: 220, bright: 105 } },
  { key: 'cool', label: '차갑게', patch: { hue: -18, sat: 115 } },
  { key: 'warm', label: '따뜻하게', patch: { hue: 14, sat: 115 } },
  { key: 'vivid', label: '선명하게', patch: { sat: 150, contrast: 115 } },
  { key: 'soft', label: '부드럽게', patch: { blur: 1, contrast: 92 } },
]

export function applyRecolor(editor: Editor | null, key: string): boolean {
  const preset = RECOLORS.find((r) => r.key === key)
  if (!preset) return false
  if (key === 'none') return setImageAttrs(editor, { adjust: null }, '색을 원래대로')
  return setAdjust(editor, preset.patch, `색: ${preset.label}`)
}

/** 그림 서식을 모두 지운다 — 워드의 「그림 원래대로」 */
export function resetImageFormat(editor: Editor | null, alsoSize = false): boolean {
  const patch: Record<string, unknown> = {
    adjust: null, style: null, shape: null, crop: null, rotate: 0, flipH: false, flipV: false,
    borderColor: null, borderWidth: null, borderStyle: null, radius: null, opacity: null, dx: 0, dy: 0,
  }
  if (alsoSize) { patch.width = null; patch.height = null }
  return setImageAttrs(editor, patch, alsoSize ? '그림과 크기를 원래대로' : '그림 서식을 원래대로')
}

/* ── 대체 텍스트 · 캡션 ─────────────────────────────── */

export function setAltText(editor: Editor | null, alt: string, title?: string): boolean {
  return setImageAttrs(editor, { alt: alt || null, title: title || null }, '대체 텍스트를 저장했다')
}

/** 캡션 — 그림과 한 몸이라 그림을 옮기면 함께 간다 (한글 방식) */
export function setImageCaption(editor: Editor | null, caption: string | null, capPos?: string): boolean {
  const patch: Record<string, unknown> = { caption: caption || null }
  if (capPos) patch.capPos = capPos
  return setImageAttrs(editor, patch, caption ? '캡션을 달았다' : '캡션을 지웠다')
}

export function setCaptionPos(editor: Editor | null, pos: string): boolean {
  const names: Record<string, string> = { top: '위', bottom: '아래', left: '왼쪽', right: '오른쪽' }
  return setImageAttrs(editor, { capPos: pos }, `캡션을 ${names[pos] || pos}에 두었다`)
}

/** 문서 안 그림 차례대로 「그림 N」 번호를 매긴다 */
export function numberImageCaptions(editor: Editor | null, prefix = '그림'): number {
  if (!editor) return 0
  const { tr, doc } = editor.state
  let n = 0
  let changed = false
  doc.descendants((node, pos) => {
    if (node.type.name !== 'image') return
    const cap = node.attrs.caption
    if (cap == null || cap === '') return
    n += 1
    const body = String(cap).replace(/^\s*(그림|표|Figure|Fig\.?|Table)\s*\d+\s*[.·:]?\s*/i, '')
    const next = `${prefix} ${n}. ${body}`.replace(/\.\s*$/, body ? '' : '')
    if (next !== cap) { tr.setNodeMarkup(pos, undefined, { ...node.attrs, caption: next }); changed = true }
  })
  if (changed) editor.view.dispatch(tr)
  flash(`캡션 ${n}개에 번호를 다시 매겼다`)
  return n
}

/* ── 개체 보호 (한글) ──────────────────────────────── */

export function toggleImageLock(editor: Editor | null): boolean {
  const hit = currentImage(editor)
  if (!editor || !hit) return false
  const next = !hit.node.attrs.locked
  const tr = editor.state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.node.attrs, locked: next })
  tr.setSelection(NodeSelection.create(tr.doc, hit.pos))
  editor.view.dispatch(tr)
  flash(next ? '개체를 보호했다 — 크기·위치가 바뀌지 않는다' : '개체 보호를 풀었다')
  return true
}

export function toggleAspectLock(editor: Editor | null): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  const next = hit.node.attrs.lock === false
  return setImageAttrs(editor, { lock: next }, next ? '가로세로 비율 고정' : '비율 고정 해제 — 자유롭게 늘어난다')
}

/* ── 그림 파일 다루기 ───────────────────────────────── */

/** 캔버스에 다시 그려 바꾼 결과를 dataURL 로 (압축·배경 제거가 쓴다) */
async function redraw(
  src: string,
  paint: (ctx: CanvasRenderingContext2D, img: HTMLImageElement, canvas: HTMLCanvasElement) => void,
  type = 'image/png',
  quality?: number
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        paint(ctx, img, canvas)
        resolve(canvas.toDataURL(type, quality))
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** 그림 압축 — 긴 변을 maxSide 로 줄이고 JPEG 로 다시 굽는다 */
export async function compressImage(editor: Editor | null, maxSide = 1600, quality = 0.82): Promise<boolean> {
  const hit = currentImage(editor)
  if (!hit) return false
  const src = String(hit.node.attrs.src || '')
  const before = src.length
  const out = await redraw(src, (ctx, img, canvas) => {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }, 'image/jpeg', quality)
  if (!out) { flash('압축하지 못했다 — 다른 곳에서 불러온 그림일 수 있다'); return false }
  const saved = Math.max(0, Math.round((1 - out.length / Math.max(1, before)) * 100))
  return setImageAttrs(editor, { src: out, nw: null, nh: null }, `압축했다 — 용량 ${saved}% 줄었다`)
}

/** 흰 배경을 투명하게 (워드의 「배경 제거」 를 웹에서 할 수 있는 만큼) */
export async function removeWhiteBackground(editor: Editor | null, tolerance = 26): Promise<boolean> {
  const hit = currentImage(editor)
  if (!hit) return false
  const out = await redraw(String(hit.node.attrs.src || ''), (ctx, img) => {
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight)
    const px = data.data
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > 255 - tolerance && px[i + 1] > 255 - tolerance && px[i + 2] > 255 - tolerance) px[i + 3] = 0
    }
    ctx.putImageData(data, 0, 0)
  })
  if (!out) { flash('배경을 지우지 못했다 — 다른 곳에서 불러온 그림일 수 있다'); return false }
  return setImageAttrs(editor, { src: out }, '흰 배경을 투명하게 만들었다')
}

/** 그림 파일로 내려받기 */
export function downloadImage(editor: Editor | null): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  const src = String(hit.node.attrs.src || '')
  const a = document.createElement('a')
  a.href = src
  a.download = `image-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  flash('그림을 내려받았다')
  return true
}

/** 그림 바꾸기 — 서식은 그대로 두고 알맹이만 갈아 끼운다 (워드의 「그림 바꾸기」) */
export function replaceImage(editor: Editor | null, src: string): boolean {
  return setImageAttrs(editor, { src, nw: null, nh: null }, '그림을 바꿨다 — 서식은 그대로')
}

/* ── 앞 개체 속성 적용 (한글) ─────────────────────────── */

const REUSE_KEYS = ['width', 'align', 'wrap', 'style', 'borderColor', 'borderWidth', 'borderStyle', 'radius', 'adjust', 'shape', 'capPos'] as const
let lastProps: Record<string, unknown> | null = null

/** 지금 그림의 꾸밈을 「본」 으로 기억해 둔다 */
export function copyImageFormat(editor: Editor | null): boolean {
  const hit = currentImage(editor)
  if (!hit) return false
  lastProps = {}
  for (const key of REUSE_KEYS) lastProps[key] = hit.node.attrs[key]
  flash('그림 서식을 복사했다 — 다른 그림에서 「서식 붙이기」')
  return true
}

/** 기억해 둔 꾸밈을 이 그림에 그대로 (그림 스무 장에 같은 서식 줄 때) */
export function pasteImageFormat(editor: Editor | null): boolean {
  if (!lastProps) { flash('먼저 본이 될 그림에서 「서식 복사」 를 하라'); return false }
  return setImageAttrs(editor, { ...lastProps }, '앞 그림의 서식을 입혔다')
}

export function hasCopiedFormat(): boolean {
  return lastProps != null
}

/* ── 개체 순회 (한글의 Tab 순환) ───────────────────────── */

/** 문서 안 그림을 차례로 고른다 — 마우스 없이 개체를 잡는 길 */
export function selectNextImage(editor: Editor | null, dir: 1 | -1): boolean {
  if (!editor) return false
  const spots: number[] = []
  editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image') spots.push(pos) })
  if (!spots.length) { flash('문서에 그림이 없다'); return false }
  const here = currentImage(editor)?.pos ?? -1
  let target: number
  if (here >= 0) {
    const i = spots.indexOf(here)
    target = spots[(i + dir + spots.length) % spots.length]
  } else if (dir === 1) {
    const from = editor.state.selection.from
    target = spots.find((p) => p > from) ?? spots[0]
  } else {
    const from = editor.state.selection.from
    target = [...spots].reverse().find((p) => p < from) ?? spots[spots.length - 1]
  }
  const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, target))
  tr.scrollIntoView()
  editor.view.dispatch(tr)
  editor.view.focus()
  return true
}

/** 문서 안 그림 목록 — 「선택 창」 이 쓴다 */
export function listImages(editor: Editor | null): { pos: number; alt: string; src: string; caption: string }[] {
  if (!editor) return []
  const out: { pos: number; alt: string; src: string; caption: string }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'image') return
    out.push({
      pos,
      alt: String(node.attrs.alt || ''),
      src: String(node.attrs.src || ''),
      caption: String(node.attrs.caption || ''),
    })
  })
  return out
}

export function selectImageAt(editor: Editor | null, pos: number): boolean {
  if (!editor) return false
  const node = editor.state.doc.nodeAt(pos)
  if (!node || node.type.name !== 'image') return false
  const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos))
  tr.scrollIntoView()
  editor.view.dispatch(tr)
  editor.view.focus()
  return true
}

/* ── 문서 안에서 옮기기 ─────────────────────────────── */

/** 그림을 앞/뒤 문단으로 옮긴다 (표 옮기기와 같은 결) */
export function moveImage(editor: Editor | null, dir: -1 | 1): boolean {
  const hit = currentImage(editor)
  if (!editor || !hit) return false
  const { state } = editor
  const $pos = state.doc.resolve(hit.pos)
  const parent = $pos.parent
  const index = $pos.index()
  const target = index + dir
  if (target < 0 || target >= parent.childCount) { flash('더 옮길 곳이 없다'); return false }
  const tr = state.tr
  const node = hit.node
  tr.delete(hit.pos, hit.pos + node.nodeSize)
  let insertAt: number
  if (dir === -1) {
    insertAt = $pos.posAtIndex(index - 1)
  } else {
    insertAt = hit.pos + parent.child(target).nodeSize
  }
  tr.insert(tr.mapping.map(insertAt, -1), node)
  const finalPos = tr.mapping.map(insertAt, -1)
  try { tr.setSelection(NodeSelection.create(tr.doc, finalPos)) } catch { /* 자리 못 잡으면 그냥 둔다 */ }
  editor.view.dispatch(tr)
  editor.view.focus()
  return true
}

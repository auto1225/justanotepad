import { Node, Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { canJoin } from '@tiptap/pm/transform'
import { mergeContinuedTables, rowsThatFit, splitTableAcrossPages } from './tableSplit'
import type { Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PMNode, NodeType } from '@tiptap/pm/model'

/**
 * 독립 페이지 문서 모델 — 용지 규격에 따라 각 쪽을 실제 노드(page)로 만든다.
 *
 * 기존 방식(tiptap-pagination-plus)은 데코레이션으로 페이지 "눈금"만 그려서
 * 문서 구조상 페이지가 존재하지 않았다. 그래서 엔터로 내용이 밀릴 때 재계산이
 * 어긋나고, 페이지를 낱장으로 떼어 배치할 수도 없었다.
 *
 * 이 확장은 doc > page+ > block+ 구조로 바꾸고, 용지 안쪽 높이를 넘치는 만큼
 * 다음 쪽으로 흘려보내고(밀기) 여유가 생기면 다시 당겨온다(당기기).
 *
 * 설계 원칙:
 * - 한 프레임에 한 번의 이동만 수행하고 다시 측정한다 (DOM 갱신 전 측정은 신뢰할 수 없다)
 * - 페이지에 블록이 하나뿐인데도 넘치면 더 밀 수 없으므로 그 쪽은 넘침을 허용한다
 *   (한 페이지보다 긴 표·이미지에서 무한 루프를 막는 유일한 방법)
 * - 저장 형식은 기존과 같은 평면 HTML 을 유지한다 (pageToFlatHtml/flatHtmlToPages)
 */

export interface PageMetrics {
  /** 용지 안쪽(여백 제외) 사용 가능 높이 px */
  contentHeightPx: number
}

export const PAGE_NODE_NAME = 'page'
const reflowKey = new PluginKey('janPageReflow')
/** 늘어나도 되는 쪽(쪼갤 수 없는 큰 블록이 든 쪽)의 위치 목록 */
const growKey = new PluginKey<number[]>('janPageGrow')

/** 페이지 노드 — 한 장의 용지 */
export const PageNode = Node.create({
  name: PAGE_NODE_NAME,
  group: 'pageblock',
  content: 'block+',
  // 커서가 쪽 경계를 자유롭게 넘나들어야 하므로 isolating 은 끈다
  isolating: false,
  defining: false,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-jan-page]' }]
  },

  renderHTML() {
    return ['div', { 'data-jan-page': 'true', class: 'jan-page-node' }, 0]
  },
})

/**
 * 쪼개진 문단 표시 — 페이지 경계에서 줄 단위로 나뉜 뒷조각에 붙는다.
 * 저장할 때 이 표시를 가진 문단을 앞 문단에 다시 합쳐 원래 구조를 보존한다.
 */
export const ContinuedAttr = Extension.create({
  name: 'janContinuedAttr',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          janCont: {
            default: null,
            parseHTML: (el) => (el.getAttribute('data-jan-cont') ? '1' : null),
            renderHTML: (attrs) => (attrs.janCont ? { 'data-jan-cont': '1' } : {}),
          },
        },
      },
    ]
  },
})

/** 줄 상자 하나 — 화면 좌표 기준 위·아래 */
interface LineBox { top: number; bottom: number }

/**
 * 단(段) 좌표계 — 다단 조판에서도 "한 줄기"로 재기 위한 변환.
 *
 * 2단 쪽은 왼 단 바닥에서 오른 단 꼭대기로 글이 이어진다. 화면 y 만 보면
 * 오른 단의 첫 줄이 왼 단의 첫 줄과 같은 높이라 "앞으로 되돌아간" 것처럼 보이므로,
 * 단을 아래로 이어 붙인 좌표(flow y)로 바꿔서 잰다. 1단이면 그냥 화면 좌표다.
 * 줌(scale)도 여기서 함께 벗겨 내 모든 계산을 CSS 픽셀로 통일한다.
 */
interface Flow {
  /** 화면 좌표(top,left) → 흐름 좌표 (CSS 픽셀, 그 블록이 놓인 밴드의 위끝이 0) */
  y: (top: number, left: number) => number
  columns: number
  /** 화면 픽셀 → CSS 픽셀 배율 */
  scale: number
}

/** 쪽의 기하 — 단 나눔과 줌을 벗겨 낸 값들 (모든 길이는 CSS 픽셀) */
interface PageGeom {
  columns: number
  scale: number
  /** 화면 좌표 기준 안쪽 위끝·아래끝·왼끝 */
  contentTop: number
  contentBottom: number
  contentLeft: number
  /** 단 하나의 가로 간격 (화면 픽셀) */
  step: number
  contentHeight: number
}

function pageGeom(el: HTMLElement, contentHeight: number): PageGeom {
  const rect = el.getBoundingClientRect()
  const scale = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1
  const s = scale || 1
  const cs = window.getComputedStyle(el)
  const columns = Math.max(1, Math.round(Number(cs.columnCount)) || 1)
  const padTop = parseFloat(cs.paddingTop) || 0
  const padLeft = parseFloat(cs.paddingLeft) || 0
  const padRight = parseFloat(cs.paddingRight) || 0
  const gap = parseFloat(cs.columnGap) || 0
  const innerW = el.offsetWidth - padLeft - padRight
  const colW = (innerW - gap * (columns - 1)) / columns
  const contentTop = rect.top + padTop * s
  return {
    columns,
    scale: s,
    contentTop,
    contentBottom: contentTop + contentHeight * s,
    contentLeft: rect.left + padLeft * s,
    step: (colW + gap) * s,
    contentHeight,
  }
}

/**
 * 밴드 — 단이 흐르는 한 구간.
 * 지면 전체 폭을 쓰는 블록(넓은 표·제목)이 끼면 그 위아래로 단 구간이 갈린다.
 * 그 블록을 앞 단들과 같은 높이로 보면 "아직 자리가 남았다"고 잘못 재서
 * 표가 아래 여백을 뚫고 내려간다 — 그래서 밴드마다 기준을 새로 잡는다.
 */
interface Band {
  /** 이 밴드가 시작하기까지 이미 흘러간 길이 */
  base: number
  /** 밴드 꼭대기의 화면 y */
  top: number
  /** 이 밴드에서 단 하나가 담는 높이 */
  height: number
}

/** 어떤 블록이 놓인 밴드를 기준으로 한 흐름 좌표 변환 */
function bandFlow(geom: PageGeom, band: Band, spanning: boolean): Flow {
  const colOf = (left: number) => (geom.step > 0 ? Math.max(0, Math.floor((left - geom.contentLeft + 1) / geom.step)) : 0)
  return {
    y: (top, left) =>
      band.base + (spanning ? 0 : colOf(left) * band.height) + (top - band.top) / geom.scale,
    columns: geom.columns,
    scale: geom.scale,
  }
}

/** 1단·줌 없음 기준의 기본 흐름 (화면 좌표 그대로) */
const SCREEN_FLOW: Flow = { y: (top) => top, columns: 1, scale: 1 }

/**
 * Range 가 돌려준 사각형들을 줄 단위로 묶는다.
 * 한 줄이라도 굵기·크기가 다른 글자가 섞이면 사각형이 여러 개로 나뉘므로,
 * 세로로 겹치는 것끼리 한 줄로 합친다. 좌표는 흐름 좌표로 바꿔서 묶는다 —
 * 그래야 서로 다른 단의 같은 높이 줄이 한 줄로 뭉치지 않는다.
 */
function groupLines(rects: ArrayLike<DOMRect>, flow: Flow = SCREEN_FLOW): LineBox[] {
  const lines: LineBox[] = []
  for (const raw of Array.from(rects)) {
    if (raw.height <= 0) continue
    const top = flow.y(raw.top, raw.left)
    const r = { top, bottom: top + raw.height / flow.scale, height: raw.height / flow.scale }
    const last = lines[lines.length - 1]
    if (last) {
      /* 같은 줄인지는 "겹치는가"가 아니라 "가운데가 비슷한가"로 본다.
         줄 간격을 좁히면(line-height 1) 글자 사각형이 아래윗줄끼리 겹쳐서,
         겹침으로 묶으면 문단 전체가 한 줄로 뭉쳐 버린다. */
      const mid = (r.top + r.bottom) / 2
      const lastMid = (last.top + last.bottom) / 2
      const tol = Math.max(2, Math.min(last.bottom - last.top, r.height) * 0.5)
      if (Math.abs(mid - lastMid) < tol) {
        last.top = Math.min(last.top, r.top)
        last.bottom = Math.max(last.bottom, r.bottom)
        continue
      }
    }
    lines.push({ top: r.top, bottom: r.bottom })
  }
  return lines
}

/**
 * 요소 안에서 maxHeight(CSS px, 흐름 좌표) 안에 들어가는 마지막 줄을 찾아,
 * 그 다음 줄이 시작하는 문자 위치를 돌려준다 — 줄 중간에서는 자르지 않는다.
 *
 * 글자 하나의 사각형이 아니라 줄 상자를 재는 이유: 글자 아래끝은 줄 상자보다
 * 줄 간격만큼 위에 있어서, 그 값으로 자르면 앞조각이 예상보다 커져 쪽을 넘긴다.
 * 자를 문자는 "앞에서부터 세어 몇 줄을 차지하는가"로 이진 탐색한다
 * (문자마다 재면 긴 문단에서 너무 느리다).
 */
function findLineCut(el: HTMLElement, maxHeight: number, flow: Flow = SCREEN_FLOW): { node: Text; offset: number } | null {
  const texts: Array<{ node: Text; start: number }> = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let total = 0
  let n: globalThis.Node | null
  while ((n = walker.nextNode())) {
    const t = n as unknown as Text
    if (!t.length) continue
    texts.push({ node: t, start: total })
    total += t.length
  }
  if (total < 2) return null

  /** 문자 인덱스 → 텍스트 노드 안 위치 (끝 경계 포함) */
  const locate = (i: number) => {
    for (let k = texts.length - 1; k >= 0; k--) {
      if (i >= texts[k].start) {
        return { node: texts[k].node, off: Math.min(i - texts[k].start, texts[k].node.length) }
      }
    }
    return { node: texts[0].node, off: 0 }
  }

  const range = document.createRange()
  const linesUpTo = (i: number): LineBox[] => {
    const { node, off } = locate(i)
    range.setStart(texts[0].node, 0)
    range.setEnd(node, off)
    return groupLines(range.getClientRects(), flow)
  }

  // 1) 문단 전체의 줄 상자 — 어느 줄까지 남는 자리에 들어가는가
  const all = linesUpTo(total)
  if (all.length < 2) return null // 한 줄짜리는 쪼갤 수 없다
  const elRects = el.getClientRects()
  const elHead = elRects.length ? elRects[0] : el.getBoundingClientRect()
  const elTop = flow.y(elHead.top, elHead.left)
  /* i 번째 줄까지 넣었을 때 차지하는 높이 — 다음 줄의 윗선이 실제 줄 간격이다.
     글자 사각형의 아래끝(bottom)은 내려긋기(descent) 때문에 줄 간격보다 커서,
     그 값으로 재면 줄 간격을 좁혔을 때 한두 줄씩 덜 들어간다. */
  const lineEnd = (i: number) => (i + 1 < all.length ? all[i + 1].top : all[i].bottom)
  let fit = -1
  for (let i = 0; i < all.length; i++) {
    if (lineEnd(i) - elTop > maxHeight) break
    fit = i
  }
  if (fit < 0) return null              // 첫 줄도 안 들어간다 → 통째로 옮기는 편이 낫다
  if (fit >= all.length - 1) return null // 전부 들어간다 → 쪼갤 필요 없다

  // 2) (fit+1)번째 줄의 첫 문자 = 자를 지점. 앞에서부터의 줄 수는 단조 증가하므로 이진 탐색
  const want = fit + 2
  let lo = 1
  let hi = total
  let end = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (linesUpTo(mid).length >= want) { end = mid; hi = mid - 1 } else { lo = mid + 1 }
  }
  if (end <= 1) return null             // 첫 줄부터 넘어간다

  const { node, off } = locate(end - 1)
  return { node, offset: off }
}

/** 문서 최상위를 page+ 로 교체 */
export const PageDoc = Node.create({
  name: 'doc',
  topNode: true,
  content: `${PAGE_NODE_NAME}+`,
})

interface ReflowOptions {
  /** 현재 용지 안쪽 높이를 알려주는 함수 (줌·용지 설정 변화를 즉시 반영) */
  getContentHeight: () => number
  /** 한 번의 편집으로 허용할 최대 리플로우 프레임 수 (폭주 방지) */
  maxPasses?: number
}

interface PageMeasure {
  el: HTMLElement
  /** 이 쪽이 실제로 쓴 흐름 길이 */
  used: number
  /** 자식별 흐름 시작·끝 (바깥 여백 포함) */
  starts: number[]
  ends: number[]
  /** 자식별 "아래 여백을 침범했는가" — 기하로 직접 본다 */
  overflows: boolean[]
  /** 자식별 "여기서부터 지면 바닥까지 남은 높이" (쪼갤 자리를 잴 때 쓴다) */
  rooms: number[]
  /** 자식별 "단을 가로지르는가" — 가로지르는 블록은 단 아래에 통째로 놓인다 */
  spanning: boolean[]
  anyOverflow: boolean
  /** 마지막 밴드 기준으로 더 담을 수 있는 여유 (당겨오기 판단용) */
  room: number
  /** 자식 하나를 줄 단위로 잴 때 쓰는 좌표 변환 (그 블록이 놓인 밴드 기준) */
  flowAt: (childIndex: number) => Flow
  columns: number
  scale: number
}

/**
 * 페이지 DOM 측정.
 *
 * 넘침은 흐름 길이를 더해 짐작하지 않고 **기하로 직접** 본다 —
 * 아래 여백선을 넘어간 조각이 있는가, 또는 마지막 단 바깥으로 밀려났는가.
 * (지면 전체 폭을 쓰는 표가 끼면 브라우저는 단을 더 만들지 않고 그냥 아래로
 *  흘려보내므로, 길이 합만으로는 "아직 자리가 있다"는 잘못된 답이 나온다.)
 *
 * 쪼갤 자리·당겨올 양을 재는 데에는 여전히 흐름 좌표를 쓴다 —
 * 단을 아래로 이어 붙인 좌표라야 줄 순서가 맞는다.
 */
function measure(view: EditorView, pagePos: number, contentHeight: number): PageMeasure | null {
  const dom = view.nodeDOM(pagePos)
  if (!(dom instanceof HTMLElement)) return null
  const geom = pageGeom(dom, contentHeight)
  const starts: number[] = []
  const ends: number[] = []
  const rooms: number[] = []
  const overflows: boolean[] = []
  const spanning: boolean[] = []
  const bands: Array<{ band: Band; spanning: boolean }> = []
  let acc = 0

  if (geom.columns === 1) {
    const band: Band = { base: 0, top: geom.contentTop, height: contentHeight }
    /* 높이를 더해 쌓지 않고 실제 놓인 자리로 잰다 —
       도형처럼 한 줄에 나란히 놓이는 블록(인라인)은 높이를 더하면 줄 수만큼 부풀어,
       자리가 남았는데도 문단을 쪼개거나 다음 쪽 내용을 당겨오지 못한다 */
    for (const child of Array.from(dom.children)) {
      const el = child as HTMLElement
      if (el.classList.contains('ProseMirror-widget')) continue
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      const top = (rect.top - geom.contentTop) / geom.scale - (parseFloat(style.marginTop) || 0)
      const bottom = (rect.bottom - geom.contentTop) / geom.scale + (parseFloat(style.marginBottom) || 0)
      starts.push(top)
      rooms.push(contentHeight - top)
      ends.push(bottom)
      overflows.push(bottom > contentHeight + 1)
      spanning.push(false)
      bands.push({ band, spanning: false })
      acc = Math.max(acc, bottom)
    }
    const flow = bandFlow(geom, band, false)
    return {
      el: dom, used: acc, starts, ends, rooms, overflows, spanning,
      anyOverflow: overflows.some(Boolean), room: contentHeight - acc,
      flowAt: () => flow, columns: 1, scale: geom.scale,
    }
  }

  const colOf = (left: number) => (geom.step > 0 ? Math.max(0, Math.floor((left - geom.contentLeft + 1) / geom.step)) : 0)
  let band: Band = { base: 0, top: geom.contentTop, height: contentHeight }
  for (const child of Array.from(dom.children)) {
    const el = child as HTMLElement
    if (el.classList.contains('ProseMirror-widget')) continue
    const style = window.getComputedStyle(el)
    const marginTop = parseFloat(style.marginTop) || 0
    const marginBottom = parseFloat(style.marginBottom) || 0
    const spans = style.columnSpan === 'all'
    spanning.push(spans)
    const rects = Array.from(el.getClientRects())
    if (!rects.length) {
      starts.push(acc); ends.push(acc); rooms.push(0); overflows.push(false); bands.push({ band, spanning: spans })
      continue
    }
    const head = rects[0]
    const tail = rects[rects.length - 1]
    // 아래 여백을 넘었거나, 마지막 단 밖으로 밀려났으면 넘친 것이다
    const over = rects.some((r) => r.bottom > geom.contentBottom + 1 || colOf(r.left) >= geom.columns)
    overflows.push(over)

    if (spans) {
      const spanBand: Band = { base: band.base + geom.columns * band.height, top: head.top, height: band.height }
      const height = (tail.bottom - head.top) / geom.scale
      const start = spanBand.base - marginTop
      const end = spanBand.base + height + marginBottom
      starts.push(start)
      ends.push(end)
      rooms.push((geom.contentBottom - head.top) / geom.scale)
      bands.push({ band: spanBand, spanning: true })
      acc = Math.max(acc, end)
      // 이 블록 아래로 단이 다시 흐른다 — 밴드를 새로 연다
      band = { base: end, top: tail.bottom, height: Math.max(0, (geom.contentBottom - tail.bottom) / geom.scale) }
      continue
    }

    const flow = bandFlow(geom, band, false)
    const start = flow.y(head.top, head.left) - marginTop
    const end = flow.y(tail.top, tail.left) + tail.height / geom.scale + marginBottom
    starts.push(start)
    ends.push(Math.max(end, start))
    rooms.push(band.base + geom.columns * band.height - start)
    bands.push({ band, spanning: false })
    acc = Math.max(acc, end)
  }

  return {
    el: dom,
    used: acc,
    starts,
    ends,
    rooms,
    overflows,
    spanning,
    anyOverflow: overflows.some(Boolean),
    // 마지막 밴드의 단 바닥까지가 아직 담을 수 있는 자리다
    room: band.base + geom.columns * band.height - acc,
    flowAt: (i) => {
      const entry = bands[i] || { band, spanning: false }
      return bandFlow(geom, entry.band, entry.spanning)
    },
    columns: geom.columns,
    scale: geom.scale,
  }
}

/** 페이지 노드들의 위치와 노드를 순서대로 수집 */
function collectPages(doc: PMNode): Array<{ pos: number; node: PMNode }> {
  const pages: Array<{ pos: number; node: PMNode }> = []
  doc.forEach((node, offset) => {
    if (node.type.name === PAGE_NODE_NAME) pages.push({ pos: offset, node })
  })
  return pages
}

/** 한 줄이라도 넣어 볼 만한 최소 여유 (이보다 좁으면 문단을 통째로 넘긴다) */
const MIN_SPLIT_ROOM = 24

/* ── 떨어지면 안 되는 짝 ──
   제목은 뒤따르는 본문과, 표 캡션은 아래 표와, 그림 캡션은 위 그림과 붙어 다닌다.
   쪽 경계에서 이것들이 갈라지면 "표 1." 만 쪽 바닥에 남고 표는 다음 쪽에 오는
   꼴이 되어, 워드·한글·저널 조판 어디에서도 허용하지 않는다. */
function paperBlockKind(node: PMNode): string {
  return String((node.attrs as Record<string, unknown> | undefined)?.['data-paper-block'] || '')
}
/** 뒤에 오는 블록과 함께 다녀야 하는가 (제목·표 캡션) */
function keepsWithNext(node: PMNode): boolean {
  return node.type.name === 'heading' || paperBlockKind(node) === 'tabcap'
}
/** 앞의 블록과 함께 다녀야 하는가 (그림 캡션) */
function keepsWithPrev(node: PMNode): boolean {
  return paperBlockKind(node) === 'figcap'
}

/**
 * 경계에 걸친 문단을 남는 자리(room)만큼 채웠을 때 자를 문서 위치.
 * 쪼갤 수 없으면 -1 (표·이미지처럼 텍스트가 아니거나, 한 줄도 안 들어가는 경우).
 */
function findSplitPos(view: EditorView, childPos: number, child: PMNode, room: number, flow: Flow): number {
  if (!child.isTextblock || child.content.size < 2 || room < MIN_SPLIT_ROOM) return -1
  const dom = view.nodeDOM(childPos)
  if (!(dom instanceof HTMLElement)) return -1
  const style = window.getComputedStyle(dom)
  // room 은 문단의 바깥 크기(여백 포함) 기준이므로, 글자가 놓일 높이만 남긴다
  const outer =
    (parseFloat(style.marginTop) || 0) +
    (parseFloat(style.marginBottom) || 0) +
    (parseFloat(style.paddingBottom) || 0) +
    (parseFloat(style.borderBottomWidth) || 0)
  const avail = room - outer - 1 // 흐름 좌표는 이미 CSS 픽셀이라 줌 보정이 필요 없다
  if (avail <= 0) return -1
  const hit = findLineCut(dom, avail, flow)
  if (!hit) return -1
  let at: number
  try { at = view.posAtDOM(hit.node, hit.offset) } catch { return -1 }
  // 문단 맨 앞·맨 뒤에서 자르면 빈 조각이 생긴다
  if (at <= childPos + 1 || at >= childPos + child.nodeSize - 1) return -1
  return at
}

/**
 * 한 쪽의 childIndex 이후 블록 전부를 다음 쪽으로 옮긴다 (마지막 쪽이면 새 쪽을 만든다).
 * 이미 진행 중인 트랜잭션의 문서를 기준으로 계산하므로 쪼개기와 같은 트랜잭션에서 쓸 수 있다.
 */
function pushRestToNextPage(tr: Transaction, pageIndex: number, childIndex: number, pageType: NodeType): boolean {
  const pages = collectPages(tr.doc)
  const cur = pages[pageIndex]
  if (!cur || childIndex < 1 || childIndex >= cur.node.childCount) return false
  const { pos, node } = cur

  let offset = 0
  for (let c = 0; c < childIndex; c++) offset += node.child(c).nodeSize
  const cutFrom = pos + 1 + offset
  const cutTo = pos + 1 + node.content.size
  const moved = node.content.cut(offset)
  const held = takeSelection(tr, cutFrom, cutTo)

  tr.delete(cutFrom, cutTo)
  // 잘라낸 만큼 이 쪽이 짧아졌다 → 쪽이 끝나는 위치를 다시 계산한다
  const pageEnd = pos + node.nodeSize - (cutTo - cutFrom)
  if (pageIndex === pages.length - 1) {
    tr.insert(pageEnd, pageType.create(null, moved))
  } else {
    tr.insert(pageEnd + 1, moved) // 다음 쪽 안쪽(첫 블록 앞)
    // 다음 쪽이 이미 같은 문단의 조각으로 시작했다면 방금 넘긴 조각과 하나로 붙인다
    joinContinuedAt(tr, pageEnd + 1 + moved.size)
  }
  // 넘긴 내용 안에 커서가 있었다면 같이 따라간다 (타자 중 글자가 앞 쪽에 남지 않게)
  restoreSelection(tr, held, pageEnd + 1)
  return true
}

/**
 * 옮길 내용 안에 커서가 있었는지 기억해 두는 도우미.
 * 리플로우는 "지우고 다시 넣기"로 내용을 옮기는데, ProseMirror 는 그것을 이동으로
 * 보지 않으므로 커서가 지운 자리에 남는다. 타자 중이라면 그 뒤 글자가 앞 쪽에 쌓인다.
 */
function takeSelection(tr: Transaction, from: number, to: number) {
  const pos = tr.selection.from
  return { inside: pos >= from && pos <= to, offset: pos - from }
}

/** 옮긴 내용을 따라 커서를 새 자리로 되돌린다 */
function restoreSelection(tr: Transaction, held: { inside: boolean; offset: number }, base: number) {
  if (!held.inside) return
  const at = Math.max(0, Math.min(base + held.offset, tr.doc.content.size))
  tr.setSelection(TextSelection.near(tr.doc.resolve(at)))
}

/**
 * 다음 쪽 앞에서 블록 count 개를 잘라내 돌려준다.
 * 그 쪽의 내용을 전부 가져가면 쪽 노드째 지운다 — 내용만 지우면 ProseMirror 가
 * block+ 를 맞추려고 빈 문단을 채워 넣어 빈 용지가 유령처럼 남는다.
 */
function takeFromPageStart(tr: Transaction, page: { pos: number; node: PMNode }, count: number) {
  let size = 0
  for (let c = 0; c < count; c++) size += page.node.child(c).nodeSize
  const moved = page.node.content.cut(0, size)
  const held = takeSelection(tr, page.pos + 1, page.pos + 1 + size)
  if (count >= page.node.childCount) tr.delete(page.pos, page.pos + page.node.nodeSize)
  else tr.delete(page.pos + 1, page.pos + 1 + size)
  return { moved, held }
}

/** 요소의 첫 줄 높이(화면 px) — 앞 쪽에 한 줄이라도 더 올릴 수 있는지 판단에 쓴다 */
function firstLineHeight(dom: HTMLElement): number {
  const range = document.createRange()
  range.selectNodeContents(dom)
  const lines = groupLines(range.getClientRects())
  if (!lines.length) return 0
  // 두 줄 이상이면 줄 사이 거리(줄 간격)가 실제로 필요한 높이다
  if (lines.length > 1) return Math.max(1, lines[1].top - lines[0].top)
  return lines[0].bottom - lines[0].top
}

/**
 * 옮긴 자리에서 이어짐 조각을 앞 조각에 도로 붙인다.
 * 리플로우가 방금 만든 경계에서만 부른다 — 문서 전체를 훑어 janCont 를 무조건 합치면
 * 사용자가 조각 안에서 엔터로 문단을 나눈 것까지 되돌려 버린다(엔터가 먹히지 않는다).
 */
function joinContinuedAt(tr: Transaction, pos: number) {
  if (pos <= 0 || pos >= tr.doc.content.size) return
  if (!tr.doc.resolve(pos).nodeAfter?.attrs?.janCont) return
  if (canJoin(tr.doc, pos)) tr.join(pos, 1)
}

/**
 * 한 번의 리플로우 패스 — 넘치는 첫 쪽에서 마지막 블록을 다음 쪽으로 밀거나,
 * 여유 있는 쪽으로 다음 쪽 첫 블록을 당겨온다. 변경했으면 true.
 */
function reflowOnce(view: EditorView, contentHeight: number): boolean {
  const { state } = view
  const pages = collectPages(state.doc)
  if (!pages.length) return false
  const pageType = state.schema.nodes[PAGE_NODE_NAME]
  if (!pageType) return false

  // 1) 앞 쪽이 텅 비었는데 뒤에 내용이 있으면 크기를 따지지 않고 당겨온다.
  //    (한 쪽보다 큰 블록이 통째로 밀리면 앞 쪽이 백지로 남는다 — 어떤 경우에도 잘못이다)
  const NEARLY_EMPTY = Math.max(24, contentHeight * 0.12)
  for (let i = 0; i < pages.length - 1; i++) {
    const { pos, node } = pages[i]
    const m = measure(view, pos, contentHeight)
    if (!m || m.used > NEARLY_EMPTY) continue
    /* 손으로 넣은 쪽 나눔으로 끝나는 쪽은 비어 보여도 그대로 둔다 —
       표지처럼 내용이 적은 쪽에서 다음 쪽 내용을 끌어올리면 안 된다 */
    if (node.lastChild?.type.name === 'pageBreak') continue
    const next = pages[i + 1]
    if (!next.node.firstChild) continue
    const tr = state.tr
    const { moved, held } = takeFromPageStart(tr, next, 1)
    const at = tr.mapping.map(pos + node.nodeSize - 1)
    tr.insert(at, moved)
    restoreSelection(tr, held, at) // 커서는 join 단계에서 자동으로 다시 매핑된다
    joinContinuedAt(tr, at)
    tr.setMeta(reflowKey, true)
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
    return true
  }

  /* 1.5) 손으로 넣은 쪽 나눔은 무조건 지킨다 — 워드·한글과 같다.
     크기가 남아 있어도 그 뒤 내용은 다음 쪽에서 시작해야 한다.
     (예전에는 넘침만 보고 나눠서, 표지 다음에 목차가 같은 쪽에 붙어 버렸다) */
  for (let i = 0; i < pages.length; i++) {
    const { node } = pages[i]
    let cutAt = -1
    node.forEach((child, _offset, index) => {
      if (cutAt >= 0) return
      if (child.type.name === 'pageBreak' && index < node.childCount - 1) cutAt = index
    })
    if (cutAt < 0) continue
    const tr = state.tr
    if (!pushRestToNextPage(tr, i, cutAt + 1, pageType)) continue
    tr.setMeta(reflowKey, true)
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
    return true
  }

  // 2) 넘침 → 용지를 넘어가는 블록 전체를 한 번에 다음 쪽으로 (한 블록씩 옮기면 너무 느리다)
  for (let i = 0; i < pages.length; i++) {
    const { pos, node } = pages[i]
    const m = measure(view, pos, contentHeight)
    if (!m || m.ends.length !== node.childCount) continue
    if (!m.anyOverflow) continue

    // 아래 여백을 처음 침범하는 블록을 찾는다
    // (첫 블록이라도 경계에 걸리면 줄 단위 분할 대상이므로 c===0 도 포함한다)
    const cutIndex0 = m.overflows.findIndex(Boolean)
    if (cutIndex0 < 0) continue
    /* 쪽 끝의 쪽 나눔 표시 하나가 삐져나온 것뿐이면 그냥 둔다 —
       이것만 다음 쪽으로 넘기면 나눔 하나만 있는 백지가 생기고,
       그 나눔이 앞 쪽과 떨어져 다음 절이 앞으로 딸려 올라온다 */
    if (cutIndex0 === node.childCount - 1 && node.lastChild?.type.name === 'pageBreak') continue
    let cutIndex = cutIndex0
    // 그 블록의 머리부터 지면 바닥까지 남은 자리 — 여기까지만 채우고 나머지를 넘긴다
    const roomForCut = m.rooms[cutIndex]

    // ── 줄 단위 분할 — 경계에 걸친 문단을 남는 자리만큼 채우고 그 줄에서 쪼갠 뒤,
    //    같은 트랜잭션에서 뒷조각부터 다음 쪽으로 넘긴다.
    //    (워드·한글과 같은 흐름. 문단을 통째로 넘기면 쪽 바닥이 비어 버린다)
    //    쪼개기만 하고 다음 패스에 맡기면 안 된다 — 그때는 앞조각이 이미 쪽을 꽉 채워
    //    남는 자리가 24px 미만이라 뒷조각이 같은 쪽에 남고 용지만 늘어난다.
    {
      let childOffset = 0
      for (let c = 0; c < cutIndex; c++) childOffset += node.child(c).nodeSize
      const child = node.child(cutIndex) // 경계에 걸친 블록
      // 텍스트 문단·제목만 쪼갠다 (표·이미지·콜아웃은 블록 단위로 옮긴다)
      const splitAt = findSplitPos(view, pos + 1 + childOffset, child, roomForCut, m.flowAt(cutIndex))
      if (splitAt > 0) {
        const tr = state.tr
        // 쪼갠 뒷조각에 "이어짐" 표시를 처음부터 붙인다 (저장 시 원래 한 문단으로 합침)
        tr.split(splitAt, 1, [{ type: child.type, attrs: { ...child.attrs, janCont: '1' } }])
        if (pushRestToNextPage(tr, i, cutIndex + 1, pageType)) {
          tr.setMeta(reflowKey, true)
          tr.setMeta('addToHistory', false)
          view.dispatch(tr)
          return true
        }
        // 넘길 수 없으면 쪼갠 것도 없던 일로 하고(dispatch 하지 않는다) 블록 단위 밀기로
      }
    }

    /* ── 표는 행 단위로 나눠 넘긴다 (워드·한글과 같다) ──
       예전에는 표가 통째로 밀리거나, 밀 수 없으면 종이가 늘어났다.
       경계에 걸린 것이 표라면 들어가는 행까지만 남기고 나머지를 다음 쪽으로 흘린다. */
    {
      let childOffset = 0
      for (let c = 0; c < cutIndex; c++) childOffset += node.child(c).nodeSize
      const child = node.child(cutIndex)
      if (child.type.name === 'table' && child.childCount > 2) {
        const room = m.rooms[cutIndex]
        const fit = rowsThatFit(view, pos + 1 + childOffset, room, m.scale)
        // 제목 행만 남기고 나누면 보기 흉하다 — 두 줄 이상 남을 때만 나눈다
        if (fit >= 2 && fit < child.childCount) {
          const tr = state.tr
          if (splitTableAcrossPages(tr, pos + 1 + childOffset, child, fit)
            && pushRestToNextPage(tr, i, cutIndex + 1, pageType)) {
            tr.setMeta(reflowKey, true)
            tr.setMeta('addToHistory', false)
            view.dispatch(tr)
            return true
          }
        }
      }
    }

    // 줄 단위로 쪼갤 수 없는 블록(이미지 등)만 남았다면 블록 단위로 옮긴다.
    // 블록이 하나뿐이면 옮길 곳이 없으므로 넘침을 허용한다 (무한 루프 방지)
    if (node.childCount <= 1) continue
    // 첫 블록부터 넘치지만 쪼갤 수 없다면 그 블록만 이 쪽에 두고 나머지를 넘긴다
    if (cutIndex < 1) cutIndex = 1
    // 잘라낼 지점 앞이 거의 비어 있다면(큰 표·이미지가 남은 자리를 다 먹는 경우)
    // 그 블록까지 이 쪽에 두고 그 다음부터 넘긴다. 앞 쪽을 백지로 만들고 뒤로
    // 넘기는 것이 가장 나쁘고, 밀기를 아예 포기하면 문서 전체가 한 쪽에 쌓인다.
    if (Math.max(0, m.starts[cutIndex0]) <= NEARLY_EMPTY) {
      if (cutIndex + 1 >= node.childCount) continue // 뒤에 밀 것이 없다 → 넘침 허용
      cutIndex += 1
    }

    // 제목·표 캡션은 뒤따르는 내용과 붙어 다닌다 — 쪽 바닥에 홀로 남으면 함께 넘긴다.
    // 단 그것이 쪽의 첫 블록이면 넘길 수 없다(쪽이 백지가 된다).
    for (let guard = 0; guard < 4 && cutIndex >= 2 && keepsWithNext(node.child(cutIndex - 1)); guard++) cutIndex -= 1
    // 넘길 첫 블록이 그림 캡션이면 위의 그림도 함께 넘긴다 (캡션만 다음 쪽으로 가지 않게)
    if (cutIndex >= 2 && keepsWithPrev(node.child(cutIndex))) cutIndex -= 1

    // cutIndex 이후 전부를 잘라 옮긴다
    let offset = 0
    for (let c = 0; c < cutIndex; c++) offset += node.child(c).nodeSize
    const cutFrom = pos + 1 + offset
    const cutTo = pos + 1 + node.content.size
    const moved = node.content.cut(offset)
    const tr = state.tr
    tr.delete(cutFrom, cutTo)
    const isLastPage = i === pages.length - 1
    if (isLastPage) {
      tr.insert(tr.mapping.map(pos + node.nodeSize), pageType.create(null, moved))
    } else {
      tr.insert(tr.mapping.map(pos + node.nodeSize) + 1, moved)
    }
    tr.setMeta(reflowKey, true)
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
    return true
  }

  // 3) 여유 → 다음 쪽 앞부분을 줄 단위로 끌어올린다.
  //    줄 간격을 줄이거나 글을 지워 앞 쪽에 자리가 생기면, 다음 쪽 첫 문단에서 들어가는
  //    줄까지만 잘라 올려 앞 쪽을 다시 채운다 (워드·한글과 같은 흐름).
  //    아래 4단계의 당기기는 블록 단위라, 문단 하나가 남는 자리보다 크면 아무것도 못 올린다.
  for (let i = 0; i < pages.length - 1; i++) {
    const { pos, node } = pages[i]
    const next = pages[i + 1]
    const first = next.node.firstChild
    if (!first || !first.isTextblock || first.content.size < 2) continue
    // 단을 가로지르는 블록(넓은 표 캡션·제목)은 줄로 쪼개 올리면 자리 계산이 어긋난다
    const nextFirstMeasure = measure(view, next.pos, contentHeight)
    if (nextFirstMeasure?.spanning[0]) continue
    const m = measure(view, pos, contentHeight)
    if (!m) continue
    const room = m.room
    if (room < MIN_SPLIT_ROOM) continue
    const fragPos = next.pos + 1
    const fragDom = view.nodeDOM(fragPos)
    if (!(fragDom instanceof HTMLElement)) continue
    const nextMeasure = measure(view, next.pos, contentHeight)
    const nextFlow = nextMeasure ? nextMeasure.flowAt(0) : m.flowAt(0)
    const line = firstLineHeight(fragDom) / (nextFlow.scale || 1)
    // 한 줄도 못 올릴 여유면 그대로 둔다 (올렸다 도로 내리는 왕복 방지)
    if (!line || room < line + 1) continue
    // 남는 자리에 들어가는 마지막 줄에서 자른다. -1 이면 전부 들어간다는 뜻이라
    // 아래 4단계(블록 통째로 당기기)에 맡긴다.
    const splitAt = findSplitPos(view, fragPos, first, room, nextFlow)
    if (splitAt <= 0) continue

    const tr = state.tr
    // 뒤에 남는 조각에 "이어짐" 표시 — 저장할 때 원래 한 문단으로 합쳐진다
    tr.split(splitAt, 1, [{ type: first.type, attrs: { ...first.attrs, janCont: '1' } }])
    const fresh = collectPages(tr.doc)[i + 1]
    if (!fresh) continue
    const { moved, held } = takeFromPageStart(tr, fresh, 1)
    const at = pos + node.nodeSize - 1 // 앞 쪽 마지막 블록 뒤 (앞 쪽 좌표는 쪼개기의 영향을 받지 않는다)
    tr.insert(at, moved)
    restoreSelection(tr, held, at)
    joinContinuedAt(tr, at) // 올라온 조각이 앞 문단의 뒷부분이면 도로 한 문단으로
    tr.setMeta(reflowKey, true)
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
    return true
  }

  // 4) 여유 → 다음 쪽에서 들어갈 만큼 당겨오기 (내용을 지웠을 때 빈 쪽·구멍이 남지 않게)
  for (let i = 0; i < pages.length - 1; i++) {
    const { pos, node } = pages[i]
    /* 손으로 넣은 쪽 나눔으로 끝나는 쪽은 자리가 남아도 당겨오지 않는다 —
       당겨오면 1.5) 가 다시 밀어내어 끝없이 오르내린다 (표지·목차 다음 쪽이 그랬다) */
    if (node.lastChild?.type.name === 'pageBreak') continue
    const m = measure(view, pos, contentHeight)
    const next = pages[i + 1]
    const nm = measure(view, next.pos, contentHeight)
    if (!m || !nm || nm.ends.length !== next.node.childCount) continue
    let room = m.room
    if (room <= 2) continue

    /* 다음 쪽 앞에서 몇 블록이 들어가는지 센다.
       단을 가로지르는 블록은 남은 단 자리에 끼어들지 못하고 단 전체 아래에 놓인다 —
       앞 내용이 단으로 고르게 나뉜 높이에 제 높이를 더해도 지면 안이어야 들어온다.
       (이 조건을 빼면 표를 올렸다가 넘쳐서 도로 내리기를 끝없이 되풀이한다) */
    let take = 0
    let flowAfter = m.used
    for (let c = 0; c < next.node.childCount; c++) {
      const h = nm.ends[c] - nm.starts[c]
      if (nm.spanning[c]) {
        /* 단을 채우는 방식(column-fill:auto)에서는 앞 내용이 첫 단을 다 채우면
           단 구간의 높이가 지면 끝까지 늘어난다 — 그 아래에 놓이는 가로지르는 블록은
           들어갈 자리가 없다. 그래서 "앞 내용이 차지한 높이(한 단 기준) + 이 블록"이
           지면 안이어야만 올린다. */
        const bandUsed = Math.min(flowAfter, contentHeight)
        if (bandUsed + h > contentHeight - 1) break
      } else {
        if (h > room) break
        room -= h
      }
      flowAfter += h
      take++
    }
    // 제목·표 캡션만 끌어올리면 쪽 바닥에 홀로 남는다 — 뒤따르는 내용이 함께 오지 못하면 두고 온다
    // (다음 쪽을 통째로 가져오는 경우는 마지막이어도 홀로 남지 않으므로 그대로 둔다)
    for (let guard = 0; guard < 4 && take > 0 && take < next.node.childCount && keepsWithNext(next.node.child(take - 1)); guard++) take -= 1
    // 그림만 올리고 캡션을 두고 오는 것도 같은 잘못이다 — 그림도 두고 온다
    if (take > 0 && take < next.node.childCount && keepsWithPrev(next.node.child(take))) take -= 1
    // 다음 쪽을 완전히 비우게 되면 그 쪽 자체가 사라진다 (takeFromPageStart 가 처리)
    if (take === 0) continue

    const tr = state.tr
    const { moved, held } = takeFromPageStart(tr, next, take)
    const at = tr.mapping.map(pos + node.nodeSize - 1)
    tr.insert(at, moved)
    restoreSelection(tr, held, at)
    joinContinuedAt(tr, at)
    tr.setMeta(reflowKey, true)
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
    return true
  }

  return false
}

/**
 * 리플로우가 끝난 뒤, 더 줄일 수 없어 여전히 넘치는 쪽만 "늘어나도 되는 쪽"으로 표시한다.
 * 용지는 기본적으로 규격 높이에 고정(넘치면 잘림)이라, 표·이미지처럼 쪼갤 수 없는
 * 블록이 한 쪽보다 큰 경우에만 이 표시로 예외를 준다 — 안 그러면 내용이 사라진다.
 * 리플로우가 아직 진행 중일 때는 부르지 않는다(타이핑 중 잠깐 넘친 것까지 늘리면
 * 예전처럼 용지가 늘었다 줄었다 한다).
 */
function markGrowPages(view: EditorView, contentHeight: number) {
  const marks: number[] = []
  collectPages(view.state.doc).forEach(({ pos }) => {
    const m = measure(view, pos, contentHeight)
    if (m && m.anyOverflow) marks.push(pos)
  })
  const cur = (growKey.getState(view.state) || []) as number[]
  if (cur.length === marks.length && cur.every((p, i) => p === marks[i])) return
  const tr = view.state.tr.setMeta(growKey, marks)
  tr.setMeta(reflowKey, true)
  tr.setMeta('addToHistory', false)
  view.dispatch(tr)
}

/**
 * 아직 오지 않은 그림이 있나 — 있으면 이번 판은 재지 않는다.
 * 크기를 모르는 그림은 높이가 0 이라, 그 상태로 쪽을 짜면 뒤따르는 글이 아래 여백을 뚫는다.
 * (주소가 없는 자리표는 영영 오지 않으므로 기다리지 않는다)
 */
function hasPendingImages(view: EditorView): boolean {
  const imgs = view.dom.querySelectorAll('img')
  for (let i = 0; i < imgs.length; i += 1) {
    const img = imgs[i] as HTMLImageElement
    if (!img.getAttribute('src')) continue
    if (!img.complete || img.naturalHeight === 0) return true
  }
  return false
}

/** 리플로우 엔진 — DOM 갱신 후 측정해 한 프레임에 한 번씩 정리한다 */
export const PageReflow = Extension.create<ReflowOptions>({
  name: 'janPageReflow',

  addOptions() {
    return {
      getContentHeight: () => 0,
      maxPasses: 40,
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      /* 늘어나도 되는 쪽 표시 — DOM 속성을 직접 건드리면 ProseMirror 가 문서 상태와
         다르다고 보고 되돌리므로, 데코레이션으로 얹는다 (CSS: [data-jan-grow]) */
      new Plugin({
        key: growKey,
        state: {
          init: () => [] as number[],
          apply(tr, old: number[]) {
            const next = tr.getMeta(growKey) as number[] | undefined
            if (next) return next
            if (!tr.docChanged) return old
            return old.map((pos) => tr.mapping.map(pos)).filter((pos, i, a) => a.indexOf(pos) === i)
          },
        },
        props: {
          decorations(state) {
            const marks = growKey.getState(state) || []
            if (!marks.length) return null
            const decos: Decoration[] = []
            marks.forEach((pos) => {
              const node = state.doc.nodeAt(pos)
              if (node && node.type.name === PAGE_NODE_NAME)
                decos.push(Decoration.node(pos, pos + node.nodeSize, { 'data-jan-grow': '1' }))
            })
            return decos.length ? DecorationSet.create(state.doc, decos) : null
          },
        },
      }),
      new Plugin({
        key: new PluginKey('janPageReflowRunner'),
        /**
         * 사용자가 이어짐 조각 안에서 엔터를 치면 새로 생긴 문단까지 이어짐 표시를
         * 물려받는다(ProseMirror 의 split 은 속성을 그대로 복사한다). 그대로 두면
         * 저장할 때 앞 문단에 합쳐져 사용자가 나눈 문단이 사라진다.
         * 리플로우가 만든 조각은 언제나 쪽의 첫 블록이므로, 그렇지 않은 이어짐 표시는 지운다.
         */
        appendTransaction(trs, _oldState, newState) {
          if (!trs.some((tr) => tr.docChanged)) return null
          if (trs.some((tr) => tr.getMeta(reflowKey))) return null
          let tr: Transaction | null = null
          newState.doc.forEach((page, pageOffset) => {
            if (page.type.name !== PAGE_NODE_NAME) return
            page.forEach((block, blockOffset, index) => {
              if (index === 0 || !block.attrs?.janCont) return
              tr = tr ?? newState.tr
              tr.setNodeMarkup(pageOffset + 1 + blockOffset, undefined, { ...block.attrs, janCont: null })
            })
          })
          return tr
        },
        view(editorView) {
          let raf = 0
          let passes = 0
          /* 지금 리플로우 한 판이 도는 중인가 —
             리플로우는 문서를 고치므로 그 자리에서 update() 가 불려 다시 예약을 시도한다.
             그때 막지 않으면 한 판이 두 판을 낳아 프레임마다 2배로 불어나고(2→4→8…)
             몇 초 만에 화면이 멈춘다. 게다가 예약이 passes 를 0 으로 되돌려
             최대 횟수 제한도 무력해진다. */
          let running = false
          /* 한 판(=최대 maxPasses 번) 을 다 쓰고도 진행 중이면 화면에 한 프레임 양보하고 이어서 한다.
             큰 문서를 통째로 붙여넣으면 블록 수만큼 옮겨야 해서 40번으로는 못 끝내는데,
             거기서 손을 놓으면 마지막 표가 아래 여백을 뚫은 채로 남는다.
             맴돌기(수렴 실패)는 changed 가 false 가 되어 스스로 멈추므로, 이어달리기 횟수만 묶어 둔다. */
          let relays = 0
          const MAX_RELAYS = 40

          const run = (view: EditorView) => {
            raf = 0
            running = true
            try {
              const contentHeight = options.getContentHeight()
              if (!contentHeight || contentHeight < 40) return
              /* 아직 오지 않은 그림이 있으면 재지 않는다 — 0 으로 재고 짜면 뒤 글이 여백을 뚫는다.
                 다 오면 위의 load 듣기가 다시 부른다. */
              if (hasPendingImages(view)) return
              if (passes >= (options.maxPasses ?? 40)) {
                passes = 0
                if (relays < MAX_RELAYS) {
                  relays++
                  raf = window.requestAnimationFrame(() => run(view))
                }
                return
              }
              passes++
              const changed = reflowOnce(view, contentHeight)
              if (changed) {
                raf = window.requestAnimationFrame(() => run(view))
              } else {
                passes = 0
                relays = 0
                markGrowPages(view, contentHeight)
              }
            } finally {
              running = false
            }
          }

          /* 다음 프레임에 바로 정리한다. 예전처럼 60ms 모아서 처리하면 타이핑이
             이어지는 동안 넘친 줄이 계속 쌓여, 용지가 늘어나거나(예전) 잘려 보인다. */
          const schedule = (view: EditorView) => {
            if (raf || running) return // 이미 잡혀 있거나, 그 판 안에서 온 요청이다
            passes = 0
            relays = 0
            raf = window.requestAnimationFrame(() => run(view))
          }

          /**
           * 그림은 나중에 온다 — 그때 다시 나눈다.
           *
           * 지금까지 쪽 나눔은 「문서가 바뀔 때」 만 돌았다. 그런데 그림은 문서가 바뀌지 않은 채로
           * 나중에 불러와지며 높이가 0 에서 제 크기로 커진다. 그 순간 이미 나눠 둔 쪽은
           * 그림을 0 으로 재고 짜였으므로, 뒤따르는 글이 아래 여백을 뚫는다.
           * 크기를 바꿀 때도 같다 — 새 크기로 다시 그려지는 동안 잠깐 재면 엉뚱한 값이 나온다.
           *
           * load 는 거품이 일지 않으므로 잡는 단계(capture)에서 듣는다.
           */
          const onImageSettled = (e: Event) => {
            const t = e.target as HTMLElement | null
            if (t && (t.tagName === 'IMG' || t.tagName === 'VIDEO')) schedule(editorView)
          }
          editorView.dom.addEventListener('load', onImageSettled, true)
          editorView.dom.addEventListener('error', onImageSettled, true)   // 못 불러온 그림도 자리는 정해진다

          // 문서를 처음 열었을 때도 용지 규격대로 나눠야 한다 (로드 직후 1회)
          schedule(editorView)

          return {
            update(view, prevState) {
              if (view.state.doc.eq(prevState.doc)) return
              schedule(view)
            },
            destroy() {
              window.cancelAnimationFrame(raf)
              editorView.dom.removeEventListener('load', onImageSettled, true)
              editorView.dom.removeEventListener('error', onImageSettled, true)
            },
          }
        },
      }),
    ]
  },
})

/* ────────────────────────────────────────────────────────────
 * 저장 호환 — 저장은 기존과 같은 평면 HTML, 로드는 자동 분할
 * ──────────────────────────────────────────────────────────── */

/**
 * 저장·내보내기에 쓸 HTML — 용지 래퍼를 벗겨 기존 형식과 동일하게 맞춘다.
 * 저장·내보내기 경로는 반드시 이 함수를 통과해야 한다 (getHTML 직접 호출 금지).
 */
export function getSavableHtml(editor: { getHTML: () => string } | null | undefined): string {
  if (!editor) return ''
  // 쪽 래퍼를 벗기고 → 쪼개진 문단을 합치고 → 나뉜 표를 도로 한 표로
  return mergeContinuedTables(mergeContinuedBlocks(stripPageWrappers(editor.getHTML())))
}

/**
 * 페이지 경계에서 줄 단위로 쪼개진 문단(data-jan-cont)을 앞 문단에 다시 합친다.
 * 저장·내보내기에서 원래 문단 구조를 그대로 유지하기 위한 역변환.
 */
export function mergeContinuedBlocks(html: string): string {
  if (!html || !html.includes('data-jan-cont')) return html
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
  const root = doc.getElementById('r')
  if (!root) return html
  let guard = 0
  let target = root.querySelector('[data-jan-cont]')
  while (target && guard++ < 5000) {
    const prev = target.previousElementSibling
    if (prev) {
      while (target.firstChild) prev.appendChild(target.firstChild)
      target.remove()
    } else {
      // 앞 형제가 없으면 표시만 지운다 (쪽 첫 블록으로 남은 경우)
      target.removeAttribute('data-jan-cont')
    }
    target = root.querySelector('[data-jan-cont]')
  }
  return root.innerHTML
}

/** 페이지 래퍼를 벗겨 기존 저장 형식(평면 HTML)으로 되돌린다 */
export function stripPageWrappers(html: string): string {
  if (!html || !html.includes('data-jan-page')) return html
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
  const root = doc.getElementById('r')
  if (!root) return html
  root.querySelectorAll('div[data-jan-page]').forEach((page) => {
    const parent = page.parentNode
    if (!parent) return
    while (page.firstChild) parent.insertBefore(page.firstChild, page)
    parent.removeChild(page)
  })
  return root.innerHTML
}

/** 평면 HTML 을 한 쪽에 담아 반환 — 이후 리플로우가 용지 규격대로 나눈다 */
export function wrapInSinglePage(html: string): string {
  if (!html) return '<div data-jan-page="true"><p></p></div>'
  if (html.includes('data-jan-page')) return html
  return `<div data-jan-page="true">${html}</div>`
}

import { Node, Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

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

/**
 * 요소 안에서 주어진 높이까지 들어가는 마지막 줄의 끝 문자 위치를 찾는다.
 * 문자 하나씩 재면 긴 문단에서 너무 느리므로 이진 탐색으로 좁힌 뒤,
 * 그 문자가 속한 줄의 시작으로 되돌려 "줄 단위"로 자를 지점을 반환한다.
 */
function findLineCut(el: HTMLElement, maxHeight: number): { node: Text; offset: number } | null {
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

  const elTop = el.getBoundingClientRect().top
  const range = document.createRange()
  const locate = (i: number) => {
    for (let k = texts.length - 1; k >= 0; k--) {
      if (i >= texts[k].start) {
        const off = Math.max(0, Math.min(i - texts[k].start, texts[k].node.length - 1))
        return { node: texts[k].node, off }
      }
    }
    return { node: texts[0].node, off: 0 }
  }
  const rectAt = (i: number) => {
    const { node, off } = locate(i)
    range.setStart(node, off)
    range.setEnd(node, off + 1)
    return range.getBoundingClientRect()
  }

  // 1) maxHeight 안에 들어가는 마지막 문자 찾기
  let lo = 0
  let hi = total - 1
  let fit = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (rectAt(mid).bottom - elTop <= maxHeight) { fit = mid; lo = mid + 1 } else { hi = mid - 1 }
  }
  if (fit < 0) return null            // 첫 줄도 안 들어간다 → 쪼갤 수 없다
  if (fit >= total - 1) return null   // 전부 들어간다 → 쪼갤 필요 없다

  // 2) 다음 문자가 속한 줄의 시작으로 되돌린다 (줄 중간에서 자르지 않기 위해)
  const nextTop = Math.round(rectAt(fit + 1).top)
  let cut = fit + 1
  for (let i = fit; i >= 0 && cut - i < 400; i--) {
    if (Math.round(rectAt(i).top) !== nextTop) break
    cut = i
  }
  if (cut <= 0) return null           // 첫 줄부터 넘어간다 → 통째로 옮기는 편이 낫다

  const { node, off } = locate(cut)
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

/**
 * 페이지 DOM 측정 — 콘텐츠 총 높이와 자식별 높이(줌 보정)
 * 자식별 높이를 알아야 "넘치는 만큼"을 한 번에 옮길 수 있다.
 */
function measure(view: EditorView, pagePos: number): { el: HTMLElement; used: number; heights: number[] } | null {
  const dom = view.nodeDOM(pagePos)
  if (!(dom instanceof HTMLElement)) return null
  const rect = dom.getBoundingClientRect()
  const scale = dom.offsetWidth > 0 ? rect.width / dom.offsetWidth : 1
  const heights: number[] = []
  let used = 0
  for (const child of Array.from(dom.children)) {
    const el = child as HTMLElement
    // 데코레이션 위젯 등 문서 노드가 아닌 요소는 건너뛴다
    if (el.classList.contains('ProseMirror-widget')) continue
    const style = window.getComputedStyle(el)
    const marginY = (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)
    const h = el.getBoundingClientRect().height / (scale || 1) + marginY
    heights.push(h)
    used += h
  }
  return { el: dom, used, heights }
}

/** 페이지 노드들의 위치와 노드를 순서대로 수집 */
function collectPages(doc: PMNode): Array<{ pos: number; node: PMNode }> {
  const pages: Array<{ pos: number; node: PMNode }> = []
  doc.forEach((node, offset) => {
    if (node.type.name === PAGE_NODE_NAME) pages.push({ pos: offset, node })
  })
  return pages
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

  // 0) 앞 쪽이 텅 비었는데 뒤에 내용이 있으면 크기를 따지지 않고 당겨온다.
  //    (한 쪽보다 큰 블록이 통째로 밀리면 앞 쪽이 백지로 남는다 — 어떤 경우에도 잘못이다)
  const NEARLY_EMPTY = Math.max(24, contentHeight * 0.12)
  for (let i = 0; i < pages.length - 1; i++) {
    const { pos, node } = pages[i]
    const m = measure(view, pos)
    if (!m || m.used > NEARLY_EMPTY) continue
    const next = pages[i + 1]
    const first = next.node.firstChild
    if (!first) continue
    const tr = state.tr
    const takeFrom = next.pos + 1
    tr.delete(takeFrom, takeFrom + first.nodeSize)
    tr.insert(tr.mapping.map(pos + node.nodeSize - 1), first)
    collectPages(tr.doc)
      .filter((p) => p.node.childCount === 0)
      .reverse()
      .forEach((p) => tr.delete(p.pos, p.pos + p.node.nodeSize))
    tr.setMeta(reflowKey, true)
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
    return true
  }

  // 1) 넘침 → 용지를 넘어가는 블록 전체를 한 번에 다음 쪽으로 (한 블록씩 옮기면 너무 느리다)
  for (let i = 0; i < pages.length; i++) {
    const { pos, node } = pages[i]
    const m = measure(view, pos)
    if (!m || m.heights.length !== node.childCount) continue
    if (m.used <= contentHeight + 1) continue

    // 용지 안쪽 높이를 처음 넘기는 블록을 찾는다
    // (첫 블록이라도 경계에 걸리면 줄 단위 분할 대상이므로 c===0 도 포함한다)
    let acc = 0
    let cutIndex = -1
    for (let c = 0; c < node.childCount; c++) {
      const h = m.heights[c]
      if (acc + h > contentHeight) { cutIndex = c; break }
      acc += h
    }
    if (cutIndex < 0) continue

    // ── 줄 단위 분할 — 경계에 걸친 문단을 남는 자리만큼 채우고 그 줄에서 쪼갠다
    //    (워드·한글과 같은 흐름. 문단을 통째로 넘기면 쪽 바닥이 비어 버린다)
    {
      const boundary = cutIndex // 경계에 걸친 블록
      const child = node.child(boundary)
      const room = contentHeight - acc
      // 텍스트 문단·제목만 쪼갠다 (표·이미지·콜아웃은 블록 단위로 옮긴다)
      if (child.isTextblock && child.content.size > 1 && room > 24) {
        const childPos = (() => {
          let off = 0
          for (let c = 0; c < boundary; c++) off += node.child(c).nodeSize
          return pos + 1 + off
        })()
        const dom = view.nodeDOM(childPos)
        if (dom instanceof HTMLElement) {
          const rect = dom.getBoundingClientRect()
          const scale = dom.offsetWidth > 0 ? rect.width / dom.offsetWidth : 1
          // 문자 아래끝 기준이라 실제 렌더 높이가 몇 px 더 크다 → 여유를 둔다
          const hit = findLineCut(dom, room * (scale || 1) - 8)
          if (hit) {
            let splitAt = -1
            try { splitAt = view.posAtDOM(hit.node, hit.offset) } catch { splitAt = -1 }
            const inside = splitAt > childPos && splitAt < childPos + child.nodeSize - 1
            if (inside) {
              const tr = state.tr
              // 쪼갠 뒷조각에 "이어짐" 표시를 처음부터 붙인다 (저장 시 원래 한 문단으로 합침)
              tr.split(splitAt, 1, [{ type: child.type, attrs: { ...child.attrs, janCont: '1' } }])
              tr.setMeta(reflowKey, true)
              tr.setMeta('addToHistory', false)
              view.dispatch(tr)
              return true // 다음 패스에서 뒷조각부터 다음 쪽으로 밀려간다
            }
          }
        }
      }
    }

    // 줄 단위로 쪼갤 수 없는 블록(표·이미지)만 남았다면 블록 단위로 옮긴다.
    // 블록이 하나뿐이면 옮길 곳이 없으므로 넘침을 허용한다 (무한 루프 방지)
    if (node.childCount <= 1) continue
    // 첫 블록부터 넘치지만 쪼갤 수 없다면 그 블록만 이 쪽에 두고 나머지를 넘긴다
    if (cutIndex < 1) cutIndex = 1
    // 잘라낼 지점 앞이 거의 비어 있다면(큰 표·이미지가 남은 자리를 다 먹는 경우)
    // 그 블록까지 이 쪽에 두고 그 다음부터 넘긴다. 앞 쪽을 백지로 만들고 뒤로
    // 넘기는 것이 가장 나쁘고, 밀기를 아예 포기하면 문서 전체가 한 쪽에 쌓인다.
    if (acc <= NEARLY_EMPTY) {
      if (cutIndex + 1 >= node.childCount) continue // 뒤에 밀 것이 없다 → 넘침 허용
      cutIndex += 1
    }

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

  // 2) 여유 → 다음 쪽에서 들어갈 만큼 당겨오기 (내용을 지웠을 때 빈 쪽·구멍이 남지 않게)
  for (let i = 0; i < pages.length - 1; i++) {
    const { pos, node } = pages[i]
    const m = measure(view, pos)
    const next = pages[i + 1]
    const nm = measure(view, next.pos)
    if (!m || !nm || nm.heights.length !== next.node.childCount) continue
    let room = contentHeight - m.used
    if (room <= 2) continue

    // 다음 쪽 앞에서 몇 블록이 들어가는지 센다
    let take = 0
    for (let c = 0; c < next.node.childCount; c++) {
      if (nm.heights[c] > room) break
      room -= nm.heights[c]
      take++
    }
    // 다음 쪽을 완전히 비우게 되면 그 쪽 자체를 없애야 하므로 허용, 아니면 최소 1개 남김
    if (take === 0) continue

    let size = 0
    for (let c = 0; c < take; c++) size += next.node.child(c).nodeSize
    const moved = next.node.content.cut(0, size)
    const tr = state.tr
    const takeFrom = next.pos + 1
    tr.delete(takeFrom, takeFrom + size)
    tr.insert(tr.mapping.map(pos + node.nodeSize - 1), moved)
    // 텅 빈 쪽은 제거
    collectPages(tr.doc)
      .filter((p) => p.node.childCount === 0)
      .reverse()
      .forEach((p) => tr.delete(p.pos, p.pos + p.node.nodeSize))
    tr.setMeta(reflowKey, true)
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
    return true
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
      new Plugin({
        key: new PluginKey('janPageReflowRunner'),
        view(editorView) {
          let raf = 0
          let passes = 0
          let idleTimer = 0

          const run = (view: EditorView) => {
            raf = 0
            const contentHeight = options.getContentHeight()
            if (!contentHeight || contentHeight < 40) return
            if (passes >= (options.maxPasses ?? 40)) return
            passes++
            const changed = reflowOnce(view, contentHeight)
            if (changed) {
              raf = window.requestAnimationFrame(() => run(view))
            } else {
              passes = 0
            }
          }

          const schedule = (view: EditorView) => {
            if (raf) return
            window.clearTimeout(idleTimer)
            // 타이핑 중에는 조금 모아서 처리 (측정·리플로우 비용 절감)
            idleTimer = window.setTimeout(() => {
              passes = 0
              raf = window.requestAnimationFrame(() => run(view))
            }, 60)
          }

          // 문서를 처음 열었을 때도 용지 규격대로 나눠야 한다 (로드 직후 1회)
          schedule(editorView)

          return {
            update(view, prevState) {
              if (view.state.doc.eq(prevState.doc)) return
              schedule(view)
            },
            destroy() {
              window.cancelAnimationFrame(raf)
              window.clearTimeout(idleTimer)
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
  return mergeContinuedBlocks(stripPageWrappers(editor.getHTML()))
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

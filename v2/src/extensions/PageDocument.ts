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

  // 1) 넘침 → 용지를 넘어가는 블록 전체를 한 번에 다음 쪽으로 (한 블록씩 옮기면 너무 느리다)
  for (let i = 0; i < pages.length; i++) {
    const { pos, node } = pages[i]
    const m = measure(view, pos)
    if (!m || m.heights.length !== node.childCount) continue
    if (m.used <= contentHeight + 1) continue
    // 블록이 하나뿐이면 더 밀 수 없다 (한 쪽보다 큰 표·이미지) — 넘침을 허용해 무한 루프를 막는다
    if (node.childCount <= 1) continue

    // 용지 안쪽 높이를 처음 넘기는 블록을 찾는다 (최소 한 블록은 남긴다)
    let acc = 0
    let cutIndex = -1
    for (let c = 0; c < node.childCount; c++) {
      const h = m.heights[c]
      if (c > 0 && acc + h > contentHeight) { cutIndex = c; break }
      acc += h
    }
    if (cutIndex < 1) continue

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
  return stripPageWrappers(editor.getHTML())
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

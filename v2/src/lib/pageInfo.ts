/**
 * 페이지 수·현재 쪽 조회 — 두 페이지 모델을 모두 지원하는 단일 창구.
 *
 * - 'nodes'  : 용지마다 실제 page 노드 (.jan-page-node)
 * - 'legacy' : 데코레이션 눈금 (.rm-page-break .breaker)
 *
 * 상태바·쪽모음·쪽 나란히 편집이 각자 DOM 을 뒤지면 모델이 바뀔 때마다 전부
 * 깨지므로 여기로 모은다.
 */

export interface PageGeometry {
  /** 전체 쪽 수 */
  total: number
  /** 각 쪽의 편집기 기준 top 좌표 (px, 줌 보정됨) */
  tops: number[]
  /** 페이지 반복 주기 (px) — 쪽 사이 간격 포함 */
  rhythm: number
}

function scaleOf(root: HTMLElement): number {
  const rect = root.getBoundingClientRect()
  return root.offsetWidth > 0 ? rect.width / root.offsetWidth : 1
}

/** 편집기 DOM 에서 페이지 배치를 읽는다 */
export function readPageGeometry(root: HTMLElement | null | undefined, fallbackRhythm = 0): PageGeometry {
  if (!root) return { total: 1, tops: [0], rhythm: fallbackRhythm }
  const rootTop = root.getBoundingClientRect().top
  const scale = scaleOf(root) || 1

  const pageNodes = [...root.querySelectorAll<HTMLElement>('.jan-page-node')]
  if (pageNodes.length) {
    const tops = pageNodes.map((el) => (el.getBoundingClientRect().top - rootTop) / scale)
    const rhythm = tops.length >= 2 ? tops[1] - tops[0] : pageNodes[0].getBoundingClientRect().height / scale
    return { total: pageNodes.length, tops, rhythm: rhythm || fallbackRhythm }
  }

  const breakers = [...root.querySelectorAll<HTMLElement>('.rm-page-break .breaker')]
  if (breakers.length) {
    // 브레이커는 쪽 "끝" 경계이므로 쪽 시작은 0, rhythm, 2*rhythm ...
    const bTops = breakers.map((el) => (el.getBoundingClientRect().top - rootTop) / scale)
    const rhythm = bTops.length >= 2 ? bTops[1] - bTops[0] : bTops[0] || fallbackRhythm
    const tops = breakers.map((_, i) => rhythm * i)
    return { total: breakers.length, tops, rhythm: rhythm || fallbackRhythm }
  }

  return { total: 1, tops: [0], rhythm: fallbackRhythm }
}

/** 전체 쪽 수만 필요할 때 */
export function countPages(root: HTMLElement | null | undefined): number {
  if (!root) return 1
  const pageNodes = root.querySelectorAll('.jan-page-node').length
  if (pageNodes) return pageNodes
  return Math.max(1, root.querySelectorAll('.rm-page-break .breaker').length || 1)
}

/**
 * 화면 좌표(예: 커서 위치)가 몇 쪽인지 — 1부터.
 * 페이지 노드 모델에서는 실제 용지 영역으로 판정해 정확하다.
 */
export function pageAtViewportY(root: HTMLElement | null | undefined, viewportY: number, fallbackRhythm = 0): number {
  if (!root) return 1
  const pageNodes = [...root.querySelectorAll<HTMLElement>('.jan-page-node')]
  if (pageNodes.length) {
    for (let i = 0; i < pageNodes.length; i++) {
      const r = pageNodes[i].getBoundingClientRect()
      if (viewportY < r.bottom + 8) return i + 1
    }
    return pageNodes.length
  }
  const geo = readPageGeometry(root, fallbackRhythm)
  const offset = (viewportY - root.getBoundingClientRect().top) / (scaleOf(root) || 1)
  return Math.max(1, Math.min(geo.total, Math.floor(offset / (geo.rhythm || 1)) + 1))
}

/** n쪽(1부터)의 편집기 기준 시작 오프셋 px */
export function pageOffset(root: HTMLElement | null | undefined, pageNumber: number, fallbackRhythm = 0): number {
  const geo = readPageGeometry(root, fallbackRhythm)
  const idx = Math.max(0, Math.min(geo.total - 1, pageNumber - 1))
  return geo.tops[idx] ?? geo.rhythm * idx
}

/** n쪽으로 스크롤 (페이지 노드 모델이면 용지 요소로 정확히 이동) */
export function scrollToPage(root: HTMLElement | null | undefined, pageNumber: number): boolean {
  if (!root) return false
  const pageNodes = root.querySelectorAll<HTMLElement>('.jan-page-node')
  if (pageNodes.length) {
    const el = pageNodes[Math.max(0, Math.min(pageNodes.length - 1, pageNumber - 1))]
    el?.scrollIntoView({ behavior: 'auto', block: 'start' })
    return !!el
  }
  if (pageNumber <= 1) {
    root.closest('.jan-editor-pages')?.scrollIntoView({ behavior: 'auto', block: 'start' })
    return true
  }
  const breakers = root.querySelectorAll<HTMLElement>('.rm-page-break .breaker')
  const target = breakers[Math.min(pageNumber - 2, breakers.length - 1)]
  target?.scrollIntoView({ behavior: 'auto', block: 'start' })
  return !!target
}

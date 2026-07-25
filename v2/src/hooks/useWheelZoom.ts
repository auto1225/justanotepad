import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'
import { setPageZoom } from '../lib/pageZoom'

/**
 * Phase 17 — Ctrl+휠 줌.
 *
 * 적용 방식:
 *   - 인라인 `zoom` 속성 (Chromium/Edge 전체, Firefox 126+, Safari 18+)
 *   - 인라인 style 직접 적용으로 CSS cascade 회피
 *   - 인라인이 stylesheet 보다 우선이라 어떤 라이브러리도 막을 수 없음
 *
 * 이벤트:
 *   - document capture phase + window 양쪽 등록
 *   - ProseMirror/PaginationPlus 가 stopPropagation 해도 우리가 먼저 받음
 */
function applyZoom(zoom: number) {
  document.documentElement.style.setProperty('--jan-zoom', String(zoom))
  // 편집 창(메인·분할 보조)에만 적용 — 쪽모음 축소판(.jan-pagethumb-inner)도
  // .jan-editor-pages 클래스를 쓰므로 전역 셀렉터면 축소판 배율이 오염된다
  document
    .querySelectorAll<HTMLElement>('.jan-editor-main .jan-editor-pages, .jan-split-scroll > .jan-editor-pages')
    .forEach((el) => {
      el.style.zoom = String(zoom)
    })
}

export function useWheelZoom() {
  // store 변경 시 즉시 적용 (App.tsx 의 useEffect 와 별도 — 더 빠른 반응)
  useEffect(() => {
    const unsub = useUIStore.subscribe((state) => {
      applyZoom(state.zoom)
    })
    applyZoom(useUIStore.getState().zoom)
    return unsub
  }, [])

  // wheel 핸들러
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const cur = useUIStore.getState().zoom
      const next = setPageZoom(cur + delta)
      if (next !== cur) {
        applyZoom(next)
      }
    }
    document.addEventListener('wheel', onWheel, { passive: false, capture: true })
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      document.removeEventListener('wheel', onWheel, true)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])
}

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Icon } from './Icons'
import { useUIStore } from '../store/uiStore'
import { pageAtViewportY, readPageGeometry, scrollToPage } from '../lib/pageInfo'

/**
 * 쪽모음 패널 — HWP 쪽모음처럼 페이지 축소판을 편집기 "옆에" 세로로 나열한다.
 *
 * 이전 여러쪽보기(MultiPageView)는 줌 50% 이하에서만 뜨는 읽기 전용 오버레이라
 * 문서작업이 불가능했다 → 편집과 항상 공존하는 사이드 패널로 재설계.
 * - 축소판은 문서 편집을 따라 라이브 갱신 (디바운스)
 * - 클릭: 줌을 건드리지 않고 해당 페이지로 이동 (편집 계속)
 * - 현재 보고 있는 페이지 하이라이트
 */
interface PageThumbnailPanelProps {
  editor: Editor
  pageW: number
  pageH: number
  rhythmFallback: number
  pageStyle: React.CSSProperties
  paperStyle: string
}

const MAX_PAGES = 60
const THUMB_W = 156

interface Snap {
  html: string
  rhythm: number
  count: number
  truncated: boolean
}

function capture(editor: Editor, rhythmFallback: number): Snap {
  const root = editor.view.dom
  // 두 페이지 모델(page 노드 / 데코레이션 눈금)을 공용 유틸로 함께 지원
  const geo = readPageGeometry(root, rhythmFallback)
  const count = Math.max(1, Math.min(MAX_PAGES, geo.total))
  const html = root.outerHTML.replace(/contenteditable="true"/g, 'contenteditable="false"')
  return { html, rhythm: geo.rhythm || rhythmFallback, count, truncated: geo.total > MAX_PAGES }
}

export function PageThumbnailPanel({ editor, pageW, pageH, rhythmFallback, pageStyle, paperStyle }: PageThumbnailPanelProps) {
  const [snap, setSnap] = useState<Snap>(() => capture(editor, rhythmFallback))
  const [currentPage, setCurrentPage] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const togglePageThumbs = useUIStore((s) => s.togglePageThumbs)

  // 라이브 갱신 — 편집(update)마다 디바운스 재캡처 + 페이지네이션 재계산 안정화 감시
  useEffect(() => {
    let timer = 0
    const recapture = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setSnap(capture(editor, rhythmFallback)), 700)
    }
    editor.on('update', recapture)
    // 마운트 직후 페이지네이션이 재계산 중일 수 있어 짧게 재관찰
    const settle = window.setTimeout(() => setSnap(capture(editor, rhythmFallback)), 900)
    return () => {
      editor.off('update', recapture)
      window.clearTimeout(timer)
      window.clearTimeout(settle)
    }
  }, [editor, rhythmFallback])

  // 현재 페이지 추적 — 편집기 스크롤 위치가 속한 페이지를 하이라이트
  useEffect(() => {
    const scroller = document.querySelector('.jan-editor-main')
    if (!scroller) return
    let raf = 0
    const onScroll = () => {
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(() => {
        const scRect = scroller.getBoundingClientRect()
        const probeY = scRect.top + scRect.height * 0.35 // 화면 상단 1/3 지점 기준
        const page = pageAtViewportY(editor.view.dom, probeY, snap.rhythm) - 1
        setCurrentPage(Math.max(0, Math.min(snap.count - 1, page)))
      })
    }
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(raf)
    }
  }, [editor, snap.count, snap.rhythm])

  // 현재 페이지 축소판이 패널 밖에 있으면 보이게 스크롤
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-thumb-page="${currentPage}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [currentPage])

  // 클릭 — 줌을 유지한 채 해당 페이지로 이동 (편집 흐름을 끊지 않는다)
  function jumpTo(i: number) {
    scrollToPage(editor.view.dom, i + 1)
  }

  const thumbScale = THUMB_W / Math.max(1, pageW)
  const thumbH = Math.round(pageH * thumbScale)

  return (
    <aside className="jan-pagethumbs" role="navigation" aria-label="쪽모음">
      <div className="jan-pagethumbs-head">
        <strong>쪽모음</strong>
        <span>{snap.count}쪽{snap.truncated ? ` (앞 ${MAX_PAGES}쪽)` : ''}</span>
        <button type="button" onClick={togglePageThumbs} title="쪽모음 닫기" aria-label="쪽모음 닫기">
          <Icon name="close" size={13} />
        </button>
      </div>
      <div className="jan-pagethumbs-list" ref={listRef}>
        {Array.from({ length: snap.count }, (_, i) => (
          <button
            key={i}
            type="button"
            data-thumb-page={i}
            className={'jan-pagethumb' + (i === currentPage ? ' is-current' : '')}
            style={{ width: THUMB_W, height: thumbH }}
            title={`${i + 1}쪽으로 이동`}
            onClick={() => jumpTo(i)}
          >
            <span
              className="jan-pagethumb-inner jan-editor-pages"
              data-paper={paperStyle}
              style={{
                ...pageStyle,
                zoom: 1, // 편집기 축소(--jan-zoom)와 무관하게 축소판 자체 배율만 사용
                transform: `scale(${thumbScale}) translateY(${-Math.round(i * snap.rhythm)}px)`,
                width: pageW,
              }}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: snap.html }}
            />
            <span className="jan-pagethumb-num">{i + 1}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}

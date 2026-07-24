import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { setPageZoom } from '../lib/pageZoom'

/**
 * 여러 쪽 보기 — 줌을 50% 이하로 내리면 자동으로 켜지는 HWP 식 페이지 그리드.
 * 편집 문서의 DOM 스냅샷을 페이지 높이만큼 잘라 카드로 나란히 배치한다.
 * 카드를 클릭하면 줌 100% 로 복귀하며 해당 페이지 위치로 이동.
 */
interface MultiPageViewProps {
  editor: Editor
  pageW: number
  pageH: number
  rhythmFallback: number
  zoom: number
  /** 페이지 CSS 변수(여백·크기)와 용지 배경을 스냅샷에 그대로 적용하기 위한 컨텍스트 */
  pageStyle: React.CSSProperties
  paperStyle: string
}

const MAX_PAGES = 40

function capture(editor: Editor, rhythmFallback: number) {
  const root = editor.view.dom
  const rootRect = root.getBoundingClientRect()
  const breakers = [...root.querySelectorAll<HTMLElement>('.rm-page-break .breaker')]
  const tops = breakers.map((b) => b.getBoundingClientRect().top - rootRect.top)
  // CSS zoom 으로 축소된 상태에서도 원본 px 로 환산
  const scale = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1
  const rhythm = tops.length >= 2 ? (tops[1] - tops[0]) / (scale || 1) : rhythmFallback
  const count = Math.max(1, Math.min(MAX_PAGES, breakers.length || 1))
  const html = root.outerHTML.replace(/contenteditable="true"/g, 'contenteditable="false"')
  return { html, rhythm, count, truncated: breakers.length > MAX_PAGES }
}

export function MultiPageView({ editor, pageW, pageH, rhythmFallback, zoom, pageStyle, paperStyle }: MultiPageViewProps) {
  // 스냅샷 — 줌 전환 직후에는 페이지네이션이 재계산 중이라 브레이커 수가
  // 일시적으로 줄어든다. 페이지 수가 2회 연속 같아질 때까지 관찰하며 재캡처.
  const [snap, setSnap] = useState(() => capture(editor, rhythmFallback))
  useEffect(() => {
    let last = -1
    let stable = 0
    const t = window.setInterval(() => {
      const n = editor.view.dom.querySelectorAll('.rm-page-break').length
      if (n === last) stable++
      else { stable = 0; last = n }
      if (stable >= 1) {
        setSnap((prev) => (prev.count !== Math.max(1, Math.min(MAX_PAGES, n || 1)) ? capture(editor, rhythmFallback) : prev))
        if (stable >= 2) window.clearInterval(t)
      }
    }, 250)
    const stop = window.setTimeout(() => window.clearInterval(t), 4000)
    return () => { window.clearInterval(t); window.clearTimeout(stop) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const cardScale = Math.max(0.18, Math.min(0.6, zoom))

  function jumpTo(i: number) {
    setPageZoom(1)
    window.setTimeout(() => {
      const root = editor.view.dom
      if (i === 0) {
        root.closest('.jan-editor-pages')?.scrollIntoView({ behavior: 'auto', block: 'start' })
      } else {
        const breakers = root.querySelectorAll('.rm-page-break .breaker')
        breakers[Math.min(i - 1, breakers.length - 1)]?.scrollIntoView({ behavior: 'auto', block: 'start' })
      }
      editor.commands.focus()
    }, 150)
  }

  return (
    <div className="jan-multipage-overlay" role="region" aria-label="여러 쪽 보기">
      <div className="jan-multipage-bar">
        <strong>여러 쪽 보기</strong>
        <span>페이지를 클릭하면 그 위치에서 편집 · 줌을 50% 초과로 올려도 복귀</span>
        {snap.truncated && <span>(앞 {MAX_PAGES}쪽까지 표시)</span>}
        <span className="flex-spacer" />
        <button type="button" onClick={() => setPageZoom(1)}>편집으로 (100%)</button>
      </div>
      <div className="jan-multipage-grid">
        {Array.from({ length: snap.count }, (_, i) => (
          <button
            key={i}
            type="button"
            className="jan-mp-page"
            style={{ width: Math.round(pageW * cardScale), height: Math.round(pageH * cardScale) }}
            title={`${i + 1}쪽으로 이동`}
            onClick={() => jumpTo(i)}
          >
            <span
              className="jan-mp-inner jan-editor-pages"
              data-paper={paperStyle}
              style={{
                ...pageStyle,
                zoom: 1, // 부모의 --jan-zoom 축소를 무효화하고 카드 자체 배율만 사용
                transform: `scale(${cardScale}) translateY(${-Math.round(i * snap.rhythm)}px)`,
                width: pageW,
              }}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: snap.html }}
            />
            <span className="jan-mp-num">{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

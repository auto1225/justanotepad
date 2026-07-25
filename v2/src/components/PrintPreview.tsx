import { useEffect, useRef, useState } from 'react'
import { buildPrintHtml, currentPrintPageSettings, getPagedSource } from '../lib/pdfExport'
import { resolveBlobRefsInHtml } from '../lib/blobRefs'
import { PAGE_PRESETS, pageMarginsSummary, useUIStore } from '../store/uiStore'

interface PrintPreviewProps {
  html: string
  title: string
  onClose: () => void
}

export function PrintPreview({ html, title, onClose }: PrintPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // jan-blob:// 이미지 참조를 data URL 로 해석한 뒤에 렌더 (미해석 시 인쇄에서 이미지 깨짐)
  const [resolvedHtml, setResolvedHtml] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    resolveBlobRefsInHtml(html).then((out) => { if (!cancelled) setResolvedHtml(out) }).catch(() => { if (!cancelled) setResolvedHtml(html) })
    return () => { cancelled = true }
  }, [html])
  const [status, setStatus] = useState('페이지 분할 중...')
  // 여러 페이지 나란히 보기 (HWP 스타일) — 1·2·3열
  const [cols, setCols] = useState<1 | 2 | 3>(1)
  const colsRef = useRef<1 | 2 | 3>(1)
  // 렌더가 끝난 뒤 동기화 (렌더 중 ref 쓰기 금지)
  useEffect(() => { colsRef.current = cols })

  /** iframe 문서에 다열 레이아웃 스타일을 주입/갱신 — 재로드 없이 전환 */
  function applyMultiPageLayout(nextCols: 1 | 2 | 3) {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    let style = doc.getElementById('jan-multipage-style') as HTMLStyleElement | null
    if (!style) {
      style = doc.createElement('style')
      style.id = 'jan-multipage-style'
      doc.head.appendChild(style)
    }
    if (nextCols === 1) { style.textContent = ''; return }
    // 페이지 실제 폭 기준으로 배율을 자동 계산해 nextCols 장이 딱 들어가게
    const page = doc.querySelector<HTMLElement>('.pagedjs_page')
    const frameW = iframeRef.current?.clientWidth || 1200
    const pageW = page ? page.offsetWidth : 794
    const gap = 14
    const zoom = Math.min(1, (frameW - 32 - gap * (nextCols - 1)) / (pageW * nextCols))
    style.textContent = `
      .pagedjs_pages { display: flex !important; flex-wrap: wrap; gap: ${gap}px; justify-content: center; padding: 16px 8px; }
      .pagedjs_page { margin: 0 !important; zoom: ${zoom.toFixed(3)}; }
    `
  }

  function changeCols(next: 1 | 2 | 3) {
    setCols(next)
    applyMultiPageLayout(next)
  }
  const paperStyle = useUIStore((s) => s.paperStyle)
  const pageSize = useUIStore((s) => s.pageSize)
  const pageOrientation = useUIStore((s) => s.pageOrientation)
  const pageMarginMm = useUIStore((s) => s.pageMarginMm)
  const pageMarginsMm = useUIStore((s) => s.pageMarginsMm)
  const pageColumnCount = useUIStore((s) => s.pageColumnCount)
  const runningHeader = useUIStore((s) => s.runningHeader)
  const runningFooter = useUIStore((s) => s.runningFooter)
  const pageLabel = pageSize === 'custom' ? '사용자 지정' : (PAGE_PRESETS[pageSize]?.label || pageSize)
  const orientationLabel = pageOrientation === 'landscape' ? '가로' : '세로'
  const marginLabel = pageMarginsSummary(pageMarginsMm, pageMarginMm)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const ifr = iframeRef.current
    if (!ifr || resolvedHtml === null) return
    let cancelled = false
    setStatus('페이지 분할 중...')

    // Paged.js 를 로컬 번들에서 주입 — CDN 차단 환경에서 0페이지가 되던 문제 해결
    void getPagedSource().then((pagedSource) => {
      if (cancelled || !iframeRef.current) return
      iframeRef.current.srcdoc = buildPrintHtml(
        resolvedHtml,
        title,
        currentPrintPageSettings(),
        { previewChrome: true, pagedSource }
      )
    })

    const handleLoad = () => {
      let waited = 0
      const t = setInterval(() => {
        waited += 200
        try {
          const doc = ifr.contentDocument
          const pages = doc?.querySelectorAll('.pagedjs_page')
          if (pages && pages.length > 0) {
            clearInterval(t)
            if (!cancelled) {
              setStatus(`${pages.length}페이지 · 인쇄/PDF 가능`)
              // 재생성 후에도 선택한 다열 보기를 유지 (ref 로 최신값)
              applyMultiPageLayout(colsRef.current)
            }
          }
        } catch {
          // The iframe can be between navigation states while Paged.js loads.
        }
        if (waited > 15000) {
          clearInterval(t)
          // 15초가 지나도 페이지가 안 생기면 실패를 숨기지 않는다
          if (!cancelled) setStatus('미리보기 생성 실패 — 인쇄 버튼으로 브라우저 인쇄를 사용하세요')
        }
      }, 200)
    }
    ifr.addEventListener('load', handleLoad)
    return () => {
      cancelled = true
      ifr.removeEventListener('load', handleLoad)
    }
  }, [resolvedHtml, title, paperStyle, pageSize, pageOrientation, pageMarginMm, pageMarginsMm, pageColumnCount, runningHeader, runningFooter])

  function doPrint() {
    const ifr = iframeRef.current
    if (!ifr?.contentWindow) return
    ifr.contentWindow.focus()
    ifr.contentWindow.print()
  }

  return (
    <div className="jan-print-modal" onClick={onClose}>
      <div className="jan-print-shell" onClick={(e) => e.stopPropagation()}>
        <div className="jan-print-bar">
          <span className="jan-print-title">인쇄 미리보기 - {pageLabel} {orientationLabel} / 여백 {marginLabel} / {pageColumnCount}단</span>
          <span className="jan-print-status">{status}</span>
          <div style={{ flex: 1 }} />
          <span className="jan-print-cols" role="group" aria-label="여러 페이지 보기">
            <span>보기</span>
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={'jan-print-btn' + (cols === n ? ' primary' : '')}
                aria-pressed={cols === n}
                title={`${n}쪽씩 나란히 보기`}
                onClick={() => changeCols(n)}
              >{n}쪽</button>
            ))}
          </span>
          <button onClick={doPrint} className="jan-print-btn primary">인쇄 / PDF</button>
          <button onClick={onClose} className="jan-print-btn">닫기 (Esc)</button>
        </div>
        <iframe ref={iframeRef} className="jan-print-iframe" title="인쇄 미리보기" />
      </div>
    </div>
  )
}

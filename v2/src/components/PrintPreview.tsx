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
            if (!cancelled) setStatus(`${pages.length}페이지 · 인쇄/PDF 가능`)
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
          <button onClick={doPrint} className="jan-print-btn primary">인쇄 / PDF</button>
          <button onClick={onClose} className="jan-print-btn">닫기 (Esc)</button>
        </div>
        <iframe ref={iframeRef} className="jan-print-iframe" title="인쇄 미리보기" />
      </div>
    </div>
  )
}

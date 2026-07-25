import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor as TiptapEditor, AnyExtension } from '@tiptap/core'
import { Icon } from './Icons'
import { useUIStore } from '../store/uiStore'
import { useDocRelay } from '../hooks/useDocRelay'
import { PageSpreadCell } from './PageSpreadCell'

/**
 * 쪽 나란히 편집 — 1·2·3쪽을 같은 선상에 놓고 각 쪽에서 바로 편집한다.
 * (워드 '여러 페이지 보기'의 편집 가능 버전)
 *
 * 페이지네이션 엔진이 문서를 세로 한 줄기로만 흘려 페이지를 낱장으로 뗄 수 없으므로,
 * 쪽마다 편집기 인스턴스를 두고 담당 쪽만 보이게 잘라 가로로 배치한다.
 * 인스턴스 사이는 useDocRelay 가 스텝을 브로드캐스트해 하나의 문서로 유지한다.
 */
interface PageSpreadViewProps {
  mainEditor: TiptapEditor
  /** 히스토리 없는 확장 세트 (실행취소는 mainEditor 로 위임) */
  extensions: AnyExtension[]
  pagePx: { pageWidth: number; pageHeight: number }
  pageMarginPx: { top: number; right: number; bottom: number; left: number }
  paginationEnabled: boolean
  pageStyle: React.CSSProperties
  paperStyle: string
  pageSize: string
  pageOrientation: string
  pageColumnCount: number
  viewLayout: string
  spellCheck: boolean
}

export function PageSpreadView(props: PageSpreadViewProps) {
  const { mainEditor, extensions, pagePx, pageMarginPx, paginationEnabled } = props
  const spreadCols = useUIStore((s) => s.spreadCols)
  const setSpreadCols = useUIStore((s) => s.setSpreadCols)
  const zoom = useUIStore((s) => s.zoom)

  const [firstPage, setFirstPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  // 셀 인스턴스 — 릴레이 참여용
  const [cells, setCells] = useState<Record<number, TiptapEditor | null>>({})

  // 전체 쪽수는 대표 에디터 기준
  useEffect(() => {
    const read = () => {
      const n = mainEditor.view.dom.querySelectorAll('.rm-page-break .breaker').length
      setTotalPages(Math.max(1, n || 1))
    }
    read()
    const timers = [300, 900, 1800].map((ms) => window.setTimeout(read, ms))
    mainEditor.on('update', read)
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      mainEditor.off('update', read)
    }
  }, [mainEditor])

  const pages = useMemo(
    () => Array.from({ length: spreadCols }, (_, i) => firstPage + i).filter((p) => p <= Math.max(totalPages, firstPage + spreadCols - 1)),
    [spreadCols, firstPage, totalPages]
  )

  const relayList = useMemo(
    () => [mainEditor, ...pages.map((p) => cells[p] ?? null)],
    [mainEditor, pages, cells]
  )
  useDocRelay(relayList)

  const registerCell = useCallback((page: number, editor: TiptapEditor | null) => {
    setCells((prev) => {
      if (prev[page] === editor) return prev
      return { ...prev, [page]: editor }
    })
  }, [])

  // 셀 에디터에도 용지 크기를 반영 (메인과 같은 커맨드 경로).
  // 갓 만들어진 인스턴스는 PaginationPlus 가 준비 전이라 실패하므로 몇 번 더 시도한다.
  useEffect(() => {
    if (!paginationEnabled) return
    const apply = () => {
      for (const ed of Object.values(cells)) {
        if (!ed || ed.isDestroyed) continue
        try {
          ed.chain()
            .updatePageWidth(pagePx.pageWidth)
            .updatePageHeight(pagePx.pageHeight)
            .updateMargins({ top: pageMarginPx.top, bottom: pageMarginPx.bottom, left: pageMarginPx.left, right: pageMarginPx.right })
            .run()
        } catch {
          // 다음 시도에서 반영된다
        }
      }
    }
    apply()
    const timers = [120, 500, 1200].map((ms) => window.setTimeout(apply, ms))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [cells, paginationEnabled, pagePx.pageWidth, pagePx.pageHeight, pageMarginPx])

  const maxFirst = Math.max(1, totalPages - spreadCols + 1)
  const canPrev = firstPage > 1
  const canNext = firstPage < maxFirst

  // 키보드 이동 — PageUp/PageDown 으로 펼침 단위 이동
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'PageDown' && firstPage < maxFirst) { e.preventDefault(); setFirstPage((p) => Math.min(maxFirst, p + spreadCols)) }
      else if (e.key === 'PageUp' && firstPage > 1) { e.preventDefault(); setFirstPage((p) => Math.max(1, p - spreadCols)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [firstPage, maxFirst, spreadCols])

  return (
    <div className="jan-spread" role="region" aria-label="쪽 나란히 편집">
      <div className="jan-spread-bar">
        <strong>쪽 나란히 편집</strong>
        <span className="jan-spread-range">
          {pages[0]}
          {pages.length > 1 ? `~${pages[pages.length - 1]}` : ''} / {totalPages}쪽
        </span>
        <div className="jan-spread-nav">
          <button type="button" disabled={!canPrev} onClick={() => setFirstPage((p) => Math.max(1, p - spreadCols))} title="이전 쪽 묶음 (PageUp)" aria-label="이전 쪽">
            <Icon name="chevron-left" size={14} />
          </button>
          <button type="button" disabled={!canNext} onClick={() => setFirstPage((p) => Math.min(maxFirst, p + spreadCols))} title="다음 쪽 묶음 (PageDown)" aria-label="다음 쪽">
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
        <div className="jan-spread-colseg" role="group" aria-label="한 번에 보이는 쪽 수">
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" className={spreadCols === n ? 'is-on' : ''} onClick={() => setSpreadCols(n as 2 | 3 | 4)} title={`${n}쪽씩 나란히`}>
              {n}쪽
            </button>
          ))}
        </div>
        <span className="jan-spread-hint">각 쪽에서 바로 편집됩니다 — 어디서 고쳐도 문서 전체에 반영</span>
        <button type="button" onClick={() => useUIStore.getState().setSpreadCols(0)} title="쪽 나란히 편집 끝내기" aria-label="끝내기">
          <Icon name="close" size={13} />
        </button>
      </div>
      <div className="jan-spread-grid">
        {pages.map((p) => (
          <PageSpreadCell
            key={p}
            extensions={extensions}
            initialContent={mainEditor.getJSON()}
            pageNumber={p}
            pageW={pagePx.pageWidth}
            pageH={pagePx.pageHeight}
            zoom={zoom}
            pageStyle={props.pageStyle}
            paperStyle={props.paperStyle}
            pageSize={props.pageSize}
            pageOrientation={props.pageOrientation}
            pageColumnCount={props.pageColumnCount}
            viewLayout={props.viewLayout}
            spellCheck={props.spellCheck}
            undoTarget={mainEditor}
            onReady={(ed) => registerCell(p, ed)}
          />
        ))}
      </div>
    </div>
  )
}

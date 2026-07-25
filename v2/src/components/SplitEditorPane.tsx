import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor as TiptapEditor, AnyExtension } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { Icon } from './Icons'
import { useUIStore } from '../store/uiStore'
import { useDocRelay } from '../hooks/useDocRelay'

/**
 * 분할 편집 — 같은 문서를 오른쪽 창에서 "진짜로" 편집하는 보조 에디터 (Word 창 분할).
 *
 * 동작 원리:
 * - 보조 TipTap 에디터를 메인과 동일한 확장(단, 실행취소 제외)으로 생성
 * - 문서가 바뀌는 트랜잭션의 스텝을 양방향으로 릴레이해 두 창을 항상 동일하게 유지
 *   (모든 dispatch 가 같은 JS 틱에서 동기 실행되므로 두 문서가 어긋날 틈이 없다)
 * - 실행취소/다시실행은 메인 히스토리로 일원화:
 *   보조→메인 릴레이는 메인 히스토리에 쌓이고(Ctrl+Z 가능),
 *   메인→보조 릴레이는 addToHistory:false + 보조는 히스토리 확장 자체가 없음.
 *   보조 창의 Ctrl+Z/Y 는 메인 에디터에 위임.
 * - 원격 협업(y.js) 세션에서는 보조도 같은 ydoc 에 붙어 릴레이가 필요 없다.
 */
interface SplitEditorPaneProps {
  mainEditor: TiptapEditor
  extensions: AnyExtension[]
  /** y.js 협업 문서가 있으면 스텝 릴레이 대신 ydoc 이 동기화를 담당 */
  hasYdoc: boolean
  paginationEnabled: boolean
  pagePx: { pageWidth: number; pageHeight: number }
  pageMarginPx: { top: number; right: number; bottom: number; left: number }
  pageStyle: React.CSSProperties
  paperStyle: string
  pageSize: string
  pageOrientation: string
  pageColumnCount: number
  viewLayout: string
  spellCheck: boolean
}

export function SplitEditorPane(props: SplitEditorPaneProps) {
  const { mainEditor, extensions, hasYdoc, paginationEnabled, pagePx, pageMarginPx } = props
  const toggleSplitView = useUIStore((s) => s.toggleSplitView)
  const splitDir = useUIStore((s) => s.splitDir)
  const setSplitDir = useUIStore((s) => s.setSplitDir)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 })

  // 실행취소·다시실행을 메인 에디터로 위임 (보조에는 히스토리가 없다)
  const undoRelay = useMemo(
    () =>
      Extension.create({
        name: 'janSplitUndoRelay',
        addKeyboardShortcuts() {
          const run = (cmd: 'undo' | 'redo') => () => {
            const cmds = mainEditor.commands as unknown as Record<string, (() => boolean) | undefined>
            cmds[cmd]?.()
            return true
          }
          return {
            'Mod-z': run('undo'),
            'Mod-Shift-z': run('redo'),
            'Mod-y': run('redo'),
          }
        },
      }),
    [mainEditor]
  )

  const splitExtensions = useMemo(() => [...extensions, undoRelay], [extensions, undoRelay])

  const secondary = useEditor(
    {
      extensions: splitExtensions,
      // y.js 모드에선 Collaboration 확장이 내용을 공급하므로 빈 문서로 시작
      content: hasYdoc ? '' : mainEditor.getJSON(),
      editorProps: {
        attributes: { class: 'ProseMirror', spellcheck: props.spellCheck ? 'true' : 'false' },
      },
    },
    [splitExtensions]
  )

  // 문서 동기화는 공용 릴레이 엔진에 위임 (y.js 세션이면 ydoc 이 담당하므로 끈다)
  useDocRelay([mainEditor, secondary], !hasYdoc)

  // 페이지네이션 크기 반영 (메인과 동일한 커맨드 경로)
  useEffect(() => {
    if (!secondary || !paginationEnabled) return
    try {
      secondary
        .chain()
        .updatePageWidth(pagePx.pageWidth)
        .updatePageHeight(pagePx.pageHeight)
        .updateMargins({
          top: pageMarginPx.top,
          bottom: pageMarginPx.bottom,
          left: pageMarginPx.left,
          right: pageMarginPx.right,
        })
        .run()
    } catch {
      // 첫 프레임에는 PaginationPlus 가 아직 준비 전일 수 있다
    }
  }, [secondary, paginationEnabled, pagePx.pageWidth, pagePx.pageHeight, pageMarginPx])

  // 이 창이 지금 몇 쪽을 보고 있는지 — 스크롤 위치로 계산해 바에 표시
  useEffect(() => {
    const scroller = scrollRef.current
    if (!secondary || !scroller) return
    let raf = 0
    const update = () => {
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(() => {
        const root = secondary.view.dom
        const rootRect = root.getBoundingClientRect()
        const scale = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1
        // 전체 쪽수는 메인 창 기준으로 통일한다 — 두 창은 머리말·꼬리말 측정 타이밍 차이로
        // 문서 높이가 미세하게 달라(수십 px) 각자 세면 4쪽/5쪽처럼 어긋나 보인다.
        const total = Math.max(1, mainEditor.view.dom.querySelectorAll('.rm-page-break .breaker').length || 1)
        const docH = Math.max(1, rootRect.height / (scale || 1))
        const scRect = scroller.getBoundingClientRect()
        const probe = (scRect.top + scRect.height * 0.35 - rootRect.top) / (scale || 1)
        const current = Math.max(1, Math.min(total, Math.floor((probe / docH) * total) + 1))
        setPageInfo((prev) => (prev.current === current && prev.total === total ? prev : { current, total }))
      })
    }
    update()
    // 마운트 직후에는 페이지네이션이 아직 재계산 중이라 쪽수가 실제보다 적게 잡힌다
    // (예: 5쪽 문서가 4쪽으로) → 안정화될 때까지 몇 번 더 재측정
    const settles = [300, 900, 1800].map((ms) => window.setTimeout(update, ms))
    scroller.addEventListener('scroll', update, { passive: true })
    secondary.on('update', update)
    return () => {
      scroller.removeEventListener('scroll', update)
      secondary.off('update', update)
      settles.forEach((t) => window.clearTimeout(t))
      window.cancelAnimationFrame(raf)
    }
  }, [secondary, mainEditor])

  // 편집 줌 동기화 — useWheelZoom 은 "줌 변경 시점"에만 인라인 zoom 을 먹이므로
  // 나중에 마운트되는 분할 창은 현재 줌을 따로 받아야 한다
  const zoom = useUIStore((s) => s.zoom)

  if (!secondary) return null

  return (
    <div className="jan-split-secondary" role="region" aria-label="분할 편집 창">
      <div className="jan-split-bar">
        <strong>둘째 창</strong>
        <span className="jan-split-page">{pageInfo.current} / {pageInfo.total}쪽</span>
        <span className="jan-split-hint">같은 문서입니다 — 여기서 고치면 {splitDir === 'h' ? '위' : '왼쪽'} 창에도 바로 반영됩니다</span>
        <div className="jan-split-dirseg" role="group" aria-label="분할 방향">
          <button
            type="button"
            className={splitDir === 'h' ? 'is-on' : ''}
            onClick={() => setSplitDir('h')}
            title="위·아래로 나누기 (용지 폭이 온전히 보입니다)"
          >위·아래</button>
          <button
            type="button"
            className={splitDir === 'v' ? 'is-on' : ''}
            onClick={() => setSplitDir('v')}
            title="좌우로 나누기 (넓은 화면 권장 — 좁으면 용지가 잘립니다)"
          >좌우</button>
        </div>
        <button type="button" onClick={toggleSplitView} title="분할 닫기" aria-label="분할 닫기">
          <Icon name="close" size={13} />
        </button>
      </div>
      <div className="jan-split-scroll" ref={scrollRef}>
        <div
          className="jan-editor-pages"
          data-paper={props.paperStyle}
          data-page-size={props.pageSize}
          data-page-orientation={props.pageOrientation}
          data-page-columns={props.pageColumnCount}
          data-rulers="false"
          data-view-layout={props.viewLayout}
          style={{ ...props.pageStyle, zoom }}
        >
          <div className="jan-page-layout">
            <div className="jan-page-shell">
              <EditorContent editor={secondary} />
              <div className="jan-page-margin-frame" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

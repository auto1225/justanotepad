import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import type { Editor as TiptapEditor, AnyExtension } from '@tiptap/core'

/**
 * 쪽 나란히 편집의 낱장 셀 — 문서 전체를 담은 편집기 인스턴스를 담당 쪽 하나만
 * 보이도록 잘라(clip) 보여준다. 여러 셀을 가로로 늘어놓으면 1·2·3쪽이 같은
 * 선상에 놓인 채로 각 쪽에서 바로 편집할 수 있다 (워드 여러 페이지 보기 + 편집).
 *
 * 페이지네이션 엔진은 문서를 세로 한 줄기로만 흘리기 때문에 페이지를 낱장으로
 * 떼어낼 수 없다 → 페이지마다 인스턴스를 두고 스크롤 위치를 그 쪽에 고정하는 방식.
 * 인스턴스 사이 동기화는 useDocRelay 가 담당한다.
 */
interface PageSpreadCellProps {
  extensions: AnyExtension[]
  initialContent: object
  /** 이 셀이 보여줄 쪽 번호 (1부터) */
  pageNumber: number
  pageW: number
  pageH: number
  zoom: number
  pageStyle: React.CSSProperties
  paperStyle: string
  pageSize: string
  pageOrientation: string
  pageColumnCount: number
  viewLayout: string
  spellCheck: boolean
  /** 실행취소를 위임할 대표 에디터 */
  undoTarget: TiptapEditor
  /** 생성된 인스턴스를 부모에 알려 릴레이에 참여시킨다 */
  onReady: (editor: TiptapEditor | null) => void
  /** 커서가 다른 쪽으로 넘어갔을 때 부모에 알림 (담당 쪽 갱신용) */
  onPageDrift?: (pageNumber: number) => void
}

export function PageSpreadCell(props: PageSpreadCellProps) {
  const { extensions, initialContent, pageNumber, pageW, pageH, zoom, undoTarget, onReady } = props
  const clipRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  // 실행취소·다시실행은 대표 에디터로 위임 (셀에는 히스토리가 없다)
  const undoRelay = useMemo(
    () =>
      Extension.create({
        name: 'janSpreadUndoRelay',
        addKeyboardShortcuts() {
          const run = (cmd: 'undo' | 'redo') => () => {
            const cmds = undoTarget.commands as unknown as Record<string, (() => boolean) | undefined>
            cmds[cmd]?.()
            return true
          }
          return { 'Mod-z': run('undo'), 'Mod-Shift-z': run('redo'), 'Mod-y': run('redo') }
        },
      }),
    [undoTarget]
  )

  const cellExtensions = useMemo(() => [...extensions, undoRelay], [extensions, undoRelay])

  const editor = useEditor(
    {
      extensions: cellExtensions,
      content: initialContent,
      editorProps: { attributes: { class: 'ProseMirror', spellcheck: props.spellCheck ? 'true' : 'false' } },
    },
    [cellExtensions]
  )

  useEffect(() => {
    onReady(editor ?? null)
    if (editor) setReady(true)
    return () => onReady(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // 담당 쪽으로 스크롤 고정 — 페이지 경계(브레이커) 위치를 재서 맞춘다
  useEffect(() => {
    const clip = clipRef.current
    if (!editor || !clip || !ready) return
    const align = () => {
      const root = editor.view.dom
      const rootRect = root.getBoundingClientRect()
      const scale = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1
      // 페이지 "주기"로 계산한다 — 구분선(breaker) 위치를 그대로 쓰면 갭·꼬리말 앞이라
      // 다음 쪽 상단에 이전 쪽 꼬리말이 52px 정도 걸쳐 보인다.
      const breakers = [...root.querySelectorAll<HTMLElement>('.rm-page-break .breaker')]
      const tops = breakers.map((b) => (b.getBoundingClientRect().top - rootRect.top) / (scale || 1))
      const rhythm = tops.length >= 2 ? tops[1] - tops[0] : pageH + 38
      const offset = rhythm * Math.max(0, pageNumber - 1)
      clip.scrollTop = Math.max(0, Math.round(offset * zoom))
    }
    align()
    // 페이지네이션 재계산이 끝난 뒤 위치가 흔들리므로 몇 번 더 맞춘다
    const timers = [200, 700, 1500].map((ms) => window.setTimeout(align, ms))
    const onUpdate = () => window.setTimeout(align, 60)
    editor.on('update', onUpdate)
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      editor.off('update', onUpdate)
    }
  }, [editor, ready, pageNumber, pageH, zoom])

  // 편집 중 커서가 담당 쪽을 벗어나면(브라우저 자동 스크롤) 부모에 알려 배지를 갱신
  useEffect(() => {
    const clip = clipRef.current
    if (!clip || !props.onPageDrift || !editor) return
    let raf = 0
    const onScroll = () => {
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(() => {
        const root = editor.view.dom
        const rootRect = root.getBoundingClientRect()
        const scale = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1
        const breakers = [...root.querySelectorAll<HTMLElement>('.rm-page-break .breaker')]
        const tops = breakers.map((b) => (b.getBoundingClientRect().top - rootRect.top) / (scale || 1))
        const rhythm = tops.length >= 2 ? tops[1] - tops[0] : pageH + 32
        const shown = Math.max(1, Math.round(clip.scrollTop / zoom / (rhythm || 1)) + 1)
        if (shown !== pageNumber) props.onPageDrift?.(shown)
      })
    }
    clip.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clip.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, pageNumber, pageH, zoom])

  return (
    <div className="jan-spread-cell" style={{ width: Math.round(pageW * zoom) }}>
      <div className="jan-spread-cell-head">
        <span className="jan-spread-cell-num">{pageNumber}쪽</span>
      </div>
      <div
        className="jan-spread-clip"
        ref={clipRef}
        style={{ width: Math.round(pageW * zoom), height: Math.round(pageH * zoom) }}
      >
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
              <EditorContent editor={editor} />
              <div className="jan-page-margin-frame" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor as TiptapEditor, AnyExtension } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { Step } from '@tiptap/pm/transform'
import { Icon } from './Icons'
import { useUIStore } from '../store/uiStore'

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

const RELAY_META = 'jan-split-relay'

export function SplitEditorPane(props: SplitEditorPaneProps) {
  const { mainEditor, extensions, hasYdoc, paginationEnabled, pagePx, pageMarginPx } = props
  const toggleSplitView = useUIStore((s) => s.toggleSplitView)

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

  // 스텝 양방향 릴레이 — y.js 세션이면 ydoc 이 대신 동기화하므로 생략
  useEffect(() => {
    if (!secondary || hasYdoc) return

    // setContent 재동기화가 다시 릴레이 핸들러에 잡히면 동기 무한 재귀가 된다 — 가드 필수
    let resyncing = false
    const resync = (from: TiptapEditor, to: TiptapEditor) => {
      if (resyncing || to.isDestroyed) return
      resyncing = true
      try {
        to.commands.setContent(from.getJSON(), { emitUpdate: false })
      } finally {
        window.setTimeout(() => { resyncing = false }, 0)
      }
    }

    // 마운트 직후 1회 통째 동기화 — 생성 시점 이후 메인이 변했을 수 있고,
    // 스키마 인스턴스가 달라 doc.eq 비교는 신뢰할 수 없다
    resync(mainEditor, secondary)

    const relay = (from: TiptapEditor, to: TiptapEditor, keepHistory: boolean) =>
      ({ transaction }: { transaction: { docChanged: boolean; getMeta: (k: string) => unknown; steps: unknown[] } }) => {
        if (resyncing) return
        if (!transaction.docChanged || transaction.getMeta(RELAY_META)) return
        if (to.isDestroyed) return
        const tr = to.state.tr
        try {
          // 두 에디터는 내용이 같아도 "다른" 스키마 인스턴스를 쓴다 — 스텝 안의 노드가
          // 발신 스키마 소속이라 그대로 적용하면 콘텐츠 검증이 실패한다.
          // 협업 프로토콜처럼 JSON 왕복으로 수신 스키마 소속 스텝으로 재구성한다.
          for (const step of transaction.steps as Step[]) {
            tr.step(Step.fromJSON(to.state.schema, step.toJSON()))
          }
        } catch (e) {
          // 스텝 적용 실패(문서 불일치) — 원본 기준으로 통째 재동기화
          console.warn('[분할 편집] 스텝 적용 실패 — 재동기화:', e instanceof Error ? e.message : e)
          resync(from, to)
          return
        }
        tr.setMeta(RELAY_META, true)
        if (!keepHistory) tr.setMeta('addToHistory', false)
        to.view.dispatch(tr)
      }

    // 메인→보조: 보조 히스토리 없음(무관), 메타만 명시
    const mainToSecondary = relay(mainEditor, secondary, false)
    // 보조→메인: 메인 히스토리에 쌓여 Ctrl+Z 로 되돌릴 수 있어야 한다
    const secondaryToMain = relay(secondary, mainEditor, true)

    mainEditor.on('transaction', mainToSecondary)
    secondary.on('transaction', secondaryToMain)
    return () => {
      mainEditor.off('transaction', mainToSecondary)
      secondary.off('transaction', secondaryToMain)
    }
  }, [secondary, mainEditor, hasYdoc])

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

  // 편집 줌 동기화 — useWheelZoom 은 "줌 변경 시점"에만 인라인 zoom 을 먹이므로
  // 나중에 마운트되는 분할 창은 현재 줌을 따로 받아야 한다
  const zoom = useUIStore((s) => s.zoom)

  if (!secondary) return null

  return (
    <div className="jan-split-secondary" role="region" aria-label="분할 편집 창">
      <div className="jan-split-bar">
        <strong>분할 편집</strong>
        <span>같은 문서 — 양쪽 어디서나 편집됩니다</span>
        <button type="button" onClick={toggleSplitView} title="분할 닫기" aria-label="분할 닫기">
          <Icon name="close" size={13} />
        </button>
      </div>
      <div className="jan-split-scroll">
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

import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { AnyExtension } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { JanTableCell, JanTableHeader } from '../extensions/TableCellExt'
import { ImageWithWidth as Image } from '../extensions/ImageWithWidth'
import { PaginationPlus, PAGE_SIZES } from 'tiptap-pagination-plus'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useCallback, useEffect, useState, lazy, Suspense, useMemo, useRef, type CSSProperties } from 'react'
import { Toolbar } from './Toolbar'
import { AppHeader } from './AppHeader'
import { MemoTabs } from './MemoTabs'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { TagsBar } from './TagsBar'
import { OutlinePanel } from './OutlinePanel'
import { SlashMenu } from './SlashMenu'
import { TableMenu } from './TableMenu'
import { BubbleToolbar } from './BubbleToolbar'
import { ImageMenu } from './ImageMenu'
import { ModalSkeleton } from './ModalSkeleton'
import { useDocStore } from '../store/docStore'
import { useMemosStore } from '../store/memosStore'
import { useThemeStore } from '../store/themeStore'
import { saveToFile, openFile } from '../lib/fileOps'
import { installWordKeymap } from '../lib/keymap'
import { tauriSyncOnBoot } from '../lib/justpin'
import { trackEvent } from '../lib/analytics'
import { MathInline } from '../extensions/Math'
import { Mermaid } from '../extensions/Mermaid'
import { MentionExt } from '../extensions/MentionConfig'
import { Callout } from '../extensions/Callout'
import { Superscript } from '../extensions/Superscript'
import { LockedContent } from '../extensions/LockedContent'
import { Subscript } from '../extensions/Subscript'
import { Indent } from '../extensions/Indent'
import { Embed } from '../extensions/Embed'
import { useCollab } from '../hooks/useCollab'
import { useImageDropPaste } from '../hooks/useImageDropPaste'
import { useAutoSave } from '../hooks/useAutoSave'
import { useVersionsStore } from '../store/versionsStore'
import { useMacroExpansion } from '../hooks/useMacroExpansion'
import { useAiAutocomplete } from '../hooks/useAiAutocomplete'
import { useHeadingAnchors } from '../hooks/useHeadingAnchors'
import { useFormatPainter } from '../hooks/useFormatPainter'
import { useCursorMemory } from '../hooks/useCursorMemory'
import { useWheelZoom } from '../hooks/useWheelZoom'
import { useWritingGoalStore } from '../store/writingGoalStore'
import { useSettingsStore } from '../store/settingsStore'
import { dispatchWebhook } from '../lib/webhooks'
import {
  DEFAULT_RUNNING_FOOTER,
  formatRunningText,
  normalizeMemoPageSettings,
  normalizePageMarginsMm,
  pageDimensions,
  pageDimensionsPx,
  pageSettingsFromUi,
  sameMemoPageSettings,
  useUIStore,
} from '../store/uiStore'
import { useTypographyStore } from '../store/typographyStore'
import { SmartTypography } from '../extensions/Typography'
import { TextShadow } from '../extensions/TextShadow'
import { TextStyle, FontFamily, FontSize } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { LinkCard } from '../extensions/LinkCard'
import { AudioNode, VideoNode } from '../extensions/Media'
import { PageBreak } from '../extensions/PageBreak'
import { NormalHorizontalRule } from '../extensions/HorizontalRule'
import Highlight from '@tiptap/extension-highlight'
import { Lightbox } from './Lightbox'
import type { RoleToolId } from '../lib/roles'
import type { MeetingKind } from '../lib/meetingNotes'
import { externalizeLargeDataUrlsInHtml, resolveBlobRefsInElement } from '../lib/blobRefs'
import { pushActiveSnapshot } from '../lib/activeSync'
import { downloadAttachment } from '../lib/attachments'
import { flash } from '../lib/flash'

const AiHelper = lazy(() => import('./AiHelper').then((m) => ({ default: m.AiHelper })))
const SettingsModal = lazy(() => import('./SettingsModal').then((m) => ({ default: m.SettingsModal })))
const PrintPreview = lazy(() => import('./PrintPreview').then((m) => ({ default: m.PrintPreview })))
const RolesPanel = lazy(() => import('./RolesPanel').then((m) => ({ default: m.RolesPanel })))
const PaperPanel = lazy(() => import('./PaperPanel').then((m) => ({ default: m.PaperPanel })))
const PostitPanel = lazy(() => import('./PostitPanel').then((m) => ({ default: m.PostitPanel })))
const SearchPanel = lazy(() => import('./SearchPanel').then((m) => ({ default: m.SearchPanel })))
const PaintCanvas = lazy(() => import('./PaintCanvas').then((m) => ({ default: m.PaintCanvas })))
const KeyboardHelp = lazy(() => import('./KeyboardHelp').then((m) => ({ default: m.KeyboardHelp })))
const AboutModal = lazy(() => import('./AboutModal').then((m) => ({ default: m.AboutModal })))
const VersionsPanel = lazy(() => import('./VersionsPanel').then((m) => ({ default: m.VersionsPanel })))
const MarkdownPreview = lazy(() => import('./MarkdownPreview').then((m) => ({ default: m.MarkdownPreview })))
const ShareModal = lazy(() => import('./ShareModal').then((m) => ({ default: m.ShareModal })))
const AttachmentsPanel = lazy(() => import('./AttachmentsPanel').then((m) => ({ default: m.AttachmentsPanel })))
const LockModal = lazy(() => import('./LockModal').then((m) => ({ default: m.LockModal })))
const StatsDashboard = lazy(() => import('./StatsDashboard').then((m) => ({ default: m.StatsDashboard })))
const MindMap = lazy(() => import('./MindMap').then((m) => ({ default: m.MindMap })))
const MacrosModal = lazy(() => import('./MacrosModal').then((m) => ({ default: m.MacrosModal })))
const DiffModal = lazy(() => import('./DiffModal').then((m) => ({ default: m.DiffModal })))
const OcrModal = lazy(() => import('./OcrModal').then((m) => ({ default: m.OcrModal })))
const SnippetsModal = lazy(() => import('./SnippetsModal').then((m) => ({ default: m.SnippetsModal })))
const LinkCheckModal = lazy(() => import('./LinkCheckModal').then((m) => ({ default: m.LinkCheckModal })))
const AiChatPanel = lazy(() => import('./AiChatPanel').then((m) => ({ default: m.AiChatPanel })))
const FindReplaceBar = lazy(() => import('./FindReplaceBar').then((m) => ({ default: m.FindReplaceBar })))
const TypographyModal = lazy(() => import('./TypographyModal').then((m) => ({ default: m.TypographyModal })))
const InfoPanel = lazy(() => import('./InfoPanel').then((m) => ({ default: m.InfoPanel })))
const ActivityHeatmap = lazy(() => import('./ActivityHeatmap').then((m) => ({ default: m.ActivityHeatmap })))
const QuickCapture = lazy(() => import('./QuickCapture').then((m) => ({ default: m.QuickCapture })))
const TranslateModal = lazy(() => import('./TranslateModal').then((m) => ({ default: m.TranslateModal })))
const TemplatesModal = lazy(() => import('./TemplatesModal').then((m) => ({ default: m.TemplatesModal })))
const GistModal = lazy(() => import('./GistModal').then((m) => ({ default: m.GistModal })))
const WebBrowserModal = lazy(() => import('./WebBrowserModal').then((m) => ({ default: m.WebBrowserModal })))
const BusinessCardsModal = lazy(() => import('./BusinessCardsModal').then((m) => ({ default: m.BusinessCardsModal })))
const PageSettingsModal = lazy(() => import('./PageSettingsModal').then((m) => ({ default: m.PageSettingsModal })))
const MeetingNotesModal = lazy(() => import('./MeetingNotesModal').then((m) => ({ default: m.MeetingNotesModal })))
const CONTENT_COMMIT_DELAY_MS = 350

export function Editor({ sidebar }: { sidebar?: React.ReactNode }) {
  const { fileHandle, fileHandleMemoId, setFileHandle, setSavedAt, setEditor } = useDocStore()
  const { currentId, current, newMemo, updateCurrent, updateMemo, updateMemoPageSettings } = useMemosStore()
  const applyTheme = useThemeStore((s) => s.apply)
  const applyTypo = useTypographyStore((s) => s.apply)
  const aiAuto = useSettingsStore((s) => s.aiAutocomplete); void aiAuto
  const collab = useCollab()
  const memo = current()
  // 메모별 저장 시퀀스 — 전역 카운터면 다른 메모의 타이핑이 이 메모의 비동기 저장(이미지 외부화)을 무효화해버린다
  const contentSaveSeqByMemo = useRef<Record<string, number>>({})
  const activeMemoIdRef = useRef<string | null>(currentId)
  const pendingContentTimerRef = useRef<number | null>(null)
  const pendingContentEditorRef = useRef<TiptapEditor | null>(null)
  const pendingContentMemoIdRef = useRef<string | null>(null)
  const pendingContentSeqRef = useRef(0)
  const applyingMemoPageSettingsRef = useRef(false)
  const [showAi, setShowAi] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showRoles, setShowRoles] = useState(false)
  const [initialRoleTool, setInitialRoleTool] = useState<RoleToolId | null>(null)
  const [showPaper, setShowPaper] = useState(false)
  const [showPostit, setShowPostit] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showPaint, setShowPaint] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showOutline, setShowOutline] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showMd, setShowMd] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showAtt, setShowAtt] = useState(false)
  const [showLock, setShowLock] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showMindMap, setShowMindMap] = useState(false)
  const [showMacros, setShowMacros] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [showOcr, setShowOcr] = useState(false)
  const [showSnippets, setShowSnippets] = useState(false)
  const [showLinkCheck, setShowLinkCheck] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showFind, setShowFind] = useState(false)
  const [showTypo, setShowTypo] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showQuick, setShowQuick] = useState(false)
  const [settingsFocus, setSettingsFocus] = useState<'supabase' | 'byoc' | null>(null)
  const [showTranslate, setShowTranslate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showGist, setShowGist] = useState(false)
  const [showWeb, setShowWeb] = useState(false)
  const [showCards, setShowCards] = useState(false)
  const [showPageSettings, setShowPageSettings] = useState(false)
  const [showMeetingNotes, setShowMeetingNotes] = useState(false)
  const [meetingKind, setMeetingKind] = useState<MeetingKind>('meeting')
  const paperStyle = useUIStore((s) => s.paperStyle)
  const pageSize = useUIStore((s) => s.pageSize)
  const pageOrientation = useUIStore((s) => s.pageOrientation)
  const pageMarginMm = useUIStore((s) => s.pageMarginMm)
  const pageMarginsMm = useUIStore((s) => s.pageMarginsMm)
  const pageColumnCount = useUIStore((s) => s.pageColumnCount)
  const runningHeader = useUIStore((s) => s.runningHeader)
  const runningFooter = useUIStore((s) => s.runningFooter)
  const spellCheck = useUIStore((s) => s.spellCheck)
  const showRulers = useUIStore((s) => s.showRulers)
  const viewLayout = useUIStore((s) => s.viewLayout)

  const pageMm = useMemo(() => pageDimensions(pageSize, pageOrientation), [pageSize, pageOrientation])
  const pagePx = useMemo(() => pageDimensionsPx(pageSize, pageOrientation), [pageSize, pageOrientation])
  const pageMargins = useMemo(() => normalizePageMarginsMm(pageMarginsMm, pageMarginMm), [pageMarginsMm, pageMarginMm])
  const pageMarginPx = useMemo(() => {
    const mmToPx = (mm: number) => Math.round((mm * 96) / 25.4)
    return {
      top: mmToPx(pageMargins.top),
      right: mmToPx(pageMargins.right),
      bottom: mmToPx(pageMargins.bottom),
      left: mmToPx(pageMargins.left),
    }
  }, [pageMargins])
  const pageStyle = useMemo<CSSProperties>(() => ({
    '--jan-page-w': `${pageMm.widthMm}mm`,
    '--jan-page-h': `${pageMm.heightMm}mm`,
    '--jan-page-margin': `${pageMarginMm}mm`,
    '--jan-page-margin-top': `${pageMargins.top}mm`,
    '--jan-page-margin-right': `${pageMargins.right}mm`,
    '--jan-page-margin-bottom': `${pageMargins.bottom}mm`,
    '--jan-page-margin-left': `${pageMargins.left}mm`,
    '--jan-page-columns': pageColumnCount,
  } as CSSProperties), [pageMm.widthMm, pageMm.heightMm, pageMarginMm, pageMargins, pageColumnCount])
  const rulerMarks = useMemo(() => {
    const width = Math.max(1, Math.round(pageMm.widthMm))
    const marks: Array<{ mm: number; percent: number; major: boolean }> = []
    for (let mm = 0; mm <= width; mm += 10) {
      marks.push({ mm, percent: (mm / width) * 100, major: mm % 50 === 0 })
    }
    if (marks[marks.length - 1]?.mm !== width) {
      marks.push({ mm: width, percent: 100, major: true })
    }
    return marks
  }, [pageMm.widthMm])
  const verticalRulerMarks = useMemo(() => {
    const height = Math.max(1, Math.round(pageMm.heightMm))
    const marks: Array<{ mm: number; percent: number; major: boolean }> = []
    for (let mm = 0; mm <= height; mm += 10) {
      marks.push({ mm, percent: (mm / height) * 100, major: mm % 50 === 0 })
    }
    if (marks[marks.length - 1]?.mm !== height) {
      marks.push({ mm: height, percent: 100, major: true })
    }
    return marks
  }, [pageMm.heightMm])
  const leftMarginPercent = Math.min(100, Math.max(0, (pageMargins.left / pageMm.widthMm) * 100))
  const rightMarginPercent = Math.min(100, Math.max(0, (pageMargins.right / pageMm.widthMm) * 100))
  const topMarginPercent = Math.min(100, Math.max(0, (pageMargins.top / pageMm.heightMm) * 100))
  const bottomMarginPercent = Math.min(100, Math.max(0, (pageMargins.bottom / pageMm.heightMm) * 100))

  const initialContent = memo?.content || '<p></p>'
  const title = memo?.title || '새 메모'
  // tiptap-pagination-plus 는 {page} 만 치환하므로 {total} 은 span 으로 바꿔두고
  // 아래 MutationObserver effect 가 실제 페이지 수를 채운다.
  const paginationHeader = useMemo(() => runningHeader.replace(/\{total\}/g, '<span class="jan-total-pages"></span>'), [runningHeader])
  const paginationFooter = useMemo(() => runningFooter.replace(/\{total\}/g, '<span class="jan-total-pages"></span>'), [runningFooter])
  const runningHeaderPreview = useMemo(() => formatRunningText(runningHeader, 1, 1), [runningHeader])
  const runningFooterPreview = useMemo(() => {
    if (!runningHeader.trim() && runningFooter.trim() === DEFAULT_RUNNING_FOOTER) return ''
    return formatRunningText(runningFooter, 1, 1)
  }, [runningFooter, runningHeader])
  const hasRunningPreview = !!(runningHeaderPreview || runningFooterPreview)
  const shouldShowRulers = viewLayout === 'print' && showRulers

  const commitEditorContent = useCallback((targetEditor: TiptapEditor, memoId: string | null, seq: number) => {
    if (!memoId || targetEditor.isDestroyed) return

    const html = targetEditor.getHTML()
    if (html.includes('data:')) {
      externalizeLargeDataUrlsInHtml(html)
        .then((storedHtml) => {
          if (seq !== contentSaveSeqByMemo.current[memoId]) return
          updateMemo(memoId, { content: storedHtml })
          if (storedHtml !== html && activeMemoIdRef.current === memoId && !targetEditor.isDestroyed) {
            targetEditor.commands.setContent(storedHtml, { emitUpdate: false })
            resolveBlobRefsInElement(targetEditor.view.dom).catch(() => {})
          }
        })
        .catch(() => {
          if (seq === contentSaveSeqByMemo.current[memoId]) updateMemo(memoId, { content: html })
        })
      return
    }

    updateMemo(memoId, { content: html })
    if (activeMemoIdRef.current === memoId && html.includes('jan-blob://')) {
      resolveBlobRefsInElement(targetEditor.view.dom).catch(() => {})
    }
  }, [updateMemo])

  const flushPendingEditorContent = useCallback(() => {
    if (pendingContentTimerRef.current) {
      window.clearTimeout(pendingContentTimerRef.current)
      pendingContentTimerRef.current = null
    }

    const pendingEditor = pendingContentEditorRef.current
    const pendingMemoId = pendingContentMemoIdRef.current
    const pendingSeq = pendingContentSeqRef.current
    pendingContentEditorRef.current = null
    pendingContentMemoIdRef.current = null

    if (pendingEditor && pendingMemoId) commitEditorContent(pendingEditor, pendingMemoId, pendingSeq)
  }, [commitEditorContent])

  const scheduleEditorContentCommit = useCallback((targetEditor: TiptapEditor) => {
    const memoId = activeMemoIdRef.current
    if (!memoId) return

    const seq = (contentSaveSeqByMemo.current[memoId] = (contentSaveSeqByMemo.current[memoId] || 0) + 1)
    pendingContentEditorRef.current = targetEditor
    pendingContentMemoIdRef.current = memoId
    pendingContentSeqRef.current = seq

    if (pendingContentTimerRef.current) window.clearTimeout(pendingContentTimerRef.current)
    pendingContentTimerRef.current = window.setTimeout(flushPendingEditorContent, CONTENT_COMMIT_DELAY_MS)
  }, [flushPendingEditorContent])

  const editorExtensions = useMemo(() => {
    const base: AnyExtension[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        undoRedo: collab.ydoc ? false : undefined,
        link: false,
        horizontalRule: false,
        underline: false,
      }),
      PageBreak,
      NormalHorizontalRule,
      Placeholder.configure({
        placeholder: '여기에 메모를 적어보세요... (/ 슬래시 명령, F1 단축키)',
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      JanTableHeader,
      JanTableCell,
      Image,
      MathInline,
      Mermaid,
      MentionExt,
      Callout,
      Superscript,
      LockedContent,
      Embed,
      LinkCard,
      AudioNode,
      VideoNode,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      // 워드급 서식: 선택 영역 단위 글꼴/크기 + 문단 줄 간격 + 들여쓰기
      FontFamily,
      FontSize,
      Indent,
      Subscript,
      Color,
      SmartTypography,
      TextShadow,
      TaskList,
      TaskItem.configure({ nested: true }),
      PaginationPlus.configure({
        ...PAGE_SIZES.A4,
        ...pagePx,
        marginTop: pageMarginPx.top,
        marginBottom: pageMarginPx.bottom,
        marginLeft: pageMarginPx.left,
        marginRight: pageMarginPx.right,
        pageGap: 24,
        pageBreakBackground: 'var(--jan-bg)',
        pageGapBorderSize: 0,
        pageGapBorderColor: 'transparent',
        contentMarginTop: 0,
        contentMarginBottom: 0,
        headerLeft: paginationHeader,
        headerRight: '',
        footerLeft: '',
        footerRight: paginationFooter,
        customHeader: {},
        customFooter: {},
      }),
    ]
    if (collab.ydoc && collab.provider) {
      base.push(
        Collaboration.configure({ document: collab.ydoc }),
        CollaborationCursor.configure({ provider: collab.provider }),
      )
    }
    return base
  }, [collab.ydoc, collab.provider, pagePx, pageMarginPx, paginationHeader, paginationFooter])

  const editor = useEditor(
    {
      extensions: editorExtensions,
      content: collab.ydoc ? '' : initialContent,
      editorProps: {
        attributes: { class: 'ProseMirror', spellcheck: spellCheck ? 'true' : 'false' },
      },
      onUpdate: ({ editor, transaction }) => {
        scheduleEditorContentCommit(editor)
        let inserted = 0
        transaction.steps.forEach((step) => {
          const slice = (step as { slice?: { size?: number } }).slice
          if (slice?.size && slice.size > 0) inserted += slice.size
        })
        if (inserted > 0) useWritingGoalStore.getState().addChars(inserted)
      },
    },
    [editorExtensions, scheduleEditorContentCommit]
  )

  useEffect(() => {
    if (!editor) return
    editor.view.dom.setAttribute('spellcheck', spellCheck ? 'true' : 'false')
  }, [editor, spellCheck])

  useEffect(() => {
    if (!editor) return
    try {
      editor
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
      // PaginationPlus may not be ready during the first hydration frame.
    }
  }, [editor, pagePx.pageWidth, pagePx.pageHeight, pageMarginPx])

  useImageDropPaste(editor)
  useMacroExpansion(editor)
  useAiAutocomplete(editor, aiAuto)
  useHeadingAnchors(editor)
  useFormatPainter(editor)
  useCursorMemory(editor, currentId)
  useWheelZoom()
  useAutoSave(editor, title)

  // 머리말/꼬리말의 {total} 채우기 — 페이지 수가 바뀔 때마다 실제 값으로 갱신.
  // (같은 값이면 쓰지 않으므로 observer 가 자기 변경에 재귀하지 않는다)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const root = editor.view.dom
    const update = () => {
      const total = String(root.querySelectorAll('.rm-page-break').length || 1)
      root.querySelectorAll<HTMLElement>('.jan-total-pages').forEach((el) => {
        if (el.textContent !== total) el.textContent = total
      })
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [editor, paginationHeader, paginationFooter])

  const takeSnapshot = useVersionsStore((s) => s.takeSnapshot)
  const snapshotMemoId = memo?.id
  const snapshotMemoTitle = memo?.title || ''
  useEffect(() => {
    if (!editor || !snapshotMemoId) return
    const t = setInterval(() => {
      takeSnapshot(snapshotMemoId, snapshotMemoTitle, editor.getHTML())
    }, 60000)
    return () => clearInterval(t)
  }, [editor, snapshotMemoId, snapshotMemoTitle, takeSnapshot])

  useEffect(() => {
    if (editor) setEditor(editor)
    // dev 전용 디버그 핸들 (프로덕션 번들에서는 제거됨)
    if (import.meta.env.DEV && editor) (window as unknown as { __janEditor?: TiptapEditor }).__janEditor = editor
    applyTheme()
    applyTypo()
    tauriSyncOnBoot().catch(() => {})
    trackEvent('app_boot')
  }, [editor, setEditor, applyTheme, applyTypo])

  useEffect(() => {
    if (activeMemoIdRef.current !== currentId) {
      flushPendingEditorContent()
      activeMemoIdRef.current = currentId
    }
  }, [currentId, flushPendingEditorContent])

  useEffect(() => {
    if (!memo) return
    const memoPageSettings = normalizeMemoPageSettings(memo.pageSettings)
    const currentPageSettings = pageSettingsFromUi(useUIStore.getState())
    if (!sameMemoPageSettings(currentPageSettings, memoPageSettings)) {
      applyingMemoPageSettingsRef.current = true
      useUIStore.getState().applyPageSettings(memoPageSettings)
      applyingMemoPageSettingsRef.current = false
    }
    if (!memo.pageSettings) updateMemoPageSettings(memo.id, memoPageSettings)
  }, [currentId, memo, updateMemoPageSettings])

  useEffect(() => {
    return useUIStore.subscribe((state, previous) => {
      if (applyingMemoPageSettingsRef.current) return
      const next = pageSettingsFromUi(state)
      if (sameMemoPageSettings(next, pageSettingsFromUi(previous))) return
      const memoId = activeMemoIdRef.current
      if (!memoId) return
      updateMemoPageSettings(memoId, next)
    })
  }, [updateMemoPageSettings])

  useEffect(() => {
    const onPageHide = () => flushPendingEditorContent()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingEditorContent()
    }

    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      flushPendingEditorContent()
    }
  }, [flushPendingEditorContent])

  useEffect(() => {
    if (!editor || !memo) return
    if (collab.ydoc) return
    const cur = editor.getHTML()
    if (cur !== memo.content) {
      editor.commands.setContent(memo.content, { emitUpdate: false })
      resolveBlobRefsInElement(editor.view.dom).catch(() => {})
    }
  }, [currentId, editor, collab.ydoc, memo])

  useEffect(() => {
    if (!editor) return
    resolveBlobRefsInElement(editor.view.dom).catch(() => {})
  }, [editor, currentId, memo?.content])

  useEffect(() => {
    if (!editor) return
    const root = editor.view.dom
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const link = target?.closest?.('a[href^="indexeddb:"]') as HTMLAnchorElement | null
      if (!link) return
      event.preventDefault()
      const id = link.getAttribute('data-att') || link.getAttribute('href')?.replace(/^indexeddb:/, '') || ''
      if (!id) return
      const name = link.getAttribute('data-name') || link.textContent || undefined
      downloadAttachment(id, name).then((ok) => {
        if (!ok) alert('첨부파일을 찾을 수 없습니다.')
      }).catch(() => alert('첨부파일을 열 수 없습니다.'))
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const detach = installWordKeymap(editor, {
      onNew: handleNewMemo,
      onSave: handleSave,
      onOpen: handleOpen,
      onPrint: () => window.print(),
    })
    return detach
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, fileHandle, fileHandleMemoId, title, currentId])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && !e.shiftKey && !e.altKey && e.key === '/') {
        e.preventDefault(); setShowAi(true); trackEvent('open_ai')
      } else if (ctrl && !e.shiftKey && !e.altKey && e.key === ',') {
        e.preventDefault(); setShowSettings(true); trackEvent('open_settings')
      } else if (ctrl && e.altKey && !e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault(); setShowPrint(true); trackEvent('open_preview')
      } else if (ctrl && e.shiftKey && !e.altKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault(); setShowSearch(true); trackEvent('open_search')
      } else if (ctrl && e.shiftKey && !e.altKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault(); setShowQuick(true)
      } else if (ctrl && !e.shiftKey && !e.altKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault(); setShowFind(true)
      } else if (ctrl && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        // 명령 팔레트가 최근 메모에 표시하는 Ctrl+1~9 힌트와 같은 순서(목록 순)로 전환
        const memos = useMemosStore.getState().list()
        const idx = parseInt(e.key, 10) - 1
        if (memos[idx]) useMemosStore.getState().setCurrent(memos[idx].id)
      } else if (e.key === 'F3' && !e.shiftKey) {
        e.preventDefault(); setShowFind(true)
      } else if (e.key === 'F1' || (ctrl && e.shiftKey && e.key === '?')) {
        e.preventDefault(); setShowHelp(true); trackEvent('open_help')
      }
    }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [editor])

  useEffect(() => {
    const openRoles = (event: Event) => {
      const detail = (event as CustomEvent<{ toolId?: RoleToolId }>).detail
      setInitialRoleTool(detail?.toolId || null)
      setShowRoles(true)
    }
    window.addEventListener('jan-open-roles', openRoles)
    return () => window.removeEventListener('jan-open-roles', openRoles)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (localStorage.getItem('jan-v2-role-onboarded') === '1') return
        localStorage.setItem('jan-v2-role-onboarded', '1')
        setInitialRoleTool(null)
        setShowRoles(true)
      } catch {
        // localStorage can be blocked by privacy settings; skip onboarding then.
      }
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [])

  async function handleSave(saveAs = false) {
    if (!editor) return
    flushPendingEditorContent()
    const html = editor.getHTML()
    // saveAs: 항상 새 위치를 묻는다. 아니면 이 메모의 핸들이 있을 때만 재사용
    const ownHandle = saveAs || (fileHandleMemoId && fileHandleMemoId !== currentId) ? null : fileHandle
    const result = await saveToFile({ title, content: html, handle: ownHandle })
    if (result.ok) {
      setSavedAt(Date.now())
      if (result.handle) setFileHandle(result.handle, currentId)
      if (currentId) pushActiveSnapshot(currentId).catch(() => {})
      trackEvent('save_file')
      flash(result.handle ? '파일로 저장했습니다' : '파일을 다운로드했습니다')
      if (memo) dispatchWebhook({ type: 'memo-saved', memoId: memo.id, title: memo.title, charCount: editor.state.doc.textContent.length }).catch(() => {})
    } else if (result.error !== '취소됨') {
      flash('저장 실패: ' + result.error)
    }
  }

  async function handleOpen() {
    if (!editor) return
    flushPendingEditorContent()
    try {
      const result = await openFile()
      if (!result) return
      updateCurrent({ title: result.title, content: result.content })
      setFileHandle(result.handle ?? null, currentId)
      editor.commands.setContent(result.content)
      trackEvent('open_file')
    } catch (err) {
      alert('열기 실패: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  function handleNewMemo() {
    flushPendingEditorContent()
    const id = newMemo()
    setFileHandle(null)
    trackEvent('new_memo')
    if (id) pushActiveSnapshot(id).catch(() => {})
  }

  function openMeetingNotes(kind: MeetingKind) {
    setMeetingKind(kind)
    setShowMeetingNotes(true)
  }

  return (
    <div className="jan-editor-wrap">
      <AppHeader
        onAccount={() => { setSettingsFocus('supabase'); setShowSettings(true) }}
        onCmdPalette={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true }))}
        onSearch={() => setShowWeb(true)}
        onSyncSettings={() => { setSettingsFocus('byoc'); setShowSettings(true) }}
        onGlobalSearch={() => { setShowSearch(true); trackEvent('open_search') }}
        onCalendar={() => setShowQuick(true)}
        onOcr={() => setShowOcr(true)}
        onChat={() => setShowChat(true)}
        onShare={() => setShowShare(true)}
        onSettings={() => { setSettingsFocus(null); setShowSettings(true) }}
        onHelp={() => setShowHelp(true)}
        onAbout={() => setShowAbout(true)}
        onAi={() => setShowAi(true)}
        onPostit={() => setShowPostit(true)}
        onPaint={() => setShowPaint(true)}
        onRoles={() => { setInitialRoleTool(null); setShowRoles(true) }}
        onTemplates={() => setShowTemplates(true)}
        onCards={() => setShowCards(true)}
        onLectureNotes={() => openMeetingNotes('lecture')}
        onMeetingNotes={() => openMeetingNotes('meeting')}
      />
      <MemoTabs />
      <Toolbar
        editor={editor}
        onNewMemo={handleNewMemo}
        onSave={() => handleSave(false)}
        onSaveAs={() => handleSave(true)}
        onOpen={handleOpen}
        onPrintPreview={() => setShowPrint(true)}
        onAi={() => setShowAi(true)}
        onRoles={() => { setInitialRoleTool(null); setShowRoles(true) }}
        onPaper={() => setShowPaper(true)}
        onPostit={() => setShowPostit(true)}
        onPaint={() => setShowPaint(true)}
        onAbout={() => setShowAbout(true)}
        onVersions={() => setShowVersions(true)}
        onMdPreview={() => setShowMd(true)}
        onShare={() => setShowShare(true)}
        onAtt={() => setShowAtt(true)}
        onLock={() => setShowLock(true)}
        onStats={() => setShowStats(true)}
        onMindMap={() => setShowMindMap(true)}
        onMacros={() => setShowMacros(true)}
        onDiff={() => setShowDiff(true)}
        onSnippets={() => setShowSnippets(true)}
        onLinkCheck={() => setShowLinkCheck(true)}
        onFind={() => setShowFind(true)}
        onTypo={() => setShowTypo(true)}
        onInfo={() => setShowInfo(true)}
        onHeatmap={() => setShowHeatmap(true)}
        onQuick={() => setShowQuick(true)}
        onTranslate={() => setShowTranslate(true)}
        onTemplates={() => setShowTemplates(true)}
        onGist={() => setShowGist(true)}
        onOcr={() => setShowOcr(true)}
        onChat={() => setShowChat(true)}
        onSearch={() => setShowSearch(true)}
        onPageSettings={() => setShowPageSettings(true)}
        onLectureNotes={() => openMeetingNotes('lecture')}
        onMeetingNotes={() => openMeetingNotes('meeting')}
        onToggleOutline={() => setShowOutline((v) => !v)}
        outlineOpen={showOutline}
      />
      <TagsBar />
      <div className="jan-app-body">
        {sidebar}
        <div className={'jan-editor-main' + (showOutline ? ' has-outline' : '')}>
        {showOutline && <OutlinePanel editor={editor} />}
        <div
          className="jan-editor-pages"
          data-paper={paperStyle}
          data-page-size={pageSize}
          data-page-orientation={pageOrientation}
          data-page-columns={pageColumnCount}
          data-rulers={shouldShowRulers ? 'true' : 'false'}
          data-view-layout={viewLayout}
          style={pageStyle}
        >
          {shouldShowRulers && (
            <div className="jan-page-ruler" role="img" aria-label={`가로 페이지 눈금자 ${Math.round(pageMm.widthMm)}mm`}>
              <div className="jan-page-ruler-track" aria-hidden="true">
                {rulerMarks.map((mark) => (
                  <span
                    key={mark.mm}
                    className={'jan-page-ruler-tick' + (mark.major ? ' is-major' : '')}
                    style={{ left: `${mark.percent}%` }}
                  >
                    {mark.major && <em>{mark.mm}</em>}
                  </span>
                ))}
                <span
                  className="jan-page-ruler-margin jan-page-ruler-margin-left"
                  style={{ left: `${leftMarginPercent}%` }}
                >
                  <b>{pageMargins.left}mm</b>
                </span>
                <span
                  className="jan-page-ruler-margin jan-page-ruler-margin-right"
                  style={{ right: `${rightMarginPercent}%` }}
                >
                  <b>{pageMargins.right}mm</b>
                </span>
              </div>
            </div>
          )}
          <div className="jan-page-layout">
            {shouldShowRulers && (
              <div className="jan-page-vertical-ruler" role="img" aria-label={`세로 페이지 눈금자 ${Math.round(pageMm.heightMm)}mm`}>
                <div className="jan-page-vertical-ruler-track" aria-hidden="true">
                  {verticalRulerMarks.map((mark) => (
                    <span
                      key={mark.mm}
                      className={'jan-page-vertical-ruler-tick' + (mark.major ? ' is-major' : '')}
                      style={{ top: `${mark.percent}%` }}
                    >
                      {mark.major && <em>{mark.mm}</em>}
                    </span>
                  ))}
                  <span
                    className="jan-page-vertical-ruler-margin jan-page-vertical-ruler-margin-top"
                    style={{ top: `${topMarginPercent}%` }}
                  >
                    <b>{pageMargins.top}mm</b>
                  </span>
                  <span
                    className="jan-page-vertical-ruler-margin jan-page-vertical-ruler-margin-bottom"
                    style={{ bottom: `${bottomMarginPercent}%` }}
                  >
                    <b>{pageMargins.bottom}mm</b>
                  </span>
                </div>
              </div>
            )}
            <div className="jan-page-shell" data-has-running-preview={hasRunningPreview ? 'true' : 'false'}>
              <EditorContent editor={editor} />
              <div className="jan-page-margin-frame" aria-hidden="true" />
              {runningHeaderPreview && (
                <div className="jan-page-running jan-page-running-header" aria-label="편집 화면 머리글 미리보기">
                  {runningHeaderPreview}
                </div>
              )}
              {runningFooterPreview && (
                <div className="jan-page-running jan-page-running-footer" aria-label="편집 화면 꼬리말 미리보기">
                  {runningFooterPreview}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
      <StatusBar editor={editor} onPageSettings={() => setShowPageSettings(true)} onSettings={() => setShowSettings(true)} />
      <CommandPalette editor={editor} onAi={() => setShowAi(true)} onChat={() => setShowChat(true)} onSearch={() => setShowSearch(true)} onFind={() => setShowFind(true)} onOcr={() => setShowOcr(true)} onPaint={() => setShowPaint(true)} onPostit={() => setShowPostit(true)} onPaper={() => setShowPaper(true)} onRoles={() => { setInitialRoleTool(null); setShowRoles(true) }} onTemplates={() => setShowTemplates(true)} onSnippets={() => setShowSnippets(true)} onMacros={() => setShowMacros(true)} onTypo={() => setShowTypo(true)} onCalendar={() => setShowQuick(true)} onQuick={() => setShowQuick(true)} onMd={() => setShowMd(true)} onPrintPreview={() => setShowPrint(true)} onShare={() => setShowShare(true)} onGist={() => setShowGist(true)} onAtt={() => setShowAtt(true)} onLock={() => setShowLock(true)} onSettings={() => setShowSettings(true)} onHelp={() => setShowHelp(true)} onAbout={() => setShowAbout(true)} onStats={() => setShowStats(true)} onMindMap={() => setShowMindMap(true)} onHeatmap={() => setShowHeatmap(true)} onInfo={() => setShowInfo(true)} onDiff={() => setShowDiff(true)} onLinkCheck={() => setShowLinkCheck(true)} onTranslate={() => setShowTranslate(true)} onVersions={() => setShowVersions(true)} onCards={() => setShowCards(true)} onPageSettings={() => setShowPageSettings(true)} onToggleOutline={() => setShowOutline((v) => !v)} onSave={handleSave} onOpen={handleOpen} />
      <SlashMenu editor={editor} />
      <TableMenu editor={editor} />
      <BubbleToolbar editor={editor} />
      <ImageMenu editor={editor} />
      <Suspense fallback={<ModalSkeleton />}>
        {showAi && <AiHelper editor={editor} onClose={() => setShowAi(false)} />}
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} focusSection={settingsFocus} />}
        {showPrint && editor && <PrintPreview html={editor.getHTML()} title={title} onClose={() => setShowPrint(false)} />}
        {showRoles && <RolesPanel editor={editor} initialTool={initialRoleTool} onClose={() => { setShowRoles(false); setInitialRoleTool(null) }} />}
        {showPaper && <PaperPanel editor={editor} onClose={() => setShowPaper(false)} />}
        {showPostit && <PostitPanel onClose={() => setShowPostit(false)} />}
        {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}
        {showPaint && <PaintCanvas editor={editor} onClose={() => setShowPaint(false)} />}
        {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
        {showVersions && <VersionsPanel onClose={() => setShowVersions(false)} />}
        {showMd && <MarkdownPreview editor={editor} onClose={() => setShowMd(false)} />}
        {showShare && <ShareModal onClose={() => setShowShare(false)} />}
        {showAtt && <AttachmentsPanel editor={editor} onClose={() => setShowAtt(false)} />}
        {showLock && <LockModal editor={editor} onClose={() => setShowLock(false)} />}
        {showStats && <StatsDashboard onClose={() => setShowStats(false)} />}
        {showMindMap && <MindMap editor={editor} onClose={() => setShowMindMap(false)} />}
        {showMacros && <MacrosModal onClose={() => setShowMacros(false)} />}
        {showDiff && <DiffModal onClose={() => setShowDiff(false)} />}
        {showOcr && <OcrModal editor={editor} onClose={() => setShowOcr(false)} />}
        {showSnippets && <SnippetsModal editor={editor} onClose={() => setShowSnippets(false)} />}
        {showLinkCheck && <LinkCheckModal editor={editor} onClose={() => setShowLinkCheck(false)} />}
        {showChat && <AiChatPanel editor={editor} onClose={() => setShowChat(false)} />}
        {showFind && <FindReplaceBar editor={editor} onClose={() => setShowFind(false)} />}
        {showTypo && <TypographyModal onClose={() => setShowTypo(false)} />}
        {showInfo && <InfoPanel editor={editor} onClose={() => setShowInfo(false)} />}
        {showHeatmap && <ActivityHeatmap onClose={() => setShowHeatmap(false)} />}
        {showQuick && <QuickCapture onClose={() => setShowQuick(false)} />}
        {showTranslate && <TranslateModal editor={editor} onClose={() => setShowTranslate(false)} />}
        {showTemplates && <TemplatesModal editor={editor} onClose={() => setShowTemplates(false)} />}
        {showGist && <GistModal editor={editor} onClose={() => setShowGist(false)} />}
        {showWeb && <WebBrowserModal editor={editor} onClose={() => setShowWeb(false)} />}
        {showCards && <BusinessCardsModal editor={editor} onClose={() => setShowCards(false)} />}
        {showPageSettings && <PageSettingsModal onClose={() => setShowPageSettings(false)} />}
        {showMeetingNotes && <MeetingNotesModal editor={editor} initialKind={meetingKind} onClose={() => setShowMeetingNotes(false)} />}
      </Suspense>
      <Lightbox />
    </div>
  )
}

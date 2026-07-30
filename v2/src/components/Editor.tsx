import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { AnyExtension } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { JanTableCell, JanTableHeader, TablePlacement, TableFormulaAuto } from '../extensions/TableCellExt'
import { TableKeymap } from '../extensions/TableKeymap'
import { CellPickEdge } from '../extensions/CellPickEdge'
import { TablePen } from '../extensions/TablePen'
import { ImageObject as Image } from '../extensions/ImageObject'
import { ImageKeymap } from '../extensions/ImageKeymap'
import { ShapeObject } from '../extensions/ShapeObject'
import { ChartObject } from '../extensions/ChartObject'
import { SmartArtObject } from '../extensions/SmartArtObject'
import { SignatureObject } from '../extensions/SignatureObject'
import { CrossRef } from '../extensions/CrossRef'
import { RefTargets } from '../extensions/RefTargets'
import { FieldBlocks } from '../extensions/FieldBlocks'
import { AuthorityMark, IndexMark } from '../extensions/RefMarks'
import { DeleteMark, InsertMark, TrackChanges } from '../extensions/TrackChanges'
import { EditGuard } from '../extensions/EditGuard'
import { applyDesign, watermarkSvgOf } from '../lib/docDesign'
import { DesignPanel } from './DesignPanel'
import { Model3D } from '../extensions/Model3D'
import { CharOverlap, DropCapAttr, EmphasisDot, RubyText } from '../extensions/TextObjects'
import { ListStyles } from '../extensions/ListStyles'
import { CommentMark, FieldInput } from '../extensions/CommentField'
import { PaginationPlus, PAGE_SIZES } from 'tiptap-pagination-plus'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useCallback, useEffect, useState, lazy, Suspense, useMemo, useRef, type CSSProperties } from 'react'
import { Toolbar } from './Toolbar'
import { AppHeader, HeaderLeading } from './AppHeader'
import { MemoTabs } from './MemoTabs'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { TagsBar } from './TagsBar'
import { OutlinePanel } from './OutlinePanel'
import { SlashMenu } from './SlashMenu'
import { TableHandles } from './TableHandles'
import { TableContextMenu } from './TableContextMenu'
import { BubbleToolbar } from './BubbleToolbar'
import { ImageMenu } from './ImageMenu'
import { ImageHandles } from './ImageHandles'
import { ImageContextMenu } from './ImageContextMenu'
import { ImageDialog } from './ImageDialog'
import { ShapePanel } from './ShapePanel'
import { ChartPanel } from './ChartPanel'
import { SmartArtPanel } from './SmartArtPanel'
import { SignaturePanel } from './SignaturePanel'
import { CrossRefPanel } from './CrossRefPanel'
import { SourcePanel } from './SourcePanel'
import { SymbolPanel } from './SymbolPanel'
import { ObjectPane } from './ObjectPane'
import { ObjectBar } from './ObjectBar'
import { TableFormatPanel } from './TableFormatPanel'
import { CommentPane } from './CommentPane'
import { ReviewPane } from './ReviewPane'
import { AccessibilityPanel } from './AccessibilityPanel'
import { WordSuggestPanel, type SuggestMode } from './WordSuggestPanel'
import { ProtectPanel } from './ProtectPanel'
import { CountPanel } from './CountPanel'
import { ImageConvertPanel } from './ImageConvertPanel'
import { PostitReopen } from './PostitReopen'
import { applyTrackView } from '../lib/trackChanges'
import { activateProtect } from '../lib/docProtect'
import { ModalSkeleton } from './ModalSkeleton'
import { useDocStore } from '../store/docStore'
import { useMemosStore } from '../store/memosStore'
import { useThemeStore } from '../store/themeStore'
import { saveToFile, openFile } from '../lib/fileOps'
import type { OpenFileResult } from '../lib/fileOps'
import { onLaunchWithFile } from '../lib/launchFiles'
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
import { CharFormat } from '../extensions/CharFormat'
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
  DEFAULT_MEMO_PAGE_SETTINGS,
  effectiveMarginsMm,
  formatPageNumber,
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
import { PaperTag, PaperBlockAttrs } from '../extensions/PaperTag'
import { CurrentParaHighlight } from '../extensions/CurrentParaHighlight'
import { PageDoc, PageNode, PageReflow, ContinuedAttr, getSavableHtml, PAGE_NODE_NAME } from '../extensions/PageDocument'
import { HorizontalRuler, VerticalRulers } from './PageRulers'
import { PageThumbnailPanel } from './PageThumbnailPanel'
import { SplitEditorPane } from './SplitEditorPane'
import { PageSpreadView } from './PageSpreadView'
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
const TrashModal = lazy(() => import('./TrashModal').then((m) => ({ default: m.TrashModal })))
const CONTENT_COMMIT_DELAY_MS = 350

export function Editor({ sidebar }: { sidebar?: React.ReactNode }) {
  const { fileHandle, fileHandleMemoId, setFileHandle, setSavedAt, setEditor } = useDocStore()
  const { currentId, current, newMemo, updateMemo, updateMemoPageSettings } = useMemosStore()
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
  // 문서 이미지 주석 편집 (그림판에서 열기)
  const [paintEdit, setPaintEdit] = useState<{ src: string; pos: number } | null>(null)
  /* 그림 속성 대화상자 — 단축키(Alt+P 등)와 상황 메뉴가 어느 갈피를 열지 알려 준다 */
  const [imgDialog, setImgDialog] = useState<string | null>(null)
  /* 도형 갤러리·도형 서식 — 넣을 때와 고칠 때 같은 창을 쓴다 */
  const [shapePanel, setShapePanel] = useState<'insert' | 'format' | null>(null)
  const [chartPanel, setChartPanel] = useState<'insert' | 'edit' | null>(null)
  const [smartPanel, setSmartPanel] = useState<'insert' | 'edit' | null>(null)
  const [signPanel, setSignPanel] = useState<'insert' | 'sign' | null>(null)
  const [xrefPanel, setXrefPanel] = useState(false)
  const [designPanel, setDesignPanel] = useState<'styles' | 'background' | null>(null)
  const [sourcePanel, setSourcePanel] = useState(false)
  /* 문자표와 개체 목록 — 워드의 「기호」 대화상자와 「선택 창(Alt+F10)」 */
  const [showSymbols, setShowSymbols] = useState(false)
  const [showObjects, setShowObjects] = useState(false)
  /* 메모 목록 — 워드에서 문서 옆에 뜨는 메모 자리 */
  const [showComments, setShowComments] = useState(false)
  /* 검수 탭이 여는 창들 — 검토 창 · 접근성 · 낱말 바꾸기 · 편집 제한 · 단어 개수 */
  const [showReview, setShowReview] = useState(false)
  const [showA11y, setShowA11y] = useState(false)
  const [suggest, setSuggest] = useState<SuggestMode | null>(null)
  const [showProtect, setShowProtect] = useState(false)
  const [showCount, setShowCount] = useState(false)
  /* 이미지 변환 — 도구 탭에서 연다 (예전에는 물음 창 세 번이었다) */
  const [showImgConv, setShowImgConv] = useState(false)
  /* 표 서식 창 — 테두리·채우기·맞춤 */
  const [tableFormat, setTableFormat] = useState<string | null>(null)
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
  const [showTrash, setShowTrash] = useState(false)
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
  const typewriterMode = useUIStore((s) => s.typewriterMode)
  const paragraphFocus = useUIStore((s) => s.paragraphFocus)

  const customPageWidthMm = useUIStore((s) => s.customPageWidthMm)
  const customPageHeightMm = useUIStore((s) => s.customPageHeightMm)
  const gutterMm = useUIStore((s) => s.gutterMm)
  const gutterPosition = useUIStore((s) => s.gutterPosition)
  const pageNumberFormat = useUIStore((s) => s.pageNumberFormat)
  const pageNumberStart = useUIStore((s) => s.pageNumberStart)
  const firstPageRunningOff = useUIStore((s) => s.firstPageRunningOff)
  const watermarkText = useUIStore((s) => s.watermarkText)
  const design = useUIStore((s) => s.design)
  /* 디자인 탭에서 정한 워터마크가 먼저다 — 없으면 예전 「워터마크 글」 을 쓴다 */
  const mark = useMemo(() => ({
    ...design.watermark,
    text: design.watermark.text || watermarkText,
  }), [design.watermark, watermarkText])

  const customMm = useMemo(() => ({ widthMm: customPageWidthMm, heightMm: customPageHeightMm }), [customPageWidthMm, customPageHeightMm])
  const pageMm = useMemo(() => pageDimensions(pageSize, pageOrientation, customMm), [pageSize, pageOrientation, customMm])
  const pagePx = useMemo(() => pageDimensionsPx(pageSize, pageOrientation, customMm), [pageSize, pageOrientation, customMm])
  const pageMargins = useMemo(
    () => effectiveMarginsMm(normalizePageMarginsMm(pageMarginsMm, pageMarginMm), gutterMm, gutterPosition),
    [pageMarginsMm, pageMarginMm, gutterMm, gutterPosition]
  )
  const pageMarginPx = useMemo(() => {
    const mmToPx = (mm: number) => Math.round((mm * 96) / 25.4)
    return {
      top: mmToPx(pageMargins.top),
      right: mmToPx(pageMargins.right),
      bottom: mmToPx(pageMargins.bottom),
      left: mmToPx(pageMargins.left),
    }
  }, [pageMargins])
  // 쪽 나란히 편집의 열 수 — pageStyle 이 CSS 변수로 넘긴다 (선언 순서상 여기서 읽는다)
  const spreadColsForStyle = useUIStore((s) => s.spreadCols) || 2
  const pageStyle = useMemo<CSSProperties>(() => ({
    '--jan-page-w': `${pageMm.widthMm}mm`,
    '--jan-page-h': `${pageMm.heightMm}mm`,
    '--jan-page-margin': `${pageMarginMm}mm`,
    '--jan-page-margin-top': `${pageMargins.top}mm`,
    '--jan-page-margin-right': `${pageMargins.right}mm`,
    '--jan-page-margin-bottom': `${pageMargins.bottom}mm`,
    '--jan-page-margin-left': `${pageMargins.left}mm`,
    '--jan-page-columns': pageColumnCount,
    // 쪽 나란히 편집에서 한 줄에 놓을 용지 수 (독립 페이지 모델 CSS 가 사용)
    '--jan-spread-cols': spreadColsForStyle,
  } as CSSProperties), [pageMm.widthMm, pageMm.heightMm, pageMarginMm, pageMargins, pageColumnCount, spreadColsForStyle])
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
  const pageModel = useUIStore((s) => s.pageModel)
  /* 독립 페이지 모델은 다단도 쪽으로 나눈다 — 단을 용지 안에서 흘리고,
     리플로우가 '단을 이어 붙인 좌표'로 재서 넘치는 만큼 다음 쪽으로 옮긴다.
     옛 PaginationPlus 는 float 기반이라 CSS 다단과 공존할 수 없어 1단에서만 켠다. */
  const paginationEnabled = viewLayout === 'print' && (pageModel === 'nodes' || pageColumnCount === 1)
  // 화면상 페이지 반복 주기 (페이지 높이 + 갭 32 + 머리/꼬리글 렌더 오차) — 워터마크 반복 배경용
  const pageRhythmPx = pagePx.pageHeight + 32 + 6
  // 쪽모음 패널 — 편집과 공존하는 페이지 축소판 (여러쪽보기 재설계: 오버레이 → 사이드 패널)
  const editorZoom = useUIStore((s) => s.zoom)
  const pageThumbs = useUIStore((s) => s.pageThumbs)
  const showPageThumbs = paginationEnabled && pageThumbs
  const splitView = useUIStore((s) => s.splitView)
  const splitDir = useUIStore((s) => s.splitDir)
  const splitRatio = useUIStore((s) => s.splitRatio)
  const spreadCols = useUIStore((s) => s.spreadCols)
  const showSpread = paginationEnabled && spreadCols > 0
  // 줌을 50% 이하로 "내리는 순간" 자동으로 쪽모음을 연다 (수동으로 닫으면 존중)
  const prevZoomRef = useRef(editorZoom)
  useEffect(() => {
    const prev = prevZoomRef.current
    prevZoomRef.current = editorZoom
    if (editorZoom <= 0.5 && prev > 0.5) useUIStore.getState().setPageThumbs(true)
  }, [editorZoom])

  const commitEditorContent = useCallback((targetEditor: TiptapEditor, memoId: string | null, seq: number) => {
    if (!memoId || targetEditor.isDestroyed) return

    // 독립 페이지 모델에서는 용지 래퍼를 벗겨 기존 저장 형식(평면 HTML)을 유지한다
    const html = getSavableHtml(targetEditor)
    if (html.includes('data:')) {
      externalizeLargeDataUrlsInHtml(html)
        .then((storedHtml) => {
          if (seq !== contentSaveSeqByMemo.current[memoId]) return
          updateMemo(memoId, { content: storedHtml })
          if (storedHtml !== html && activeMemoIdRef.current === memoId && !targetEditor.isDestroyed) {
            /* 저장 뒤 되돌려 넣는 것 — 사람이 고친 게 아니니 변경 표시를 남기지 않는다 */
            targetEditor.chain().setMeta('janTrackSkip', true).setContent(storedHtml, { emitUpdate: false }).run()
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

  // history:false 는 분할 편집 보조 창용 — 실행취소를 메인 히스토리로 일원화하기 위해
  // 보조에는 undoRedo 를 아예 빼고, CollaborationCursor(원격 커서 브로드캐스트)도 메인만 단다.
  const usePageNodes = pageModel === 'nodes' && paginationEnabled
  // CSS 다단 모드 — 브라우저가 줄 단위로 페이지를 나누므로 확장이 전혀 필요 없다
  const useColumnPages = pageModel === 'columns' && paginationEnabled
  const buildExtensions = useCallback((opts: { history: boolean }) => {
    const base: AnyExtension[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        undoRedo: !opts.history || collab.ydoc ? false : undefined,
        link: false,
        horizontalRule: false,
        underline: false,
        // 독립 페이지 모델은 최상위를 page+ 로 바꾼 자체 doc 을 쓴다
        ...(usePageNodes ? { document: false } : {}),
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
      TablePlacement,
      TableFormulaAuto,
      TableKeymap,
      CellPickEdge,
      TablePen,
      TableRow,
      JanTableHeader,
      JanTableCell,
      /* base64 이미지를 파싱에서 받아들인다 — 기본값(allowBase64:false)이면 저장본을 다시 열 때
         data: 그림이 통째로 사라진다. 큰 그림만 blob 참조로 빠지고 작은 그림은 data: 로 남기 때문. */
      Image.configure({ allowBase64: true }),
      ImageKeymap,
      ShapeObject,
      ChartObject,
      SmartArtObject,
      SignatureObject,
      CrossRef,
      RefTargets,
      FieldBlocks,
      IndexMark,
      AuthorityMark,
      InsertMark,
      DeleteMark,
      TrackChanges,
      EditGuard,
      Model3D,
      DropCapAttr,
      ListStyles,
      RubyText,
      EmphasisDot,
      CharOverlap,
      CommentMark,
      FieldInput,
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
      CharFormat,
      Subscript,
      Color,
      SmartTypography,
      TextShadow,
      TaskList,
      TaskItem.configure({ nested: true }),
      PaperTag,
      CurrentParaHighlight,
      PaperBlockAttrs,
    ]
    // 독립 페이지 모델 — 용지마다 실제 page 노드 + 자동 리플로우 (PaginationPlus 대체)
    if (usePageNodes) {
      base.push(
        PageDoc,
        PageNode,
        ContinuedAttr,
        PageReflow.configure({
          getContentHeight: () =>
            pagePx.pageHeight - pageMarginPx.top - pageMarginPx.bottom,
        }),
      )
      return base
    }
    // CSS 다단 모드는 브라우저가 페이지 흐름을 담당한다 — 어떤 페이지 확장도 넣지 않는다
    if (useColumnPages) return base
    // 페이지 분할(PaginationPlus)은 float 기반이라 CSS 다단(column)과 공존 불가
    // — 다단(2/3단)·초안 보기에서는 연속 시트로 표시하고, 1단 인쇄 보기에서만 켠다.
    if (paginationEnabled) {
      base.push(
        PaginationPlus.configure({
          ...PAGE_SIZES.A4,
          ...pagePx,
          marginTop: pageMarginPx.top,
          marginBottom: pageMarginPx.bottom,
          marginLeft: pageMarginPx.left,
          marginRight: pageMarginPx.right,
          pageGap: 32,
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
      )
    }
    if (collab.ydoc && collab.provider) {
      base.push(Collaboration.configure({ document: collab.ydoc }))
      if (opts.history) base.push(CollaborationCursor.configure({ provider: collab.provider }))
    }
    return base
  }, [collab.ydoc, collab.provider, pagePx, pageMarginPx, paginationHeader, paginationFooter, paginationEnabled, usePageNodes, useColumnPages])

  const editorExtensions = useMemo(() => buildExtensions({ history: true }), [buildExtensions])
  // 창 나누기·쪽 나란히 편집이 켜졌을 때만 보조용 확장을 생성 (히스토리 없음)
  const splitExtensions = useMemo(
    () => (splitView || spreadCols > 0 ? buildExtensions({ history: false }) : null),
    [buildExtensions, splitView, spreadCols]
  )

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

  /* 세로 눈금자를 쪽마다 하나씩 놓기 위해 현재 쪽 수를 따라간다 (독립 페이지 모델) */
  const [pageCount, setPageCount] = useState(1)
  useEffect(() => {
    // 쪽 노드 모델이 아니면 세지 않는다 — 쓰는 자리에서 1 로 본다
    if (!editor || !usePageNodes) return
    const read = () => {
      let n = 0
      editor.state.doc.forEach((node) => {
        if (node.type.name === PAGE_NODE_NAME) n++
      })
      setPageCount((prev) => (prev === (n || 1) ? prev : n || 1))
    }
    read()
    editor.on('transaction', read)
    return () => {
      editor.off('transaction', read)
    }
  }, [editor, usePageNodes])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.view.dom.setAttribute('spellcheck', spellCheck ? 'true' : 'false')
  }, [editor, spellCheck])

  /* 그림 속성 대화상자 열기 · 그림 바꾸기 — 단축키·리본·상황 메뉴가 함께 쓴다 */
  useEffect(() => {
    if (!editor) return
    const onDialog = (e: Event) => setImgDialog((e as CustomEvent<{ tab?: string }>).detail?.tab || 'size')
    const onReplace = () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          import('../lib/imageWord').then((m) => m.replaceImage(editor, String(reader.result || '')))
        }
        reader.readAsDataURL(file)
      }
      input.click()
    }
    const onShape = (e: Event) => setShapePanel((e as CustomEvent<{ mode?: 'insert' | 'format' }>).detail?.mode || 'insert')
    const onChart = (e: Event) => setChartPanel((e as CustomEvent<{ mode?: 'insert' | 'edit' }>).detail?.mode || 'insert')
    const onSmart = (e: Event) => setSmartPanel((e as CustomEvent<{ mode?: 'insert' | 'edit' }>).detail?.mode || 'insert')
    const onSign = (e: Event) => setSignPanel((e as CustomEvent<{ mode?: 'insert' | 'sign' }>).detail?.mode || 'insert')
    const onXref = () => setXrefPanel(true)
    const onDesign = (e: Event) => setDesignPanel((e as CustomEvent<{ tab?: 'styles' | 'background' }>).detail?.tab || 'styles')
    const onSources = () => setSourcePanel(true)
    const onSymbols = () => setShowSymbols(true)
    const onObjects = () => setShowObjects((v) => !v)
    /* 개체 목록은 워드와 같은 자리(Alt+F10)에서 열고 닫는다 */
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'F10') { e.preventDefault(); setShowObjects((v) => !v); return }
      /* 워드와 같은 자리 — 고른 글에 메모를 단다 */
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) {
        e.preventDefault()
        const { from, to } = editor.state.selection
        if (from === to) { import('../lib/flash').then((m) => m.flash('메모를 달 글을 먼저 고른다')); return }
        const text = window.prompt('메모 — 이 자리에 남길 말')
        if (text) {
          import('../lib/commentField').then((m) => { m.addComment(editor, text); setShowComments(true) })
        }
      }
    }
    const onComments = () => setShowComments((v) => !v)
    const onReview = () => setShowReview((v) => !v)
    const onA11y = () => setShowA11y(true)
    const onSuggest = (e: Event) => setSuggest((e as CustomEvent<{ mode?: SuggestMode }>).detail?.mode || 'synonym')
    const onProtect = () => setShowProtect(true)
    const onCount = () => setShowCount(true)
    const onImgConv = () => setShowImgConv(true)
    const onTableFormat = (e: Event) => setTableFormat((e as CustomEvent<{ tab?: string }>).detail?.tab || 'border')
    /* 눈금선 보기 — 테두리가 없는 표에도 흐린 안내선을 보여 준다 (워드와 같다) */
    const onGridlines = () => {
      const on = document.body.classList.toggle('jan-table-gridlines')
      import('../lib/flash').then((m) => m.flash(on ? '눈금선을 켰다 — 인쇄에는 나오지 않는다' : '눈금선을 껐다'))
    }
    window.addEventListener('jan-table-gridlines', onGridlines)
    window.addEventListener('jan-table-format', onTableFormat)
    /* 누름틀을 누르면 그 자리에 바로 쓴다 (한글과 같은 느낌).
       편집기 DOM 이 아직 없을 수도 있어 문서에 붙이고 안에서 살핀다 —
       editor.view 를 붙일 때 건드리면 아직 안 붙은 순간에 터진다. */
    const onFieldClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('.ProseMirror .jan-field') as HTMLElement | null
      if (!el || editor.isDestroyed) return
      e.preventDefault()
      let pos: number
      try {
        pos = editor.view.posAtDOM(el, 0)
      } catch { return }
      if (pos == null || pos < 0) return
      const node = editor.state.doc.nodeAt(pos)
      if (!node || node.type.name !== 'janField') return
      const value = window.prompt(node.attrs.memo || node.attrs.guide || '내용', String(node.attrs.value || ''))
      if (value == null) return
      import('../lib/commentField').then((m) => m.fillField(editor, pos, value))
    }
    document.addEventListener('click', onFieldClick, true)
    window.addEventListener('jan-comment-pane', onComments)
    window.addEventListener('jan-review-pane', onReview)
    window.addEventListener('jan-a11y-panel', onA11y)
    window.addEventListener('jan-word-suggest', onSuggest)
    window.addEventListener('jan-protect-panel', onProtect)
    window.addEventListener('jan-count-panel', onCount)
    window.addEventListener('jan-image-convert', onImgConv)
    window.addEventListener('jan-symbol-panel', onSymbols)
    window.addEventListener('jan-object-pane', onObjects)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('jan-image-dialog', onDialog)
    window.addEventListener('jan-image-replace', onReplace)
    window.addEventListener('jan-shape-dialog', onShape)
    window.addEventListener('jan-chart-dialog', onChart)
    window.addEventListener('jan-smart-dialog', onSmart)
    window.addEventListener('jan-signature-dialog', onSign)
    window.addEventListener('jan-xref-dialog', onXref)
    window.addEventListener('jan-design-dialog', onDesign)
    window.addEventListener('jan-source-dialog', onSources)
    return () => {
      window.removeEventListener('jan-image-dialog', onDialog)
      window.removeEventListener('jan-image-replace', onReplace)
      window.removeEventListener('jan-shape-dialog', onShape)
      window.removeEventListener('jan-chart-dialog', onChart)
      window.removeEventListener('jan-smart-dialog', onSmart)
      window.removeEventListener('jan-signature-dialog', onSign)
      window.removeEventListener('jan-xref-dialog', onXref)
      window.removeEventListener('jan-design-dialog', onDesign)
      window.removeEventListener('jan-source-dialog', onSources)
      window.removeEventListener('jan-symbol-panel', onSymbols)
      window.removeEventListener('jan-object-pane', onObjects)
      window.removeEventListener('jan-comment-pane', onComments)
      window.removeEventListener('jan-review-pane', onReview)
      window.removeEventListener('jan-a11y-panel', onA11y)
      window.removeEventListener('jan-word-suggest', onSuggest)
      window.removeEventListener('jan-protect-panel', onProtect)
      window.removeEventListener('jan-count-panel', onCount)
      window.removeEventListener('jan-image-convert', onImgConv)
      window.removeEventListener('jan-table-format', onTableFormat)
      window.removeEventListener('jan-table-gridlines', onGridlines)
      document.removeEventListener('click', onFieldClick, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [editor])

  // 이미지 "그림판에서 편집" 이벤트 수신 → 주석 편집 모달
  useEffect(() => {
    const onEdit = (e: Event) => {
      const { src, pos } = (e as CustomEvent<{ src: string; pos: number }>).detail
      if (src) setPaintEdit({ src, pos })
    }
    window.addEventListener('jan-edit-image-in-paint', onEdit)
    return () => window.removeEventListener('jan-edit-image-in-paint', onEdit)
  }, [])

  // 타자기 모드 — 커서 줄을 스크롤 컨테이너(.jan-editor-main) 중앙에 유지
  useEffect(() => {
    document.body.classList.toggle('jan-typewriter', typewriterMode)
    if (!editor || !typewriterMode) return
    const center = () => {
      try {
        const scroller = document.querySelector('.jan-editor-main')
        if (!scroller) return
        const coords = editor.view.coordsAtPos(editor.state.selection.head)
        const rect = scroller.getBoundingClientRect()
        const delta = coords.top - (rect.top + rect.height / 2)
        if (Math.abs(delta) > 4) scroller.scrollBy({ top: delta, behavior: 'auto' })
      } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
    }
    editor.on('selectionUpdate', center)
    editor.on('update', center)
    center()
    return () => {
      editor.off('selectionUpdate', center)
      editor.off('update', center)
    }
  }, [editor, typewriterMode])

  // 현재 문단 하이라이트 — 실제 강조는 CurrentParaHighlight 확장(PM node decoration)이 담당.
  // 여기서는 body 클래스 토글 + 빈 트랜잭션 디스패치로 데코레이션 재계산만 유발한다.
  useEffect(() => {
    document.body.classList.toggle('jan-para-focus', paragraphFocus)
    if (!editor) return
    try { editor.view.dispatch(editor.state.tr) } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
  }, [editor, paragraphFocus])

  useEffect(() => {
    if (!editor || !paginationEnabled) return
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
  }, [editor, paginationEnabled, pagePx.pageWidth, pagePx.pageHeight, pageMarginPx])

  useImageDropPaste(editor)
  useMacroExpansion(editor)
  useAiAutocomplete(editor, aiAuto)
  useHeadingAnchors(editor)
  useFormatPainter(editor)
  useCursorMemory(editor, currentId)
  useWheelZoom()
  useAutoSave(editor, title)

  // 머리말/꼬리말의 {total} 채우기 + 페이지 시작 번호(counter-reset) 적용.
  // (같은 값이면 쓰지 않으므로 observer 가 자기 변경에 재귀하지 않는다)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const root = editor.view.dom
    const counterReset = `page-number ${pageNumberStart - 1} page-number-plus ${pageNumberStart}`
    const update = () => {
      const pageCount = root.querySelectorAll('.rm-page-break').length || 1
      // 시작 번호를 반영한 마지막 페이지 번호를 형식에 맞춰 표시
      const total = formatPageNumber(pageCount + pageNumberStart - 1, pageNumberFormat)
      root.querySelectorAll<HTMLElement>('.jan-total-pages').forEach((el) => {
        if (el.textContent !== total) el.textContent = total
      })
      if (root.style.counterReset !== counterReset) root.style.counterReset = counterReset
      // 첫 페이지 머리글 위젯은 자체 counter-reset 스코프를 가지므로 함께 갱신
      root.querySelectorAll<HTMLElement>('.rm-first-page-header').forEach((el) => {
        if (el.style.counterReset !== counterReset) el.style.counterReset = counterReset
      })
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [editor, paginationHeader, paginationFooter, pageNumberStart, pageNumberFormat])

  const takeSnapshot = useVersionsStore((s) => s.takeSnapshot)
  const snapshotMemoId = memo?.id
  const snapshotMemoTitle = memo?.title || ''
  useEffect(() => {
    if (!editor || !snapshotMemoId) return
    const t = setInterval(() => {
      takeSnapshot(snapshotMemoId, snapshotMemoTitle, getSavableHtml(editor))
    }, 60000)
    return () => clearInterval(t)
  }, [editor, snapshotMemoId, snapshotMemoTitle, takeSnapshot])

  useEffect(() => {
    if (editor) setEditor(editor)
    // dev 전용 디버그 핸들 (프로덕션 번들에서는 제거됨)
    if (import.meta.env.DEV && editor) (window as unknown as { __janEditor?: TiptapEditor }).__janEditor = editor
    applyTheme()
    applyTypo()
    applyDesign(useUIStore.getState().design) // 이 문서의 디자인을 화면에 입힌다
    applyTrackView(editor)                     // 지난번 추적 상태(켬/끔·표시 방식)를 되살린다
    tauriSyncOnBoot().catch(() => {})
    trackEvent('app_boot')
  }, [editor, setEditor, applyTheme, applyTypo])

  useEffect(() => {
    if (activeMemoIdRef.current !== currentId) {
      flushPendingEditorContent()
      activeMemoIdRef.current = currentId
    }
  }, [currentId, flushPendingEditorContent])

  /* 편집 제한은 메모마다 따로 걸린다 — 메모를 바꿀 때마다 그 메모 것을 살려 둔다.
     「읽기만」 은 편집기를 읽기 전용으로 두어야 입력·붙여넣기·끌어놓기 길이 모두 막힌다
     (문지기만으로는 앱이 스스로 하는 일과 가려내기 어렵다). */
  useEffect(() => {
    if (!editor) return
    const sync = () => {
      const p = activateProtect(currentId || '')
      if (!editor.isDestroyed) editor.setEditable(p.mode !== 'read', false)
    }
    sync()
    window.addEventListener('jan-protect-changed', sync)
    return () => window.removeEventListener('jan-protect-changed', sync)
  }, [currentId, editor])

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
      /* 쪽 설정·디자인이 바뀌면 메모가 갱신되고, 그 여파로 아래 「메모 → 편집기」 맞춤이 돈다.
         아직 저장되지 않은 글이 남아 있으면 그 맞춤이 예전 내용으로 되돌려 버리므로,
         먼저 쓰던 글을 저장소에 밀어 넣는다 (붙여 넣자마자 디자인을 바꿔도 글이 사라지지 않게) */
      flushPendingEditorContent()
      updateMemoPageSettings(memoId, next)
    })
  }, [updateMemoPageSettings, flushPendingEditorContent])

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

  /* 저장소의 글 → 편집기. 「글이 바뀐 때」만 돈다 —
     쪽 설정·디자인만 바뀌었는데 여기서 setContent 를 하면 화면이 통째로 다시 그려져,
     쓰던 자리와 고른 것이 날아가고 개체가 한순간 사라졌다 나타난다. */
  const memoContent = memo?.content
  useEffect(() => {
    if (!editor || editor.isDestroyed || memoContent == null) return
    if (collab.ydoc) return
    // 독립 페이지 모델에서는 편집기 HTML 에 용지 래퍼가 들어 있어 저장본과 그대로
    // 비교하면 항상 불일치 → setContent 무한 반복이 된다. 래퍼를 벗겨 비교한다.
    const cur = getSavableHtml(editor)
    if (cur !== memoContent) {
      /* 메모를 바꿔 실은 글 — 새 문서를 온통 「넣음」 으로 물들이면 안 된다 */
      editor.chain().setMeta('janTrackSkip', true).setContent(memoContent, { emitUpdate: false }).run()
      resolveBlobRefsInElement(editor.view.dom).catch(() => {})
    }
  }, [currentId, editor, collab.ydoc, memoContent])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    resolveBlobRefsInElement(editor.view.dom).catch(() => {})
  }, [editor, currentId, memo?.content])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
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
    const html = getSavableHtml(editor)
    // saveAs: 항상 새 위치를 묻는다. 아니면 이 메모의 핸들이 있을 때만 재사용
    const ownHandle = saveAs || (fileHandleMemoId && fileHandleMemoId !== currentId) ? null : fileHandle
    const result = await saveToFile({
      title, content: html, handle: ownHandle,
      pageSettings: pageSettingsFromUi(useUIStore.getState()), // 이 문서의 판형을 파일에 함께 넣는다
      pick: saveAs, // 자리를 고르는 창은 「다른 이름」에서만 — 그냥 「저장」은 묻지 않고 저장한다
    })
    if (result.ok) {
      setSavedAt(Date.now())
      if (result.handle) setFileHandle(result.handle, currentId)
      if (currentId) pushActiveSnapshot(currentId).catch(() => {})
      trackEvent('save_file')
      flash(result.handle ? '파일로 저장했습니다' : '다운로드 폴더에 저장했습니다')
      if (memo) dispatchWebhook({ type: 'memo-saved', memoId: memo.id, title: memo.title, charCount: editor.state.doc.textContent.length }).catch(() => {})
    } else if (result.error !== '취소됨') {
      // 브라우저가 뱉는 영어 예외를 그대로 보여 주지 않는다 — 무엇을 하면 되는지만 말한다
      flash(/quota|storage/i.test(result.error || '')
        ? '저장 공간이 부족합니다 — 자리를 비우고 다시 저장해 주세요'
        : '저장하지 못했습니다 — 「다른 이름」으로 다시 저장해 주세요')
      console.warn('[저장 실패]', result.error)
    }
  }

  /* 읽어들인 문서를 제 자리에 앉힌다 — 「열기」와 바탕화면에서 두 번 눌러 열기가 함께 쓴다.
     파일은 언제나 제 문서로 연다: 지금 보던 문서(예: 2단 논문)의 판형이 묻어나면 안 된다.
     파일에 판형이 적혀 있으면 그것을, 없으면 기본 판형을 쓴다 (워드와 같다) */
  const placeOpenedDocument = useCallback((result: OpenFileResult) => {
    if (!editor || editor.isDestroyed) return
    const id = newMemo()
    const pageSettings = normalizeMemoPageSettings(result.pageSettings, DEFAULT_MEMO_PAGE_SETTINGS)
    updateMemo(id, { title: result.title, content: result.content, pageSettings })
    applyingMemoPageSettingsRef.current = true
    useUIStore.getState().applyPageSettings(pageSettings)
    applyingMemoPageSettingsRef.current = false
    setFileHandle(result.handle ?? null, id)
    editor.chain().setMeta('janTrackSkip', true).setContent(result.content).run()
    trackEvent('open_file')
  }, [editor, newMemo, setFileHandle, updateMemo])

  async function handleOpen() {
    if (!editor) return
    flushPendingEditorContent()
    try {
      const result = await openFile()
      if (!result) return
      placeOpenedDocument(result)
    } catch (err) {
      alert('열기 실패: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  /* 바탕화면에서 .jan 을 두 번 눌러 연 경우 — 앱을 설치해 두면 운영체제가 여기로 이어 준다 */
  useEffect(() => {
    if (!editor) return
    onLaunchWithFile((doc) => {
      flushPendingEditorContent()
      placeOpenedDocument(doc)
      flash(`${doc.title} 을(를) 열었습니다`)
    })
  }, [editor, flushPendingEditorContent, placeOpenedDocument])

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
      <Toolbar
        barLeading={<HeaderLeading />}
        barTail={<MemoTabs inline />}
        barTrailing={(
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
        )}
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
        onTrash={() => setShowTrash(true)}
        onCards={() => setShowCards(true)}
        onSettings={() => setShowSettings(true)}
        onHelp={() => setShowHelp(true)}
      />
      <TagsBar />
      <div className="jan-app-body">
        {sidebar}
        {/* 쪽모음은 시각적으로 왼쪽(order:-1)이지만 DOM 은 편집기 뒤에 둔다 —
            스냅샷 내부의 .ProseMirror 복제본이 querySelector 첫 매치를 가로채지 않도록 */}
        <div
          className={
            'jan-editor-stack' +
            // has-spread 는 대표 창을 화면 밖으로 숨긴다 — 별도 셀 인스턴스를 쓰는
            // legacy 모델 전용. 독립 페이지 모델은 대표 창 안에서 CSS 로 가로 배치한다.
            (showSpread && !usePageNodes ? ' has-spread' : splitView && !showSpread ? ` is-split is-split-${splitDir}` : '')
          }
          style={splitView && !showSpread ? ({ ['--jan-split-ratio' as string]: `${Math.round(splitRatio * 100)}%` } as CSSProperties) : undefined}
        >
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
          data-page-num-format={pageNumberFormat}
          data-page-model={usePageNodes ? 'nodes' : useColumnPages ? 'columns' : 'legacy'}
          data-spread={usePageNodes && spreadCols > 0 ? 'on' : 'off'}
          data-first-running={firstPageRunningOff ? 'off' : 'on'}
          style={pageStyle}
        >
          <div className="jan-page-layout">
            {shouldShowRulers && (
              <>
                <HorizontalRuler widthMm={pageMm.widthMm} margins={pageMargins} editor={editor} />
                <VerticalRulers
                  heightMm={pageMm.heightMm}
                  margins={pageMargins}
                  pageCount={usePageNodes ? pageCount : 1}
                  gapPx={32}
                />
              </>
            )}
            <div className="jan-page-shell" data-has-running-preview={hasRunningPreview ? 'true' : 'false'}>
              <EditorContent editor={editor} />
              {viewLayout === 'print' && mark.text && (
                <div
                  className="jan-page-watermark"
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(watermarkSvgOf(mark, pagePx.pageWidth, pageRhythmPx))}")`,
                    backgroundSize: `100% ${pageRhythmPx}px`,
                  }}
                />
              )}
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
          {typewriterMode && <div className="jan-typewriter-spacer" aria-hidden="true" />}
        </div>
      </div>
      {/* 독립 페이지 모델에서는 용지가 실제 노드라 CSS 로 가로 배치하면 끝이다
          (인스턴스 복제가 필요 없다) → PageSpreadView 는 legacy 모델에서만 쓴다 */}
      {showSpread && !usePageNodes && editor && splitExtensions && (
        <PageSpreadView
          mainEditor={editor}
          extensions={splitExtensions}
          pagePx={pagePx}
          pageMarginPx={pageMarginPx}
          paginationEnabled={paginationEnabled}
          pageStyle={pageStyle}
          paperStyle={paperStyle}
          pageSize={pageSize}
          pageOrientation={pageOrientation}
          pageColumnCount={pageColumnCount}
          viewLayout={viewLayout}
          spellCheck={spellCheck}
        />
      )}
      {!showSpread && splitView && editor && splitExtensions && (
        <>
          <div
            className="jan-split-divider"
            role="separator"
            aria-orientation={splitDir === 'h' ? 'horizontal' : 'vertical'}
            aria-label="분할선 — 끌어서 창 크기 조절"
            title="끌어서 창 크기 조절 (더블클릭: 반반)"
            onDoubleClick={() => useUIStore.getState().setSplitRatio(0.5)}
            onPointerDown={(e) => {
              e.preventDefault()
              const stack = (e.currentTarget as HTMLElement).parentElement
              if (!stack) return
              const rect = stack.getBoundingClientRect()
              const move = (ev: PointerEvent) => {
                const ratio = splitDir === 'h'
                  ? (ev.clientY - rect.top) / Math.max(1, rect.height)
                  : (ev.clientX - rect.left) / Math.max(1, rect.width)
                useUIStore.getState().setSplitRatio(ratio)
              }
              const up = () => {
                window.removeEventListener('pointermove', move)
                window.removeEventListener('pointerup', up)
                document.body.classList.remove('jan-split-dragging')
              }
              document.body.classList.add('jan-split-dragging')
              window.addEventListener('pointermove', move)
              window.addEventListener('pointerup', up)
            }}
          />
          <SplitEditorPane
            mainEditor={editor}
            extensions={splitExtensions}
            hasYdoc={!!collab.ydoc}
            paginationEnabled={paginationEnabled}
            pagePx={pagePx}
            pageMarginPx={pageMarginPx}
            pageStyle={pageStyle}
            paperStyle={paperStyle}
            pageSize={pageSize}
            pageOrientation={pageOrientation}
            pageColumnCount={pageColumnCount}
            viewLayout={viewLayout}
            spellCheck={spellCheck}
          />
        </>
      )}
      </div>
      {showPageThumbs && editor && (
        <PageThumbnailPanel
          editor={editor}
          pageW={pagePx.pageWidth}
          pageH={pagePx.pageHeight}
          rhythmFallback={pageRhythmPx}
          pageStyle={pageStyle}
          paperStyle={paperStyle}
        />
      )}
      </div>
      <StatusBar editor={editor} onPageSettings={() => setShowPageSettings(true)} onSettings={() => setShowSettings(true)} />
      <CommandPalette editor={editor} onAi={() => setShowAi(true)} onChat={() => setShowChat(true)} onSearch={() => setShowSearch(true)} onFind={() => setShowFind(true)} onOcr={() => setShowOcr(true)} onPaint={() => setShowPaint(true)} onPostit={() => setShowPostit(true)} onPaper={() => setShowPaper(true)} onRoles={() => { setInitialRoleTool(null); setShowRoles(true) }} onTemplates={() => setShowTemplates(true)} onSnippets={() => setShowSnippets(true)} onMacros={() => setShowMacros(true)} onTypo={() => setShowTypo(true)} onCalendar={() => setShowQuick(true)} onQuick={() => setShowQuick(true)} onMd={() => setShowMd(true)} onPrintPreview={() => setShowPrint(true)} onShare={() => setShowShare(true)} onGist={() => setShowGist(true)} onAtt={() => setShowAtt(true)} onLock={() => setShowLock(true)} onSettings={() => setShowSettings(true)} onHelp={() => setShowHelp(true)} onAbout={() => setShowAbout(true)} onStats={() => setShowStats(true)} onMindMap={() => setShowMindMap(true)} onHeatmap={() => setShowHeatmap(true)} onInfo={() => setShowInfo(true)} onDiff={() => setShowDiff(true)} onLinkCheck={() => setShowLinkCheck(true)} onTranslate={() => setShowTranslate(true)} onVersions={() => setShowVersions(true)} onCards={() => setShowCards(true)} onPageSettings={() => setShowPageSettings(true)} onToggleOutline={() => setShowOutline((v) => !v)} onSave={handleSave} onOpen={handleOpen} />
      <SlashMenu editor={editor} />
      <TableHandles editor={editor} />
      <TableContextMenu editor={editor} />
      <BubbleToolbar editor={editor} />
      <ObjectBar editor={editor} />
      <ImageMenu editor={editor} />
      <ImageHandles editor={editor} />
      <ImageContextMenu editor={editor} />
      {imgDialog && <ImageDialog editor={editor} tab={imgDialog} onClose={() => setImgDialog(null)} />}
      {shapePanel && <ShapePanel editor={editor} mode={shapePanel} onClose={() => setShapePanel(null)} />}
      {chartPanel && <ChartPanel editor={editor} mode={chartPanel} onClose={() => setChartPanel(null)} />}
      {smartPanel && <SmartArtPanel editor={editor} mode={smartPanel} onClose={() => setSmartPanel(null)} />}
      {signPanel && <SignaturePanel editor={editor} mode={signPanel} onClose={() => setSignPanel(null)} />}
      {xrefPanel && <CrossRefPanel editor={editor} onClose={() => setXrefPanel(false)} />}
      {designPanel && <DesignPanel tab={designPanel} onClose={() => setDesignPanel(null)} />}
      {sourcePanel && <SourcePanel editor={editor} onClose={() => setSourcePanel(false)} />}
      {showSymbols && <SymbolPanel editor={editor} onClose={() => setShowSymbols(false)} />}
      {showObjects && <ObjectPane editor={editor} onClose={() => setShowObjects(false)} />}
      {showComments && <CommentPane editor={editor} onClose={() => setShowComments(false)} />}
      {showReview && <ReviewPane editor={editor} onClose={() => setShowReview(false)} />}
      {showA11y && <AccessibilityPanel editor={editor} onClose={() => setShowA11y(false)} />}
      {suggest && <WordSuggestPanel editor={editor} mode={suggest} onClose={() => setSuggest(null)} />}
      {showProtect && <ProtectPanel editor={editor} onClose={() => setShowProtect(false)} />}
      {showCount && <CountPanel editor={editor} onClose={() => setShowCount(false)} />}
      {showImgConv && <ImageConvertPanel editor={editor} onClose={() => setShowImgConv(false)} />}
      {/* 껐다 켰을 때 지난번 포스트잇을 그 자리에 되살린다 (브라우저가 저절로 창을 못 띄우게 막으므로 한 번 물어본다) */}
      <PostitReopen />
      {tableFormat && <TableFormatPanel editor={editor} tab={tableFormat} onClose={() => setTableFormat(null)} />}
      <Suspense fallback={<ModalSkeleton />}>
        {showAi && <AiHelper editor={editor} onClose={() => setShowAi(false)} />}
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} focusSection={settingsFocus} />}
        {showPrint && editor && <PrintPreview html={getSavableHtml(editor)} title={title} onClose={() => setShowPrint(false)} />}
        {showRoles && <RolesPanel editor={editor} initialTool={initialRoleTool} onClose={() => { setShowRoles(false); setInitialRoleTool(null) }} />}
        {showPaper && <PaperPanel editor={editor} onClose={() => setShowPaper(false)} />}
        {showPostit && <PostitPanel onClose={() => setShowPostit(false)} />}
        {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}
        {showPaint && <PaintCanvas editor={editor} onClose={() => setShowPaint(false)} />}
        {paintEdit && editor && (
          <PaintCanvas
            editor={editor}
            initialImageSrc={paintEdit.src}
            onReplace={(dataUrl) => {
              editor.chain().focus().setNodeSelection(paintEdit.pos).updateAttributes('image', { src: dataUrl }).run()
            }}
            onClose={() => setPaintEdit(null)}
          />
        )}
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
        {showTrash && <TrashModal onClose={() => setShowTrash(false)} />}
      </Suspense>
      <Lightbox />
    </div>
  )
}

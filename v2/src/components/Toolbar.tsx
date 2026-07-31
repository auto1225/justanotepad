import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { downloadHwpx } from '../lib/hwpxExport'
import { downloadMd } from '../lib/markdownIO'
import { exportToPdf } from '../lib/pdfExport'
import { ColorPicker } from './ColorPicker'
import { FontCombo } from './FontCombo'
import { NumberSpin } from './NumberSpin'
import { TTSButton } from './TTSButton'
import { VoiceButton } from './VoiceButton'
import { Ribbon } from './Ribbon'
import { aggregateColumn } from '../lib/tableUtils'
import { TABLE_STYLES, blockCalc, copyTable, distributeColumns, distributeRows, moveRow, resizeColumns, resizeRows, setCellPadding, setRowHeight, setTableStyle, setTableWrap, splitTable, tableToText, toggleTableOption } from '../lib/tableWord'
import {
  cellSelectionSize, collapseCellSelection, extendCellSelection, moveTable, selectCurrentCell,
  selectTableColumn, selectTableRow, selectWholeTable,
} from '../lib/tableSelect'
import { IMAGE_SHAPES, IMAGE_STYLES, IMAGE_WRAPS } from '../extensions/ImageObject'
import { CLIPART, SHAPES, WORDART } from '../lib/shapeLibrary'
import {
  BORDER_PRESETS, BORDER_WHERE, applyBorders, applyCellAlign, applyCellIndent, applyDiagonal,
  applyShading, currentPen, cycleCellTextDirection, setPen,
} from '../lib/tableBorders'
import { setPenMode } from '../extensions/TablePen'
import { ColorPalette, LineStyleList, LineWidthList } from './WordPickers'
import {
  BULLET_MARKS, LINE_SPACINGS, NUMBER_MARKS, PARA_BORDERS, UNDERLINE_STYLES, changeCase, pasteAs,
  selectAll, selectSimilarFormatting, setBulletStyle, setCharBorder, setCharShading, setLineSpacing,
  setNumberStyle, setParagraphBorder, setParagraphShading, setParagraphSpace, setUnderlineStyle,
} from '../lib/homeTab'
import { deleteCellsShift } from '../lib/tableWord'
import { EMPHASIS_MARKS, OVERLAP_FRAMES } from '../extensions/TextObjects'
import { currentDropCap, insertOverlap, insertRuby, selectedText, setDropCap, setEmphasis } from '../lib/textObjects'
import { COVER_STYLES, insertBlankPage, insertCover, todayLabel } from '../lib/coverPage'
import {
  addComment, clearDoneComments, commentAtCursor, gotoAdjacentComment, gotoNextField,
  insertField, removeComment, toggleCommentDone,
} from '../lib/commentField'
import {
  TRACK_MODES, acceptAll, applyHere, changeCount, gotoChange, rejectAll,
  setTrackAuthor, setTrackMode, toggleTracking, trackAuthor, trackMode, trackingOn,
} from '../lib/trackChanges'
import { HANJA_MODES, hanjaText, hanjaToHangul, lookupHanja } from '../lib/hanja'
import { protectLine, currentProtect, saveProtect } from '../lib/docProtect'
import { pauseReading, readAloud, readNextBlock, stopReading } from '../lib/readAloud'
import { countLine, countReport } from '../lib/countReport'
import { replaceSpot, wordAtCursor } from '../lib/selWord'
import {
  SHAPE_STYLES, applyShapeStyle, changeShape, currentShape, cycleTextDirection, cycleVAlign,
  flipShape, insertShape, moveShape, rotateShape, setShapeAlign, setShapeAttrs, setShapeFill,
  setShapeStroke, setShapeText, setShapeWrap, toggleShapeLock,
} from '../lib/shapeWord'
import {
  RECOLORS, applyRecolor, clearCrop, compressImage, copyImageFormat, cropToRatio, downloadImage,
  fitImageToBody, fitImageToCell, flipImage, moveImage, numberImageCaptions, pasteImageFormat,
  removeWhiteBackground, resetImageFormat, resetImageSize, rotateImage, scaleImage, selectNextImage,
  setImageAlign, setImageAttrs, setImageBorder, setImageShape, setImageStyle, setImageWidth,
  setImageWrap, setRotation, toggleAspectLock, toggleImageLock,
} from '../lib/imageWord'
import { CITATION_STYLES } from '../lib/citationFormat'
import type { CitationStyle } from '../lib/citationFormat'
import { citationCount, citationStyle, exportBibtex, importBibtex, setCitationStyle } from '../lib/paperCites'
import { MATH_TEMPLATES } from '../lib/paperTools'
import { openImageConvert } from '../lib/imageConvert'
import { useThemeStore } from '../store/themeStore'
import { currentCellFormula, setCellFormula, suggestFormula } from '../lib/tableCompute'
import { FORMULA_FUNCTIONS, NUMBER_FORMATS } from '../lib/tableFormula'
import { pickTableSize } from '../lib/tableInsert'
import { sortTableByCurrentColumn } from '../lib/tableSort'
import { Icon } from './Icons'
import type { IconName } from './Icons'
import { useTypographyStore } from '../store/typographyStore'
import { PAPER_STYLES, pageMarginsSummary, useUIStore } from '../store/uiStore'
import { useMemosStore } from '../store/memosStore'
import { exportV2ToJson, importV2FromJsonAsync } from '../lib/v1Import'
import { fileToDataUrl } from '../lib/attachments'
import { saveDataUrlAsBlobRef } from '../lib/blobRefs'
import { fitPageZoom, setPageZoom } from '../lib/pageZoom'
import { PAGE_BREAK_HTML } from '../lib/pageBreak'
import { flash } from '../lib/flash'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import {
  DESIGN_EFFECTS, PAGE_BORDER_STYLES, PAGE_COLORS, PARA_SPACING_SETS, STYLE_SETS, THEME_COLORS, THEME_FONTS,
} from '../lib/docDesign'
import { LINE_NUMBER_MODES, MANUSCRIPT_PRESETS } from '../lib/docLayout'
import { CHART_PALETTES, CHART_STYLES, CHART_TYPES, NUMBER_FORMATS as CHART_NUMBER_FORMATS, TREND_LINES } from '../lib/chartSpec'
import { SMART_LAYOUTS, SMART_PALETTES } from '../lib/smartArt'
import { askText, askConfirm } from '../lib/promptModal'
import { computeDocHealth, showHealthReport, markBackupDone } from '../lib/docHealth'
import { applyPaperFormat, PAPER_FORMATS } from '../lib/paperFormats'
import { saveCurrentAsStyle, showMyStylesPicker } from '../lib/myStyles'
import { insertFootnote as insertFootnoteAt, renumberFootnotes } from '../lib/footnotes'
import {
  AUTHORITY_KINDS, CITE_STYLES, addToToc, citeStyle, gotoNextNote, gotoNoteArea, insertEndnote,
  loadSources, markAuthority, markIndexEntry, putAuthorityList, putBibliography, putCaptionList,
  putIndex, putToc, refreshAllFields, setCiteStyle,
} from '../lib/docRefs'
import { insertNumberedEquation, insertFigureCaption, insertTableCaption, insertCrossRef, paperTargetCount, renumberPaperTags, renumberWithFeedback } from '../lib/paperRefs'
import { pickMathTemplate, lintPaper, showLintReport, insertCreditBlock, insertCoiBlock, insertDataAvailabilityBlock, insertListOfFigures, insertListOfTables, insertAcronymList } from '../lib/paperTools'
import { downloadLatex } from '../lib/latexExport'
import { downloadHtmlFile, downloadDocFile } from '../lib/htmlDocExport'
import { MathStudio } from './MathStudio'
import { getSavableHtml } from '../extensions/PageDocument'
import { errText } from '../lib/errText'
import { openAiConnect } from '../lib/aiConnect'
import { openAiWrite } from '../lib/aiWrite'
import { createImageCapture, createSpeechRecognition, getDisplayMedia } from '../lib/browserApis'

/** v1·외부 백업에서 읽어 들이는 메모 — 키 이름이 버전마다 달라 넉넉히 받는다 */
type LegacyMemoLike = { title?: string; t?: string; content?: string; html?: string; body?: string }

interface ToolbarProps {
  /** 리본 탭 줄 왼쪽에 놓을 것 (사이드바·로고·문서 탭) */
  barLeading?: React.ReactNode
  /** 리본 탭 줄 오른쪽에 놓을 것 (도구 아이콘) */
  barTrailing?: React.ReactNode
  /** 바 오른쪽 끝 (문서 탭) */
  barTail?: React.ReactNode
  editor: Editor | null
  onPrintPreview: () => void
  onAi: () => void
  onRoles: () => void
  onPaper: () => void
  onPostit: () => void
  onPaint: () => void
  onToggleOutline: () => void
  outlineOpen: boolean
  onAbout: () => void
  onVersions: () => void
  onMdPreview: () => void
  onShare: () => void
  onAtt: () => void
  onLock: () => void
  onStats: () => void
  onMindMap: () => void
  onMacros: () => void
  onDiff: () => void
  onSnippets: () => void
  onLinkCheck: () => void
  onFind: () => void
  onTypo: () => void
  onInfo: () => void
  onHeatmap: () => void
  onQuick: () => void
  onTranslate: () => void
  onTemplates: () => void
  onGist: () => void
  onOcr: () => void
  onChat: () => void
  onSearch: () => void
  onNewMemo: () => void
  onSave: () => void
  onSaveAs: () => void
  onOpen: () => void
  onPageSettings: () => void
  onLectureNotes: () => void
  onMeetingNotes: () => void
  onTrash: () => void
  /* 도구·파일 탭이 쓰는 앱 살림 — 머리부 아이콘에서 옮겨 왔다 */
  onCards: () => void
  onSettings: () => void
  onHelp: () => void
}

const SYMBOL_GROUPS: Array<{ label: string; chars: string[] }> = [
  { label: '문장 부호', chars: ['—', '–', '…', '·', '•', '◦', '¶', '§', '©', '®', '™', '「', '」', '『', '』', '《', '》'] },
  { label: '도형 · 화살표', chars: ['★', '☆', '◆', '◇', '■', '□', '▲', '▼', '→', '←', '↑', '↓', '⇒', '⇐', '↔', '✓', '✗'] },
  { label: '수학', chars: ['°', '±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '√', '∫', 'Σ', 'Π', '½', '¼', '¾', '²', '³'] },
  { label: '그리스 문자', chars: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'σ', 'τ', 'φ', 'ψ', 'ω', 'Ω', 'Δ', 'Φ'] },
  { label: '통화 · 단위', chars: ['₩', '$', '€', '¥', '£', '℃', '℉', '㎡', '㎥', '㎏', '㎜', '㎝', '㎞', '㏄'] },
]

interface MenuItem {
  label: string; short?: string; hint?: string; icon?: IconName; divider?: string; onClick?: () => void
  /** 눌러서 펼치는 차림표 (워드의 「▾」 단추) */
  menu?: MenuItem[]
  /** 그림이 있는 설명 카드 키 (featureGuide) — 없으면 이름으로 카드를 만든다 */
  help?: string
  /** 작은 단추 — 세 개씩 층층이 쌓인다 */
  small?: boolean
  /** 격자 — 아홉 칸 맞춤처럼 */
  grid?: { cols: number; items: MenuItem[] }
  /** 펼쳤을 때 보일 것을 직접 그린다 (색판·선 고르개) */
  panel?: () => React.ReactNode
}
interface MenuGroup { label: string; items: MenuItem[]; context?: boolean; /** 문서 작업이 아닌 부가 묶음 (AI·논문) — 탭 줄에서 구분해 보여 준다 */ extra?: boolean; icon?: IconName }

/**
 * Phase 24 — v1 8개 카테고리 메뉴 모든 기능 실제 구현 (stub 제거).
 * editor.commands 직접 호출 / Web API (SpeechRecognition, getDisplayMedia, MediaRecorder)
 * / 본문 HTML 블록 삽입 / 모달 호출 등으로 모두 작동.
 */
function escHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function Toolbar(p: ToolbarProps) {
  const editor = p.editor
  /* 리본 — 한글·워드식 탭 메뉴. 고른 탭과 접힘 상태는 다시 방문해도 유지한다 */
  const [ribbonTab, setRibbonTab] = useState<string>(() => {
    try { return localStorage.getItem('jan-v2-ribbon-tab') || '서식' } catch { return '서식' }
  })
  const [ribbonCollapsed, setRibbonCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('jan-v2-ribbon-collapsed') === '1' } catch { return false }
  })
  useEffect(() => { try { localStorage.setItem('jan-v2-ribbon-tab', ribbonTab) } catch { /* 저장 실패는 무시 */ } }, [ribbonTab])
  useEffect(() => { try { localStorage.setItem('jan-v2-ribbon-collapsed', ribbonCollapsed ? '1' : '0') } catch { /* 무시 */ } }, [ribbonCollapsed])
  /* 커서가 표·그림 안에 있는지 — TipTap v3 는 트랜잭션마다 부모를 다시 그리지 않으므로
     직접 구독한다. (툴바의 굵게·정렬 같은 상태 표시도 이 구독으로 함께 최신이 된다) */
  const [contextTab, setContextTab] = useState<'표' | '그림' | '도형' | '차트' | '도해' | null>(null)
  /* 앱으로 설치하면 운영체제가 .jan 을 이 앱에 이어 준다 — 그래야 두 번 눌러 열기가 된다 */
  const install = useInstallPrompt()
  /* 문서 디자인 — 워드 「디자인」 탭이 쓰는 값과 명령 */
  const design = useUIStore((s) => s.design)
  const setDesign = useUIStore((s) => s.setDesign)
  /* 쪽 배치 — 워드 「레이아웃」 탭이 쓰는 값과 명령 */
  const layout = useUIStore((s) => s.layout)
  const setLayout = useUIStore((s) => s.setLayout)
  useEffect(() => {
    if (!editor) return
    const read = () => setContextTab(
      editor.isActive('table') ? '표'
        : editor.isActive('image') ? '그림'
          : editor.isActive('janShape') ? '도형'
            : editor.isActive('janChart') ? '차트'
              : editor.isActive('janSmart') ? '도해'
                : null
    )
    read()
    editor.on('selectionUpdate', read)
    editor.on('transaction', read)
    return () => {
      editor.off('selectionUpdate', read)
      editor.off('transaction', read)
    }
  }, [editor])

  /* 표·그림·도형을 고르면 그 개체 탭이 저절로 뜨고, 선택이 풀리면 쓰던 탭으로 돌아온다.
     탭 이름은 실제 리본 탭과 같아야 한다 — 예전에는 「표」 로 바꿔 놓아 맞는 탭이 없었고,
     그래서 표를 골라도 표 메뉴가 뜨지 않았다. */
  const OBJECT_TABS: Record<string, string[]> = {
    표: ['표 레이아웃', '표 디자인'],
    차트: ['차트 도구'],
    도해: ['도해 도구'],
    그림: ['그림'],
    도형: ['도형'],
  }
  const beforeContextTab = useRef<string | null>(null)
  useEffect(() => {
    if (contextTab) {
      const names = OBJECT_TABS[contextTab] || []
      setRibbonTab((prev) => {
        // 이미 그 개체의 탭을 보고 있으면 그대로 둔다 (표 디자인 ↔ 레이아웃을 오갈 수 있게)
        if (names.includes(prev)) return prev
        const isObjectTab = Object.values(OBJECT_TABS).some((list) => list.includes(prev))
        if (!isObjectTab) beforeContextTab.current = prev
        return names[0] || prev
      })
    } else if (beforeContextTab.current) {
      const back = beforeContextTab.current
      beforeContextTab.current = null
      setRibbonTab(back)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextTab])
  const containerRef = useRef<HTMLDivElement>(null)
  const savedSelRef = useRef<{ from: number; to: number } | null>(null)
  /* 서식 도구 상자에 보이는 값 — 트랜잭션마다 다시 읽는다.
     tiptap 3 의 useEditor 는 기본적으로 트랜잭션마다 다시 그리지 않아서,
     구독하지 않으면 방금 적용한 값이 입력칸에 반영되지 않는다. */
  const charState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { fontFamily: '', fontSize: '', letterSpacing: '', charScale: null as number | null, lineHeight: '' }
      const ts = e.getAttributes('textStyle')
      const block = e.isActive('heading') ? e.getAttributes('heading') : e.getAttributes('paragraph')
      return {
        fontFamily: (ts.fontFamily as string) || '',
        fontSize: (ts.fontSize as string) || '',
        letterSpacing: (ts.letterSpacing as string) || '',
        charScale: (ts.charScale as number | undefined) ?? null,
        lineHeight: block.lineHeight ? String(block.lineHeight) : '',
      }
    },
  }) ?? { fontFamily: '', fontSize: '', letterSpacing: '', charScale: null as number | null, lineHeight: '' }
  useTypographyStore() // 문서 기본 타이포 변경 시 리렌더 (셀렉트 기본값 반영)

  const [showLinkPop, setShowLinkPop] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [showSymbolPop, setShowSymbolPop] = useState(false)
  const [mathStudio, setMathStudio] = useState<null | { initial: string; onSave?: (latex: string) => void }>(null)

  // Ctrl+K (keymap.ts) 도 같은 링크 편집기를 쓰도록 이벤트로 연결
  useEffect(() => {
    const open = () => { setLinkDraft(editor?.getAttributes('link').href || ''); setShowLinkPop(true) }
    window.addEventListener('jan-open-link-editor', open)
    return () => window.removeEventListener('jan-open-link-editor', open)
  }, [editor])

  // 수식 노드 더블클릭 → 수식 스튜디오에서 편집
  useEffect(() => {
    const onEdit = (e: Event) => {
      const { latex, pos } = (e as CustomEvent<{ latex: string; pos: number }>).detail
      setMathStudio({
        initial: latex,
        onSave: (next) => {
          if (!editor) return
          editor.chain().focus().setNodeSelection(pos).updateAttributes('mathInline', { latex: next }).run()
        },
      })
    }
    window.addEventListener('jan-math-edit', onEdit)
    return () => window.removeEventListener('jan-math-edit', onEdit)
  }, [editor])
  const ui = useUIStore()
  /* 테마 — 머리부 아이콘에서 파일 탭으로 옮겼다 */
  const theme = useThemeStore((st) => st.theme)
  const setTheme = useThemeStore((st) => st.setTheme)
  const THEME_CHOICES: { key: 'light' | 'dark' | 'auto'; label: string }[] = [
    { key: 'light', label: '밝게' },
    { key: 'dark', label: '어둡게' },
    { key: 'auto', label: '기기 설정에 맞춤' },
  ]
  const themeName = THEME_CHOICES.find((t) => t.key === theme)?.label || theme
  const cycleTheme = () => {
    const at = THEME_CHOICES.findIndex((t) => t.key === theme)
    const next = THEME_CHOICES[(at + 1) % THEME_CHOICES.length]
    setTheme(next.key)
    flash(`테마 — ${next.label}`)
  }

  /* 맞춤법 검사 켬/끔 — F7 도 이 길로 온다 (그래서 훅보다 위에 둔다) */
  const toggleSpellCheck = () => {
    const cur = useUIStore.getState().spellCheck
    useUIStore.setState({ spellCheck: !cur })
    document.querySelectorAll('.ProseMirror').forEach(el => el.setAttribute('spellcheck', !cur ? 'true' : 'false'))
    flash(`맞춤법 검사 ${!cur ? '켬' : '끔'}`)
  }

  /* 검수 탭이 보여 주는 상태 — 추적 켬/끔, 표시 방식, 편집 제한.
     이것들은 편집기 밖(localStorage·모듈)에 있어 구독하지 않으면 단추 이름이 옛것으로 남는다. */
  const [reviewFlags, setReviewFlags] = useState(() => ({
    tracking: trackingOn(editor), mode: trackMode(), protect: protectLine(), blockOthers: currentProtect().blockOthers,
  }))
  useEffect(() => {
    const sync = () => setReviewFlags({
      tracking: trackingOn(editor), mode: trackMode(), protect: protectLine(), blockOthers: currentProtect().blockOthers,
    })
    sync()
    window.addEventListener('jan-track-changed', sync)
    window.addEventListener('jan-protect-changed', sync)
    return () => {
      window.removeEventListener('jan-track-changed', sync)
      window.removeEventListener('jan-protect-changed', sync)
    }
  }, [editor])

  /* 단축키가 부르는 것들 — 리본 단추와 똑같은 길로 보낸다 (F7 · Shift+F7 · F9 는 창이 스스로 받는다) */
  useEffect(() => {
    const onSpell = () => toggleSpellCheck()
    const onTrackToggle = () => { toggleTracking(editor) }
    const onTrackGoto = (e: Event) => { gotoChange(editor, (e as CustomEvent<{ dir?: 1 | -1 }>).detail?.dir ?? 1) }
    window.addEventListener('jan-spell-toggle', onSpell)
    window.addEventListener('jan-track-toggle', onTrackToggle)
    window.addEventListener('jan-track-goto', onTrackGoto)
    return () => {
      window.removeEventListener('jan-spell-toggle', onSpell)
      window.removeEventListener('jan-track-toggle', onTrackToggle)
      window.removeEventListener('jan-track-goto', onTrackGoto)
    }
  }, [editor])

  if (!editor) return null

  /* 입력칸(글꼴 검색·숫자)에 포커스가 가면 문서의 선택 영역이 풀린다.
     누르는 순간(mousedown 캡처)의 선택을 기억해 두었다가 명령을 걸 때 되돌린다 —
     워드·한글에서 서식 도구 상자를 써도 선택이 유지되는 것과 같은 동작. */
  const applyToSelection = (
    run: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>,
    keepFocus = false, // 입력칸에서 ↑↓ 로 조절 중이면 포커스를 편집기로 가져오지 않는다
  ) => {
    const chain = keepFocus ? editor.chain() : editor.chain().focus()
    const s = savedSelRef.current
    if (s && s.from !== s.to) chain.setTextSelection(s)
    run(chain).run()
  }

  /* ── 글자 모양 도구 상자가 읽는 현재 값 (한글·워드처럼 pt 로 보여 준다) ──
     따로 지정하지 않은 항목은 문서 기본값을 흐리게 보여 준다 (빈칸이면 지금 값을 알 수 없다) */
  const typo = useTypographyStore.getState()
  const docSizePt = Math.round(typo.fontSize * 0.75 * 10) / 10
  const docLineHeight = typo.lineHeight
  const docLetterSpacing = typo.letterSpacing
  const docCharScale = typo.charScale
  const fontSizePt = (() => {
    const raw = charState.fontSize
    if (!raw) return null
    const n = parseFloat(raw)
    if (Number.isNaN(n)) return null
    return raw.endsWith('px') ? Math.round(n * 0.75 * 10) / 10 : Math.round(n * 10) / 10
  })()
  const lineHeightValue = (() => {
    const n = charState.lineHeight ? parseFloat(charState.lineHeight) : NaN
    return Number.isNaN(n) ? null : n
  })()
  const letterSpacingPct = (() => {
    const raw = charState.letterSpacing
    if (!raw) return null
    const n = parseFloat(raw)
    if (Number.isNaN(n)) return null
    return raw.endsWith('em') ? Math.round(n * 100) : Math.round(n) // px 로 들어온 옛 문서도 받아 준다
  })()
  const charScalePct = charState.charScale

  /** 워드의 글자 크게/작게 — 표준 크기 사다리를 한 칸씩 오르내린다 */
  const FONT_STEPS = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
  const stepFontSize = (dir: 1 | -1) => {
    const cur = fontSizePt ?? 11
    const next = dir > 0
      ? FONT_STEPS.find((n) => n > cur + 0.01) ?? Math.min(300, Math.round(cur * 1.15 * 10) / 10)
      : [...FONT_STEPS].reverse().find((n) => n < cur - 0.01) ?? Math.max(4, Math.round(cur * 0.87 * 10) / 10)
    applyToSelection((c) => c.setFontSize(`${next}pt`))
  }

  /* ============================================================
   * 헬퍼 / 실제 기능 구현
   * ============================================================ */

  const insertHTML = (html: string) => editor.chain().focus().insertContent(html).run()

  const togglePilcrow = () => {
    document.body.classList.toggle('jan-show-pilcrow')
    try { localStorage.setItem('jan-show-pilcrow', document.body.classList.contains('jan-show-pilcrow') ? '1' : '0') } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
  }
  /* 워드처럼 격자에서 크기를 골라 넣는다 (「삽입 ▸ 표」) */
  const insertTable = async () => {
    const size = await pickTableSize()
    if (!size) return
    editor.chain().focus().insertTable(size).run()
    flash(`${size.rows}행 ${size.cols}열 표를 넣었습니다`)
  }
  const insertImageURL = async () => { const url = await askText('이미지 URL:', '', { placeholder: 'https://...' }); if (url) editor.chain().focus().setImage({ src: url }).run() }
  const uploadImage = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = () => {
      const file = inp.files?.[0]; if (!file) return
      const r = new FileReader()
      r.onload = () => editor.chain().focus().setImage({ src: String(r.result) }).run()
      r.readAsDataURL(file)
    }
    inp.click()
  }
  const toggleLink = () => {
    setLinkDraft(editor.getAttributes('link').href || '')
    setShowLinkPop(true)
  }
  const applyLink = () => {
    const url = linkDraft.trim()
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: /^(https?:|mailto:|#)/i.test(url) ? url : 'https://' + url }).run()
    setShowLinkPop(false)
  }
  const insertHr = () => editor.chain().focus().setHorizontalRule().run()

  /* === 자료 탭 (워드 「참조」) === */
  const openSources = () => window.dispatchEvent(new Event('jan-source-dialog'))
  /** 색인 항목 표시 — 고른 말이 있으면 그것을 기본값으로 */
  const markIndex = async () => {
    const word = (await askText('색인에 넣을 말', selectedText(editor) || '')) || ''
    if (word) markIndexEntry(editor, word)
  }
  /** 근거(법령·판례) 표시 */
  const markAuth = async () => {
    const label = (await askText('근거 이름 (예: 주차장법 제6조, 대법원 2024다1234)', selectedText(editor) || '')) || ''
    if (!label) return
    const kind = (await askText('갈래 — ' + AUTHORITY_KINDS.join(' · '), AUTHORITY_KINDS[0])) || AUTHORITY_KINDS[0]
    markAuthority(editor, (AUTHORITY_KINDS as readonly string[]).includes(kind) ? (kind as (typeof AUTHORITY_KINDS)[number]) : '기타', label)
  }
  /** 캡션 넣기 — 그림·표·수식에 번호를 붙인다 */
  const insertCaption = async (kind: 'figure' | 'table') => {
    const text = (await askText(`${kind === 'figure' ? '그림' : '표'} 설명`, '')) || ''
    if (!text) return
    if (kind === 'figure') insertFigureCaption(editor, text)
    else insertTableCaption(editor, text)
    renumberPaperTags(editor)
  }

  /* === 논문 탭 (학술 원고) === */
  const askBibtex = async () => {
    const text = await askText(
      'BibTeX 붙여넣기 — Google Scholar·Zotero 가 주는 @article{...} 글',
      '',
      { multiline: true, placeholder: '@article{kim2026, title={...}, author={...}, year={2026} }' },
    )
    if (text && text.trim()) importBibtex(text)
  }
  const insertMathTemplate = (latex: string) => {
    setMathStudio({ initial: latex })
  }

  /* === 차트·도해 상황 탭이 쓰는 손잡이 === */
  const resizeChart = (delta: number) => {
    const spec = editor.getAttributes('janChart').spec as { width?: number; height?: number } | undefined
    if (!spec) { flash('먼저 차트를 고른다'); return }
    const width = Math.max(200, Math.min(900, (spec.width || 460) + delta))
    const height = Math.max(140, Math.min(700, Math.round(width * ((spec.height || 280) / (spec.width || 460)))))
    editor.chain().focus().updateChart({ width, height }).run()
  }
  const resizeSmart = (delta: number) => {
    const spec = editor.getAttributes('janSmart').spec as { width?: number; height?: number } | undefined
    if (!spec) { flash('먼저 도해를 고른다'); return }
    const width = Math.max(240, Math.min(900, (spec.width || 520) + delta))
    const height = Math.max(120, Math.min(600, Math.round(width * ((spec.height || 200) / (spec.width || 520)))))
    editor.chain().focus().updateSmartArt({ width, height }).run()
  }
  /** 도해 항목을 늘리거나 줄인다 (워드 「도형 추가」) */
  const changeSmartItems = (delta: number) => {
    const spec = editor.getAttributes('janSmart').spec as { items?: string[] } | undefined
    if (!spec?.items) { flash('먼저 도해를 고른다'); return }
    const items = delta > 0
      ? [...spec.items, `항목 ${spec.items.length + 1}`]
      : spec.items.slice(0, Math.max(1, spec.items.length - 1))
    editor.chain().focus().updateSmartArt({ items }).run()
    flash(delta > 0 ? '항목을 더했다' : '항목을 뺐다')
  }

  /* === 워드 「레이아웃」 탭 — 개체 다루기 === */
  /** 지금 고른 개체(그림·도형·차트·도해)를 쪽 안에서 어디에 둘까 */
  const alignObject = (align: 'left' | 'center' | 'right') => {
    for (const type of ['janImage', 'image', 'janShape', 'janChart', 'janSmart', 'janModel3d']) {
      if (editor.isActive(type)) { editor.chain().focus().updateAttributes(type, { align }).run(); flash(`개체 ${align === 'left' ? '왼쪽' : align === 'right' ? '오른쪽' : '가운데'}`); return }
    }
    flash('먼저 그림·도형·차트 같은 개체를 고른다')
  }
  /** 글이 개체를 어떻게 피할까 (워드 「텍스트 줄 바꿈」) */
  const wrapObject = (wrap: string) => {
    for (const type of ['janImage', 'image', 'janShape', 'janChart', 'janSmart', 'janModel3d']) {
      if (editor.isActive(type)) { editor.chain().focus().updateAttributes(type, { wrap }).run(); flash('개체 줄 바꿈을 바꿨다'); return }
    }
    flash('먼저 그림·도형·차트 같은 개체를 고른다')
  }
  /** 개체를 90° 돌린다 */
  const rotateObject = () => {
    for (const type of ['janImage', 'janShape']) {
      if (editor.isActive(type)) {
        const now = Number(editor.getAttributes(type).rotate) || 0
        editor.chain().focus().updateAttributes(type, { rotate: (now + 90) % 360 }).run()
        flash('90° 돌렸다')
        return
      }
    }
    flash('그림·도형만 돌릴 수 있다')
  }

  /* === 워드 「디자인」 탭 === */
  const openDesign = (tab: 'styles' | 'background') =>
    window.dispatchEvent(new CustomEvent('jan-design-dialog', { detail: { tab } }))
  /** 지금 디자인을 새 문서의 기본값으로 (워드 「기본값으로 설정」) */
  const saveDesignDefault = () => {
    try {
      localStorage.setItem('jan-v2-design-default', JSON.stringify(useUIStore.getState().design))
      flash('이 디자인을 새 문서의 기본값으로 삼았습니다')
    } catch {
      flash('기본값을 저장하지 못했습니다')
    }
  }

  /* === 워드 「삽입」의 개체들 — 차트·스마트 도해·서명란·상호 참조·3D === */
  const openChart = () => window.dispatchEvent(new CustomEvent('jan-chart-dialog', { detail: { mode: editor.isActive('janChart') ? 'edit' : 'insert' } }))
  const openSmartArt = () => window.dispatchEvent(new CustomEvent('jan-smart-dialog', { detail: { mode: editor.isActive('janSmart') ? 'edit' : 'insert' } }))
  const openSignature = () => window.dispatchEvent(new CustomEvent('jan-signature-dialog', { detail: { mode: editor.isActive('janSignature') ? 'sign' : 'insert' } }))
  const openCrossRef = () => window.dispatchEvent(new Event('jan-xref-dialog'))
  /** 지금 커서가 놓인 표를 그대로 차트로 — 워드에 없는 지름길 */
  const chartFromTable = async () => {
    if (!editor.isActive('table')) { flash('먼저 표 안에 커서를 둔다'); return }
    const el = (editor.view.dom.querySelector('.tableWrapper table, table') as HTMLTableElement | null)
    const dom = (document.getSelection()?.anchorNode as HTMLElement | null)?.parentElement?.closest?.('table') || el
    if (!dom) { flash('표를 찾지 못했다'); return }
    const grid = [...dom.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => (c.textContent || '').trim()))
    const { specFromGrid } = await import('../lib/chartSpec')
    editor.chain().focus().insertChart(specFromGrid(grid)).run()
    flash('표를 차트로 만들었습니다 — 두 번 누르면 고칠 수 있다')
  }
  /** 3D 모델 파일 넣기 (GLB·STL·OBJ) */
  const insert3dModel = async () => {
    const { formatOf } = await import('../lib/model3d')
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.glb,.gltf,.stl,.obj'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const format = formatOf(file.name)
      if (!format) { flash('GLB·STL·OBJ 파일만 넣을 수 있다'); return }
      if (file.size > 24 * 1024 * 1024) { flash('24MB 보다 큰 모델은 문서가 무거워진다'); return }
      const reader = new FileReader()
      reader.onload = () => {
        editor.chain().focus().insertModel3d({ src: String(reader.result || ''), name: file.name, format }).run()
        flash('3D 모델을 넣었습니다 — 끌거나 화살표로 돌려 본다')
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }
  const insertPageBreak = () => insertHTML(PAGE_BREAK_HTML)
  const insertDateTime = () => {
    const d = new Date()
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    editor.chain().focus().insertContent(s).run()
  }
  const insertYouTube = async () => {
    const url = await askText('YouTube URL:', '', { placeholder: 'https://youtube.com/watch?v=...' }); if (!url) return
    const m = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
    if (!m) { flash('유효한 YouTube URL 이 아닙니다'); return }
    // 스키마에 div/iframe 이 없어 통삽입은 조용히 사라진다 — Embed 노드를 사용
    if (!editor.commands.setEmbed(`https://www.youtube.com/watch?v=${m[1]}`)) flash('임베드 삽입 실패')
  }

  /* === 논문 구성 요소 === */
  const insertAuthorBlock = () => insertHTML(`
<p style="text-align:center"><strong>저자 1<sup>1</sup>, 저자 2<sup>2</sup>, 교신저자 3<sup>1,*</sup></strong></p>
<p style="text-align:center"><sup>1</sup>소속 1, 도시, 국가 · <sup>2</sup>소속 2, 도시, 국가</p>
<p style="text-align:center"><sup>*</sup>교신저자: example@email.com</p><p></p>`)
  const insertAbstract = () => insertHTML(`
<blockquote><p><strong>ABSTRACT</strong></p><p>여기에 초록을 작성하세요. 연구 배경 · 방법 · 결과 · 결론을 200단어 내외로 요약합니다.</p></blockquote><p></p>`)
  const insertKeywords = () => insertHTML(`
<p class="paper-keywords" style="margin:0.5em 0 1em;font-size:0.95em;"><strong>KEYWORDS</strong>&nbsp;&nbsp;키워드1 · 키워드2 · 키워드3 · 키워드4 · 키워드5</p>`)
  const insertAcknowledgments = () => insertHTML(`
<h2 style="font-size:1.1em;margin-top:1.5em;">Acknowledgments</h2>
<p>본 연구는 [기관명/과제번호] 의 지원으로 수행되었습니다. ...</p>`)
  const insertFootnote = () => { insertFootnoteAt(editor) }
  /* 인용 표기는 적용한 양식을 따른다 — IEEE·Vancouver 는 본문 줄에 [n], 나머지는 위 첨자 (저자, 연도) */
  const numericCitation = ui.paperFormat === 'ieee' || ui.paperFormat === 'vancouver'
  const insertCitation = async () => {
    if (numericCitation) {
      const used = editor.view.dom.querySelectorAll('.paper-cite').length
      const n = await askText('인용 번호:', String(used + 1))
      if (n) insertHTML(`<span class="paper-cite">[${escHtml(n.replace(/[[\]]/g, ''))}]</span>`)
      return
    }
    const cite = await askText('인용 (예: Smith, 2024):', 'Author, 2024')
    if (cite) insertHTML(`<sup class="paper-cite">(${escHtml(cite)})</sup>`)
  }
  const insertReference = async () => {
    const ref = await askText('참고문헌 항목:', 'Author, A. (2024). Title. Journal, 1(1), 1-10.', { multiline: true })
    // div 도 class 도 스키마에 없어 통째로 벗겨진다 — 문단이 이미 허용하는 data-paper-block 을 쓴다
    if (ref) insertHTML(`<p data-paper-block="ref">${escHtml(ref)}</p>`)
  }

  /* === 논문 — 표준 양식·수식 번호·캡션·상호참조 === */
  const applyFormat = (key: string) => {
    applyPaperFormat(editor, key, true)
  }
  const eqNumbered = async () => {
    const latex = await askText('번호 수식 (LaTeX):', '', { placeholder: 'E = mc^2' })
    if (latex) { insertNumberedEquation(editor, latex); flash('번호 수식 삽입 — 참조는 "수식 참조"로') }
  }
  const crossRef = async (refType: 'eq' | 'fig' | 'tab') => {
    const label = refType === 'eq' ? '수식' : refType === 'fig' ? '그림' : '표'
    const total = paperTargetCount(editor, refType)
    if (total === 0) { flash(`참조할 ${label}이 없습니다 — 먼저 번호 ${label}을 삽입하세요`); return }
    const v = await askText(`${label} 참조 번호 (1~${total}):`, String(total))
    if (!v) return
    insertCrossRef(editor, refType, Math.round(Number(v)) || total)
  }
  const renumberAll = () => {
    renumberFootnotes(editor)
    renumberWithFeedback(editor)
  }
  const eqFromTemplate = async () => {
    const tpl = await pickMathTemplate()
    if (!tpl) return
    const latex = await askText('번호 수식 (LaTeX):', tpl, { placeholder: 'E = mc^2' })
    if (latex) insertNumberedEquation(editor, latex)
  }
  const runPaperLint = () => showLintReport(lintPaper(editor))
  const setRunningHeader = async () => {
    const header = await askText('머리글 ({page}/{total} 사용 가능):', ui.runningHeader)
    if (header === null) return
    const footer = await askText('꼬리말:', ui.runningFooter || 'Page {page} / {total}')
    if (footer === null) return
    ui.setRunningHeader(header)
    ui.setRunningFooter(footer)
    flash('머리글·꼬리말이 적용되었습니다')
  }

  /* === 페이지 설정 === */
  const orientationLabel = ui.pageOrientation === 'landscape' ? '가로' : '세로'
  const currentPaperLabel = PAPER_STYLES.find((style) => style.value === ui.paperStyle)?.label.replace(' (기본)', '') || '줄노트'
  const pageColumnLabel = `${ui.pageColumnCount || 1}단`
  const pageMarginLabel = pageMarginsSummary(ui.pageMarginsMm, ui.pageMarginMm)
  const viewLayoutLabel = ui.viewLayout === 'draft' ? '초안 모양' : '인쇄 모양'
  const openPageSettings = () => p.onPageSettings()

  /* === 책갈피 / 텍스트 상자 / 구분선 스타일 === */
  const insertBookmark = async () => {
     
    // eslint-disable-next-line react-hooks/purity -- 렌더가 아니라 사용자 동작(클릭/타이머)에서만 실행된다
    const id = await askText('책갈피 ID (앵커):', 'bm-' + Date.now()); if (!id) return
    // 스키마에 커스텀 앵커 노드가 없어 원시 HTML 은 텍스트로 노출된다 — 눈에 보이는 라벨로 삽입
    const safe = id.replace(/[<>&"]/g, '')
    insertHTML(`<span data-bookmark="${safe}" style="background:rgba(217,119,87,0.15);border-radius:3px;padding:0 4px;font-size:0.85em;">[${safe}]</span>&nbsp;`)
    flash(`책갈피 "${safe}" 를 삽입했습니다`)
  }
  const insertHrStyle = async () => {
    const s = await askText('구분선 스타일 — 1: 실선 · 2: 점선 · 3: 이중선 · 4: 별표', '1')
    const styles: Record<string, string> = {
      '1': '<hr data-variant="solid" />',
      '2': '<hr data-variant="dashed" />',
      '3': '<hr data-variant="double" />',
      '4': '<p style="text-align:center">＊ ＊ ＊</p>',
    }
    if (s && styles[s]) insertHTML(styles[s])
  }

  /* === CSV/TSV → 표 변환 (스프레드시트 붙여넣기) === */
  const insertTableFromCsv = async () => {
    const raw = await askText('표로 만들 데이터 붙여넣기 (엑셀/시트에서 복사한 그대로 — 탭·쉼표 자동 감지)', '', { multiline: true, placeholder: '이름,나이,직업\n김철수,29,개발자\n이영희,34,디자이너' })
    if (!raw || !raw.trim()) return
    const lines = raw.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '')
    if (lines.length === 0) return
    // 구분자 자동 감지: 탭 우선, 다음 쉼표, 다음 세미콜론
    const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(',') ? ',' : lines[0].includes(';') ? ';' : null
    const esc = (v: string) => v.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const rows = lines.map((l) => (delim ? l.split(delim) : [l]).map(esc))
    const cols = Math.max(...rows.map((r) => r.length))
    const norm = rows.map((r) => [...r, ...Array(Math.max(0, cols - r.length)).fill('')])
    const head = '<tr>' + norm[0].map((c) => `<th>${c}</th>`).join('') + '</tr>'
    const body = norm.slice(1).map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('')
    insertHTML(`<table>${head}${body}</table>`)
    flash(`표 변환 완료 — ${norm.length}행 × ${cols}열 (첫 행은 머리글)`)
  }

  /* === 특수 문자 === */
  const insertSymbol = () => setShowSymbolPop(true)

  /* === 문서 기본 조판 (한국어 타이포) — 문단마다가 아니라 문서 전체의 기본값 ===
     예전에는 <style> 태그를 끼워 넣어 저장도 안 되고 도구 상자에도 안 보였다.
     이제 문서 설정으로 두어 저장되고, 자간·장평 칸에 회색 기본값으로 보인다. */
  const setDocLetterSpacing = async () => {
    const cur = useTypographyStore.getState().letterSpacing
    const v = await askText('문서 기본 자간 (%) — 음수면 좁아진다', String(cur))
    if (v === null) return
    const n = Number(v)
    if (!Number.isFinite(n) || n < -50 || n > 100) { flash('-50 ~ 100 사이 숫자를 입력하세요'); return }
    useTypographyStore.getState().setLetterSpacing(n)
    flash(`문서 기본 자간 ${n}%`)
  }
  const setDocCharScale = async () => {
    const cur = useTypographyStore.getState().charScale
    const v = await askText('문서 기본 장평 (%) — 100 보다 작으면 홀쭉', String(cur))
    if (v === null) return
    const n = Number(v)
    if (!Number.isFinite(n) || n < 10 || n > 250) { flash('10 ~ 250 사이 숫자를 입력하세요'); return }
    useTypographyStore.getState().setCharScale(n)
    flash(`문서 기본 장평 ${n}%`)
  }
  const setDocTextIndent = async () => {
    const cur = useTypographyStore.getState().textIndent
    const v = await askText('첫 줄 들여쓰기 (글자 수) — 0 이면 들여쓰지 않는다', String(cur))
    if (v === null) return
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 20) { flash('0 ~ 20 사이 숫자를 입력하세요'); return }
    useTypographyStore.getState().setTextIndent(n)
    flash(n ? `첫 줄 ${n}글자 들여쓰기` : '첫 줄 들여쓰기 없음')
  }
  const toggleDocJustify = () => {
    const t = useTypographyStore.getState()
    const next = t.align === 'justify' ? 'left' : 'justify'
    t.setAlign(next)
    flash(next === 'justify' ? '문서 기본 양쪽 정렬' : '문서 기본 왼쪽 정렬')
  }
  const toggleFirstLineIndent = () => {
    const cur = localStorage.getItem('jan-first-line-indent') === '1'
    const next = !cur
    localStorage.setItem('jan-first-line-indent', next ? '1' : '0')
    const id = 'jan-first-line-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = next ? '.ProseMirror p { text-indent: 1.5em; }' : ''
  }
  const setParagraphSpacing = async () => {
    const v = await askText('단락 간격 (em) — 예: 0.8', localStorage.getItem('jan-para-space') || '0.6')
    if (v === null) return
    if (Number.isNaN(Number(v)) || Number(v) < 0) { flash('0 이상의 숫자를 입력하세요 (예: 0.8)'); return }
    localStorage.setItem('jan-para-space', v)
    const id = 'jan-para-space-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = `.ProseMirror p { margin: ${Number(v)}em 0; }`
  }
  const setTextEffect = async () => {
    if (editor.state.selection.empty) { flash('효과를 적용할 텍스트를 먼저 선택하세요'); return }
    const v = await askText('글자 효과 — 1: 그림자 · 2: 네온 · 3: 음각 · 0: 해제', '1')
    if (v === null) return
    const shadows: Record<string, string> = {
      '0': '',
      '1': '1px 1px 2px rgba(0,0,0,0.35)',
      '2': '0 0 4px #ff0, 0 0 8px #fc0',
      '3': '1px 1px 0 #fff, -1px -1px 0 #999',
    }
    if (shadows[v] === undefined) return
    // 선택 영역에만 적용 (전역 .ProseMirror 스타일은 실효 없고 문서 전체에 번짐)
    editor.chain().focus().setMark('textStyle', { textShadow: shadows[v] || null }).run()
    flash(v === '0' ? '글자 효과를 해제했습니다' : '선택 영역에 글자 효과를 적용했습니다')
  }
  const insertHighlightBox = () => insertHTML('<div data-callout data-kind="tip"><p><strong>강조 :</strong> 여기에 강조 내용을 작성하세요.</p></div>')

  /* === 미디어 / Web API === */
  const captureScreen = async () => {
    try {
      const stream = await getDisplayMedia({ video: true })
      const track = stream.getVideoTracks()[0]
      const cap = createImageCapture(track)
      const bitmap = await cap.grabFrame()
      const cv = document.createElement('canvas'); cv.width = bitmap.width; cv.height = bitmap.height
      cv.getContext('2d')!.drawImage(bitmap, 0, 0)
      track.stop()
      const dataUrl = cv.toDataURL('image/png')
      editor.chain().focus().setImage({ src: dataUrl }).run()
    } catch (e) { flash('화면 캡쳐 취소 또는 실패: ' + errText(e), 2600) }
  }
  const openGallery = () => {
    const root = document.querySelector('.ProseMirror'); if (!root) return
    const imgs = root.querySelectorAll('img')
    if (!imgs.length) { flash('현재 메모에 이미지가 없습니다'); return }
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    let html = `<!doctype html><html><head><title>갤러리</title><style>body{margin:0;background:#111;color:#fff;font-family:sans-serif;padding:1em;} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;} .grid img{width:100%;border-radius:4px;cursor:pointer;}</style></head><body><h2>갤러리 — ${imgs.length}개</h2><div class="grid">`
    imgs.forEach(img => { html += `<a href="${img.src}" target="_blank"><img src="${img.src}" /></a>` })
    html += '</div></body></html>'
    w.document.write(html); w.document.close()
  }
  const startVoiceInput = () => {
    const r = createSpeechRecognition()
    if (!r) { flash('이 브라우저는 음성 인식을 지원하지 않습니다'); return }
    r.lang = 'ko-KR'; r.interimResults = true; r.continuous = false
    let final = ''
    r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript } }
    r.onend = () => { if (final) editor.chain().focus().insertContent(final).run(); else flash('인식된 음성이 없습니다') }
    r.onerror = (e) => flash('음성 인식 오류: ' + e.error, 2600)
    r.start()
    flash('말하세요... (한 문장 인식 후 자동 종료)', 2600)
  }
  const speakSelection = () => {
    const sel = window.getSelection()?.toString() || editor.state.doc.textContent.slice(0, 1000)
    if (!sel) return
    const u = new SpeechSynthesisUtterance(sel); u.lang = 'ko-KR'; u.rate = 1.0
    speechSynthesis.cancel(); speechSynthesis.speak(u)
  }
  const recordAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream); const chunks: Blob[] = []
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        const ref = await saveDataUrlAsBlobRef(await fileToDataUrl(blob))
        editor.chain().focus().insertContent(`<audio controls src="${ref}" style="width:100%;margin:0.5em 0;"></audio><p></p>`).run()
        stream.getTracks().forEach(t => t.stop())
      }
      rec.start()
      const stop = () => { try { rec.stop() } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ } }
      /* Auto-stop after 30 sec or user click */
      setTimeout(stop, 30000)
      const overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#FAE100;color:#333;padding:16px 24px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:99999;font-weight:600;cursor:pointer;'
      overlay.textContent = '녹음 중... 클릭하면 정지'
      overlay.onclick = () => { stop(); overlay.remove() }
      document.body.appendChild(overlay)
      rec.onstart = () => {}
      rec.addEventListener('stop', () => overlay.remove())
    } catch (e) { flash('마이크 접근 실패: ' + errText(e), 2600) }
  }
  const aiImageStub = async () => {
    const prompt = await askText('AI 이미지 프롬프트 (Pollinations 무료 생성):', '오브젝트의 단순한 라인아트')
    if (!prompt) return
    const u = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`
    editor.chain().focus().setImage({ src: u, title: prompt }).run()
    flash('AI 이미지 생성 중 — 잠시 후 이미지가 나타납니다')
  }

  /* === 도구 === */
  const wordCloud = () => {
    const text = editor.state.doc.textContent
    const words: Record<string, number> = {}
    text.split(/[\s,.—()[\]{}!?;:'"-]+/).forEach(w => {
      w = w.trim(); if (w.length < 2) return
      words[w] = (words[w] || 0) + 1
    })
    const sorted = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 60)
    if (!sorted.length) { flash('워드 클라우드를 만들 단어가 없습니다'); return }
    const max = sorted[0][1]
    const w = window.open('', '_blank', 'width=900,height=600'); if (!w) return
     
    // eslint-disable-next-line react-hooks/purity -- 렌더가 아니라 사용자 동작(클릭/타이머)에서만 실행된다
    let html = `<!doctype html><html><head><title>워드 클라우드</title><style>body{font-family:sans-serif;padding:2em;line-height:2;text-align:center;background:#fff8e7;} span{display:inline-block;margin:0.2em 0.4em;color:hsl(${Math.random()*360},60%,40%);}</style></head><body><h2>워드 클라우드 — ${sorted.length}개</h2><div>`
    sorted.forEach(([word, n]) => { const sz = Math.round(12 + (n / max) * 36); html += `<span style="font-size:${sz}px;">${word}</span> ` })
    html += '</div></body></html>'; w.document.write(html); w.document.close()
  }
  const flashcards = () => {
    const root = document.querySelector('.ProseMirror'); if (!root) return
    const headings = root.querySelectorAll('h1, h2, h3'); const cards: { q: string, a: string }[] = []
    headings.forEach(h => {
      let next = h.nextElementSibling; let body = ''
      while (next && !/^H[1-3]$/.test(next.tagName)) { body += next.textContent + ' '; next = next.nextElementSibling }
      cards.push({ q: h.textContent || '', a: body.trim() })
    })
    if (!cards.length) { flash('제목(H1~H3)이 없어 플래시카드를 만들 수 없습니다'); return }
    const w = window.open('', '_blank', 'width=600,height=500'); if (!w) return
    w.document.write(`<!doctype html><html><head><title>플래시카드</title><style>body{font-family:sans-serif;padding:2em;background:#FFFBE5;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90vh;} .card{background:#fff;border:1px solid #ccc;border-radius:12px;padding:2em;width:80%;max-width:480px;box-shadow:0 4px 16px rgba(0,0,0,0.1);text-align:center;cursor:pointer;min-height:200px;display:flex;align-items:center;justify-content:center;} button{padding:0.6em 1.4em;margin:0.5em;background:#FAE100;border:0;border-radius:6px;font-weight:600;cursor:pointer;}</style></head><body><div class="card" id="c"></div><div><button id="prev">←</button> <span id="i">1</span>/${cards.length} <button id="next">→</button> <button id="flip">뒤집기</button></div><script>const cards=${JSON.stringify(cards)};let idx=0;let face=0;function show(){const c=cards[idx];document.getElementById('c').innerHTML=face?c.a:c.q;document.getElementById('i').textContent=idx+1;}show();document.getElementById('prev').onclick=()=>{idx=(idx-1+cards.length)%cards.length;face=0;show()};document.getElementById('next').onclick=()=>{idx=(idx+1)%cards.length;face=0;show()};document.getElementById('flip').onclick=()=>{face=1-face;show()};document.getElementById('c').onclick=()=>{face=1-face;show()};</script></body></html>`)
    w.document.close()
  }
  const startPomodoro = async () => {
    const v = await askText('포모도로 시간 (분):', '25', { placeholder: '예: 25' })
    if (v === null) return
    const min = Number(v)
    if (!min || min <= 0) { flash('1 이상의 숫자를 입력하세요'); return }
     
    // eslint-disable-next-line react-hooks/purity -- 렌더가 아니라 사용자 동작(클릭/타이머)에서만 실행된다
    const end = Date.now() + min * 60000
    const id = setInterval(() => {
      const left = Math.max(0, end - Date.now())
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000)
      const el = document.getElementById('jan-pomo-display') || (() => { const d = document.createElement('div'); d.id = 'jan-pomo-display'; d.title = '클릭하면 타이머 중단'; d.style.cssText = 'position:fixed;top:8px;right:8px;background:#FAE100;color:#333;padding:6px 12px;border-radius:6px;font-weight:700;z-index:9999;cursor:pointer;'; document.body.appendChild(d); return d })()
      el.textContent = `포모도로 ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      el.onclick = () => { clearInterval(id); el.remove(); flash('포모도로를 중단했습니다') }
      if (left <= 0) {
        clearInterval(id); el.remove()
        flash('포모도로 완료! 5분 휴식하세요', 4000)
        try { if ('Notification' in window && Notification.permission === 'granted') new Notification('포모도로 완료', { body: '5분 휴식하세요' }) } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
      }
    }, 500)
    try { if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission() } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
    flash(`포모도로 ${min}분 시작 — 우측 상단 타이머를 클릭하면 중단`)
  }
  const runDocHealth = () => showHealthReport(computeDocHealth(editor))


  /* === 파일 / 백업 === */
  const installApp = async () => {
    const ok = await install.trigger()
    flash(ok
      ? '앱으로 설치했습니다 — 이제 .jan 파일을 두 번 누르면 여기서 열립니다'
      : '설치를 취소했습니다', 2600)
  }
  const memoTitle = () => (useMemosStore.getState().current()?.title || '메모').trim() || '메모'
  const exportHwpx = async () => { try { await downloadHwpx(getSavableHtml(editor), memoTitle()) } catch (e) { flash('HWPX 실패: ' + errText(e), 2600) } }
  const exportMd = () => { try { downloadMd(getSavableHtml(editor), memoTitle()) } catch (e) { flash('MD 실패: ' + errText(e), 2600) } }
  const exportPdf = async () => { try { await exportToPdf(getSavableHtml(editor), memoTitle()) } catch (e) { flash('PDF 실패: ' + errText(e), 2600) } }
  /** LaTeX 내보내기 — Overleaf 에서 바로 열린다 (예전에 논문 탭에 따로 있던 것을 하나로 합쳤다) */
  const exportTex = () => {
    try { downloadLatex(getSavableHtml(editor), memoTitle()); flash('LaTeX(.tex) 내보내기 — Overleaf 에서 바로 열 수 있습니다') }
    catch (e) { flash('LaTeX 실패: ' + errText(e), 2600) }
  }
  /** 원클릭 전체 내보내기 — MD·HTML·LaTeX·HWPX·DOC 를 한 번에 (브라우저 다중 다운로드 차단 회피를 위해 순차 실행) */
  const exportAll = async () => {
    const title = memoTitle()
    const html = getSavableHtml(editor)
    const jobs: Array<[string, () => void | Promise<void>]> = [
      ['MD', () => downloadMd(html, title)],
      ['HTML', () => downloadHtmlFile(html, title)],
      ['LaTeX', () => downloadLatex(html, title)],
      ['HWPX', () => downloadHwpx(html, title)],
      ['DOC', () => downloadDocFile(html, title)],
    ]
    flash('5개 형식 내보내기 시작 (MD·HTML·LaTeX·HWPX·DOC)...', 2600)
    const failed: string[] = []
    for (const [name, job] of jobs) {
      try { await job() } catch { failed.push(name) }
      await new Promise((r) => setTimeout(r, 350))
    }
    flash(failed.length ? `완료 — 실패: ${failed.join(', ')}` : '모든 형식 내보내기 완료 (5개 파일)', 3000)
  }
  const exportHtml = () => downloadHtmlFile(getSavableHtml(editor), memoTitle())
  const exportDocx = () => downloadDocFile(getSavableHtml(editor), memoTitle())
  const exportJsonBackup = async () => {
    const json = await exportV2ToJson()
    const blob = new Blob([json], { type: 'application/json' })
     
    // eslint-disable-next-line react-hooks/purity -- 렌더가 아니라 사용자 동작(클릭/타이머)에서만 실행된다
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `JustANotepad-backup-${Date.now()}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 800)
    markBackupDone()
    flash('JSON 백업 저장 완료 — 백업 시각이 기록되었습니다', 2200)
  }
  const importJsonBackup = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json'
    inp.onchange = () => {
      const file = inp.files?.[0]; if (!file) return
      const r = new FileReader()
      r.onload = async () => {
        try {
          const result = await importV2FromJsonAsync(String(r.result))
          if (result.errors.length) {
            flash(`가져오기 오류 ${result.errors.length}개: ${result.errors[0]}`, 3200)
            return
          }
          flash(`백업 가져오기 완료: ${result.imported}개 항목 반영`, 2600)
        } catch (e) { flash('가져오기 실패: ' + errText(e), 3200) }
      }
      r.readAsText(file)
    }
    inp.click()
  }
  const importV1 = async () => {
    if (!(await askConfirm('v1 메모 가져오기', 'v1 의 localStorage 메모를 v2 로 가져옵니다. 진행하시겠습니까?', '가져오기'))) return
    try {
      /* v1 은 같은 origin 의 localStorage 에 'jan_memos' 같은 키로 저장 */
      const candidates = ['jan-memos', 'jan_memos', 'memos', 'sticky_memos']
      let imported = 0
      for (const k of candidates) {
        const raw = localStorage.getItem(k); if (!raw) continue
        try {
          const data = JSON.parse(raw)
          const list = Array.isArray(data) ? data : (data.memos || data.list || [])
          const store = useMemosStore.getState()
          list.forEach((m: LegacyMemoLike) => {
            if (store.newMemo && store.updateCurrent) {
              store.newMemo()
              store.updateCurrent({ title: m.title || m.t || '가져온 메모', content: m.content || m.html || m.body || '<p></p>' })
              imported++
            }
          })
        } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
      }
      flash(imported ? `${imported}개 가져오기 완료` : 'v1 메모를 찾지 못했습니다', 2600)
    } catch (e) { flash('실패: ' + errText(e), 3200) }
  }

  /* === 명령 팔레트 / 검색 등 === */
  const cmdPalette = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true }))

  /* 리본 버튼은 눌리면 바로 실행된다 (닫을 드롭다운이 없다) */
  function run(fn: () => void) { fn() }

  /* ============================================================
   * 8 카테고리 메뉴
   * ============================================================ */
  const rawGroups: MenuGroup[] = [

    /* 2. 서식 */
    {
      label: '서식', items: [
        /* 늘 보이는 서식 줄(굵게·기울임·색·맞춤·목록·들여쓰기)과 겹치는 단추는 두지 않는다.
           여기 남는 것은 「종류를 고르는 것」 과 「창을 여는 것」 — 리본을 접어도 기본 서식은 줄에 있다. */
        { divider: '글꼴', label: '' },
        {
          label: '밑줄 모양 고르기', short: '밑줄 모양', icon: 'underline',
          menu: [
            ...UNDERLINE_STYLES.map((u): MenuItem => ({
              label: u.label, icon: 'underline', onClick: () => run(() => { setUnderlineStyle(editor, u.key) }),
            })),
            { divider: '색', label: '' },
            { label: '빨강 밑줄', icon: 'underline', onClick: () => run(() => { setUnderlineStyle(editor, 'solid', '#ff0000') }) },
            { label: '파랑 밑줄', icon: 'underline', onClick: () => run(() => { setUnderlineStyle(editor, 'solid', '#0070c0') }) },
            { label: '밑줄 없애기', icon: 'close', onClick: () => run(() => { setUnderlineStyle(editor, null) }) },
          ],
        },
        {
          label: '대/소문자 바꾸기', short: '대소문자', icon: 'h1',
          menu: [
            { label: '문장의 첫 글자만 대문자로', onClick: () => run(() => { changeCase(editor, 'sentence') }) },
            { label: '모두 소문자로', onClick: () => run(() => { changeCase(editor, 'lower') }) },
            { label: '모두 대문자로', onClick: () => run(() => { changeCase(editor, 'upper') }) },
            { label: '각 낱말의 첫 글자를 대문자로', onClick: () => run(() => { changeCase(editor, 'capitalize') }) },
            { label: '대소문자 뒤집기', onClick: () => run(() => { changeCase(editor, 'toggle') }) },
          ],
        },
        {
          /* 서식 줄의 글자색 단추는 빠른 색 몇 가지, 이쪽은 워드의 색판 전체(테마 색 60 + 표준 색) —
             같은 일이지만 고르는 폭이 달라 둘 다 둔다. 이름으로 그 차이를 알린다. */
          label: '글자 색 자세히 (테마 색 · 표준 색)', short: '글자 색', icon: 'palette',
          panel: () => <ColorPalette noneLabel="자동 (검정)" noneValue="#000000" onPick={(c) => { editor.chain().focus().setColor(c || '#000000').run() }} />,
        },
        {
          label: '형광펜 색 자세히 (테마 색 · 표준 색)', short: '형광 색', icon: 'highlight',
          panel: () => <ColorPalette noneLabel="강조 없음" onPick={(c) => {
            if (c) editor.chain().focus().toggleHighlight({ color: c }).run()
            else editor.chain().focus().unsetHighlight().run()
          }} />,
        },
        {
          label: '문자 음영', short: '문자 음영', icon: 'fill',
          panel: () => <ColorPalette noneLabel="음영 없음" onPick={(c) => { setCharShading(editor, c) }} />,
        },
        {
          label: '문자 테두리', short: '문자 테두리', icon: 'box',
          panel: () => <ColorPalette noneLabel="테두리 없음" onPick={(c) => { setCharBorder(editor, c) }} />,
        },
        { label: '글자 효과 (그림자·외곽선)', short: '글자 효과', icon: 'sparkle', onClick: () => run(setTextEffect) },
        { label: '글자 모양 창 (자간·장평·효과)', short: '글자 모양', icon: 'settings', onClick: () => run(p.onTypo) },

        { divider: '단락', label: '' },
        {
          /* 켜고 끄기는 서식 줄에 있다 — 여기서는 「어떤 모양으로」 를 고른다 */
          label: '글머리 모양 고르기', short: '글머리 모양', icon: 'list-bullet',
          menu: BULLET_MARKS.map((b): MenuItem => ({
            label: b.label, icon: 'list-bullet', onClick: () => run(() => { setBulletStyle(editor, b.key) }),
          })),
        },
        {
          label: '번호 모양 고르기', short: '번호 모양', icon: 'list-numbered',
          menu: NUMBER_MARKS.map((n): MenuItem => ({
            label: n.label, icon: 'list-numbered', onClick: () => run(() => { setNumberStyle(editor, n.key) }),
          })),
        },
        {
          label: '줄 간격 · 문단 공백', short: '줄 간격', icon: 'paragraph',
          menu: [
            ...LINE_SPACINGS.map((v): MenuItem => ({
              label: `줄 간격 ${v.toFixed(2).replace(/\.00$/, '.0')}`, icon: 'paragraph',
              onClick: () => run(() => { setLineSpacing(editor, v) }),
            })),
            { divider: '문단 공백', label: '' },
            { label: '문단 앞에 공백 넣기', icon: 'chevron-up', onClick: () => run(() => { setParagraphSpace(editor, 'before', 12) }) },
            { label: '문단 앞 공백 없애기', icon: 'close', onClick: () => run(() => { setParagraphSpace(editor, 'before', null) }) },
            { label: '문단 뒤에 공백 넣기', icon: 'chevron-down', onClick: () => run(() => { setParagraphSpace(editor, 'after', 12) }) },
            { label: '문단 뒤 공백 없애기', icon: 'close', onClick: () => run(() => { setParagraphSpace(editor, 'after', null) }) },
            { label: '문단 모양 창 열기', icon: 'settings', onClick: () => run(p.onTypo) },
          ],
        },
        {
          label: '단락 음영', short: '단락 음영', icon: 'fill',
          panel: () => <ColorPalette noneLabel="음영 없음" onPick={(c) => { setParagraphShading(editor, c) }} />,
        },
        {
          label: '단락 테두리', short: '단락 테두리', icon: 'box',
          menu: PARA_BORDERS.map((b): MenuItem => ({
            label: b.label, icon: 'box', onClick: () => run(() => { setParagraphBorder(editor, b.key) }),
          })),
        },
        { label: '이 문단 첫 줄 들여쓰기 켬/끔', short: '첫 줄', icon: 'chevron-right', onClick: () => run(toggleFirstLineIndent) },

        { divider: '스타일', label: '' },
        { label: '제목 1', short: '제목 1', icon: 'h1', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run()) },
        { label: '제목 2', short: '제목 2', icon: 'h2', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run()) },
        { label: '제목 3', short: '제목 3', icon: 'h3', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run()) },
        { label: '표준 (일반 문단)', short: '표준', icon: 'paragraph', onClick: () => run(() => editor.chain().focus().setParagraph().run()) },
        {
          label: '스타일 갤러리', short: '스타일', icon: 'sparkle',
          menu: [
            { label: '표준', icon: 'paragraph', onClick: () => run(() => editor.chain().focus().setParagraph().unsetAllMarks().run()) },
            { label: '간격 없음', icon: 'paragraph', onClick: () => run(() => { setParagraphSpace(editor, 'before', null); setParagraphSpace(editor, 'after', null) }) },
            { label: '제목 1', icon: 'h1', onClick: () => run(() => editor.chain().focus().setHeading({ level: 1 }).run()) },
            { label: '제목 2', icon: 'h2', onClick: () => run(() => editor.chain().focus().setHeading({ level: 2 }).run()) },
            { label: '제목 3', icon: 'h3', onClick: () => run(() => editor.chain().focus().setHeading({ level: 3 }).run()) },
            { label: '부제 (연한 이탤릭)', icon: 'italic', onClick: () => run(() => editor.chain().focus().setParagraph().setItalic().setColor('#5b6270').run()) },
            { label: '약한 강조 (이탤릭)', icon: 'italic', onClick: () => run(() => editor.chain().focus().setItalic().run()) },
            { label: '강조 (굵게)', icon: 'bold', onClick: () => run(() => editor.chain().focus().setBold().run()) },
            { label: '강한 강조 (굵은 이탤릭)', icon: 'bold', onClick: () => run(() => editor.chain().focus().setBold().setItalic().run()) },
            { label: '인용 스타일 (블록 인용)', icon: 'quote', onClick: () => run(() => editor.chain().focus().toggleBlockquote().run()) },
            { label: '강한 인용 (음영 인용)', icon: 'quote', onClick: () => run(() => { editor.chain().focus().toggleBlockquote().run(); setParagraphShading(editor, '#f2f4f7') }) },
            { label: '약한 참조 (작은 회색)', icon: 'sup', onClick: () => run(() => editor.chain().focus().setColor('#8a8f98').setMark('textStyle', { fontSize: '9pt' }).run()) },
            { label: '강한 참조 (작은 굵은 강조색)', icon: 'sup', onClick: () => run(() => editor.chain().focus().setBold().setColor('#D97757').setMark('textStyle', { fontSize: '9pt' }).run()) },
            { label: '책 제목 (굵은 이탤릭 밑줄)', icon: 'file-text', onClick: () => run(() => { editor.chain().focus().setBold().setItalic().run(); setUnderlineStyle(editor, 'solid') }) },
            { label: '목록 단락 (들여쓴 문단)', icon: 'list-bullet', onClick: () => run(() => editor.chain().focus().indentParagraph().run()) },
          ],
        },
        {
          label: '내 스타일 적용 / 관리', short: '내 스타일', icon: 'star-on',
          onClick: () => run(() => showMyStylesPicker(editor)),
          menu: [
            { label: '지금 서식을 내 스타일로 저장', short: '스타일 저장', icon: 'star', onClick: () => run(async () => {
              const name = await askText('스타일 이름', '내 스타일')
              if (name) saveCurrentAsStyle(editor, name)
            }) },
          ],
        },

        { divider: '문서 기본값', label: '' },
        {
          label: '문서 기본 글자', short: '기본 글자', icon: 'paragraph',
          onClick: () => run(() => { void setDocLetterSpacing() }),
          menu: [
            { label: '문서 기본 장평', short: '장평', icon: 'paragraph', onClick: () => run(() => { void setDocCharScale() }) },
            { label: '문서 기본 양쪽 정렬 켬/끔', short: '양쪽 정렬', icon: 'align-justify', onClick: () => run(toggleDocJustify) },
          ],
        },
        {
          label: '문서 기본 문단', short: '기본 문단', icon: 'paragraph',
          onClick: () => run(setParagraphSpacing),
          menu: [
            { label: '문서 기본 첫 줄 들여쓰기', short: '첫 줄', icon: 'chevron-right', onClick: () => run(() => { void setDocTextIndent() }) },
            { label: '강조 배경 상자 넣기', short: '강조 상자', icon: 'box', onClick: () => run(insertHighlightBox) },
          ],
        },
        { label: '문서 스타일 창 열기', short: '문서 스타일', icon: 'palette', onClick: () => run(p.onTypo) },
      ],
    },

    /* 3. 삽입 — 워드처럼 「대표 단추 + ▾」 로 묶는다.
       늘어놓으면 스무 개가 넘어 눈이 헤매므로, 한 묶음에 대표 하나만 두고 나머지는 그 아래로 넣었다.
       (페이지 · 표 · 일러스트레이션 · 미디어 · 링크 · 메모) */
    {
      label: '삽입', items: [
        { divider: '페이지', label: '' },
        {
          short: '표지', label: '표지 넣기 (네 가지 모양)', icon: 'page',
          menu: COVER_STYLES.map((c): MenuItem => ({
            short: c.label, label: `표지: ${c.label} — ${c.hint}`, icon: 'page',
            onClick: () => run(async () => {
              const title = (await askText('표지 제목', '')) || ''
              if (!title) return
              const subtitle = (await askText('부제 (없으면 비워 둔다)', '')) || ''
              const author = (await askText('글쓴이', '')) || ''
              insertCover(editor, c.key, { title, subtitle, author, date: todayLabel() })
            }),
          })),
        },
        { short: '빈 쪽', label: '빈 쪽 넣기', icon: 'page', onClick: () => run(() => { insertBlankPage(editor) }) },
        { short: '쪽 나눔', label: '페이지 나누기', hint: 'Ctrl+Enter', icon: 'page-break', onClick: () => run(insertPageBreak) },

        { divider: '표', label: '' },
        {
          short: '표', label: '표 삽입 (격자에서 크기 고르기)', icon: 'table',
          onClick: () => run(() => { void insertTable() }),
          menu: [
            { short: '표 붙이기', label: '표로 붙여넣기 (CSV·엑셀 데이터)', icon: 'table', onClick: () => run(() => { void insertTableFromCsv() }) },
            { short: '표→차트', label: '표를 차트로 만들기', icon: 'chart', onClick: () => run(() => { void chartFromTable() }) },
          ],
        },

        { divider: '일러스트레이션', label: '' },
        {
          short: '그림', label: '그림 넣기 (파일에서)', icon: 'image',
          onClick: () => run(uploadImage),
          menu: [
            { short: '인터넷 주소', label: '그림 넣기 (인터넷 주소로)', icon: 'globe', onClick: () => run(insertImageURL) },
            { short: '스크린샷', label: '화면 캡쳐해서 넣기', icon: 'preview', onClick: () => run(captureScreen) },
            { short: '갤러리', label: '문서 안 그림 모아 보기', icon: 'image', onClick: () => run(openGallery) },
          ],
        },
        {
          short: '도형', label: '도형 · 아이콘 · 글맵시', icon: 'box',
          onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'insert' } }))),
          menu: [
            { short: '도형 갤러리', label: '도형 넣기 (갤러리)', icon: 'box', onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'insert' } }))) },
            { short: '아이콘', label: '아이콘 · 그리기마당', icon: 'star', onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'insert' } }))) },
          ],
        },
        { short: '3D 모델', label: '3D 모델 (GLB·STL·OBJ — 끌어서 돌려 본다)', icon: 'cube', onClick: () => run(() => { void insert3dModel() }) },
        { short: '스마트 도해', label: '스마트 도해 (SmartArt — 목록·절차·주기·계층)', icon: 'smart', onClick: () => run(openSmartArt) },
        {
          short: '차트', label: '차트 (막대·꺾은선·원·방사형 등 9가지)', icon: 'chart',
          onClick: () => run(openChart),
          menu: [
            { short: '표→차트', label: '표를 차트로 만들기', icon: 'chart', onClick: () => run(() => { void chartFromTable() }) },
            { short: '다이어그램', label: '다이어그램 (Mermaid)', icon: 'hash', onClick: () => run(async () => { const c = await askText('Mermaid 다이어그램:', 'graph TD\n  A-->B', { multiline: true }); if (c) editor.chain().focus().setMermaid(c).run() }) },
          ],
        },

        { divider: '미디어', label: '' },
        {
          short: '미디어', label: '비디오 · 임베드 · 소리 · 파일', icon: 'globe',
          onClick: () => run(insertYouTube),
          menu: [
            { short: '온라인 비디오', label: '온라인 비디오 (YouTube)', icon: 'globe', onClick: () => run(insertYouTube) },
            { short: '임베드', label: '임베드 URL (지도·문서·플레이어)', icon: 'globe', onClick: () => run(async () => { const u = await askText('임베드 URL (YouTube/Vimeo 등):'); if (u) editor.chain().focus().setEmbed(u).run() }) },
            { short: '음성 녹음', label: '음성 녹음', icon: 'mic', onClick: () => run(recordAudio) },
            { short: '음성 입력', label: '음성 입력 (받아쓰기)', icon: 'mic', onClick: () => run(startVoiceInput) },
            { short: '읽어주기', label: '읽어주기 (TTS)', icon: 'speaker', onClick: () => run(speakSelection) },
            { short: '파일 첨부', label: '파일 첨부', icon: 'paperclip', onClick: () => run(p.onAtt) },
          ],
        },

        { divider: '링크', label: '' },
        { short: '링크', label: '링크', hint: 'Ctrl+K', icon: 'link', onClick: () => run(toggleLink) },
        {
          /* 목차·각주·인용은 자료 탭, 개요 패널은 보기 탭이 맡는다 — 여기는 「가리키기」 만 */
          short: '책갈피', label: '책갈피 삽입 (이 자리에 이름 붙이기)', icon: 'pin',
          onClick: () => run(insertBookmark),
          menu: [
            { short: '상호 참조', label: '상호 참조 (표·그림·제목을 가리킨다 — 번호가 밀려도 따라간다)', icon: 'link', onClick: () => run(openCrossRef) },
          ],
        },

      ],
    },

    /* 3.2 텍스트 — 글에 얹는 것들 (머리글/바닥글 · 텍스트 · 기호 · 글자 꾸밈 · 상자 · 자동 입력).
       삽입 탭이 스무 칸을 넘겨 두 탭으로 나눴다 — 넣는 「물건」 과 글에 붙는 「꾸밈」 의 경계다. */
    {
      label: '텍스트', items: [
        { divider: '머리글 · 바닥글', label: '' },
        { short: '머리글', label: '머리글 · 바닥글 (쪽마다 되풀이되는 줄)', icon: 'pin', onClick: () => run(setRunningHeader) },
        { short: '쪽 번호', label: '페이지 번호 모양 · 시작 번호', icon: 'hash', onClick: () => run(() => { sessionStorage.setItem('jan-page-focus', '쪽번호'); openPageSettings() }) },

        { divider: '텍스트', label: '' },
        {
          short: '글상자', label: '글상자 (텍스트 상자)', icon: 'box',
          onClick: () => run(() => { insertShape(editor, 'textbox', 'rect') }),
          menu: [
            { short: '세로 글상자', label: '세로쓰기 글상자', icon: 'box', onClick: () => run(() => { insertShape(editor, 'textbox', 'rect', { textDir: 'vertical', width: 140, height: 260 }) }) },
            { short: '글맵시', label: '글맵시 (WordArt)', icon: 'sparkle', onClick: () => run(() => { insertShape(editor, 'wordart', 'arch-up') }) },
          ],
        },
        { short: '문서 요소', label: '빠른 문서 요소 (템플릿·상용구)', icon: 'file-plus', onClick: () => run(p.onTemplates) },
        {
          short: '드롭캡', label: '단락의 첫 문자 장식 (드롭캡)', icon: 'h1',
          onClick: () => run(() => { setDropCap(editor, currentDropCap(editor) === 3 ? null : 3) }),
          menu: [
            { short: '3줄', label: '드롭캡 3줄', icon: 'h1', onClick: () => run(() => { setDropCap(editor, 3) }) },
            { short: '2줄', label: '드롭캡 2줄', icon: 'h2', onClick: () => run(() => { setDropCap(editor, 2) }) },
            { short: '4줄', label: '드롭캡 4줄', icon: 'h3', onClick: () => run(() => { setDropCap(editor, 4) }) },
            { short: '없애기', label: '드롭캡 없애기', icon: 'close', onClick: () => run(() => { setDropCap(editor, null) }) },
          ],
        },
        { short: '서명란', label: '서명란 (서명인·직함·날짜 — 그 자리에서 서명까지)', icon: 'signature', onClick: () => run(openSignature) },
        { short: '날짜', label: '날짜/시간', icon: 'clock', onClick: () => run(insertDateTime) },
        {
          short: '누름틀', label: '누름틀 (서식 채우는 칸)', icon: 'box',
          onClick: () => run(async () => {
            const guide = (await askText('안내문 — 빈칸에 뭘 쓸지 알려 주는 말', '이름을 쓴다')) || ''
            if (!guide) return
            const memo = (await askText('작성 지침 (없으면 비워 둔다)', '')) || ''
            insertField(editor, guide, memo)
          }),
          menu: [
            { short: '넣기', label: '누름틀 넣기 (서식 채우는 칸)', icon: 'box', onClick: () => run(async () => {
              const guide = (await askText('안내문 — 빈칸에 뭘 쓸지 알려 주는 말', '이름을 쓴다')) || ''
              if (!guide) return
              const memo = (await askText('작성 지침 (없으면 비워 둔다)', '')) || ''
              insertField(editor, guide, memo)
            }) },
            { short: '다음 칸', label: '다음 누름틀로', icon: 'chevron-down', onClick: () => run(() => { gotoNextField(editor) }) },
          ],
        },

        { divider: '기호', label: '' },
        { short: '수식', label: '수식 — 수식 스튜디오 (전 분야)', icon: 'hash', onClick: () => run(() => setMathStudio({ initial: '' })) },
        {
          short: '기호', label: '문자표 (이름으로 찾기 · 최근 문자)', hint: 'Ctrl+F10', icon: 'hash',
          onClick: () => run(() => window.dispatchEvent(new Event('jan-symbol-panel'))),
          menu: [
            { short: '특수 문자', label: '특수 문자', icon: 'sparkle', onClick: () => run(insertSymbol) },
          ],
        },

        { divider: '글자 꾸밈', label: '' },
        {
          short: '덧말', label: '덧말 넣기 (루비 — 글자 위·아래)', icon: 'sup',
          onClick: () => run(async () => {
            const base = selectedText(editor) || (await askText('본말 — 덧말을 달 글자', '')) || ''
            if (!base) return
            const note = (await askText('덧말 — 위에 작게 붙일 말', '')) || ''
            if (note) insertRuby(editor, base, note, 'over')
          }),
          menu: [
            { short: '위에', label: '덧말 넣기 (루비 — 글자 위)', icon: 'sup', onClick: () => run(async () => {
              const base = selectedText(editor) || (await askText('본말 — 덧말을 달 글자', '')) || ''
              if (!base) return
              const note = (await askText('덧말 — 위에 작게 붙일 말', '')) || ''
              if (note) insertRuby(editor, base, note, 'over')
            }) },
            { short: '아래에', label: '덧말 넣기 (글자 아래)', icon: 'sup', onClick: () => run(async () => {
              const base = selectedText(editor) || (await askText('본말 — 덧말을 달 글자', '')) || ''
              if (!base) return
              const note = (await askText('덧말 — 아래에 작게 붙일 말', '')) || ''
              if (note) insertRuby(editor, base, note, 'under')
            }) },
          ],
        },
        {
          short: '강조점', label: '강조점 (글자 위·아래의 점)', icon: 'dot',
          onClick: () => run(() => { setEmphasis(editor, 'dot') }),
          menu: [
            ...EMPHASIS_MARKS.map((m): MenuItem => ({ short: m.label, label: '강조점: ' + m.label, icon: 'dot', onClick: () => run(() => { setEmphasis(editor, m.key) }) })),
            { short: '아래에', label: '강조점 (글자 아래)', icon: 'dot', onClick: () => run(() => { setEmphasis(editor, 'dot', 'under') }) },
            { short: '없애기', label: '강조점 없애기', icon: 'close', onClick: () => run(() => { setEmphasis(editor, null) }) },
          ],
        },
        { short: '글자 겹치기', label: '글자 겹치기 (최대 9자)', icon: 'box', onClick: () => run(async () => {
          const chars = (await askText('겹칠 글자 — 최대 9자 (예: 주)', selectedText(editor) || '주')) || ''
          if (!chars) return
          const frame = (await askText('테두리 — ' + OVERLAP_FRAMES.map((f) => f.key).join(' · '), 'circle')) || 'circle'
          insertOverlap(editor, chars, frame)
        }) },

        { divider: '목록 · 상자', label: '' },
        {
          short: '리스트', label: '체크리스트 · 인용 · 코드 블록', icon: 'list-check',
          onClick: () => run(() => editor.chain().focus().toggleList('taskList', 'taskItem').run()),
          menu: [
            { short: '체크리스트', label: '체크리스트', icon: 'list-check', onClick: () => run(() => editor.chain().focus().toggleList('taskList', 'taskItem').run()) },
            { short: '인용', label: '인용', icon: 'quote', onClick: () => run(() => editor.chain().focus().toggleBlockquote().run()) },
            { short: '코드 블록', label: '코드 블록', icon: 'code', onClick: () => run(() => editor.chain().focus().toggleCodeBlock().run()) },
          ],
        },
        {
          short: '상자', label: '콜아웃 상자 (정보·경고)', icon: 'info',
          onClick: () => run(() => editor.chain().focus().setCallout('info').run()),
          menu: [
            { short: '정보 상자', label: '콜아웃 (정보)', icon: 'info', onClick: () => run(() => editor.chain().focus().setCallout('info').run()) },
            { short: '경고 상자', label: '콜아웃 (경고)', icon: 'bell', onClick: () => run(() => editor.chain().focus().setCallout('warn').run()) },
          ],
        },
        {
          short: '구분선', label: '구분선 넣기', icon: 'minus',
          onClick: () => run(insertHr),
          menu: [
            { short: '기본', label: '구분선', icon: 'minus', onClick: () => run(insertHr) },
            { short: '모양 고르기', label: '구분선 스타일', icon: 'minus', onClick: () => run(insertHrStyle) },
          ],
        },

        { divider: '자동 입력', label: '' },
        { short: '템플릿', label: '템플릿 (문서 틀 고르기)', icon: 'file-plus', onClick: () => run(p.onTemplates) },
        { short: '스니펫', label: '스니펫 (자주 쓰는 토막글)', icon: 'file-text', onClick: () => run(p.onSnippets) },
        { short: '매크로', label: '매크로 (여러 명령 묶어 실행)', icon: 'cmd', onClick: () => run(p.onMacros) },
      ],
    },

    /* 3.3 자료 — 워드 「참조」 탭 (목차 · 각주/미주 · 인용 · 캡션 · 색인 · 근거 목차) */
    {
      label: '자료', items: [
        { divider: '목차', label: '' },
        {
          short: '목차', label: '목차 넣기 (제목에서 만든다)', icon: 'list-numbered',
          onClick: () => run(() => { putToc(editor) }),
          menu: [
            { short: '3수준', label: '목차 넣기 (제목 1~3수준)', icon: 'list-numbered', onClick: () => run(() => { putToc(editor, { maxLevel: 3 }) }) },
            { short: '2수준', label: '목차 넣기 (제목 1~2수준)', icon: 'list-numbered', onClick: () => run(() => { putToc(editor, { maxLevel: 2 }) }) },
            { short: '쪽번호 없이', label: '목차 넣기 (쪽 번호 없이)', icon: 'list-bullet', onClick: () => run(() => { putToc(editor, { pageNumbers: false }) }) },
            { short: '고쳐 넣기', label: '목차 고쳐 넣기 (바뀐 제목으로 다시)', icon: 'refresh-cw', onClick: () => run(() => { putToc(editor) }) },
          ],
        },
        {
          short: '목차에 넣기', label: '이 문단을 목차에 넣기 (제목 수준으로)', icon: 'plus',
          onClick: () => run(() => { addToToc(editor, 2) }),
          menu: [1, 2, 3].map((lv): MenuItem => ({
            short: `${lv}수준`, label: `이 문단을 목차 ${lv}수준으로`, icon: 'plus',
            onClick: () => run(() => { addToToc(editor, lv) }),
          })),
        },
        {
          short: '모두 새로', label: '심어 둔 목록 모두 새로 만들기 (목차·색인·참고 문헌…)', icon: 'refresh-cw',
          onClick: () => run(() => { refreshAllFields(editor, loadSources(), citeStyle()) }),
          menu: [
            { short: '번호 모두', label: '번호 모두 다시 매기기 (각주·캡션·수식·참조)', icon: 'hash', onClick: () => run(renumberAll) },
            { short: '각주 번호', label: '각주 번호만 다시 매기기', icon: 'hash', onClick: () => run(() => { renumberFootnotes(editor); flash('각주 번호를 다시 매겼습니다') }) },
            { short: '캡션 번호', label: '캡션·수식 번호만 다시 매기기', icon: 'hash', onClick: () => run(() => { renumberWithFeedback(editor) }) },
          ],
        },

        { divider: '각주 · 미주', label: '' },
        { short: '각주', label: '각주 삽입 (쪽 아래에 모인다)', icon: 'sup', hint: 'Ctrl+Alt+F', onClick: () => run(insertFootnote) },
        { short: '미주', label: '미주 삽입 (문서 끝에 모인다)', icon: 'sup', onClick: () => run(() => { insertEndnote(editor) }) },
        {
          short: '주석 이동', label: '다음 각주로 이동', icon: 'chevron-down',
          onClick: () => run(() => { gotoNextNote(editor, 'footnote') }),
          menu: [
            { short: '다음 미주', label: '다음 미주로 이동', icon: 'chevron-down', onClick: () => run(() => { gotoNextNote(editor, 'endnote') }) },
            { short: '각주 자리', label: '각주 모인 자리 보기', icon: 'eye', onClick: () => run(() => { gotoNoteArea(editor, 'footnote') }) },
            { short: '미주 자리', label: '미주 모인 자리 보기', icon: 'eye', onClick: () => run(() => { gotoNoteArea(editor, 'endnote') }) },
          ],
        },

        { divider: '인용 · 참고 문헌', label: '' },
        {
          short: '출처 관리', label: '출처 관리 — 인용과 참고 문헌의 밑자료', icon: 'folder',
          onClick: () => run(openSources),
          menu: [
            { short: '항목 추가', label: '참고문헌 항목 직접 적어 넣기', icon: 'file-text', onClick: () => run(insertReference) },
            { short: '번호식 인용', label: '번호식 인용 넣기 [n] (학술 양식)', icon: 'quote', onClick: () => run(insertCitation) },
          ],
        },
        {
          short: '표기 방식', label: `인용 표기 방식: ${citeStyle()}`, icon: 'sliders',
          menu: CITE_STYLES.map((st): MenuItem => ({
            short: st, label: `인용 표기 방식: ${st}`, icon: 'sliders',
            onClick: () => run(() => { setCiteStyle(st); flash(`표기 방식 — ${st}`) }),
          })),
        },
        { short: '참고 문헌', label: '참고 문헌 목록 넣기 / 고쳐 넣기', icon: 'list-bullet', onClick: () => run(() => { putBibliography(editor, loadSources(), citeStyle()) }) },

        { divider: '캡션 · 참조', label: '' },
        {
          short: '캡션', label: '캡션 넣기 (그림·표에 번호와 설명)', icon: 'image-text',
          onClick: () => run(() => { void insertCaption('figure') }),
          menu: [
            { short: '그림 캡션', label: '그림 캡션 넣기 (그림 n)', icon: 'image-text', onClick: () => run(() => { void insertCaption('figure') }) },
            { short: '표 캡션', label: '표 캡션 넣기 (표 n)', icon: 'table', onClick: () => run(() => { void insertCaption('table') }) },
          ],
        },
        {
          short: '상호 참조', label: '상호 참조 (표·그림·제목을 가리킨다)', icon: 'link',
          onClick: () => run(openCrossRef),
          menu: [
            { short: '수식', label: '수식 참조 넣기 (식 n)', icon: 'hash', onClick: () => run(() => { void crossRef('eq') }) },
            { short: '그림', label: '그림 참조 넣기 (그림 n)', icon: 'image', onClick: () => run(() => { void crossRef('fig') }) },
            { short: '표', label: '표 참조 넣기 (표 n)', icon: 'table', onClick: () => run(() => { void crossRef('tab') }) },
          ],
        },
        {
          short: '그림·표', label: '그림 목차 넣기 / 고쳐 넣기', icon: 'image',
          onClick: () => run(() => { putCaptionList(editor, 'figure') }),
          menu: [
            { short: '표 목차', label: '표 목차 넣기 / 고쳐 넣기', icon: 'table', onClick: () => run(() => { putCaptionList(editor, 'table') }) },
          ],
        },

        { divider: '색인 · 근거', label: '' },
        {
          short: '색인', label: '색인 항목 표시 (고른 말을 색인에 넣는다)', icon: 'tag',
          onClick: () => run(() => { void markIndex() }),
          menu: [
            { short: '색인 넣기', label: '색인 넣기 / 고쳐 넣기', icon: 'list-bullet', onClick: () => run(() => { putIndex(editor) }) },
          ],
        },
        {
          short: '근거', label: '근거 표시 (법령·판례를 근거 목차에 넣는다)', icon: 'shield',
          onClick: () => run(() => { void markAuth() }),
          menu: [
            { short: '근거 목차', label: '근거 목차 넣기 / 고쳐 넣기', icon: 'list-bullet', onClick: () => run(() => { putAuthorityList(editor) }) },
          ],
        },

      ],
    },

    /* 3.5 논문 — 학술 원고에만 있는 것들.
       자료 탭(워드 「참조」)과 겹치지 않게, 여기에는 「논문이라서 필요한 것」 만 둔다:
       학회 양식 · 논문 구성 요소 · 번호 수식과 식 참조 · DOI·BibTeX 인용 · 제출 전 점검. */
    {
      label: '논문', items: [
        { divider: '학회 양식', label: '' },
        {
          short: '표준 양식', label: '학술 표준 양식 입히기 (뼈대까지 함께)', icon: 'file-text',
          onClick: () => run(() => applyFormat(PAPER_FORMATS[0].key)),
          menu: PAPER_FORMATS.map((f): MenuItem => ({
            short: f.label, label: f.label, icon: 'file-text',
            onClick: () => run(() => applyFormat(f.key)),
          })),
        },
        { short: '러닝 헤더', label: '러닝 헤더 · 꼬리말 (쪽마다 되풀이)', icon: 'pin', onClick: () => run(setRunningHeader) },

        { divider: '논문 구성 요소', label: '' },
        { short: '저자', label: '저자 · 소속 · 교신 블록', icon: 'user', onClick: () => run(insertAuthorBlock) },
        { short: '초록', label: 'Abstract (초록) 박스', icon: 'file-text', onClick: () => run(insertAbstract) },
        { short: '키워드', label: 'Keywords (키워드) 블록', icon: 'hash', onClick: () => run(insertKeywords) },
        {
          short: '더 넣기', label: '그 밖의 구성 요소 넣기', icon: 'file-plus',
          onClick: () => run(insertAcknowledgments),
          menu: [
            { short: '감사의 말', label: 'Acknowledgments (감사의 말)', icon: 'heart', onClick: () => run(insertAcknowledgments) },
            { short: '기여도', label: 'CRediT 저자 기여도', icon: 'user', onClick: () => run(() => insertCreditBlock(editor)) },
            { short: '이해상충', label: '이해상충 선언 (COI)', icon: 'shield', onClick: () => run(() => insertCoiBlock(editor)) },
            { short: '자료 공개', label: 'Data Availability (자료 공개)', icon: 'download', onClick: () => run(() => insertDataAvailabilityBlock(editor)) },
            { short: '약어 목록', label: '약어 목록 자동 뽑기 (본문에서 찾아 모은다)', icon: 'hash', onClick: () => run(() => insertAcronymList(editor)) },
            { short: '그림 목록', label: '그림 목록 (List of Figures)', icon: 'image', onClick: () => run(() => insertListOfFigures(editor)) },
            { short: '표 목록', label: '표 목록 (List of Tables)', icon: 'table', onClick: () => run(() => insertListOfTables(editor)) },
          ],
        },

        { divider: '번호 수식 · 참조', label: '' },
        { short: '번호 수식', label: '번호 붙은 수식 넣기 (n) — 식 참조가 따라간다', icon: 'hash', onClick: () => run(() => { void eqNumbered() }) },
        {
          short: '수식 틀', label: '수식 틀에서 고르기 (분수·적분·행렬 — LaTeX 문법으로 쓴다)', icon: 'hash',
          onClick: () => run(() => { void eqFromTemplate() }),
          menu: MATH_TEMPLATES.slice(0, 10).map((t): MenuItem => ({
            short: t.label, label: `수식 틀: ${t.label}`, icon: 'hash',
            onClick: () => run(() => insertMathTemplate(t.latex)),
          })),
        },
        {
          short: '식 참조', label: '수식 참조 넣기 (식 n)', icon: 'link',
          onClick: () => run(() => { void crossRef('eq') }),
          menu: [
            { short: '식', label: '수식 참조 넣기 (식 n)', icon: 'hash', onClick: () => run(() => { void crossRef('eq') }) },
            { short: '그림', label: '그림 참조 넣기 (그림 n)', icon: 'image', onClick: () => run(() => { void crossRef('fig') }) },
            { short: '표', label: '표 참조 넣기 (표 n)', icon: 'table', onClick: () => run(() => { void crossRef('tab') }) },
          ],
        },
        { short: '번호 정리', label: '번호 모두 다시 매기기 (각주·캡션·수식·참조)', icon: 'refresh-cw', onClick: () => run(renumberAll) },

        { divider: '학술 인용 (DOI · BibTeX)', label: '' },
        { short: '인용 관리', label: `인용 관리 창 — DOI·제목으로 불러오기 (지금 ${citationCount()}건)`, icon: 'folder', onClick: () => run(p.onPaper) },
        {
          short: '표기 방식', label: `학술 표기 방식: ${CITATION_STYLES.find((c) => c.value === citationStyle())?.label || citationStyle()}`, icon: 'sliders',
          menu: CITATION_STYLES.map((c): MenuItem => ({
            short: c.label, label: `학술 표기 방식: ${c.label}`, icon: 'sliders',
            onClick: () => run(() => { setCitationStyle(c.value as CitationStyle); flash(`학술 표기 — ${c.label}`) }),
          })),
        },
        { short: '.bib 열기', label: 'BibTeX(.bib) 가져오기 — Scholar·Zotero 글을 인용 목록에 보탠다', icon: 'upload', onClick: () => run(() => { void askBibtex() }) },
        { short: '.bib 저장', label: '인용 목록을 .bib 파일로 저장 — Overleaf 에서 바로 쓴다', icon: 'download', onClick: () => run(() => { exportBibtex(memoTitle()) }) },

        { divider: '제출 전', label: '' },
        { short: '논문 검사', label: '논문 검사 (제출 전 자동 점검)', icon: 'shield', onClick: () => run(runPaperLint) },
        {
          /* 「LaTeX」 만 적어 두면 수식 문법과 헷갈린다 — 이 단추는 문서 전체를 .tex 파일로 내보낸다.
             수식을 쓰는 것은 「수식 틀」·수식 스튜디오 쪽이다 (거기서도 LaTeX 문법을 쓴다). */
          short: '.tex 저장', label: '문서 전체를 LaTeX(.tex) 파일로 저장 — Overleaf 에 올려 조판한다', icon: 'download',
          onClick: () => run(exportTex),
        },
      ],
    },

    /* 3.6 도구 — 문서에 넣는 것이 아니라 「따로 창을 열어 만들고 적는」 앱 도구.
       예전에는 머리부 더보기(⋯) 안에만 있어 아무도 찾지 못했다. */
    {
      label: '도구', items: [
        { divider: '만들기', label: '' },
        { short: '그림판', label: '그림판 (그리기·손글씨·도형)', icon: 'paint', help: 'paint', onClick: () => run(p.onPaint) },
        { short: '글자 인식', label: '글자 인식 (그림에서 글 뽑기 · OCR)', icon: 'image-text', help: 'ocr', onClick: () => run(p.onOcr) },
        { short: '변환', label: '이미지 변환 (크기·형식 바꿔 내려받기)', icon: 'image', help: 'image-convert', onClick: () => run(openImageConvert) },
        { short: '명함', label: '명함 · 카드 만들기', icon: 'cards', help: 'cards', onClick: () => run(p.onCards) },

        { divider: '기록', label: '' },
        { short: '회의 노트', label: '회의 노트 (녹음 + 받아쓰기)', icon: 'users', help: 'meeting', onClick: () => run(p.onMeetingNotes) },
        { short: '강의 노트', label: '강의 노트 (녹음 + 받아쓰기)', icon: 'mic', help: 'lecture', onClick: () => run(p.onLectureNotes) },
        { short: '빠른 메모', label: '빠른 메모 (작은 창에 바로 적기)', hint: 'Ctrl+Shift+J', icon: 'page', help: 'quick-memo', onClick: () => run(p.onQuick) },
        { short: '포스트잇', label: '포스트잇 (JustPin — 화면에 붙여 두기)', icon: 'pin', help: 'postit', onClick: () => run(p.onPostit) },
      ],
    },

    /* 3.4 차트 상황 탭 — 차트를 고르면 뜬다 (워드 「차트 디자인·서식」) */
    {
      label: '차트 도구', items: [
        { divider: '종류와 데이터', label: '' },
        { short: '데이터', label: '데이터 고치기 (표·종류·서식 창)', icon: 'table', onClick: () => run(openChart) },
        {
          short: '종류', label: '차트 종류 바꾸기', icon: 'chart',
          menu: CHART_TYPES.map((t): MenuItem => ({
            short: t.label, label: `차트 종류: ${t.label} — ${t.hint}`, icon: 'chart',
            onClick: () => run(() => { editor.chain().focus().updateChart({ type: t.key }).run(); flash(`차트 — ${t.label}`) }),
          })),
        },

        { divider: '차트 스타일', label: '' },
        {
          short: '스타일', label: '차트 스타일 고르기', icon: 'sparkle',
          menu: CHART_STYLES.map((st): MenuItem => ({
            short: st.label, label: `차트 스타일: ${st.label}`, icon: 'sparkle',
            onClick: () => run(() => { editor.chain().focus().updateChart({ ...st.patch, chartStyle: st.key }).run(); flash(`차트 스타일 — ${st.label}`) }),
          })),
        },
        {
          short: '색', label: '차트 색 바꾸기', icon: 'palette',
          menu: Object.keys(CHART_PALETTES).map((k): MenuItem => ({
            short: k, label: `차트 색: ${k}`, icon: 'palette',
            onClick: () => run(() => { editor.chain().focus().updateChart({ palette: k }).run(); flash(`차트 색 — ${k}`) }),
          })),
        },

        { divider: '차트 요소', label: '' },
        {
          short: '범례', label: '범례 자리', icon: 'menu',
          menu: [
            { short: '아래', label: '범례: 아래', icon: 'menu', onClick: () => run(() => editor.chain().focus().updateChart({ legend: 'bottom' }).run()) },
            { short: '위', label: '범례: 위', icon: 'menu', onClick: () => run(() => editor.chain().focus().updateChart({ legend: 'top' }).run()) },
            { short: '오른쪽', label: '범례: 오른쪽', icon: 'menu', onClick: () => run(() => editor.chain().focus().updateChart({ legend: 'right' }).run()) },
            { short: '없음', label: '범례: 없음', icon: 'close', onClick: () => run(() => editor.chain().focus().updateChart({ legend: 'none' }).run()) },
          ],
        },
        { short: '값 표시', label: '데이터 레이블 켜고 끄기', icon: 'hash', onClick: () => run(() => {
          const now = !!(editor.getAttributes('janChart').spec as { valueLabels?: boolean } | undefined)?.valueLabels
          editor.chain().focus().updateChart({ valueLabels: !now }).run()
          flash(now ? '값 표시를 껐다' : '값을 표시한다')
        }) },
        { short: '눈금선', label: '눈금선 켜고 끄기', icon: 'table', onClick: () => run(() => {
          const now = (editor.getAttributes('janChart').spec as { grid?: boolean } | undefined)?.grid !== false
          editor.chain().focus().updateChart({ grid: !now }).run()
        }) },
        {
          short: '추세선', label: '추세선 추가', icon: 'chart',
          menu: TREND_LINES.map((t): MenuItem => ({
            short: t.label, label: `추세선: ${t.label}${t.hint ? ' — ' + t.hint : ''}`, icon: 'chart',
            onClick: () => run(() => { editor.chain().focus().updateChart({ trend: t.key }).run(); flash(`추세선 — ${t.label}`) }),
          })),
        },
        {
          short: '숫자 표기', label: '축 숫자 표기', icon: 'hash',
          menu: CHART_NUMBER_FORMATS.map((f): MenuItem => ({
            short: f.label, label: `숫자 표기: ${f.label} (${f.hint})`, icon: 'hash',
            onClick: () => run(() => { editor.chain().focus().updateChart({ numberFormat: f.key }).run() }),
          })),
        },
        { short: '쌓기', label: '쌓아 보기 켜고 끄기', icon: 'columns', onClick: () => run(() => {
          const now = !!(editor.getAttributes('janChart').spec as { stacked?: boolean } | undefined)?.stacked
          editor.chain().focus().updateChart({ stacked: !now }).run()
        }) },

        { divider: '크기와 자리', label: '' },
        { short: '크게', label: '차트 크게 (+60px)', icon: 'zoom-in', onClick: () => run(() => resizeChart(60)) },
        { short: '작게', label: '차트 작게 (-60px)', icon: 'zoom-out', onClick: () => run(() => resizeChart(-60)) },
        { short: '왼쪽', label: '차트를 왼쪽에', icon: 'align-left', onClick: () => run(() => alignObject('left')) },
        { short: '가운데', label: '차트를 가운데에', icon: 'align-center', onClick: () => run(() => alignObject('center')) },
        { short: '오른쪽', label: '차트를 오른쪽에', icon: 'align-right', onClick: () => run(() => alignObject('right')) },
      ],
    },

    /* 3.45 도해 상황 탭 — 스마트 도해를 고르면 뜬다 */
    {
      label: '도해 도구', items: [
        { divider: '배치', label: '' },
        { short: '글 고치기', label: '도해 글·배치 고치기 (창 열기)', icon: 'smart', onClick: () => run(openSmartArt) },
        {
          short: '배치', label: '도해 배치 고르기', icon: 'smart',
          menu: SMART_LAYOUTS.slice(0, 8).map((l): MenuItem => ({
            short: l.label, label: `도해 배치: ${l.label} — ${l.hint}`, icon: 'smart',
            onClick: () => run(() => { editor.chain().focus().updateSmartArt({ layout: l.key }).run(); flash(`도해 — ${l.label}`) }),
          })),
        },

        { divider: '색', label: '' },
        {
          short: '색', label: '도해 색 고르기', icon: 'palette',
          menu: Object.keys(SMART_PALETTES).map((k): MenuItem => ({
            short: k, label: `도해 색: ${k}`, icon: 'palette',
            onClick: () => run(() => { editor.chain().focus().updateSmartArt({ palette: k }).run(); flash(`도해 색 — ${k}`) }),
          })),
        },

        { divider: '항목', label: '' },
        { short: '항목 추가', label: '도해에 항목 하나 더', icon: 'plus', onClick: () => run(() => changeSmartItems(1)) },
        { short: '항목 빼기', label: '도해에서 마지막 항목 빼기', icon: 'minus', onClick: () => run(() => changeSmartItems(-1)) },

        { divider: '크기와 자리', label: '' },
        { short: '크게', label: '도해 크게 (+60px)', icon: 'zoom-in', onClick: () => run(() => resizeSmart(60)) },
        { short: '작게', label: '도해 작게 (-60px)', icon: 'zoom-out', onClick: () => run(() => resizeSmart(-60)) },
        { short: '왼쪽', label: '도해를 왼쪽에', icon: 'align-left', onClick: () => run(() => alignObject('left')) },
        { short: '가운데', label: '도해를 가운데에', icon: 'align-center', onClick: () => run(() => alignObject('center')) },
        { short: '오른쪽', label: '도해를 오른쪽에', icon: 'align-right', onClick: () => run(() => alignObject('right')) },
      ],
    },

    /* 3.5 디자인 — 워드 「디자인」 탭 (문서 서식 · 테마 · 페이지 배경) */
    {
      label: '디자인', items: [
        { divider: '문서 서식', label: '' },
        { short: '서식 갤러리', label: '문서 서식 갤러리 (제목·본문을 한 벌로)', icon: 'palette', onClick: () => run(() => openDesign('styles')) },
        ...STYLE_SETS.slice(0, 6).map((set): MenuItem => ({
          short: set.label, label: `문서 서식: ${set.label} — ${set.hint}`, icon: 'file-text',
          onClick: () => run(() => { setDesign({ styleSet: set.key }); flash(`문서 서식 — ${set.label}`) }),
        })),

        { divider: '테마', label: '' },
        {
          short: '색', label: '테마 색 (제목·강조·표 머리에 함께 쓰인다)', icon: 'palette',
          menu: THEME_COLORS.map((t): MenuItem => ({
            short: t.label, label: `테마 색: ${t.label}`, icon: 'palette',
            onClick: () => run(() => { setDesign({ themeColor: t.key }); flash(`테마 색 — ${t.label}`) }),
          })),
        },
        {
          short: '글꼴', label: '테마 글꼴 (제목/본문 짝)', icon: 'paragraph',
          menu: THEME_FONTS.map((f): MenuItem => ({
            short: f.label, label: `테마 글꼴: ${f.label}`, icon: 'paragraph',
            onClick: () => run(() => { setDesign({ themeFont: f.key }); flash(`테마 글꼴 — ${f.label}`) }),
          })),
        },
        {
          short: '단락 간격', label: '단락 간격 (줄 간격과 단락 앞뒤 사이)', icon: 'sliders',
          menu: PARA_SPACING_SETS.map((v): MenuItem => ({
            short: v.label, label: `단락 간격: ${v.label}`, icon: 'sliders',
            onClick: () => run(() => { setDesign({ paraSpacing: v.key }); flash(`단락 간격 — ${v.label}`) }),
          })),
        },
        {
          short: '효과', label: '효과 (표·차트·도해의 마감)', icon: 'sparkle',
          menu: DESIGN_EFFECTS.map((v): MenuItem => ({
            short: v.label, label: `효과: ${v.label} — ${v.hint}`, icon: 'sparkle',
            onClick: () => run(() => { setDesign({ effect: v.key }); flash(`효과 — ${v.label}`) }),
          })),
        },
        { short: '기본값', label: '이 디자인을 새 문서의 기본값으로', icon: 'check', onClick: () => run(saveDesignDefault) },

        { divider: '페이지 배경', label: '' },
        {
          short: '워터마크', label: '워터마크 (대외비·초안 같은 배경 글)', icon: 'preview',
          menu: [
            ...['대외비', '초안', '샘플', 'DRAFT', 'CONFIDENTIAL'].map((word): MenuItem => ({
              short: word, label: `워터마크: ${word}`, icon: 'preview',
              onClick: () => run(() => { setDesign({ watermark: { ...design.watermark, text: word } }); flash(`워터마크 — ${word}`) }),
            })),
            { short: '자세히', label: '워터마크 자세히 (색·진하기·기울기·크기)', icon: 'sliders', onClick: () => run(() => openDesign('background')) },
            { short: '없앰', label: '워터마크 없애기', icon: 'close', onClick: () => run(() => { setDesign({ watermark: { ...design.watermark, text: '' } }); flash('워터마크를 없앴다') }) },
          ],
        },
        {
          short: '페이지 색', label: '페이지 색 (인쇄에 부담 없는 옅은 색)', icon: 'fill',
          menu: PAGE_COLORS.map((c): MenuItem => ({
            short: c.label, label: `페이지 색: ${c.label}`, icon: 'fill',
            onClick: () => run(() => { setDesign({ pageColor: c.key }); flash(`페이지 색 — ${c.label}`) }),
          })),
        },
        {
          short: '쪽 테두리', label: '페이지 테두리 (쪽 둘레의 선)', icon: 'box',
          menu: [
            ...PAGE_BORDER_STYLES.map((b): MenuItem => ({
              short: b.label, label: `쪽 테두리: ${b.label}`, icon: 'box',
              onClick: () => run(() => { setDesign({ pageBorder: { ...design.pageBorder, style: b.key } }); flash(`쪽 테두리 — ${b.label}`) }),
            })),
            { short: '자세히', label: '쪽 테두리 자세히 (색·굵기·여백)', icon: 'sliders', onClick: () => run(() => openDesign('background')) },
          ],
        },
      ],
    },

    /* 4. 레이아웃 — 워드 「레이아웃」 탭 (페이지 설정 · 원고지 · 단락 · 정렬) */
    {
      label: '페이지', items: [
        { divider: '페이지 설정', label: '' },
        {
          short: '텍스트 방향', label: `텍스트 방향: ${layout.textDirection === 'vertical' ? '세로쓰기' : '가로쓰기'}`, icon: 'columns',
          menu: [
            { short: '가로쓰기', label: '텍스트 방향: 가로쓰기 (기본)', icon: 'align-left', onClick: () => run(() => { setLayout({ textDirection: 'horizontal' }); flash('가로쓰기') }) },
            { short: '세로쓰기', label: '텍스트 방향: 세로쓰기 (한글·일본어 전통 조판)', icon: 'columns', onClick: () => run(() => { setLayout({ textDirection: 'vertical' }); flash('세로쓰기 — 오른쪽에서 왼쪽으로 흐른다') }) },
          ],
        },
        {
          short: '여백', label: `페이지 여백: ${pageMarginLabel}`, icon: 'sliders',
          menu: [
            { short: '좁게', label: '여백: 좁게 (12mm)', icon: 'sliders', onClick: () => run(() => { ui.setPageMarginsMm({ top: 12, right: 12, bottom: 12, left: 12 }); flash('여백 — 좁게') }) },
            { short: '기본', label: '여백: 기본 (20mm)', icon: 'sliders', onClick: () => run(() => { ui.setPageMarginsMm({ top: 20, right: 20, bottom: 20, left: 20 }); flash('여백 — 기본') }) },
            { short: '보통', label: '여백: 보통 (25mm)', icon: 'sliders', onClick: () => run(() => { ui.setPageMarginsMm({ top: 25, right: 25, bottom: 25, left: 25 }); flash('여백 — 보통') }) },
            { short: '넓게', label: '여백: 넓게 (32mm)', icon: 'sliders', onClick: () => run(() => { ui.setPageMarginsMm({ top: 32, right: 32, bottom: 32, left: 32 }); flash('여백 — 넓게') }) },
            { short: '제본용', label: '여백: 제본용 (왼쪽 넓게)', icon: 'sliders', onClick: () => run(() => { ui.setPageMarginsMm({ top: 20, right: 15, bottom: 20, left: 30 }); flash('여백 — 제본용') }) },
            { short: '자세히', label: '여백 자세히 (쪽 설정 창)', icon: 'sliders', onClick: () => run(() => { sessionStorage.setItem('jan-page-focus', '여백'); openPageSettings() }) },
          ],
        },
        {
          short: '용지 방향', label: `용지 방향: ${orientationLabel}`, icon: 'page',
          menu: [
            { short: '세로', label: '용지 방향: 세로', icon: 'page', onClick: () => run(() => { ui.setPageOrientation('portrait'); flash('세로 방향') }) },
            { short: '가로', label: '용지 방향: 가로', icon: 'page', onClick: () => run(() => { ui.setPageOrientation('landscape'); flash('가로 방향') }) },
          ],
        },
        { short: '크기', label: `용지 크기: ${ui.pageSize}`, icon: 'page', onClick: () => run(() => { sessionStorage.setItem('jan-page-focus', '용지'); openPageSettings() }) },
        {
          short: '단', label: `다단: ${pageColumnLabel}`, icon: 'columns',
          menu: [
            { short: '1단', label: '다단: 하나 (기본)', icon: 'columns', onClick: () => run(() => { ui.setPageColumnCount(1); flash('1단') }) },
            { short: '2단', label: '다단: 둘', icon: 'columns', onClick: () => run(() => { ui.setPageColumnCount(2); flash('2단') }) },
            { short: '3단', label: '다단: 셋', icon: 'columns', onClick: () => run(() => { ui.setPageColumnCount(3); flash('3단') }) },
          ],
        },
        {
          short: '나누기', label: '나누기 (쪽·단)', icon: 'page-break',
          menu: [
          ],
        },
        {
          short: '줄 번호', label: `줄 번호: ${LINE_NUMBER_MODES.find((m) => m.key === layout.lineNumbers)?.label || '없음'}`, icon: 'list-numbered',
          menu: LINE_NUMBER_MODES.map((m): MenuItem => ({
            short: m.label, label: `줄 번호: ${m.label} — ${m.hint}`, icon: 'list-numbered',
            onClick: () => run(() => { setLayout({ lineNumbers: m.key }); flash(`줄 번호 — ${m.label}`) }),
          })),
        },
        {
          short: '하이픈', label: `하이픈 넣기: ${layout.hyphen === 'auto' ? '자동' : '없음'}`, icon: 'minus',
          menu: [
            { short: '없음', label: '하이픈 넣기: 없음', icon: 'minus', onClick: () => run(() => { setLayout({ hyphen: 'none' }); flash('하이픈 없음') }) },
            { short: '자동', label: '하이픈 넣기: 자동 (긴 영문 낱말을 줄 끝에서 나눈다)', icon: 'minus', onClick: () => run(() => { setLayout({ hyphen: 'auto' }); flash('하이픈 자동') }) },
          ],
        },

        { divider: '원고지', label: '' },
        {
          short: '원고지', label: `원고지 설정 (${layout.grid.on ? `${layout.grid.cols}×${layout.grid.rows} 켬` : '끔'})`, icon: 'table',
          menu: [
            ...MANUSCRIPT_PRESETS.map((g): MenuItem => ({
              short: g.label, label: `원고지: ${g.label}`, icon: 'table',
              onClick: () => run(() => { setLayout({ grid: { ...layout.grid, on: true, cols: g.cols, rows: g.rows } }); flash(`원고지 ${g.label}`) }),
            })),
            { short: '끄기', label: '원고지 끄기', icon: 'close', onClick: () => run(() => { setLayout({ grid: { ...layout.grid, on: false } }); flash('원고지를 껐다') }) },
          ],
        },

        /* 들여쓰기·내어쓰기는 늘 보이는 서식 줄에 있다 — 여기는 쪽 안의 「간격」 만 다룬다 */
        { divider: '문단 간격', label: '' },
        {
          short: '문단 간격', label: '문단 앞뒤 공백 넣기', icon: 'paragraph',
          onClick: () => run(() => { setParagraphSpace(editor, 'before', 12) }),
          menu: [
            { short: '앞 공백', label: '문단 앞에 공백 넣기 (12px)', icon: 'chevron-up', onClick: () => run(() => { setParagraphSpace(editor, 'before', 12) }) },
            { short: '뒤 공백', label: '문단 뒤에 공백 넣기 (12px)', icon: 'chevron-down', onClick: () => run(() => { setParagraphSpace(editor, 'after', 12) }) },
            { short: '없애기', label: '문단 앞뒤 공백 없애기', icon: 'close', onClick: () => run(() => { setParagraphSpace(editor, 'before', null); setParagraphSpace(editor, 'after', null) }) },
          ],
        },

        { divider: '정렬', label: '' },
        {
          short: '위치', label: '개체 위치 (쪽 안에서 어디에 둘까)', icon: 'box',
          menu: [
            { short: '왼쪽', label: '개체를 왼쪽에', icon: 'align-left', onClick: () => run(() => alignObject('left')) },
            { short: '가운데', label: '개체를 가운데에', icon: 'align-center', onClick: () => run(() => alignObject('center')) },
            { short: '오른쪽', label: '개체를 오른쪽에', icon: 'align-right', onClick: () => run(() => alignObject('right')) },
          ],
        },
        {
          short: '줄 바꿈', label: '텍스트 줄 바꿈 (글이 개체를 어떻게 피할까)', icon: 'paragraph',
          menu: [
            { short: '줄 안', label: '줄 안에 (텍스트와 한 줄로)', icon: 'paragraph', onClick: () => run(() => wrapObject('inline')) },
            { short: '위아래', label: '위/아래 (글이 개체를 넘어간다)', icon: 'paragraph', onClick: () => run(() => wrapObject('topbottom')) },
            { short: '왼쪽 흐름', label: '왼쪽에 두고 글 흐르기', icon: 'align-left', onClick: () => run(() => wrapObject('left')) },
            { short: '오른쪽 흐름', label: '오른쪽에 두고 글 흐르기', icon: 'align-right', onClick: () => run(() => wrapObject('right')) },
            { short: '글 뒤', label: '글 뒤로 보내기', icon: 'eye-off', onClick: () => run(() => wrapObject('behind')) },
            { short: '글 앞', label: '글 앞으로 가져오기', icon: 'eye', onClick: () => run(() => wrapObject('front')) },
          ],
        },
        { short: '앞으로', label: '앞으로 가져오기 (겹친 개체 차례)', icon: 'chevron-up', onClick: () => run(() => wrapObject('front')) },
        { short: '뒤로', label: '뒤로 보내기 (겹친 개체 차례)', icon: 'chevron-down', onClick: () => run(() => wrapObject('behind')) },
        { short: '선택 창', label: '선택 창 (겹친 개체 목록에서 고르기)', hint: 'Alt+F10', icon: 'menu', onClick: () => run(() => window.dispatchEvent(new Event('jan-object-pane'))) },
        { short: '회전', label: '개체 90° 돌리기', icon: 'refresh-cw', onClick: () => run(rotateObject) },

        /* 엔터 표시는 보기 탭, 인쇄와 미리보기는 파일·보기 탭이 맡는다 */
        { divider: '종이 바탕', label: '' },
        { short: '노트 배경', label: `노트 배경 무늬: ${currentPaperLabel}`, icon: 'palette', onClick: () => run(() => { sessionStorage.setItem('jan-page-focus', '배경'); openPageSettings() }) },
      ],
    },

    /* 5. 미디어 */
    
    /* 6. 도우미 — 글을 손봐 주고 문서를 살펴 주는 것들.
       (창을 열어 만들고 적는 「도구」 묶음과 이름이 겹쳐 있었다. pick 은 먼저 만난 것만
        집으므로, 겹친 채로는 이 묶음의 모든 기능이 리본에서 사라진다.) */
    {
      label: '도우미', items: [
        { label: 'AI 도우미', hint: 'Ctrl+/', icon: 'ai', onClick: () => run(p.onAi) },
        { label: 'AI 챗 패널', icon: 'ai', onClick: () => run(p.onChat) },
        { divider: '검색 / 편집', label: '' },
        { label: '깨진 링크 검사', icon: 'unlink', onClick: () => run(p.onLinkCheck) },
        { divider: '분석', label: '' },
        { short: '문서 진단', label: '문서 건강 점수 (100점 진단)', icon: 'shield', onClick: () => run(runDocHealth) },
        { label: '통계 / 대시보드', icon: 'hash', onClick: () => run(p.onStats) },
        { label: '활동 히트맵', icon: 'hash', onClick: () => run(p.onHeatmap) },
        { label: '메모 정보', icon: 'info', onClick: () => run(p.onInfo) },
        { label: '메모 비교 (diff)', icon: 'replace', onClick: () => run(p.onDiff) },
        { label: '워드 클라우드', icon: 'sparkle', onClick: () => run(wordCloud) },
        { divider: '언어', label: '' },
        { label: '번역', icon: 'translate', onClick: () => run(p.onTranslate) },
        { short: '맞춤법', label: '맞춤법 검사 켬/끔', icon: 'check', hint: 'F7', onClick: () => run(toggleSpellCheck) },
        { divider: '학습 / 시각화', label: '' },
        { label: '마인드맵', icon: 'sparkle', onClick: () => run(p.onMindMap) },
        { label: '플래시카드 학습', icon: 'list-bullet', onClick: () => run(flashcards) },
        { divider: 'OCR / 자동화', label: '' },
        { short: 'OCR', label: 'OCR (이미지 → 텍스트)', icon: 'image', onClick: () => run(p.onOcr) },
        { label: '포모도로 타이머', icon: 'clock', onClick: () => run(startPomodoro) },
      ],
    },

    /* 7. 보기 */
    {
      label: '보기', items: [
        { divider: '문서 보기', label: '' },
        {
          short: '문서 보기', label: `문서 보기: ${viewLayoutLabel}`, icon: 'preview',
          onClick: () => run(() => ui.setViewLayout(ui.viewLayout === 'draft' ? 'print' : 'draft')),
          menu: [
            { label: '인쇄 모양 (쪽이 보이는 편집)', short: '인쇄 모양', icon: 'page', onClick: () => run(() => ui.setViewLayout('print')) },
            { label: '초안 모양 (쪽 없이 글만)', short: '초안 모양', icon: 'file-text', onClick: () => run(() => ui.setViewLayout('draft')) },
          ],
        },
        { divider: '창', label: '' },
        {
          short: '화면 모드', label: '집중 모드', hint: 'F11', icon: 'focus',
          onClick: () => run(() => ui.toggleFocus()),
          menu: [
            { label: '읽기 모드 (고치지 않고 읽기)', short: '읽기', icon: 'preview', hint: 'Shift+F11', onClick: () => run(() => ui.toggleReading()) },
            { label: `타자기 모드 켬/끔 (커서 줄을 화면 중앙에)${ui.typewriterMode ? ' — 지금 켜져 있다' : ''}`, short: '타자기', icon: 'focus', onClick: () => run(() => { ui.toggleTypewriter(); flash(ui.typewriterMode ? '타자기 모드 끔' : '타자기 모드 켬 — 커서 줄이 화면 중앙에 유지됩니다') }) },
            { label: `현재 문단 강조 켬/끔${ui.paragraphFocus ? ' — 지금 켜져 있다' : ''}`, short: '문단 강조', icon: 'focus', onClick: () => run(() => { ui.toggleParagraphFocus(); flash(ui.paragraphFocus ? '문단 하이라이트 끔' : '문단 하이라이트 켬 — 커서 문단 외에는 흐려집니다') }) },
          ],
        },
        { short: '사이드바', label: '사이드바 켬/끔', icon: 'list-bullet', onClick: () => run(() => ui.toggleSidebar()) },
        { short: '눈금자', label: '눈금자 켬/끔', icon: 'columns', onClick: () => run(() => ui.toggleRulers()) },
        {
          short: '여러 쪽', label: `쪽모음 ${ui.pageThumbs ? '닫기' : '열기'} (여러 쪽 한눈에)`, icon: 'page',
          onClick: () => run(() => {
            if (ui.viewLayout !== 'print' && !ui.pageThumbs) { flash('쪽모음은 인쇄 모양에서 쓸 수 있습니다 — 보기 → 문서 보기 → 인쇄 모양'); return }
            ui.togglePageThumbs()
          }),
          menu: [
            { label: ui.spreadCols ? `쪽 나란히 편집 끝내기 (지금 ${ui.spreadCols}쪽)` : '쪽 나란히 편집 (1·2쪽을 가로로 놓고)', short: '나란히', icon: 'columns', onClick: () => run(() => {
              if (ui.spreadCols) { ui.setSpreadCols(0); flash('쪽 나란히 편집을 끝냈습니다'); return }
              if (ui.viewLayout !== 'print') { flash('쪽 나란히 편집은 인쇄 모양에서 쓸 수 있습니다 — 보기 → 문서 보기 → 인쇄 모양'); return }
              ui.setSpreadCols(2)
              flash('쪽 나란히 편집 — 각 쪽에서 바로 편집됩니다 (2·3·4쪽 배치 선택, PageUp/PageDown 이동)', 3200)
            }) },
            { label: `창 나누기 ${ui.splitView ? '취소' : ''}(같은 문서를 위·아래 두 창에)`, short: '창 나누기', icon: 'columns', onClick: () => run(() => {
              ui.toggleSplitView()
              flash(ui.splitView ? '창 나누기를 취소했습니다' : '창 나누기 — 아래 창에서도 같은 문서를 바로 편집할 수 있습니다 (분할선을 끌어 크기 조절)', 3000)
            }) },
          ],
        },
        { divider: '줌', label: '' },
        { short: '크게', label: '줌 크게', hint: 'Ctrl+=', icon: 'zoom-in', onClick: () => run(() => ui.zoomIn()) },
        { short: '작게', label: '줌 작게', hint: 'Ctrl+-', icon: 'zoom-out', onClick: () => run(() => ui.zoomOut()) },
        {
          short: '줌 맞춤', label: '줌 100% 로', hint: 'Ctrl+0', icon: 'maximize',
          onClick: () => run(() => ui.zoomReset()),
          menu: [
            { label: '쪽 너비에 맞춤', short: '쪽 너비', icon: 'maximize', onClick: () => run(() => fitPageZoom('width')) },
            { label: '한 쪽 다 보이게', short: '한 쪽', icon: 'page', onClick: () => run(() => fitPageZoom('page')) },
            { label: '줌 75%', short: '75%', icon: 'zoom-out', onClick: () => run(() => setPageZoom(0.75)) },
            { label: '줌 125%', short: '125%', icon: 'zoom-in', onClick: () => run(() => setPageZoom(1.25)) },
          ],
        },
        { divider: '개요 · 미리보기', label: '' },
        { short: '개요', label: `문서 개요 ${p.outlineOpen ? '닫기' : '열기'}`, icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { short: 'MD 보기', label: 'Markdown 미리보기', icon: 'preview', onClick: () => run(p.onMdPreview) },
        { short: '미리보기', label: '인쇄 미리보기', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
        { divider: '표시', label: '' },
        { short: '엔터 표시', label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
        { short: '제목 번호', label: '제목 번호 켬/끔', icon: 'hash', onClick: () => run(() => ui.toggleHeadingNumbers && ui.toggleHeadingNumbers()) },
      ],
    },

    /* 8. 파일 */
    {
      label: '파일', items: [
        { divider: '문서', label: '' },
        {
          label: '새 메모', hint: 'Ctrl+N', icon: 'plus',
          onClick: () => run(p.onNewMemo),
          menu: [
          ],
        },
        { label: '열기', hint: 'Ctrl+O', icon: 'open', onClick: () => run(p.onOpen) },
        {
          label: '저장', hint: 'Ctrl+S', icon: 'save',
          onClick: () => run(p.onSave),
          menu: [
            { label: '다른 이름으로 저장', short: '다른 이름', icon: 'save', onClick: () => run(p.onSaveAs) },
            { label: '버전 기록에서 되살리기', short: '버전 기록', icon: 'history', onClick: () => run(p.onVersions) },
          ],
        },
        /* 앱으로 설치해야 운영체제가 .jan 을 이 앱에 이어 준다 (두 번 눌러 열기) */
        ...(install.canInstall
          ? [{ short: '앱 설치', label: '앱으로 설치 (.jan 파일 연결)', icon: 'download' as const, onClick: () => run(() => { void installApp() }) }]
          : []),
        { divider: '인쇄 · 내보내기', label: '' },
        { label: '인쇄', hint: 'Ctrl+P', icon: 'print', onClick: () => run(() => window.print()) },
        {
          label: 'PDF 내보내기', short: 'PDF', icon: 'file-text',
          onClick: () => run(exportPdf),
          menu: [
            { label: 'HTML 내보내기', short: 'HTML', icon: 'globe', onClick: () => run(exportHtml) },
            { label: 'Markdown(.md) 저장', short: 'MD', icon: 'file-text', onClick: () => run(exportMd) },
            { label: 'HWPX (한글) 내보내기', short: 'HWPX', icon: 'file-text', onClick: () => run(exportHwpx) },
            { label: 'Word(.doc) 내보내기', short: 'DOC', icon: 'file-text', onClick: () => run(exportDocx) },
            { label: '모든 형식 한꺼번에 (MD·HTML·LaTeX·HWPX·DOC)', short: '모두', icon: 'download', onClick: () => run(() => { void exportAll() }) },
            { label: 'LaTeX(.tex) 하나만 저장하려면 — 논문 탭에 있다', short: '.tex 위치', icon: 'info', onClick: () => run(() => { setRibbonTab('논문'); flash('논문 탭 › 제출 전 › .tex 저장') }) },
          ],
        },
        { divider: '공유 · 백업', label: '' },
        {
          label: '공유 링크 만들기', short: '공유', icon: 'link',
          onClick: () => run(p.onShare),
          menu: [
            { label: 'GitHub Gist 로 공유', short: 'Gist', icon: 'cloud', onClick: () => run(p.onGist) },
          ],
        },
        {
          label: 'JSON 백업 내보내기', short: '백업', icon: 'cloud',
          onClick: () => run(exportJsonBackup),
          menu: [
            { label: 'JSON 백업 가져오기', short: '백업 열기', icon: 'cloud', onClick: () => run(importJsonBackup) },
            { label: 'v1 메모 가져오기', short: 'v1 가져오기', icon: 'undo', onClick: () => run(importV1) },
          ],
        },
        { divider: '관리', label: '' },
        { short: '잠금', label: '비밀번호로 잠그기 (내용 암호화)', icon: 'lock', onClick: () => run(p.onLock) },
        { label: '휴지통', icon: 'box', onClick: () => run(p.onTrash) },
        { short: '정보', label: '앱 정보 · 버전', icon: 'info', onClick: () => run(p.onAbout) },

        /* 머리부 아이콘으로 흩어져 있던 앱 살림을 파일 탭에 모았다 (그림만으로는 못 알아본다) */
        { divider: '앱', label: '' },
        { short: '명령', label: '명령 팔레트 (이름으로 명령 찾기)', hint: 'Ctrl+Shift+P', icon: 'cmd', help: 'cmd-palette', onClick: () => run(cmdPalette) },
        { short: '찾기', label: '모든 메모에서 찾기', hint: 'Ctrl+Shift+F', icon: 'search', help: 'global-search', onClick: () => run(p.onSearch) },
        {
          short: '테마', label: `테마 바꾸기 (지금 ${themeName})`, icon: 'palette', help: 'theme',
          onClick: () => run(cycleTheme),
          menu: THEME_CHOICES.map((t): MenuItem => ({
            short: t.label, label: `테마: ${t.label}`, icon: 'palette',
            onClick: () => run(() => { setTheme(t.key); flash(`테마 — ${t.label}`) }),
          })),
        },
        { short: '설정', label: '설정 창 열기', hint: 'Ctrl+,', icon: 'settings', help: 'settings', onClick: () => run(p.onSettings) },
        { short: '도움말', label: '도움말 · 단축키', hint: 'F1', icon: 'help', help: 'help', onClick: () => run(p.onHelp) },
      ],
    },
  ]

  /* 한글·워드와 같은 탭 구성으로 재배치 — 명령은 그대로 두고 묶음만 옮긴다.
     삽입+미디어 → 입력, 페이지 → 쪽, 편집 탭은 자주 쓰는 편집 명령을 모아 새로 만든다. */
  const pick = (label: string) => rawGroups.find((g) => g.label === label)?.items ?? []
  /* ── 탭 재편 도우미 ──
     같은 기능이 여러 탭에 흩어져 있으면 "어디서 하는 일인지" 감이 안 잡힌다.
     아래 두 도우미로 각 기능의 자리를 한 곳으로 정한다. */
  const drop = (items: MenuItem[], labels: string[]) =>
    items.filter((it) => it.divider || !labels.some((l) => it.label.startsWith(l)))
  const take = (items: MenuItem[], labels: string[]) =>
    items.filter((it) => !it.divider && labels.some((l) => it.label.startsWith(l)))


  /* 편집 탭 = 글을 「손질」 하는 일 (서식 탭은 「모양」).
     되돌리기·다시 실행은 늘 보이는 서식 줄에 있으므로 여기에 또 두지 않는다. */
  const editItems: MenuItem[] = [
    { divider: '클립보드', label: '' },
    {
      label: '붙여넣기', short: '붙여넣기', icon: 'cards', hint: 'Ctrl+V',
      onClick: () => run(() => { pasteAs(editor, 'keep') }),
      menu: [
        { label: '원본 서식 그대로', icon: 'cards', onClick: () => run(() => { pasteAs(editor, 'keep') }) },
        { label: '지금 문단 서식에 맞춰', icon: 'cards', onClick: () => run(() => { pasteAs(editor, 'merge') }) },
        { label: '글자만 (서식 버리고)', icon: 'file-text', onClick: () => run(() => { pasteAs(editor, 'text') }) },
        { label: '표로 붙여넣기 (CSV·엑셀)', icon: 'table', onClick: () => run(() => { void insertTableFromCsv() }) },
      ],
    },
    { label: '잘라내기', short: '잘라내기', icon: 'page-break', hint: 'Ctrl+X', onClick: () => run(() => document.execCommand('cut')) },
    { label: '복사', short: '복사', icon: 'cards', hint: 'Ctrl+C', onClick: () => run(() => document.execCommand('copy')) },
    {
      label: '서식 복사', short: '서식 복사', icon: 'paint', hint: 'Ctrl+Shift+C',
      onClick: () => run(() => window.dispatchEvent(new Event('jan-format-copy'))),
      menu: [
        { label: '서식 복사 (붓으로 담기)', short: '복사', icon: 'paint', hint: 'Ctrl+Shift+C', onClick: () => run(() => window.dispatchEvent(new Event('jan-format-copy'))) },
        { label: '서식 붙여넣기 (담은 붓으로)', short: '붙임', icon: 'paint', hint: 'Ctrl+Shift+V', onClick: () => run(() => window.dispatchEvent(new Event('jan-format-paste'))) },
      ],
    },

    { divider: '선택 · 찾기', label: '' },
    {
      label: '모두 선택', short: '선택', hint: 'Ctrl+A', icon: 'check',
      onClick: () => run(() => { selectAll(editor) }),
      menu: [
        { label: '모두 선택', hint: 'Ctrl+A', icon: 'check', onClick: () => run(() => { selectAll(editor) }) },
        { label: '비슷한 서식의 글 선택', icon: 'sparkle', onClick: () => run(() => { selectSimilarFormatting(editor) }) },
        { label: '개체 선택 (그림·도형 목록)', hint: 'Alt+F10', icon: 'menu', onClick: () => run(() => window.dispatchEvent(new Event('jan-object-pane'))) },
      ],
    },
    { label: '찾기 · 바꾸기', short: '찾기', hint: 'Ctrl+F', icon: 'find', onClick: () => run(p.onFind) },

    { divider: '서식 지우기', label: '' },
    {
      label: '글자 서식 지우기', short: '서식 지움', icon: 'close',
      onClick: () => run(() => editor.chain().focus().unsetAllMarks().run()),
      menu: [
        { label: '글자 서식만 지우기 (굵게·색·밑줄)', short: '글자만', icon: 'close', onClick: () => run(() => editor.chain().focus().unsetAllMarks().run()) },
        { label: '문단까지 본문으로 되돌리기', short: '문단까지', icon: 'paragraph', onClick: () => run(() => editor.chain().focus().setParagraph().run()) },
        { label: '글자·문단 서식 모두 지우기', short: '모두', icon: 'close', onClick: () => run(() => editor.chain().focus().unsetAllMarks().clearNodes().run()) },
      ],
    },
  ]
  /* AI 는 우리 강점이라 별도 탭으로 올린다 — 도구·미디어에 섞여 있던 것을 옮긴다 */
  const AI_KEYS = ['AI ', 'OCR', '번역', '문서 건강 점수', '워드 클라우드', '마인드맵']
  const isAi = (it: MenuItem) => !it.divider && AI_KEYS.some((k) => it.label.startsWith(k))
  const notAi = (items: MenuItem[]) => items.filter((it) => it.divider || !isAi(it))
  const aiFrom = (items: MenuItem[]) => items.filter(isAi)
  const aiTools = aiFrom(pick('도우미'))
  /* AI 탭 = 사람 대신 글·그림을 만들어 주는 것만. 번역·문서 건강처럼 '검사'에 가까운 것은 검토 탭,
     마인드맵·워드 클라우드처럼 '다르게 보기'는 보기 탭으로 보냈다 (한 기능은 한 자리에). */
  const aiItems: MenuItem[] = [
    /* 첫자리는 「없는 문서를 만들어 내는 일」 — 도우미(있는 글을 손보는 일)보다 앞에 둔다 */
    { divider: '문서 만들기', label: '' },
    {
      /* 줄인 이름은 넉 자를 넘기면 단추 밖으로 잘린다 (묶음 이름이 「문서 만들기」 라 뜻은 이어진다) */
      short: '자동 작성',
      label: '문서 자동 작성',
      hint: 'Alt+J',
      icon: 'sparkle',
      help: 'ai-write',
      onClick: () => run(() => openAiWrite()),
      menu: [
        { label: '업무 보고서', onClick: () => openAiWrite('report') },
        { label: '사업 · 제품 기획서', onClick: () => openAiWrite('plan') },
        { label: '제안서', onClick: () => openAiWrite('proposal') },
        { label: '회의록', onClick: () => openAiWrite('meeting') },
        { label: '강의 노트 · 강의 계획', onClick: () => openAiWrite('lecture') },
        { label: '사용 안내서 · 매뉴얼', onClick: () => openAiWrite('manual') },
        { label: '공지문 · 안내문', onClick: () => openAiWrite('notice') },
        { label: '업무 편지 · 공문', onClick: () => openAiWrite('mail') },
        { label: '연구 계획 · 논문 개요', onClick: () => openAiWrite('paper') },
        { label: '분석 리포트', onClick: () => openAiWrite('analysis') },
        { label: '그 밖 — 갈래까지 알아서', onClick: () => openAiWrite('free') },
      ],
    },
    /* 있는 글을 손봐 주는 것들 — 요약·다듬기·이어 쓰기는 도우미 창 안에 있다.
       OCR 은 도구 탭의 「글자 인식」 과 같은 일이라 여기 두지 않는다 (한 기능 한 자리). */
    { divider: '쓰기 도우미', label: '' },
    ...aiTools.filter((it) => it.label.startsWith('AI ')),
    { divider: '이미지 · 인식', label: '' },
    { short: 'AI 그림', label: 'AI 이미지 생성 (Pollinations)', icon: 'sparkle', onClick: () => run(() => { void aiImageStub() }) },
    { divider: '연결', label: '' },
    {
      short: 'AI 연결',
      label: 'AI 연결',
      hint: '내가 쓰는 AI 를 잇는다',
      icon: 'settings',
      help: 'ai-connect',
      onClick: () => run(openAiConnect),
    },
  ]

  /* 표·그림을 고르면 나타나는 개체 탭 (한글의 맥락 탭) */
  const inTable = contextTab === '표'
  const onImage = contextTab === '그림'
  const onShape = contextTab === '도형'
  const onChart = contextTab === '차트'
  const onSmart = contextTab === '도해'
  /* 커서가 든 행·열 번호 (선택 명령이 쓴다) */
  const currentRowIndex = () => {
    const { $from } = editor.state.selection
    for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'tableRow') return $from.index(d - 1)
    return 0
  }
  const currentColIndex = () => {
    const { $from } = editor.state.selection
    for (let d = $from.depth; d > 0; d--) if (/^table(Cell|Header)$/.test($from.node(d).type.name)) return $from.index(d - 1)
    return 0
  }

  /* 표 속성 — 워드의 「표 속성」과 같은 갈래로 다룬다.
     updateAttributes 는 선택 안의 표를 스스로 찾아 준다 (커서가 셀 어디에 있든). */
  const setTableAttr = (attrs: Record<string, string | null>, note: string) => {
    if (!editor.isActive('table')) { flash('표 안에 커서를 두고 실행하세요'); return }
    editor.chain().focus().updateAttributes('table', attrs).run()
    flash(note)
  }
  const askTableWidth = async () => {
    if (!editor.isActive('table')) { flash('표 안에 커서를 두고 실행하세요'); return }
    const cur = (editor.getAttributes('table')['data-width'] as string) || '100%'
    const v = await askText('표 너비 — 백분율(예: 60%) 또는 길이(예: 80mm)', cur)
    if (v === null) return
    const value = v.trim()
    if (value && !/^\d+(\.\d+)?(%|mm|cm|px|em)$/.test(value)) { flash('60% · 80mm 처럼 단위를 붙여 적으세요'); return }
    setTableAttr({ 'data-width': value || null, 'data-fit': value ? 'fixed' : null }, value ? `표 너비 ${value}` : '표 너비 자동')
  }
  const askRowHeight = async () => {
    if (!editor.isActive('table')) { flash('표 안에 커서를 두고 실행하세요'); return }
    const v = await askText('행 높이 — 길이(예: 12mm) 또는 비우면 자동', '')
    if (v === null) return
    const value = v.trim()
    if (value && !/^\d+(\.\d+)?(mm|cm|px|em)$/.test(value)) { flash('12mm · 40px 처럼 단위를 붙여 적으세요'); return }
    setRowHeight(editor, value || null)
    flash(value ? '행 높이 ' + value : '행 높이 자동')
  }
  const askCellPadding = async () => {
    if (!editor.isActive('table')) { flash('표 안에 커서를 두고 실행하세요'); return }
    const v = await askText('셀 여백 (px) — 표 전체에 적용', '5')
    if (v === null) return
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 40) { flash('0 ~ 40 사이 숫자를 적으세요'); return }
    setCellPadding(editor, n)
    flash('셀 여백 ' + n + 'px')
  }
  const askTableToText = async () => {
    if (!editor.isActive('table')) { flash('표 안에 커서를 두고 실행하세요'); return }
    const sep = await askText('칸을 무엇으로 구분할까요? (탭은 비워 두세요)', ',')
    if (sep === null) return
    tableToText(editor, sep || '\t')
  }
  /* 워드의 「수식」 대화상자 — 수식 + 번호 형식 + 함수 안내 */
  const askCellFormula = async () => {
    if (!editor.isActive('table')) { flash('표 안에 커서를 두고 실행하세요'); return }
    const cur = currentCellFormula(editor)
    const hint = FORMULA_FUNCTIONS.slice(0, 8).map((f) => f.hint).join('\n')
    const formula = await askText(
      '수식 (워드와 같은 문법)\n' + hint + '\n방향 낱말: ABOVE · BELOW · LEFT · RIGHT / 셀 주소: A1, B2:B9',
      cur.formula || suggestFormula(editor),
      { multiline: true }
    )
    if (formula === null) return
    if (!formula.trim()) { setCellFormula(editor, '', ''); flash('수식을 지웠습니다'); return }
    const fmtList = NUMBER_FORMATS.map((f, i) => (i + 1) + '. ' + f.label).join('  ')
    const pick = await askText('번호 형식 번호를 고르세요\n' + fmtList, cur.numFormat ? String(NUMBER_FORMATS.findIndex((f) => f.value === cur.numFormat) + 1) : '1')
    if (pick === null) return
    const index = Math.max(1, Math.min(NUMBER_FORMATS.length, Number(pick) || 1)) - 1
    setCellFormula(editor, formula, NUMBER_FORMATS[index].value)
    flash('수식 적용 — 값이 바뀌면 다시 계산됩니다')
  }

  /* 끌어서 바꾼 열 너비를 지우고 고르게 되돌린다 (워드의 「열 너비를 같게」) */
  const evenColumnWidths = () => {
    const { state, view } = editor
    const { $from } = state.selection
    for (let d = $from.depth; d > 0; d--) {
      const table = $from.node(d)
      if (table.type.name !== 'table') continue
      const tablePos = $from.before(d)
      let tr = state.tr
      table.descendants((cell, offset) => {
        if (!/^table(Cell|Header)$/.test(cell.type.name)) return true
        if (cell.attrs.colwidth == null) return false
        tr = tr.setNodeMarkup(tablePos + 1 + offset, undefined, { ...cell.attrs, colwidth: null })
        return false
      })
      if (tr.docChanged) view.dispatch(tr)
      flash('열 너비를 같게 맞췄습니다')
      return
    }
    flash('표 안에 커서를 두고 실행하세요')
  }
  /* ── 표: 워드의 「레이아웃」 탭 ── */
  /* 표 레이아웃 — 워드 「표 레이아웃」 탭 그대로의 묶음:
     표 · 그리기 · 행 및 열 · 병합 · 셀 크기 · 맞춤 · 데이터 */
  /**
   * 묶음이 길면 낱낱의 명령을 「더보기」 ▾ 로 접는다.
   * 그림·표처럼 명령이 예순 개까지 가는 상황 탭은 접지 않으면 리본이 화면을 두 배 넘어
   * 첫 묶음이 밖으로 밀려난다 (예전에 삽입 탭에서 겪은 일). 명령은 하나도 버리지 않는다.
   *
   * 이미 ▾·색판·격자를 달고 있는 단추는 접지 않는다 — 하위 차림표 안에서는 그것들을
   * 그려 줄 수 없어서, 접으면 눌러도 아무 일이 없는 죽은 항목이 된다.
   */
  const foldTail = (items: MenuItem[], keep: number): MenuItem[] => {
    const rich = (it: MenuItem) => !!(it.menu || it.panel || it.grid)
    const out: MenuItem[] = []
    let cap = ''
    let seg: MenuItem[] = []
    const flush = () => {
      if (!seg.length) return
      const plain = seg.filter((it) => !rich(it))
      if (plain.length > keep + 1) {
        const fold = new Set(plain.slice(keep))
        out.push(...seg.filter((it) => !fold.has(it)))
        out.push({ label: `${cap} — 더보기`, short: '더보기', icon: 'menu', menu: [...fold] })
      } else {
        out.push(...seg)
      }
      seg = []
    }
    items.forEach((it) => {
      if (it.divider) { flush(); cap = it.divider; out.push(it) } else seg.push(it)
    })
    flush()
    return out
  }

  const tableItems: MenuItem[] = [
    { divider: '표', label: '' },
    {
      label: '선택', short: '선택', icon: 'table',
      menu: [
        { label: '셀 선택', hint: 'Alt+S', icon: 'box', onClick: () => run(() => { selectCurrentCell(editor) }) },
        { label: '열 선택', hint: 'Alt+C', icon: 'columns', onClick: () => run(() => { selectTableColumn(editor, currentColIndex()) }) },
        { label: '행 선택', hint: 'Alt+R', icon: 'table', onClick: () => run(() => { selectTableRow(editor, currentRowIndex()) }) },
        { label: '표 선택', hint: 'Alt+A', icon: 'table', onClick: () => run(() => { selectWholeTable(editor) }) },
        { divider: '넓히기', label: '' },
        { label: '오른쪽으로 한 칸 넓히기', hint: 'Shift+→', icon: 'chevron-right', onClick: () => run(() => { extendCellSelection(editor, 0, 1) }) },
        { label: '아래로 한 칸 넓히기', hint: 'Shift+↓', icon: 'chevron-down', onClick: () => run(() => { extendCellSelection(editor, 1, 0) }) },
        { label: '선택 풀기', hint: 'Esc', icon: 'close', onClick: () => run(() => { collapseCellSelection(editor) }) },
        { label: '몇 칸 골랐는지 보기', hint: 'Alt+;', icon: 'info', onClick: () => run(() => {
          const size = cellSelectionSize(editor)
          flash(size ? `${size.rows}행 ${size.cols}열 — ${size.rows * size.cols}칸 골랐다` : '고른 칸이 없다 — Alt+S 로 칸을 고른다')
        }) },
      ],
    },
    { label: '눈금선 보기', short: '눈금선', icon: 'table', onClick: () => run(() => window.dispatchEvent(new Event('jan-table-gridlines'))) },
    { label: '표 너비·자리 (속성)', short: '속성', icon: 'settings', onClick: () => run(askTableWidth) },
    { label: '표 서식 창 (테두리·채우기·맞춤)', short: '표 서식', icon: 'palette', onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-table-format', { detail: { tab: 'border' } }))) },
    {
      label: '텍스트 배치 · 표 자리', short: '배치', icon: 'align-justify',
      menu: [
        { divider: '텍스트 배치', label: '' },
        { label: '문단 사이 (감싸지 않음)', icon: 'align-justify', onClick: () => run(() => { setTableWrap(editor, null) }) },
        { label: '글자처럼 취급 (문장 안에)', icon: 'file-text', onClick: () => run(() => { setTableWrap(editor, 'inline') }) },
        { label: '왼쪽에 두고 글 흐르기', icon: 'align-left', onClick: () => run(() => { setTableWrap(editor, 'left') }) },
        { label: '오른쪽에 두고 글 흐르기', icon: 'align-right', onClick: () => run(() => { setTableWrap(editor, 'right') }) },
        { divider: '표 자리 (다단 문서)', label: '' },
        { label: '단 안에 넣기', icon: 'columns', onClick: () => run(() => setTableAttr({ 'data-place': 'column' }, '표를 단 안에 넣었습니다')) },
        { label: '지면 전체 폭으로 (단 걸치기)', icon: 'maximize', onClick: () => run(() => setTableAttr({ 'data-place': 'page' }, '표를 지면 전체 폭으로 놓았습니다')) },
        { label: '자리 자동 (열이 많으면 단 걸침)', icon: 'wand', onClick: () => run(() => setTableAttr({ 'data-place': null }, '표 자리 자동')) },
        { divider: '표 맞춤', label: '' },
        { label: '표를 왼쪽으로', icon: 'align-left', onClick: () => run(() => setTableAttr({ 'data-align': 'left' }, '표를 왼쪽에 두었습니다')) },
        { label: '표를 가운데로', icon: 'align-center', onClick: () => run(() => setTableAttr({ 'data-align': 'center' }, '표를 가운데에 두었습니다')) },
        { label: '표를 오른쪽으로', icon: 'align-right', onClick: () => run(() => setTableAttr({ 'data-align': 'right' }, '표를 오른쪽에 두었습니다')) },
      ],
    },
    {
      label: '표 옮기기 · 복사', short: '옮기기', icon: 'chevron-up',
      menu: [
        { label: '표를 위로 이동', icon: 'chevron-up', onClick: () => run(() => { moveTable(editor, -1) }) },
        { label: '표를 아래로 이동', icon: 'chevron-down', onClick: () => run(() => { moveTable(editor, 1) }) },
        { label: '표 복사', icon: 'cards', onClick: () => run(() => { copyTable(editor, false) }) },
        { label: '표 잘라내기', icon: 'page-break', onClick: () => run(() => { copyTable(editor, true) }) },
      ],
    },

    { divider: '그리기', label: '' },
    { label: '표 그리기 (연필)', short: '표 그리기', icon: 'paint', onClick: () => run(() => { setPenMode('draw') }) },
    { label: '지우개', short: '지우개', icon: 'fill', onClick: () => run(() => { setPenMode('erase') }) },

    { divider: '행 및 열', label: '' },
    {
      label: '삭제', short: '삭제', icon: 'trash',
      menu: [
        { label: '셀 삭제 — 왼쪽으로 밀기', icon: 'close', onClick: () => run(() => { deleteCellsShift(editor, 'left') }) },
        { label: '셀 삭제 — 위로 밀기', icon: 'close', onClick: () => run(() => { deleteCellsShift(editor, 'up') }) },
        { label: '열 삭제', icon: 'trash', onClick: () => run(() => editor.chain().focus().deleteColumn().run()) },
        { label: '행 삭제', icon: 'trash', onClick: () => run(() => editor.chain().focus().deleteRow().run()) },
        { label: '표 삭제', icon: 'trash', onClick: () => run(() => editor.chain().focus().deleteTable().run()) },
      ],
    },
    { label: '위에 행 삽입', short: '위에 행', icon: 'plus', hint: 'Alt+Shift+I', onClick: () => run(() => editor.chain().focus().addRowBefore().run()) },
    { label: '아래에 행 삽입', short: '아래 행', icon: 'plus', hint: 'Alt+I', onClick: () => run(() => editor.chain().focus().addRowAfter().run()) },
    { label: '왼쪽에 열 삽입', short: '왼쪽 열', icon: 'plus', hint: 'Alt+Shift+O', onClick: () => run(() => editor.chain().focus().addColumnBefore().run()) },
    { label: '오른쪽에 열 삽입', short: '오른쪽 열', icon: 'plus', hint: 'Alt+O', onClick: () => run(() => editor.chain().focus().addColumnAfter().run()) },

    { divider: '병합', label: '' },
    { label: '셀 병합', short: '셀 병합', icon: 'box', hint: 'Alt+M', onClick: () => run(() => editor.chain().focus().mergeCells().run()) },
    { label: '셀 분할', short: '셀 분할', icon: 'columns', hint: 'Alt+Shift+M', onClick: () => run(() => editor.chain().focus().splitCell().run()) },
    { label: '표 분할 (커서 행에서 둘로)', short: '표 분할', icon: 'page-break', onClick: () => run(() => { splitTable(editor) }) },

    { divider: '셀 크기', label: '' },
    {
      label: '자동 맞춤', short: '자동 맞춤', icon: 'maximize',
      menu: [
        { label: '내용에 자동으로 맞춤', icon: 'maximize', onClick: () => run(() => setTableAttr({ 'data-fit': 'contents' }, '내용에 맞췄습니다')) },
        { label: '창에 자동으로 맞춤', icon: 'maximize', onClick: () => run(() => setTableAttr({ 'data-fit': 'window' }, '창(단) 너비에 맞췄습니다')) },
        { label: '고정 열 너비', icon: 'columns', onClick: () => run(() => setTableAttr({ 'data-fit': 'fixed' }, '열 너비를 고정했습니다')) },
      ],
    },
    { label: '행 높이 지정 (창)', short: '행 높이', icon: 'table', onClick: () => run(askRowHeight) },
    { label: '표 너비 지정 (창)', short: '표 너비', icon: 'columns', onClick: () => run(askTableWidth) },
    { label: '셀 여백 — 표 전체 (창)', short: '표 여백', icon: 'box', onClick: () => run(askCellPadding) },
    { label: '셀 여백 — 고른 칸 (창)', short: '셀 여백', icon: 'box', onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-table-format', { detail: { tab: 'align' } }))) },
    { label: '행 높이를 같게 (고른 행만)', short: '행 같게', icon: 'table', hint: 'Alt+Shift+E', onClick: () => run(() => { distributeRows(editor) }) },
    { label: '열 너비를 같게 (고른 열만)', short: '열 같게', icon: 'columns', hint: 'Alt+E', onClick: () => run(() => { distributeColumns(editor) }) },
    { label: '열 너비 지정 지우기 (내용에 맞게)', short: '열 초기화', icon: 'refresh-cw', onClick: () => run(evenColumnWidths) },
    { label: '열 너비 넓히기 (+8px)', short: '열 ＋', icon: 'chevron-right', onClick: () => run(() => { resizeColumns(editor, 8) }) },
    { label: '열 너비 좁히기 (−8px)', short: '열 －', icon: 'chevron-left', onClick: () => run(() => { resizeColumns(editor, -8) }) },
    { label: '행 높이 키우기 (+8px)', short: '행 ＋', icon: 'chevron-down', onClick: () => run(() => { resizeRows(editor, 8) }) },
    { label: '행 높이 줄이기 (−8px)', short: '행 －', icon: 'chevron-up', onClick: () => run(() => { resizeRows(editor, -8) }) },
    { label: '행을 위로 이동', short: '행 ↑', icon: 'chevron-up', hint: 'Shift+Alt+↑', onClick: () => run(() => { moveRow(editor, -1) }) },
    { label: '행을 아래로 이동', short: '행 ↓', icon: 'chevron-down', hint: 'Shift+Alt+↓', onClick: () => run(() => { moveRow(editor, 1) }) },

    { divider: '맞춤', label: '' },
    {
      /* 아홉 칸 격자를 리본에 펴 놓으면 그 탭만 22px 더 높아져, 표를 누를 때마다 본문이 툭 내려앉는다.
         차림표로 접어 모든 탭 높이를 한 줄로 맞췄다 (골라 쓰는 아홉 자리는 그대로다). */
      label: '칸 맞춤 (아홉 자리)', short: '맞춤', icon: 'align-center',
      menu: (
        ([
          ['top', 'left', '위 왼쪽'], ['top', 'center', '위 가운데'], ['top', 'right', '위 오른쪽'],
          ['middle', 'left', '가운데 왼쪽'], ['middle', 'center', '한가운데'], ['middle', 'right', '가운데 오른쪽'],
          ['bottom', 'left', '아래 왼쪽'], ['bottom', 'center', '아래 가운데'], ['bottom', 'right', '아래 오른쪽'],
        ] as [string, string, string][]).map(([v, h, label]): MenuItem => ({
          label,
          icon: h === 'left' ? 'align-left' : h === 'center' ? 'align-center' : 'align-right',
          onClick: () => run(() => { applyCellAlign(editor, h as 'left' | 'center' | 'right', v as 'top' | 'middle' | 'bottom') }),
        }))
      ),
    },
    { label: '칸 안 글 양쪽 맞춤', short: '양쪽', icon: 'align-justify', onClick: () => run(() => { applyCellAlign(editor, 'justify', 'middle') }) },
    { label: '텍스트 방향 변경 (가로 ↔ 세로쓰기)', short: '텍스트 방향', icon: 'paragraph', onClick: () => run(() => { cycleCellTextDirection(editor) }) },
    { label: '칸 안 글 들여쓰기', short: '들여쓰기', icon: 'chevron-right', onClick: () => run(() => { applyCellIndent(editor, 1) }) },
    { label: '칸 안 글 내어쓰기', short: '내어쓰기', icon: 'chevron-left', onClick: () => run(() => { applyCellIndent(editor, -1) }) },

    { divider: '데이터', label: '' },
    {
      label: '정렬', short: '정렬', icon: 'list-numbered',
      menu: [
        { label: '오름차순 정렬 (머리글 행은 그대로)', icon: 'chevron-up', onClick: () => run(() => { sortTableByCurrentColumn(editor, 'asc') }) },
        { label: '내림차순 정렬', icon: 'chevron-down', onClick: () => run(() => { sortTableByCurrentColumn(editor, 'desc') }) },
      ],
    },
    { label: '페이지마다 머리글 행 반복', short: '제목 반복', icon: 'table', onClick: () => run(() => {
      const on = editor.getAttributes('table')['data-repeat-header'] ? null : '1'
      setTableAttr({ 'data-repeat-header': on }, on ? '쪽을 넘으면 제목 행을 반복합니다' : '제목 행 반복을 껐습니다')
    }) },
    { label: '표를 글로 바꾸기 (창)', short: '텍스트로', icon: 'file-text', onClick: () => run(askTableToText) },
    { label: '현재 열 합계', short: '열 합계', icon: 'hash', onClick: () => run(() => aggregateColumn(editor, 'sum')) },
    { label: '현재 열 평균', short: '열 평균', icon: 'hash', onClick: () => run(() => aggregateColumn(editor, 'avg')) },
    {
      label: '수식 (fx)', short: '수식', icon: 'hash',
      menu: [
        { label: '위쪽 합계 =SUM(ABOVE)', icon: 'hash', onClick: () => run(() => { setCellFormula(editor, '=SUM(ABOVE)', '#,##0') }) },
        { label: '왼쪽 합계 =SUM(LEFT)', icon: 'hash', onClick: () => run(() => { setCellFormula(editor, '=SUM(LEFT)', '#,##0') }) },
        { label: '위쪽 평균 =AVERAGE(ABOVE)', icon: 'hash', onClick: () => run(() => { setCellFormula(editor, '=AVERAGE(ABOVE)', '#,##0.00') }) },
        { label: '개수 =COUNT(ABOVE)', icon: 'hash', onClick: () => run(() => { setCellFormula(editor, '=COUNT(ABOVE)', '#,##0') }) },
        { label: '직접 쓰기... (함수 안내와 번호 형식)', icon: 'hash', onClick: () => run(askCellFormula) },
        { label: '고른 칸 합계 (블록 계산)', icon: 'hash', onClick: () => run(() => { blockCalc(editor, 'sum') }) },
        { label: '고른 칸 평균 (블록 계산)', icon: 'hash', onClick: () => run(() => { blockCalc(editor, 'avg') }) },
      ],
    },
  ]

  /* ── 표: 워드의 「표 디자인」 탭 ── */
  /* 표 디자인 — 워드 「테이블 디자인」 탭 그대로의 묶음:
     표 스타일 옵션 · 표 스타일 · 음영 · 테두리 */
  const tableDesignItems: MenuItem[] = [
    { divider: '표 스타일 옵션', label: '' },
    { label: '머리글 행', short: '머리글 행', icon: 'check', onClick: () => run(() => { toggleTableOption(editor, 'data-header-row') }) },
    { label: '요약 행 (마지막 행 강조)', short: '요약 행', icon: 'check', onClick: () => run(() => { toggleTableOption(editor, 'data-last-row') }) },
    { label: '줄무늬 행', short: '줄무늬 행', icon: 'check', onClick: () => run(() => { toggleTableOption(editor, 'data-banded-rows') }) },
    { label: '첫째 열', short: '첫째 열', icon: 'check', onClick: () => run(() => { toggleTableOption(editor, 'data-first-col') }) },
    { label: '마지막 열', short: '마지막 열', icon: 'check', onClick: () => run(() => { toggleTableOption(editor, 'data-last-col') }) },
    { label: '줄무늬 열', short: '줄무늬 열', icon: 'check', onClick: () => run(() => { toggleTableOption(editor, 'data-banded-cols') }) },

    { divider: '표 스타일', label: '' },
    ...TABLE_STYLES.slice(0, 3).map((st): MenuItem => ({
      label: st.label + ' — ' + st.desc, short: st.label, icon: 'table',
      onClick: () => run(() => { setTableStyle(editor, st.value) }),
    })),
    {
      label: '표 스타일 갤러리', short: '스타일', icon: 'table',
      menu: TABLE_STYLES.map((st): MenuItem => ({
        label: st.label + ' — ' + st.desc, icon: 'table',
        onClick: () => run(() => { setTableStyle(editor, st.value) }),
      })),
    },

    { divider: '음영', label: '' },
    {
      label: '음영 (칸 색 채우기)', short: '음영', icon: 'fill',
      panel: () => <ColorPalette onPick={(c) => { applyShading(editor, c) }} />,
    },

    { divider: '테두리', label: '' },
    {
      label: '테두리 스타일 (펜 한 벌 고르기)', short: '선 스타일', icon: 'minus',
      menu: BORDER_PRESETS.map((preset): MenuItem => ({
        label: preset.label, icon: 'minus',
        onClick: () => run(() => { setPen(preset.pen); flash('펜: ' + preset.label) }),
      })),
    },
    {
      label: '펜 두께', short: '두께', icon: 'minus',
      panel: () => <LineWidthList value={currentPen().width} color={currentPen().color} onPick={(px) => { setPen({ width: px }); flash('펜 두께 ' + px + 'px') }} />,
    },
    {
      label: '펜 모양', short: '선 모양', icon: 'minus',
      panel: () => <LineStyleList value={currentPen().style} color={currentPen().color} onPick={(style) => { setPen({ style }); flash('펜 모양') }} />,
    },
    {
      label: '펜 색', short: '펜 색', icon: 'palette',
      panel: () => <ColorPalette value={currentPen().color} noneLabel="자동 (검정)" noneValue="#000000" onPick={(c) => { setPen({ color: c || '#000000' }); flash('펜 색 ' + (c || '검정')) }} />,
    },
    {
      label: '테두리', short: '테두리', icon: 'box',
      onClick: () => run(() => { applyBorders(editor, 'all') }),
      menu: [
        ...BORDER_WHERE.map((w): MenuItem => ({
          label: w.label, icon: 'box', onClick: () => run(() => { applyBorders(editor, w.key) }),
        })),
        { divider: '대각선·그 밖에', label: '' },
        { label: '하향 대각선 테두리 ＼', icon: 'box', onClick: () => run(() => { applyDiagonal(editor, 'down') }) },
        { label: '상향 대각선 테두리 ／', icon: 'box', onClick: () => run(() => { applyDiagonal(editor, 'up') }) },
        { label: '엇갈린 대각선 ✕', icon: 'box', onClick: () => run(() => { applyDiagonal(editor, 'both') }) },
        { label: '대각선 지우기', icon: 'close', onClick: () => run(() => { applyDiagonal(editor, null) }) },
        { label: '가로줄', icon: 'minus', onClick: () => run(insertHr) },
        { label: '표 그리기', icon: 'paint', onClick: () => run(() => { setPenMode('draw') }) },
        { label: '눈금선 보기', icon: 'table', onClick: () => run(() => window.dispatchEvent(new Event('jan-table-gridlines'))) },
        { label: '테두리 및 음영...', icon: 'settings', onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-table-format', { detail: { tab: 'border' } }))) },
      ],
    },
    { label: '테두리 복사 (본을 집어 다른 칸에 바른다)', short: '테두리 복사', icon: 'cards', onClick: () => run(() => { setPenMode('copy') }) },
    { label: '지우개 (선 지우기)', short: '지우개', icon: 'fill', onClick: () => run(() => { setPenMode('erase') }) },
    { label: '셀 대각선·표 그리기 창 열기', short: '테두리 창', icon: 'settings', onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-table-format', { detail: { tab: 'border' } }))) },
  ]

  /* 그림 — 워드의 「그림 서식」 탭을 그대로 옮겼다.
     크기·자르기·회전·배치·스타일·테두리·효과·보정·접근성, 그리고 한글의 캡션·개체 보호까지. */
  const imgDialog = (tab: string) => window.dispatchEvent(new CustomEvent('jan-image-dialog', { detail: { tab } }))
  /* 도형 — 워드의 「도형 서식」 탭. 그림과 같은 배치·회전 규칙을 쓴다. */
  const shapeItems: MenuItem[] = [
    { divider: '도형 넣기', label: '' },
    { label: '도형 갤러리 열기', short: '갤러리', icon: 'box', onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'insert' } }))) },
    { label: '도형 바꾸기 (크기·서식은 그대로)', short: '도형 변경', icon: 'refresh-cw', onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'format' } }))) },
    ...SHAPES.slice(0, 10).map((sh): MenuItem => ({ label: sh.label + ' 넣기', short: sh.label, icon: 'box', onClick: () => run(() => { insertShape(editor, 'shape', sh.key) }) })),

    ...SHAPE_STYLES.map((st): MenuItem => ({ label: '스타일: ' + st.label, short: st.label, icon: 'palette', onClick: () => run(() => { applyShapeStyle(editor, st.key) }) })),
    { label: '채우기 색 고르기', short: '채우기', icon: 'fill', onClick: () => run(() => {
      const color = window.prompt('채우기 색 (#RRGGBB · 빈 칸이면 채우기 없음)', '#dbeafe')
      if (color !== null) setShapeFill(editor, color || null)
    }) },
    { label: '선 색·두께·모양', short: '윤곽선', icon: 'box', onClick: () => run(() => {
      const color = window.prompt('선 색 (#RRGGBB · 빈 칸이면 선 없음)', '#2563eb')
      if (color === null) return
      const width = Number(window.prompt('선 두께 (px)', '2') || 2)
      const style = window.prompt('선 모양 — solid · dashed · dotted', 'solid') || 'solid'
      setShapeStroke(editor, { color: color || null, width, style })
    }) },
    { label: '그림자 켬/끔', short: '그림자', icon: 'box', onClick: () => run(() => {
      const hit = currentShape(editor)
      if (hit) setShapeAttrs(editor, { shadow: !hit.node.attrs.shadow }, '그림자를 바꿨다')
    }) },
    { label: '투명도 정하기', short: '투명도', icon: 'sliders', onClick: () => run(() => {
      const v = window.prompt('투명도 (10~100)', '100')
      if (v !== null) setShapeAttrs(editor, { opacity: Number(v) || 100 })
    }) },

    { divider: '글자', label: '' },
    { label: '도형 안 글 고치기', short: '글 넣기', icon: 'file-text', onClick: () => run(() => {
      const hit = currentShape(editor)
      const value = window.prompt('도형 안에 넣을 글', String(hit?.node.attrs.text || ''))
      if (value !== null) setShapeText(editor, value)
    }) },
    { label: '글자 방향 (가로 · 세로쓰기 · 90° · 270°)', short: '글자 방향', icon: 'paragraph', hint: 'Alt+D', onClick: () => run(() => { cycleTextDirection(editor) }) },
    { label: '글자 세로 맞춤 (위 · 가운데 · 아래)', short: '세로 맞춤', icon: 'align-center', hint: 'Alt+Shift+D', onClick: () => run(() => { cycleVAlign(editor) }) },
    { label: '글자 색·크기', short: '글자 꾸밈', icon: 'palette', onClick: () => run(() => {
      const color = window.prompt('글자 색 (#RRGGBB)', '#1c1f26')
      if (color === null) return
      const size = Number(window.prompt('글자 크기 (px)', '15') || 15)
      setShapeAttrs(editor, { textColor: color, fontSize: size })
    }) },
    ...([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] as [string, string][]).map(
      ([key, label]): MenuItem => ({ label: '글자 ' + label + ' 맞춤', short: label, icon: 'align-left', onClick: () => run(() => { setShapeAttrs(editor, { textAlign: key }) }) })
    ),

    { divider: '배치', label: '' },
    ...IMAGE_WRAPS.map((w): MenuItem => ({
      label: w.label + ' — ' + w.hint, short: w.label, icon: 'align-justify',
      onClick: () => run(() => { setShapeWrap(editor, w.key === 'topbottom' ? null : w.key, '배치: ' + w.label) }),
    })),
    { label: '왼쪽 맞춤', short: '왼쪽', icon: 'align-left', onClick: () => run(() => { setShapeAlign(editor, 'left') }) },
    { label: '가운데 맞춤', short: '가운데', icon: 'align-center', onClick: () => run(() => { setShapeAlign(editor, 'center') }) },
    { label: '오른쪽 맞춤', short: '오른쪽', icon: 'align-right', onClick: () => run(() => { setShapeAlign(editor, 'right') }) },
    { label: '앞 문단으로 옮기기', short: '위로', icon: 'chevron-up', hint: 'Alt+Home', onClick: () => run(() => { moveShape(editor, -1) }) },
    { label: '뒤 문단으로 옮기기', short: '아래로', icon: 'chevron-down', hint: 'Alt+End', onClick: () => run(() => { moveShape(editor, 1) }) },
    { label: '개체 보호 켬/끔', short: '개체 보호', icon: 'lock', hint: 'Alt+L', onClick: () => run(() => { toggleShapeLock(editor) }) },

    { label: '크기·서식 대화상자', short: '속성', icon: 'maximize', hint: 'Alt+P', onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'format' } }))) },
    { label: '오른쪽으로 90° 회전', short: '오른쪽 90°', icon: 'refresh-cw', hint: 'Alt+R', onClick: () => run(() => { rotateShape(editor, 90) }) },
    { label: '왼쪽으로 90° 회전', short: '왼쪽 90°', icon: 'refresh-cw', onClick: () => run(() => { rotateShape(editor, -90) }) },
    { label: '좌우 대칭', short: '좌우 대칭', icon: 'refresh-cw', hint: 'Alt+H', onClick: () => run(() => { flipShape(editor, 'h') }) },
    { label: '상하 대칭', short: '상하 대칭', icon: 'refresh-cw', hint: 'Alt+V', onClick: () => run(() => { flipShape(editor, 'v') }) },

    { divider: '글맵시 · 아이콘 · 지우기', label: '' },
    ...WORDART.slice(0, 8).map((w): MenuItem => ({ label: '글맵시: ' + w.label, short: w.label, icon: 'sparkle', onClick: () => run(() => {
      const hit = currentShape(editor)
      if (hit && hit.node.attrs.kind === 'wordart') changeShape(editor, w.key)
      else insertShape(editor, 'wordart', w.key)
    }) })),
    ...CLIPART.slice(0, 8).map((c): MenuItem => ({ label: '아이콘: ' + c.label, short: c.label, icon: 'star', onClick: () => run(() => { insertShape(editor, 'icon', c.key) }) })),

    { label: '개체 삭제', short: '삭제', icon: 'trash', onClick: () => run(() => editor.chain().focus().deleteSelection().run()) },
  ]

  const imageItems: MenuItem[] = [
    { divider: '모양 다듬기', label: '' },
    { label: '색 보정 (밝기·대비·채도·색조)', short: '색 보정', icon: 'settings', hint: 'Alt+T', onClick: () => run(() => imgDialog('adjust')) },
    ...RECOLORS.map((r): MenuItem => ({ label: '색: ' + r.label, short: r.label, icon: 'palette', onClick: () => run(() => { applyRecolor(editor, r.key) }) })),
    { label: '흰 배경 없애기', short: '배경 제거', icon: 'fill', onClick: () => run(() => { removeWhiteBackground(editor) }) },
    { label: '그림 압축 (긴 변 1600px)', short: '압축', icon: 'download', onClick: () => run(() => { compressImage(editor) }) },
    { label: '그림 바꾸기...', short: '바꾸기', icon: 'refresh-cw', onClick: () => run(() => window.dispatchEvent(new CustomEvent('jan-image-replace'))) },
    { label: '그림 원래대로 (서식만)', short: '원래대로', icon: 'refresh-cw', hint: 'Alt+Z', onClick: () => run(() => { resetImageFormat(editor) }) },
    { label: '그림과 크기 원래대로', short: '전부 원래대로', icon: 'refresh-cw', onClick: () => run(() => { resetImageFormat(editor, true) }) },

    ...IMAGE_STYLES.map((st): MenuItem => ({ label: '스타일: ' + st.label + ' — ' + st.hint, short: st.label, icon: 'image', onClick: () => run(() => { setImageStyle(editor, st.key, st.label) }) })),
    { label: '테두리 색·두께 정하기', short: '테두리', icon: 'box', onClick: () => run(() => {
      const color = window.prompt('테두리 색 (#RRGGBB · 빈 칸이면 없앤다)', '#333333')
      if (color === null) return
      if (!color) { setImageBorder(editor, { color: null, width: null, style: null }); return }
      const width = Number(window.prompt('테두리 두께 (px)', '2') || 2)
      const style = window.prompt('선 모양 — solid · dashed · dotted · double', 'solid') || 'solid'
      setImageBorder(editor, { color, width, style })
    }) },
    { label: '테두리 없애기', short: '테두리 없음', icon: 'box', onClick: () => run(() => { setImageBorder(editor, { color: null, width: null, style: null }) }) },
    { label: '모서리 둥글기', short: '둥글기', icon: 'box', onClick: () => run(() => {
      const r = window.prompt('모서리 둥글기 (px)', '12')
      if (r !== null) setImageAttrs(editor, { radius: Number(r) || null })
    }) },
    { label: '그림 서식 복사', short: '서식 복사', icon: 'cards', hint: 'Alt+B', onClick: () => run(() => { copyImageFormat(editor) }) },
    { label: '앞 그림 서식 적용', short: '서식 붙이기', icon: 'cards', hint: 'Alt+Shift+B', onClick: () => run(() => { pasteImageFormat(editor) }) },

    { divider: '크기', label: '' },
    { label: '크기·위치 대화상자', short: '크기', icon: 'maximize', hint: 'Alt+P', onClick: () => run(() => imgDialog('size')) },
    { label: '작게 (200px)', short: '작게', icon: 'image', onClick: () => run(() => { setImageWidth(editor, '200px') }) },
    { label: '중간 (400px)', short: '중간', icon: 'image', onClick: () => run(() => { setImageWidth(editor, '400px') }) },
    { label: '크게 (600px)', short: '크게', icon: 'image', onClick: () => run(() => { setImageWidth(editor, '600px') }) },
    { label: '본문 너비에 맞춤', short: '전체 너비', icon: 'maximize', hint: 'Alt+F', onClick: () => run(() => { fitImageToBody(editor) }) },
    { label: '표 칸 크기에 맞춤', short: '칸에 맞춤', icon: 'table', onClick: () => run(() => { fitImageToCell(editor) }) },
    { label: '원래 크기로', short: '원래 크기', icon: 'refresh-cw', hint: 'Alt+0', onClick: () => run(() => { resetImageSize(editor) }) },
    ...[25, 50, 75, 150, 200].map((n): MenuItem => ({ label: '원래 크기의 ' + n + '%', short: n + '%', icon: 'image', onClick: () => run(() => { scaleImage(editor, n) }) })),
    { label: '가로 세로 비율 고정 켬/끔', short: '비율 고정', icon: 'lock', hint: 'Alt+K', onClick: () => run(() => { toggleAspectLock(editor) }) },

    { label: '자르기 손잡이 켜기/끄기', short: '자르기', icon: 'page-break', onClick: () => run(() => window.dispatchEvent(new Event('jan-image-crop-mode'))) },
    { label: '자르기 수치로 정하기', short: '자르기 값', icon: 'page-break', onClick: () => run(() => imgDialog('crop')) },
    ...([['1:1', 1], ['4:3', 4 / 3], ['3:2', 1.5], ['16:9', 16 / 9], ['3:4', 0.75], ['9:16', 9 / 16]] as [string, number][]).map(
      ([label, ratio]): MenuItem => ({ label: label + ' 비율로 자르기', short: label, icon: 'page-break', onClick: () => run(() => { cropToRatio(editor, ratio, label) }) })
    ),
    ...IMAGE_SHAPES.map((sh): MenuItem => ({ label: sh.label + ' 모양으로 자르기', short: sh.label, icon: 'page-break', onClick: () => run(() => { setImageShape(editor, sh.key, sh.label) }) })),
    { label: '자르기 지우기 (원본 그대로)', short: '자르기 해제', icon: 'refresh-cw', hint: 'Alt+X', onClick: () => run(() => { clearCrop(editor) }) },

    { divider: '배치', label: '' },
    ...IMAGE_WRAPS.map((w): MenuItem => ({
      label: w.label + ' — ' + w.hint, short: w.label, icon: 'align-justify',
      onClick: () => run(() => { setImageWrap(editor, w.key === 'topbottom' ? null : w.key, '배치: ' + w.label) }),
    })),
    { label: '왼쪽 맞춤', short: '왼쪽', icon: 'align-left', onClick: () => run(() => { setImageAlign(editor, 'left') }) },
    { label: '가운데 맞춤', short: '가운데', icon: 'align-center', onClick: () => run(() => { setImageAlign(editor, 'center') }) },
    { label: '오른쪽 맞춤', short: '오른쪽', icon: 'align-right', onClick: () => run(() => { setImageAlign(editor, 'right') }) },
    { label: '앞 문단으로 옮기기', short: '위로', icon: 'chevron-up', hint: 'Alt+Home', onClick: () => run(() => { moveImage(editor, -1) }) },
    { label: '뒤 문단으로 옮기기', short: '아래로', icon: 'chevron-down', hint: 'Alt+End', onClick: () => run(() => { moveImage(editor, 1) }) },
    { label: '개체 보호 켬/끔 (크기·위치 잠금)', short: '개체 보호', icon: 'lock', hint: 'Alt+L', onClick: () => run(() => { toggleImageLock(editor) }) },

    { label: '오른쪽으로 90° 회전', short: '오른쪽 90°', icon: 'refresh-cw', hint: 'Alt+R', onClick: () => run(() => { rotateImage(editor, 90) }) },
    { label: '왼쪽으로 90° 회전', short: '왼쪽 90°', icon: 'refresh-cw', hint: 'Alt+Shift+R', onClick: () => run(() => { rotateImage(editor, -90) }) },
    { label: '좌우 대칭', short: '좌우 대칭', icon: 'refresh-cw', hint: 'Alt+H', onClick: () => run(() => { flipImage(editor, 'h') }) },
    { label: '상하 대칭', short: '상하 대칭', icon: 'refresh-cw', hint: 'Alt+V', onClick: () => run(() => { flipImage(editor, 'v') }) },
    { label: '각도 직접 넣기', short: '각도', icon: 'refresh-cw', onClick: () => run(() => {
      const deg = window.prompt('회전 각도 (0~359)', '15')
      if (deg !== null) setRotation(editor, Number(deg) || 0)
    }) },

    { divider: '캡션 · 편집', label: '' },
    { label: '캡션 넣기 (그림과 함께 움직인다)', short: '캡션', icon: 'file-text', hint: 'Alt+C', onClick: () => run(() => imgDialog('caption')) },
    { label: '캡션 번호 다시 매기기', short: '번호 갱신', icon: 'hash', onClick: () => run(() => { numberImageCaptions(editor) }) },
    { label: '대체 텍스트 편집', short: '대체 텍스트', icon: 'info', hint: 'Alt+A', onClick: () => run(() => imgDialog('alt')) },
    { label: '다음 그림 고르기', short: '다음 그림', icon: 'chevron-down', hint: 'Alt+N', onClick: () => run(() => { selectNextImage(editor, 1) }) },

    { label: '그림판에서 주석 편집', short: '주석 편집', icon: 'paint', onClick: () => run(p.onPaint) },
    { label: '그림으로 저장', short: '저장', icon: 'download', onClick: () => run(() => { downloadImage(editor) }) },
    { label: '그림 삭제', short: '삭제', icon: 'trash', onClick: () => run(() => editor.chain().focus().deleteSelection().run()) },
  ]

  /* ============================================================
     리본 = 지금 이 문서를 만드는 일 (파일·편집·보기·입력·서식·쪽·검토)
     그 뒤 구분선 다음은 부가 묶음 (AI·논문) — 성격이 달라 눈에도 다르게 보이게 한다.
     문서와 상관없는 앱 유틸(그림판·OCR·마인드맵·포모도로…)은 리본에서 빼고
     오른쪽 유틸 아이콘과 더보기(⋯) 메뉴로 모았다.
     ============================================================ */
  /* 보기 탭의 '시각화'로 보낼 것 — 문서를 다른 눈으로 보는 기능 */
  const VIEW_KEYS = ['마인드맵', '플래시카드', '워드 클라우드', '포모도로']

  const toolsRest = notAi(pick('도우미'))

  /* ── 검수 탭 (워드 「검토」) 손잡이 ──────────────────────
     고친 자리를 남기고 훑어보는 일, 소리로 들어 보는 일, 낭독기로도 읽히게 하는 일,
     그리고 남에게 돌릴 때 손댈 범위를 좁히는 일까지 한 탭에 모았다. */
  const openReviewPane = () => window.dispatchEvent(new Event('jan-review-pane'))
  const openA11y = () => window.dispatchEvent(new Event('jan-a11y-panel'))
  const openSuggest = (mode: 'hanja' | 'synonym') =>
    window.dispatchEvent(new CustomEvent('jan-word-suggest', { detail: { mode } }))
  const openProtect = () => window.dispatchEvent(new Event('jan-protect-panel'))
  const openCount = () => window.dispatchEvent(new Event('jan-count-panel'))

  /* 사전에 낱말이 하나만 있으면 창을 열지 않고 바로 바꾼다 — 한글의 F9 가 그렇게 빠르다 */
  const quickHanja = (mode: 'hanja' | 'both' | 'hanjaFirst') => {
    const spot = wordAtCursor(editor)
    if (!spot) { flash('바꿀 낱말에 커서를 두거나 글을 고른다'); return }
    const { stem, tail, picks } = lookupHanja(spot.text)
    if (picks.length === 1) {
      const next = hanjaText(stem, picks[0].hanja, mode) + tail
      replaceSpot(editor, spot, next)
      flash(spot.text + ' \u2192 ' + next)
      return
    }
    openSuggest('hanja')
  }
  const backToHangul = () => {
    const spot = wordAtCursor(editor)
    if (!spot) { flash('되돌릴 글을 고른다'); return }
    const plain = hanjaToHangul(spot.text)
    if (plain === spot.text) { flash('한자가 없다'); return }
    replaceSpot(editor, spot, plain)
    flash(spot.text + ' \u2192 ' + plain)
  }
  const askAuthor = async () => {
    const name = await askText('변경 표시에 남길 내 이름', trackAuthor())
    if (name === null) return
    setTrackAuthor(name.trim() || '나')
    flash('이제 \u300c' + (name.trim() || '나') + '\u300d 로 남는다')
  }
  const askNewComment = async () => {
    const text = await askText('메모 — 이 자리에 남길 말', '', { multiline: true })
    if (text && addComment(editor, text)) openReviewPane()
  }
  const dropComment = () => {
    const row = commentAtCursor(editor)
    if (!row) { flash('지울 메모에 커서를 둔다'); return }
    removeComment(editor, row)
  }
  const doneComment = () => {
    const row = commentAtCursor(editor)
    if (!row) { flash('끝낼 메모에 커서를 둔다'); return }
    toggleCommentDone(editor, row)
  }
  /* 화면에서 표시만 감춘다 (워드의 「잉크 숨기기」·「메모 표시」 자리) */
  const toggleHide = (cls: string, on: string, off: string) => {
    const added = document.body.classList.toggle(cls)
    flash(added ? on : off)
  }

  const tracking = reviewFlags.tracking
  const marks = changeCount(editor)

  const reviewItems: MenuItem[] = [
    /* 워드 「검토」 와 같은 차례. 단추가 서른 개를 넘으면 리본이 옆으로 밀려 나가므로
       한 갈래에 딸린 것은 ▾ 안으로 접어 넣었다 (삽입 탭에서 배운 것). */
    { divider: '언어 교정', label: '' },
    ...take(toolsRest, ['맞춤법']),
    { label: '동의어 사전 — 대신 쓸 말 찾기', short: '동의어', icon: 'language', hint: 'Shift+F7', onClick: () => run(() => openSuggest('synonym')) },
    {
      label: '단어 개수 (글자·원고지까지)',
      short: '단어 셈',
      icon: 'hash',
      onClick: () => run(openCount),
      menu: [
        { label: '단어 개수 창 열기', short: '창 열기', icon: 'hash', onClick: () => run(openCount) },
        { label: '한 줄로 알려 주기 (토스트)', short: '한 줄', icon: 'info', onClick: () => run(() => flash(countLine(countReport(editor)))) },
      ],
    },
    ...take(aiFrom(pick('도우미')), ['문서 건강']),

    { divider: '소리 · 접근성', label: '' },
    {
      label: '소리내어 읽기 — 커서 자리부터',
      short: '읽어 주기',
      icon: 'speaker',
      onClick: () => run(() => { readAloud(editor) }),
      menu: [
        { label: '커서 자리부터 읽기', short: '읽기', icon: 'speaker', onClick: () => run(() => { readAloud(editor) }) },
        { label: '잠깐 멈춤 · 이어 읽기', short: '멈춤/이어', icon: 'volume', onClick: () => run(() => { pauseReading() }) },
        { label: '다음 문단부터 읽기', short: '다음 문단', icon: 'chevron-down', onClick: () => run(() => { readNextBlock(editor, 1) }) },
        { label: '앞 문단부터 읽기', short: '앞 문단', icon: 'chevron-up', onClick: () => run(() => { readNextBlock(editor, -1) }) },
        { label: '읽기 그만', short: '그만', icon: 'volume-off', onClick: () => run(() => { stopReading() }) },
      ],
    },
    { label: '접근성 검사 — 낭독기로 읽히나 보기', short: '접근성', icon: 'eye', onClick: () => run(openA11y) },

    { divider: '언어', label: '' },
    ...take(aiFrom(pick('도우미')), ['번역']),
    {
      label: '한자로 바꾸기',
      short: '한자',
      icon: 'translate',
      hint: 'F9',
      onClick: () => run(() => quickHanja('hanja')),
      menu: [
        ...HANJA_MODES.map((m): MenuItem => ({
          label: '한자로 바꾸기 — ' + m.label + ' (' + m.hint + ')', short: m.label, icon: 'translate',
          onClick: () => run(() => quickHanja(m.key)),
        })),
        { label: '한자 사전 창 열기 (뜻 보고 고르기)', short: '사전 창', icon: 'search', onClick: () => run(() => openSuggest('hanja')) },
        { label: '한글로 되돌리기', short: '한글로', icon: 'undo', onClick: () => run(backToHangul) },
      ],
    },

    { divider: '메모', label: '' },
    { label: '새 메모 달기', short: '새 메모', icon: 'quote', hint: 'Ctrl+Alt+M', onClick: () => run(() => { void askNewComment() }) },
    {
      /* 메모를 훑고 손보는 일은 한 단추에 모았다 — 리본이 한 줄을 넘지 않게 */
      label: '메모 목록 열고 닫기',
      short: '메모 목록',
      icon: 'menu',
      onClick: () => run(() => window.dispatchEvent(new Event('jan-comment-pane'))),
      menu: [
        { label: '다음 메모로', short: '다음', icon: 'chevron-down', onClick: () => run(() => { gotoAdjacentComment(editor, 1) }) },
        { label: '이전 메모로', short: '이전', icon: 'chevron-up', onClick: () => run(() => { gotoAdjacentComment(editor, -1) }) },
        { label: '이 메모 끝냄 / 되열기', short: '끝냄', icon: 'check', onClick: () => run(doneComment) },
        { label: '이 메모 지우기', short: '지우기', icon: 'trash', onClick: () => run(dropComment) },
        { label: '끝낸 메모 모두 걷기', short: '걷기', icon: 'close', onClick: () => run(() => { clearDoneComments(editor) }) },
      ],
    },

    { divider: '변경 내용 추적', label: '' },
    {
      label: tracking ? '변경 내용 추적 끄기 (지금 켜져 있다)' : '변경 내용 추적 켜기',
      short: tracking ? '추적 끔' : '추적 켬',
      icon: 'pen',
      hint: 'Alt+U',
      onClick: () => run(() => { toggleTracking(editor) }),
      menu: [
        { label: tracking ? '추적 끄기' : '추적 켜기', short: tracking ? '끄기' : '켜기', icon: 'pen', onClick: () => run(() => { toggleTracking(editor) }) },
        { label: '변경 표시에 남길 내 이름 — 지금 「' + trackAuthor() + '」', short: '내 이름', icon: 'user', onClick: () => run(() => { void askAuthor() }) },
      ],
    },
    {
      label: '표시 방식 — ' + (TRACK_MODES.find((m) => m.key === reviewFlags.mode)?.label || '모든 수정 내용'),
      short: '표시',
      icon: 'eye',
      menu: TRACK_MODES.map((m): MenuItem => ({
        label: m.label + ' — ' + m.hint + (reviewFlags.mode === m.key ? ' (지금 이것)' : ''),
        short: m.label,
        icon: 'eye',
        onClick: () => run(() => setTrackMode(m.key)),
      })),
      /* 누르면 차림표만 펼친다 — 무엇을 고르는지 보지 못한 채 보기가 바뀌면 안 된다 */
    },
    { label: '검토 창 열기 (넣음 ' + marks.ins + ' · 지움 ' + marks.del + ')', short: '검토 창', icon: 'cards', hint: 'Alt+F11', onClick: () => run(openReviewPane) },

    { divider: '변경 내용', label: '' },
    {
      label: '이 변경 적용',
      short: '적용',
      icon: 'check',
      onClick: () => run(() => { applyHere(editor, true) }),
      menu: [
        { label: '이 변경 적용', short: '하나', icon: 'check', onClick: () => run(() => { applyHere(editor, true) }) },
        { label: '모두 적용', short: '모두', icon: 'check', onClick: () => run(() => { acceptAll(editor) }) },
      ],
    },
    {
      label: '이 변경 되돌림',
      short: '되돌림',
      icon: 'undo',
      onClick: () => run(() => { applyHere(editor, false) }),
      menu: [
        { label: '이 변경 되돌림', short: '하나', icon: 'undo', onClick: () => run(() => { applyHere(editor, false) }) },
        { label: '모두 되돌림', short: '모두', icon: 'undo', onClick: () => run(() => { rejectAll(editor) }) },
      ],
    },
    { label: '이전 변경으로', short: '이전', icon: 'chevron-up', hint: 'Alt+,', onClick: () => run(() => { gotoChange(editor, -1) }) },
    { label: '다음 변경으로', short: '다음', icon: 'chevron-down', hint: 'Alt+.', onClick: () => run(() => { gotoChange(editor, 1) }) },

    { divider: '견주기 · 보호', label: '' },
    {
      label: '다른 메모와 견주기',
      short: '견주기',
      icon: 'replace',
      menu: take(toolsRest, ['메모 비교', '깨진 링크']),
    },
    {
      label: '편집 제한 — 지금 ' + reviewFlags.protect,
      short: '편집 제한',
      icon: 'shield',
      onClick: () => run(openProtect),
      menu: [
        { label: '편집 제한 창 열기', short: '제한 창', icon: 'shield', onClick: () => run(openProtect) },
        {
          label: reviewFlags.blockOthers ? '남이 손댄 자리 잠금 풀기' : '남이 손댄 자리 잠그기',
          short: '남의 자리',
          icon: 'lock',
          onClick: () => run(() => {
            const next = !reviewFlags.blockOthers
            saveProtect({ blockOthers: next })
            flash(next ? '남이 손댄 자리를 잠갔다' : '잠금을 풀었다')
          }),
        },
        { label: '비밀번호로 잠그기 (내용 암호화)', short: '암호 잠금', icon: 'unlock', onClick: () => run(p.onLock) },
      ],
    },

    { divider: '감추기 · 기록', label: '' },
    {
      label: '화면에서 표시 감추기',
      short: '감추기',
      icon: 'eye-off',
      /* 무엇을 감출지 골라야 하니 누르면 차림표만 펼친다 */
      menu: [
        { label: '메모 표시 감추기 / 보이기', short: '메모 표시', icon: 'eye-off', onClick: () => run(() => toggleHide('jan-hide-comments', '메모 표시를 감췄다', '메모 표시를 다시 보인다')) },
        { label: '형광펜 · 강조 감추기 / 보이기', short: '형광펜', icon: 'highlight', onClick: () => run(() => toggleHide('jan-hide-highlight', '형광펜을 감췄다 — 인쇄에도 안 나온다', '형광펜을 다시 보인다')) },
        { label: '변경 표시 감추기 (고친 뒤 모습)', short: '변경 표시', icon: 'eye-off', onClick: () => run(() => setTrackMode(reviewFlags.mode === 'final' ? 'all' : 'final')) },
      ],
    },
    {
      label: '문서 기록 보기',
      short: '기록',
      icon: 'history',
      menu: take(toolsRest, ['통계', '활동 히트맵', '메모 정보']),
    },
  ]

  const groups: MenuGroup[] = [
    { label: '파일', items: pick('파일') },
    { label: '편집', items: editItems },
    {
      label: '보기',
      items: [
        ...pick('보기'),
        { divider: '다르게 보기', label: '' },
        {
          /* 마인드맵·낱말 구름처럼 「문서를 다른 눈으로 보는」 것들 — 이름이 길어 한 자리에 모았다 */
          label: '다르게 보기 (마인드맵 · 낱말 구름 · 플래시카드)', short: '다르게', icon: 'sparkle',
          menu: [...take(toolsRest, VIEW_KEYS), ...take(aiFrom(pick('도우미')), ['마인드맵', '워드 클라우드'])],
        },
      ],
    },
    /* 워드와 같은 이름을 쓴다 — 한글은 「입력」, 워드는 「삽입」이다.
       묶음이 열 개를 넘어 두 탭으로 나눴다: 넣는 「물건」(삽입) 과 글에 붙는 「꾸밈」(텍스트). */
    { label: '삽입', items: pick('삽입') },
    { label: '텍스트', items: pick('텍스트') },
    { label: '디자인', items: pick('디자인') },
    { label: '서식', items: drop(pick('서식'), ['엔터 표시']) },
    { label: '레이아웃', items: pick('페이지') },
    /* 검수 탭이 워드 「검토」 자리다 — 이름만 우리 것으로 바꿨다 */
    { label: '검수', items: reviewItems },
    { label: 'AI', items: aiItems, extra: true },
    /* 논문은 문서 일반과 결이 달라 부가 탭으로 세운다 — 학회 양식·구성 요소·DOI 인용은 논문에만 있다 */
    { label: '논문', items: pick('논문'), extra: true },
    /* 도구 = 창을 열어 만들고 적는 앱 도구 (문서 편집이 아니라서 부가 탭에 둔다) */
    { label: '도구', items: pick('도구'), extra: true },
    /* 자료 탭이 워드 「참조」 자리다 — 예전 「논문」 탭의 학술 기능도 이 안에 녹였다
       (목차·캡션·인용·번호 매기기가 두 군데로 갈라져 있던 것을 한 자리로 모았다) */
    { label: '자료', items: pick('자료') },
    /* 워드처럼 표 안에서는 상황별 탭이 두 개 열린다 — 「표 디자인」(모양)과 「레이아웃」(구조) */
    /* 상황 탭은 명령이 많아 한 줄을 넘기 쉽다 — 묶음마다 앞의 것만 두고 나머지는 「더보기」 로 접는다 */
    ...(inTable ? [{ label: '표 디자인', items: foldTail(tableDesignItems, 3), context: true }] : []),
    ...(inTable ? [{ label: '표 레이아웃', items: foldTail(tableItems, 1), context: true }] : []),
    ...(onImage ? [{ label: '그림', items: foldTail(imageItems, 3), context: true }] : []),
    ...(onShape ? [{ label: '도형', items: foldTail(shapeItems, 3), context: true }] : []),
    ...(onChart ? [{ label: '차트 도구', items: foldTail(pick('차트 도구'), 3), context: true }] : []),
    ...(onSmart ? [{ label: '도해 도구', items: foldTail(pick('도해 도구'), 4), context: true }] : []),
  ]

  /* 묶음 오른쪽 아래 화살표 → 그 묶음의 전체 설정 창 (한글·워드의 대화상자 연결) */
  const ribbonLaunchers: Record<string, { label: string; onClick: () => void }> = {
    '페이지 동작': { label: '쪽 설정 창 열기', onClick: () => p.onPageSettings() },
    '미리보기 / 인쇄': { label: '인쇄 미리보기 열기', onClick: () => p.onPrintPreview() },
    '한국어 타이포': { label: '문서 스타일 창 열기', onClick: () => p.onTypo() },
    '제목': { label: '문서 스타일 창 열기', onClick: () => p.onTypo() },
    '서식 복사 · 내 스타일': { label: '내 스타일 관리 열기', onClick: () => p.onSnippets() },
  }

  return (
    <div className="jan-toolbar-stack">
    <Ribbon
      tabs={groups}
      activeTab={ribbonTab}
      onTabChange={setRibbonTab}
      collapsed={ribbonCollapsed}
      onToggleCollapsed={() => setRibbonCollapsed((v) => !v)}
      launchers={ribbonLaunchers}
      leading={p.barLeading}
      trailing={p.barTrailing}
      tail={p.barTail}
    />
    <div
      className="jan-toolbar-row"
      ref={containerRef}
      onMouseDownCapture={() => {
        const sel = editor.state.selection
        savedSelRef.current = { from: sel.from, to: sel.to }
      }}
      onFocusCapture={() => {
        // 탭으로 들어온 경우 — 아직 문서 선택이 살아 있으면 기억해 둔다
        const sel = editor.state.selection
        if (sel.from !== sel.to) savedSelRef.current = { from: sel.from, to: sel.to }
      }}
    >
      {/* 글자 모양 — 한글·워드의 서식 도구 상자: 값을 직접 입력하고 증감 단추로도 조절한다 */}
      <FontCombo
        value={charState.fontFamily}
        onPick={(v) => applyToSelection((c) => (v ? c.setFontFamily(v) : c.unsetFontFamily()))}
      />
      <NumberSpin
        value={fontSizePt}
        onChange={(v, o) => applyToSelection((c) => (v == null ? c.unsetFontSize() : c.setFontSize(`${v}pt`)), o?.keepFocus)}
        min={4} max={300} step={1} unit="pt" width={40} inherited={docSizePt}
        title="글자 크기 (직접 입력, ↑↓·휠·단추로 증감. Shift 를 누르면 10씩)"
        ariaLabel="글자 크기"
        presets={[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72]}
      />
      <button onClick={() => stepFontSize(1)} title="글자 크게 (Ctrl+])" aria-label="글자 크게" className="jan-fontstep">가<span>▲</span></button>
      <button onClick={() => stepFontSize(-1)} title="글자 작게 (Ctrl+[)" aria-label="글자 작게" className="jan-fontstep">가<span>▼</span></button>
      <span className="divider" />

      <span className="jan-field" title="줄 간격 — 현재 문단 (배수)">
        <span className="jan-field-label">줄간격</span>
        <NumberSpin
          value={lineHeightValue}
          onChange={(v, o) => applyToSelection((c) => c.setParagraphLineHeight(v == null ? null : String(v)), o?.keepFocus)}
          min={0.5} max={5} step={0.05} decimals={2} width={38} inherited={docLineHeight}
          title="줄 간격 (배수) — 직접 입력하거나 ↑↓·휠·단추로 0.05 씩"
          ariaLabel="줄 간격"
          presets={[1, 1.15, 1.3, 1.5, 1.6, 1.7, 2, 2.5, 3]}
        />
      </span>
      <span className="jan-field jan-field-optional" title="자간 — 선택한 글자 사이 간격(%)">
        <span className="jan-field-label">자간</span>
        <NumberSpin
          value={letterSpacingPct}
          onChange={(v, o) => applyToSelection((c) => c.setLetterSpacingPct(v), o?.keepFocus)}
          min={-50} max={100} step={1} unit="%" width={34} inherited={docLetterSpacing}
          title="자간 (%) — 음수면 좁아진다"
          ariaLabel="자간"
          presets={[-10, -5, -3, 0, 3, 5, 10, 20]}
        />
      </span>
      <span className="jan-field jan-field-optional" title="장평 — 선택한 글자의 가로 비율(%)">
        <span className="jan-field-label">장평</span>
        <NumberSpin
          value={charScalePct}
          onChange={(v, o) => applyToSelection((c) => c.setCharScalePct(v), o?.keepFocus)}
          min={10} max={250} step={1} unit="%" width={34} inherited={docCharScale}
          title="장평 (%) — 100 보다 작으면 홀쭉, 크면 넓적"
          ariaLabel="장평"
          presets={[70, 80, 90, 100, 110, 120, 150]}
        />
      </span>
      <span className="divider" />

      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} title="굵게 (Ctrl+B)"><Icon name="bold" /></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''} title="기울임 (Ctrl+I)"><Icon name="italic" /></button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''} title="밑줄 (Ctrl+U)"><Icon name="underline" /></button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''} title="취소선"><Icon name="strike" /></button>
      <button onClick={() => editor.chain().focus().toggleSuperscript().run()} className={editor.isActive('superscript') ? 'is-active' : ''} title="위 첨자" aria-label="위 첨자"><span style={{ fontSize: 12 }}>X<sup style={{ fontSize: 8 }}>2</sup></span></button>
      <button onClick={() => editor.chain().focus().toggleSubscript().run()} className={editor.isActive('subscript') ? 'is-active' : ''} title="아래 첨자" aria-label="아래 첨자"><span style={{ fontSize: 12 }}>X<sub style={{ fontSize: 8 }}>2</sub></span></button>
      <button onClick={() => editor.chain().focus().toggleHighlight({ color: '#FFEB3B' }).run()} className={editor.isActive('highlight') ? 'is-active' : ''} title="형광펜"><Icon name="highlight" /></button>
      <ColorPicker editor={editor} />
      <span className="divider" />

      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''} title="왼쪽 정렬"><Icon name="align-left" /></button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''} title="가운데 정렬"><Icon name="align-center" /></button>
      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''} title="오른쪽 정렬"><Icon name="align-right" /></button>
      <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={editor.isActive({ textAlign: 'justify' }) ? 'is-active' : ''} title="양쪽 맞춤 (Ctrl+J)" aria-label="양쪽 맞춤"><Icon name="align-justify" /></button>
      <button onClick={() => editor.chain().focus().outdentParagraph().run()} title="내어쓰기" aria-label="내어쓰기"><Icon name="chevron-left" /></button>
      <button onClick={() => editor.chain().focus().indentParagraph().run()} title="들여쓰기" aria-label="들여쓰기"><Icon name="chevron-right" /></button>
      <span className="divider" />

      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''} title="글머리 기호"><Icon name="list-bullet" /></button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''} title="번호 목록"><Icon name="list-numbered" /></button>
      <button onClick={() => editor.chain().focus().toggleList('taskList', 'taskItem').run()} title="체크리스트"><Icon name="list-check" /></button>
      <span className="divider" />

      <button onClick={() => editor.chain().focus().undo().run()} title="실행 취소 (Ctrl+Z)"><Icon name="undo" /></button>
      <button onClick={() => editor.chain().focus().redo().run()} title="다시 실행 (Ctrl+Shift+Z)"><Icon name="redo" /></button>
      <span className="divider" />
      <TTSButton editor={editor} />
      <VoiceButton editor={editor} />

      <span className="jan-spacer" />

      {showLinkPop && createPortal(
        /* 서식 줄 안에 두면 한 줄로 고정된 그 줄에 갇힌다 — 몸통에 그린다 */
        <div className="jan-link-popover" role="dialog" aria-label="링크 편집" style={{ position: 'fixed', top: 96, left: '50%', transform: 'translateX(-50%)', background: 'var(--jan-bg, #fff)', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 12, zIndex: 500, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            autoFocus
            type="url"
            placeholder="https:// 또는 mailto: 주소"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLinkPop(false) }}
            style={{ width: 320, padding: '6px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13 }}
            aria-label="링크 URL"
          />
          <button onClick={applyLink} style={{ padding: '6px 12px' }}>{linkDraft.trim() ? '적용' : '링크 해제'}</button>
          {editor.getAttributes('link').href && (
            <button onClick={() => { window.open(editor.getAttributes('link').href, '_blank', 'noopener'); }} style={{ padding: '6px 10px' }}>열기</button>
          )}
          <button onClick={() => setShowLinkPop(false)} aria-label="닫기" style={{ padding: '6px 10px' }}>취소</button>
        </div>,
        document.body
      )}

      {showSymbolPop && (
        <div role="dialog" aria-label="특수 문자 삽입" style={{ position: 'fixed', top: 96, left: '50%', transform: 'translateX(-50%)', width: 420, maxWidth: '90vw', maxHeight: '60vh', overflowY: 'auto', background: 'var(--jan-bg, #fff)', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 12, zIndex: 500 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>특수 문자</strong>
            <button onClick={() => setShowSymbolPop(false)} aria-label="닫기">닫기</button>
          </div>
          {SYMBOL_GROUPS.map((g) => (
            <div key={g.label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#888', margin: '4px 0' }}>{g.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {g.chars.map((c) => (
                  <button
                    key={c}
                    onClick={() => { editor.chain().focus().insertContent(c).run(); setShowSymbolPop(false) }}
                    title={c}
                    style={{ minWidth: 32, height: 32, fontSize: 15, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}
                  >{c}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {mathStudio && (
        <MathStudio
          editor={editor}
          initial={mathStudio.initial}
          onSave={mathStudio.onSave}
          onClose={() => setMathStudio(null)}
        />
      )}
    </div>
    </div>
  )
}

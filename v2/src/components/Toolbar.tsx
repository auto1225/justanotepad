import { useState, useRef, useEffect } from 'react'
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
import { TABLE_STYLES, blockCalc, copyTable, distributeColumns, distributeRows, moveRow, resizeColumns, resizeRows, setCellDiagonal, setCellPadding, setRowHeight, setTableStyle, setTableWrap, splitTable, tableToText, toggleTableOption } from '../lib/tableWord'
import { moveTable, selectTableColumn, selectTableRow, selectWholeTable } from '../lib/tableSelect'
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
import { askText, askConfirm } from '../lib/promptModal'
import { computeDocHealth, showHealthReport, markBackupDone } from '../lib/docHealth'
import { applyPaperFormat, PAPER_FORMATS } from '../lib/paperFormats'
import { saveCurrentAsStyle, showMyStylesPicker } from '../lib/myStyles'
import { insertFootnote as insertFootnoteAt, renumberFootnotes } from '../lib/footnotes'
import { insertNumberedEquation, insertFigureCaption, insertTableCaption, insertCrossRef, paperTargetCount, renumberWithFeedback } from '../lib/paperRefs'
import { pickMathTemplate, lintPaper, showLintReport, insertCreditBlock, insertCoiBlock, insertDataAvailabilityBlock, insertListOfFigures, insertListOfTables, insertAcronymList } from '../lib/paperTools'
import { downloadLatex } from '../lib/latexExport'
import { downloadHtmlFile, downloadDocFile } from '../lib/htmlDocExport'
import { MathStudio } from './MathStudio'
import { getSavableHtml } from '../extensions/PageDocument'
import { errText } from '../lib/errText'
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
}

/** useHeadingAnchors 의 slug 규칙과 동일해야 목차 앵커가 실제 제목 id 와 일치한다 */
function headingSlug(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\wÀ-￿\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'h'
  )
}

const SYMBOL_GROUPS: Array<{ label: string; chars: string[] }> = [
  { label: '문장 부호', chars: ['—', '–', '…', '·', '•', '◦', '¶', '§', '©', '®', '™', '「', '」', '『', '』', '《', '》'] },
  { label: '도형 · 화살표', chars: ['★', '☆', '◆', '◇', '■', '□', '▲', '▼', '→', '←', '↑', '↓', '⇒', '⇐', '↔', '✓', '✗'] },
  { label: '수학', chars: ['°', '±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '√', '∫', 'Σ', 'Π', '½', '¼', '¾', '²', '³'] },
  { label: '그리스 문자', chars: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'σ', 'τ', 'φ', 'ψ', 'ω', 'Ω', 'Δ', 'Φ'] },
  { label: '통화 · 단위', chars: ['₩', '$', '€', '¥', '£', '℃', '℉', '㎡', '㎥', '㎏', '㎜', '㎝', '㎞', '㏄'] },
]

interface MenuItem { label: string; short?: string; hint?: string; icon?: IconName; divider?: string; onClick?: () => void }
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
  const [contextTab, setContextTab] = useState<'표' | '그림' | null>(null)
  useEffect(() => {
    if (!editor) return
    const read = () => setContextTab(editor.isActive('table') ? '표' : editor.isActive('image') ? '그림' : null)
    read()
    editor.on('selectionUpdate', read)
    editor.on('transaction', read)
    return () => {
      editor.off('selectionUpdate', read)
      editor.off('transaction', read)
    }
  }, [editor])

  /* 표·그림을 고르면 그 개체 탭으로 자동 전환하고, 선택이 풀리면 쓰던 탭으로 돌아온다 */
  const beforeContextTab = useRef<string | null>(null)
  useEffect(() => {
    if (contextTab) {
      setRibbonTab((prev) => {
        if (prev !== contextTab && prev !== '표' && prev !== '그림') beforeContextTab.current = prev
        return contextTab
      })
    } else if (beforeContextTab.current) {
      const back = beforeContextTab.current
      beforeContextTab.current = null
      setRibbonTab(back)
    }
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
  const insertToc = () => {
    const items: Array<{ level: number; text: string }> = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading' && node.textContent.trim()) {
        items.push({ level: (node.attrs.level as number) || 1, text: node.textContent.trim() })
      }
    })
    if (!items.length) { flash('목차를 만들 제목(H1~H3)이 없습니다'); return }
    const escapeText = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const html = '<p><strong>목차</strong></p>' + items.map((i) =>
      `<p data-indent="${Math.min(8, i.level - 1)}"><a href="#${headingSlug(i.text)}">${escapeText(i.text)}</a></p>`
    ).join('') + '<p></p>'
    insertHTML(html)
    flash(`제목 ${items.length}개로 목차를 만들었습니다`)
  }
  const insertHr = () => editor.chain().focus().setHorizontalRule().run()
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
  const cyclePageColumns = () => {
    const current = ui.pageColumnCount || 1
    ui.setPageColumnCount(current === 1 ? 2 : current === 2 ? 3 : 1)
  }

  /* === 논문 — 표준 양식·수식 번호·캡션·상호참조 === */
  const applyFormat = (key: string) => {
    applyPaperFormat(editor, key, true)
  }
  const eqNumbered = async () => {
    const latex = await askText('번호 수식 (LaTeX):', '', { placeholder: 'E = mc^2' })
    if (latex) { insertNumberedEquation(editor, latex); flash('번호 수식 삽입 — 참조는 "수식 참조"로') }
  }
  const figCaption = async () => {
    const text = await askText('그림 캡션 설명:', '', { placeholder: '시스템 구성도' })
    if (text) insertFigureCaption(editor, text)
  }
  const tabCaption = async () => {
    const text = await askText('표 캡션 설명:', '', { placeholder: '실험 결과 비교' })
    if (text) insertTableCaption(editor, text)
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
  const exportLatex = () => {
    const memoTitle = useMemosStore.getState().current()?.title || 'paper'
    downloadLatex(getSavableHtml(editor), memoTitle)
    flash('LaTeX(.tex) 내보내기 — Overleaf 에서 바로 열 수 있습니다')
  }
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
  const viewLayoutLabel = ui.viewLayout === 'draft' ? '초안 레이아웃' : '인쇄 레이아웃'
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
  const insertTextBox = () => insertHTML('<div data-callout data-kind="info"><p>여기에 텍스트를 입력하세요.</p></div>')
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
  const meetingNote = () => {
    insertHTML(`
<h3>회의 노트 — ${new Date().toLocaleString('ko-KR')}</h3>
<p><strong>참석자:</strong> </p>
<p><strong>안건:</strong> </p>
<p><strong>결정사항:</strong> </p>
<p><strong>액션 아이템:</strong> </p>`)
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
  const toggleSpellCheck = () => {
    const cur = useUIStore.getState().spellCheck
    useUIStore.setState({ spellCheck: !cur })
    document.querySelectorAll('.ProseMirror').forEach(el => el.setAttribute('spellcheck', !cur ? 'true' : 'false'))
    flash(`맞춤법 검사 ${!cur ? '켬' : '끔'}`)
  }
  const runDocHealth = () => showHealthReport(computeDocHealth(editor))

  /* === 파일 / 백업 === */
  const memoTitle = () => (useMemosStore.getState().current()?.title || '메모').trim() || '메모'
  const exportHwpx = async () => { try { await downloadHwpx(getSavableHtml(editor), memoTitle()) } catch (e) { flash('HWPX 실패: ' + errText(e), 2600) } }
  const exportMd = () => { try { downloadMd(getSavableHtml(editor), memoTitle()) } catch (e) { flash('MD 실패: ' + errText(e), 2600) } }
  const exportPdf = async () => { try { await exportToPdf(getSavableHtml(editor), memoTitle()) } catch (e) { flash('PDF 실패: ' + errText(e), 2600) } }
  const exportTex = () => { try { downloadLatex(getSavableHtml(editor), memoTitle()) } catch (e) { flash('LaTeX 실패: ' + errText(e), 2600) } }
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
    /* 1. 논문 */
    {
      label: '논문', items: [
        { label: '논문 인용 관리 패널 (DOI 자동)', icon: 'file-text', onClick: () => run(p.onPaper) },
        { label: '변환 되돌리기', hint: 'Ctrl+Z', icon: 'undo', onClick: () => run(() => editor.chain().focus().undo().run()) },
        { divider: '표준 양식 (글로벌)', label: '' },
        ...PAPER_FORMATS.map((f) => ({
          label: f.label,
          icon: 'file-text' as const,
          onClick: () => run(() => applyFormat(f.key)),
        })),
        { divider: '수식 · 그림 · 표', label: '' },
        { label: '수식 스튜디오 (전 분야 기호·공식)', icon: 'hash', onClick: () => run(() => setMathStudio({ initial: '' })) },
        { label: '번호 수식 삽입 (n)', icon: 'hash', onClick: () => run(() => { void eqNumbered() }) },
        { label: '수식 템플릿 (분수·적분·행렬·화학식...)', icon: 'hash', onClick: () => run(() => { void eqFromTemplate() }) },
        { label: '그림 캡션 (Fig. n)', icon: 'image', onClick: () => run(() => { void figCaption() }) },
        { label: '표 캡션 (Table n)', icon: 'table', onClick: () => run(() => { void tabCaption() }) },
        { label: '수식 참조 삽입', icon: 'link', onClick: () => run(() => { void crossRef('eq') }) },
        { label: '그림 참조 삽입', icon: 'link', onClick: () => run(() => { void crossRef('fig') }) },
        { label: '표 참조 삽입', icon: 'link', onClick: () => run(() => { void crossRef('tab') }) },
        { divider: '논문 구성 요소', label: '' },
        { label: '저자 · 소속 · 교신 블록', icon: 'user', onClick: () => run(insertAuthorBlock) },
        { label: 'Abstract 박스', icon: 'file-text', onClick: () => run(insertAbstract) },
        { label: 'Keywords 블록', icon: 'hash', onClick: () => run(insertKeywords) },
        { label: '목차 삽입 (제목 기반)', icon: 'list-numbered', onClick: () => run(insertToc) },
        { short: '개요', label: '문서 개요 패널', icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: 'Acknowledgments (감사의 말)', icon: 'heart', onClick: () => run(insertAcknowledgments) },
        { label: 'CRediT 저자 기여도', icon: 'user', onClick: () => run(() => insertCreditBlock(editor)) },
        { label: '이해상충 선언 (COI)', icon: 'shield', onClick: () => run(() => insertCoiBlock(editor)) },
        { label: 'Data Availability', icon: 'download', onClick: () => run(() => insertDataAvailabilityBlock(editor)) },
        { label: '그림 목록 (List of Figures)', icon: 'image', onClick: () => run(() => insertListOfFigures(editor)) },
        { label: '표 목록 (List of Tables)', icon: 'table', onClick: () => run(() => insertListOfTables(editor)) },
        { label: '약어 목록 자동 추출', icon: 'hash', onClick: () => run(() => insertAcronymList(editor)) },
        { divider: '레이아웃', label: '' },
        { short: '단', label: `다단 레이아웃: ${pageColumnLabel}`, icon: 'columns', onClick: () => run(cyclePageColumns) },
        { label: '페이지 구분 삽입', hint: 'Ctrl+Enter', icon: 'page-break', onClick: () => run(insertPageBreak) },
        { short: '머리말', label: '러닝 헤더 · 꼬리말 설정', icon: 'pin', onClick: () => run(setRunningHeader) },
        { divider: '참조 & 인용', label: '' },
        { label: '각주 삽입', icon: 'sup', onClick: () => run(insertFootnote) },
        { label: '인용 삽입', icon: 'quote', onClick: () => run(insertCitation) },
        { label: '참고문헌 항목 추가', icon: 'file-text', onClick: () => run(insertReference) },
        { label: '번호 재정렬 (각주·수식·그림·표·참조)', icon: 'hash', onClick: () => run(renumberAll) },
        { divider: '논문 도구', label: '' },
        { label: '논문 검사 (제출 전 자동 점검)', icon: 'shield', onClick: () => run(runPaperLint) },
        { label: 'LaTeX(.tex) 내보내기 — Overleaf 용', icon: 'download', onClick: () => run(exportLatex) },
        { label: '템플릿 (학술 논문)', icon: 'file-text', onClick: () => run(p.onTemplates) },
        { label: '내 도구 / 역할 팩', icon: 'briefcase', onClick: () => run(p.onRoles) },
      ],
    },

    /* 2. 서식 */
    {
      label: '서식', items: [
        { label: '굵게', hint: 'Ctrl+B', icon: 'bold', onClick: () => run(() => editor.chain().focus().toggleBold().run()) },
        { label: '기울임', hint: 'Ctrl+I', icon: 'italic', onClick: () => run(() => editor.chain().focus().toggleItalic().run()) },
        { label: '밑줄', hint: 'Ctrl+U', icon: 'underline', onClick: () => run(() => editor.chain().focus().toggleUnderline().run()) },
        { label: '취소선', icon: 'strike', onClick: () => run(() => editor.chain().focus().toggleStrike().run()) },
        { label: '형광펜', icon: 'highlight', onClick: () => run(() => editor.chain().focus().toggleHighlight({ color: '#FFEB3B' }).run()) },
        { divider: '제목', label: '' },
        { label: '제목 1', hint: 'Ctrl+Alt+1', icon: 'h1', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run()) },
        { label: '제목 2', hint: 'Ctrl+Alt+2', icon: 'h2', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run()) },
        { label: '제목 3', hint: 'Ctrl+Alt+3', icon: 'h3', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run()) },
        { label: '일반 문단', icon: 'paragraph', onClick: () => run(() => editor.chain().focus().setParagraph().run()) },
        { divider: '정렬', label: '' },
        { label: '왼쪽 정렬', short: '왼쪽', hint: 'Ctrl+L', icon: 'align-left', onClick: () => run(() => editor.chain().focus().setTextAlign('left').run()) },
        { label: '가운데 정렬', short: '가운데', hint: 'Ctrl+E', icon: 'align-center', onClick: () => run(() => editor.chain().focus().setTextAlign('center').run()) },
        { label: '오른쪽 정렬', short: '오른쪽', hint: 'Ctrl+R', icon: 'align-right', onClick: () => run(() => editor.chain().focus().setTextAlign('right').run()) },
        { label: '양쪽 정렬', short: '양쪽', hint: 'Ctrl+J', icon: 'align-justify', onClick: () => run(() => editor.chain().focus().setTextAlign('justify').run()) },
        { divider: '한국어 타이포', label: '' },
        { label: '문서 기본 자간', icon: 'palette', onClick: () => run(() => { void setDocLetterSpacing() }) },
        { label: '문서 기본 장평', icon: 'palette', onClick: () => run(() => { void setDocCharScale() }) },
        { label: '첫 줄 들여쓰기 (문서 기본)', icon: 'paragraph', onClick: () => run(() => { void setDocTextIndent() }) },
        { label: '문서 기본 양쪽 정렬 켬/끔', icon: 'align-justify', onClick: () => run(toggleDocJustify) },
        { short: '첫 줄', label: '첫 줄 들여쓰기 토글', icon: 'paragraph', onClick: () => run(toggleFirstLineIndent) },
        { label: '단락 간격', icon: 'paragraph', onClick: () => run(setParagraphSpacing) },
        { label: '글자 효과', icon: 'sparkle', onClick: () => run(setTextEffect) },
        { short: '강조 상자', label: '강조 배경 상자', icon: 'highlight', onClick: () => run(insertHighlightBox) },
        { divider: '서식 복사 · 내 스타일', label: '' },
        { label: '서식 복사', hint: 'Ctrl+Shift+C', icon: 'wand', onClick: () => run(() => window.dispatchEvent(new Event('jan-format-copy'))) },
        { label: '서식 붙여넣기', short: '붙여넣기', hint: 'Ctrl+Shift+V', icon: 'wand', onClick: () => run(() => window.dispatchEvent(new Event('jan-format-paste'))) },
        { short: '스타일 저장', label: '현재 서식을 내 스타일로 저장', icon: 'save', onClick: () => run(async () => {
          if (editor.state.selection.empty) { flash('먼저 서식이 적용된 텍스트를 선택하세요'); return }
          const name = await askText('스타일 이름:', '', { placeholder: '예: 핵심 강조, 보고서 소제목' })
          if (name) saveCurrentAsStyle(editor, name)
        }) },
        { short: '내 스타일', label: '내 스타일 적용 / 관리', icon: 'palette', onClick: () => run(() => showMyStylesPicker(editor)) },
        { divider: '기타', label: '' },
        { label: '문서 스타일', icon: 'palette', onClick: () => run(p.onTypo) },
        { label: '서식 지우기', icon: 'wand', onClick: () => run(() => editor.chain().focus().unsetAllMarks().clearNodes().run()) },
        { short: '엔터 표시', label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
      ],
    },

    /* 3. 삽입 */
    {
      label: '삽입', items: [
        { short: '표', label: '표 삽입 (격자에서 크기 고르기)', icon: 'table', onClick: () => run(() => { void insertTable() }) },
        { short: '표 붙이기', label: '표로 붙여넣기 (CSV·엑셀 데이터)', icon: 'table', onClick: () => run(() => { void insertTableFromCsv() }) },
        { label: '이미지 URL', icon: 'image', onClick: () => run(insertImageURL) },
        { short: '그림 넣기', label: '이미지 업로드', icon: 'image', onClick: () => run(uploadImage) },
        { label: '링크', hint: 'Ctrl+K', icon: 'link', onClick: () => run(toggleLink) },
        { label: '목차 (제목 기반 자동 생성)', icon: 'list-numbered', onClick: () => run(insertToc) },
        { label: '구분선', icon: 'minus', onClick: () => run(insertHr) },
        { divider: '리스트', label: '' },
        { label: '글머리 기호', icon: 'list-bullet', onClick: () => run(() => editor.chain().focus().toggleBulletList().run()) },
        { label: '번호 매기기', icon: 'list-numbered', onClick: () => run(() => editor.chain().focus().toggleOrderedList().run()) },
        { label: '체크리스트', icon: 'list-check', onClick: () => run(() => editor.chain().focus().toggleList('taskList', 'taskItem').run()) },
        { label: '인용', icon: 'quote', onClick: () => run(() => editor.chain().focus().toggleBlockquote().run()) },
        { label: '코드 블록', icon: 'code', onClick: () => run(() => editor.chain().focus().toggleCodeBlock().run()) },
        { divider: '논문 요소', label: '' },
        { label: '문서 개요 패널', icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: '각주 삽입', icon: 'sup', onClick: () => run(insertFootnote) },
        { label: '인용 번호 삽입', icon: 'quote', onClick: () => run(insertCitation) },
        { label: '책갈피 삽입', icon: 'pin', onClick: () => run(insertBookmark) },
        { label: '텍스트 상자', icon: 'box', onClick: () => run(insertTextBox) },
        { label: '구분선 스타일', icon: 'minus', onClick: () => run(insertHrStyle) },
        { divider: '특수 노드', label: '' },
        { label: '수식 — 수식 스튜디오 (전 분야)', icon: 'hash', onClick: () => run(() => setMathStudio({ initial: '' })) },
        { label: '다이어그램 (Mermaid)', icon: 'hash', onClick: () => run(async () => { const c = await askText('Mermaid 다이어그램:', 'graph TD\n  A-->B', { multiline: true }); if (c) editor.chain().focus().setMermaid(c).run() }) },
        { short: '정보 상자', label: '콜아웃 (정보)', icon: 'info', onClick: () => run(() => editor.chain().focus().setCallout('info').run()) },
        { short: '경고 상자', label: '콜아웃 (경고)', icon: 'bell', onClick: () => run(() => editor.chain().focus().setCallout('warn').run()) },
        { label: '임베드 URL', icon: 'globe', onClick: () => run(async () => { const u = await askText('임베드 URL (YouTube/Vimeo 등):'); if (u) editor.chain().focus().setEmbed(u).run() }) },
        { divider: '빠른 입력', label: '' },
        { label: '날짜/시간', icon: 'clock', onClick: () => run(insertDateTime) },
        { label: '특수 문자', icon: 'sparkle', onClick: () => run(insertSymbol) },
        { label: '빠른 메모', hint: 'Ctrl+Shift+J', icon: 'plus', onClick: () => run(p.onQuick) },
      ],
    },

    /* 4. 페이지 */
    {
      label: '페이지', items: [
        { label: `페이지 크기 설정: ${ui.pageSize} · ${orientationLabel}`, icon: 'page', onClick: () => run(() => { sessionStorage.setItem('jan-page-focus', '용지'); openPageSettings() }) },
        { label: `노트 배경 스타일: ${currentPaperLabel}`, icon: 'palette', onClick: () => run(() => { sessionStorage.setItem('jan-page-focus', '배경'); openPageSettings() }) },
        { label: `페이지 여백 설정: ${pageMarginLabel}`, icon: 'sliders', onClick: () => run(() => { sessionStorage.setItem('jan-page-focus', '여백'); openPageSettings() }) },
        { divider: '페이지 동작', label: '' },
        { label: '페이지 구분 삽입', hint: 'Ctrl+Enter', icon: 'page-break', onClick: () => run(insertPageBreak) },
        { label: `다단 레이아웃: ${pageColumnLabel}`, icon: 'columns', onClick: () => run(cyclePageColumns) },
        { short: '머리말', label: '러닝 헤더 · 꼬리말', icon: 'pin', onClick: () => run(setRunningHeader) },
        { divider: '미리보기 / 인쇄', label: '' },
        { short: '엔터 표시', label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
        { short: '미리보기', label: '인쇄 미리보기 (Paged.js)', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
        { label: '인쇄', hint: 'Ctrl+P', icon: 'print', onClick: () => run(() => window.print()) },
      ],
    },

    /* 5. 미디어 */
    {
      label: '미디어', items: [
        { label: '이미지 업로드', icon: 'image', onClick: () => run(uploadImage) },
        { label: '이미지 URL', icon: 'image', onClick: () => run(insertImageURL) },
        { label: 'YouTube 임베드', icon: 'globe', onClick: () => run(insertYouTube) },
        { label: '화면 캡쳐', icon: 'preview', onClick: () => run(captureScreen) },
        { label: '갤러리 뷰', icon: 'image', onClick: () => run(openGallery) },
        { divider: '오디오', label: '' },
        { label: '음성 입력 (받아쓰기)', icon: 'mic', onClick: () => run(startVoiceInput) },
        { label: '읽어주기 (TTS)', icon: 'speaker', onClick: () => run(speakSelection) },
        { label: '음성 녹음', icon: 'mic', onClick: () => run(recordAudio) },
        { label: '회의 노트 (녹음+받아쓰기)', icon: 'users', onClick: () => run(p.onMeetingNotes) },
        { label: '강의 노트 (녹음+받아쓰기)', icon: 'mic', onClick: () => run(p.onLectureNotes) },
        { label: '회의록 템플릿 삽입', icon: 'file-plus', onClick: () => run(meetingNote) },
        { divider: '파일 / 첨부', label: '' },
        { label: '파일 첨부', icon: 'paperclip', onClick: () => run(p.onAtt) },
        { divider: '드로잉', label: '' },
        { label: '그림판 (그리기·손글씨·도형)', icon: 'paint', onClick: () => run(p.onPaint) },
        { label: '선택한 이미지를 그림판에서 주석 편집', icon: 'paint', onClick: () => run(() => {
          const src = editor.getAttributes('image').src as string | undefined
          if (!src) { flash('먼저 문서에서 편집할 이미지를 클릭해 선택하세요'); return }
          window.dispatchEvent(new CustomEvent('jan-edit-image-in-paint', { detail: { src, pos: editor.state.selection.from } }))
        }) },
        { label: '포스트잇 (JustPin)', icon: 'pin', onClick: () => run(p.onPostit) },
        { divider: 'AI', label: '' },
        { short: 'AI 이미지', label: 'AI 이미지 생성 (Pollinations)', icon: 'sparkle', onClick: () => run(aiImageStub) },
      ],
    },

    /* 6. 도구 */
    {
      label: '도구', items: [
        { label: '명령 팔레트', hint: 'Ctrl+Shift+P', icon: 'sparkle', onClick: () => run(cmdPalette) },
        { label: 'AI 도우미', hint: 'Ctrl+/', icon: 'ai', onClick: () => run(p.onAi) },
        { label: 'AI 챗 패널', icon: 'ai', onClick: () => run(p.onChat) },
        { divider: '검색 / 편집', label: '' },
        { label: '검색', hint: 'Ctrl+Shift+F', icon: 'find', onClick: () => run(p.onSearch) },
        { label: '찾아 바꾸기', hint: 'Ctrl+H', icon: 'replace', onClick: () => run(p.onFind) },
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
        { label: '맞춤법 검사 켬/끔', icon: 'check', onClick: () => run(toggleSpellCheck) },
        { divider: '학습 / 시각화', label: '' },
        { label: '마인드맵', icon: 'sparkle', onClick: () => run(p.onMindMap) },
        { label: '플래시카드 학습', icon: 'list-bullet', onClick: () => run(flashcards) },
        { divider: 'OCR / 자동화', label: '' },
        { short: 'OCR', label: 'OCR (이미지 → 텍스트)', icon: 'image', onClick: () => run(p.onOcr) },
        { label: '템플릿', icon: 'file-text', onClick: () => run(p.onTemplates) },
        { label: '스니펫', icon: 'file-plus', onClick: () => run(p.onSnippets) },
        { label: '매크로', icon: 'wand', onClick: () => run(p.onMacros) },
        { label: '포모도로 타이머', icon: 'clock', onClick: () => run(startPomodoro) },
      ],
    },

    /* 7. 보기 */
    {
      label: '보기', items: [
        { short: '문서 보기', label: `문서 보기: ${viewLayoutLabel}`, icon: 'preview', onClick: () => run(() => ui.setViewLayout(ui.viewLayout === 'draft' ? 'print' : 'draft')) },
        { label: '인쇄 레이아웃', icon: 'page', onClick: () => run(() => ui.setViewLayout('print')) },
        { label: '초안 레이아웃', icon: 'file-text', onClick: () => run(() => ui.setViewLayout('draft')) },
        { divider: '창', label: '' },
        { label: '집중 모드', hint: 'F11', icon: 'focus', onClick: () => run(() => ui.toggleFocus()) },
        { label: '읽기 모드', hint: 'Shift+F11', icon: 'preview', onClick: () => run(() => ui.toggleReading()) },
        { short: '타자기', label: `타자기 모드 ${ui.typewriterMode ? '끄기' : '켜기'} (커서 줄 중앙 고정)`, icon: 'focus', onClick: () => run(() => { ui.toggleTypewriter(); flash(ui.typewriterMode ? '타자기 모드 끔' : '타자기 모드 켬 — 커서 줄이 화면 중앙에 유지됩니다') }) },
        { short: '문단 강조', label: `현재 문단 하이라이트 ${ui.paragraphFocus ? '끄기' : '켜기'}`, icon: 'focus', onClick: () => run(() => { ui.toggleParagraphFocus(); flash(ui.paragraphFocus ? '문단 하이라이트 끔' : '문단 하이라이트 켬 — 커서 문단 외에는 흐려집니다') }) },
        { label: '사이드바 토글', icon: 'list-bullet', onClick: () => run(() => ui.toggleSidebar()) },
        { label: `눈금자 ${ui.showRulers ? '숨기기' : '표시'}`, icon: 'columns', onClick: () => run(() => ui.toggleRulers()) },
        { label: `쪽모음 ${ui.pageThumbs ? '닫기' : '열기'} (여러 쪽 보기)`, icon: 'page', onClick: () => run(() => {
          if (ui.viewLayout !== 'print' && !ui.pageThumbs) { flash('쪽모음은 인쇄 레이아웃에서 사용할 수 있습니다 — 보기 → 인쇄 레이아웃'); return }
          ui.togglePageThumbs()
        }) },
        { label: ui.spreadCols ? `쪽 나란히 편집 끝내기 (현재 ${ui.spreadCols}쪽)` : '쪽 나란히 편집 (1·2쪽을 가로로 놓고 편집)', icon: 'columns', onClick: () => run(() => {
          if (ui.spreadCols) { ui.setSpreadCols(0); flash('쪽 나란히 편집을 끝냈습니다'); return }
          if (ui.viewLayout !== 'print') { flash('쪽 나란히 편집은 인쇄 레이아웃에서 사용할 수 있습니다 — 보기 → 인쇄 레이아웃'); return }
          ui.setSpreadCols(2)
          flash('쪽 나란히 편집 — 각 쪽에서 바로 편집됩니다 (2·3·4쪽 배치 선택, PageUp/PageDown 이동)', 3200)
        }) },
        { label: `창 나누기 ${ui.splitView ? '취소' : ''}(같은 문서 위·아래 두 창)`, icon: 'columns', onClick: () => run(() => {
          ui.toggleSplitView()
          flash(ui.splitView ? '창 나누기를 취소했습니다' : '창 나누기 — 아래 창에서도 같은 문서를 바로 편집할 수 있습니다 (분할선을 끌어 크기 조절)', 3000)
        }) },
        { divider: '줌', label: '' },
        { label: '줌 인', hint: 'Ctrl+=', icon: 'plus', onClick: () => run(() => ui.zoomIn()) },
        { label: '줌 아웃', hint: 'Ctrl+-', icon: 'minus', onClick: () => run(() => ui.zoomOut()) },
        { label: '줌 리셋 (100%)', hint: 'Ctrl+0', icon: 'undo', onClick: () => run(() => ui.zoomReset()) },
        { short: '쪽 너비', label: '페이지 너비에 맞춤', icon: 'maximize', onClick: () => run(() => fitPageZoom('width')) },
        { short: '한 쪽', label: '한 페이지 보기', icon: 'page', onClick: () => run(() => fitPageZoom('page')) },
        { label: '75%', icon: 'zoom-out', onClick: () => run(() => setPageZoom(0.75)) },
        { label: '125%', icon: 'zoom-in', onClick: () => run(() => setPageZoom(1.25)) },
        { divider: '아웃라인 / 미리보기', label: '' },
        { label: `목차 ${p.outlineOpen ? '닫기' : '열기'}`, icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { short: 'MD 보기', label: 'Markdown 미리보기', icon: 'preview', onClick: () => run(p.onMdPreview) },
        { label: '인쇄 미리보기', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
        { divider: '표시', label: '' },
        { short: '엔터 표시', label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
        { short: '제목 번호', label: '제목 번호 매기기 토글', icon: 'hash', onClick: () => run(() => ui.toggleHeadingNumbers && ui.toggleHeadingNumbers()) },
      ],
    },

    /* 8. 파일 */
    {
      label: '파일', items: [
        { label: '새 메모', hint: 'Ctrl+N', icon: 'plus', onClick: () => run(p.onNewMemo) },
        { label: '열기...', hint: 'Ctrl+O', icon: 'open', onClick: () => run(p.onOpen) },
        { label: '저장', hint: 'Ctrl+S', icon: 'save', onClick: () => run(p.onSave) },
        { short: '다른 이름', label: '다른 이름으로 저장...', icon: 'save', onClick: () => run(p.onSaveAs) },
        { divider: '내보내기', label: '' },
        { label: '인쇄', hint: 'Ctrl+P', icon: 'print', onClick: () => run(() => window.print()) },
        { label: 'PDF 내보내기', icon: 'file-text', onClick: () => run(exportPdf) },
        { label: 'HTML 내보내기', icon: 'globe', onClick: () => run(exportHtml) },
        { short: 'MD 저장', label: 'Markdown(.md) 저장', icon: 'file-text', onClick: () => run(exportMd) },
        { label: 'HWPX (한글) 내보내기', icon: 'file-text', onClick: () => run(exportHwpx) },
        { label: 'Word(.doc) 내보내기', icon: 'file-text', onClick: () => run(exportDocx) },
        { label: 'LaTeX(.tex) 내보내기', icon: 'file-text', onClick: () => run(exportTex) },
        { label: '모든 형식 내보내기 (MD·HTML·LaTeX·HWPX·DOC)', icon: 'download', onClick: () => run(() => { void exportAll() }) },
        { divider: '공유 / 백업', label: '' },
        { short: 'Gist', label: 'GitHub Gist 로 공유', icon: 'cloud', onClick: () => run(p.onGist) },
        { label: '공유 링크', icon: 'link', onClick: () => run(p.onShare) },
        { short: '백업 저장', label: 'JSON 백업 내보내기', icon: 'cloud', onClick: () => run(exportJsonBackup) },
        { short: '백업 열기', label: 'JSON 백업 가져오기', icon: 'cloud', onClick: () => run(importJsonBackup) },
        { label: 'v1 메모 가져오기', icon: 'undo', onClick: () => run(importV1) },
        { divider: '관리', label: '' },
        { label: '버전 기록', icon: 'undo', onClick: () => run(p.onVersions) },
        { short: '잠금', label: '잠금 / 비밀번호', icon: 'lock', onClick: () => run(p.onLock) },
        { label: '휴지통', icon: 'box', onClick: () => run(p.onTrash) },
        { short: '정보', label: '정보 / 버전', icon: 'info', onClick: () => run(p.onAbout) },
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


  const editItems: MenuItem[] = [
    { divider: '되돌리기', label: '' },
    { label: '실행 취소', short: '되돌리기', hint: 'Ctrl+Z', icon: 'undo', onClick: () => run(() => editor.chain().focus().undo().run()) },
    { label: '다시 실행', short: '다시실행', hint: 'Ctrl+Shift+Z', icon: 'redo', onClick: () => run(() => editor.chain().focus().redo().run()) },
    { divider: '선택 · 찾기', label: '' },
    { label: '모두 선택', short: '모두선택', hint: 'Ctrl+A', icon: 'check', onClick: () => run(() => editor.chain().focus().selectAll().run()) },
    { label: '찾기 · 바꾸기', short: '찾기', hint: 'Ctrl+F', icon: 'find', onClick: () => run(p.onFind) },
    { label: '전체 문서 검색', short: '전체검색', icon: 'search', onClick: () => run(p.onSearch) },
    { divider: '서식 지우기', label: '' },
    { short: '서식 지움', label: '글자 서식 지우기', icon: 'close', onClick: () => run(() => editor.chain().focus().unsetAllMarks().run()) },
    { short: '문단 초기화', label: '문단 서식 지우기 (본문으로)', icon: 'paragraph', onClick: () => run(() => editor.chain().focus().setParagraph().run()) },
    { divider: '명령 찾기', label: '' },
    { label: '명령 팔레트', short: '명령', hint: 'Ctrl+Shift+P', icon: 'cmd', onClick: () => run(cmdPalette) },
  ]
  /* AI 는 우리 강점이라 별도 탭으로 올린다 — 도구·미디어에 섞여 있던 것을 옮긴다 */
  const AI_KEYS = ['AI ', 'OCR', '번역', '문서 건강 점수', '워드 클라우드', '마인드맵']
  const isAi = (it: MenuItem) => !it.divider && AI_KEYS.some((k) => it.label.startsWith(k))
  const notAi = (items: MenuItem[]) => items.filter((it) => it.divider || !isAi(it))
  const aiFrom = (items: MenuItem[]) => items.filter(isAi)
  const aiTools = aiFrom(pick('도구'))
  /* AI 탭 = 사람 대신 글·그림을 만들어 주는 것만. 번역·문서 건강처럼 '검사'에 가까운 것은 검토 탭,
     마인드맵·워드 클라우드처럼 '다르게 보기'는 보기 탭으로 보냈다 (한 기능은 한 자리에). */
  const aiItems: MenuItem[] = [
    { divider: '쓰기 도우미', label: '' },
    ...aiTools.filter((it) => it.label.startsWith('AI ')),
    { divider: '이미지 · 인식', label: '' },
    ...aiFrom(pick('미디어')),
    ...aiTools.filter((it) => it.label.startsWith('OCR')),
  ]

  /* 표·그림을 고르면 나타나는 개체 탭 (한글의 맥락 탭) */
  const inTable = contextTab === '표'
  const onImage = contextTab === '그림'
  const setImgWidth = (w: string) => editor.chain().focus().updateAttributes('image', { width: w }).run()
  const setImgAlign = (side: 'left' | 'center' | 'right') => {
    const pos = editor.state.selection.from
    editor.chain().focus().setTextSelection(pos).setTextAlign(side).setNodeSelection(pos).run()
  }
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
  const tableItems: MenuItem[] = [
    { divider: '선택', label: '' },
    { label: '행 선택', short: '행', icon: 'table', hint: 'Alt+R', onClick: () => run(() => { selectTableRow(editor, currentRowIndex()) }) },
    { label: '열 선택', short: '열', icon: 'columns', hint: 'Alt+C', onClick: () => run(() => { selectTableColumn(editor, currentColIndex()) }) },
    { label: '표 전체 선택', short: '표', icon: 'table', hint: 'Alt+A', onClick: () => run(() => { selectWholeTable(editor) }) },
    { divider: '행 및 열', label: '' },
    { label: '위에 행 삽입', short: '위 행', icon: 'plus', hint: 'Alt+Shift+I', onClick: () => run(() => editor.chain().focus().addRowBefore().run()) },
    { label: '아래에 행 삽입', short: '아래 행', icon: 'plus', hint: 'Alt+I', onClick: () => run(() => editor.chain().focus().addRowAfter().run()) },
    { label: '왼쪽에 열 삽입', short: '왼쪽 열', icon: 'plus', hint: 'Alt+Shift+O', onClick: () => run(() => editor.chain().focus().addColumnBefore().run()) },
    { label: '오른쪽에 열 삽입', short: '오른쪽 열', icon: 'plus', hint: 'Alt+O', onClick: () => run(() => editor.chain().focus().addColumnAfter().run()) },
    { label: '행 삭제', short: '행 삭제', icon: 'minus', hint: 'Alt+⌫', onClick: () => run(() => editor.chain().focus().deleteRow().run()) },
    { label: '열 삭제', short: '열 삭제', icon: 'minus', onClick: () => run(() => editor.chain().focus().deleteColumn().run()) },
    { divider: '병합', label: '' },
    { label: '셀 병합', short: '병합', icon: 'columns', hint: 'Alt+M', onClick: () => run(() => editor.chain().focus().mergeCells().run()) },
    { label: '셀 분할', short: '분할', icon: 'columns', hint: 'Alt+Shift+M', onClick: () => run(() => editor.chain().focus().splitCell().run()) },
    { label: '표 분할 (커서 행에서 둘로)', short: '표 분할', icon: 'page-break', onClick: () => run(() => { splitTable(editor) }) },
    { label: '행을 위로 이동', short: '행 ↑', icon: 'chevron-up', hint: 'Shift+Alt+↑', onClick: () => run(() => { moveRow(editor, -1) }) },
    { label: '행을 아래로 이동', short: '행 ↓', icon: 'chevron-down', hint: 'Shift+Alt+↓', onClick: () => run(() => { moveRow(editor, 1) }) },
    { divider: '셀 크기', label: '' },
    { label: '창에 자동 맞춤', short: '창 맞춤', icon: 'maximize', onClick: () => run(() => setTableAttr({ 'data-fit': null, 'data-width': null }, '창(단) 너비에 맞춤')) },
    { label: '내용에 자동 맞춤', short: '내용 맞춤', icon: 'minimize', onClick: () => run(() => setTableAttr({ 'data-fit': 'contents', 'data-width': null }, '내용 너비에 맞춤')) },
    { label: '고정 열 너비', short: '고정', icon: 'columns', onClick: () => run(() => setTableAttr({ 'data-fit': 'fixed' }, '열 너비를 고정')) },
    { label: '표 너비 지정...', short: '표 너비', icon: 'hash', onClick: () => run(() => { void askTableWidth() }) },
    { label: '행 높이 지정...', short: '행 높이', icon: 'hash', onClick: () => run(() => { void askRowHeight() }) },
    { label: '고른 열 넓히기', short: '열 넓게', icon: 'chevron-right', hint: 'Alt+→', onClick: () => run(() => { resizeColumns(editor, 8) }) },
    { label: '고른 열 좁히기', short: '열 좁게', icon: 'chevron-left', hint: 'Alt+←', onClick: () => run(() => { resizeColumns(editor, -8) }) },
    { label: '고른 행 높이기', short: '행 높게', icon: 'chevron-down', hint: 'Alt+↓', onClick: () => run(() => { resizeRows(editor, 8) }) },
    { label: '고른 행 낮추기', short: '행 낮게', icon: 'chevron-up', hint: 'Alt+↑', onClick: () => run(() => { resizeRows(editor, -8) }) },
    { label: '열 너비를 같게 (고른 열만)', short: '열 같게', icon: 'columns', hint: 'Alt+E', onClick: () => run(() => { distributeColumns(editor) }) },
    { label: '행 높이를 같게 (고른 행만)', short: '행 같게', icon: 'table', hint: 'Alt+Shift+E', onClick: () => run(() => { distributeRows(editor) }) },
    { label: '열 너비 지정 지우기 (내용에 맞게)', short: '열 초기화', icon: 'refresh-cw', onClick: () => run(evenColumnWidths) },
    { divider: '맞춤', label: '' },
    { label: '셀 안 위쪽 맞춤', short: '위', icon: 'align-left', onClick: () => run(() => editor.chain().focus().setCellAttribute('valign', null).run()) },
    { label: '셀 안 가운데 맞춤', short: '가운데', icon: 'align-center', onClick: () => run(() => editor.chain().focus().setCellAttribute('valign', 'middle').run()) },
    { label: '셀 안 아래쪽 맞춤', short: '아래', icon: 'align-right', onClick: () => run(() => editor.chain().focus().setCellAttribute('valign', 'bottom').run()) },
    { label: '셀 여백...', short: '셀 여백', icon: 'hash', onClick: () => run(() => { void askCellPadding() }) },
    { divider: '표 자리', label: '' },
    { label: '왼쪽 맞춤', short: '왼쪽', icon: 'align-left', onClick: () => run(() => setTableAttr({ 'data-align': null }, '표를 왼쪽에')) },
    { label: '가운데 맞춤', short: '가운데', icon: 'align-center', onClick: () => run(() => setTableAttr({ 'data-align': 'center' }, '표를 가운데에')) },
    { label: '오른쪽 맞춤', short: '오른쪽', icon: 'align-right', onClick: () => run(() => setTableAttr({ 'data-align': 'right' }, '표를 오른쪽에')) },
    { label: '단 안에 두기 (2단 문서)', short: '단 안', icon: 'columns', onClick: () => run(() => setTableAttr({ 'data-place': 'column' }, '표를 단 안에')) },
    { label: '단 걸치기 — 지면 전체 폭', short: '단 걸침', icon: 'table', onClick: () => run(() => setTableAttr({ 'data-place': 'page' }, '표를 지면 전체 폭으로')) },
    { label: '자리 자동 (열이 많으면 단 걸침)', short: '자리 자동', icon: 'wand', onClick: () => run(() => setTableAttr({ 'data-place': null }, '표 자리 자동')) },
    { divider: '텍스트 배치', label: '' },
    { label: '문단 사이 (감싸지 않음)', short: '문단 사이', icon: 'align-justify', onClick: () => run(() => { setTableWrap(editor, null) }) },
    { label: '글자처럼 취급 (문장 안에)', short: '글자처럼', icon: 'file-text', onClick: () => run(() => { setTableWrap(editor, 'inline') }) },
    { label: '왼쪽에 두고 글 흐르기', short: '왼쪽 감쌈', icon: 'align-left', onClick: () => run(() => { setTableWrap(editor, 'left') }) },
    { label: '오른쪽에 두고 글 흐르기', short: '오른쪽 감쌈', icon: 'align-right', onClick: () => run(() => { setTableWrap(editor, 'right') }) },
    { divider: '표 옮기기 · 복사', label: '' },
    { label: '표를 위로 이동', short: '표 ↑', icon: 'chevron-up', onClick: () => run(() => { moveTable(editor, -1) }) },
    { label: '표를 아래로 이동', short: '표 ↓', icon: 'chevron-down', onClick: () => run(() => { moveTable(editor, 1) }) },
    { label: '표 복사', short: '복사', icon: 'file-plus', onClick: () => run(() => { copyTable(editor, false) }) },
    { label: '표 잘라내기', short: '잘라내기', icon: 'trash', onClick: () => run(() => { copyTable(editor, true) }) },
    { divider: '쪽 넘김', label: '' },
    { label: '제목 행 반복 켬/끔', short: '제목 반복', icon: 'table', onClick: () => run(() => {
      const on = editor.getAttributes('table')['data-repeat-header'] ? null : '1'
      setTableAttr({ 'data-repeat-header': on }, on ? '쪽을 넘으면 제목 행을 반복합니다' : '제목 행 반복을 껐습니다')
    }) },
    { divider: '데이터', label: '' },
    { label: '수식 (fx)...', short: '수식', icon: 'hash', onClick: () => run(() => { void askCellFormula() }) },
    { label: '고른 칸 합계 (블록 계산)', short: '블록 합', icon: 'hash', onClick: () => run(() => { blockCalc(editor, 'sum') }) },
    { label: '고른 칸 평균 (블록 계산)', short: '블록 평균', icon: 'hash', onClick: () => run(() => { blockCalc(editor, 'avg') }) },
    { label: '현재 열 합계', short: '합계', icon: 'hash', onClick: () => run(() => aggregateColumn(editor, 'sum')) },
    { label: '현재 열 평균', short: '평균', icon: 'hash', onClick: () => run(() => aggregateColumn(editor, 'avg')) },
    { label: '현재 열 개수', short: '개수', icon: 'hash', onClick: () => run(() => aggregateColumn(editor, 'count')) },
    { label: '오름차순 정렬', short: '오름차순', icon: 'chevron-up', onClick: () => run(() => sortTableByCurrentColumn(editor, 'asc')) },
    { label: '내림차순 정렬', short: '내림차순', icon: 'chevron-down', onClick: () => run(() => sortTableByCurrentColumn(editor, 'desc')) },
    { label: '표를 텍스트로 변환...', short: '텍스트로', icon: 'file-text', onClick: () => run(() => { void askTableToText() }) },
    { divider: '표', label: '' },
    { label: '표 삭제', short: '표 삭제', icon: 'trash', onClick: () => run(() => { if (confirm('표 전체를 삭제할까요?')) editor.chain().focus().deleteTable().run() }) },
  ]

  /* ── 표: 워드의 「표 디자인」 탭 ── */
  const tableDesignItems: MenuItem[] = [
    { divider: '표 스타일', label: '' },
    ...TABLE_STYLES.map((style) => ({
      label: style.label + ' — ' + style.desc,
      short: style.label,
      icon: 'table' as IconName,
      onClick: () => run(() => { setTableStyle(editor, style.value); flash(style.label + ' 적용') }),
    })),
    { divider: '표 스타일 옵션', label: '' },
    { label: '머리글 행 켬/끔', short: '머리글 행', icon: 'table', onClick: () => run(() => editor.chain().focus().toggleHeaderRow().run()) },
    { label: '첫째 열 강조 켬/끔', short: '첫째 열', icon: 'columns', onClick: () => run(() => { toggleTableOption(editor, 'data-first-col') }) },
    { label: '마지막 행 강조 켬/끔', short: '마지막 행', icon: 'table', onClick: () => run(() => { toggleTableOption(editor, 'data-last-row') }) },
    { divider: '음영', label: '' },
    ...[
      { color: '#FFF4CE', name: '노랑' },
      { color: '#FDE7E9', name: '분홍' },
      { color: '#E5F1FB', name: '파랑' },
      { color: '#E8F5E9', name: '초록' },
      { color: '#F3E8FD', name: '보라' },
      { color: '#F2F2F2', name: '회색' },
    ].map((shade) => ({
      label: '셀 음영 ' + shade.name,
      short: shade.name,
      icon: 'fill' as IconName,
      onClick: () => run(() => editor.chain().focus().setCellAttribute('backgroundColor', shade.color).run()),
    })),
    { label: '음영 지우기', short: '지우기', icon: 'fill', onClick: () => run(() => editor.chain().focus().setCellAttribute('backgroundColor', null).run()) },
    { divider: '셀 대각선', label: '' },
    { label: '대각선 ＼ (왼위→오른아래)', short: '＼', icon: 'table', onClick: () => run(() => { setCellDiagonal(editor, 'down') }) },
    { label: '대각선 ／ (왼아래→오른위)', short: '／', icon: 'table', onClick: () => run(() => { setCellDiagonal(editor, 'up') }) },
    { label: '대각선 ✕ (둘 다)', short: '✕', icon: 'table', onClick: () => run(() => { setCellDiagonal(editor, 'both') }) },
    { label: '대각선 지우기', short: '지움', icon: 'table', onClick: () => run(() => { setCellDiagonal(editor, null) }) },
  ]

  const imageItems: MenuItem[] = [
    { divider: '크기', label: '' },
    { label: '작게 (200px)', short: '작게', icon: 'image', onClick: () => run(() => setImgWidth('200px')) },
    { label: '중간 (400px)', short: '중간', icon: 'image', onClick: () => run(() => setImgWidth('400px')) },
    { label: '크게 (600px)', short: '크게', icon: 'image', onClick: () => run(() => setImgWidth('600px')) },
    { label: '본문 너비에 맞춤', short: '전체 너비', icon: 'maximize', onClick: () => run(() => setImgWidth('100%')) },
    { divider: '배치', label: '' },
    { label: '왼쪽 배치', short: '왼쪽', icon: 'align-left', onClick: () => run(() => setImgAlign('left')) },
    { label: '가운데 배치', short: '가운데', icon: 'align-center', onClick: () => run(() => setImgAlign('center')) },
    { label: '오른쪽 배치', short: '오른쪽', icon: 'align-right', onClick: () => run(() => setImgAlign('right')) },
    { divider: '편집', label: '' },
    { label: '그림판에서 주석 편집', short: '주석 편집', icon: 'paint', onClick: () => run(p.onPaint) },
    { label: '그림 삭제', short: '삭제', icon: 'trash', onClick: () => run(() => editor.chain().focus().deleteSelection().run()) },
  ]

  /* ============================================================
     리본 = 지금 이 문서를 만드는 일 (파일·편집·보기·입력·서식·쪽·검토)
     그 뒤 구분선 다음은 부가 묶음 (AI·논문) — 성격이 달라 눈에도 다르게 보이게 한다.
     문서와 상관없는 앱 유틸(그림판·OCR·마인드맵·포모도로…)은 리본에서 빼고
     오른쪽 유틸 아이콘과 더보기(⋯) 메뉴로 모았다.
     ============================================================ */
  /* 리본에서 빼 유틸 메뉴(⋯)로 보낼 것 — 문서 만들기와 직접 상관없는 앱 도구 */
  const UTIL_KEYS = ['그림판', '포스트잇']
  /* 보기 탭의 '시각화'로 보낼 것 — 문서를 다른 눈으로 보는 기능 */
  const VIEW_KEYS = ['마인드맵', '플래시카드', '워드 클라우드', '포모도로']
  const AUTOTEXT_KEYS = ['템플릿', '스니펫', '매크로']

  const toolsRest = notAi(pick('도구'))
  const reviewItems: MenuItem[] = [
    { divider: '교정 · 언어', label: '' },
    ...take(toolsRest, ['맞춤법']),
    ...take(aiFrom(pick('도구')), ['번역']),
    { divider: '문서 점검', label: '' },
    ...take(toolsRest, ['깨진 링크', '메모 비교']),
    ...take(aiFrom(pick('도구')), ['문서 건강']),
    { divider: '통계 · 기록', label: '' },
    ...take(toolsRest, ['통계', '활동 히트맵', '메모 정보']),
  ]

  const groups: MenuGroup[] = [
    { label: '파일', items: drop(pick('파일'), ['실행 취소', '다시 실행', '모두 선택', '찾기 · 바꾸기', '전체 문서 검색', '글자 서식 지우기', '문단 서식 지우기', '명령 팔레트', '인쇄']) },
    { label: '편집', items: editItems },
    {
      label: '보기',
      items: [
        ...pick('보기'),
        { divider: '시각화 · 집중', label: '' },
        ...take(toolsRest, VIEW_KEYS),
        ...take(aiFrom(pick('도구')), ['마인드맵', '워드 클라우드']),
      ],
    },
    {
      label: '입력',
      items: [
        ...drop(pick('삽입'), ['빠른 메모']),
        { divider: '미디어', label: '' },
        ...drop(notAi(pick('미디어')), UTIL_KEYS),
        { divider: '자동 입력', label: '' },
        ...take(toolsRest, AUTOTEXT_KEYS),
      ],
    },
    { label: '서식', items: drop(pick('서식'), ['엔터 표시']) },
    { label: '쪽', items: drop(pick('페이지'), ['엔터 표시']) },
    { label: '검토', items: reviewItems },
    { label: 'AI', items: aiItems, extra: true },
    /* 논문 탭은 학술 문서 전용만 남긴다 — 개요·각주·쪽 나눔·단 같은 일반 기능은 코어 탭이 담당한다 */
    { label: '논문', items: drop(pick('논문'), ['문서 개요 패널', '각주 삽입', '페이지 구분 삽입', '다단 레이아웃']), extra: true },
    /* 워드처럼 표 안에서는 상황별 탭이 두 개 열린다 — 「표 디자인」(모양)과 「레이아웃」(구조) */
    ...(inTable ? [{ label: '표 디자인', items: tableDesignItems, context: true }] : []),
    ...(inTable ? [{ label: '레이아웃', items: tableItems, context: true }] : []),
    ...(onImage ? [{ label: '그림', items: imageItems, context: true }] : []),
  ]

  /* 묶음 오른쪽 아래 화살표 → 그 묶음의 전체 설정 창 (한글·워드의 대화상자 연결) */
  const ribbonLaunchers: Record<string, { label: string; onClick: () => void }> = {
    '페이지 동작': { label: '쪽 설정 창 열기', onClick: () => p.onPageSettings() },
    '미리보기 / 인쇄': { label: '인쇄 미리보기 열기', onClick: () => p.onPrintPreview() },
    '한국어 타이포': { label: '문서 스타일 창 열기', onClick: () => p.onTypo() },
    '제목': { label: '문서 스타일 창 열기', onClick: () => p.onTypo() },
    '서식 복사 · 내 스타일': { label: '내 스타일 관리 열기', onClick: () => p.onSnippets() },
    '쓰기 도우미': { label: 'AI 도우미 열기', onClick: () => p.onAi() },
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

      {showLinkPop && (
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
        </div>
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

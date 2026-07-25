import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import type { Mark as PMMark } from '@tiptap/pm/model'
import type { CSSProperties } from 'react'
import { downloadHwpx } from '../lib/hwpxExport'
import { downloadMd } from '../lib/markdownIO'
import { exportToPdf } from '../lib/pdfExport'
import { ColorPicker } from './ColorPicker'
import { TTSButton } from './TTSButton'
import { VoiceButton } from './VoiceButton'
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
import { insertNumberedEquation, insertFigureCaption, insertTableCaption, insertCrossRef, paperTargetCount, renumberWithFeedback } from '../lib/paperRefs'
import { pickMathTemplate, lintPaper, showLintReport, insertCreditBlock, insertCoiBlock, insertDataAvailabilityBlock, insertListOfFigures, insertListOfTables, insertAcronymList } from '../lib/paperTools'
import { downloadLatex } from '../lib/latexExport'
import { downloadHtmlFile, downloadDocFile } from '../lib/htmlDocExport'
import { MathStudio } from './MathStudio'
import { getSavableHtml } from '../extensions/PageDocument'

interface ToolbarProps {
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

const FONT_FAMILY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '기본 글꼴' },
  { value: '"Malgun Gothic", "맑은 고딕", sans-serif', label: '맑은 고딕' },
  { value: '"Nanum Gothic", "나눔고딕", sans-serif', label: '나눔고딕' },
  { value: '"Noto Sans KR", sans-serif', label: 'Noto Sans KR' },
  { value: '"Batang", "바탕", serif', label: '바탕' },
  { value: '"Gungsuh", "궁서", serif', label: '궁서' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Consolas, "D2Coding", monospace', label: 'Consolas (코딩)' },
]

const SYMBOL_GROUPS: Array<{ label: string; chars: string[] }> = [
  { label: '문장 부호', chars: ['—', '–', '…', '·', '•', '◦', '¶', '§', '©', '®', '™', '「', '」', '『', '』', '《', '》'] },
  { label: '도형 · 화살표', chars: ['★', '☆', '◆', '◇', '■', '□', '▲', '▼', '→', '←', '↑', '↓', '⇒', '⇐', '↔', '✓', '✗'] },
  { label: '수학', chars: ['°', '±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '√', '∫', 'Σ', 'Π', '½', '¼', '¾', '²', '³'] },
  { label: '그리스 문자', chars: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'σ', 'τ', 'φ', 'ψ', 'ω', 'Ω', 'Δ', 'Φ'] },
  { label: '통화 · 단위', chars: ['₩', '$', '€', '¥', '£', '℃', '℉', '㎡', '㎥', '㎏', '㎜', '㎝', '㎞', '㏄'] },
]

interface MenuItem { label: string; hint?: string; icon?: IconName; divider?: string; onClick?: () => void }
interface MenuGroup { label: string; items: MenuItem[] }
interface MenuPosition { left: number; top: number; width: number }

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
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    if (openMenu) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [openMenu])

  useEffect(() => {
    if (!openMenu || typeof window === 'undefined') {
      setMenuPosition(null)
      return
    }

    const update = () => {
      const button = menuButtonRefs.current[openMenu]
      if (!button || !window.matchMedia('(max-width: 800px)').matches) {
        setMenuPosition(null)
        return
      }

      const rect = button.getBoundingClientRect()
      const width = Math.round(Math.min(340, Math.max(260, window.innerWidth - 16)))
      const leftMax = Math.max(8, window.innerWidth - width - 8)
      const left = Math.round(Math.min(Math.max(8, rect.left), leftMax))
      const top = Math.round(Math.min(Math.max(8, rect.bottom + 6), Math.max(8, window.innerHeight - 96)))
      setMenuPosition({ left, top, width })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [openMenu])

  if (!editor) return null

  /* ============================================================
   * 헬퍼 / 실제 기능 구현
   * ============================================================ */

  const insertHTML = (html: string) => editor.chain().focus().insertContent(html).run()

  const togglePilcrow = () => {
    document.body.classList.toggle('jan-show-pilcrow')
    try { localStorage.setItem('jan-show-pilcrow', document.body.classList.contains('jan-show-pilcrow') ? '1' : '0') } catch {}
  }
  const insertTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
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
  const countFootnoteRefs = () => {
    let count = 0
    editor.state.doc.descendants((node) => {
      if (node.isText && node.marks.some((m) => m.type.name === 'superscript' && m.attrs.class === 'paper-fn-ref')) count++
    })
    return count
  }
  const insertFootnote = () => {
    const n = countFootnoteRefs() + 1
    // 커서 위치에 참조 삽입 (Superscript 마크가 등록돼 있어 sup+class 가 보존된다)
    insertHTML(`<sup class="paper-fn-ref">[${n}]</sup>`)
    // 문서 끝에 각주 본문 추가 — DOM 을 읽어 setContent 하면 페이지네이션
    // 위젯까지 본문으로 재주입되므로 절대 하지 않는다
    const end = editor.state.doc.content.size
    editor.chain().insertContentAt(end, `<p><sup class="paper-fn-ref">[${n}]</sup> 각주 내용 — 클릭해서 편집</p>`).run()
  }
  const insertCitation = async () => {
    const cite = await askText('인용 (예: Smith, 2024):', 'Author, 2024')
    if (cite) insertHTML(`<sup class="paper-cite">(${escHtml(cite)})</sup>`)
  }
  const insertReference = async () => {
    const ref = await askText('참고문헌 항목:', 'Author, A. (2024). Title. Journal, 1(1), 1-10.', { multiline: true })
    if (ref) insertHTML(`<div class="paper-ref" style="text-indent:-1.5em;padding-left:1.5em;font-size:0.9em;margin:0.3em 0;">${escHtml(ref)}</div>`)
  }
  const renumberFootnotes = () => {
    const { state } = editor
    const refs: Array<{ from: number; to: number; marks: readonly PMMark[] }> = []
    state.doc.descendants((node, pos) => {
      if (node.isText && node.marks.some((m) => m.type.name === 'superscript' && m.attrs.class === 'paper-fn-ref')) {
        refs.push({ from: pos, to: pos + node.nodeSize, marks: node.marks })
      }
    })
    if (!refs.length) return
    let tr = state.tr
    for (let i = refs.length - 1; i >= 0; i--) {
      tr = tr.replaceWith(refs[i].from, refs[i].to, state.schema.text(`[${i + 1}]`, refs[i].marks as PMMark[]))
    }
    editor.view.dispatch(tr)
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
    renumberFootnotes()
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

  /* === 한국어 타이포 인라인 === */
  const setLetterSpacing = async () => {
    const v = await askText('자간 (em) — 예: -0.05 좁게 / 0.1 넓게', localStorage.getItem('jan-letter-spacing') || '0')
    if (v === null) return
    if (Number.isNaN(Number(v))) { flash('숫자를 입력하세요 (예: -0.05, 0.1)'); return }
    localStorage.setItem('jan-letter-spacing', v)
    const id = 'jan-letter-spacing-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = `.ProseMirror { letter-spacing: ${Number(v)}em; }`
  }
  const setCharScale = async () => {
    const v = await askText('장평 (%) — 20~200, 기본 100', localStorage.getItem('jan-char-scale') || '100')
    if (v === null) return
    const scaleNum = Number(v)
    if (Number.isNaN(scaleNum) || scaleNum < 20 || scaleNum > 200) { flash('20~200 사이 숫자를 입력하세요'); return }
    localStorage.setItem('jan-char-scale', v)
    const id = 'jan-char-scale-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    if (Number(v) === 100) { s.textContent = ''; return }
    const ratio = Number(v)/100
    const compW = (100/ratio).toFixed(2)
    s.textContent = `.ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6, .ProseMirror li, .ProseMirror blockquote { transform: scaleX(${ratio}); transform-origin: left top; width: ${compW}%; }`
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
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true })
      const track = stream.getVideoTracks()[0]
      const cap = new (window as any).ImageCapture(track)
      const bitmap = await cap.grabFrame()
      const cv = document.createElement('canvas'); cv.width = bitmap.width; cv.height = bitmap.height
      cv.getContext('2d')!.drawImage(bitmap, 0, 0)
      track.stop()
      const dataUrl = cv.toDataURL('image/png')
      editor.chain().focus().setImage({ src: dataUrl }).run()
    } catch (e: any) { flash('화면 캡쳐 취소 또는 실패: ' + (e.message || e), 2600) }
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
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { flash('이 브라우저는 음성 인식을 지원하지 않습니다'); return }
    const r = new SR(); r.lang = 'ko-KR'; r.interimResults = true; r.continuous = false
    let final = ''
    r.onresult = (e: any) => { for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript } }
    r.onend = () => { if (final) editor.chain().focus().insertContent(final).run(); else flash('인식된 음성이 없습니다') }
    r.onerror = (e: any) => flash('음성 인식 오류: ' + e.error, 2600)
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
      const stop = () => { try { rec.stop() } catch {} }
      /* Auto-stop after 30 sec or user click */
      setTimeout(stop, 30000)
      const overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#FAE100;color:#333;padding:16px 24px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:99999;font-weight:600;cursor:pointer;'
      overlay.textContent = '녹음 중... 클릭하면 정지'
      overlay.onclick = () => { stop(); overlay.remove() }
      document.body.appendChild(overlay)
      rec.onstart = () => {}
      rec.addEventListener('stop', () => overlay.remove())
    } catch (e: any) { flash('마이크 접근 실패: ' + (e.message || e), 2600) }
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
    editor.chain().focus().setImage({ src: u, title: prompt } as any).run()
    flash('AI 이미지 생성 중 — 잠시 후 이미지가 나타납니다')
  }

  /* === 도구 === */
  const wordCloud = () => {
    const text = editor.state.doc.textContent
    const words: Record<string, number> = {}
    text.split(/[\s,.\-—()\[\]{}!?;:'"]+/).forEach(w => {
      w = w.trim(); if (w.length < 2) return
      words[w] = (words[w] || 0) + 1
    })
    const sorted = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 60)
    if (!sorted.length) { flash('워드 클라우드를 만들 단어가 없습니다'); return }
    const max = sorted[0][1]
    const w = window.open('', '_blank', 'width=900,height=600'); if (!w) return
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
        try { if ('Notification' in window && Notification.permission === 'granted') new Notification('포모도로 완료', { body: '5분 휴식하세요' }) } catch {}
      }
    }, 500)
    try { if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission() } catch {}
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
  const exportHwpx = async () => { try { await downloadHwpx(getSavableHtml(editor), memoTitle()) } catch (e: any) { flash('HWPX 실패: ' + (e.message || e), 2600) } }
  const exportMd = () => { try { downloadMd(getSavableHtml(editor), memoTitle()) } catch (e: any) { flash('MD 실패: ' + (e.message || e), 2600) } }
  const exportPdf = async () => { try { await exportToPdf(getSavableHtml(editor), memoTitle()) } catch (e: any) { flash('PDF 실패: ' + (e.message || e), 2600) } }
  const exportTex = () => { try { downloadLatex(getSavableHtml(editor), memoTitle()) } catch (e: any) { flash('LaTeX 실패: ' + (e.message || e), 2600) } }
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
        } catch (e: any) { flash('가져오기 실패: ' + (e.message || e), 3200) }
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
          const store = useMemosStore.getState() as any
          list.forEach((m: any) => {
            if (store.newMemo && store.updateCurrent) {
              store.newMemo()
              store.updateCurrent({ title: m.title || m.t || '가져온 메모', content: m.content || m.html || m.body || '<p></p>' })
              imported++
            }
          })
        } catch {}
      }
      flash(imported ? `${imported}개 가져오기 완료` : 'v1 메모를 찾지 못했습니다', 2600)
    } catch (e: any) { flash('실패: ' + (e.message || e), 3200) }
  }

  /* === 명령 팔레트 / 검색 등 === */
  const cmdPalette = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true }))

  function close() { setOpenMenu(null) }
  function run(fn: () => void) { fn(); close() }

  /* ============================================================
   * 8 카테고리 메뉴
   * ============================================================ */
  const groups: MenuGroup[] = [
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
        { label: '문서 개요 패널', icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: 'Acknowledgments (감사의 말)', icon: 'heart', onClick: () => run(insertAcknowledgments) },
        { label: 'CRediT 저자 기여도', icon: 'user', onClick: () => run(() => insertCreditBlock(editor)) },
        { label: '이해상충 선언 (COI)', icon: 'shield', onClick: () => run(() => insertCoiBlock(editor)) },
        { label: 'Data Availability', icon: 'download', onClick: () => run(() => insertDataAvailabilityBlock(editor)) },
        { label: '그림 목록 (List of Figures)', icon: 'image', onClick: () => run(() => insertListOfFigures(editor)) },
        { label: '표 목록 (List of Tables)', icon: 'table', onClick: () => run(() => insertListOfTables(editor)) },
        { label: '약어 목록 자동 추출', icon: 'hash', onClick: () => run(() => insertAcronymList(editor)) },
        { divider: '레이아웃', label: '' },
        { label: `다단 레이아웃: ${pageColumnLabel}`, icon: 'columns', onClick: () => run(cyclePageColumns) },
        { label: '페이지 구분 삽입', hint: 'Ctrl+Enter', icon: 'page-break', onClick: () => run(insertPageBreak) },
        { label: '러닝 헤더 · 꼬리말 설정', icon: 'pin', onClick: () => run(setRunningHeader) },
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
        { label: '형광펜', icon: 'highlight', onClick: () => run(() => (editor.chain() as any).focus().toggleHighlight({ color: '#FFEB3B' }).run()) },
        { divider: '제목', label: '' },
        { label: '제목 1', hint: 'Ctrl+Alt+1', icon: 'h1', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run()) },
        { label: '제목 2', hint: 'Ctrl+Alt+2', icon: 'h2', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run()) },
        { label: '제목 3', hint: 'Ctrl+Alt+3', icon: 'h3', onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run()) },
        { label: '일반 문단', icon: 'paragraph', onClick: () => run(() => editor.chain().focus().setParagraph().run()) },
        { divider: '정렬', label: '' },
        { label: '왼쪽 정렬', hint: 'Ctrl+L', icon: 'align-left', onClick: () => run(() => editor.chain().focus().setTextAlign('left').run()) },
        { label: '가운데 정렬', hint: 'Ctrl+E', icon: 'align-center', onClick: () => run(() => editor.chain().focus().setTextAlign('center').run()) },
        { label: '오른쪽 정렬', hint: 'Ctrl+R', icon: 'align-right', onClick: () => run(() => editor.chain().focus().setTextAlign('right').run()) },
        { label: '양쪽 정렬', hint: 'Ctrl+J', icon: 'align-justify', onClick: () => run(() => editor.chain().focus().setTextAlign('justify').run()) },
        { divider: '한국어 타이포', label: '' },
        { label: '자간 설정', icon: 'palette', onClick: () => run(setLetterSpacing) },
        { label: '장평 설정', icon: 'palette', onClick: () => run(setCharScale) },
        { label: '첫 줄 들여쓰기 토글', icon: 'paragraph', onClick: () => run(toggleFirstLineIndent) },
        { label: '단락 간격', icon: 'paragraph', onClick: () => run(setParagraphSpacing) },
        { label: '글자 효과', icon: 'sparkle', onClick: () => run(setTextEffect) },
        { label: '강조 배경 상자', icon: 'highlight', onClick: () => run(insertHighlightBox) },
        { divider: '서식 복사 · 내 스타일', label: '' },
        { label: '서식 복사', hint: 'Ctrl+Shift+C', icon: 'wand', onClick: () => run(() => window.dispatchEvent(new Event('jan-format-copy'))) },
        { label: '서식 붙여넣기', hint: 'Ctrl+Shift+V', icon: 'wand', onClick: () => run(() => window.dispatchEvent(new Event('jan-format-paste'))) },
        { label: '현재 서식을 내 스타일로 저장', icon: 'save', onClick: () => run(async () => {
          if (editor.state.selection.empty) { flash('먼저 서식이 적용된 텍스트를 선택하세요'); return }
          const name = await askText('스타일 이름:', '', { placeholder: '예: 핵심 강조, 보고서 소제목' })
          if (name) saveCurrentAsStyle(editor, name)
        }) },
        { label: '내 스타일 적용 / 관리', icon: 'palette', onClick: () => run(() => showMyStylesPicker(editor)) },
        { divider: '기타', label: '' },
        { label: '문서 스타일', icon: 'palette', onClick: () => run(p.onTypo) },
        { label: '서식 지우기', icon: 'wand', onClick: () => run(() => editor.chain().focus().unsetAllMarks().clearNodes().run()) },
        { label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
      ],
    },

    /* 3. 삽입 */
    {
      label: '삽입', items: [
        { label: '표 (3×3)', icon: 'table', onClick: () => run(insertTable) },
        { label: '표로 붙여넣기 (CSV·엑셀 데이터)', icon: 'table', onClick: () => run(() => { void insertTableFromCsv() }) },
        { label: '이미지 URL', icon: 'image', onClick: () => run(insertImageURL) },
        { label: '이미지 업로드', icon: 'image', onClick: () => run(uploadImage) },
        { label: '링크', hint: 'Ctrl+K', icon: 'link', onClick: () => run(toggleLink) },
        { label: '목차 (제목 기반 자동 생성)', icon: 'list-numbered', onClick: () => run(insertToc) },
        { label: '구분선', icon: 'minus', onClick: () => run(insertHr) },
        { divider: '리스트', label: '' },
        { label: '글머리 기호', icon: 'list-bullet', onClick: () => run(() => editor.chain().focus().toggleBulletList().run()) },
        { label: '번호 매기기', icon: 'list-numbered', onClick: () => run(() => editor.chain().focus().toggleOrderedList().run()) },
        { label: '체크리스트', icon: 'list-check', onClick: () => run(() => (editor.chain() as any).focus().toggleList('taskList', 'taskItem').run()) },
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
        { label: '다이어그램 (Mermaid)', icon: 'hash', onClick: () => run(async () => { const c = await askText('Mermaid 다이어그램:', 'graph TD\n  A-->B', { multiline: true }); if (c) (editor.chain() as any).focus().setMermaid(c).run() }) },
        { label: '콜아웃 (정보)', icon: 'info', onClick: () => run(() => (editor.chain() as any).focus().setCallout('info').run()) },
        { label: '콜아웃 (경고)', icon: 'bell', onClick: () => run(() => (editor.chain() as any).focus().setCallout('warn').run()) },
        { label: '임베드 URL', icon: 'globe', onClick: () => run(async () => { const u = await askText('임베드 URL (YouTube/Vimeo 등):'); if (u) (editor.chain() as any).focus().setEmbed(u).run() }) },
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
        { label: '러닝 헤더 · 꼬리말', icon: 'pin', onClick: () => run(setRunningHeader) },
        { divider: '미리보기 / 인쇄', label: '' },
        { label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
        { label: '인쇄 미리보기 (Paged.js)', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
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
        { label: 'AI 이미지 생성 (Pollinations)', icon: 'sparkle', onClick: () => run(aiImageStub) },
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
        { label: '문서 건강 점수 (100점 진단)', icon: 'shield', onClick: () => run(runDocHealth) },
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
        { label: 'OCR (이미지 → 텍스트)', icon: 'image', onClick: () => run(p.onOcr) },
        { label: '템플릿', icon: 'file-text', onClick: () => run(p.onTemplates) },
        { label: '스니펫', icon: 'file-plus', onClick: () => run(p.onSnippets) },
        { label: '매크로', icon: 'wand', onClick: () => run(p.onMacros) },
        { label: '포모도로 타이머', icon: 'clock', onClick: () => run(startPomodoro) },
      ],
    },

    /* 7. 보기 */
    {
      label: '보기', items: [
        { label: `문서 보기: ${viewLayoutLabel}`, icon: 'preview', onClick: () => run(() => ui.setViewLayout(ui.viewLayout === 'draft' ? 'print' : 'draft')) },
        { label: '인쇄 레이아웃', icon: 'page', onClick: () => run(() => ui.setViewLayout('print')) },
        { label: '초안 레이아웃', icon: 'file-text', onClick: () => run(() => ui.setViewLayout('draft')) },
        { divider: '창', label: '' },
        { label: '집중 모드', hint: 'F11', icon: 'focus', onClick: () => run(() => ui.toggleFocus()) },
        { label: '읽기 모드', hint: 'Shift+F11', icon: 'preview', onClick: () => run(() => ui.toggleReading()) },
        { label: `타자기 모드 ${ui.typewriterMode ? '끄기' : '켜기'} (커서 줄 중앙 고정)`, icon: 'focus', onClick: () => run(() => { ui.toggleTypewriter(); flash(ui.typewriterMode ? '타자기 모드 끔' : '타자기 모드 켬 — 커서 줄이 화면 중앙에 유지됩니다') }) },
        { label: `현재 문단 하이라이트 ${ui.paragraphFocus ? '끄기' : '켜기'}`, icon: 'focus', onClick: () => run(() => { ui.toggleParagraphFocus(); flash(ui.paragraphFocus ? '문단 하이라이트 끔' : '문단 하이라이트 켬 — 커서 문단 외에는 흐려집니다') }) },
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
        { label: '페이지 너비에 맞춤', icon: 'maximize', onClick: () => run(() => fitPageZoom('width')) },
        { label: '한 페이지 보기', icon: 'page', onClick: () => run(() => fitPageZoom('page')) },
        { label: '75%', icon: 'zoom-out', onClick: () => run(() => setPageZoom(0.75)) },
        { label: '125%', icon: 'zoom-in', onClick: () => run(() => setPageZoom(1.25)) },
        { divider: '아웃라인 / 미리보기', label: '' },
        { label: `목차 ${p.outlineOpen ? '닫기' : '열기'}`, icon: 'list-bullet', onClick: () => run(p.onToggleOutline) },
        { label: 'Markdown 미리보기', icon: 'preview', onClick: () => run(p.onMdPreview) },
        { label: '인쇄 미리보기', hint: 'Ctrl+Alt+P', icon: 'preview', onClick: () => run(p.onPrintPreview) },
        { divider: '표시', label: '' },
        { label: '엔터 표시(¶) 켬/끔', icon: 'paragraph', onClick: () => run(togglePilcrow) },
        { label: '제목 번호 매기기 토글', icon: 'hash', onClick: () => run(() => ui.toggleHeadingNumbers && ui.toggleHeadingNumbers()) },
      ],
    },

    /* 8. 파일 */
    {
      label: '파일', items: [
        { label: '새 메모', hint: 'Ctrl+N', icon: 'plus', onClick: () => run(p.onNewMemo) },
        { label: '열기...', hint: 'Ctrl+O', icon: 'open', onClick: () => run(p.onOpen) },
        { label: '저장', hint: 'Ctrl+S', icon: 'save', onClick: () => run(p.onSave) },
        { label: '다른 이름으로 저장...', icon: 'save', onClick: () => run(p.onSaveAs) },
        { divider: '내보내기', label: '' },
        { label: '인쇄', hint: 'Ctrl+P', icon: 'print', onClick: () => run(() => window.print()) },
        { label: 'PDF 내보내기', icon: 'file-text', onClick: () => run(exportPdf) },
        { label: 'HTML 내보내기', icon: 'globe', onClick: () => run(exportHtml) },
        { label: 'Markdown(.md) 저장', icon: 'file-text', onClick: () => run(exportMd) },
        { label: 'HWPX (한글) 내보내기', icon: 'file-text', onClick: () => run(exportHwpx) },
        { label: 'Word(.doc) 내보내기', icon: 'file-text', onClick: () => run(exportDocx) },
        { label: 'LaTeX(.tex) 내보내기', icon: 'file-text', onClick: () => run(exportTex) },
        { label: '모든 형식 내보내기 (MD·HTML·LaTeX·HWPX·DOC)', icon: 'download', onClick: () => run(() => { void exportAll() }) },
        { divider: '공유 / 백업', label: '' },
        { label: 'GitHub Gist 로 공유', icon: 'cloud', onClick: () => run(p.onGist) },
        { label: '공유 링크', icon: 'link', onClick: () => run(p.onShare) },
        { label: 'JSON 백업 내보내기', icon: 'cloud', onClick: () => run(exportJsonBackup) },
        { label: 'JSON 백업 가져오기', icon: 'cloud', onClick: () => run(importJsonBackup) },
        { label: 'v1 메모 가져오기', icon: 'undo', onClick: () => run(importV1) },
        { divider: '관리', label: '' },
        { label: '버전 기록', icon: 'undo', onClick: () => run(p.onVersions) },
        { label: '잠금 / 비밀번호', icon: 'lock', onClick: () => run(p.onLock) },
        { label: '휴지통', icon: 'box', onClick: () => run(p.onTrash) },
        { label: '정보 / 버전', icon: 'info', onClick: () => run(p.onAbout) },
      ],
    },
  ]

  function MenuButton({ group }: { group: MenuGroup }) {
    const isOpen = openMenu === group.label
    const menuStyle = isOpen && menuPosition
      ? ({
          '--jan-menu-left': `${menuPosition.left}px`,
          '--jan-menu-top': `${menuPosition.top}px`,
          '--jan-menu-width': `${menuPosition.width}px`,
        } as CSSProperties)
      : undefined

    return (
      <div className="jan-menu-wrap">
        <button
          ref={(node) => { menuButtonRefs.current[group.label] = node }}
          className={'jan-menu-btn' + (isOpen ? ' is-open' : '')}
          onClick={() => {
            setOpenMenu(isOpen ? null : group.label)
            if (isOpen) setMenuPosition(null)
          }}
          aria-expanded={isOpen}
        >
          <span>{group.label}</span>
          <Icon name="chevron-down" size={10} className="jan-menu-arrow" />
        </button>
        {isOpen && (
          <div className="jan-menu-dropdown" style={menuStyle} onMouseDown={(e) => e.stopPropagation()}>
            {group.items.map((it, i) => {
              if (it.divider) return <div key={i} className="jan-menu-divider">{it.divider}</div>
              return (
                <button key={i} className="jan-menu-item" onClick={it.onClick}>
                  {it.icon && <Icon name={it.icon} size={14} />}
                  <span className="jan-menu-label">{it.label}</span>
                  {it.hint && <span className="jan-menu-hint">{it.hint}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="jan-toolbar-row" ref={containerRef}>
      <select
        className="jan-toolbar-select"
        value={editor.getAttributes('textStyle').fontFamily || ''}
        onChange={(e) => {
          const v = e.target.value
          if (v) editor.chain().focus().setFontFamily(v).run()
          else editor.chain().focus().unsetFontFamily().run()
        }}
        title="글꼴 (선택 영역에 적용 — 문서 기본값은 문서 스타일에서)"
      >
        {FONT_FAMILY_OPTIONS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      <select
        className="jan-toolbar-select"
        value={editor.getAttributes('textStyle').fontSize || ''}
        onChange={(e) => {
          const v = e.target.value
          if (v) editor.chain().focus().setFontSize(v).run()
          else editor.chain().focus().unsetFontSize().run()
        }}
        title="글자 크기 (선택 영역에 적용)"
        style={{ minWidth: 56 }}
      >
        <option value="">기본</option>
        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map((n) => <option key={n} value={`${n}px`}>{n}</option>)}
      </select>
      <select
        className="jan-toolbar-select"
        value={editor.getAttributes('paragraph').lineHeight || editor.getAttributes('heading').lineHeight || ''}
        onChange={(e) => {
          const v = e.target.value
          editor.chain().focus().setParagraphLineHeight(v || null).run()
        }}
        title="줄 간격 (현재 문단)"
        style={{ minWidth: 58 }}
      >
        <option value="">줄간격</option>
        {['1', '1.15', '1.5', '1.7', '2', '2.5'].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <span className="divider" />

      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} title="굵게 (Ctrl+B)"><Icon name="bold" /></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''} title="기울임 (Ctrl+I)"><Icon name="italic" /></button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''} title="밑줄 (Ctrl+U)"><Icon name="underline" /></button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''} title="취소선"><Icon name="strike" /></button>
      <button onClick={() => editor.chain().focus().toggleSuperscript().run()} className={editor.isActive('superscript') ? 'is-active' : ''} title="위 첨자" aria-label="위 첨자"><span style={{ fontSize: 12 }}>X<sup style={{ fontSize: 8 }}>2</sup></span></button>
      <button onClick={() => editor.chain().focus().toggleSubscript().run()} className={editor.isActive('subscript') ? 'is-active' : ''} title="아래 첨자" aria-label="아래 첨자"><span style={{ fontSize: 12 }}>X<sub style={{ fontSize: 8 }}>2</sub></span></button>
      <button onClick={() => (editor.chain() as any).focus().toggleHighlight({ color: '#FFEB3B' }).run()} className={editor.isActive('highlight') ? 'is-active' : ''} title="형광펜"><Icon name="highlight" /></button>
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
      <button onClick={() => (editor.chain() as any).focus().toggleList('taskList', 'taskItem').run()} title="체크리스트"><Icon name="list-check" /></button>
      <span className="divider" />

      <button onClick={() => editor.chain().focus().undo().run()} title="실행 취소 (Ctrl+Z)"><Icon name="undo" /></button>
      <button onClick={() => editor.chain().focus().redo().run()} title="다시 실행 (Ctrl+Shift+Z)"><Icon name="redo" /></button>
      <span className="divider" />
      <TTSButton editor={editor} />
      <VoiceButton editor={editor} />

      <span className="jan-spacer" />

      {groups.map((g) => <MenuButton key={g.label} group={g} />)}

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
  )
}

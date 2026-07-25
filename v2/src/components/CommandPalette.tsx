import { useEffect, useState, useMemo } from 'react'
import { askText } from '../lib/promptModal'
import type { Editor } from '@tiptap/react'
import type { Mark as PMMark } from '@tiptap/pm/model'
import { useMemosStore } from '../store/memosStore'
import { PAPER_STYLES, useUIStore } from '../store/uiStore'
import { useThemeStore } from '../store/themeStore'
import { Icon } from './Icons'
import type { IconName } from './Icons'
import { downloadHwpx } from '../lib/hwpxExport'
import { downloadMd } from '../lib/markdownIO'
import { exportToPdf } from '../lib/pdfExport'
import { fitPageZoom, setPageZoom } from '../lib/pageZoom'
import { PAGE_BREAK_HTML } from '../lib/pageBreak'
import { getSavableHtml } from '../extensions/PageDocument'

interface Command {
  id: string
  cat: string
  label: string
  desc?: string
  hint?: string
  icon: IconName
  run: () => void
}

interface CommandPaletteProps {
  editor: Editor | null
  /* 모달 핸들러 */
  onAi?: () => void; onChat?: () => void; onSearch?: () => void; onFind?: () => void
  onOcr?: () => void; onPaint?: () => void; onPostit?: () => void; onPaper?: () => void
  onRoles?: () => void; onTemplates?: () => void; onSnippets?: () => void; onMacros?: () => void
  onTypo?: () => void; onCalendar?: () => void; onQuick?: () => void; onMd?: () => void
  onPrintPreview?: () => void; onShare?: () => void; onGist?: () => void; onAtt?: () => void
  onLock?: () => void; onSettings?: () => void; onHelp?: () => void; onAbout?: () => void
  onStats?: () => void; onMindMap?: () => void; onHeatmap?: () => void; onInfo?: () => void
  onDiff?: () => void; onLinkCheck?: () => void; onTranslate?: () => void; onVersions?: () => void
  onCards?: () => void
  onToggleOutline?: () => void
  onSave?: () => void; onOpen?: () => void
  onPageSettings?: () => void
}

/**
 * Phase 30 — v1 명령 팔레트 정확 복제.
 * 좌측정렬 + 라인아트 SVG 아이콘 + 풀폭 노란 highlight + 직접 핸들러 호출.
 */
export function CommandPalette(p: CommandPaletteProps) {
  const editor = p.editor
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const { newMemo, duplicate, togglePin, list, setCurrent } = useMemosStore() as any
  const ui = useUIStore()
  const { toggleFocus, zoomIn, zoomOut, zoomReset, toggleSidebar, toggleHeadingNumbers, toggleReading, toggleSpellCheck, toggleRulers } = ui
  const { theme, setTheme } = useThemeStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setOpen((v) => !v); setQuery(''); setSelected(0); return
      }
      if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false) }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open])

  /* === 인라인 헬퍼 === */
  const insertHTML = (html: string) => editor?.chain().focus().insertContent(html).run()
  const togglePilcrow = () => {
    document.body.classList.toggle('jan-show-pilcrow')
    try { localStorage.setItem('jan-show-pilcrow', document.body.classList.contains('jan-show-pilcrow') ? '1' : '0') } catch {}
  }
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light')
  const insertDateTime = () => {
    const d = new Date()
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    editor?.chain().focus().insertContent(s).run()
  }
  const insertAuthorBlock = () => insertHTML(`<div class="paper-authors" style="text-align:center;margin:1em 0;"><p style="font-weight:600;font-size:1.05em;">저자 1<sup>1</sup>, 저자 2<sup>2</sup>, 교신저자 3<sup>1,*</sup></p><p style="font-size:0.9em;color:#555;"><sup>1</sup>소속 1, 도시 · <sup>2</sup>소속 2</p><p style="font-size:0.85em;color:#777;"><sup>*</sup>example@email.com</p></div><p></p>`)
  const insertAbstract = () => insertHTML(`<div class="paper-abstract" style="border:1px solid #ddd;background:#fafafa;padding:1em 1.2em;margin:1em 0;border-radius:4px;"><strong>ABSTRACT</strong><p style="margin:0.4em 0 0;">여기에 초록을 작성하세요.</p></div><p></p>`)
  const insertKeywords = () => insertHTML(`<p class="paper-keywords"><strong>KEYWORDS</strong>&nbsp;&nbsp;키워드1 · 키워드2 · 키워드3</p>`)
  const insertAck = () => insertHTML(`<h2>Acknowledgments</h2><p>본 연구는 [기관명] 의 지원으로 수행되었습니다.</p>`)
  const toggleTwoCol = () => {
    const cur = document.body.classList.toggle('jan-2col')
    const id = 'jan-2col-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = cur ? '.jan-2col .ProseMirror { column-count: 2; column-gap: 2em; column-rule: 1px solid #eee; }' : ''
  }
  const insertPageBreak = () => insertHTML(PAGE_BREAK_HTML)
  const insertFootnote = () => {
    if (!editor) return
    let count = 0
    editor.state.doc.descendants((node) => {
      if (node.isText && node.marks.some((m) => m.type.name === 'superscript' && m.attrs.class === 'paper-fn-ref')) count++
    })
    const n = count + 1
    insertHTML(`<sup class="paper-fn-ref">[${n}]</sup>`)
    // DOM 을 읽어 setContent 하면 페이지네이션 위젯이 본문으로 재주입된다 — 트랜잭션으로만 추가
    const end = editor.state.doc.content.size
    editor.chain().insertContentAt(end, `<p><sup class="paper-fn-ref">[${n}]</sup> 각주 내용 — 클릭해서 편집</p>`).run()
  }
  const insertCitation = () => { const c = window.prompt('인용 (예: Smith, 2024):', 'Author, 2024'); if (c) insertHTML(`<sup>(${c})</sup>`) }
  const insertReference = () => { const r = window.prompt('참고문헌:', 'Author. (2024). Title.'); if (r) insertHTML(`<div class="paper-ref" style="text-indent:-1.5em;padding-left:1.5em;">${r}</div>`) }
  const currentPaperLabel = PAPER_STYLES.find((style) => style.value === ui.paperStyle)?.label.replace(' (기본)', '') || '줄노트'
  const currentOrientationLabel = ui.pageOrientation === 'landscape' ? '가로' : '세로'
  const openPageSettings = () => p.onPageSettings?.()
  const setLetterSpacing = () => {
    const v = window.prompt('자간 (em, 예: -0.05 좁게 / 0.1 넓게):', '0'); if (v === null) return
    const id = 'jan-letter-spacing-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = `.ProseMirror { letter-spacing: ${v}em; }`
  }
  const setCharScale = () => {
    const v = window.prompt('장평 % (예: 80=좁게 120=넓게):', '100'); if (v === null) return
    const num = Math.max(20, Math.min(200, Number(v) || 100))
    const id = 'jan-char-scale-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    if (num === 100) { s.textContent = ''; return }
    const r = num/100, w = (100/r).toFixed(2)
    s.textContent = `.ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror li, .ProseMirror blockquote { transform: scaleX(${r}); transform-origin: left top; width: ${w}%; }`
  }
  const toggleFirstIndent = () => {
    const cur = localStorage.getItem('jan-first-line-indent') === '1'
    const next = !cur
    localStorage.setItem('jan-first-line-indent', next ? '1' : '0')
    const id = 'jan-first-line-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = next ? '.ProseMirror p { text-indent: 1.5em; }' : ''
  }
  const setParaSpace = () => {
    const v = window.prompt('단락 간격 (em):', '0.6'); if (v === null) return
    const id = 'jan-para-space-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = `.ProseMirror p { margin: ${v}em 0; }`
  }
  const captureScreen = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true })
      const track = stream.getVideoTracks()[0]
      const cap = new (window as any).ImageCapture(track)
      const bm = await cap.grabFrame()
      const cv = document.createElement('canvas'); cv.width = bm.width; cv.height = bm.height
      cv.getContext('2d')!.drawImage(bm, 0, 0); track.stop()
      editor?.chain().focus().setImage({ src: cv.toDataURL('image/png') }).run()
    } catch (e: any) { alert('취소 또는 실패: ' + (e.message||e)) }
  }
  const startVoice = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('이 브라우저 지원 안 함'); return }
    const r = new SR(); r.lang = 'ko-KR'; r.continuous = false
    let final = ''
    r.onresult = (e: any) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) final += e.results[i][0].transcript }
    r.onend = () => { if (final) editor?.chain().focus().insertContent(final).run() }
    r.start(); alert('말하세요...')
  }
  const speakSel = () => {
    const sel = window.getSelection()?.toString() || editor?.state.doc.textContent.slice(0,1000) || ''
    if (!sel) return
    const u = new SpeechSynthesisUtterance(sel); u.lang = 'ko-KR'
    speechSynthesis.cancel(); speechSynthesis.speak(u)
  }
  const aiImage = () => {
    const pr = window.prompt('AI 이미지 프롬프트:', '단순 라인아트')
    if (pr) editor?.chain().focus().setImage({ src: 'https://image.pollinations.ai/prompt/' + encodeURIComponent(pr) + '?width=512&height=512&nologo=true' }).run()
  }
  const wordCloud = () => {
    const text = editor?.state.doc.textContent || ''
    const words: Record<string, number> = {}
    text.split(/[\s,.\-—()\[\]{}!?;:'"]+/).forEach(w => { w = w.trim(); if (w.length < 2) return; words[w] = (words[w]||0)+1 })
    const sorted = Object.entries(words).sort((a,b) => b[1]-a[1]).slice(0, 60)
    if (!sorted.length) { alert('단어 없음'); return }
    const max = sorted[0][1]
    const w = window.open('', '_blank', 'width=900,height=600'); if (!w) return
    let html = `<!doctype html><html><head><title>워드 클라우드</title><style>body{font-family:sans-serif;padding:2em;text-align:center;background:#fff8e7;line-height:2}span{display:inline-block;margin:0.2em 0.4em;color:hsl(${Math.random()*360},60%,40%)}</style></head><body><h2>워드 클라우드</h2><div>`
    sorted.forEach(([wd,n]) => { html += `<span style="font-size:${Math.round(12 + (n/max)*36)}px">${wd}</span> ` })
    html += '</div></body></html>'; w.document.write(html); w.document.close()
  }
  const startPomo = () => {
    const min = Number(window.prompt('포모도로 (분):', '25')) || 25
    const end = Date.now() + min*60000
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;top:8px;right:8px;background:#FAE100;color:#333;padding:6px 12px;border-radius:6px;font-weight:700;z-index:9999;cursor:pointer'
    document.body.appendChild(el); el.onclick = () => { clearInterval(t); el.remove() }
    const t = setInterval(() => {
      const left = Math.max(0, end - Date.now()), m = Math.floor(left/60000), s = Math.floor((left%60000)/1000)
      el.textContent = `포모 ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      if (left <= 0) { clearInterval(t); el.remove(); alert('완료!') }
    }, 500)
  }
  const flashcards = () => {
    const root = document.querySelector('.ProseMirror'); if (!root) return
    const cards: { q: string, a: string }[] = []
    root.querySelectorAll('h1, h2, h3').forEach(h => {
      let next = h.nextElementSibling, body = ''
      while (next && !/^H[1-3]$/.test(next.tagName)) { body += next.textContent + ' '; next = next.nextElementSibling }
      cards.push({ q: h.textContent || '', a: body.trim() })
    })
    if (!cards.length) { alert('제목 없음'); return }
    const w = window.open('', '_blank', 'width=600,height=500'); if (!w) return
    w.document.write(`<!doctype html><html><head><title>플래시카드</title></head><body><div id="c" onclick="f=!f;s()"></div><script>const c=${JSON.stringify(cards)};let i=0,f=0;function s(){document.getElementById('c').innerHTML=f?c[i].a:c[i].q;}s();</script></body></html>`)
    w.document.close()
  }
  const exportHwpx = async () => { if (!editor) return; try { await downloadHwpx(getSavableHtml(editor), '메모') } catch (e: any) { alert('실패: ' + e.message) } }
  const exportMd = () => { if (!editor) return; try { downloadMd(getSavableHtml(editor), '메모') } catch (e: any) { alert('실패: ' + e.message) } }
  const exportPdf = async () => { if (!editor) return; try { await exportToPdf(getSavableHtml(editor), '메모') } catch (e: any) { alert('실패: ' + e.message) } }
  const exportHtml = () => {
    if (!editor) return
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>메모</title></head><body>${getSavableHtml(editor)}</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '메모.html'
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 800)
  }
  const exportDocx = () => {
    if (!editor) return
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${getSavableHtml(editor)}</body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '메모.doc'
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 800)
  }
  const jsonBackup = () => {
    const all = useMemosStore.getState().list()
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), version: 'v2', memos: all }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `JustANotepad-${Date.now()}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 800)
  }
  const webSearch = async () => { const q = await askText('웹 검색어:'); if (q) window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank') }
  const insertYouTube = () => {
    const u = window.prompt('YouTube URL:'); if (!u) return
    const m = u.match(/(?:v=|youtu\.be\/)([\w-]{11})/); if (!m) { alert('유효 URL 아님'); return }
    { if (!editor?.commands.setEmbed(`https://www.youtube.com/watch?v=${m[1]}`)) alert('임베드 삽입 실패') }
  }
  const insertSymbol = () => {
    const c = window.prompt('특수 문자:\n— – … · • ◦ ★ ☆ → ← ✓ ✗ ¶ § © ® ™ ° × ÷ ≈ ≠ ∞ Σ Π ∫ √ α β π σ ω', '—')
    if (c) editor?.chain().focus().insertContent(c).run()
  }
  const insertHrStyle = () => {
    const v = window.prompt('스타일 (1=실선, 2=점선, 3=이중선, 4=별표):', '1')
    const map: Record<string,string> = {
      '1': '<hr data-variant="solid" />',
      '2': '<hr data-variant="dashed" />',
      '3': '<hr data-variant="double" />',
      '4': '<p style="text-align:center">＊ ＊ ＊</p>',
    }
    if (v && map[v]) insertHTML(map[v])
  }
  const renumberFn = () => {
    if (!editor) return
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
  const setRunHeader = () => {
    const cur = localStorage.getItem('jan-run-header') || ''
    const v = window.prompt('러닝 헤더:', cur); if (v === null) return
    localStorage.setItem('jan-run-header', v)
    const id = 'jan-run-header-style'
    const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
    s.textContent = v ? `.ProseMirror::before { content:"${v.replace(/"/g,'\\"')}"; display:block;text-align:center;font-size:0.85em;color:#888;border-bottom:1px solid #eee;padding-bottom:0.4em;margin-bottom:1em; }` : ''
  }
  const insertHighlightBox = () => insertHTML('<div data-callout data-kind="tip"><p><strong>강조:</strong> 내용을 작성하세요.</p></div>')
  const insertTextBox = () => insertHTML('<div data-callout data-kind="info"><p>텍스트 입력</p></div>')
  const insertBookmark = () => { const id = window.prompt('책갈피 ID:', 'bm-' + Date.now()); if (id) insertHTML(`<a id="${id}" title="책갈피">⚓</a>`) }
  const setTextEffect = () => {
    const v = window.prompt('1=그림자, 2=네온, 3=조각, 0=해제:', '1')
    const m: Record<string,string> = { '0':'', '1':'text-shadow:1px 1px 2px rgba(0,0,0,0.25)', '2':'text-shadow:0 0 4px #ff0,0 0 8px #ff0;color:#600', '3':'text-shadow:1px 1px 0 #fff,-1px -1px 0 #999;color:#666' }
    if (v && m[v] !== undefined) {
      const id = 'jan-text-effect-style'
      const s = document.getElementById(id) || (() => { const e = document.createElement('style'); e.id = id; document.head.appendChild(e); return e })()
      s.textContent = m[v] ? `.ProseMirror { ${m[v]}; }` : ''
    }
  }
  const insertMeetingTpl = () => insertHTML(`<h3>회의 노트 — ${new Date().toLocaleString('ko-KR')}</h3><p><strong>참석자:</strong> </p><p><strong>안건:</strong> </p><p><strong>결정:</strong> </p><p><strong>액션:</strong> </p>`)

  const commands: Command[] = useMemo(() => {
    if (!editor) return []
    const ed = editor
    const memos = (list?.() || [])
    const memoCmds: Command[] = memos.slice(0, 20).map((m: any, i: number) => ({
      id: 'memo-' + m.id, cat: '메모', icon: 'file-text' as IconName,
      label: '메모: ' + (m.title || '제목없음'),
      desc: '최근 수정: ' + new Date(m.updatedAt || m.createdAt || Date.now()).toLocaleString('ko-KR'),
      hint: i < 9 ? `Ctrl+${i+1}` : undefined,
      run: () => setCurrent(m.id),
    }))
    return [
      /* 메모 */
      { id:'new', cat:'메모', icon:'file-plus', label:'새 메모', desc:'빈 메모를 새로 만듭니다.', hint:'Ctrl+N', run: () => newMemo() },
      { id:'dup', cat:'메모', icon:'star', label:'현재 메모 복제', desc:'현재 메모를 새 사본으로 복사합니다.', run: () => { const id = useMemosStore.getState().currentId; if (id) duplicate?.(id) } },
      { id:'pin', cat:'메모', icon:'pin', label:'핀 / 핀 해제', desc:'메모를 사이드바 상단에 고정합니다.', run: () => { const id = useMemosStore.getState().currentId; if (id) togglePin?.(id) } },
      ...memoCmds,
      /* 서식 */
      { id:'bold', cat:'서식', icon:'bold', label:'굵게', desc:'선택 텍스트를 두껍게 표시합니다.', hint:'Ctrl+B', run: () => ed.chain().focus().toggleBold().run() },
      { id:'italic', cat:'서식', icon:'italic', label:'기울임', desc:'선택 텍스트를 이탤릭체로.', hint:'Ctrl+I', run: () => ed.chain().focus().toggleItalic().run() },
      { id:'underline', cat:'서식', icon:'underline', label:'밑줄', desc:'선택 텍스트에 밑줄.', hint:'Ctrl+U', run: () => ed.chain().focus().toggleUnderline().run() },
      { id:'strike', cat:'서식', icon:'strike', label:'취소선', desc:'가운데 줄을 긋습니다.', run: () => ed.chain().focus().toggleStrike().run() },
      { id:'highlight', cat:'서식', icon:'highlight', label:'형광펜', desc:'노란색 형광펜 강조.', run: () => (ed.chain() as any).focus().toggleHighlight({ color: '#FFEB3B' }).run() },
      { id:'clear-fmt', cat:'서식', icon:'wand', label:'서식 지우기', desc:'모든 마크와 노드 서식 초기화.', run: () => ed.chain().focus().unsetAllMarks().clearNodes().run() },
      /* 제목 */
      { id:'h1', cat:'제목', icon:'h1', label:'제목 1', desc:'큰 제목 (H1).', hint:'Ctrl+Alt+1', run: () => ed.chain().focus().toggleHeading({ level: 1 }).run() },
      { id:'h2', cat:'제목', icon:'h2', label:'제목 2', desc:'중간 제목 (H2).', hint:'Ctrl+Alt+2', run: () => ed.chain().focus().toggleHeading({ level: 2 }).run() },
      { id:'h3', cat:'제목', icon:'h3', label:'제목 3', desc:'소제목 (H3).', hint:'Ctrl+Alt+3', run: () => ed.chain().focus().toggleHeading({ level: 3 }).run() },
      { id:'p', cat:'제목', icon:'paragraph', label:'일반 문단', desc:'제목 해제, 일반 문단으로.', run: () => ed.chain().focus().setParagraph().run() },
      /* 정렬 */
      { id:'left', cat:'정렬', icon:'align-left', label:'왼쪽 정렬', desc:'단락 왼쪽 정렬.', hint:'Ctrl+L', run: () => ed.chain().focus().setTextAlign('left').run() },
      { id:'center', cat:'정렬', icon:'align-center', label:'가운데 정렬', desc:'단락 가운데 정렬.', hint:'Ctrl+E', run: () => ed.chain().focus().setTextAlign('center').run() },
      { id:'right', cat:'정렬', icon:'align-right', label:'오른쪽 정렬', desc:'단락 오른쪽 정렬.', hint:'Ctrl+R', run: () => ed.chain().focus().setTextAlign('right').run() },
      { id:'justify', cat:'정렬', icon:'align-justify', label:'양쪽 정렬', desc:'양끝 정렬.', hint:'Ctrl+J', run: () => ed.chain().focus().setTextAlign('justify').run() },
      /* 리스트 */
      { id:'ul', cat:'리스트', icon:'list-bullet', label:'글머리 기호 목록', desc:'• 점 무순서 목록.', run: () => ed.chain().focus().toggleBulletList().run() },
      { id:'ol', cat:'리스트', icon:'list-numbered', label:'번호 매기기 목록', desc:'1. 2. 3. 순서 목록.', run: () => ed.chain().focus().toggleOrderedList().run() },
      { id:'task', cat:'리스트', icon:'list-check', label:'체크리스트', desc:'☐ 체크박스 할 일 목록.', run: () => (ed.chain() as any).focus().toggleList('taskList', 'taskItem').run() },
      { id:'quote', cat:'리스트', icon:'quote', label:'인용', desc:'왼쪽 줄 인용 블록.', run: () => ed.chain().focus().toggleBlockquote().run() },
      { id:'code', cat:'리스트', icon:'code', label:'코드 블록', desc:'고정폭 코드 블록.', run: () => ed.chain().focus().toggleCodeBlock().run() },
      /* 삽입 */
      { id:'table', cat:'삽입', icon:'table', label:'표 삽입 (3×3)', desc:'3행×3열 표.', run: () => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { id:'image', cat:'삽입', icon:'image', label:'이미지 (URL)', desc:'URL 로 이미지 삽입.', run: async () => { const u = await askText('이미지 URL:', '', { placeholder: 'https://...' }); if (u) ed.chain().focus().setImage({ src: u }).run() } },
      { id:'image-up', cat:'삽입', icon:'image', label:'이미지 업로드', desc:'로컬 파일 업로드.', run: () => { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=()=>{const f=i.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>ed.chain().focus().setImage({src:String(r.result)}).run(); r.readAsDataURL(f)}; i.click() } },
      { id:'link', cat:'삽입', icon:'link', label:'링크', desc:'하이퍼링크.', hint:'Ctrl+K', run: () => { const u = window.prompt('링크 URL:'); if (u) ed.chain().focus().setLink({ href: u }).run() } },
      { id:'hr', cat:'삽입', icon:'minus', label:'구분선', desc:'가로 구분선 (HR).', run: () => ed.chain().focus().setHorizontalRule().run() },
      { id:'hr-style', cat:'삽입', icon:'minus', label:'구분선 스타일', desc:'실선/점선/이중선/별표.', run: insertHrStyle },
      { id:'date', cat:'삽입', icon:'clock', label:'날짜/시간', desc:'현재 날짜·시간 삽입.', run: insertDateTime },
      { id:'page-break', cat:'삽입', icon:'page-break', label:'페이지 구분', desc:'인쇄 시 다음 페이지로.', hint:'Ctrl+Enter', run: insertPageBreak },
      { id:'callout-info', cat:'삽입', icon:'info', label:'콜아웃: 정보', desc:'파란 정보 알림 상자.', run: () => (ed.chain() as any).focus().setCallout('info').run() },
      { id:'callout-warn', cat:'삽입', icon:'bell', label:'콜아웃: 경고', desc:'주황 경고 상자.', run: () => (ed.chain() as any).focus().setCallout('warn').run() },
      { id:'callout-tip', cat:'삽입', icon:'sparkle', label:'콜아웃: 팁', desc:'초록 팁 상자.', run: () => (ed.chain() as any).focus().setCallout('tip').run() },
      { id:'math', cat:'삽입', icon:'hash', label:'수식 (LaTeX)', desc:'KaTeX 수식 블록.', run: async () => { const t = await askText('LaTeX 수식:', '', { placeholder: 'E = mc^2' }); if (t) (ed.chain() as any).focus().setMath(t).run() } },
      { id:'mermaid', cat:'삽입', icon:'hash', label:'다이어그램 (Mermaid)', desc:'Mermaid 다이어그램.', run: async () => { const c = await askText('Mermaid 다이어그램:', 'graph TD\n  A-->B', { multiline: true }); if (c) (ed.chain() as any).focus().setMermaid(c).run() } },
      { id:'embed', cat:'삽입', icon:'globe', label:'임베드 (URL)', desc:'YouTube/Vimeo 등 임베드.', run: async () => { const u = await askText('임베드 URL:'); if (u) (ed.chain() as any).focus().setEmbed(u).run() } },
      { id:'youtube', cat:'삽입', icon:'globe', label:'YouTube 영상', desc:'iframe 임베드.', run: insertYouTube },
      { id:'symbol', cat:'삽입', icon:'sparkle', label:'특수 문자', desc:'— … · ★ → 등.', run: insertSymbol },
      { id:'bookmark', cat:'삽입', icon:'pin', label:'책갈피', desc:'앵커 ID 책갈피.', run: insertBookmark },
      { id:'textbox', cat:'삽입', icon:'box', label:'텍스트 상자', desc:'테두리 + 배경 박스.', run: insertTextBox },
      /* 논문 */
      { id:'authors', cat:'논문', icon:'user', label:'저자 · 소속 · 교신', desc:'논문 저자 블록 삽입.', run: insertAuthorBlock },
      { id:'abstract', cat:'논문', icon:'file-text', label:'Abstract 박스', desc:'회색 ABSTRACT 박스.', run: insertAbstract },
      { id:'keywords', cat:'논문', icon:'hash', label:'Keywords 블록', desc:'키워드 인라인 한 줄.', run: insertKeywords },
      { id:'toc', cat:'논문', icon:'list-bullet', label:'TOC (목차) 자동 생성', desc:'헤딩 기반 목차 패널 토글.', run: () => p.onToggleOutline?.() },
      { id:'ack', cat:'논문', icon:'star', label:'Acknowledgments', desc:'감사의 말 섹션.', run: insertAck },
      { id:'2col', cat:'논문', icon:'columns', label:'2단 레이아웃 토글', desc:'본문 2단 표시.', run: toggleTwoCol },
      { id:'run-header', cat:'논문', icon:'pin', label:'러닝 헤더 · 꼬리말', desc:'페이지 상단 헤더 텍스트.', run: setRunHeader },
      { id:'footnote', cat:'논문', icon:'sup', label:'각주 삽입', desc:'<sup>[N]</sup> + 문서 끝 footnote.', run: insertFootnote },
      { id:'citation', cat:'논문', icon:'quote', label:'인용 삽입', desc:'<sup>(저자, 연도)</sup>.', run: insertCitation },
      { id:'reference', cat:'논문', icon:'file-text', label:'참고문헌 항목', desc:'hanging-indent 참고문헌.', run: insertReference },
      { id:'renumber', cat:'논문', icon:'hash', label:'번호 재정렬', desc:'각주 번호 1,2,3 재할당.', run: renumberFn },
      { id:'paper-mode', cat:'논문', icon:'file-text', label:'논문 모드 패널', desc:'Science 포맷 논문 패널.', run: () => p.onPaper?.() },
      /* 타이포 */
      { id:'letter-sp', cat:'타이포', icon:'sliders', label:'자간 설정', desc:'letter-spacing em 단위.', run: setLetterSpacing },
      { id:'char-scale', cat:'타이포', icon:'sliders', label:'장평 설정', desc:'transform: scaleX 글자 폭.', run: setCharScale },
      { id:'first-indent', cat:'타이포', icon:'paragraph', label:'첫 줄 들여쓰기', desc:'단락 첫 줄 1.5em 들여쓰기.', run: toggleFirstIndent },
      { id:'para-space', cat:'타이포', icon:'paragraph', label:'단락 간격', desc:'단락 위/아래 margin em.', run: setParaSpace },
      { id:'text-effect', cat:'타이포', icon:'sparkle', label:'글자 효과', desc:'그림자/네온/조각.', run: setTextEffect },
      { id:'highlight-box', cat:'타이포', icon:'highlight', label:'강조 배경 상자', desc:'노랑 배경 강조 박스.', run: insertHighlightBox },
      { id:'typo-modal', cat:'타이포', icon:'palette', label:'타이포그래피 패널', desc:'폰트/줄간격 조정.', run: () => p.onTypo?.() },
      /* 페이지 */
      { id:'page-size', cat:'페이지', icon:'page', label:'페이지 크기', desc:`${ui.pageSize} · ${currentOrientationLabel}.`, run: openPageSettings },
      { id:'paper-style', cat:'페이지', icon:'page', label:'노트 배경 스타일', desc:currentPaperLabel, run: openPageSettings },
      { id:'page-margin', cat:'페이지', icon:'page', label:'페이지 여백', desc:`${ui.pageMarginMm}mm.`, run: openPageSettings },
      { id:'pilcrow', cat:'페이지', icon:'paragraph', label:'엔터 표시 ¶ 켬/끔', desc:'단락 끝 ¶ 표시.', run: togglePilcrow },
      { id:'print-prev', cat:'페이지', icon:'preview', label:'인쇄 미리보기', desc:'Paged.js 페이지 미리보기.', hint:'Ctrl+Alt+P', run: () => p.onPrintPreview?.() },
      { id:'print', cat:'페이지', icon:'print', label:'인쇄', desc:'브라우저 인쇄.', hint:'Ctrl+P', run: () => window.print() },
      /* 미디어 */
      { id:'screen-cap', cat:'미디어', icon:'preview', label:'화면 캡쳐', desc:'getDisplayMedia 화면 캡쳐.', run: captureScreen },
      { id:'voice-input', cat:'미디어', icon:'mic', label:'음성 입력', desc:'Web Speech API 받아쓰기.', run: startVoice },
      { id:'tts', cat:'미디어', icon:'volume', label:'읽어주기 (TTS)', desc:'speechSynthesis 음성 출력.', run: speakSel },
      { id:'meet-tpl', cat:'미디어', icon:'users', label:'회의 노트 템플릿', desc:'안건/결정/액션 템플릿.', run: insertMeetingTpl },
      { id:'ai-img', cat:'미디어', icon:'sparkle', label:'AI 이미지 생성', desc:'Pollinations 이미지 생성.', run: aiImage },
      { id:'paint', cat:'미디어', icon:'paint', label:'그림판', desc:'캔버스 그림판 모달.', run: () => p.onPaint?.() },
      { id:'postit', cat:'미디어', icon:'pin', label:'포스트잇 (JustPin)', desc:'포스트잇 메모.', run: () => p.onPostit?.() },
      /* 도구 */
      { id:'wordcloud', cat:'도구', icon:'sparkle', label:'워드 클라우드', desc:'단어 빈도 클라우드 새 창.', run: wordCloud },
      { id:'flashcards', cat:'도구', icon:'cards', label:'플래시카드', desc:'제목별 Q/A 학습.', run: flashcards },
      { id:'pomodoro', cat:'도구', icon:'clock', label:'포모도로 타이머', desc:'25분 집중 타이머.', run: startPomo },
      { id:'business-cards', cat:'도구', icon:'cards', label:'명함 관리', desc:'연락처 저장 · 검색 · vCard/CSV 내보내기.', run: () => p.onCards?.() },
      { id:'spell', cat:'도구', icon:'check', label:'맞춤법 검사 토글', desc:'spellcheck 켬/끔.', run: toggleSpellCheck },
      { id:'web', cat:'도구', icon:'globe', label:'웹 검색', desc:'구글에서 키워드 검색.', run: webSearch },
      { id:'ai', cat:'도구', icon:'ai', label:'AI 어시스턴트', desc:'AI 도우미 모달.', hint:'Ctrl+/', run: () => p.onAi?.() },
      { id:'chat', cat:'도구', icon:'ai', label:'AI 챗 패널', desc:'AI 채팅 사이드 패널.', run: () => p.onChat?.() },
      { id:'search', cat:'도구', icon:'search', label:'전체 검색', desc:'모든 메모 검색.', hint:'Ctrl+Shift+F', run: () => p.onSearch?.() },
      { id:'find', cat:'도구', icon:'replace', label:'찾아 바꾸기', desc:'단어 일괄 교체.', hint:'Ctrl+H', run: () => p.onFind?.() },
      { id:'link-check', cat:'도구', icon:'unlink', label:'깨진 링크 검사', desc:'404 링크 찾기.', run: () => p.onLinkCheck?.() },
      { id:'stats', cat:'도구', icon:'hash', label:'통계 / 대시보드', desc:'메모 통계 대시보드.', run: () => p.onStats?.() },
      { id:'heatmap', cat:'도구', icon:'hash', label:'활동 히트맵', desc:'GitHub 스타일 활동 시각화.', run: () => p.onHeatmap?.() },
      { id:'info', cat:'도구', icon:'info', label:'메모 정보', desc:'현재 메모 통계.', run: () => p.onInfo?.() },
      { id:'diff', cat:'도구', icon:'replace', label:'메모 비교 (diff)', desc:'두 메모 차이 비교.', run: () => p.onDiff?.() },
      { id:'translate', cat:'도구', icon:'translate', label:'번역', desc:'한↔영 번역.', run: () => p.onTranslate?.() },
      { id:'mindmap', cat:'도구', icon:'sparkle', label:'마인드맵', desc:'노드 트리 시각화.', run: () => p.onMindMap?.() },
      { id:'ocr', cat:'도구', icon:'image-text', label:'OCR (이미지 → 텍스트)', desc:'이미지에서 텍스트 추출.', run: () => p.onOcr?.() },
      { id:'roles', cat:'도구', icon:'briefcase', label:'내 도구 / 역할 팩', desc:'역할 선택·전용 도구·템플릿.', run: () => p.onRoles?.() },
      { id:'templates', cat:'도구', icon:'file-text', label:'템플릿', desc:'학술/문서 템플릿.', run: () => p.onTemplates?.() },
      { id:'snippets', cat:'도구', icon:'file-plus', label:'스니펫', desc:'재사용 텍스트 스니펫.', run: () => p.onSnippets?.() },
      { id:'macros', cat:'도구', icon:'wand', label:'매크로', desc:'반복 작업 매크로.', run: () => p.onMacros?.() },
      { id:'help', cat:'도구', icon:'help', label:'도움말 / 단축키', desc:'F1 단축키 + 가이드.', hint:'F1', run: () => p.onHelp?.() },
      /* 보기 */
      { id:'focus', cat:'보기', icon:'eye', label:'집중 모드', desc:'사이드바·툴바 숨김.', hint:'F11', run: toggleFocus },
      { id:'reading', cat:'보기', icon:'preview', label:'읽기 모드', desc:'편집 비활성, 가독성 향상.', hint:'Shift+F11', run: toggleReading },
      { id:'sidebar', cat:'보기', icon:'list-bullet', label:'사이드바 토글', desc:'메모 목록 열기/접기.', run: toggleSidebar },
      { id:'layout-print', cat:'보기', icon:'page', label:'인쇄 레이아웃', desc:'A4/A3/B4 종이와 여백을 실제 페이지처럼 표시.', run: () => ui.setViewLayout('print') },
      { id:'layout-draft', cat:'보기', icon:'file-text', label:'초안 레이아웃', desc:'페이지 경계 없이 긴 문서를 빠르게 편집.', run: () => ui.setViewLayout('draft') },
      { id:'layout-toggle', cat:'보기', icon:'preview', label:`문서 보기 전환 (${ui.viewLayout === 'draft' ? '초안' : '인쇄'})`, desc:'인쇄 레이아웃과 초안 레이아웃을 전환.', run: () => ui.setViewLayout(ui.viewLayout === 'draft' ? 'print' : 'draft') },
      { id:'rulers', cat:'보기', icon:'columns', label:`눈금자 ${ui.showRulers ? '숨기기' : '표시'}`, desc:'가로/세로 페이지 눈금자를 표시하거나 숨김.', run: toggleRulers },
      { id:'zoom-in', cat:'보기', icon:'zoom-in', label:'줌 인', desc:'본문 +10%.', hint:'Ctrl+=', run: zoomIn },
      { id:'zoom-out', cat:'보기', icon:'zoom-out', label:'줌 아웃', desc:'본문 -10%.', hint:'Ctrl+-', run: zoomOut },
      { id:'zoom-reset', cat:'보기', icon:'refresh-cw', label:'줌 리셋 (100%)', desc:'기본 크기로.', hint:'Ctrl+0', run: zoomReset },
      { id:'zoom-fit-width', cat:'보기', icon:'maximize', label:'페이지 너비에 맞춤', desc:'현재 창 폭에 종이를 맞춤.', run: () => fitPageZoom('width') },
      { id:'zoom-fit-page', cat:'보기', icon:'page', label:'한 페이지 보기', desc:'페이지 전체가 보이도록 축소/확대.', run: () => fitPageZoom('page') },
      { id:'zoom-75', cat:'보기', icon:'zoom-out', label:'줌 75%', desc:'문서를 75%로 표시.', run: () => setPageZoom(0.75) },
      { id:'zoom-125', cat:'보기', icon:'zoom-in', label:'줌 125%', desc:'문서를 125%로 표시.', run: () => setPageZoom(1.25) },
      { id:'theme', cat:'보기', icon: theme==='dark'?'moon':theme==='light'?'sun':'auto', label:`테마 변경 (현재: ${theme})`, desc:'라이트→다크→자동 순환.', run: cycleTheme },
      { id:'h-num', cat:'보기', icon:'hash', label:'제목 번호 매기기', desc:'1, 1.1, 1.1.1 자동 번호.', run: toggleHeadingNumbers },
      { id:'md-prev', cat:'보기', icon:'preview', label:'Markdown 미리보기', desc:'MD 렌더링 미리보기.', run: () => p.onMd?.() },
      /* 편집 */
      { id:'undo', cat:'편집', icon:'undo', label:'실행 취소', desc:'마지막 변경 되돌리기.', hint:'Ctrl+Z', run: () => ed.chain().focus().undo().run() },
      { id:'redo', cat:'편집', icon:'redo', label:'다시 실행', desc:'되돌린 변경 복원.', hint:'Ctrl+Shift+Z', run: () => ed.chain().focus().redo().run() },
      { id:'select-all', cat:'편집', icon:'check', label:'모두 선택', desc:'본문 전체 선택.', hint:'Ctrl+A', run: () => ed.chain().focus().selectAll().run() },
      /* 파일 */
      { id:'save', cat:'파일', icon:'save', label:'저장', desc:'현재 메모를 파일로.', hint:'Ctrl+S', run: () => p.onSave?.() },
      { id:'open', cat:'파일', icon:'open', label:'열기', desc:'파일에서 메모 불러오기.', hint:'Ctrl+O', run: () => p.onOpen?.() },
      { id:'export-pdf', cat:'파일', icon:'print', label:'PDF로 내보내기', desc:'인쇄 → "PDF로 저장" 선택.', run: exportPdf },
      { id:'export-docx', cat:'파일', icon:'download', label:'Word(.docx) 내보내기', desc:'Word/한글에서 열림.', run: exportDocx },
      { id:'export-html', cat:'파일', icon:'globe', label:'HTML로 내보내기', desc:'브라우저용 독립 파일.', run: exportHtml },
      { id:'export-md', cat:'파일', icon:'file-text', label:'Markdown(.md) 저장', desc:'plain text 마크다운.', run: exportMd },
      { id:'export-hwpx', cat:'파일', icon:'file-text', label:'HWPX (한글) 내보내기', desc:'한글 문서 파일.', run: exportHwpx },
      { id:'gist', cat:'파일', icon:'cloud', label:'GitHub Gist', desc:'Gist 로 업로드 공유.', run: () => p.onGist?.() },
      { id:'share', cat:'파일', icon:'link', label:'공유 링크', desc:'단축 링크 생성.', run: () => p.onShare?.() },
      { id:'json-backup', cat:'파일', icon:'cloud', label:'JSON 백업', desc:'모든 메모 JSON 백업.', run: jsonBackup },
      { id:'attach', cat:'파일', icon:'paperclip', label:'파일 첨부', desc:'파일 첨부 패널.', run: () => p.onAtt?.() },
      { id:'lock', cat:'파일', icon:'lock', label:'잠금 / 비밀번호', desc:'메모 비밀번호 설정.', run: () => p.onLock?.() },
      { id:'versions', cat:'파일', icon:'history', label:'버전 기록', desc:'자동 저장 버전 + 복원.', run: () => p.onVersions?.() },
      { id:'about', cat:'파일', icon:'info', label:'정보 / 버전', desc:'앱 버전 + 변경 내역.', run: () => p.onAbout?.() },
      { id:'settings', cat:'파일', icon:'settings', label:'설정', desc:'앱 환경 설정.', hint:'Ctrl+,', run: () => p.onSettings?.() },
      /* 빠른 입력 */
      { id:'quick', cat:'빠른 입력', icon:'plus', label:'빠른 메모', desc:'팝오버 빠른 메모.', hint:'Ctrl+Shift+J', run: () => p.onQuick?.() },
    ]
  }, [editor, list, newMemo, duplicate, togglePin, setCurrent, toggleFocus, zoomIn, zoomOut, zoomReset, toggleSidebar, toggleHeadingNumbers, toggleReading, toggleSpellCheck, toggleRulers, theme, p, ui.showRulers, ui.viewLayout, ui.setViewLayout])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      (c.desc || '').toLowerCase().includes(q) ||
      c.cat.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.hint || '').toLowerCase().includes(q)
    )
  }, [query, commands])

  const groups = useMemo(() => {
    const m: Record<string, Command[]> = {}
    filtered.forEach(c => { (m[c.cat] = m[c.cat] || []).push(c) })
    return m
  }, [filtered])

  useEffect(() => { setSelected(0) }, [query])

  if (!open) return null

  const flat = filtered
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = flat[selected]
      if (cmd) { cmd.run(); setOpen(false); setQuery('') }
    }
  }

  let runningIdx = 0
  return (
    <div className="jan-cp-overlay-soft">
      <div className="jan-cp" role="dialog" aria-label="명령 팔레트">
        <div className="jan-cp-header">
          <input
            type="text"
            className="jan-cp-input"
            autoFocus
            placeholder={`명령 검색... (예: 캘린더, 새 탭, 테마)`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button className="jan-cp-close" onClick={() => setOpen(false)} title="닫기 (Esc)" aria-label="닫기">×</button>
        </div>
        <div className="jan-cp-list">
          {flat.length === 0 && <div className="jan-cp-empty">검색 결과 없음</div>}
          {Object.entries(groups).map(([cat, cmds]) => (
            <div key={cat} className="jan-cp-group">
              <div className="jan-cp-group-label">{cat} <span className="jan-cp-group-count">{cmds.length}</span></div>
              {cmds.map((cmd) => {
                const i = runningIdx++
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    className={'jan-cp-item' + (i === selected ? ' is-selected' : '')}
                    onClick={() => { cmd.run(); setOpen(false); setQuery('') }}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <span className="jan-cp-icon"><Icon name={cmd.icon} size={20} /></span>
                    <span className="jan-cp-text">
                      <span className="jan-cp-label">{cmd.label}</span>
                      {cmd.desc && <span className="jan-cp-desc">{cmd.desc}</span>}
                    </span>
                    {cmd.hint && <span className="jan-cp-hint">{cmd.hint}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="jan-cp-footer">
          ↑↓ 이동 · Enter 실행 · Esc 닫기 · {commands.length}개 명령
        </div>
      </div>
    </div>
  )
}

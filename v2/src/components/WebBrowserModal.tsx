import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { Icon } from './Icons'
import { sanitizeUntrustedHtml, escapeHtmlText } from '../lib/sanitizeHtml'

interface WebBrowserModalProps {
  editor: Editor | null
  onClose: () => void
}

interface ResultItem { title: string; url: string; snippet: string }
interface PreviewData { url: string; title: string; html: string; images: string[]; tables: string[]; text: string }

const fetchViaProxy = async (target: string): Promise<string> => {
  const r = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(target))
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const t = await r.text()
  if (t.length < 100) throw new Error('짧은 응답')
  return t
}

/* === 검색엔진 정의 — 각자의 URL + parse 함수 === */
type Engine = { label: string; searchUrl: (q: string) => string; parse: (doc: Document, q: string) => ResultItem[] }

const ENGINES: Record<string, Engine> = {
  google: {
    label: 'Google',
    searchUrl: (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q) + '&hl=ko&gbv=1',
    parse: (doc) => {
      /* Google 의 noscript HTML — /url?q= 리다이렉트 링크 파싱 */
      const items: ResultItem[] = []
      doc.querySelectorAll('a[href*="/url?q="], a[href*="/url?sa="]').forEach((a) => {
        const href = (a as HTMLAnchorElement).getAttribute('href') || ''
        const m = href.match(/[?&]q=([^&]+)/) || href.match(/[?&]url=([^&]+)/)
        if (!m) return
        const url = decodeURIComponent(m[1])
        if (!url.startsWith('http') || url.includes('google.com')) return
        const title = (a.textContent || '').trim()
        if (!title || title.length < 3) return
        /* 부모/형제에서 snippet 추출 */
        let snippet = ''
        let n = a.parentElement
        for (let i = 0; i < 3 && n; i++) {
          const txt = (n.textContent || '').replace(title, '').trim().slice(0, 200)
          if (txt.length > 30) { snippet = txt; break }
          n = n.parentElement
        }
        items.push({ title, url, snippet })
      })
      /* 중복 URL 제거 */
      const seen = new Set<string>()
      return items.filter(r => { if (seen.has(r.url)) return false; seen.add(r.url); return true }).slice(0, 15)
    },
  },
  bing: {
    label: 'Bing',
    searchUrl: (q) => 'https://www.bing.com/search?q=' + encodeURIComponent(q) + '&setlang=ko',
    parse: (doc) => Array.from(doc.querySelectorAll('li.b_algo')).map((el) => {
      const a = el.querySelector('h2 a') as HTMLAnchorElement
      return {
        title: (a?.textContent || '').trim(),
        url: a?.href || '',
        snippet: (el.querySelector('.b_caption p, .b_lineclamp2, .b_lineclamp3')?.textContent || '').trim(),
      }
    }).filter(r => r.title && r.url).slice(0, 15),
  },
  ddg: {
    label: 'DuckDuckGo',
    searchUrl: (q) => 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q),
    parse: (doc) => Array.from(doc.querySelectorAll('.result')).map((el) => {
      let url = (el.querySelector('.result__url') as HTMLAnchorElement)?.href || ''
      const m = url.match(/uddg=([^&]+)/); if (m) url = decodeURIComponent(m[1])
      return {
        title: (el.querySelector('.result__title')?.textContent || '').trim(),
        url: url.replace(/^\/\//, 'https://'),
        snippet: (el.querySelector('.result__snippet')?.textContent || '').trim(),
      }
    }).filter(r => r.title && r.url).slice(0, 15),
  },
  naver: {
    label: '네이버',
    searchUrl: (q) => 'https://search.naver.com/search.naver?query=' + encodeURIComponent(q),
    parse: (doc) => {
      const items: ResultItem[] = []
      doc.querySelectorAll('.total_tit, .api_txt_lines.total_tit, .news_tit, a.link_tit').forEach((a) => {
        const title = (a.textContent || '').trim()
        const url = (a as HTMLAnchorElement).href || ''
        if (title.length < 3 || !url.startsWith('http')) return
        items.push({ title, url, snippet: '' })
      })
      const seen = new Set<string>()
      return items.filter(r => { if (seen.has(r.url)) return false; seen.add(r.url); return true }).slice(0, 15)
    },
  },
  yt: {
    label: '유튜브',
    searchUrl: (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q),
    parse: (doc) => {
      /* YouTube 는 JSON-in-script. 단순 텍스트로 추출 */
      const html = doc.documentElement.outerHTML
      const items: ResultItem[] = []
      const re = /"videoId":"([\w-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"/g
      let m: RegExpExecArray | null
      const seen = new Set<string>()
      while ((m = re.exec(html)) && items.length < 15) {
        if (seen.has(m[1])) continue; seen.add(m[1])
        items.push({
          title: m[2].replace(/\\u[0-9a-fA-F]{4}/g, (s) => String.fromCharCode(parseInt(s.slice(2), 16))),
          url: `https://www.youtube.com/watch?v=${m[1]}`,
          snippet: '동영상',
        })
      }
      return items
    },
  },
  wiki: {
    label: 'Wikipedia',
    searchUrl: (q) => 'https://ko.wikipedia.org/w/api.php?action=opensearch&search=' + encodeURIComponent(q) + '&limit=15&format=json&origin=*',
    parse: (doc) => {
      try {
        const data = JSON.parse(doc.body.textContent || '[]')
        const titles = data[1] || [], descs = data[2] || [], urls = data[3] || []
        return titles.map((t: string, i: number) => ({ title: t, url: urls[i] || '', snippet: descs[i] || '' }))
      } catch { return [] }
    },
  },
  namu: {
    label: '나무위키',
    searchUrl: (q) => 'https://namu.wiki/Search?q=' + encodeURIComponent(q),
    parse: (doc) => {
      const items: ResultItem[] = []
      doc.querySelectorAll('a').forEach((a) => {
        const href = (a as HTMLAnchorElement).getAttribute('href') || ''
        if (!href.startsWith('/w/')) return
        const title = (a.textContent || '').trim()
        if (title.length < 2 || title.length > 80) return
        items.push({ title, url: 'https://namu.wiki' + href, snippet: '' })
      })
      const seen = new Set<string>()
      return items.filter(r => { if (seen.has(r.url)) return false; seen.add(r.url); return true }).slice(0, 15)
    },
  },
  gh: {
    label: 'GitHub',
    searchUrl: (q) => 'https://github.com/search?q=' + encodeURIComponent(q) + '&type=repositories',
    parse: (doc) => Array.from(doc.querySelectorAll('article, [data-testid="results-list"] li')).map((el) => {
      const a = el.querySelector('a[href*="/"]') as HTMLAnchorElement
      return {
        title: (a?.textContent || el.textContent || '').trim().slice(0, 80),
        url: a?.href || '',
        snippet: (el.querySelector('p')?.textContent || '').trim().slice(0, 200),
      }
    }).filter(r => r.title && r.url).slice(0, 15),
  },
  so: {
    label: 'StackOverflow',
    searchUrl: (q) => 'https://stackoverflow.com/search?q=' + encodeURIComponent(q),
    parse: (doc) => Array.from(doc.querySelectorAll('.s-post-summary')).map((el) => {
      const a = el.querySelector('h3 a, .s-post-summary--content-title a') as HTMLAnchorElement
      return {
        title: (a?.textContent || '').trim(),
        url: a?.href ? (a.href.startsWith('http') ? a.href : 'https://stackoverflow.com' + a.getAttribute('href')) : '',
        snippet: (el.querySelector('.s-post-summary--content-excerpt')?.textContent || '').trim(),
      }
    }).filter(r => r.title && r.url).slice(0, 15),
  },
}

/**
 * Phase 36 — 다중 검색엔진 + Google 지원.
 * 엔진 버튼 클릭 = 즉시 그 엔진으로 검색.
 */
export function WebBrowserModal({ editor, onClose }: WebBrowserModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [view, setView] = useState<'idle' | 'results' | 'preview'>('idle')
  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [selectedImgs, setSelectedImgs] = useState<Set<number>>(new Set())
  const [activeEngine, setActiveEngine] = useState<string>('google')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const insertHTML = (html: string) => editor?.chain().focus().insertContent(html).run()

  /* 검색 — engine 과 query 를 명시적으로 받음 (state stale 방지) */
  const search = async (engineKey: string, q: string) => {
    const Q = q.trim()
    if (!Q) { setStatusMsg('검색어를 입력하세요'); return }
    const engine = ENGINES[engineKey]
    if (!engine) return
    setActiveEngine(engineKey)
    setQuery(Q)
    setBusy(true)
    setStatusMsg(`${engine.label} 에서 "${Q}" 검색 중...`)
    setResults([]); setPreview(null); setView('results')
    try {
      let html = ''
      try { html = await fetchViaProxy(engine.searchUrl(Q)) } catch {}
      let doc = new DOMParser().parseFromString(html, 'text/html')
      let items = engine.parse(doc, Q)
      let usedEngine = engine.label
      /* 차단된 엔진 (Google/Naver/Bing/YouTube) → DDG 폴백 (한국어 정확도 가장 좋음) */
      if (items.length === 0 && engineKey !== 'ddg' && engineKey !== 'wiki' && engineKey !== 'namu') {
        setStatusMsg(engine.label + ' 차단 — DuckDuckGo 폴백 시도...')
        try {
          html = await fetchViaProxy(ENGINES.ddg.searchUrl(Q))
          doc = new DOMParser().parseFromString(html, 'text/html')
          items = ENGINES.ddg.parse(doc, Q)
          if (items.length) usedEngine = 'DuckDuckGo (' + engine.label + ' 폴백)'
        } catch {}
      }
      /* DDG 도 실패면 Wikipedia 폴백 */
      if (items.length === 0 && engineKey !== 'wiki') {
        setStatusMsg('DuckDuckGo 도 실패 — Wikipedia 폴백 시도...')
        try {
          html = await fetchViaProxy(ENGINES.wiki.searchUrl(Q))
          doc = new DOMParser().parseFromString(html, 'text/html')
          items = ENGINES.wiki.parse(doc, Q)
          if (items.length) usedEngine = 'Wikipedia (' + engine.label + ' 폴백)'
        } catch {}
      }
      setResults(items)
      if (items.length) setStatusMsg(usedEngine + ': ' + items.length + '개 결과 — 클릭하면 본문 미리보기')
      else setStatusMsg(engine.label + ' 차단됨 — 우상단 [외부] 버튼으로 새 탭에서 검색')
    } catch (e: any) {
      setStatusMsg(engine.label + ' 실패: ' + e.message)
    } finally { setBusy(false) }
  }

  const loadResult = async (r: ResultItem) => {
    setBusy(true); setStatusMsg(`"${r.title.slice(0, 40)}" 본문 추출 중...`)
    try {
      const html = await fetchViaProxy(r.url)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      doc.querySelectorAll('script,style,iframe,form,nav[role=navigation],aside,.ad,.ads').forEach(e => e.remove())
      const article = (doc.querySelector('article, main, [role=main], .mw-parser-output, .markdown-body') || doc.body) as HTMLElement
      const text = (article.textContent || '').trim().slice(0, 5000)
      const images = Array.from(article.querySelectorAll('img')).map(i => (i as HTMLImageElement).src || (i as HTMLImageElement).getAttribute('data-src') || '').filter(s => s.startsWith('http'))
      const tables = Array.from(article.querySelectorAll('table')).map(t => t.outerHTML)
      // 원격 HTML 은 살균 후에만 보관 — 미리보기가 dangerouslySetInnerHTML 로 렌더된다
      setPreview({ url: r.url, title: doc.title || r.title, html: sanitizeUntrustedHtml(article.innerHTML.slice(0, 30000)), images, tables: tables.map(sanitizeUntrustedHtml), text })
      setSelectedImgs(new Set())
      setView('preview')
      setStatusMsg(`이미지 ${images.length}개 · 표 ${tables.length}개 발견`)
    } catch (e: any) {
      setStatusMsg('추출 실패: ' + e.message)
    } finally { setBusy(false) }
  }

  const backToResults = () => { setView('results'); setPreview(null) }
  const openExternal = (u?: string) => {
    const t = u || preview?.url || (query ? ENGINES[activeEngine].searchUrl(query) : '')
    if (t) window.open(t, '_blank', 'noopener,noreferrer')
  }

  /* === 노트 삽입 === */
  const insertLinkCard = (r?: ResultItem) => {
    const t = r ? r : (preview ? { title: preview.title, url: preview.url, snippet: preview.text.slice(0, 200) } : null)
    if (!t) return
    const safeUrl = escapeHtmlText(t.url)
    insertHTML(`<div style="border:1px solid #ddd;border-radius:8px;padding:1em;margin:1em 0;background:#fafafa;"><a href="${safeUrl}" target="_blank" style="font-weight:600;text-decoration:none;color:#1a73e8;font-size:1.05em;">${escapeHtmlText(t.title)}</a><div style="color:#666;font-size:0.9em;margin:0.4em 0;">${escapeHtmlText(t.snippet || '')}</div><div style="font-size:0.8em;color:#999;font-family:monospace;">${safeUrl}</div></div>`)
    setStatusMsg('링크 카드 삽입됨')
  }
  const insertReaderContent = () => {
    if (!preview) return
    insertHTML(`<h2>${escapeHtmlText(preview.title)}</h2>${preview.html}<p><em>출처: <a href="${escapeHtmlText(preview.url)}" target="_blank">${escapeHtmlText(preview.url)}</a></em></p>`)
    setStatusMsg('본문 삽입됨')
  }
  const insertSelectedImages = () => {
    if (!preview || !selectedImgs.size) return alert('이미지를 선택하세요')
    const html = Array.from(selectedImgs).map(i => `<img src="${preview.images[i]}" style="max-width:100%;margin:0.4em 0;" />`).join('')
    insertHTML(html + `<p><em>이미지 출처: <a href="${preview.url}" target="_blank">${preview.url}</a></em></p>`)
    setStatusMsg(`이미지 ${selectedImgs.size}개 삽입됨`)
  }
  const insertAllImages = () => {
    if (!preview || !preview.images.length) return
    const html = preview.images.map(s => `<img src="${s}" style="max-width:100%;margin:0.4em 0;" />`).join('')
    insertHTML(html + `<p><em>출처: <a href="${preview.url}" target="_blank">${preview.url}</a></em></p>`)
    setStatusMsg(`전체 이미지 ${preview.images.length}개 삽입됨`)
  }
  const insertTable = (i: number) => {
    if (!preview || !preview.tables[i]) return
    insertHTML(preview.tables[i] + `<p><em>표 출처: <a href="${preview.url}" target="_blank">${preview.url}</a></em></p>`)
    setStatusMsg(`표 #${i + 1} 삽입됨`)
  }
  const insertSnippet = () => {
    if (!preview) return
    const text = window.prompt('인용할 내용:', preview.text.slice(0, 300))
    if (text) insertHTML(`<blockquote style="border-left:3px solid #FAE100;padding:0.4em 0.8em;margin:0.8em 0;background:#FFFBE5;">${escapeHtmlText(text)}<br><cite style="font-size:0.85em;color:#888;">— <a href="${escapeHtmlText(preview.url)}" target="_blank">${escapeHtmlText(preview.title)}</a></cite></blockquote>`)
  }
  const toggleImg = (i: number) => {
    setSelectedImgs(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })
  }

  const submitSearch = () => {
    const q = inputRef.current?.value || query
    search(activeEngine, q)
  }

  return (
    <div className="jan-modal-bg" role="dialog" aria-label="웹 리서치" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="jan-web-browser">
        <div className="jan-wb-header">
          <h3><Icon name="globe" size={16} /><span>웹 리서치 — 검색 후 노트에 깨끗하게 삽입</span></h3>
          <button className="jan-wb-close" onClick={onClose} title="닫기 (Esc)" aria-label="닫기">×</button>
        </div>

        {/* 검색 바 */}
        <div className="jan-wb-toolbar">
          {view === 'preview' && <button className="jan-wb-btn" onClick={backToResults}><Icon name="chevron-left" /> 결과</button>}
          <input
            ref={inputRef}
            className="jan-wb-input"
            placeholder="검색어 입력 후 엔진 버튼 클릭 또는 Enter"
            defaultValue=""
            onKeyDown={(e) => { if (e.key === 'Enter') search(activeEngine, (e.target as HTMLInputElement).value) }}
          />
          <button className="jan-wb-btn primary" onClick={submitSearch} disabled={busy}>{busy ? '검색 중...' : '검색'}</button>
          <button className="jan-wb-btn" onClick={() => openExternal()} title="외부 브라우저"><Icon name="globe" /> 외부</button>
        </div>

        {/* 엔진 버튼들 */}
        <div className="jan-wb-engines">
          <span className="jan-wb-label">엔진:</span>
          {Object.entries(ENGINES).map(([k, e]) => (
            <button
              key={k}
              className={'jan-wb-btn small' + (activeEngine === k ? ' primary' : '')}
              onClick={() => { const q = inputRef.current?.value || query; if (q) search(k, q); else { setActiveEngine(k); inputRef.current?.focus() } }}
              title={`${e.label} 으로 검색`}
            >
              {e.label}
            </button>
          ))}
        </div>

        {/* 상태 */}
        {statusMsg && (
          <div className="jan-wb-research" style={{ background: busy ? '#fff8c4' : '#faf7ff' }}>
            <span className="jan-wb-label" style={{ color: '#6a4cbb' }}>상태:</span>
            <span style={{ fontSize: 12 }}>{statusMsg}</span>
          </div>
        )}

        {/* 본문 */}
        <div className="jan-wb-body">
          {view === 'idle' && (
            <div className="jan-wb-placeholder">
              <Icon name="globe" size={70} />
              <h4>웹 리서치 어시스턴트</h4>
              <p>검색어 입력 후 위의 엔진 버튼 (Google · Bing · DuckDuckGo · 네이버 · YouTube · Wikipedia · 나무위키 · GitHub · StackOverflow) 을 클릭하세요.</p>
              <p className="muted">결과 카드에서 [링크 카드] 즉시 삽입, [미리보기] 클릭 시 본문·이미지·표 선택 삽입.</p>
            </div>
          )}

          {view === 'results' && (
            <div className="jan-wb-results">
              {results.length === 0 && !busy && <div className="jan-wb-empty">결과 없음 — 다른 엔진을 시도해보세요</div>}
              {results.map((r, i) => (
                <div key={i} className="jan-wb-result-item">
                  <div className="jan-wb-result-main">
                    <a className="jan-wb-result-title" href={r.url} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); loadResult(r) }}>
                      {r.title}
                    </a>
                    {r.snippet && <div className="jan-wb-result-snippet">{r.snippet}</div>}
                    <div className="jan-wb-result-url">{r.url}</div>
                  </div>
                  <div className="jan-wb-result-actions">
                    <button className="jan-wb-btn small" onClick={() => loadResult(r)}><Icon name="file-text" size={12} /> 미리보기</button>
                    <button className="jan-wb-btn small action" onClick={() => insertLinkCard(r)}><Icon name="link" size={12} /> 링크 카드</button>
                    <button className="jan-wb-btn small" onClick={() => openExternal(r.url)}><Icon name="globe" size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'preview' && preview && (
            <div className="jan-wb-preview">
              <div className="jan-wb-preview-actions">
                <button className="jan-wb-btn primary" onClick={insertReaderContent}><Icon name="file-text" size={14} /> 본문 통째 삽입</button>
                <button className="jan-wb-btn action" onClick={() => insertLinkCard()}><Icon name="link" size={14} /> 링크 카드 삽입</button>
                <button className="jan-wb-btn action" onClick={insertSnippet}><Icon name="quote" size={14} /> 발췌 인용</button>
                <span style={{ flex: 1 }} />
                <button className="jan-wb-btn" onClick={() => openExternal(preview.url)}><Icon name="globe" /> 외부 열기</button>
              </div>
              <h2 className="jan-wb-preview-title">{preview.title}</h2>
              <div className="jan-wb-preview-url">{preview.url}</div>

              {preview.images.length > 0 && (
                <div className="jan-wb-section">
                  <div className="jan-wb-section-head">
                    <span><strong>이미지</strong> {preview.images.length}개 — 클릭으로 선택</span>
                    <button className="jan-wb-btn small" onClick={insertSelectedImages} disabled={!selectedImgs.size}>선택 {selectedImgs.size}개 삽입</button>
                    <button className="jan-wb-btn small action" onClick={insertAllImages}>전체 삽입</button>
                  </div>
                  <div className="jan-wb-img-grid">
                    {preview.images.slice(0, 24).map((src, i) => (
                      <div key={i} className={'jan-wb-img-cell' + (selectedImgs.has(i) ? ' selected' : '')} onClick={() => toggleImg(i)}>
                        <img src={src} alt="" loading="lazy" />
                        {selectedImgs.has(i) && <div className="jan-wb-img-check"><Icon name="check" size={16} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.tables.length > 0 && (
                <div className="jan-wb-section">
                  <div className="jan-wb-section-head"><span><strong>표</strong> {preview.tables.length}개</span></div>
                  <div className="jan-wb-tables">
                    {preview.tables.slice(0, 5).map((_, i) => (
                      <button key={i} className="jan-wb-btn small action" onClick={() => insertTable(i)}>표 #{i + 1} 삽입</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="jan-wb-section">
                <div className="jan-wb-section-head"><strong>본문 미리보기</strong> ({preview.text.length} 자)</div>
                <div className="jan-wb-preview-html" dangerouslySetInnerHTML={{ __html: preview.html }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { SYMBOL_TABLE, recentSymbols, rememberSymbol, searchSymbols } from '../lib/symbols'
import type { SymbolDef } from '../lib/symbols'

interface Props {
  editor: Editor | null
  onClose: () => void
}

/**
 * 문자표 — 워드 「기호」 대화상자, 한글 「문자표(Ctrl+F10)」.
 * 이름으로 찾고(한국어·영어 둘 다), 화살표로 옮겨 다니고, Enter 로 넣는다.
 * 최근에 쓴 것이 맨 위에 남는다.
 */
export function SymbolPanel({ editor, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState(SYMBOL_TABLE[0].key)
  const [recent, setRecent] = useState<string[]>(() => recentSymbols())
  const gridRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const items: SymbolDef[] = useMemo(() => {
    if (query.trim()) return searchSymbols(query)
    return SYMBOL_TABLE.find((g) => g.key === group)?.items ?? []
  }, [query, group])

  if (!editor) return null

  const put = (ch: string) => {
    editor.chain().focus().insertContent(ch).run()
    rememberSymbol(ch)
    setRecent(recentSymbols())
  }

  /** 화살표로 옮겨 다닌다 — 글자를 고를 때도 마우스가 필요 없다 */
  function onGridKey(e: React.KeyboardEvent) {
    const buttons = [...(gridRef.current?.querySelectorAll('button') ?? [])] as HTMLButtonElement[]
    if (!buttons.length) return
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const cols = Math.max(1, Math.floor((gridRef.current?.clientWidth || 420) / 44))
    let next: number
    if (e.key === 'ArrowRight') next = (i + 1) % buttons.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + buttons.length) % buttons.length
    else if (e.key === 'ArrowDown') next = Math.min(buttons.length - 1, i + cols)
    else if (e.key === 'ArrowUp') next = i - cols < 0 ? -1 : i - cols
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = buttons.length - 1
    else return
    e.preventDefault()
    if (next < 0) { inputRef.current?.focus(); return }
    buttons[next]?.focus()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="jan-modal jan-symdlg" role="dialog" aria-label="문자표" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>문자표</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-imgdlg-row">
            <label htmlFor="jan-sym-q">찾기</label>
            <input
              id="jan-sym-q" ref={inputRef} type="text" value={query}
              placeholder="이름으로 — 화살표 · arrow · 시그마 · U+2190"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                  e.preventDefault()
                  ;(gridRef.current?.querySelector('button') as HTMLButtonElement | null)?.focus()
                }
              }}
            />
          </div>

          {recent.length > 0 && !query.trim() && (
            <>
              <div className="jan-symdlg-cap">최근에 쓴 것</div>
              <div className="jan-symdlg-grid">
                {recent.map((ch, i) => (
                  <button key={ch + i} onClick={() => put(ch)} title={ch}>{ch}</button>
                ))}
              </div>
            </>
          )}

          {!query.trim() && (
            <div className="jan-shapedlg-groups" role="tablist">
              {SYMBOL_TABLE.map((g) => (
                <button
                  key={g.key} role="tab" aria-selected={group === g.key}
                  className={group === g.key ? 'is-active' : ''}
                  onClick={() => setGroup(g.key)}
                >{g.label}</button>
              ))}
            </div>
          )}

          <div className="jan-symdlg-grid jan-symdlg-main" ref={gridRef} onKeyDown={onGridKey}>
            {items.map((item, i) => (
              <button key={item.ch + i} onClick={() => put(item.ch)} title={`${item.ch} — ${item.name}`}>{item.ch}</button>
            ))}
          </div>
          {query.trim() && items.length === 0 && (
            <p className="jan-imgdlg-hint">찾는 글자가 없다. 이름 대신 코드로도 찾을 수 있다 — 보기: U+2190</p>
          )}
        </div>
      </div>
    </div>
  )
}

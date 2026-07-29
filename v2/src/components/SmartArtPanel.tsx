import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  DEFAULT_SMART, SMART_GROUPS, SMART_LAYOUTS, SMART_PALETTES, fitsWell, smartSvg,
} from '../lib/smartArt'
import type { SmartSpec } from '../lib/smartArt'

interface Props {
  editor: Editor | null
  mode: 'insert' | 'edit'
  onClose: () => void
}

/**
 * 스마트 도해 창 — 워드의 「SmartArt 그래픽 선택」 + 「텍스트 창」을 한 자리에.
 * 왼쪽에서 배치를 고르고 오른쪽 글 상자에 한 줄에 하나씩 적으면 그림이 곧바로 바뀐다.
 */
export function SmartArtPanel({ editor, mode, onClose }: Props) {
  const current = (editor?.getAttributes('janSmart').spec as SmartSpec) || null
  const [spec, setSpec] = useState<SmartSpec>(() => ({ ...DEFAULT_SMART, ...(mode === 'edit' && current ? current : {}) }))
  const [group, setGroup] = useState<string>(() => SMART_LAYOUTS.find((l) => l.key === (current?.layout || DEFAULT_SMART.layout))?.group || SMART_GROUPS[0])
  const [text, setText] = useState(() => ((mode === 'edit' && current ? current.items : DEFAULT_SMART.items) || []).join('\n'))
  const gridRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => text.split('\n').map((s) => s.trim()).filter(Boolean), [text])
  const live = useMemo<SmartSpec>(() => ({ ...spec, items: items.length ? items : ['항목'] }), [spec, items])
  const svg = useMemo(() => smartSvg(live), [live])
  const patch = (p: Partial<SmartSpec>) => setSpec((s) => ({ ...s, ...p }))

  const commit = () => {
    if (!editor) return
    if (mode === 'edit' && editor.isActive('janSmart')) editor.chain().focus().updateSmartArt(live).run()
    else editor.chain().focus().insertSmartArt(live).run()
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  })

  /** 갤러리 안을 화살표로 옮겨 다닌다 */
  const onGridKey = (e: React.KeyboardEvent) => {
    const buttons = [...(gridRef.current?.querySelectorAll('button') ?? [])] as HTMLButtonElement[]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    const cols = Math.max(1, Math.round((gridRef.current?.clientWidth || 300) / 104))
    let next: number
    if (e.key === 'ArrowRight') next = (i + 1) % buttons.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + buttons.length) % buttons.length
    else if (e.key === 'ArrowDown') next = Math.min(buttons.length - 1, i + cols)
    else if (e.key === 'ArrowUp') next = Math.max(0, i - cols)
    else return
    e.preventDefault()
    buttons[next]?.focus()
  }

  if (!editor) return null
  const shown = SMART_LAYOUTS.filter((l) => l.group === group)
  const chosen = SMART_LAYOUTS.find((l) => l.key === spec.layout)

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-smartdlg" role="dialog" aria-label="스마트 도해" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>{mode === 'edit' ? '스마트 도해 고치기' : '스마트 도해 넣기'}</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-imgdlg-tabs" role="tablist">
          {SMART_GROUPS.map((g) => (
            <button key={g} role="tab" aria-selected={group === g} className={group === g ? 'is-active' : ''} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>

        <div className="jan-modal-body jan-smartdlg-body">
          <div className="jan-smartdlg-gallery" ref={gridRef} onKeyDown={onGridKey} role="listbox" aria-label="배치">
            {shown.map((l) => (
              <button
                key={l.key}
                role="option"
                aria-selected={spec.layout === l.key}
                title={l.hint}
                className={spec.layout === l.key ? 'is-active' : ''}
                onClick={() => patch({ layout: l.key })}
              >
                <span className="jan-smartdlg-mini" dangerouslySetInnerHTML={{ __html: smartSvg({ ...live, layout: l.key, width: 96, height: 62, title: '' }) }} />
                <span>{l.label}</span>
              </button>
            ))}
          </div>

          <div className="jan-smartdlg-right">
            <div className="jan-smartdlg-preview" dangerouslySetInnerHTML={{ __html: svg }} />
            <label className="jan-chartdlg-field">
              <span>글 — 한 줄에 항목 하나</span>
              <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label="도해에 넣을 글" />
            </label>
            {chosen && !fitsWell(chosen.key, items.length) && (
              <p className="jan-smartdlg-warn">이 배치는 {chosen.best[0]}~{chosen.best[1]}개일 때 가장 보기 좋다 (지금 {items.length}개)</p>
            )}
            <div className="jan-chartdlg-opts">
              <label><span>제목</span><input value={spec.title || ''} onChange={(e) => patch({ title: e.target.value })} /></label>
              <label><span>색</span>
                <select value={spec.palette || '기본'} onChange={(e) => patch({ palette: e.target.value })}>
                  {Object.keys(SMART_PALETTES).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label><span>너비</span><input type="number" min={240} max={900} value={spec.width || 520} onChange={(e) => patch({ width: Math.max(240, Math.min(900, Number(e.target.value) || 520)) })} /></label>
              <label><span>높이</span><input type="number" min={120} max={600} value={spec.height || 200} onChange={(e) => patch({ height: Math.max(120, Math.min(600, Number(e.target.value) || 200)) })} /></label>
            </div>
          </div>
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">Ctrl+Enter — {mode === 'edit' ? '고치기' : '넣기'}</span>
          <button onClick={onClose}>취소</button>
          <button className="jan-primary" onClick={commit}>{mode === 'edit' ? '고치기' : '넣기'}</button>
        </div>
      </div>
    </div>
  )
}

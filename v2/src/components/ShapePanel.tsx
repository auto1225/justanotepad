import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { CLIPART, CLIPART_GROUPS, SHAPES, SHAPE_GROUPS, WORDART } from '../lib/shapeLibrary'
import {
  SHAPE_STYLES, applyShapeStyle, changeShape, currentShape, cycleTextDirection, cycleVAlign,
  insertShape, setShapeAttrs, setShapeFill, setShapeSize, setShapeStroke, setShapeText, setShapeWrap,
} from '../lib/shapeWord'

interface Props {
  editor: Editor | null
  mode: 'insert' | 'format'
  onClose: () => void
}

const KINDS = [
  { key: 'shape', label: '도형' },
  { key: 'icon', label: '아이콘 · 그리기마당' },
  { key: 'wordart', label: '글맵시 (WordArt)' },
  { key: 'textbox', label: '글상자' },
] as const

/**
 * 도형 갤러리와 도형 서식 — 워드의 「삽입 › 도형」 갤러리와 「도형 서식」 탭을 한 창에.
 *
 * 마우스로 고를 수 있는 것은 키보드로도 고를 수 있다: 화살표로 옮겨 다니고
 * Enter 로 넣는다. 갈래는 ←→ 로 바꾼다.
 */
export function ShapePanel({ editor, mode, onClose }: Props) {
  const hit = currentShape(editor)
  const [kind, setKind] = useState<string>(mode === 'format' && hit ? String(hit.node.attrs.kind || 'shape') : 'shape')
  const [group, setGroup] = useState<string>(SHAPE_GROUPS[0])
  const gridRef = useRef<HTMLDivElement>(null)
  const [, force] = useState(0)
  const redraw = () => force((n) => n + 1)
  const run = (fn: () => unknown) => { fn(); setTimeout(redraw, 0) }

  useEffect(() => {
    const first = gridRef.current?.querySelector('button') as HTMLButtonElement | null
    first?.focus()
  }, [kind, group])

  if (!editor) return null
  const attrs = (hit?.node.attrs || {}) as Record<string, unknown>

  /** 갤러리 안을 화살표로 옮겨 다닌다 */
  function onGridKey(e: React.KeyboardEvent) {
    const buttons = [...(gridRef.current?.querySelectorAll('button') ?? [])] as HTMLButtonElement[]
    if (!buttons.length) return
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const cols = Math.max(1, Math.round((gridRef.current?.clientWidth || 400) / 92))
    let next: number
    if (e.key === 'ArrowRight') next = (i + 1) % buttons.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + buttons.length) % buttons.length
    else if (e.key === 'ArrowDown') next = Math.min(buttons.length - 1, i + cols)
    else if (e.key === 'ArrowUp') next = Math.max(0, i - cols)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = buttons.length - 1
    else return
    e.preventDefault()
    buttons[next]?.focus()
  }

  const pick = (shapeKey: string) => {
    if (mode === 'format' && hit) { changeShape(editor, shapeKey); onClose(); return }
    insertShape(editor, kind as 'shape' | 'textbox' | 'icon' | 'wordart', shapeKey)
    onClose()
  }

  const items =
    kind === 'shape' ? SHAPES.filter((s) => s.group === group)
      : kind === 'icon' ? CLIPART.filter((c) => c.group === group)
        : kind === 'wordart' ? WORDART
          : []

  const groups = kind === 'shape' ? SHAPE_GROUPS : kind === 'icon' ? CLIPART_GROUPS : []

  return (
    <div className="jan-modal-overlay" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="jan-modal jan-shapedlg" role="dialog" aria-label={mode === 'insert' ? '도형 넣기' : '도형 서식'} onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>{mode === 'insert' ? '도형 · 아이콘 · 글맵시 · 글상자 넣기' : '도형 서식'}</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-imgdlg-tabs" role="tablist">
          {KINDS.map((k) => (
            <button
              key={k.key}
              role="tab"
              aria-selected={kind === k.key}
              className={kind === k.key ? 'is-active' : ''}
              onClick={() => { setKind(k.key); setGroup(k.key === 'icon' ? CLIPART_GROUPS[0] : SHAPE_GROUPS[0]) }}
            >{k.label}</button>
          ))}
        </div>

        <div className="jan-modal-body jan-shapedlg-body">
          {kind === 'textbox' ? (
            <div className="jan-imgdlg-row">
              <button onClick={() => { insertShape(editor, 'textbox', 'rect'); onClose() }}>가로 글상자 넣기</button>
              <button onClick={() => { insertShape(editor, 'textbox', 'rect', { textDir: 'vertical', width: 140, height: 260 }); onClose() }}>세로 글상자 넣기 (세로쓰기)</button>
              <p className="jan-imgdlg-hint">글상자는 도형과 같은 규칙으로 움직인다 — 배치·회전·감싸기가 모두 된다.</p>
            </div>
          ) : (
            <>
              {groups.length > 0 && (
                <div className="jan-shapedlg-groups" role="tablist">
                  {groups.map((g) => (
                    <button key={g} role="tab" aria-selected={group === g} className={group === g ? 'is-active' : ''} onClick={() => setGroup(g)}>{g}</button>
                  ))}
                </div>
              )}
              <div className="jan-shapedlg-grid" ref={gridRef} onKeyDown={onGridKey}>
                {items.map((item) => (
                  <button key={item.key} title={item.label} onClick={() => pick(item.key)}>
                    <svg viewBox={kind === 'wordart' ? '0 0 400 120' : '0 0 100 100'} aria-hidden="true">
                      {kind === 'wordart' ? (
                        'path' in item && item.path ? (
                          <>
                            <path id={`p-${item.key}`} d={item.path as string} fill="none" />
                            <text fontSize="46" fontWeight="700" fill="currentColor">
                              <textPath href={`#p-${item.key}`} startOffset="50%" textAnchor="middle">가나다</textPath>
                            </text>
                          </>
                        ) : (
                          <text x="200" y="76" fontSize="46" fontWeight="700" textAnchor="middle" fill="currentColor">가나다</text>
                        )
                      ) : (
                        <path
                          d={(item as { path: string }).path}
                          fill={kind === 'icon' || (item as { lineOnly?: boolean }).lineOnly ? 'none' : 'currentColor'}
                          fillOpacity={kind === 'icon' ? 0 : 0.18}
                          stroke="currentColor"
                          strokeWidth={kind === 'icon' ? 5 : 3}
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>
                    <small>{item.label}</small>
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === 'format' && hit && (
            <>
              <div className="jan-imgdlg-row">
                <label htmlFor="jan-shape-text">글</label>
                <input
                  id="jan-shape-text" type="text" defaultValue={String(attrs.text || '')}
                  onBlur={(e) => run(() => setShapeText(editor, e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setShapeText(editor, (e.target as HTMLInputElement).value); onClose() } }}
                />
              </div>
              <div className="jan-imgdlg-row">
                <label>도형 스타일</label>
                {SHAPE_STYLES.map((st) => (
                  <button
                    key={st.key} title={st.label}
                    style={{ background: st.fill, borderColor: st.stroke, color: st.textColor, minWidth: 30 }}
                    onClick={() => run(() => applyShapeStyle(editor, st.key))}
                  >가</button>
                ))}
              </div>
              <div className="jan-imgdlg-row">
                <label>채우기</label>
                <input type="color" value={String(attrs.fill || '#dbeafe')} onChange={(e) => run(() => setShapeFill(editor, e.target.value))} />
                <button onClick={() => run(() => setShapeFill(editor, null))}>채우기 없음</button>
                <label>선</label>
                <input type="color" value={String(attrs.stroke || '#2563eb')} onChange={(e) => run(() => setShapeStroke(editor, { color: e.target.value }))} />
                <input
                  type="number" min={0} max={20} value={Number(attrs.strokeWidth) || 0}
                  onChange={(e) => run(() => setShapeStroke(editor, { width: Number(e.target.value) }))}
                />
                <select value={String(attrs.strokeStyle || 'solid')} onChange={(e) => run(() => setShapeStroke(editor, { style: e.target.value }))}>
                  <option value="solid">실선</option>
                  <option value="dashed">파선</option>
                  <option value="dotted">점선</option>
                </select>
              </div>
              <div className="jan-imgdlg-row">
                <label>크기</label>
                <input type="number" min={24} max={2000} value={Number(attrs.width) || 240} onChange={(e) => run(() => setShapeSize(editor, Number(e.target.value), Number(attrs.height) || 160))} />
                <input type="number" min={24} max={2000} value={Number(attrs.height) || 160} onChange={(e) => run(() => setShapeSize(editor, Number(attrs.width) || 240, Number(e.target.value)))} />
                <label>회전</label>
                <input type="number" min={0} max={359} value={Number(attrs.rotate) || 0} onChange={(e) => run(() => setShapeAttrs(editor, { rotate: Number(e.target.value) || 0 }))} />
              </div>
              <div className="jan-imgdlg-row">
                <label>글자</label>
                <input type="color" value={String(attrs.textColor || '#1c1f26')} onChange={(e) => run(() => setShapeAttrs(editor, { textColor: e.target.value }))} />
                <input type="number" min={8} max={200} value={Number(attrs.fontSize) || 15} onChange={(e) => run(() => setShapeAttrs(editor, { fontSize: Number(e.target.value) }))} />
                <button onClick={() => run(() => setShapeAttrs(editor, { bold: !attrs.bold }))}>굵게</button>
                <button onClick={() => run(() => setShapeAttrs(editor, { italic: !attrs.italic }))}>기울임</button>
                <button onClick={() => run(() => cycleTextDirection(editor))}>글자 방향</button>
                <button onClick={() => run(() => cycleVAlign(editor))}>세로 맞춤</button>
              </div>
              <div className="jan-imgdlg-row">
                <label>배치</label>
                {([['topbottom', '위/아래'], ['inline', '글자처럼'], ['left', '왼쪽 감쌈'], ['right', '오른쪽 감쌈'], ['behind', '글 뒤'], ['front', '글 앞']] as const).map(([key, label]) => (
                  <button key={key} className={(attrs.wrap || 'topbottom') === key ? 'is-active' : ''} onClick={() => run(() => setShapeWrap(editor, key === 'topbottom' ? null : key, `배치: ${label}`))}>{label}</button>
                ))}
              </div>
              <div className="jan-imgdlg-row">
                <label>그림자</label>
                <button className={attrs.shadow ? 'is-active' : ''} onClick={() => run(() => setShapeAttrs(editor, { shadow: !attrs.shadow }))}>그림자 켬/끔</button>
                <label htmlFor="jan-shape-cap">캡션</label>
                <input id="jan-shape-cap" type="text" defaultValue={String(attrs.caption || '')} onBlur={(e) => run(() => setShapeAttrs(editor, { caption: e.target.value || null }))} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

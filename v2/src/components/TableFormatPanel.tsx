import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  BORDER_PRESETS, BORDER_STYLES, BORDER_WHERE, BORDER_WIDTHS, STANDARD_COLORS, THEME_COLORS,
  applyBorders, applyCellAlign, applyCellIndent, applyCellPadding, applyDiagonal, applyShading,
  currentPen, cycleCellTextDirection, setPen,
} from '../lib/tableBorders'
import { setPenMode } from '../extensions/TablePen'
import { cellSelectionSize } from '../lib/tableSelect'

interface Props {
  editor: Editor | null
  tab?: string
  onClose: () => void
}

const TABS = [
  { key: 'border', label: '테두리' },
  { key: 'fill', label: '채우기' },
  { key: 'align', label: '맞춤과 여백' },
] as const

const ALIGN_GRID: { h: 'left' | 'center' | 'right'; v: 'top' | 'middle' | 'bottom'; label: string }[] = [
  { v: 'top', h: 'left', label: '위 왼쪽' }, { v: 'top', h: 'center', label: '위 가운데' }, { v: 'top', h: 'right', label: '위 오른쪽' },
  { v: 'middle', h: 'left', label: '가운데 왼쪽' }, { v: 'middle', h: 'center', label: '한가운데' }, { v: 'middle', h: 'right', label: '가운데 오른쪽' },
  { v: 'bottom', h: 'left', label: '아래 왼쪽' }, { v: 'bottom', h: 'center', label: '아래 가운데' }, { v: 'bottom', h: 'right', label: '아래 오른쪽' },
]

/**
 * 표 서식 — 워드의 「표 디자인 › 테두리·음영」 과 「레이아웃 › 맞춤·셀 여백」 을 한 창에.
 *
 * 워드처럼 펜(색·두께·모양)을 먼저 쥐고 어디에 그을지를 고른다.
 * 모든 단추는 키보드로 옮겨 다닐 수 있다.
 */
export function TableFormatPanel({ editor, tab, onClose }: Props) {
  const [active, setActive] = useState<string>(tab || 'border')
  const [pen, setPenState] = useState(currentPen())
  const firstRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  if (!editor) return null
  const size = cellSelectionSize(editor)
  const target = size ? `고른 ${size.rows}행 ${size.cols}열` : '커서가 든 칸'

  const changePen = (patch: Partial<typeof pen>) => setPenState(setPen(patch))

  function onTabKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    setActive(TABS[next].key)
    document.querySelectorAll<HTMLButtonElement>('.jan-tblfmt-tabs button')[next]?.focus()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="jan-modal jan-tblfmt" role="dialog" aria-label="표 서식" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>표 서식 — {target}에 적용</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-imgdlg-tabs jan-tblfmt-tabs" role="tablist">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              ref={i === 0 ? firstRef : undefined}
              role="tab"
              aria-selected={active === t.key}
              className={active === t.key ? 'is-active' : ''}
              onClick={() => setActive(t.key)}
              onKeyDown={(e) => onTabKey(e, i)}
            >{t.label}</button>
          ))}
        </div>

        <div className="jan-modal-body jan-tblfmt-body">
          {active === 'border' && (
            <>
              <div className="jan-imgdlg-row">
                <label htmlFor="jan-pen-color">펜 색</label>
                <input id="jan-pen-color" type="color" value={pen.color} onChange={(e) => changePen({ color: e.target.value })} />
                <label>두께</label>
                <select value={pen.width} onChange={(e) => changePen({ width: Number(e.target.value) })}>
                  {BORDER_WIDTHS.map((w) => <option key={w} value={w}>{w}px</option>)}
                </select>
                <label>모양</label>
                <select value={pen.style} onChange={(e) => changePen({ style: e.target.value })}>
                  {BORDER_STYLES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="jan-tblfmt-preview" aria-hidden="true">
                <span style={{ borderTop: `${pen.width}px ${pen.style} ${pen.color}` }} />
              </div>
              <div className="jan-tblfmt-grid">
                {BORDER_WHERE.map((w) => (
                  <button key={w.key} onClick={() => applyBorders(editor, w.key)}>{w.label}</button>
                ))}
              </div>
              <div className="jan-tblfmt-cap">테마 테두리 — 눌러서 펜을 바꾼다</div>
              <div className="jan-tblfmt-presets">
                {BORDER_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    title={preset.label}
                    aria-label={preset.label}
                    onClick={() => setPenState(setPen(preset.pen))}
                  >
                    <span style={{ borderTop: `${preset.pen.width}px ${preset.pen.style} ${preset.pen.color}` }} />
                  </button>
                ))}
              </div>

              <div className="jan-tblfmt-cap">대각선 · 그리기</div>
              <div className="jan-imgdlg-row">
                <button onClick={() => applyDiagonal(editor, 'down')}>하향 대각선 ＼</button>
                <button onClick={() => applyDiagonal(editor, 'up')}>상향 대각선 ／</button>
                <button onClick={() => applyDiagonal(editor, 'both')}>엇갈린 ✕</button>
                <button onClick={() => applyDiagonal(editor, null)}>대각선 지우기</button>
              </div>
              <div className="jan-imgdlg-row">
                <button onClick={() => { setPenMode('draw'); onClose() }}>표 그리기 (연필)</button>
                <button onClick={() => { setPenMode('erase'); onClose() }}>지우개</button>
                <button onClick={() => { setPenMode('copy'); onClose() }}>테두리 복사</button>
                <button onClick={() => { window.dispatchEvent(new Event('jan-table-gridlines')); onClose() }}>눈금선 보기</button>
              </div>
              <p className="jan-imgdlg-hint">
                펜을 정해 두면 다음에 그릴 때도 그대로 쓴다 — 워드의 「테두리 그리기」 와 같다.
                연필·지우개는 켜 둔 채 여러 변을 이어서 다룰 수 있고 Esc 로 끝낸다.
              </p>
            </>
          )}

          {active === 'fill' && (
            <>
              <div className="jan-tblfmt-cap">테마 색</div>
              <div className="jan-tblfmt-theme">
                {THEME_COLORS.map((col) => (
                  <div key={col.label} className="jan-tblfmt-themecol">
                    {col.shades.map((shade, i) => (
                      <button
                        key={shade + i}
                        title={`${col.label} ${i === 0 ? '' : i + '단계'}`}
                        aria-label={`${col.label} ${i === 0 ? '' : i + '단계'}`}
                        style={{ background: shade }}
                        onClick={() => applyShading(editor, shade)}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="jan-tblfmt-cap">표준 색</div>
              <div className="jan-tblfmt-std">
                {STANDARD_COLORS.map((c) => (
                  <button key={c.color} title={c.label} aria-label={c.label} style={{ background: c.color }} onClick={() => applyShading(editor, c.color)} />
                ))}
              </div>
              <div className="jan-imgdlg-row">
                <button onClick={() => applyShading(editor, null)}>색 없음</button>
                <label htmlFor="jan-fill-custom">다른 색</label>
                <input id="jan-fill-custom" type="color" defaultValue="#dbeafe" onChange={(e) => applyShading(editor, e.target.value)} />
              </div>
              <p className="jan-imgdlg-hint">고른 칸 전부가 한 번에 칠해진다.</p>
            </>
          )}

          {active === 'align' && (
            <>
              <div className="jan-imgdlg-row"><label>맞춤</label><span className="jan-imgdlg-hint">가로·세로를 한 번에 (워드의 아홉 칸 맞춤)</span></div>
              <div className="jan-tblfmt-align">
                {ALIGN_GRID.map((a) => (
                  <button key={a.label} title={a.label} aria-label={a.label} onClick={() => applyCellAlign(editor, a.h, a.v)}>
                    <span className={`jan-tblfmt-al jan-tblfmt-al-${a.v}-${a.h}`} />
                  </button>
                ))}
              </div>
              <div className="jan-imgdlg-row">
                <label>양쪽 맞춤</label>
                {(['top', 'middle', 'bottom'] as const).map((v) => (
                  <button key={v} onClick={() => applyCellAlign(editor, 'justify', v)}>
                    {{ top: '위', middle: '가운데', bottom: '아래' }[v]} · 양쪽
                  </button>
                ))}
              </div>
              <div className="jan-imgdlg-row">
                <label>칸 여백</label>
                {['2px 4px', '4px 6px', '6px 8px', '10px 12px'].map((p) => (
                  <button key={p} onClick={() => applyCellPadding(editor, p)}>{p}</button>
                ))}
                <button onClick={() => applyCellPadding(editor, null)}>기본값</button>
              </div>
              <div className="jan-imgdlg-row">
                <label>글자 방향</label>
                <button onClick={() => cycleCellTextDirection(editor)}>가로 ↔ 세로쓰기 바꾸기</button>
              </div>
              <div className="jan-imgdlg-row">
                <label>들여쓰기</label>
                <button onClick={() => applyCellIndent(editor, 1)}>들여쓰기 ＋</button>
                <button onClick={() => applyCellIndent(editor, -1)}>내어쓰기 －</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

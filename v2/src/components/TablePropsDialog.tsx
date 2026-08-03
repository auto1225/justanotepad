import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import {
  BORDER_STYLES, BORDER_WHERE, BORDER_WIDTHS, STANDARD_COLORS,
  applyBorders, applyCellPadding, applyShading, currentPen, setCellTextDirection, setCellValign, setPen,
} from '../lib/tableBorders'
import {
  distributeColumns, distributeRows, setColumnWidth, setRowHeight, setRowsKeepWhole, setTableWrap,
} from '../lib/tableWord'
import { cellSelectionSize } from '../lib/tableSelect'
import { flash } from '../lib/flash'

interface Props {
  editor: Editor | null
  tab?: string
  onClose: () => void
}

const TABS = [
  { key: 'table', label: '표' },
  { key: 'row', label: '행' },
  { key: 'column', label: '열' },
  { key: 'cell', label: '셀' },
] as const

const 너비단위 = ['%', 'mm', 'cm', 'px'] as const
const 높이단위 = ['px', 'mm', 'cm'] as const

/** '60%' → { 값: 60, 단위: '%' } (비어 있으면 null) */
function 길이나누기(text: unknown): { 값: number; 단위: string } | null {
  const m = /^(\d+(?:\.\d+)?)(%|mm|cm|px|em)$/.exec(String(text ?? '').trim())
  return m ? { 값: Number(m[1]), 단위: m[2] } : null
}

/** 커서가 든 (표 / 행 / 칸) 마디 */
function 지금(editor: Editor): { 표: PMNode | null; 행: PMNode | null; 칸: PMNode | null } {
  const { $from } = editor.state.selection
  let 표: PMNode | null = null
  let 행: PMNode | null = null
  let 칸: PMNode | null = null
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (!표 && node.type.name === 'table') 표 = node
    if (!행 && node.type.name === 'tableRow') 행 = node
    if (!칸 && /^table(Cell|Header)$/.test(node.type.name)) 칸 = node
  }
  return { 표, 행, 칸 }
}

/** 커서가 든 칸이 화면에서 차지한 너비 (열 너비 칸의 기본값) */
function 그려진열너비(editor: Editor): number {
  const dom = editor.view.domAtPos(editor.state.selection.from)?.node as HTMLElement | null
  const el = dom && (dom.nodeType === 1 ? dom : dom.parentElement)
  const td = el?.closest?.('td, th') as HTMLElement | null
  return td ? Math.round(td.getBoundingClientRect().width) : 0
}

/**
 * 표 속성 — 워드의 「표 속성」 대화상자를 갈피 넷(표·행·열·셀)으로.
 *
 * 예전에는 너비·행 높이·셀 여백을 **따로따로 묻는 프롬프트 셋**이었다. 한 값을 고치려고
 * 리본에서 다른 항목을 찾아 눌러야 했고, 지금 값이 무엇인지 창이 알려 주지도 않았다.
 * 여기서는 지금 값을 그대로 보여 주고, 고치면 바로 표에 닿는다 (그림 속성 창과 같은 결).
 *
 * 갈피는 ←→ 로도 오갈 수 있고 Esc 로 닫힌다 — ImageDialog 와 같은 자리를 쓴다.
 */
export function TablePropsDialog({ editor, tab, onClose }: Props) {
  const [active, setActive] = useState<string>(tab || 'table')
  const [pen, setPenState] = useState(currentPen())
  const [, force] = useState(0)
  const firstRef = useRef<HTMLButtonElement>(null)
  const redraw = () => force((n) => n + 1)

  useEffect(() => { firstRef.current?.focus() }, [])

  if (!editor) return null
  const { 표, 행, 칸 } = 지금(editor)
  if (!표) return null

  const 표속성 = 표.attrs as Record<string, unknown>
  const 행속성 = (행?.attrs ?? {}) as Record<string, unknown>
  const 칸속성 = (칸?.attrs ?? {}) as Record<string, unknown>
  const 고름 = cellSelectionSize(editor)
  const 대상 = 고름 ? `고른 ${고름.rows}행 ${고름.cols}열` : '커서가 든 칸'

  const 하고그리기 = (fn: () => unknown) => { fn(); setTimeout(redraw, 0) }

  const 표너비 = 길이나누기(표속성['data-width'])
  const 행높이 = 길이나누기(행속성['data-height'])
  const 칸여백 = String(칸속성['data-pad'] ?? '').trim().split(/\s+/)
  const 여백세로 = parseFloat(칸여백[0] || '') || 0
  const 여백가로 = parseFloat(칸여백[1] || 칸여백[0] || '') || 0

  const 표고치기 = (attrs: Record<string, string | null>, note: string) => 하고그리기(() => {
    editor.chain().focus().updateAttributes('table', attrs).run()
    flash(note)
  })

  const 펜바꾸기 = (patch: Partial<typeof pen>) => setPenState(setPen(patch))

  function onTabKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    setActive(TABS[next].key)
    document.querySelectorAll<HTMLButtonElement>('.jan-tblprops-tabs button')[next]?.focus()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="jan-modal jan-imgdlg jan-tblprops" role="dialog" aria-label="표 속성" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>표 속성 — {대상}</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-imgdlg-tabs jan-tblprops-tabs" role="tablist">
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

        <div className="jan-modal-body jan-imgdlg-body">
          {/* ── 표 ─────────────────────────────────────────── */}
          {active === 'table' && (
            <>
              <div className="jan-imgdlg-row">
                <label htmlFor="jan-tblprops-w">표 너비</label>
                <input
                  id="jan-tblprops-w" type="number" min={0} step={1}
                  value={표너비?.값 ?? ''}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    const unit = 표너비?.단위 || '%'
                    if (!Number.isFinite(n) || n <= 0) return
                    표고치기({ 'data-width': `${n}${unit}`, 'data-fit': 'fixed' }, `표 너비 ${n}${unit}`)
                  }}
                />
                <select
                  aria-label="표 너비 단위"
                  value={표너비?.단위 || '%'}
                  onChange={(e) => 표너비 && 표고치기(
                    { 'data-width': `${표너비.값}${e.target.value}`, 'data-fit': 'fixed' },
                    `표 너비 ${표너비.값}${e.target.value}`)}
                >
                  {너비단위.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <button onClick={() => 표고치기({ 'data-width': null }, '표 너비 자동')}>자동</button>
                {([50, 75, 100] as const).map((p) => (
                  <button key={p} onClick={() => 표고치기({ 'data-width': `${p}%`, 'data-fit': 'fixed' }, `표 너비 ${p}%`)}>{p}%</button>
                ))}
              </div>

              <div className="jan-imgdlg-row">
                <label>맞춤 방식</label>
                {([['window', '창(단)에 맞춤'], ['contents', '내용에 맞춤'], ['fixed', '고정 열 너비']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={표속성['data-fit'] === key ? 'is-active' : ''}
                    onClick={() => 표고치기({ 'data-fit': key }, label)}
                  >{label}</button>
                ))}
              </div>

              <div className="jan-imgdlg-row">
                <label>표 정렬</label>
                {([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={(표속성['data-align'] || 'left') === key ? 'is-active' : ''}
                    onClick={() => 표고치기({ 'data-align': key }, `표를 ${label}에 두었습니다`)}
                  >{label}</button>
                ))}
              </div>

              <div className="jan-imgdlg-row">
                <label>텍스트 배치</label>
                {([[null, '문단 사이'], ['inline', '글자처럼 취급'], ['left', '왼쪽에 두고 흐르기'], ['right', '오른쪽에 두고 흐르기']] as const).map(([key, label]) => (
                  <button
                    key={label}
                    className={(표속성['data-wrap'] ?? null) === key ? 'is-active' : ''}
                    onClick={() => 하고그리기(() => setTableWrap(editor, key))}
                  >{label}</button>
                ))}
              </div>

              <p className="jan-imgdlg-hint">
                「내용에 맞춤」 은 쪽을 넘어 나뉜 조각(data-cont)에서는 접히고 고정 배분으로 돈다 —
                조각마다 제 몫만 재면 같은 표의 폭이 쪽마다 달라지기 때문이다.
              </p>
            </>
          )}

          {/* ── 행 ─────────────────────────────────────────── */}
          {active === 'row' && (
            <>
              <div className="jan-imgdlg-row">
                <label htmlFor="jan-tblprops-h">행 높이</label>
                <input
                  id="jan-tblprops-h" type="number" min={0} step={1}
                  value={행높이?.값 ?? ''}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    const unit = 행높이?.단위 || 'px'
                    if (!Number.isFinite(n) || n <= 0) return
                    하고그리기(() => setRowHeight(editor, `${n}${unit}`))
                  }}
                />
                <select
                  aria-label="행 높이 단위"
                  value={행높이?.단위 || 'px'}
                  onChange={(e) => 행높이 && 하고그리기(() => setRowHeight(editor, `${행높이.값}${e.target.value}`))}
                >
                  {높이단위.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <button onClick={() => 하고그리기(() => setRowHeight(editor, null))}>자동</button>
                <button onClick={() => 하고그리기(() => distributeRows(editor))}>고른 행 같게</button>
              </div>

              <div className="jan-imgdlg-row">
                <label className="jan-imgdlg-check">
                  <input
                    type="checkbox"
                    checked={!!행속성['data-keep']}
                    onChange={(e) => 하고그리기(() => setRowsKeepWhole(editor, e.target.checked))}
                  />
                  쪽 경계에서 이 행을 나누지 않기
                </label>
              </div>

              <div className="jan-imgdlg-row">
                <label className="jan-imgdlg-check">
                  <input
                    type="checkbox"
                    checked={!!표속성['data-repeat-header']}
                    onChange={(e) => 표고치기(
                      { 'data-repeat-header': e.target.checked ? '1' : null },
                      e.target.checked ? '쪽을 넘으면 제목 행을 반복합니다' : '제목 행 반복을 껐습니다')}
                  />
                  쪽을 넘을 때 제목 행 반복
                </label>
              </div>

              <p className="jan-imgdlg-hint">
                행 높이는 **가장 작은 높이**다 — 글이 많으면 행은 그만큼 늘어난다 (표는 글을 자르지 않는다).
                반복된 제목 행은 화면과 인쇄에만 그려지는 위젯이라 글자 수·찾기에는 들어가지 않는다.
              </p>
            </>
          )}

          {/* ── 열 ─────────────────────────────────────────── */}
          {active === 'column' && (
            <>
              <div className="jan-imgdlg-row">
                <label htmlFor="jan-tblprops-cw">열 너비 (px)</label>
                <input
                  id="jan-tblprops-cw" type="number" min={24} step={1}
                  defaultValue={(칸속성.colwidth as number[] | null)?.[0] ?? 그려진열너비(editor)}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isFinite(n) || n < 24) return
                    하고그리기(() => setColumnWidth(editor, n))
                  }}
                />
                <button onClick={() => 하고그리기(() => setColumnWidth(editor, null))}>지정 지우기 (내용에 맞게)</button>
              </div>

              <div className="jan-imgdlg-row">
                <label>고르게</label>
                <button onClick={() => 하고그리기(() => distributeColumns(editor))}>고른 열 너비를 같게</button>
              </div>

              <p className="jan-imgdlg-hint">
                고른 열이 없으면 커서가 든 열만 바뀐다. 여러 열을 고르고 열면 그 열들이 함께 바뀐다.
              </p>
            </>
          )}

          {/* ── 셀 ─────────────────────────────────────────── */}
          {active === 'cell' && (
            <>
              <div className="jan-imgdlg-row">
                <label>칸 여백 (px)</label>
                <input
                  aria-label="위아래 여백" type="number" min={0} max={40} step={1} value={여백세로}
                  onChange={(e) => 하고그리기(() => applyCellPadding(editor, `${Number(e.target.value) || 0}px ${여백가로}px`))}
                />
                <input
                  aria-label="좌우 여백" type="number" min={0} max={40} step={1} value={여백가로}
                  onChange={(e) => 하고그리기(() => applyCellPadding(editor, `${여백세로}px ${Number(e.target.value) || 0}px`))}
                />
                <button onClick={() => 하고그리기(() => applyCellPadding(editor, null))}>기본값</button>
              </div>

              <div className="jan-imgdlg-row">
                <label>세로 맞춤</label>
                {([['top', '위'], ['middle', '가운데'], ['bottom', '아래']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={(칸속성.valign || 'top') === key ? 'is-active' : ''}
                    onClick={() => 하고그리기(() => setCellValign(editor, key))}
                  >{label}</button>
                ))}
              </div>

              <div className="jan-imgdlg-row">
                <label>글자 방향</label>
                {([[null, '가로'], ['vertical', '세로쓰기'], ['vertical-rl', '세로 (반대)']] as const).map(([key, label]) => (
                  <button
                    key={label}
                    className={(칸속성['data-text-dir'] ?? null) === key ? 'is-active' : ''}
                    onClick={() => 하고그리기(() => setCellTextDirection(editor, key))}
                  >{label}</button>
                ))}
              </div>

              <div className="jan-imgdlg-row">
                <label htmlFor="jan-tblprops-pen">테두리 펜</label>
                <input id="jan-tblprops-pen" type="color" value={pen.color} onChange={(e) => 펜바꾸기({ color: e.target.value })} />
                <select aria-label="테두리 두께" value={pen.width} onChange={(e) => 펜바꾸기({ width: Number(e.target.value) })}>
                  {BORDER_WIDTHS.map((w) => <option key={w} value={w}>{w}px</option>)}
                </select>
                <select aria-label="테두리 모양" value={pen.style} onChange={(e) => 펜바꾸기({ style: e.target.value })}>
                  {BORDER_STYLES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="jan-tblfmt-grid">
                {BORDER_WHERE.map((w) => (
                  <button key={w.key} onClick={() => 하고그리기(() => applyBorders(editor, w.key))}>{w.label}</button>
                ))}
              </div>

              <div className="jan-imgdlg-row">
                <label htmlFor="jan-tblprops-fill">음영</label>
                <input id="jan-tblprops-fill" type="color" defaultValue="#dbeafe" onChange={(e) => 하고그리기(() => applyShading(editor, e.target.value))} />
                <button onClick={() => 하고그리기(() => applyShading(editor, null))}>색 없음</button>
              </div>
              <div className="jan-tblfmt-std">
                {STANDARD_COLORS.map((c) => (
                  <button key={c.color} title={c.label} aria-label={c.label} style={{ background: c.color }} onClick={() => 하고그리기(() => applyShading(editor, c.color))} />
                ))}
              </div>

              <p className="jan-imgdlg-hint">
                테두리·음영은 고른 칸 모두에 한 번에 닿는다. 대각선·연필 그리기는 「표 서식」 창에 있다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

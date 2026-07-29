import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  CHART_PALETTES, CHART_STYLES, CHART_TYPES, DEFAULT_CHART, NUMBER_FORMATS, TREND_LINES,
  chartSvg, gridFromSpec, parseGridText, specFromGrid, toNumber,
} from '../lib/chartSpec'
import type { ChartSpec, ChartType } from '../lib/chartSpec'
import { flash } from '../lib/flash'

interface Props {
  editor: Editor | null
  mode: 'insert' | 'edit'
  onClose: () => void
}

/**
 * 차트 만들기·고치기 — 워드는 「차트 종류」 창과 엑셀 창을 따로 띄우지만,
 * 우리는 한 창에서 종류·데이터·꾸밈을 함께 다루고 그 자리에서 미리 보여 준다.
 *
 * 마우스로 되는 것은 키보드로도 된다: 표 안은 화살표로 옮겨 다니고,
 * Tab 으로 다음 칸, Ctrl+Enter 로 넣기·적용이다.
 */
export function ChartPanel({ editor, mode, onClose }: Props) {
  const current = (editor?.getAttributes('janChart').spec as ChartSpec) || null
  const [spec, setSpec] = useState<ChartSpec>(() => ({ ...DEFAULT_CHART, ...(mode === 'edit' && current ? current : {}) }))
  const [grid, setGrid] = useState<string[][]>(() => gridFromSpec({ ...DEFAULT_CHART, ...(mode === 'edit' && current ? current : {}) }))
  const gridRef = useRef<HTMLTableElement>(null)
  const [view, setView] = useState<'data' | 'format'>('data')

  const svg = useMemo(() => chartSvg(spec), [spec])
  const patch = (p: Partial<ChartSpec>) => setSpec((s) => ({ ...s, ...p }))

  /** 표를 고치면 곧바로 그림에 반영한다 */
  const applyGrid = (next: string[][]) => {
    setGrid(next)
    setSpec((s) => ({ ...specFromGrid(next, s), type: s.type }))
  }

  const setCell = (r: number, c: number, v: string) => {
    const next = grid.map((row) => [...row])
    while (next.length <= r) next.push(new Array(next[0]?.length || 2).fill(''))
    while (next[r].length <= c) next[r].push('')
    next[r][c] = v
    applyGrid(next)
  }

  const addRow = () => applyGrid([...grid, [`항목 ${grid.length}`, ...new Array(Math.max(1, (grid[0]?.length || 2) - 1)).fill('0')]])
  const addCol = () => applyGrid(grid.map((row, i) => [...row, i === 0 ? `계열 ${row.length}` : '0']))
  const delRow = () => grid.length > 2 && applyGrid(grid.slice(0, -1))
  const delCol = () => (grid[0]?.length || 0) > 2 && applyGrid(grid.map((row) => row.slice(0, -1)))

  /** 엑셀·CSV 를 그대로 붙여 넣을 수 있다 (워드에는 없는 편의) */
  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\t') && !text.includes('\n')) return
    e.preventDefault()
    applyGrid(parseGridText(text))
    flash('붙여 넣은 표로 차트를 다시 그렸습니다')
  }

  const commit = () => {
    if (!editor) return
    if (mode === 'edit' && editor.isActive('janChart')) editor.chain().focus().updateChart(spec).run()
    else editor.chain().focus().insertChart(spec).run()
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

  /** 표 안을 화살표로 옮겨 다닌다 */
  const onGridKey = (e: React.KeyboardEvent) => {
    const cells = [...(gridRef.current?.querySelectorAll('input') ?? [])] as HTMLInputElement[]
    const cols = grid[0]?.length || 1
    const i = cells.indexOf(document.activeElement as HTMLInputElement)
    if (i < 0) return
    let next: number
    if (e.key === 'ArrowRight' && (e.currentTarget as HTMLElement).tagName !== 'INPUT') next = i + 1
    else if (e.key === 'ArrowDown') next = i + cols
    else if (e.key === 'ArrowUp') next = i - cols
    else return
    if (next >= 0 && next < cells.length) { e.preventDefault(); cells[next].focus(); cells[next].select() }
  }

  if (!editor) return null

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-chartdlg" role="dialog" aria-label="차트" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>{mode === 'edit' ? '차트 고치기' : '차트 넣기'}</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-imgdlg-tabs" role="tablist">
          <button role="tab" aria-selected={view === 'data'} className={view === 'data' ? 'is-active' : ''} onClick={() => setView('data')}>종류와 데이터</button>
          <button role="tab" aria-selected={view === 'format'} className={view === 'format' ? 'is-active' : ''} onClick={() => setView('format')}>서식 (축·값·계열)</button>
        </div>

        <div className="jan-modal-body jan-chartdlg-body">
          <div className="jan-chartdlg-left">
            <div className="jan-chartdlg-types" role="listbox" aria-label="차트 종류">
              {CHART_TYPES.map((t) => (
                <button
                  key={t.key}
                  role="option"
                  aria-selected={spec.type === t.key}
                  title={t.hint}
                  className={spec.type === t.key ? 'is-active' : ''}
                  onClick={() => patch({ type: t.key as ChartType })}
                >
                  <span className="jan-chartdlg-mini" dangerouslySetInnerHTML={{ __html: chartSvg({ ...spec, type: t.key, width: 74, height: 46, mini: true, legend: 'none', title: '', valueLabels: false, grid: false, axisX: '', axisY: '', labels: spec.labels.slice(0, 3), series: spec.series.slice(0, 2).map((x) => ({ ...x, values: x.values.slice(0, 3) })) }) }} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="jan-chartdlg-preview" aria-label="미리보기" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>

          <div className="jan-chartdlg-right">
            {view === 'format' ? (
              <>
                <div className="jan-chartdlg-datahead"><strong>차트 스타일</strong></div>
                <div className="jan-design-row" style={{ margin: '2px 0 10px' }}>
                  {CHART_STYLES.map((st) => (
                    <button
                      key={st.key}
                      className={`jan-design-card${spec.chartStyle === st.key ? ' is-active' : ''}`}
                      style={{ width: 76 }}
                      aria-pressed={spec.chartStyle === st.key}
                      onClick={() => patch({ ...st.patch, chartStyle: st.key })}
                    >
                      <span dangerouslySetInnerHTML={{ __html: chartSvg({ ...spec, ...st.patch, width: 68, height: 44, mini: true, legend: 'none', title: '' }) }} />
                      <span style={{ fontSize: 10 }}>{st.label}</span>
                    </button>
                  ))}
                </div>

                <div className="jan-chartdlg-datahead"><strong>값 축</strong><span className="jan-chartdlg-hint">비우면 데이터에 맞춰 잡는다</span></div>
                <div className="jan-chartdlg-opts">
                  <label><span>최소</span><input type="number" aria-label="값 축 최소" value={spec.axisMin ?? ''} onChange={(e) => patch({ axisMin: e.target.value === '' ? null : Number(e.target.value) })} /></label>
                  <label><span>최대</span><input type="number" aria-label="값 축 최대" value={spec.axisMax ?? ''} onChange={(e) => patch({ axisMax: e.target.value === '' ? null : Number(e.target.value) })} /></label>
                  <label><span>눈금 간격</span><input type="number" min={0} aria-label="눈금 간격" value={spec.axisStep ?? ''} onChange={(e) => patch({ axisStep: e.target.value === '' ? null : Number(e.target.value) })} /></label>
                  <label><span>숫자 표기</span>
                    <select value={spec.numberFormat || 'plain'} aria-label="숫자 표기" onChange={(e) => patch({ numberFormat: e.target.value as ChartSpec['numberFormat'] })}>
                      {NUMBER_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label} ({f.hint})</option>)}
                    </select>
                  </label>
                  <label className="jan-chartdlg-check"><input type="checkbox" checked={!!spec.axisReverse} onChange={(e) => patch({ axisReverse: e.target.checked })} /><span>값을 거꾸로</span></label>
                  <label className="jan-chartdlg-check"><input type="checkbox" checked={!!spec.minorGrid} onChange={(e) => patch({ minorGrid: e.target.checked })} /><span>보조 눈금선</span></label>
                </div>

                <div className="jan-chartdlg-datahead"><strong>값 표시와 추세선</strong></div>
                <div className="jan-chartdlg-opts">
                  <label><span>값 자리</span>
                    <select value={spec.labelPos || 'outside'} aria-label="값 표시 자리" onChange={(e) => patch({ labelPos: e.target.value as ChartSpec['labelPos'] })}>
                      <option value="outside">바깥쪽</option>
                      <option value="inside">안쪽 끝</option>
                      <option value="center">가운데</option>
                    </select>
                  </label>
                  <label><span>추세선</span>
                    <select value={spec.trend || 'none'} aria-label="추세선" onChange={(e) => patch({ trend: e.target.value as ChartSpec['trend'] })}>
                      {TREND_LINES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </label>
                  <label><span>제목 자리</span>
                    <select value={spec.titlePos || 'top'} aria-label="제목 자리" onChange={(e) => patch({ titlePos: e.target.value as ChartSpec['titlePos'] })}>
                      <option value="top">위</option>
                      <option value="none">숨김</option>
                    </select>
                  </label>
                </div>

                <div className="jan-chartdlg-datahead"><strong>계열마다</strong><span className="jan-chartdlg-hint">색·선 굵기·표식</span></div>
                {spec.series.map((se, i) => (
                  <div className="jan-design-row" key={i} style={{ margin: '4px 0' }}>
                    <span style={{ minWidth: 64 }}>{se.name}</span>
                    <input
                      type="color"
                      aria-label={`${se.name} 색`}
                      value={se.color || (CHART_PALETTES[spec.palette || '기본'] || [])[i % 6] || '#4472c4'}
                      onChange={(e) => patch({ series: spec.series.map((x, k) => (k === i ? { ...x, color: e.target.value } : x)) })}
                    />
                    <label>굵기 <input type="number" min={0.5} max={6} step={0.5} style={{ width: 56 }} aria-label={`${se.name} 선 굵기`} value={se.lineWidth ?? 2.2}
                      onChange={(e) => patch({ series: spec.series.map((x, k) => (k === i ? { ...x, lineWidth: Number(e.target.value) || 2.2 } : x)) })} /></label>
                    <label>표식 <select value={se.marker || 'circle'} aria-label={`${se.name} 표식`}
                      onChange={(e) => patch({ series: spec.series.map((x, k) => (k === i ? { ...x, marker: e.target.value as 'circle' } : x)) })}>
                      <option value="circle">동그라미</option><option value="square">네모</option><option value="diamond">마름모</option><option value="none">없음</option>
                    </select></label>
                    <label><input type="checkbox" checked={!!se.dashed} onChange={(e) => patch({ series: spec.series.map((x, k) => (k === i ? { ...x, dashed: e.target.checked } : x)) })} /> 점선</label>
                    {spec.type === 'combo' && (
                      <label><input type="checkbox" checked={!!se.asLine} onChange={(e) => patch({ series: spec.series.map((x, k) => (k === i ? { ...x, asLine: e.target.checked } : x)) })} /> 선으로</label>
                    )}
                  </div>
                ))}
              </>
            ) : (
            <>
            <label className="jan-chartdlg-field">
              <span>제목</span>
              <input value={spec.title || ''} onChange={(e) => patch({ title: e.target.value })} placeholder="차트 제목 (비우면 없음)" />
            </label>

            <div className="jan-chartdlg-datahead">
              <strong>데이터</strong>
              <span className="jan-chartdlg-hint">엑셀·CSV 를 그대로 붙여 넣어도 된다</span>
            </div>
            <div className="jan-chartdlg-gridwrap" onPaste={onPaste} onKeyDown={onGridKey}>
              <table ref={gridRef} className="jan-chartdlg-grid">
                <tbody>
                  {grid.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c}>
                          <input
                            value={cell}
                            aria-label={r === 0 ? (c === 0 ? '왼쪽 위 빈칸' : `계열 ${c} 이름`) : (c === 0 ? `${r}번째 항목 이름` : `${r}번째 항목의 계열 ${c} 값`)}
                            className={r === 0 || c === 0 ? 'is-head' : ''}
                            inputMode={r > 0 && c > 0 ? 'decimal' : 'text'}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            onBlur={(e) => { if (r > 0 && c > 0) setCell(r, c, String(toNumber(e.target.value))) }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="jan-chartdlg-gridbtns">
              <button onClick={addRow}>항목 추가</button>
              <button onClick={delRow}>항목 빼기</button>
              <button onClick={addCol}>계열 추가</button>
              <button onClick={delCol}>계열 빼기</button>
            </div>

            <div className="jan-chartdlg-opts">
              <label><span>색</span>
                <select value={spec.palette || '기본'} onChange={(e) => patch({ palette: e.target.value })}>
                  {Object.keys(CHART_PALETTES).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label><span>범례</span>
                <select value={spec.legend || 'bottom'} onChange={(e) => patch({ legend: e.target.value as ChartSpec['legend'] })}>
                  <option value="bottom">아래</option>
                  <option value="top">위</option>
                  <option value="right">오른쪽</option>
                  <option value="none">없음</option>
                </select>
              </label>
              <label><span>가로 이름</span><input value={spec.axisX || ''} onChange={(e) => patch({ axisX: e.target.value })} /></label>
              <label><span>세로 이름</span><input value={spec.axisY || ''} onChange={(e) => patch({ axisY: e.target.value })} /></label>
              <label><span>너비</span><input type="number" min={200} max={900} value={spec.width || 460} onChange={(e) => patch({ width: Math.max(200, Math.min(900, Number(e.target.value) || 460)) })} /></label>
              <label><span>높이</span><input type="number" min={140} max={700} value={spec.height || 280} onChange={(e) => patch({ height: Math.max(140, Math.min(700, Number(e.target.value) || 280)) })} /></label>
              <label className="jan-chartdlg-check"><input type="checkbox" checked={spec.grid !== false} onChange={(e) => patch({ grid: e.target.checked })} /><span>눈금선</span></label>
              <label className="jan-chartdlg-check"><input type="checkbox" checked={!!spec.valueLabels} onChange={(e) => patch({ valueLabels: e.target.checked })} /><span>값 표시</span></label>
              <label className="jan-chartdlg-check"><input type="checkbox" checked={!!spec.stacked} onChange={(e) => patch({ stacked: e.target.checked })} /><span>쌓아서 보기</span></label>
            </div>
            </>
            )}
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

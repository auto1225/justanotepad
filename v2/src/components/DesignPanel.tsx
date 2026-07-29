import { useEffect, useMemo, useState } from 'react'
import {
  DESIGN_EFFECTS, PAGE_BORDER_STYLES, PAGE_COLORS, PARA_SPACING_SETS,
  STYLE_SETS, THEME_COLORS, THEME_FONTS, styleSet, themeColorSet,
} from '../lib/docDesign'
import type { DocDesign } from '../lib/docDesign'
import { useUIStore } from '../store/uiStore'

interface Props {
  tab: 'styles' | 'background'
  onClose: () => void
}

/** 문서 서식 한 벌을 작은 그림으로 — 워드 갤러리의 미리보기와 같은 구실 */
function stylePreview(key: string, themeKey: string): string {
  const s = styleSet(key)
  const theme = themeColorSet(themeKey)
  const headColor = s.headTinted ? theme.colors[0] : '#1c1f26'
  const rule = s.headRule === 'accent'
    ? `<rect x="10" y="12" width="3" height="12" fill="${theme.colors[0]}"/>`
    : s.headRule === 'thick'
      ? `<rect x="10" y="26" width="52" height="2.4" fill="${theme.colors[0]}"/>`
      : s.headRule === 'thin'
        ? `<rect x="10" y="26" width="52" height="1" fill="#c8cfd8"/>`
        : ''
  const headX = s.headRule === 'accent' ? 17 : 10
  const lines = [0, 1, 2, 3].map((i) =>
    `<rect x="${10 + (i === 0 ? s.indent * 4 : 0)}" y="${34 + i * 7}" width="${i === 3 ? 34 : 60 - (i === 0 ? s.indent * 4 : 0)}" height="2.2" rx="1" fill="#c8cfd8"/>`
  ).join('')
  return `<svg viewBox="0 0 80 66" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="66" rx="3" fill="#fff" stroke="#e3e7ec"/>
    <text x="${headX}" y="${22}" font-size="${8 * Math.min(1.5, s.headScale / 1.6)}" font-weight="${s.headWeight}" fill="${headColor}" font-family="${s.headFont === 'serif' ? 'serif' : s.headFont === 'mono' ? 'monospace' : 'sans-serif'}">제목</text>
    ${rule}${lines}
  </svg>`
}

/**
 * 디자인 창 — 워드 「디자인」 탭의 갤러리와 「페이지 배경」을 한 자리에.
 * 고르는 즉시 문서에 입혀 보여 준다 (되돌리려면 다른 벌을 고르면 된다).
 */
export function DesignPanel({ tab, onClose }: Props) {
  const design = useUIStore((s) => s.design)
  const setDesign = useUIStore((s) => s.setDesign)
  const [view, setView] = useState<'styles' | 'background'>(tab)
  const [draft, setDraft] = useState<DocDesign>(design)

  const patch = (p: Partial<DocDesign>) => {
    const next = { ...draft, ...p }
    setDraft(next)
    setDesign(p) // 고르는 즉시 문서에 입힌다
  }

  const cards = useMemo(() => STYLE_SETS.map((s) => ({ ...s, svg: stylePreview(s.key, draft.themeColor) })), [draft.themeColor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-designdlg" role="dialog" aria-label="문서 디자인" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>문서 디자인</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-imgdlg-tabs" role="tablist">
          <button role="tab" aria-selected={view === 'styles'} className={view === 'styles' ? 'is-active' : ''} onClick={() => setView('styles')}>문서 서식</button>
          <button role="tab" aria-selected={view === 'background'} className={view === 'background' ? 'is-active' : ''} onClick={() => setView('background')}>페이지 배경</button>
        </div>

        <div className="jan-modal-body">
          {view === 'styles' ? (
            <>
              <div className="jan-design-gallery" role="listbox" aria-label="문서 서식">
                {cards.map((c) => (
                  <button
                    key={c.key}
                    role="option"
                    aria-selected={draft.styleSet === c.key}
                    title={c.hint}
                    className={`jan-design-card${draft.styleSet === c.key ? ' is-active' : ''}`}
                    onClick={() => patch({ styleSet: c.key })}
                  >
                    <span dangerouslySetInnerHTML={{ __html: c.svg }} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>

              <div className="jan-design-row">
                <span>테마 색</span>
                {THEME_COLORS.map((t) => (
                  <button
                    key={t.key}
                    title={t.label}
                    aria-label={`테마 색 ${t.label}`}
                    aria-pressed={draft.themeColor === t.key}
                    className={`jan-design-card${draft.themeColor === t.key ? ' is-active' : ''}`}
                    style={{ padding: 4, width: 62 }}
                    onClick={() => patch({ themeColor: t.key })}
                  >
                    <span className="jan-design-swatches">
                      {t.colors.slice(0, 4).map((c) => <span key={c} className="jan-design-swatch" style={{ background: c }} />)}
                    </span>
                    <span style={{ fontSize: 10 }}>{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="jan-design-row">
                <span>테마 글꼴</span>
                <select value={draft.themeFont} onChange={(e) => patch({ themeFont: e.target.value })} aria-label="테마 글꼴">
                  {THEME_FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <span>단락 간격</span>
                <select value={draft.paraSpacing} onChange={(e) => patch({ paraSpacing: e.target.value })} aria-label="단락 간격">
                  {PARA_SPACING_SETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                <span>효과</span>
                <select value={draft.effect} onChange={(e) => patch({ effect: e.target.value })} aria-label="효과">
                  {DESIGN_EFFECTS.map((f) => <option key={f.key} value={f.key} title={f.hint}>{f.label}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="jan-design-row">
                <span>페이지 색</span>
                {PAGE_COLORS.map((c) => (
                  <button
                    key={c.key}
                    aria-label={`페이지 색 ${c.label}`}
                    aria-pressed={draft.pageColor === c.key}
                    title={c.label}
                    className={`jan-design-card${draft.pageColor === c.key ? ' is-active' : ''}`}
                    style={{ padding: 4, width: 56 }}
                    onClick={() => patch({ pageColor: c.key })}
                  >
                    <span className="jan-design-swatch" style={{ background: c.css, width: '100%', height: 20, border: '1px solid #e3e7ec' }} />
                    <span style={{ fontSize: 10 }}>{c.label}</span>
                  </button>
                ))}
              </div>

              <div className="jan-design-row">
                <span>쪽 테두리</span>
                <select value={draft.pageBorder.style} onChange={(e) => patch({ pageBorder: { ...draft.pageBorder, style: e.target.value } })} aria-label="쪽 테두리 모양">
                  {PAGE_BORDER_STYLES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                </select>
                <label>색 <input type="color" value={draft.pageBorder.color} onChange={(e) => patch({ pageBorder: { ...draft.pageBorder, color: e.target.value } })} aria-label="쪽 테두리 색" /></label>
                <label>굵기 <input type="number" min={0.5} max={12} step={0.5} value={draft.pageBorder.width} style={{ width: 58 }} onChange={(e) => patch({ pageBorder: { ...draft.pageBorder, width: Number(e.target.value) || 1 } })} aria-label="쪽 테두리 굵기" /></label>
                <label>안쪽 여백 <input type="number" min={0} max={48} value={draft.pageBorder.padding} style={{ width: 58 }} onChange={(e) => patch({ pageBorder: { ...draft.pageBorder, padding: Number(e.target.value) || 0 } })} aria-label="쪽 테두리 여백" /></label>
                <label><input type="checkbox" checked={draft.pageBorder.first} onChange={(e) => patch({ pageBorder: { ...draft.pageBorder, first: e.target.checked } })} /> 첫 쪽에도</label>
              </div>

              <div className="jan-design-row">
                <span>워터마크</span>
                <input
                  value={draft.watermark.text}
                  placeholder="예: 대외비, 초안, DRAFT (비우면 없음)"
                  style={{ flex: 1, minWidth: 180 }}
                  onChange={(e) => patch({ watermark: { ...draft.watermark, text: e.target.value } })}
                  aria-label="워터마크 글"
                />
                <label>색 <input type="color" value={draft.watermark.color} onChange={(e) => patch({ watermark: { ...draft.watermark, color: e.target.value } })} aria-label="워터마크 색" /></label>
              </div>
              <div className="jan-design-row">
                <span />
                <label>진하기 <input type="range" min={2} max={100} value={draft.watermark.opacity} onChange={(e) => patch({ watermark: { ...draft.watermark, opacity: Number(e.target.value) } })} aria-label="워터마크 진하기" /> {draft.watermark.opacity}%</label>
                <label>기울기 <input type="range" min={-90} max={90} value={draft.watermark.angle} onChange={(e) => patch({ watermark: { ...draft.watermark, angle: Number(e.target.value) } })} aria-label="워터마크 기울기" /> {draft.watermark.angle}°</label>
                <label>크기 <input type="number" min={12} max={200} value={draft.watermark.size} style={{ width: 62 }} onChange={(e) => patch({ watermark: { ...draft.watermark, size: Number(e.target.value) || 64 } })} aria-label="워터마크 크기" /></label>
              </div>
            </>
          )}
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">고르는 즉시 문서에 입혀진다 — 이 설정은 이 문서에만 붙는다</span>
          <button className="jan-primary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}

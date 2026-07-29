import { BORDER_STYLES, LINE_WIDTHS, STANDARD_COLORS, THEME_COLORS } from '../lib/tableBorders'

/**
 * 워드식 고르개 — 색판 · 선 두께 · 선 모양.
 *
 * 워드는 색을 「테마 색(10줄 × 6단계) + 표준 색 10 + 색 없음 + 다른 색」 으로 보여 주고,
 * 선 두께는 실제 선을 그려 놓고 ½ pt 처럼 적어 준다. 같은 방식으로 만들었다.
 * 리본의 펼침 단추와 표 서식 창이 이 고르개를 함께 쓴다.
 */

interface ColorProps {
  /** 지금 색 (테두리 표시용) */
  value?: string | null
  onPick: (color: string | null) => void
  /** 「색 없음」 을 뭐라고 부를지 — 음영은 「색 없음」, 펜은 「자동(검정)」 */
  noneLabel?: string
  /** 「자동」 을 고르면 넘길 색 (없으면 null) */
  noneValue?: string | null
}

/** 워드의 색 고르개 — 테마 색 · 표준 색 · 색 없음 · 다른 색 */
export function ColorPalette({ value, onPick, noneLabel = '색 없음', noneValue = null }: ColorProps) {
  return (
    <div className="jan-wcolor" role="group" aria-label="색 고르기">
      <button type="button" className="jan-wcolor-none" onClick={() => onPick(noneValue)}>
        <span className="jan-wcolor-nonebox" aria-hidden="true" />
        {noneLabel}
      </button>

      <div className="jan-wcolor-cap">테마 색</div>
      <div className="jan-wcolor-theme">
        {THEME_COLORS.map((col) => (
          <div key={col.label} className="jan-wcolor-col">
            {col.shades.map((shade, i) => (
              <button
                key={shade + i}
                type="button"
                style={{ background: shade }}
                className={value?.toLowerCase() === shade ? 'is-picked' : ''}
                title={i === 0 ? col.label : `${col.label}, ${i}단계`}
                aria-label={i === 0 ? col.label : `${col.label} ${i}단계`}
                onClick={() => onPick(shade)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="jan-wcolor-cap">표준 색</div>
      <div className="jan-wcolor-std">
        {STANDARD_COLORS.map((c) => (
          <button
            key={c.color}
            type="button"
            style={{ background: c.color }}
            className={value?.toLowerCase() === c.color ? 'is-picked' : ''}
            title={c.label}
            aria-label={c.label}
            onClick={() => onPick(c.color)}
          />
        ))}
      </div>

      <label className="jan-wcolor-more">
        다른 색...
        <input type="color" value={value || '#000000'} onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  )
}

/** 선 두께 고르개 — 실제 굵기를 그려 준다 */
export function LineWidthList({ value, color = '#333', onPick }: { value?: number; color?: string; onPick: (px: number) => void }) {
  return (
    <div className="jan-wline" role="group" aria-label="선 두께">
      {LINE_WIDTHS.map((w) => (
        <button
          key={w.label}
          type="button"
          className={value === w.px ? 'is-picked' : ''}
          onClick={() => onPick(w.px)}
          title={w.label}
        >
          <span className="jan-wline-label">{w.label}</span>
          <span className="jan-wline-draw" style={{ borderTop: `${w.px}px solid ${color}` }} />
        </button>
      ))}
    </div>
  )
}

/** 선 모양 고르개 — 실선·파선·점선·이중선을 그려 준다 */
export function LineStyleList({ value, color = '#333', onPick }: { value?: string; color?: string; onPick: (style: string) => void }) {
  return (
    <div className="jan-wline" role="group" aria-label="선 모양">
      {BORDER_STYLES.map((st) => (
        <button
          key={st.key}
          type="button"
          className={value === st.key ? 'is-picked' : ''}
          onClick={() => onPick(st.key)}
          title={st.label}
        >
          <span className="jan-wline-label">{st.label}</span>
          <span className="jan-wline-draw" style={{ borderTop: `3px ${st.key} ${color}` }} />
        </button>
      ))}
    </div>
  )
}

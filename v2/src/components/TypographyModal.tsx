import { Icon } from './Icons'
import { FontCombo } from './FontCombo'
import { NumberSpin } from './NumberSpin'
import {
  FONT_FAMILIES,
  TYPOGRAPHY_PRESETS,
  detectTypographyPreset,
  normalizeFontFamily,
  useTypographyStore,
} from '../store/typographyStore'

interface TypographyModalProps {
  onClose: () => void
}

export function TypographyModal({ onClose }: TypographyModalProps) {
  const t = useTypographyStore()
  const activePreset = detectTypographyPreset(t)

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-typography-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>문서 스타일</h3>
          <button className="jan-modal-close" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={14} />
            닫기
          </button>
        </div>
        <div className="jan-modal-body jan-typography-body">
          <section className="jan-typography-section" aria-label="스타일 프리셋">
            <div className="jan-typography-presets">
              {TYPOGRAPHY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={'jan-typography-preset' + (activePreset === preset.id ? ' is-active' : '')}
                  onClick={() => t.applyPreset(preset.id)}
                  aria-pressed={activePreset === preset.id}
                >
                  <span className="jan-typography-preset-title">{preset.label}</span>
                  <span>{preset.description}</span>
                  <strong>{preset.fontSize}px · {preset.lineHeight.toFixed(2)}줄</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="jan-typography-section" aria-label="상세 조정">
            <div className="jan-typography-field">
              <label htmlFor="jan-typo-font">글꼴 묶음</label>
              <select
                id="jan-typo-font"
                value={FONT_FAMILIES.some((f) => f.value === t.fontFamily) ? t.fontFamily : ''}
                onChange={(e) => t.setFontFamily(normalizeFontFamily(e.target.value))}
              >
                {FONT_FAMILIES.map((family) => (
                  <option key={family.value} value={family.value}>{family.label}</option>
                ))}
                {!FONT_FAMILIES.some((f) => f.value === t.fontFamily) && <option value="">직접 고른 글꼴</option>}
              </select>
            </div>
            <div className="jan-typography-field">
              <label>이 컴퓨터 글꼴</label>
              {/* 묶음 대신 설치된 글꼴을 문서 기본값으로 쓸 수 있다 */}
              <FontCombo
                value={FONT_FAMILIES.some((f) => f.value === t.fontFamily) ? '' : String(t.fontFamily)}
                onPick={(v) => t.setFontFamily(normalizeFontFamily(v || 'sans'))}
              />
            </div>
            <div className="jan-typography-field">
              <label htmlFor="jan-typo-size">글자 크기</label>
              <input id="jan-typo-size" type="range" min={8} max={40} step={1} value={t.fontSize} onChange={(e) => t.setFontSize(Number(e.target.value))} />
              <NumberSpin
                value={t.fontSize}
                onChange={(v) => t.setFontSize(v ?? 14)}
                min={4} max={200} step={1} unit="px" width={44}
                title="문서 기본 글자 크기 — 직접 입력하거나 ▲▼ 로 조절"
                ariaLabel="기본 글자 크기"
                allowEmpty={false}
                presets={[10, 11, 12, 13, 14, 16, 18, 20, 24]}
              />
            </div>
            <div className="jan-typography-field">
              <label htmlFor="jan-typo-line">줄 간격</label>
              <input id="jan-typo-line" type="range" min={0.8} max={3} step={0.05} value={t.lineHeight} onChange={(e) => t.setLineHeight(Number(e.target.value))} />
              <NumberSpin
                value={t.lineHeight}
                onChange={(v) => t.setLineHeight(v ?? 1.7)}
                min={0.5} max={5} step={0.05} decimals={2} width={40}
                title="문서 기본 줄 간격 (배수)"
                ariaLabel="기본 줄 간격"
                allowEmpty={false}
                presets={[1, 1.15, 1.5, 1.7, 2, 2.5]}
              />
            </div>
            <div className="jan-typography-field">
              <label htmlFor="jan-typo-para">단락 간격</label>
              <input id="jan-typo-para" type="range" min={0} max={48} step={1} value={t.paragraphSpacing} onChange={(e) => t.setParagraphSpacing(Number(e.target.value))} />
              <NumberSpin
                value={t.paragraphSpacing}
                onChange={(v) => t.setParagraphSpacing(v ?? 8)}
                min={0} max={200} step={1} unit="px" width={44}
                title="문단과 문단 사이 간격"
                ariaLabel="단락 간격"
                allowEmpty={false}
                presets={[0, 4, 8, 12, 16, 24]}
              />
            </div>
          </section>

          <div className="jan-typography-preview">
            <p>
              샘플 텍스트입니다. 한국어 가나다 영어 The quick brown fox 123. <b>굵게</b> <i>기울임</i> <u>밑줄</u>.
            </p>
            <p>
              두 번째 문단으로 단락 간격을 확인할 수 있습니다.
            </p>
          </div>
          <div className="jan-settings-actions">
            <button type="button" onClick={t.reset}>기본값으로</button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icons'
import {
  DEFAULT_RUNNING_FOOTER,
  normalizePageMarginsMm,
  PAGE_PRESETS,
  PAPER_STYLES,
  pageDimensions,
  useUIStore,
  type PageOrientation,
  type PageColumnCount,
  type PageMarginsMm,
  type PageSizePreset,
  type PaperStyle,
} from '../store/uiStore'

interface PageSettingsModalProps {
  onClose: () => void
}

const PAGE_SIZE_OPTIONS = Object.keys(PAGE_PRESETS) as PageSizePreset[]
const MARGIN_PRESETS = [12, 16, 20, 25, 30]
const COLUMN_OPTIONS: Array<{ value: PageColumnCount; label: string }> = [
  { value: 1, label: '1단' },
  { value: 2, label: '2단' },
  { value: 3, label: '3단' },
]
const MARGIN_FIELDS: Array<{ key: keyof PageMarginsMm; label: string; ariaLabel: string }> = [
  { key: 'top', label: '위', ariaLabel: '위 여백 mm' },
  { key: 'right', label: '오른쪽', ariaLabel: '오른쪽 여백 mm' },
  { key: 'bottom', label: '아래', ariaLabel: '아래 여백 mm' },
  { key: 'left', label: '왼쪽', ariaLabel: '왼쪽 여백 mm' },
]

export function PageSettingsModal({ onClose }: PageSettingsModalProps) {
  const ui = useUIStore()
  const [paperStyle, setPaperStyle] = useState<PaperStyle>(ui.paperStyle)
  const [pageSize, setPageSize] = useState<PageSizePreset>(ui.pageSize)
  const [pageOrientation, setPageOrientation] = useState<PageOrientation>(ui.pageOrientation)
  const [pageMarginMm, setPageMarginMm] = useState(ui.pageMarginMm)
  const [pageMarginsMm, setPageMarginsMm] = useState<PageMarginsMm>(() => normalizePageMarginsMm(ui.pageMarginsMm, ui.pageMarginMm))
  const [pageColumnCount, setPageColumnCount] = useState<PageColumnCount>(ui.pageColumnCount)
  const [runningHeader, setRunningHeader] = useState(ui.runningHeader || '')
  const [runningFooter, setRunningFooter] = useState(ui.runningFooter || DEFAULT_RUNNING_FOOTER)

  const paperLabel = PAPER_STYLES.find((style) => style.value === paperStyle)?.label || '줄노트'
  const dimensions = useMemo(() => pageDimensions(pageSize, pageOrientation), [pageSize, pageOrientation])
  const orientationLabel = pageOrientation === 'landscape' ? '가로' : '세로'
  const marginSummary = pageMarginsMm.top === pageMarginsMm.right &&
    pageMarginsMm.right === pageMarginsMm.bottom &&
    pageMarginsMm.bottom === pageMarginsMm.left
    ? `${pageMarginsMm.top}mm`
    : `상${pageMarginsMm.top} 우${pageMarginsMm.right} 하${pageMarginsMm.bottom} 좌${pageMarginsMm.left}mm`

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  function resetDraft() {
    setPaperStyle('lined')
    setPageSize('A4')
    setPageOrientation('portrait')
    setPageMarginMm(20)
    setPageMarginsMm({ top: 20, right: 20, bottom: 20, left: 20 })
    setPageColumnCount(1)
    setRunningHeader('')
    setRunningFooter(DEFAULT_RUNNING_FOOTER)
  }

  function setUniformMargin(margin: number) {
    const next = normalizePageMarginsMm({ top: margin, right: margin, bottom: margin, left: margin })
    setPageMarginMm(next.top)
    setPageMarginsMm(next)
  }

  function setMarginSide(side: keyof PageMarginsMm, value: number) {
    const next = normalizePageMarginsMm({ ...pageMarginsMm, [side]: value }, pageMarginMm)
    setPageMarginsMm(next)
    setPageMarginMm(Math.round((next.top + next.right + next.bottom + next.left) / 4))
  }

  function apply() {
    ui.applyPageSettings({
      paperStyle,
      pageSize,
      pageOrientation,
      pageMarginMm,
      pageMarginsMm,
      pageColumnCount,
      runningHeader,
      runningFooter,
    })
    onClose()
  }

  return (
    <div className="jan-modal-overlay jan-page-settings-overlay" onClick={onClose}>
      <div
        className="jan-modal jan-page-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jan-page-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="jan-page-settings-head">
          <div>
            <h3 id="jan-page-settings-title">페이지 설정</h3>
            <span>{pageSize} · {orientationLabel} · {paperLabel.replace(' (기본)', '')}</span>
          </div>
          <button className="jan-modal-close" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="jan-page-settings-body">
          <section className="jan-page-preview-panel" aria-label="페이지 미리보기">
            <div className="jan-page-preview-stage">
              <div
                className="jan-page-preview-sheet"
                data-paper={paperStyle}
                data-orientation={pageOrientation}
                data-columns={pageColumnCount}
              >
                <span className="jan-page-preview-margin" />
                <span className="jan-page-preview-line l1" />
                <span className="jan-page-preview-line l2" />
                <span className="jan-page-preview-line l3" />
              </div>
            </div>
            <div className="jan-page-preview-meta">
              <strong>{dimensions.widthMm} × {dimensions.heightMm} mm</strong>
              <span>{marginSummary} · {pageColumnCount}단 · {paperLabel}</span>
            </div>
          </section>

          <div className="jan-page-settings-controls">
            <section className="jan-page-settings-section">
              <div className="jan-page-settings-section-head">
                <Icon name="page" size={15} />
                <h4>용지</h4>
              </div>
              <div className="jan-page-size-grid">
                {PAGE_SIZE_OPTIONS.map((size) => {
                  const preset = PAGE_PRESETS[size]
                  const selected = pageSize === size
                  return (
                    <button
                      key={size}
                      type="button"
                      className={'jan-page-size-card' + (selected ? ' is-selected' : '')}
                      onClick={() => setPageSize(size)}
                      aria-pressed={selected}
                    >
                      <span
                        className="jan-page-size-icon"
                        style={{ aspectRatio: `${preset.widthMm} / ${preset.heightMm}` }}
                      />
                      <span className="jan-page-size-text">
                        <strong>{preset.label}</strong>
                        <small>{preset.widthMm} × {preset.heightMm}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="jan-page-settings-section">
              <div className="jan-page-settings-section-head">
                <Icon name="columns" size={15} />
                <h4>방향</h4>
              </div>
              <div className="jan-page-segmented" role="group" aria-label="페이지 방향">
                {[
                  ['portrait', '세로'],
                  ['landscape', '가로'],
                ].map(([value, label]) => {
                  const selected = pageOrientation === value
                  return (
                    <button
                      key={value}
                      type="button"
                      className={selected ? 'is-selected' : ''}
                      onClick={() => setPageOrientation(value as PageOrientation)}
                      aria-pressed={selected}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="jan-page-settings-section">
              <div className="jan-page-settings-section-head">
                <Icon name="columns" size={15} />
                <h4>다단</h4>
              </div>
              <div className="jan-page-segmented jan-page-column-segmented" role="group" aria-label="다단 레이아웃">
                {COLUMN_OPTIONS.map(({ value, label }) => {
                  const selected = pageColumnCount === value
                  return (
                    <button
                      key={value}
                      type="button"
                      className={selected ? 'is-selected' : ''}
                      onClick={() => setPageColumnCount(value)}
                      aria-pressed={selected}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {pageColumnCount > 1 && (
                <p className="jan-page-settings-hint">다단에서는 연속 시트로 표시됩니다 — 페이지 분할은 1단에서 동작합니다.</p>
              )}
            </section>

            <section className="jan-page-settings-section">
              <div className="jan-page-settings-section-head">
                <Icon name="palette" size={15} />
                <h4>배경</h4>
              </div>
              <div className="jan-paper-style-grid">
                {PAPER_STYLES.map((style) => {
                  const selected = paperStyle === style.value
                  return (
                    <button
                      key={style.value}
                      type="button"
                      className={'jan-paper-style-card' + (selected ? ' is-selected' : '')}
                      onClick={() => setPaperStyle(style.value)}
                      aria-pressed={selected}
                    >
                      <span className="jan-paper-style-thumb" data-paper={style.value} />
                      <span>{style.label}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="jan-page-settings-section">
              <div className="jan-page-settings-section-head">
                <Icon name="sliders" size={15} />
                <h4>여백</h4>
              </div>
              <div className="jan-page-margin-row">
                <input
                  type="range"
                  min={8}
                  max={60}
                  value={pageMarginMm}
                  onChange={(event) => setUniformMargin(Number(event.target.value))}
                  aria-label="전체 페이지 여백"
                />
                <input
                  type="number"
                  min={8}
                  max={60}
                  value={pageMarginMm}
                  onChange={(event) => setUniformMargin(Number(event.target.value) || 20)}
                  aria-label="전체 페이지 여백 mm"
                />
                <span>mm</span>
              </div>
              <div className="jan-page-margin-presets">
                {MARGIN_PRESETS.map((margin) => (
                  <button key={margin} type="button" onClick={() => setUniformMargin(margin)}>
                    {margin}
                  </button>
                ))}
              </div>
              <div className="jan-page-margin-fields">
                {MARGIN_FIELDS.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    <input
                      type="number"
                      min={8}
                      max={60}
                      value={pageMarginsMm[field.key]}
                      onChange={(event) => setMarginSide(field.key, Number(event.target.value) || 20)}
                      aria-label={field.ariaLabel}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="jan-page-settings-section">
              <div className="jan-page-settings-section-head">
                <Icon name="pin" size={15} />
                <h4>머리글 · 꼬리말</h4>
              </div>
              <div className="jan-page-running-fields">
                <label>
                  <span>머리글</span>
                  <input
                    type="text"
                    value={runningHeader}
                    onChange={(event) => setRunningHeader(event.target.value)}
                    placeholder="문서 제목 또는 장 이름"
                    aria-label="페이지 머리글"
                  />
                </label>
                <label>
                  <span>꼬리말</span>
                  <input
                    type="text"
                    value={runningFooter}
                    onChange={(event) => setRunningFooter(event.target.value)}
                    placeholder="Page {page} / {total}"
                    aria-label="페이지 꼬리말"
                  />
                </label>
              </div>
            </section>
          </div>
        </div>

        <div className="jan-page-settings-foot">
          <button type="button" className="jan-page-settings-ghost" onClick={resetDraft}>
            기본값
          </button>
          <span />
          <button type="button" className="jan-page-settings-ghost" onClick={onClose}>
            취소
          </button>
          <button type="button" className="jan-page-settings-primary" onClick={apply}>
            적용
          </button>
        </div>
      </div>
    </div>
  )
}

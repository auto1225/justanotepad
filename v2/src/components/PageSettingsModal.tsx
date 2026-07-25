import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icons'
import {
  DEFAULT_RUNNING_FOOTER,
  MARGIN_NAMED_PRESETS,
  clampCustomPageMm,
  normalizePageMarginsMm,
  normalizePageNumberStart,
  PAGE_PRESETS,
  PAPER_STYLES,
  pageDimensions,
  useUIStore,
  type GutterPosition,
  type PageNumberFormat,
  type PageOrientation,
  type PageColumnCount,
  type PageMarginsMm,
  type PageSizePreset,
  type PaperStyle,
} from '../store/uiStore'

interface PageSettingsModalProps {
  onClose: () => void
}

const PAGE_SIZE_OPTIONS = Object.keys(PAGE_PRESETS) as Exclude<PageSizePreset, 'custom'>[]
const PAGE_NUMBER_FORMAT_OPTIONS: Array<{ value: PageNumberFormat; label: string }> = [
  { value: 'arabic', label: '1, 2, 3' },
  { value: 'dash', label: '- 1 -' },
  { value: 'lowerRoman', label: 'i, ii, iii' },
  { value: 'upperRoman', label: 'I, II, III' },
]
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
  const [customW, setCustomW] = useState(String(ui.customPageWidthMm))
  const [customH, setCustomH] = useState(String(ui.customPageHeightMm))
  const [gutterMm, setGutterMm] = useState(ui.gutterMm)
  const [gutterPosition, setGutterPosition] = useState<GutterPosition>(ui.gutterPosition)
  const [pageNumberFormat, setPageNumberFormat] = useState<PageNumberFormat>(ui.pageNumberFormat)
  const [pageNumberStart, setPageNumberStart] = useState(ui.pageNumberStart)
  const [firstPageRunningOff, setFirstPageRunningOff] = useState(ui.firstPageRunningOff)
  const [watermarkText, setWatermarkText] = useState(ui.watermarkText)

  const paperLabel = PAPER_STYLES.find((style) => style.value === paperStyle)?.label || '줄노트'
  const dimensions = useMemo(
    () => pageDimensions(pageSize, pageOrientation, { widthMm: clampCustomPageMm(customW, 210), heightMm: clampCustomPageMm(customH, 297) }),
    [pageSize, pageOrientation, customW, customH]
  )
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

  // 메뉴 딥링크: "여백 설정" 등으로 진입하면 해당 섹션으로 스크롤 + 잠깐 하이라이트
  useEffect(() => {
    const target = sessionStorage.getItem('jan-page-focus')
    if (!target) return
    sessionStorage.removeItem('jan-page-focus')
    window.setTimeout(() => {
      const heads = document.querySelectorAll<HTMLElement>('.jan-page-settings-section-head h4')
      for (const h of heads) {
        if (h.textContent?.trim() === target) {
          const section = h.closest('.jan-page-settings-section') as HTMLElement | null
          section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          section?.classList.add('is-focused')
          window.setTimeout(() => section?.classList.remove('is-focused'), 1800)
          break
        }
      }
    }, 120)
  }, [])

  function resetDraft() {
    setPaperStyle('lined')
    setPageSize('A4')
    setPageOrientation('portrait')
    setPageMarginMm(20)
    setPageMarginsMm({ top: 20, right: 20, bottom: 20, left: 20 })
    setPageColumnCount(1)
    setRunningHeader('')
    setRunningFooter(DEFAULT_RUNNING_FOOTER)
    setCustomW('210'); setCustomH('297')
    setGutterMm(0); setGutterPosition('left')
    setPageNumberFormat('arabic'); setPageNumberStart(1)
    setFirstPageRunningOff(false)
    setWatermarkText('')
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
      customPageWidthMm: clampCustomPageMm(customW, 210),
      customPageHeightMm: clampCustomPageMm(customH, 297),
      gutterMm,
      gutterPosition,
      pageNumberFormat,
      pageNumberStart: normalizePageNumberStart(pageNumberStart),
      firstPageRunningOff,
      watermarkText,
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
                <button
                  type="button"
                  className={'jan-page-size-card' + (pageSize === 'custom' ? ' is-selected' : '')}
                  onClick={() => setPageSize('custom')}
                  aria-pressed={pageSize === 'custom'}
                >
                  <span className="jan-page-size-icon" style={{ aspectRatio: `${clampCustomPageMm(customW, 210)} / ${clampCustomPageMm(customH, 297)}` }} />
                  <span className="jan-page-size-text">
                    <strong>사용자 지정</strong>
                    <small>{clampCustomPageMm(customW, 210)} × {clampCustomPageMm(customH, 297)}</small>
                  </span>
                </button>
              </div>
              {pageSize === 'custom' && (
                <div className="jan-page-custom-size">
                  <label>
                    <span>너비</span>
                    <input type="number" min={50} max={1000} value={customW} onChange={(e) => setCustomW(e.target.value)} aria-label="사용자 지정 용지 너비 mm" />
                  </label>
                  <span className="jan-page-custom-x">×</span>
                  <label>
                    <span>높이</span>
                    <input type="number" min={50} max={1000} value={customH} onChange={(e) => setCustomH(e.target.value)} aria-label="사용자 지정 용지 높이 mm" />
                  </label>
                  <span className="jan-page-custom-unit">mm (50~1000)</span>
                </div>
              )}
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
                <Icon name="page-break" size={15} />
                <h4>페이지 분할 방식</h4>
              </div>
              <div className="jan-page-segmented" role="group" aria-label="페이지 분할 방식">
                <button
                  type="button"
                  className={ui.pageModel === 'nodes' ? 'is-selected' : ''}
                  onClick={() => ui.setPageModel('nodes')}
                  aria-pressed={ui.pageModel === 'nodes'}
                >독립 페이지 (권장)</button>
                <button
                  type="button"
                  className={ui.pageModel === 'legacy' ? 'is-selected' : ''}
                  onClick={() => ui.setPageModel('legacy')}
                  aria-pressed={ui.pageModel === 'legacy'}
                >기존 방식</button>
              </div>
              <p className="jan-page-settings-hint">
                {ui.pageModel === 'nodes'
                  ? '용지마다 낱장으로 나뉘어 입력·삭제에 즉시 맞춰집니다. 쪽 나란히 보기도 이 방식에서 정확합니다.'
                  : '페이지를 눈금으로만 표시합니다. 내용이 밀릴 때 분할 위치가 늦게 따라옵니다.'}
              </p>
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
                {MARGIN_NAMED_PRESETS.map((preset) => {
                  const active = pageMarginsMm.top === preset.margins.top &&
                    pageMarginsMm.right === preset.margins.right &&
                    pageMarginsMm.bottom === preset.margins.bottom &&
                    pageMarginsMm.left === preset.margins.left
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      className={active ? 'is-selected' : ''}
                      title={`상${preset.margins.top} 우${preset.margins.right} 하${preset.margins.bottom} 좌${preset.margins.left}mm`}
                      onClick={() => {
                        const next = normalizePageMarginsMm(preset.margins)
                        setPageMarginsMm(next)
                        setPageMarginMm(Math.round((next.top + next.right + next.bottom + next.left) / 4))
                      }}
                    >
                      {preset.label}
                    </button>
                  )
                })}
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
              <div className="jan-page-gutter-row">
                <label>
                  <span>제본 여백</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={gutterMm}
                    onChange={(event) => setGutterMm(Math.max(0, Math.min(30, Math.round(Number(event.target.value) || 0))))}
                    aria-label="제본 여백 mm"
                  />
                  <span>mm</span>
                </label>
                <div className="jan-page-segmented" role="group" aria-label="제본 여백 위치">
                  {([['left', '왼쪽'], ['top', '위쪽']] as Array<[GutterPosition, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={gutterPosition === value ? 'is-selected' : ''}
                      onClick={() => setGutterPosition(value)}
                      aria-pressed={gutterPosition === value}
                      disabled={gutterMm === 0}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="jan-page-settings-section">
              <div className="jan-page-settings-section-head">
                <Icon name="hash" size={15} />
                <h4>페이지 번호 · 워터마크</h4>
              </div>
              <div className="jan-page-number-row">
                <label>
                  <span>번호 형식</span>
                  <select value={pageNumberFormat} onChange={(event) => setPageNumberFormat(event.target.value as PageNumberFormat)} aria-label="페이지 번호 형식">
                    {PAGE_NUMBER_FORMAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>시작 번호</span>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={pageNumberStart}
                    onChange={(event) => setPageNumberStart(normalizePageNumberStart(event.target.value))}
                    aria-label="페이지 시작 번호"
                  />
                </label>
              </div>
              <label className="jan-page-check-row">
                <input
                  type="checkbox"
                  checked={firstPageRunningOff}
                  onChange={(event) => setFirstPageRunningOff(event.target.checked)}
                />
                <span>첫 페이지에는 머리글·꼬리말 표시 안 함 (표지)</span>
              </label>
              <label className="jan-page-watermark-row">
                <span>워터마크</span>
                <input
                  type="text"
                  value={watermarkText}
                  maxLength={40}
                  onChange={(event) => setWatermarkText(event.target.value)}
                  placeholder="예: 대외비, DRAFT (비우면 끔)"
                  aria-label="워터마크 텍스트"
                />
              </label>
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

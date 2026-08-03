import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { IMAGE_SHAPES, IMAGE_WRAPS } from '../extensions/ImageObject'
import type { Adjust } from '../extensions/ImageObject'
import {
  bodyWidthPx, clearCrop, compressImage, currentAdjust, currentCrop, currentImage, downloadImage,
  fillBox, fitBox, fitImageToBody, removeWhiteBackground, renderedSize, resetImageFormat, resetImageSize,
  setAdjust, setAltText, setCaptionPos, setCrop, setImageAlign, setImageAttrs, setImageCaption,
  setImageShape, setImageWrap, setRotation, toggleAspectLock, toggleImageLock,
} from '../lib/imageWord'
import { mmToPx, pxToMm } from '../lib/units'

interface Props {
  editor: Editor | null
  tab?: string
  onClose: () => void
}

const TABS = [
  { key: 'size', label: '크기' },
  { key: 'layout', label: '배치와 위치' },
  { key: 'crop', label: '자르기' },
  { key: 'adjust', label: '색 보정' },
  { key: 'caption', label: '캡션' },
  { key: 'alt', label: '대체 텍스트' },
] as const

/**
 * 그림 속성 — 워드의 「레이아웃」·「크기」 대화상자와 한글의 「개체 속성」 을 한 창에 모았다.
 *
 * 마우스로 끌어서 하던 일(크기·자르기·회전)을 여기서는 숫자로 정한다.
 * 끌기로만 되는 기능은 두지 않는다는 규칙을 지키는 자리이기도 하다.
 */
/** 크기를 어떤 자로 잴까 — 워드·한글의 크기 대화상자는 cm/mm 를 먼저 보여 준다 */
const UNITS = [
  { key: 'px', label: 'px', per: 1, step: 1, digits: 0 },
  { key: 'mm', label: 'mm', per: mmToPx(1), step: 0.5, digits: 1 },
  { key: 'cm', label: 'cm', per: mmToPx(10), step: 0.05, digits: 2 },
] as const

export function ImageDialog({ editor, tab, onClose }: Props) {
  const [active, setActive] = useState<string>(tab || 'size')
  const [unitKey, setUnitKey] = useState<string>('px')
  const hit = currentImage(editor)
  const attrs = useMemo(() => (hit ? { ...hit.node.attrs } as Record<string, unknown> : null), [hit])
  const size = renderedSize(editor)
  const crop = currentCrop(editor)
  const adjust = currentAdjust(editor)
  const firstRef = useRef<HTMLButtonElement>(null)
  const [, force] = useState(0)
  const redraw = () => force((n) => n + 1)

  useEffect(() => { firstRef.current?.focus() }, [])

  if (!editor || !hit || !attrs) return null

  const nw = Number(attrs.nw) || 0
  const nh = Number(attrs.nh) || 0
  const widthPx = size?.w || 0
  const run = (fn: () => unknown) => { fn(); setTimeout(redraw, 0) }

  /* px ↔ mm ↔ cm — 화면은 px 로 그리지만 사람은 종이를 mm 로 잰다 */
  const unit = UNITS.find((u) => u.key === unitKey) || UNITS[0]
  const toUnit = (px: number) => (px ? Number((px / unit.per).toFixed(unit.digits)) : 0)
  const toPx = (value: number) => Math.max(16, Math.round(value * unit.per))
  const asMm = (px: number) => (px ? `${pxToMm(px).toFixed(1)}mm` : '')

  /** 탭 사이를 ←→ 로도 옮겨 다닌다 */
  function onTabKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    setActive(TABS[next].key)
    const el = document.querySelectorAll<HTMLButtonElement>('.jan-imgdlg-tabs button')[next]
    el?.focus()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="jan-modal jan-imgdlg" role="dialog" aria-label="그림 속성" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>그림 속성</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-imgdlg-tabs" role="tablist">
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
          {active === 'size' && (
            <>
              <div className="jan-imgdlg-row">
                <label>단위</label>
                {UNITS.map((u) => (
                  <button key={u.key} className={unitKey === u.key ? 'is-active' : ''} onClick={() => setUnitKey(u.key)}>{u.label}</button>
                ))}
                <span className="jan-imgdlg-hint">지금 {widthPx}×{size?.h || 0}px = {asMm(widthPx)}×{asMm(size?.h || 0)}</span>
              </div>
              <div className="jan-imgdlg-row">
                <label>너비 ({unit.label})</label>
                <input
                  aria-label="너비" type="number" min={0} step={unit.step} value={toUnit(widthPx) || ''}
                  onChange={(e) => run(() => setImageAttrs(editor, { width: `${toPx(Number(e.target.value))}px`, height: null }))}
                />
                <label>높이 ({unit.label})</label>
                <input
                  aria-label="높이" type="number" min={0} step={unit.step} value={toUnit(size?.h || 0) || ''}
                  disabled={attrs.lock !== false}
                  title={attrs.lock !== false ? '가로 세로 비율 고정을 풀면 따로 정할 수 있다' : ''}
                  onChange={(e) => run(() => setImageAttrs(editor, { height: `${toPx(Number(e.target.value))}px` }))}
                />
              </div>
              <div className="jan-imgdlg-row">
                <label className="jan-imgdlg-check">
                  <input type="checkbox" checked={attrs.lock !== false} onChange={() => run(() => toggleAspectLock(editor))} />
                  가로 세로 비율 고정
                </label>
                <label className="jan-imgdlg-check">
                  <input type="checkbox" checked={!!attrs.locked} onChange={() => run(() => toggleImageLock(editor))} />
                  개체 보호 (크기·위치 잠금)
                </label>
              </div>
              <div className="jan-imgdlg-row">
                <label>배율</label>
                {[10, 25, 50, 75, 100, 150, 200].map((p) => (
                  <button key={p} onClick={() => run(() => nw && setImageAttrs(editor, { width: `${Math.round(nw * p / 100)}px`, height: null }))}>{p}%</button>
                ))}
              </div>
              <div className="jan-imgdlg-row">
                <button onClick={() => run(() => resetImageSize(editor))}>원래 크기 {nw ? `(${nw}×${nh})` : ''}</button>
                <button onClick={() => run(() => fitImageToBody(editor))}>본문 너비에 맞춤 ({bodyWidthPx(editor)}px)</button>
              </div>
              <div className="jan-imgdlg-row">
                <label>회전</label>
                <input
                  type="number" min={0} max={359} value={Number(attrs.rotate) || 0}
                  onChange={(e) => run(() => setRotation(editor, Number(e.target.value) || 0))}
                />
                <span className="jan-imgdlg-hint">도 — 0~359 사이로 직접 넣는다</span>
              </div>
              <div className="jan-imgdlg-row">
                <button onClick={() => run(() => compressImage(editor))}>그림 압축 (긴 변 1600px)</button>
                <button onClick={() => run(() => downloadImage(editor))}>그림으로 저장</button>
                <button onClick={() => run(() => resetImageFormat(editor, true))}>그림과 크기 원래대로</button>
              </div>
            </>
          )}

          {active === 'layout' && (
            <>
              <div className="jan-imgdlg-grid">
                {IMAGE_WRAPS.map((w) => (
                  <button
                    key={w.key}
                    className={(attrs.wrap || 'topbottom') === w.key ? 'is-active' : ''}
                    onClick={() => run(() => setImageWrap(editor, w.key === 'topbottom' ? null : w.key))}
                  >
                    <strong>{w.label}</strong>
                    <small>{w.hint}</small>
                  </button>
                ))}
              </div>
              <div className="jan-imgdlg-row">
                <label>가로 맞춤</label>
                {([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] as const).map(([key, label]) => (
                  <button key={key} className={attrs.align === key ? 'is-active' : ''} onClick={() => run(() => setImageAlign(editor, key))}>{label}</button>
                ))}
                <button onClick={() => run(() => setImageAlign(editor, null))}>지우기</button>
              </div>
              <div className="jan-imgdlg-row">
                <label>미세 이동 (px)</label>
                <input type="number" value={Number(attrs.dx) || 0} onChange={(e) => run(() => setImageAttrs(editor, { dx: Number(e.target.value) || 0 }))} />
                <input type="number" value={Number(attrs.dy) || 0} onChange={(e) => run(() => setImageAttrs(editor, { dy: Number(e.target.value) || 0 }))} />
                <button onClick={() => run(() => setImageAttrs(editor, { dx: 0, dy: 0 }))}>제자리로</button>
              </div>
              <p className="jan-imgdlg-hint">
                「글자처럼 취급」 은 그림을 한 글자처럼 다뤄 글과 함께 밀린다. 「텍스트 뒤」 는 워터마크에 쓴다.
              </p>
            </>
          )}

          {active === 'crop' && (
            <>
              <div className="jan-imgdlg-row">
                {(['t', 'r', 'b', 'l'] as const).map((side) => (
                  <span key={side} className="jan-imgdlg-cropcell">
                    <label>{{ t: '위', r: '오른쪽', b: '아래', l: '왼쪽' }[side]}</label>
                    <input
                      type="number" min={0} max={90} step={1} value={Math.round(crop[side] * 100)}
                      onChange={(e) => run(() => setCrop(editor, { ...crop, [side]: Math.min(0.9, Math.max(0, Number(e.target.value) / 100)) }))}
                    />%
                  </span>
                ))}
              </div>
              <div className="jan-imgdlg-row">
                <label>비율</label>
                {([['1:1', 1], ['4:3', 4 / 3], ['3:2', 1.5], ['16:9', 16 / 9], ['3:4', 0.75], ['9:16', 9 / 16]] as const).map(([label, ratio]) => (
                  <button key={label} onClick={() => run(() => import('../lib/imageWord').then((m) => m.cropToRatio(editor, ratio, label)))}>{label}</button>
                ))}
                <button onClick={() => run(() => clearCrop(editor))}>자르기 지우기</button>
              </div>
              <div className="jan-imgdlg-row">
                <label>상자에</label>
                <button onClick={() => run(() => fillBox(editor))}>채우기 (꽉 차게 잘라 냄)</button>
                <button onClick={() => run(() => fitBox(editor))}>맞춤 (전체가 들어오게)</button>
                <span className="jan-imgdlg-hint">
                  「크기」 탭에서 비율 고정을 풀고 너비·높이를 정한 뒤에 쓴다 — 지금 상자 {size?.w || 0}×{size?.h || 0}px
                </span>
              </div>
              <div className="jan-imgdlg-row">
                <label>도형에 맞춰</label>
                {IMAGE_SHAPES.map((s) => (
                  <button key={s.key} className={attrs.shape === s.key ? 'is-active' : ''} onClick={() => run(() => setImageShape(editor, s.key, s.label))}>{s.label}</button>
                ))}
                <button onClick={() => run(() => setImageShape(editor, null))}>없음</button>
              </div>
              <p className="jan-imgdlg-hint">자르기는 원본을 건드리지 않는다 — 값을 0 으로 되돌리면 그대로 돌아온다.</p>
            </>
          )}

          {active === 'adjust' && (
            <>
              {([
                ['bright', '밝기', 10, 300],
                ['contrast', '대비', 10, 300],
                ['sat', '채도', 0, 300],
                ['hue', '색조', -180, 180],
                ['blur', '흐리게', 0, 20],
                ['gray', '회색조', 0, 100],
                ['sepia', '세피아', 0, 100],
              ] as [keyof Adjust, string, number, number][]).map(([key, label, lo, hi]) => (
                <div className="jan-imgdlg-row" key={key}>
                  <label>{label}</label>
                  <input
                    type="range" min={lo} max={hi} value={adjust[key]}
                    onChange={(e) => run(() => setAdjust(editor, { [key]: Number(e.target.value) }))}
                  />
                  <input
                    type="number" min={lo} max={hi} value={Math.round(adjust[key])}
                    onChange={(e) => run(() => setAdjust(editor, { [key]: Number(e.target.value) }))}
                  />
                </div>
              ))}
              <div className="jan-imgdlg-row">
                <label>투명도</label>
                <input
                  type="range" min={10} max={100} value={Number(attrs.opacity) || 100}
                  onChange={(e) => run(() => setImageAttrs(editor, { opacity: Number(e.target.value) }))}
                />
                <span>{Number(attrs.opacity) || 100}%</span>
              </div>
              <div className="jan-imgdlg-row">
                <button onClick={() => run(() => setImageAttrs(editor, { adjust: null, opacity: null }))}>보정 지우기</button>
                <button onClick={() => run(() => removeWhiteBackground(editor))}>흰 배경 없애기</button>
              </div>
            </>
          )}

          {active === 'caption' && (
            <>
              <div className="jan-imgdlg-row">
                <label htmlFor="jan-cap-text">캡션</label>
                <input
                  id="jan-cap-text" type="text" defaultValue={String(attrs.caption || '')} autoFocus
                  placeholder="그림 1. 도심 주차 센서 배치"
                  onKeyDown={(e) => { if (e.key === 'Enter') { setImageCaption(editor, (e.target as HTMLInputElement).value); onClose() } }}
                  onBlur={(e) => setImageCaption(editor, e.target.value)}
                />
              </div>
              <div className="jan-imgdlg-row">
                <label>캡션 자리</label>
                {([['top', '위'], ['bottom', '아래'], ['left', '왼쪽'], ['right', '오른쪽']] as const).map(([key, label]) => (
                  <button key={key} className={(attrs.capPos || 'bottom') === key ? 'is-active' : ''} onClick={() => run(() => setCaptionPos(editor, key))}>{label}</button>
                ))}
              </div>
              <p className="jan-imgdlg-hint">
                캡션은 그림의 일부다 — 그림을 옮기면 함께 간다. (한글과 같은 방식, 워드는 따로 논다)
              </p>
            </>
          )}

          {active === 'alt' && (
            <>
              <div className="jan-imgdlg-row jan-imgdlg-col">
                <label htmlFor="jan-alt-text">대체 텍스트 — 그림을 못 보는 사람에게 읽어 줄 말</label>
                <textarea
                  id="jan-alt-text" rows={3} defaultValue={String(attrs.alt || '')} autoFocus
                  onBlur={(e) => setAltText(editor, e.target.value, String(attrs.title || ''))}
                />
              </div>
              <div className="jan-imgdlg-row jan-imgdlg-col">
                <label htmlFor="jan-title-text">설명문 (마우스를 올리면 뜨는 말)</label>
                <input
                  id="jan-title-text" type="text" defaultValue={String(attrs.title || '')}
                  onBlur={(e) => setAltText(editor, String(attrs.alt || ''), e.target.value)}
                />
              </div>
              <div className="jan-imgdlg-row">
                <button onClick={() => run(() => setAltText(editor, '', ''))}>장식용 그림으로 표시 (읽지 않음)</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

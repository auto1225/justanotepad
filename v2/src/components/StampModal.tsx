import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  STAMP_SHAPES, STAMP_CARVES, STAMP_SIZES, STAMP_INKS, STAMP_FONTS,
  drawStamp, makeStampPng, stampPixels, inkifyScan, stampOffset,
  loadStamps, saveStamp, removeStamp,
} from '../lib/stamp'
import type { StampCarve, StampFont, StampOrder, StampShape, SavedStamp } from '../lib/stamp'
import { mmToPx } from '../lib/units'
import { flash } from '../lib/flash'

interface Props {
  editor: Editor | null
  onClose: () => void
}

const WAYS = [
  { key: 'make', label: '이름으로 새기기' },
  { key: 'scan', label: '찍어 둔 도장 가져오기' },
  { key: 'drawer', label: '서랍' },
] as const

/**
 * 도장 — 결재란에 「(인)」 이라 적어 두고 인쇄해서 손으로 찍던 일을 문서 안에서 끝낸다.
 *
 * 세 가지 길이 있다. 이름을 새기거나, 종이에 찍어 둔 도장을 떠 오거나, 서랍에서 꺼낸다.
 * 도장은 한 번 만들고 여러 문서에 되풀이해 찍는 물건이라 서랍이 있어야 쓸모가 있다.
 *
 * 넣을 때 기본은 「커서 자리에 겹쳐 찍기」 다. 도장은 종이 위에 얹는 물건이라
 * 이름 옆이나 서명줄 위에 겹쳐야 뜻이 산다. 이 앱의 그림은 블록이라 글자 사이에
 * 끼지 못하고 문단 뒤 제 줄에 서는데, 그러면 결재란에 쓸 수가 없다 — 그래서
 * 글 앞으로 띄운 뒤 커서가 있던 자리까지 밀어 얹는다. 끄면 제 줄에 놓인다.
 */
export function StampModal({ editor, onClose }: Props) {
  const [way, setWay] = useState<string>('make')

  /* 새기기 */
  const [text, setText] = useState('')
  const [shape, setShape] = useState<StampShape>('circle')
  const [carve, setCarve] = useState<StampCarve>('relief')
  const [order, setOrder] = useState<StampOrder>('traditional')
  const [horizontal, setHorizontal] = useState(false)
  const [font, setFont] = useState<StampFont>('serif')
  const [color, setColor] = useState<string>(STAMP_INKS[0].key)
  const [mm, setMm] = useState(20)
  const [worn, setWorn] = useState(false)

  /* 가져오기 */
  const [scan, setScan] = useState<string>('')
  const [threshold, setThreshold] = useState(200)
  const [tint, setTint] = useState(false)
  const [scanOut, setScanOut] = useState<string>('')

  /* 넣기 */
  const [overlap, setOverlap] = useState(true)
  const [drawer, setDrawer] = useState<SavedStamp[]>(loadStamps)

  const previewRef = useRef<HTMLCanvasElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  /* 문턱을 끌면 떠내기가 여러 번 겹친다 — 마지막 것만 화면에 올린다 */
  const scanId = useRef(0)

  useEffect(() => { nameRef.current?.focus() }, [])

  /* 미리보기는 화면 크기로만 그린다 — 넣을 때 인쇄용으로 다시 찍는다 */
  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || way !== 'make') return
    const side = 200
    canvas.width = side
    canvas.height = shape === 'ellipse' ? Math.round(side * 0.68) : side
    if (!text.trim()) { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); return }
    drawStamp(canvas, { text, shape, carve, order, horizontal, color, font, worn })
  }, [way, text, shape, carve, order, horizontal, color, font, worn])

  /* 가져온 그림은 문턱을 움직일 때마다 다시 떠낸다 */
  useEffect(() => {
    if (!scan) return
    const id = scanId.current + 1
    scanId.current = id
    inkifyScan(scan, threshold, tint ? color : undefined)
      .then((out) => { if (id === scanId.current) setScanOut(out) })
      .catch(() => { if (id === scanId.current) { setScanOut(''); flash('그림을 떠내지 못했다 — 다른 파일로 해 본다') } })
  }, [scan, threshold, tint, color])

  const pickFile = () => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.onchange = () => {
      const file = inp.files?.[0]
      if (!file) return
      const r = new FileReader()
      r.onload = () => setScan(String(r.result))
      r.readAsDataURL(file)
    }
    inp.click()
  }

  /** 지금 고른 길에서 찍어 낸 도장 한 장 */
  const currentPng = useCallback((): string => {
    if (way === 'scan') return scanOut
    if (!text.trim()) return ''
    return makeStampPng({ text, shape, carve, order, horizontal, color, font, worn, sizeMm: mm })
  }, [way, scanOut, text, shape, carve, order, horizontal, color, font, worn, mm])

  const insert = (src: string, sizeMm: number) => {
    if (!editor || !src) { flash('찍을 도장이 없다'); return }
    const label = `도장${text.trim() ? ` ${text.trim()}` : ''}`
    const attrs = {
      src,
      width: `${Math.round(mmToPx(sizeMm))}px`,
      wrap: overlap ? 'front' : null,
      alt: label,
      lock: true,
    }

    /* 커서가 있던 자리를 먼저 재 둔다 — 넣고 나면 글이 밀려 자리가 달라진다 */
    const caret = overlap ? editor.view.coordsAtPos(editor.state.selection.from) : null
    /* 문단을 가르지 않고 그 뒤에 놓는다 — 그림은 블록이라 문단 한가운데 넣으면 글이 두 동강 난다 */
    const { $from } = editor.state.selection
    const at = $from.depth > 0 ? $from.after($from.depth) : editor.state.doc.content.size
    editor.chain().focus().insertContentAt(at, { type: 'image', attrs }).run()

    if (caret) {
      /* 제자리(문단 아래 왼쪽)에서 커서가 있던 자리까지 밀어 얹는다 */
      window.requestAnimationFrame(() => {
        const dom = editor.view.nodeDOM(at)
        if (!(dom instanceof HTMLElement)) return
        const node = editor.state.doc.nodeAt(at)
        if (!node || node.type.name !== 'image') return
        const { dx, dy } = stampOffset(caret, dom.getBoundingClientRect())
        editor.view.dispatch(editor.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, dx, dy }))
      })
    }
    flash(overlap ? '커서 자리에 도장을 찍었다' : '도장을 찍었다 — 제 줄에 놓였다')
    onClose()
  }

  const keep = () => {
    const src = currentPng()
    if (!src) { flash('넣어 둘 도장이 없다'); return }
    const name = (way === 'scan' ? '가져온 도장' : text.trim()) || '이름 없는 도장'
    setDrawer(saveStamp({ name, src, mm }))
    flash('서랍에 넣었다')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); insert(currentPng(), mm) }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  })

  if (!editor) return null

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-stampdlg" role="dialog" aria-label="도장" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>도장 찍기</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-stampdlg-ways" role="tablist">
          {WAYS.map((w) => (
            <button
              key={w.key}
              role="tab"
              aria-selected={way === w.key}
              className={way === w.key ? 'is-active' : ''}
              onClick={() => setWay(w.key)}
            >
              {w.label}{w.key === 'drawer' && drawer.length > 0 ? ` (${drawer.length})` : ''}
            </button>
          ))}
        </div>

        <div className="jan-modal-body jan-stampdlg-body">
          {way === 'make' && (
            <>
              <div className="jan-stampdlg-form">
                <label className="jan-chartdlg-field"><span>새길 글자</span>
                  <input
                    ref={nameRef} value={text} onChange={(e) => setText(e.target.value)}
                    placeholder="홍길동 · 대표이사인 · 주식회사○○"
                    aria-label="새길 글자"
                  />
                </label>

                <div className="jan-stampdlg-row" role="group" aria-label="모양">
                  <span className="jan-stampdlg-lbl">모양</span>
                  {STAMP_SHAPES.map((s) => (
                    <button key={s.key} title={s.hint} className={shape === s.key ? 'is-active' : ''} onClick={() => setShape(s.key)}>{s.label}</button>
                  ))}
                </div>

                <div className="jan-stampdlg-row" role="group" aria-label="새김">
                  <span className="jan-stampdlg-lbl">새김</span>
                  {STAMP_CARVES.map((c) => (
                    <button key={c.key} title={c.hint} className={carve === c.key ? 'is-active' : ''} onClick={() => setCarve(c.key)}>{c.label}</button>
                  ))}
                </div>

                <div className="jan-stampdlg-row" role="group" aria-label="글자 차례">
                  <span className="jan-stampdlg-lbl">차례</span>
                  <button className={order === 'traditional' ? 'is-active' : ''} onClick={() => setOrder('traditional')} title="오른쪽 줄부터 읽는다">전통 (오른쪽부터)</button>
                  <button className={order === 'modern' ? 'is-active' : ''} onClick={() => setOrder('modern')} title="왼쪽 줄부터 읽는다">현대 (왼쪽부터)</button>
                  <label className="jan-chartdlg-check">
                    <input type="checkbox" checked={horizontal} onChange={(e) => setHorizontal(e.target.checked)} />
                    <span>가로 한 줄</span>
                  </label>
                </div>

                <div className="jan-stampdlg-row" role="group" aria-label="글꼴">
                  <span className="jan-stampdlg-lbl">글꼴</span>
                  {STAMP_FONTS.map((f) => (
                    <button key={f.key} className={font === f.key ? 'is-active' : ''} onClick={() => setFont(f.key)}>{f.label}</button>
                  ))}
                </div>

                <div className="jan-stampdlg-row" role="group" aria-label="빛깔">
                  <span className="jan-stampdlg-lbl">빛깔</span>
                  {STAMP_INKS.map((c) => (
                    <button
                      key={c.key} title={c.label} aria-label={c.label}
                      className={`jan-stampdlg-ink${color === c.key ? ' is-active' : ''}`}
                      style={{ background: c.key }}
                      onClick={() => setColor(c.key)}
                    />
                  ))}
                  <label className="jan-chartdlg-check">
                    <input type="checkbox" checked={worn} onChange={(e) => setWorn(e.target.checked)} />
                    <span>오래 쓴 느낌</span>
                  </label>
                </div>
              </div>

              <div className="jan-stampdlg-preview">
                <canvas ref={previewRef} width={200} height={200} aria-label="도장 미리보기" />
                <p className="jan-chartdlg-hint">
                  {text.trim()
                    ? `${mm}mm · 인쇄할 때 ${stampPixels(mm)}px 로 찍힌다`
                    : '새길 글자를 적으면 여기에 도장이 보인다'}
                </p>
              </div>
            </>
          )}

          {way === 'scan' && (
            <>
              <div className="jan-stampdlg-form">
                <p className="jan-chartdlg-hint">
                  흰 종이에 찍은 도장을 찍거나 스캔해서 올린다. 종이 빛깔과 그늘은 걷어 내고 인영만 떠 온다.
                </p>
                <div className="jan-stampdlg-row">
                  <button className="jan-primary" onClick={pickFile}>그림 고르기</button>
                </div>
                <label className="jan-chartdlg-field"><span>걷어 낼 밝기 — {threshold}</span>
                  <input
                    type="range" min={100} max={250} value={threshold}
                    aria-label="걷어 낼 밝기"
                    onChange={(e) => setThreshold(Number(e.target.value))}
                  />
                </label>
                <label className="jan-chartdlg-check">
                  <input type="checkbox" checked={tint} onChange={(e) => setTint(e.target.checked)} />
                  <span>고른 빛깔로 물들이기 — 흐릿하게 찍힌 도장을 또렷하게</span>
                </label>
                <div className="jan-stampdlg-row" role="group" aria-label="빛깔">
                  <span className="jan-stampdlg-lbl">빛깔</span>
                  {STAMP_INKS.map((c) => (
                    <button
                      key={c.key} title={c.label} aria-label={c.label}
                      className={`jan-stampdlg-ink${color === c.key ? ' is-active' : ''}`}
                      style={{ background: c.key }}
                      onClick={() => setColor(c.key)}
                    />
                  ))}
                </div>
              </div>
              <div className="jan-stampdlg-preview">
                {scanOut
                  ? <img src={scanOut} alt="가져온 도장 미리보기" />
                  : <p className="jan-chartdlg-hint">아직 고른 그림이 없다.</p>}
              </div>
            </>
          )}

          {way === 'drawer' && (
            <div className="jan-stampdlg-drawer">
              {drawer.length === 0 ? (
                <p className="jan-chartdlg-hint">서랍이 비었다. 새긴 도장을 「서랍에 넣기」 하면 여기에 쌓인다.</p>
              ) : (
                <ul>
                  {drawer.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => insert(s.src, s.mm)} title="이 도장을 찍는다">
                        <img src={s.src} alt="" />
                        <span>{s.name}</span>
                        <small>{s.mm}mm</small>
                      </button>
                      <button
                        className="jan-stampdlg-del"
                        aria-label={`${s.name} 버리기`}
                        onClick={() => setDrawer(removeStamp(s.id))}
                      >×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {way !== 'drawer' && (
          <div className="jan-stampdlg-size">
            <span className="jan-stampdlg-lbl">크기</span>
            {STAMP_SIZES.map((s) => (
              <button key={s.mm} className={mm === s.mm ? 'is-active' : ''} onClick={() => setMm(s.mm)}>{s.label}</button>
            ))}
            <input
              type="number" min={5} max={80} value={mm} aria-label="도장 크기 (mm)"
              onChange={(e) => setMm(Math.min(80, Math.max(5, Number(e.target.value) || 20)))}
            />
            <span className="jan-chartdlg-hint">mm</span>
          </div>
        )}

        <div className="jan-modal-foot">
          <label className="jan-chartdlg-check jan-stampdlg-overlap">
            <input type="checkbox" checked={overlap} onChange={(e) => setOverlap(e.target.checked)} />
            <span>커서 자리에 겹쳐 찍기 — 끄면 제 줄에 놓인다</span>
          </label>
          <span className="jan-chartdlg-hint">Ctrl+Enter — 찍기</span>
          <button onClick={onClose}>취소</button>
          {way !== 'drawer' && <button onClick={keep}>서랍에 넣기</button>}
          {way !== 'drawer' && <button className="jan-primary" onClick={() => insert(currentPng(), mm)}>도장 찍기</button>}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { SignatureAttrs } from '../extensions/SignatureObject'

interface Props {
  editor: Editor | null
  mode: 'insert' | 'sign'
  onClose: () => void
}

const today = () => new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

/**
 * 서명란 창 — 왼쪽은 서명인 정보(워드의 「서명 설정」), 오른쪽은 실제 서명이다.
 * 손으로 그리거나(마우스·손가락·펜) 이름을 적어 넣을 수 있고, 키보드만으로도 끝낼 수 있다.
 */
export function SignaturePanel({ editor, mode, onClose }: Props) {
  const cur = (editor?.getAttributes('janSignature') || {}) as Partial<SignatureAttrs>
  const [signer, setSigner] = useState(cur.signer || '')
  const [title, setTitle] = useState(cur.title || '')
  const [email, setEmail] = useState(cur.email || '')
  const [instruction, setInstruction] = useState(cur.instruction ?? '이 문서에 서명하기 전에 내용을 확인하십시오.')
  const [showDate, setShowDate] = useState(cur.showDate ?? true)
  const [typed, setTyped] = useState(cur.signedName || '')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(!!cur.signedImage)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (cur.signedImage) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = cur.signedImage
    }
    // 처음 열 때 한 번만 밑칠한다
  }, [cur.signedImage])

  const point = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height }
  }

  const start = (e: React.PointerEvent) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    const p = point(e)
    ctx.strokeStyle = '#12243a'
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = point(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setHasInk(true)
  }
  const end = () => { drawing.current = false }

  const clearInk = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }

  const commit = (sign: boolean) => {
    if (!editor) return
    const attrs: Partial<SignatureAttrs> = {
      signer, title, email, instruction, showDate,
      signedName: sign ? typed : (cur.signedName || ''),
      signedImage: sign && hasInk ? (canvasRef.current?.toDataURL('image/png') || '') : (cur.signedImage || ''),
      signedAt: sign ? today() : (cur.signedAt || ''),
    }
    if (mode === 'sign' && editor.isActive('janSignature')) editor.chain().focus().updateSignature(attrs).run()
    else editor.chain().focus().insertSignature(attrs).run()
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(mode === 'sign') }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  })

  if (!editor) return null

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-signdlg" role="dialog" aria-label="서명란" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>{mode === 'sign' ? '서명하기' : '서명란 넣기'}</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-modal-body jan-signdlg-body">
          <div className="jan-signdlg-side">
            <label className="jan-chartdlg-field"><span>서명인 이름</span>
              <input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="홍길동" autoFocus />
            </label>
            <label className="jan-chartdlg-field"><span>직함</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="대표이사" />
            </label>
            <label className="jan-chartdlg-field"><span>전자우편</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </label>
            <label className="jan-chartdlg-field"><span>서명인에게 남길 말</span>
              <input value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            </label>
            <label className="jan-chartdlg-check">
              <input type="checkbox" checked={showDate} onChange={(e) => setShowDate(e.target.checked)} />
              <span>서명한 날짜 보이기</span>
            </label>
          </div>

          <div className="jan-signdlg-sign">
            <label className="jan-chartdlg-field"><span>이름으로 서명</span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="이름을 적으면 손글씨체로 들어간다" />
            </label>
            {typed && <div className="jan-signdlg-typed">{typed}</div>}
            <div className="jan-signdlg-inkhead">
              <span>손으로 서명</span>
              <button onClick={clearInk}>지우기</button>
            </div>
            <canvas
              ref={canvasRef}
              width={480}
              height={160}
              className="jan-signdlg-ink"
              aria-label="손으로 서명하는 칸"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
            />
            <p className="jan-chartdlg-hint">마우스·손가락·펜으로 그린다. 이름과 손글씨를 함께 쓰면 손글씨가 위에 온다.</p>
          </div>
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">Ctrl+Enter — {mode === 'sign' ? '서명' : '넣기'}</span>
          <button onClick={onClose}>취소</button>
          {mode === 'sign' && <button onClick={() => commit(false)}>정보만 고치기</button>}
          <button className="jan-primary" onClick={() => commit(true)}>{mode === 'sign' ? '서명하기' : '서명란 넣기'}</button>
        </div>
      </div>
    </div>
  )
}

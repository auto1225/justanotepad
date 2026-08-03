import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  IMAGE_FORMATS, dataUrlBytes, downloadDataUrl, fileNameFor, loadImageFile, prettyBytes, renderImage,
} from '../lib/imageConvert'
import type { ImageFormat, LoadedImage } from '../lib/imageConvert'
import { decodeBeforeInsert } from '../lib/imageWord'
import { flash } from '../lib/flash'

interface Props {
  editor: Editor | null
  onClose: () => void
}

/** 자주 쓰는 가로 크기 — 화면용·문서용·발표용 */
const PRESETS: { label: string; hint: string; width?: number; ratio?: number }[] = [
  { label: '절반', hint: '가로를 절반으로', ratio: 0.5 },
  { label: '1/4', hint: '가로를 4분의 1로', ratio: 0.25 },
  { label: '1920', hint: '큰 화면·발표', width: 1920 },
  { label: '1280', hint: '문서에 넣기 좋은 크기', width: 1280 },
  { label: '800', hint: '가벼운 웹용', width: 800 },
  { label: '원본', hint: '원래 크기로', ratio: 1 },
]

/**
 * 이미지 변환 창 — 크기와 형식을 보고 고른다.
 *
 * 예전에는 물음 창을 세 번 띄워 숫자를 받았다. 미리보기도 용량도 없어 「800이면 충분한가」 를
 * 알 수 없었다. 여기서는 고칠 때마다 미리보기와 예상 용량이 함께 바뀐다.
 * 끌어놓기·붙여넣기로도 그림을 받고, 저장하거나 문서에 바로 넣는다.
 */
export function ImageConvertPanel({ editor, onClose }: Props) {
  const [img, setImg] = useState<LoadedImage | null>(null)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [lockRatio, setLockRatio] = useState(true)
  const [format, setFormat] = useState<ImageFormat>('webp')
  const [quality, setQuality] = useState(0.9)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const take = useCallback(async (file: File) => {
    setError('')
    try {
      const loaded = await loadImageFile(file)
      setImg(loaded)
      setWidth(loaded.width)
      setHeight(loaded.height)
      /* 투명한 그림을 JPG 로 바꾸면 흰 바탕이 생긴다 — PNG 로 시작해 그 사고를 막는다 */
      setFormat(loaded.type === 'image/png' ? 'png' : 'webp')
    } catch (e) {
      setError(e instanceof Error ? e.message : '그림을 읽지 못했다')
    }
  }, [])

  /* 미리보기와 예상 용량 — 고른 값에서 바로 나오는 것이라 기억해 두고 다시 쓴다
     (효과로 만들면 값이 한 번 늦게 따라와 미리보기가 한 박자 밀린다) */
  const preview = useMemo(() => {
    if (!img || width < 1 || height < 1) return ''
    try {
      return renderImage(img, width, height, format, quality)
    } catch {
      return ''
    }
  }, [img, width, height, format, quality])

  /* 붙여넣기로도 받는다 (화면 캡쳐 → Ctrl+V) */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.items || [])]
        .map((it) => (it.kind === 'file' ? it.getAsFile() : null))
        .find((f): f is File => !!f && f.type.startsWith('image/'))
      if (file) { e.preventDefault(); void take(file) }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('paste', onPaste)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [take, onClose])

  const setW = (next: number) => {
    if (!img) return
    const w = Math.max(1, Math.min(10000, Math.round(next || 0)))
    setWidth(w)
    if (lockRatio) setHeight(Math.max(1, Math.round((w / img.width) * img.height)))
  }
  const setH = (next: number) => {
    if (!img) return
    const h = Math.max(1, Math.min(10000, Math.round(next || 0)))
    setHeight(h)
    if (lockRatio) setWidth(Math.max(1, Math.round((h / img.height) * img.width)))
  }
  const applyPreset = (p: typeof PRESETS[number]) => {
    if (!img) return
    setW(p.width ?? Math.round(img.width * (p.ratio ?? 1)))
  }

  const save = () => {
    if (!img || !preview) return
    downloadDataUrl(preview, fileNameFor(img, width, format))
  }
  /* 넣기 전에 브라우저가 그림을 풀어 두게 한다 — 디코딩을 조판 트랜잭션에서 떼어 놓는 것.
     재어 보니 4000×3000 WebP 를 곧바로 setImage 로 넣으면 가장 오래 붙들린 프레임이
     220·239ms 였고, 미리 풀어 두고 넣으면 144·117ms 였다 (바닥값 18ms).
     끌어놓기·붙여넣기에는 이미 걸려 있었는데 이 창만 빠져 있었다. */
  const insert = async () => {
    if (!img || !preview || !editor) return
    await decodeBeforeInsert(preview)
    if (editor.isDestroyed) return
    editor.chain().focus().setImage({ src: preview, alt: img.name }).run()
    flash(`문서에 넣었다 — ${width}×${height}`)
    onClose()
  }

  const lossy = IMAGE_FORMATS.find((f) => f.key === format)?.lossy
  const outBytes = preview ? dataUrlBytes(preview) : 0
  const saved = img && outBytes ? Math.round((1 - outBytes / img.bytes) * 100) : 0

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-imgconv" role="dialog" aria-label="이미지 변환" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>이미지 변환</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-modal-body jan-imgconv-body">
          {!img ? (
            <div
              className={'jan-imgconv-drop' + (dragOver ? ' is-over' : '')}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) void take(file)
              }}
            >
              <p><strong>그림을 끌어다 놓거나</strong> 아래에서 고른다</p>
              <p className="jan-chartdlg-hint">Ctrl+V 로 붙여넣어도 된다 (화면 캡쳐 그대로)</p>
              <button className="jan-primary" onClick={() => fileRef.current?.click()}>그림 고르기</button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                aria-label="바꿀 그림 파일"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void take(f) }}
              />
              {error && <p className="jan-imgconv-error">{error}</p>}
            </div>
          ) : (
            <>
              <div className="jan-imgconv-main">
                <div className="jan-imgconv-view">
                  {preview
                    ? <img src={preview} alt="바꾼 뒤 미리보기" />
                    : <div className="jan-imgconv-empty">미리보기를 만들지 못했다</div>}
                </div>
                <div className="jan-imgconv-form">
                  <p className="jan-imgconv-orig">
                    원본 <strong>{img.width}×{img.height}</strong> · {prettyBytes(img.bytes)}
                  </p>

                  <div className="jan-imgconv-presets" role="group" aria-label="자주 쓰는 크기">
                    {PRESETS.map((p) => (
                      <button key={p.label} title={p.hint} onClick={() => applyPreset(p)}>{p.label}</button>
                    ))}
                  </div>

                  <label className="jan-chartdlg-field">
                    <span>가로 (px)</span>
                    <input type="number" min={1} max={10000} value={width} aria-label="가로 픽셀"
                      onChange={(e) => setW(Number(e.target.value))} />
                  </label>
                  <label className="jan-chartdlg-field">
                    <span>세로 (px)</span>
                    <input type="number" min={1} max={10000} value={height} aria-label="세로 픽셀"
                      onChange={(e) => setH(Number(e.target.value))} />
                  </label>
                  <label className="jan-imgconv-check">
                    <input type="checkbox" checked={lockRatio} aria-label="비율 고정"
                      onChange={(e) => setLockRatio(e.target.checked)} />
                    <span>가로·세로 비율 고정</span>
                  </label>

                  <div className="jan-imgconv-formats" role="group" aria-label="저장 형식">
                    {IMAGE_FORMATS.map((f) => (
                      <label key={f.key} className={format === f.key ? 'is-active' : ''} title={f.hint}>
                        <input type="radio" name="jan-imgconv-format" checked={format === f.key}
                          aria-label={f.label} onChange={() => setFormat(f.key)} />
                        <span>{f.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="jan-chartdlg-hint">{IMAGE_FORMATS.find((f) => f.key === format)?.hint}</p>

                  {lossy && (
                    <label className="jan-chartdlg-field">
                      <span>화질 {Math.round(quality * 100)}%</span>
                      <input type="range" min={30} max={100} step={5} value={Math.round(quality * 100)}
                        aria-label="화질" onChange={(e) => setQuality(Number(e.target.value) / 100)} />
                    </label>
                  )}

                  <p className="jan-imgconv-out">
                    바꾼 뒤 <strong>{width}×{height}</strong> · {prettyBytes(outBytes)}
                    {outBytes > 0 && saved > 0 && <em> ({saved}% 줄었다)</em>}
                    {outBytes > 0 && saved < 0 && <em> ({-saved}% 늘었다)</em>}
                  </p>
                  <p className="jan-imgconv-name">저장 이름: {fileNameFor(img, width, format)}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">
            {img ? '크기·형식을 고치면 미리보기와 용량이 함께 바뀐다' : '그림을 넣으면 크기·형식을 고를 수 있다'}
          </span>
          {img && <button onClick={() => setImg(null)}>다른 그림</button>}
          <button onClick={insert} disabled={!preview || !editor}>문서에 넣기</button>
          <button className="jan-primary" onClick={save} disabled={!preview}>파일로 저장</button>
        </div>
      </div>
    </div>
  )
}

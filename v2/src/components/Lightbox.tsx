import { useEffect, useState } from 'react'

/**
 * 그림 크게 보기 — 두 번 눌러서 연다.
 *
 * 예전에는 한 번만 눌러도 열렸고, 그 자리에서 preventDefault 를 해 버려
 * 고르기 자체가 일어나지 않았다. 그래서 그림을 고쳐 보려고 누른 사람은
 * 난데없이 크게 보기가 뜨고, 닫고 나서도 손잡이가 말을 듣지 않았다.
 * (Alt 를 눌러야 골라졌는데, 그것을 알 길이 없다.)
 *
 * 편집기에서 한 번 누르기는 「고르기」 여야 한다 — 워드도 한글도 그렇다.
 * 크게 보기는 두 번 누르기로 옮긴다.
 * Esc 또는 배경을 눌러 닫는다.
 */
export function Lightbox() {
  const [src, setSrc] = useState<string | null>(null)
  const [alt, setAlt] = useState('')

  useEffect(() => {
    function onOpen(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (t.tagName !== 'IMG') return
      // ProseMirror 안의 이미지만
      if (!t.closest('.ProseMirror')) return
      const img = t as HTMLImageElement
      e.preventDefault()
      setSrc(img.src)
      setAlt(img.alt || '')
    }
    document.addEventListener('dblclick', onOpen)
    return () => document.removeEventListener('dblclick', onOpen)
  }, [])

  useEffect(() => {
    if (!src) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSrc(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [src])

  if (!src) return null

  return (
    <div className="jan-lightbox" onClick={() => setSrc(null)} role="dialog" aria-modal="true">
      <button className="jan-lightbox-close" onClick={() => setSrc(null)} aria-label="닫기">×</button>
      <img src={src} alt={alt} className="jan-lightbox-img" onClick={(e) => e.stopPropagation()} />
      {alt && <div className="jan-lightbox-caption">{alt}</div>}
    </div>
  )
}

import { flash } from './flash'

/**
 * 이미지 변환 — 파일을 골라 크기를 바꾸고 PNG·JPG·WebP 로 내려받는다.
 * 문서에 넣는 것이 아니라 「파일 하나를 손봐서 받는」 앱 도구라 도구 탭에 둔다.
 * (예전에는 머리부 더보기(⋯) 안에만 있어 아무도 찾지 못했다)
 */
export function convertImageFile(): void {
  const inp = document.createElement('input')
  inp.type = 'file'
  inp.accept = 'image/*'
  inp.onchange = () => {
    const file = inp.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const width = Number(window.prompt('새 가로 (px):', String(img.width))) || img.width
        const height = Math.round((width / img.width) * img.height)
        const type = (window.prompt('내려받을 형식 — png · jpeg · webp', 'png') || 'png').toLowerCase()
        const mime = type === 'jpg' || type === 'jpeg' ? 'image/jpeg' : type === 'webp' ? 'image/webp' : 'image/png'
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { flash('이 브라우저에서는 이미지를 바꿀 수 없다'); return }
        ctx.drawImage(img, 0, 0, width, height)
        const a = document.createElement('a')
        a.href = canvas.toDataURL(mime, 0.92)
        a.download = file.name.replace(/\.[^.]+$/, '') + `-${width}px.` + (mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png')
        a.click()
        flash(`${width}×${height} ${a.download.split('.').pop()} 로 내려받았다`)
      }
      img.onerror = () => flash('그림을 읽지 못했다')
      img.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  }
  inp.click()
}

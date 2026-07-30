import { flash } from './flash'

/**
 * 이미지 변환 — 크기·형식을 바꿔 저장하거나 문서에 넣는다.
 *
 * 예전에는 물음 창(prompt)을 세 번 띄워 가로·형식을 물었다. 미리보기도 없고 용량도 알 수 없어
 * 「몇 픽셀로 줄여야 하나」 를 감으로 골라야 했다. 이제 창에서 보고 고른다 —
 * 이 파일은 그 창이 쓰는 계산과 그리기만 맡는다 (UI 는 ImageConvertPanel).
 */

export type ImageFormat = 'png' | 'jpeg' | 'webp'

export const IMAGE_FORMATS: { key: ImageFormat; label: string; ext: string; lossy: boolean; hint: string }[] = [
  { key: 'png', label: 'PNG', ext: 'png', lossy: false, hint: '글자·도형이 또렷하다 · 용량이 크다' },
  { key: 'jpeg', label: 'JPG', ext: 'jpg', lossy: true, hint: '사진에 알맞다 · 투명은 흰색이 된다' },
  { key: 'webp', label: 'WebP', ext: 'webp', lossy: true, hint: '같은 화질에 가장 가볍다' },
]

export interface LoadedImage {
  el: HTMLImageElement
  name: string
  width: number
  height: number
  bytes: number
  type: string
}

/** 파일을 읽어 그림과 원본 크기·용량을 함께 돌려준다 */
export function loadImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('그림 파일이 아니다')); return }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('파일을 읽지 못했다'))
    reader.onload = () => {
      const el = new Image()
      el.onload = () => resolve({
        el,
        name: file.name.replace(/\.[^.]+$/, ''),
        width: el.naturalWidth,
        height: el.naturalHeight,
        bytes: file.size,
        type: file.type,
      })
      el.onerror = () => reject(new Error('그림을 읽지 못했다'))
      el.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}

/** 고른 크기·형식으로 다시 그린다 (data: URL) */
export function renderImage(img: LoadedImage, width: number, height: number, format: ImageFormat, quality: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이 브라우저에서는 그림을 다시 그릴 수 없다')
  /* JPG 는 투명을 모른다 — 비워 두면 검게 나오므로 흰 종이를 깔아 준다 */
  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img.el, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/' + format, quality)
}

/** data: URL 이 실제로 몇 바이트인지 (base64 는 3바이트를 4글자로 적는다) */
export function dataUrlBytes(url: string): number {
  const at = url.indexOf(',')
  if (at < 0) return 0
  const body = url.slice(at + 1)
  const pad = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((body.length * 3) / 4) - pad)
}

export function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function fileNameFor(img: LoadedImage, width: number, format: ImageFormat): string {
  const ext = IMAGE_FORMATS.find((f) => f.key === format)?.ext || 'png'
  return `${img.name}-${Math.round(width)}px.${ext}`
}

/** 만든 그림을 내려받는다 */
export function downloadDataUrl(url: string, name: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  flash(`${name} 로 저장했다`)
}

/** 창을 여는 길 — 도구 탭 단추가 이것을 부른다 */
export function openImageConvert(): void {
  window.dispatchEvent(new Event('jan-image-convert'))
}

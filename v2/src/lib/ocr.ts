/**
 * Phase 13 — OCR (이미지 → 텍스트).
 * Tesseract.js v5 — CDN ESM lazy import (~3MB worker + lang data).
 * createWorker 기반이라 진행 중 취소(worker.terminate)가 가능하다.
 * 한국어 + 영어 (kor+eng) 동시 지원.
 */

export interface OcrResult {
  text: string
  /** Tesseract 평균 신뢰도 (0~100). 제공되지 않으면 null. */
  confidence: number | null
}

export interface OcrHandle {
  /** 인식 결과. 취소 시 OcrCancelledError 로 reject. */
  promise: Promise<OcrResult>
  /** 진행 중인 인식을 실제로 중단한다 (worker terminate). 여러 번 호출해도 안전. */
  cancel: () => Promise<void>
}

export class OcrCancelledError extends Error {
  constructor() {
    super('인식이 취소되었습니다.')
    this.name = 'OcrCancelledError'
  }
}

// ---- Tesseract CDN 모듈 (타입 선언이 없어 최소 형태만 기술) ----

interface TessLoggerInfo {
  status?: string
  progress?: number
}

interface TessWorker {
  recognize: (image: File | Blob | string) => Promise<{ data: { text?: string; confidence?: number } }>
  terminate: () => Promise<unknown>
}

interface TessModule {
  createWorker: (
    langs: string,
    oem?: number,
    options?: { logger?: (info: TessLoggerInfo) => void },
  ) => Promise<TessWorker>
}

const TESSERACT_CDN_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js'

let tesseractMod: TessModule | null = null

/**
 * CDN 에서 Tesseract.js 를 로드한다. 성공 시에만 캐시하므로
 * 실패 후 다시 호출하면 그대로 재시도가 된다.
 */
export async function loadTesseract(): Promise<TessModule> {
  if (tesseractMod) return tesseractMod
  const url = TESSERACT_CDN_URL // 변수 경유 — 번들러가 정적 해석하지 않도록
  const m = await import(/* @vite-ignore */ url).catch(() => null)
  if (!m) {
    throw new Error('Tesseract.js 로드 실패 — 네트워크 연결을 확인한 뒤 다시 시도하세요.')
  }
  const mod = (m.default ?? m) as TessModule
  if (typeof mod.createWorker !== 'function') {
    throw new Error('Tesseract.js 모듈이 올바르지 않습니다. 잠시 후 다시 시도하세요.')
  }
  tesseractMod = mod
  return mod
}

/**
 * 취소 가능한 OCR 시작. worker 를 만들어 인식하고, cancel() 호출 시
 * 즉시 promise 를 reject 하고 worker 를 terminate 한다.
 */
export function startOcr(
  image: File | Blob,
  langs = 'kor+eng',
  onProgress?: (p: number) => void,
): OcrHandle {
  let worker: TessWorker | null = null
  let cancelled = false
  let fireCancel: ((e: Error) => void) | null = null

  const cancelGate = new Promise<never>((_, reject) => {
    fireCancel = reject
  })
  // race 에서 지더라도 unhandled rejection 이 되지 않도록 미리 소비
  cancelGate.catch(() => undefined)

  const run = async (): Promise<OcrResult> => {
    const T = await loadTesseract()
    if (cancelled) throw new OcrCancelledError()
    const w = await T.createWorker(langs, 1, {
      logger: (info) => {
        if (info.status === 'recognizing text' && typeof info.progress === 'number') {
          onProgress?.(info.progress)
        }
      },
    })
    worker = w
    if (cancelled) {
      worker = null
      await w.terminate().catch(() => undefined)
      throw new OcrCancelledError()
    }
    try {
      const { data } = await w.recognize(image)
      if (cancelled) throw new OcrCancelledError()
      return {
        text: data.text ?? '',
        confidence: typeof data.confidence === 'number' ? data.confidence : null,
      }
    } finally {
      worker = null
      await w.terminate().catch(() => undefined)
    }
  }

  const inner = run()
  inner.catch(() => undefined) // race 패자 소비

  return {
    promise: Promise.race([inner, cancelGate]),
    cancel: async () => {
      if (cancelled) return
      cancelled = true
      fireCancel?.(new OcrCancelledError())
      const w = worker
      worker = null
      if (w) await w.terminate().catch(() => undefined)
    },
  }
}

/** OCR 전 대형 이미지 축소 기준 (긴 변 픽셀). */
export const OCR_MAX_EDGE = 2500

/**
 * 긴 변이 maxEdge 를 넘으면 canvas 로 축소한 PNG Blob 을 돌려준다.
 * 축소 불가(디코딩 실패 등)면 원본을 그대로 돌려준다.
 */
export async function downscaleForOcr(image: Blob, maxEdge = OCR_MAX_EDGE): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(image)
  } catch {
    return image
  }
  const longest = Math.max(bitmap.width, bitmap.height)
  if (longest <= maxEdge) {
    bitmap.close()
    return image
  }
  const scale = maxEdge / longest
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return image
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  return blob ?? image
}

/** 단순 편의 함수 (기존 호환) — 취소가 필요하면 startOcr 를 사용. */
export async function ocrImage(
  file: File | Blob,
  langs = 'kor+eng',
  onProgress?: (p: number) => void,
): Promise<string> {
  const { text } = await startOcr(file, langs, onProgress).promise
  return text
}

export async function ocrFromUrl(url: string, langs = 'kor+eng'): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('이미지 fetch 실패: ' + r.status)
  const blob = await r.blob()
  return ocrImage(blob, langs)
}

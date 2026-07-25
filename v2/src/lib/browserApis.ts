/**
 * 표준에 아직 없거나 브라우저마다 갈리는 API 를 한곳에서 타입으로 감싼다.
 * 이걸 두지 않으면 호출하는 곳마다 as any 가 번진다.
 */

/** 화면 캡쳐 — getDisplayMedia 는 타입 정의에 없는 브라우저도 있다 */
export function getDisplayMedia(constraints: MediaStreamConstraints = { video: true }): Promise<MediaStream> {
  const md = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>
  }
  if (!md?.getDisplayMedia) throw new Error('이 브라우저는 화면 캡쳐를 지원하지 않습니다')
  return md.getDisplayMedia(constraints)
}

/** 프레임 한 장 잡기 — ImageCapture 는 크로뮴 계열에만 있다 */
interface ImageCaptureLike {
  grabFrame: () => Promise<ImageBitmap>
}
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike

export function createImageCapture(track: MediaStreamTrack): ImageCaptureLike {
  const ctor = (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture
  if (!ctor) throw new Error('이 브라우저는 화면 캡쳐(ImageCapture)를 지원하지 않습니다')
  return new ctor(track)
}

/** 받아쓰기 — SpeechRecognition 은 접두사가 갈린다 */
export interface SpeechResultLike {
  isFinal: boolean
  0: { transcript: string }
}
export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<SpeechResultLike> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

export function createSpeechRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

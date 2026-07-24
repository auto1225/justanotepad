/**
 * Phase 10 — 음성 입력 (STT) + 음성 합성 (TTS).
 * Web Speech API. Chrome / Edge 지원, Safari 부분 지원, Firefox 미지원.
 */

// ---------------------------------------------------------------------------
// SpeechRecognition 타입 심 — lib.dom 에 없어 직접 선언 (webkit 접두사 포함)
// ---------------------------------------------------------------------------

export interface SpeechRecognitionAlternativeLike {
  readonly transcript: string
  readonly confidence: number
}

export interface SpeechRecognitionResultLike {
  readonly length: number
  readonly isFinal: boolean
  item(index: number): SpeechRecognitionAlternativeLike
  readonly [index: number]: SpeechRecognitionAlternativeLike
}

export interface SpeechRecognitionResultListLike {
  readonly length: number
  item(index: number): SpeechRecognitionResultLike
  readonly [index: number]: SpeechRecognitionResultLike
}

export interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}

export interface SpeechRecognitionErrorEventLike extends Event {
  /** 'not-allowed' | 'no-speech' | 'network' | 'aborted' | 'audio-capture' | ... */
  readonly error: string
  readonly message: string
}

export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as SpeechWindow
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSTTSupported(): boolean {
  return getRecognitionCtor() !== null
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// ---------------------------------------------------------------------------
// STT
// ---------------------------------------------------------------------------

export interface STTHandle {
  stop: () => void
  abort: () => void
}

export interface STTOptions {
  lang?: string // 'ko-KR' | 'en-US' | 'ja-JP' | 'zh-CN'
  interim?: boolean // 중간 결과
  continuous?: boolean // 연속 모드 (기본 true)
  /**
   * 인식 결과 콜백. isFinal=false 는 중간(interim) 결과.
   */
  onResult: (text: string, isFinal: boolean) => void
  /**
   * 오류 콜백. Error.message 에 Web Speech API 오류 코드가 담긴다:
   * 'not-allowed' | 'service-not-allowed' | 'no-speech' | 'network' |
   * 'audio-capture' | 'aborted' 등.
   */
  onError?: (e: Error) => void
  onEnd?: () => void
}

/** STT 시작. 반환값으로 stop/abort 가능. */
export function startSTT(opts: STTOptions): STTHandle | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null
  const recog = new Ctor()
  recog.lang = opts.lang || 'ko-KR'
  recog.continuous = opts.continuous ?? true
  recog.interimResults = opts.interim ?? true

  recog.onresult = (e: SpeechRecognitionEventLike) => {
    let interim = ''
    let final = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) final += t
      else interim += t
    }
    if (final) opts.onResult(final, true)
    else if (interim && opts.interim !== false) opts.onResult(interim, false)
  }
  recog.onerror = (e: SpeechRecognitionErrorEventLike) => {
    opts.onError?.(new Error(e.error || 'speech error'))
  }
  recog.onend = () => {
    opts.onEnd?.()
  }
  try {
    recog.start()
  } catch (e) {
    opts.onError?.(e instanceof Error ? e : new Error(String(e)))
    return null
  }
  return {
    stop: () => { try { recog.stop() } catch { /* 이미 종료됨 */ } },
    abort: () => { try { recog.abort() } catch { /* 이미 종료됨 */ } },
  }
}

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------

export interface TTSOptions {
  text: string
  lang?: string
  rate?: number // 0.1 ~ 10
  pitch?: number // 0 ~ 2
  voice?: string // SpeechSynthesisVoice.name
}

/** 단발 발화 (하위 호환). 긴 텍스트에는 startTTSSession 사용 권장. */
export function speakTTS(opts: TTSOptions) {
  if (!isTTSSupported()) return
  cancelTTS()
  const u = new SpeechSynthesisUtterance(opts.text)
  u.lang = opts.lang || 'ko-KR'
  if (opts.rate != null) u.rate = opts.rate
  if (opts.pitch != null) u.pitch = opts.pitch
  if (opts.voice) {
    const v = window.speechSynthesis.getVoices().find((vv) => vv.name === opts.voice)
    if (v) u.voice = v
  }
  window.speechSynthesis.speak(u)
}

export function cancelTTS() {
  if (!isTTSSupported()) return
  try { window.speechSynthesis.cancel() } catch { /* 무시 */ }
}

export function pauseTTS() {
  if (!isTTSSupported()) return
  try { window.speechSynthesis.pause() } catch { /* 무시 */ }
}

export function resumeTTS() {
  if (!isTTSSupported()) return
  try { window.speechSynthesis.resume() } catch { /* 무시 */ }
}

export function isTTSSpeaking(): boolean {
  return isTTSSupported() && window.speechSynthesis.speaking
}

export function isTTSPaused(): boolean {
  return isTTSSupported() && window.speechSynthesis.paused
}

export function getTTSVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return []
  return window.speechSynthesis.getVoices()
}

// ---------------------------------------------------------------------------
// TTS 세션 — 긴 텍스트를 문장 단위 청크로 나눠 순차 낭독.
// Chrome 의 긴 utterance 중단 버그를 피하고 일시정지/취소 반응성을 높인다.
// ---------------------------------------------------------------------------

/** 문장 경계 우선으로 텍스트를 maxLen 이하 청크로 분할. */
export function splitTTSChunks(text: string, maxLen = 200): string[] {
  const parts = text
    .split(/(?<=[.!?。！？…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let buf = ''
  const flush = () => {
    if (buf) { chunks.push(buf); buf = '' }
  }
  for (const part of parts) {
    // 한 문장이 maxLen 을 넘으면 공백 기준으로 강제 분할
    const pieces: string[] = []
    if (part.length <= maxLen) {
      pieces.push(part)
    } else {
      let rest = part
      while (rest.length > maxLen) {
        let cut = rest.lastIndexOf(' ', maxLen)
        if (cut < maxLen * 0.4) cut = maxLen // 공백이 너무 앞이면 그냥 자름
        pieces.push(rest.slice(0, cut).trim())
        rest = rest.slice(cut).trim()
      }
      if (rest) pieces.push(rest)
    }
    for (const piece of pieces) {
      if (buf && buf.length + piece.length + 1 > maxLen) flush()
      buf = buf ? buf + ' ' + piece : piece
    }
  }
  flush()
  return chunks
}

export interface TTSSessionOptions extends TTSOptions {
  /** 청크(문장) 진행 콜백 — current 는 1부터, total 은 전체 청크 수. */
  onProgress?: (current: number, total: number) => void
  /** 모든 청크 낭독 완료 시. */
  onDone?: () => void
  onError?: (e: Error) => void
}

export interface TTSSessionHandle {
  readonly total: number
  cancel: () => void
  pause: () => void
  resume: () => void
}

/** 청크 기반 낭독 세션 시작. 지원 안 되거나 텍스트가 비면 null. */
export function startTTSSession(opts: TTSSessionOptions): TTSSessionHandle | null {
  if (!isTTSSupported()) return null
  cancelTTS()
  const chunks = splitTTSChunks(opts.text)
  if (chunks.length === 0) return null

  let cancelled = false
  let idx = 0
  const voice = opts.voice
    ? window.speechSynthesis.getVoices().find((v) => v.name === opts.voice)
    : undefined

  const speakNext = () => {
    if (cancelled) return
    if (idx >= chunks.length) {
      opts.onDone?.()
      return
    }
    const u = new SpeechSynthesisUtterance(chunks[idx])
    u.lang = opts.lang || 'ko-KR'
    if (opts.rate != null) u.rate = opts.rate
    if (opts.pitch != null) u.pitch = opts.pitch
    if (voice) u.voice = voice
    u.onend = () => {
      if (cancelled) return
      idx++
      speakNext()
    }
    u.onerror = (e: SpeechSynthesisErrorEvent) => {
      if (cancelled) return
      // cancel() 호출로 발생하는 중단 이벤트는 오류가 아님
      if (e.error === 'interrupted' || e.error === 'canceled') return
      cancelled = true
      opts.onError?.(new Error(e.error || 'tts error'))
    }
    opts.onProgress?.(idx + 1, chunks.length)
    window.speechSynthesis.speak(u)
  }

  speakNext()

  return {
    total: chunks.length,
    cancel: () => {
      cancelled = true
      try { window.speechSynthesis.cancel() } catch { /* 무시 */ }
    },
    pause: () => { try { window.speechSynthesis.pause() } catch { /* 무시 */ } },
    resume: () => { try { window.speechSynthesis.resume() } catch { /* 무시 */ } },
  }
}

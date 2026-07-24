import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { startSTT, isSTTSupported, type STTHandle } from '../lib/speech'
import { useI18nStore } from '../lib/i18n'
import { Icon } from './Icons'
import './speech-controls.css'

interface VoiceButtonProps {
  editor: Editor | null
}

const LANG_MAP: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
}

const STT_LANGS: { value: string; label: string }[] = [
  { value: 'ko-KR', label: '한국어' },
  { value: 'en-US', label: '영어' },
  { value: 'ja-JP', label: '일본어' },
  { value: 'zh-CN', label: '중국어' },
]

interface STTSettings {
  lang: string
  continuous: boolean
  autoPunct: boolean
}

const SETTINGS_KEY = 'jan-v2-stt-settings'

function loadSettings(defaultLang: string): STTSettings {
  const defaults: STTSettings = { lang: defaultLang, continuous: true, autoPunct: false }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<STTSettings>
      return {
        lang: STT_LANGS.some((l) => l.value === parsed.lang) ? (parsed.lang as string) : defaults.lang,
        continuous: typeof parsed.continuous === 'boolean' ? parsed.continuous : defaults.continuous,
        autoPunct: typeof parsed.autoPunct === 'boolean' ? parsed.autoPunct : defaults.autoPunct,
      }
    }
  } catch { /* 손상된 설정은 무시 */ }
  return defaults
}

/** 마이크 권한 등 재시작해도 소용없는 치명적 오류 코드. */
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture'])

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': '마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.',
  'service-not-allowed': '음성 인식 서비스를 사용할 수 없습니다.',
  'audio-capture': '마이크를 찾을 수 없습니다.',
  'no-speech': '음성이 감지되지 않았습니다.',
  network: '네트워크 오류로 음성 인식에 실패했습니다.',
}

/**
 * 인식 결과 마무리 — 자동 문장부호 옵션.
 * 보수적으로: 끝에 문장부호가 이미 있으면 그대로, 한글/영문/숫자로 끝날 때만 '. ' 추가.
 */
function finalizeText(text: string, autoPunct: boolean): string {
  const t = text.trim()
  if (!t) return ''
  if (!autoPunct) return t + ' '
  if (/[.!?,;:。！？，、…'")\]]$/.test(t)) return t + ' '
  if (/[가-힣A-Za-z0-9]$/.test(t)) return t + '. '
  return t + ' '
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Phase 10 — 음성 입력 버튼.
 * 클릭 → 마이크 권한 → 발화 → editor 에 텍스트 삽입.
 * 중간 결과 실시간 미리보기 + 언어/연속모드/자동문장부호 설정 팝오버 + 오류 인라인 표시.
 */
export function VoiceButton({ editor }: VoiceButtonProps) {
  const uiLang = useI18nStore((s) => s.lang)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [popOpen, setPopOpen] = useState(false)
  const [settings, setSettings] = useState<STTSettings>(
    () => loadSettings(LANG_MAP[uiLang] || 'ko-KR')
  )
  const handleRef = useRef<STTHandle | null>(null)
  const wantRef = useRef(false) // 사용자가 녹음을 원하는 상태 (연속 모드 자동 재시작 판단)
  const settingsRef = useRef(settings)
  const editorRef = useRef(editor)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { editorRef.current = editor }, [editor])

  // 설정 영속화
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* 무시 */ }
  }, [settings])

  // 경과 시간 타이머 (0 초기화는 startRecording 에서)
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

  // 오류 메시지 자동 해제
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  // 팝오버: 바깥 클릭 / Esc 로 닫기
  useEffect(() => {
    if (!popOpen) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPopOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [popOpen])

  // 언마운트 시 마이크 세션 정리 — 안 하면 버튼이 사라져도 녹음 표시가 계속 남는다
  useEffect(() => () => {
    wantRef.current = false
    try { handleRef.current?.stop() } catch { /* 이미 닫혔을 수 있음 */ }
    handleRef.current = null
  }, [])

  if (!isSTTSupported()) return null

  function beginRecognition() {
    const opts = settingsRef.current
    const h = startSTT({
      lang: opts.lang,
      interim: true,
      continuous: opts.continuous,
      onResult: (text, isFinal) => {
        if (isFinal) {
          setInterim('')
          const out = finalizeText(text, settingsRef.current.autoPunct)
          const ed = editorRef.current
          if (out && ed) ed.chain().focus().insertContent(out).run()
        } else {
          setInterim(text)
        }
      },
      onError: (e) => {
        const code = e.message
        if (code === 'aborted') return
        if (FATAL_ERRORS.has(code)) wantRef.current = false
        setError(ERROR_MESSAGES[code] || `음성 인식 오류: ${code}`)
      },
      onEnd: () => {
        handleRef.current = null
        setInterim('')
        // 연속 모드: 브라우저가 무음 등으로 세션을 끊으면 자동 재시작
        if (wantRef.current && settingsRef.current.continuous) {
          window.setTimeout(() => {
            if (wantRef.current && !handleRef.current) beginRecognition()
          }, 300)
        } else {
          wantRef.current = false
          setRecording(false)
        }
      },
    })
    if (h) {
      handleRef.current = h
      setRecording(true)
    } else {
      wantRef.current = false
      setRecording(false)
      setError('음성 인식을 시작할 수 없습니다.')
    }
  }

  const startRecording = () => {
    if (!editor) return
    setError(null)
    setInterim('')
    setElapsed(0)
    wantRef.current = true
    beginRecognition()
  }

  const stopRecording = () => {
    wantRef.current = false
    try { handleRef.current?.stop() } catch { /* 이미 닫혔을 수 있음 */ }
    handleRef.current = null
    setRecording(false)
    setInterim('')
  }

  const patch = (p: Partial<STTSettings>) => setSettings((s) => ({ ...s, ...p }))

  const mainTitle = recording ? '음성 입력 중지' : '음성 입력 시작'

  return (
    <span className="jan-speech-wrap" ref={wrapRef}>
      <button
        onClick={recording ? stopRecording : startRecording}
        className={recording ? 'is-active' : ''}
        title={mainTitle}
        aria-label={mainTitle}
        aria-pressed={recording}
      >
        {recording ? (
          <span className="jan-speech-dot" aria-hidden="true" />
        ) : (
          <Icon name="mic" size={14} />
        )}
        <span className={recording ? 'jan-speech-elapsed' : ''}>
          {recording ? formatElapsed(elapsed) : '음성'}
        </span>
      </button>
      <button
        className={`jan-speech-caret ${popOpen ? 'is-active' : ''}`}
        onClick={() => setPopOpen((o) => !o)}
        title="음성 입력 설정"
        aria-label="음성 입력 설정"
        aria-haspopup="dialog"
        aria-expanded={popOpen}
      >
        <Icon name="chevron-down" size={12} />
      </button>

      {(error || (recording && interim)) && (
        <div className="jan-speech-float">
          {recording && interim && (
            <div className="jan-speech-interim" aria-live="polite">{interim}</div>
          )}
          {error && (
            <div className="jan-speech-error" role="alert">{error}</div>
          )}
        </div>
      )}

      {popOpen && (
        <div className="jan-speech-pop" role="dialog" aria-label="음성 입력 설정">
          <div className="jan-speech-pop-title">음성 입력 설정</div>

          <label className="jan-speech-field">
            <span>인식 언어</span>
            <select
              value={settings.lang}
              onChange={(e) => patch({ lang: e.target.value })}
              aria-label="음성 인식 언어"
            >
              {STT_LANGS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </label>

          <label className="jan-speech-check">
            <input
              type="checkbox"
              checked={settings.continuous}
              onChange={(e) => patch({ continuous: e.target.checked })}
              aria-label="연속 모드"
            />
            <span>연속 모드 (끊겨도 자동 재시작)</span>
          </label>

          <label className="jan-speech-check">
            <input
              type="checkbox"
              checked={settings.autoPunct}
              onChange={(e) => patch({ autoPunct: e.target.checked })}
              aria-label="자동 문장부호"
            />
            <span>자동 문장부호 (문장 끝 마침표)</span>
          </label>

          {recording && (
            <div className="jan-speech-hint">언어 변경은 다음 인식 구간부터 적용됩니다</div>
          )}
        </div>
      )}
    </span>
  )
}

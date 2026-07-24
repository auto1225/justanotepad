import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  cancelTTS,
  getTTSVoices,
  isTTSSupported,
  startTTSSession,
  type TTSSessionHandle,
} from '../lib/speech'
import { useI18nStore } from '../lib/i18n'
import { Icon } from './Icons'
import './speech-controls.css'

interface TTSButtonProps {
  editor: Editor | null
}

const LANG_MAP: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
}

interface TTSSettings {
  voice: string // '' = 브라우저 기본값
  rate: number // 0.5 ~ 2.0
  pitch: number // 0.5 ~ 1.5
}

const SETTINGS_KEY = 'jan-v2-tts-settings'
const DEFAULT_SETTINGS: TTSSettings = { voice: '', rate: 1.0, pitch: 1.0 }

function loadSettings(): TTSSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TTSSettings>
      return {
        voice: typeof parsed.voice === 'string' ? parsed.voice : DEFAULT_SETTINGS.voice,
        rate: clamp(Number(parsed.rate), 0.5, 2.0, DEFAULT_SETTINGS.rate),
        pitch: clamp(Number(parsed.pitch), 0.5, 1.5, DEFAULT_SETTINGS.pitch),
      }
    }
  } catch { /* 손상된 설정은 무시 */ }
  return { ...DEFAULT_SETTINGS }
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * Phase 10 — 본문 읽어주기 (TTS).
 * 선택 영역이 있으면 그것만, 없으면 문서 전체.
 * 문장 청크 단위 순차 낭독 + 일시정지/재개 + 음성/속도/음높이 설정 팝오버.
 */
export function TTSButton({ editor }: TTSButtonProps) {
  const uiLang = useI18nStore((s) => s.lang)
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(null)
  const [popOpen, setPopOpen] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [settings, setSettings] = useState<TTSSettings>(loadSettings)
  const [selEmpty, setSelEmpty] = useState(true)
  const sessionRef = useRef<TTSSessionHandle | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)

  // 목소리 목록 — voiceschanged 는 비동기로 늦게 오므로 이벤트 구독
  useEffect(() => {
    if (!isTTSSupported()) return
    const load = () => setVoices(getTTSVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // 설정 영속화
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* 무시 */ }
  }, [settings])

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

  // 팝오버가 열려 있는 동안 읽기 대상(선택/전체) 표시를 최신으로 유지
  useEffect(() => {
    if (!editor) return
    const update = () => setSelEmpty(editor.state.selection.empty)
    update()
    if (!popOpen) return
    editor.on('selectionUpdate', update)
    return () => { editor.off('selectionUpdate', update) }
  }, [popOpen, editor])

  // 언마운트 시 낭독 정리 — 버튼이 사라진 뒤에도 낭독이 계속되지 않게
  useEffect(() => () => {
    sessionRef.current?.cancel()
    sessionRef.current = null
    cancelTTS()
  }, [])

  if (!isTTSSupported()) return null

  const resetState = () => {
    sessionRef.current = null
    setSpeaking(false)
    setPaused(false)
    setProgress(null)
  }

  const startReading = () => {
    const ed = editor
    if (!ed) return
    sessionRef.current?.cancel()
    const sel = ed.state.selection
    const text = sel.empty
      ? ed.state.doc.textContent
      : ed.state.doc.textBetween(sel.from, sel.to, ' ')
    if (!text.trim()) return
    const session = startTTSSession({
      text,
      lang: LANG_MAP[uiLang] || 'ko-KR',
      rate: settings.rate,
      pitch: settings.pitch,
      voice: settings.voice || undefined,
      onProgress: (cur, total) => setProgress({ cur, total }),
      onDone: resetState,
      onError: resetState,
    })
    if (session) {
      sessionRef.current = session
      setSpeaking(true)
      setPaused(false)
    }
  }

  const stopReading = () => {
    sessionRef.current?.cancel()
    resetState()
  }

  const togglePause = () => {
    const s = sessionRef.current
    if (!s) return
    if (paused) {
      s.resume()
      setPaused(false)
    } else {
      s.pause()
      setPaused(true)
    }
  }

  const patch = (p: Partial<TTSSettings>) => setSettings((s) => ({ ...s, ...p }))

  const koVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('ko'))
  const otherVoices = voices.filter((v) => !v.lang.toLowerCase().startsWith('ko'))

  const mainTitle = speaking
    ? 'TTS 정지'
    : selEmpty ? '전체 문서 읽기' : '선택 영역 읽기'

  return (
    <span className="jan-speech-wrap" ref={wrapRef}>
      <button
        onClick={speaking ? stopReading : startReading}
        className={speaking ? 'is-active' : ''}
        title={mainTitle}
        aria-label={mainTitle}
        aria-pressed={speaking}
      >
        {speaking ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
        ) : (
          <Icon name="speaker" size={14} />
        )}
        <span>{speaking ? '정지' : '재생'}</span>
        {speaking && progress && progress.total > 1 && (
          <span className="jan-speech-mini">{progress.cur}/{progress.total}</span>
        )}
      </button>
      <button
        className={`jan-speech-caret ${popOpen ? 'is-active' : ''}`}
        onClick={() => setPopOpen((o) => !o)}
        title="읽어주기 설정"
        aria-label="읽어주기 설정"
        aria-haspopup="dialog"
        aria-expanded={popOpen}
      >
        <Icon name="chevron-down" size={12} />
      </button>

      {popOpen && (
        <div className="jan-speech-pop" role="dialog" aria-label="읽어주기 설정">
          <div className="jan-speech-pop-title">읽어주기 설정</div>
          <div className="jan-speech-status">
            읽기 대상: {selEmpty ? '전체 문서' : '선택 영역'}
          </div>

          {speaking && progress && (
            <div className="jan-speech-progressrow">
              <span aria-live="polite">
                {paused ? '일시정지됨' : '읽는 중'} — {progress.cur}/{progress.total} 문장
              </span>
              <button onClick={togglePause} aria-label={paused ? '낭독 재개' : '낭독 일시정지'}>
                {paused ? '재개' : '일시정지'}
              </button>
            </div>
          )}

          <label className="jan-speech-field">
            <span>음성 선택</span>
            <select
              value={settings.voice}
              onChange={(e) => patch({ voice: e.target.value })}
              aria-label="음성 선택"
            >
              <option value="">브라우저 기본값</option>
              {koVoices.length > 0 && (
                <optgroup label="한국어">
                  {koVoices.map((v) => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </optgroup>
              )}
              {otherVoices.length > 0 && (
                <optgroup label="기타 언어">
                  {otherVoices.map((v) => (
                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          <label className="jan-speech-field">
            <span>속도 <b>{settings.rate.toFixed(1)}x</b></span>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={settings.rate}
              onChange={(e) => patch({ rate: Number(e.target.value) })}
              aria-label="읽기 속도"
            />
          </label>

          <label className="jan-speech-field">
            <span>음높이 <b>{settings.pitch.toFixed(1)}</b></span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.1}
              value={settings.pitch}
              onChange={(e) => patch({ pitch: Number(e.target.value) })}
              aria-label="음높이"
            />
          </label>

          {speaking && (
            <div className="jan-speech-hint">변경한 설정은 다음 낭독부터 적용됩니다</div>
          )}
        </div>
      )}
    </span>
  )
}

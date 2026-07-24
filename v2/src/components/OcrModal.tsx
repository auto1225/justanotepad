import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { startOcr, downscaleForOcr, OcrCancelledError, type OcrHandle } from '../lib/ocr'
import './ocr-modal.css'

interface OcrModalProps {
  editor: Editor | null
  onClose: () => void
}

type ItemStatus = 'pending' | 'converting' | 'running' | 'done' | 'error' | 'cancelled'

interface OcrItem {
  id: number
  file: File
  name: string
  previewUrl: string
  status: ItemStatus
  progress: number
  text: string
  confidence: number | null
  error: string
}

const LANG_OPTIONS = [
  { value: 'kor+eng', label: '한국어 + 영어' },
  { value: 'kor', label: '한국어' },
  { value: 'eng', label: '영어' },
  { value: 'jpn+eng', label: '일본어 + 영어' },
  { value: 'chi_sim+eng', label: '중국어 (간체) + 영어' },
]

const LANG_STORAGE_KEY = 'jan-ocr-lang'
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

function loadSavedLang(): string {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved && LANG_OPTIONS.some((o) => o.value === saved)) return saved
    return 'kor+eng'
  } catch {
    return 'kor+eng'
  }
}

function isHeicFile(file: File): boolean {
  return (
    /\.(heic|heif)$/i.test(file.name) ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'
  )
}

function statusLabel(it: OcrItem): string {
  switch (it.status) {
    case 'pending':
      return '대기'
    case 'converting':
      return 'HEIC 변환 중'
    case 'running':
      return `인식 중 ${Math.round(it.progress * 100)}%`
    case 'done':
      return it.confidence !== null ? `완료 · 신뢰도 ${Math.round(it.confidence)}%` : '완료'
    case 'cancelled':
      return '취소됨'
    case 'error':
      return '실패'
  }
}

/**
 * Phase 14 — OCR 모달 (로컬 Tesseract 경로).
 * 파일 선택 / 드래그 앤 드롭 / 클립보드 붙여넣기 → 큐에 쌓아 순차 인식 →
 * 편집 가능한 결과 → 클립보드 복사 또는 메모 삽입.
 */
export function OcrModal({ editor, onClose }: OcrModalProps) {
  const [items, setItems] = useState<OcrItem[]>([])
  const [lang, setLang] = useState(loadSavedLang)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [resultText, setResultText] = useState('')
  const [copied, setCopied] = useState(false)
  const [rejectMsg, setRejectMsg] = useState('')

  const itemsRef = useRef<OcrItem[]>([])
  const runningRef = useRef(false)
  const stopRequestedRef = useRef(false)
  const handleRef = useRef<OcrHandle | null>(null)
  const langRef = useRef(lang)
  const nextIdRef = useRef(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const copyTimerRef = useRef<number | null>(null)

  /** itemsRef 를 동기로 갱신하고 상태를 미러링한다 (pump 루프가 ref 를 읽음). */
  const patchItem = useCallback((id: number, patch: Partial<OcrItem>) => {
    itemsRef.current = itemsRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it))
    setItems(itemsRef.current)
  }, [])

  const appendResult = useCallback((name: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setResultText((prev) =>
      prev.trim() ? `${prev.replace(/\s+$/, '')}\n\n----- ${name} -----\n${trimmed}` : trimmed,
    )
  }, [])

  const processOne = useCallback(
    async (item: OcrItem) => {
      try {
        let source: Blob = item.file
        if (isHeicFile(item.file)) {
          // iOS/macOS 의 HEIC 은 Tesseract 가 못 읽으므로 JPEG 로 먼저 변환
          patchItem(item.id, { status: 'converting' })
          const { default: heic2any } = await import('heic2any')
          const converted = await heic2any({ blob: item.file, toType: 'image/jpeg', quality: 0.9 })
          source = Array.isArray(converted) ? converted[0] : converted
        }
        if (stopRequestedRef.current) {
          patchItem(item.id, { status: 'cancelled' })
          return
        }
        // 대형 이미지는 긴 변 2500px 로 축소 → 속도 개선
        source = await downscaleForOcr(source)
        if (stopRequestedRef.current) {
          patchItem(item.id, { status: 'cancelled' })
          return
        }
        patchItem(item.id, { status: 'running', progress: 0 })
        const handle = startOcr(source, langRef.current, (p) => patchItem(item.id, { progress: p }))
        handleRef.current = handle
        const res = await handle.promise
        handleRef.current = null
        patchItem(item.id, {
          status: 'done',
          progress: 1,
          text: res.text.trim(),
          confidence: res.confidence,
        })
        appendResult(item.name, res.text)
      } catch (err) {
        handleRef.current = null
        if (err instanceof OcrCancelledError) {
          patchItem(item.id, { status: 'cancelled' })
        } else {
          patchItem(item.id, {
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    },
    [appendResult, patchItem],
  )

  /** 큐를 순차 처리. 이미 돌고 있으면 그 루프가 새 항목까지 처리한다. */
  const pump = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    stopRequestedRef.current = false
    setBusy(true)
    for (;;) {
      if (stopRequestedRef.current) break
      const next = itemsRef.current.find((it) => it.status === 'pending')
      if (!next) break
      await processOne(next)
    }
    runningRef.current = false
    setBusy(false)
  }, [processOne])

  const addFiles = useCallback(
    (files: File[]) => {
      const rejected: string[] = []
      const accepted: OcrItem[] = []
      for (const file of files) {
        if (!isHeicFile(file) && !file.type.startsWith('image/')) {
          rejected.push(`${file.name || '이름 없는 파일'}: 이미지 파일이 아닙니다`)
          continue
        }
        if (file.size > MAX_FILE_SIZE) {
          rejected.push(`${file.name || '이름 없는 파일'}: 이미지가 너무 큽니다 (20MB 제한)`)
          continue
        }
        const id = nextIdRef.current++
        accepted.push({
          id,
          file,
          name: file.name || `붙여넣은 이미지 ${id}`,
          previewUrl: URL.createObjectURL(file),
          status: 'pending',
          progress: 0,
          text: '',
          confidence: null,
          error: '',
        })
      }
      setRejectMsg(rejected.join('\n'))
      if (accepted.length > 0) {
        itemsRef.current = [...itemsRef.current, ...accepted]
        setItems(itemsRef.current)
        void pump()
      }
    },
    [pump],
  )

  const retryItem = useCallback(
    (id: number) => {
      patchItem(id, { status: 'pending', progress: 0, error: '' })
      void pump()
    },
    [patchItem, pump],
  )

  /** 진행 중 작업을 실제로 중단 (현재 worker terminate + 대기 항목 취소). */
  const cancelAll = useCallback(() => {
    stopRequestedRef.current = true
    const h = handleRef.current
    handleRef.current = null
    if (h) void h.cancel()
    itemsRef.current = itemsRef.current.map((it) =>
      it.status === 'pending' || it.status === 'converting'
        ? { ...it, status: 'cancelled' as const }
        : it,
    )
    setItems(itemsRef.current)
  }, [])

  const requestClose = useCallback(() => {
    if (runningRef.current) {
      const ok = window.confirm('이미지 인식이 진행 중입니다. 중단하고 닫을까요?')
      if (!ok) return
      cancelAll()
    }
    onClose()
  }, [cancelAll, onClose])

  // Esc 로 닫기 (처리 중이면 확인 후)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  // 클립보드 붙여넣기 (Ctrl+V) 로 이미지 추가
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const list = e.clipboardData?.items
      if (!list) return
      const files: File[] = []
      for (const item of Array.from(list)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        addFiles(files)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addFiles])

  // 언마운트 시 정리: 진행 중 worker 중단 + 미리보기 URL 해제
  useEffect(() => {
    return () => {
      stopRequestedRef.current = true
      const h = handleRef.current
      handleRef.current = null
      if (h) void h.cancel()
      for (const it of itemsRef.current) URL.revokeObjectURL(it.previewUrl)
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    }
  }, [])

  function onLangChange(value: string) {
    setLang(value)
    langRef.current = value
    try {
      localStorage.setItem(LANG_STORAGE_KEY, value)
    } catch {
      // localStorage 접근 불가 환경 — 저장만 생략
    }
  }

  function clearQueue() {
    if (runningRef.current) return
    for (const it of itemsRef.current) URL.revokeObjectURL(it.previewUrl)
    itemsRef.current = []
    setItems([])
    setRejectMsg('')
  }

  async function copyResult() {
    if (!resultText.trim()) return
    try {
      await navigator.clipboard.writeText(resultText)
    } catch {
      // clipboard API 불가 시 임시 textarea 폴백
      const ta = document.createElement('textarea')
      ta.value = resultText
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500)
  }

  function insert() {
    if (!editor || !resultText.trim()) return
    editor.chain().focus().insertContent(escapeHtml(resultText).replace(/\n/g, '<br>')).run()
    onClose()
  }

  return (
    <div className="jan-modal-overlay" onClick={requestClose}>
      <div
        className="jan-modal jan-ocr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ocrm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jan-modal-head">
          <h3 id="ocrm-title">OCR — 이미지에서 텍스트 추출</h3>
          <button type="button" className="jan-modal-close" onClick={requestClose} aria-label="닫기">
            닫기
          </button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-row">
            <label htmlFor="ocrm-lang">언어:</label>
            <select
              id="ocrm-lang"
              value={lang}
              onChange={(e) => onLangChange(e.target.value)}
              disabled={busy}
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`ocrm-drop${dragOver ? ' is-over' : ''}${busy ? ' is-busy' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="이미지 파일 선택 — 클릭, 드래그 앤 드롭 또는 붙여넣기로 추가"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              addFiles(Array.from(e.dataTransfer.files))
            }}
          >
            <svg
              className="ocrm-drop-icon"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <div className="ocrm-drop-main">이미지를 끌어다 놓거나 클릭하여 선택</div>
            <div className="ocrm-drop-sub">
              붙여넣기(Ctrl+V) 지원 · 여러 장 가능 · JPG / PNG / HEIC · 장당 최대 20MB
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            hidden
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />

          {rejectMsg && <div className="jan-ai-error">{rejectMsg}</div>}

          {items.length > 0 && (
            <>
              <ul className="ocrm-queue" aria-label="이미지 대기열">
                {items.map((it) => (
                  <li key={it.id} className={`ocrm-item is-${it.status}`}>
                    <div className="ocrm-thumb" aria-hidden="true">
                      <img
                        src={it.previewUrl}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                    <div className="ocrm-item-body">
                      <div className="ocrm-item-name" title={it.name}>
                        {it.name}
                      </div>
                      <div className="ocrm-item-meta">
                        <span className={`ocrm-badge is-${it.status}`}>{statusLabel(it)}</span>
                      </div>
                      {it.status === 'running' && (
                        <div
                          className="ocrm-progress"
                          role="progressbar"
                          aria-label={`${it.name} 인식 진행률`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(it.progress * 100)}
                        >
                          <div
                            className="ocrm-progress-bar"
                            style={{ width: `${Math.round(it.progress * 100)}%` }}
                          />
                        </div>
                      )}
                      {it.status === 'error' && <div className="ocrm-item-error">{it.error}</div>}
                    </div>
                    {it.status === 'error' && (
                      <button
                        type="button"
                        className="ocrm-retry"
                        onClick={() => retryItem(it.id)}
                        aria-label={`${it.name} 다시 인식`}
                      >
                        재시도
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="ocrm-queue-actions">
                {busy ? (
                  <button type="button" className="ocrm-cancel" onClick={cancelAll}>
                    취소
                  </button>
                ) : (
                  <button type="button" className="ocrm-clear" onClick={clearQueue}>
                    목록 비우기
                  </button>
                )}
              </div>
            </>
          )}

          {resultText !== '' && (
            <div className="ocrm-result">
              <label className="ocrm-result-label" htmlFor="ocrm-result-text">
                인식 결과 ({resultText.length}자) — 삽입 전에 자유롭게 수정하세요
              </label>
              <textarea
                id="ocrm-result-text"
                className="ocrm-result-text"
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                rows={8}
                spellCheck={false}
              />
              <div className="ocrm-actions">
                <button
                  type="button"
                  className="ocrm-copy"
                  onClick={() => void copyResult()}
                  disabled={!resultText.trim()}
                  aria-live="polite"
                >
                  {copied ? '복사됨' : '클립보드 복사'}
                </button>
                <button
                  type="button"
                  className="ocrm-insert"
                  onClick={insert}
                  disabled={!editor || !resultText.trim()}
                >
                  메모에 삽입
                </button>
              </div>
            </div>
          )}

          {items.length === 0 && resultText === '' && (
            <div className="jan-settings-info">
              Tesseract.js (CDN) 가 처음 로드될 때 약 3MB 를 내려받습니다. 이후에는 캐시됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

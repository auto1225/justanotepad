import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Icon } from './Icons'
import { fileToDataUrl } from '../lib/attachments'
import { saveDataUrlAsBlobRef } from '../lib/blobRefs'
import { startSTT, isSTTSupported, type STTHandle } from '../lib/speech'
import {
  analyzeTranscriptLocal,
  buildMeetingHtml,
  buildMeetingText,
  buildSrt,
  downloadTextFile,
  formatClock,
  segmentId,
  type MeetingAnalysis,
  type MeetingKind,
  type MeetingSegment,
} from '../lib/meetingNotes'
import { writeFromTranscript } from '../lib/aiWrite'
import { aiConfigured } from '../lib/aiApi'
import { openAiConnect } from '../lib/aiConnect'

interface MeetingNotesModalProps {
  editor: Editor | null
  initialKind?: MeetingKind
  onClose: () => void
}

interface DraftState {
  kind: MeetingKind
  title: string
  participants: string
  agenda: string
  segments: MeetingSegment[]
  audioRef?: string
  audioName?: string
}

const DRAFT_KEY = 'jan.v2.meeting-notes.draft'

function readDraftState(initialKind: MeetingKind): DraftState {
  const fallback: DraftState = {
    kind: initialKind,
    title: initialKind === 'lecture' ? '강의노트' : '회의노트',
    participants: '',
    agenda: '',
    segments: [],
  }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return fallback
    const draft = JSON.parse(raw) as Partial<DraftState>
    /* 갈래는 부른 단추를 따른다 — 「강의 노트」 를 눌렀는데 지난번 회의 초안 때문에
       회의로 열리면 단추가 거짓말을 하는 셈이다. 적어 둔 글은 그대로 살린다. */
    const keptTitle = typeof draft.title === 'string' ? draft.title : fallback.title
    const wasOtherKind = (draft.kind === 'meeting' || draft.kind === 'lecture') && draft.kind !== initialKind
    return {
      kind: initialKind,
      title: wasOtherKind && keptTitle === (draft.kind === 'lecture' ? '강의노트' : '회의노트') ? fallback.title : keptTitle,
      participants: typeof draft.participants === 'string' ? draft.participants : fallback.participants,
      agenda: typeof draft.agenda === 'string' ? draft.agenda : fallback.agenda,
      segments: Array.isArray(draft.segments) ? draft.segments.filter(isMeetingSegment) : fallback.segments,
      audioRef: typeof draft.audioRef === 'string' ? draft.audioRef : '',
      audioName: typeof draft.audioName === 'string' ? draft.audioName : '',
    }
  } catch {
    return fallback
  }
}

function isMeetingSegment(value: unknown): value is MeetingSegment {
  if (!value || typeof value !== 'object') return false
  const segment = value as Partial<MeetingSegment>
  return typeof segment.id === 'string'
    && typeof segment.speaker === 'string'
    && typeof segment.text === 'string'
    && typeof segment.startMs === 'number'
    && typeof segment.endMs === 'number'
}

export function MeetingNotesModal({ editor, initialKind = 'meeting', onClose }: MeetingNotesModalProps) {
  const [draftSeed] = useState(() => readDraftState(initialKind))
  const [kind, setKind] = useState<MeetingKind>(draftSeed.kind)
  const [title, setTitle] = useState(draftSeed.title)
  const [participants, setParticipants] = useState(draftSeed.participants)
  const [agenda, setAgenda] = useState(draftSeed.agenda)
  const [manualText, setManualText] = useState('')
  const [segments, setSegments] = useState<MeetingSegment[]>(draftSeed.segments)
  const [interim, setInterim] = useState('')
  const [recording, setRecording] = useState(false)
  const [listening, setListening] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [audioRef, setAudioRef] = useState(draftSeed.audioRef || '')
  const [audioName, setAudioName] = useState(draftSeed.audioName || '')
  const [status, setStatus] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const mountedRef = useRef(true)
  /* 붙을 때 참으로 되돌려 놓는다 — 개발 모드는 효과를 한 번 붙였다 떼고 다시 붙이므로,
     떼는 자리에서만 거짓으로 두면 그 뒤로 영영 거짓이 된다 (그러면 「다 됐다」 를 알릴 길이 막힌다) */
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  const sttRef = useRef<STTHandle | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const analysis: MeetingAnalysis = useMemo(() => analyzeTranscriptLocal(segments), [segments])
  const transcriptText = useMemo(() => segments.map((segment) => segment.text).join('\n'), [segments])
  const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  useEffect(() => {
    const draft: DraftState = { kind, title, participants, agenda, segments, audioRef, audioName }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      return
    }
  }, [kind, title, participants, agenda, segments, audioRef, audioName])

  useEffect(() => {
    if (!recording && !listening) return
    const timer = window.setInterval(() => {
      if (startedAt) setElapsed(Date.now() - startedAt)
    }, 300)
    return () => window.clearInterval(timer)
  }, [recording, listening, startedAt])

  useEffect(() => () => {
    try {
      sttRef.current?.stop()
    } catch {
      // SpeechRecognition may already be closed by the browser.
    }
    sttRef.current = null

    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.stop()
      } catch {
        // MediaRecorder may already be closed by the browser.
      }
    }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  function ensureClockStarted() {
    if (startedAt) return startedAt
    const now = Date.now()
    setStartedAt(now)
    return now
  }

  function addSegment(text: string, startMs?: number, endMs?: number) {
    const clean = text.trim()
    if (!clean) return
    const last = segments[segments.length - 1]
    const start = startMs ?? (last ? last.endMs + 500 : elapsed)
    const end = endMs ?? Math.max(start + 1200, elapsed || start + 1200)
    setSegments((prev) => [
      ...prev,
      {
        id: segmentId(),
        speaker: `발언 ${prev.length + 1}`,
        text: clean,
        startMs: start,
        endMs: end,
      },
    ])
  }

  function addManual() {
    const lines = manualText.split(/\n+/).map((line) => line.trim()).filter(Boolean)
    lines.forEach((line) => addSegment(line))
    setManualText('')
    setStatus(`${lines.length}개 발언을 추가했습니다.`)
  }

  function startListening() {
    if (!isSTTSupported()) {
      setStatus('이 브라우저는 실시간 받아쓰기를 지원하지 않습니다.')
      return
    }
    const base = ensureClockStarted()
    const handle = startSTT({
      lang: 'ko-KR',
      interim: true,
      onResult: (text, isFinal) => {
        const now = Date.now() - base
        if (isFinal) {
          addSegment(text, Math.max(0, now - 2400), now)
          setInterim('')
        } else {
          setInterim(text)
        }
      },
      onError: (error) => {
        setStatus('받아쓰기 오류: ' + error.message)
        setListening(false)
        sttRef.current = null
      },
      onEnd: () => {
        setListening(false)
        sttRef.current = null
      },
    })
    if (handle) {
      sttRef.current = handle
      setListening(true)
      setStatus('실시간 받아쓰기를 시작했습니다.')
    }
  }

  function stopListening() {
    try {
      sttRef.current?.stop()
    } catch {
      // SpeechRecognition can throw if it has already ended.
    }
    sttRef.current = null
    setListening(false)
    setInterim('')
  }

  async function startRecording() {
    if (!canRecord) {
      setStatus('이 브라우저는 마이크 녹음을 지원하지 않습니다.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickAudioMime()
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      streamRef.current = stream
      recorderRef.current = recorder
      ensureClockStarted()
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        void persistRecording(mime || recorder.mimeType || 'audio/webm')
      }
      recorder.start(1000)
      setRecording(true)
      setStatus('녹음을 시작했습니다.')
    } catch (error: unknown) {
      setStatus('마이크 접근 실패: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      try { recorder.stop() } catch {
        // MediaRecorder can already be stopped by permission revocation.
      }
    }
    setRecording(false)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function persistRecording(mimeType: string) {
    const chunks = chunksRef.current
    if (!chunks.length) return
    try {
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
      const blob = new Blob(chunks, { type: mimeType })
      const dataUrl = await fileToDataUrl(blob)
      const ref = await saveDataUrlAsBlobRef(dataUrl)
      const name = `${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`
      if (mountedRef.current) {
        setAudioRef(ref)
        setAudioName(name)
        setStatus('녹음 파일을 노트에 보존 가능한 형식으로 저장했습니다.')
      } else {
        // 모달이 닫힌 뒤에 녹음 저장이 끝난 경우 — draft 에 직접 반영해 다음에 열 때 복원되게 한다
        try {
          const raw = localStorage.getItem(DRAFT_KEY)
          const draft = raw ? JSON.parse(raw) : {}
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, audioRef: ref, audioName: name }))
        } catch {
          // localStorage 접근 불가 시 조용히 포기
        }
      }
    } catch (error: unknown) {
      if (mountedRef.current) setStatus('녹음 저장 실패: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  /**
   * 받아 적은 글을 AI 에게 넘겨 제대로 된 문서로 세운다.
   *
   * 이 창의 「자동 정리」 는 이 컴퓨터에서 낱말을 세어 뽑은 것이라 얼개만 잡아 준다.
   * 여기서 한 걸음 더 — 말한 순서를 회의록의 순서로 옮기고, 결정과 할 일을 갈라 적고,
   * 흐릿한 대목은 지어내지 않고 【확인: …】 로 남긴 문서를 받는다.
   */
  async function aiWriteUp() {
    const body = transcriptText.trim() || manualText.trim()
    if (!body) { setStatus('받아 적은 글이 없습니다.'); return }
    if (!aiConfigured()) {
      setStatus('AI 가 이어지지 않았습니다 — 「AI 연결」 에서 잇고 다시 누릅니다.')
      return
    }
    setAiBusy(true)
    setStatus(kind === 'meeting' ? '회의록을 쓰는 중…' : '강의 노트를 쓰는 중…')
    const r = await writeFromTranscript(body, kind === 'meeting' ? 'meeting' : 'lecture', title)
    if (!mountedRef.current) return
    setAiBusy(false)
    if (!r.ok || !r.html) { setStatus('자동 작성 실패: ' + (r.error || '까닭을 알 수 없다')); return }
    if (!editor) { setStatus('열어 둔 문서가 없습니다.'); return }
    editor.chain().focus().insertContent(r.html).run()
    setStatus(`문서로 세워 넣었습니다 — 글자 ${r.chars?.toLocaleString()}자`)
  }

  function insertIntoMemo() {
    if (!editor) return
    const html = buildMeetingHtml({
      kind,
      title,
      participants,
      agenda,
      segments,
      analysis,
      audioRef,
      audioName,
    })
    editor.chain().focus().insertContent(html).run()
    setStatus('현재 메모에 삽입했습니다.')
  }

  function exportTxt() {
    downloadTextFile(`${safeName(title)}.txt`, buildMeetingText({ kind, title, participants, agenda, segments, analysis, audioRef, audioName }))
  }

  function exportSrt() {
    downloadTextFile(`${safeName(title)}.srt`, buildSrt(segments), 'text/srt;charset=utf-8')
  }

  function clearDraft() {
    if (!confirm('현재 회의/강의 노트 초안을 비울까요?')) return
    setSegments([])
    setManualText('')
    setInterim('')
    setAudioRef('')
    setAudioName('')
    setStatus('초안을 비웠습니다.')
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // Draft cleanup is best-effort.
    }
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="jan-modal jan-meeting-modal" onClick={(event) => event.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>{kind === 'lecture' ? '강의노트' : '회의노트'}</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-meeting-body">
          <section className="jan-meeting-capture">
            <div className="jan-meeting-mode">
              <button className={kind === 'meeting' ? 'active' : ''} onClick={() => setKind('meeting')}>회의</button>
              <button className={kind === 'lecture' ? 'active' : ''} onClick={() => setKind('lecture')}>강의</button>
            </div>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목" />
            <input value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder={kind === 'lecture' ? '과목 / 강사 / 수강자' : '참석자'} />
            <textarea value={agenda} onChange={(event) => setAgenda(event.target.value)} placeholder={kind === 'lecture' ? '강의 주제 / 학습 목표' : '안건 / 목표'} rows={3} />

            <div className="jan-meeting-recorder">
              <div className={'jan-meeting-timer' + (recording || listening ? ' is-active' : '')}>
                <span>{formatClock(elapsed)}</span>
                <small>{recording ? '녹음 중' : listening ? '받아쓰기 중' : '대기'}</small>
              </div>
              <button onClick={recording ? stopRecording : startRecording} className={recording ? 'danger' : ''}>
                <Icon name={recording ? 'mic-off' : 'mic'} /> {recording ? '녹음 중지' : '녹음 시작'}
              </button>
              <button onClick={listening ? stopListening : startListening} className={listening ? 'danger' : ''}>
                <Icon name={listening ? 'mic-off' : 'speaker'} /> {listening ? '받아쓰기 중지' : '받아쓰기'}
              </button>
            </div>

            {audioRef && (
              <div className="jan-meeting-audio">
                <Icon name="paperclip" />
                <span>{audioName || '녹음 파일'} 저장됨</span>
              </div>
            )}

            <textarea
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              placeholder="수동으로 발언을 붙여넣거나 직접 입력하세요. 줄마다 하나의 발언으로 추가됩니다."
              rows={6}
            />
            <div className="jan-meeting-actions">
              <button onClick={addManual} disabled={!manualText.trim()}>발언 추가</button>
              <button onClick={clearDraft}>초안 비우기</button>
            </div>
          </section>

          <section className="jan-meeting-review">
            <div className="jan-meeting-summary">
              <div>
                <strong>{segments.length}</strong>
                <span>발언</span>
              </div>
              <div>
                <strong>{analysis.actions.length}</strong>
                <span>액션</span>
              </div>
              <div>
                <strong>{analysis.keywords.length}</strong>
                <span>키워드</span>
              </div>
            </div>

            {interim && <div className="jan-meeting-interim">{interim}</div>}

            <div className="jan-meeting-transcript-list">
              {segments.length === 0 ? (
                <div className="jan-meeting-empty">녹음, 받아쓰기, 또는 수동 입력으로 발언을 추가하세요.</div>
              ) : segments.map((segment) => (
                <article key={segment.id}>
                  <span>{formatClock(segment.startMs)}</span>
                  <strong>{segment.speaker}</strong>
                  <p>{segment.text}</p>
                </article>
              ))}
            </div>

            <div className="jan-meeting-result">
              <h4>자동 정리</h4>
              <ul>{analysis.summary.map((item) => <li key={item}>{item}</li>)}</ul>
              {analysis.actions.length > 0 && (
                <>
                  <h4>액션 아이템</h4>
                  <ul>{analysis.actions.map((item) => <li key={item.task}>{item.task}</li>)}</ul>
                </>
              )}
            </div>

            <div className="jan-meeting-actions">
              <button
                onClick={() => void aiWriteUp()}
                className="primary"
                disabled={aiBusy || !editor || (!segments.length && !transcriptText.trim() && !manualText.trim())}
                title={kind === 'meeting'
                  ? '받아 적은 글을 AI 가 회의록으로 세운다 — 결정과 할 일을 갈라 적는다'
                  : '받아 적은 글을 AI 가 강의 노트로 세운다 — 핵심과 곁가지를 갈라 적는다'}
              >
                {aiBusy ? '쓰는 중…' : (kind === 'meeting' ? 'AI 로 회의록 만들기' : 'AI 로 강의 노트 만들기')}
              </button>
              <button onClick={insertIntoMemo} disabled={!editor || (!segments.length && !transcriptText.trim())}>받아 적은 대로 넣기</button>
              <button onClick={exportTxt} disabled={!segments.length}>TXT</button>
              <button onClick={exportSrt} disabled={!segments.length}>SRT</button>
              {!aiConfigured() && <button onClick={openAiConnect}>AI 연결</button>}
            </div>
            {status && <div className="jan-meeting-status">{status}</div>}
          </section>
        </div>
      </div>
    </div>
  )
}

function pickAudioMime(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  for (const mime of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

function safeName(value: string): string {
  return (value || 'meeting-note').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)
}

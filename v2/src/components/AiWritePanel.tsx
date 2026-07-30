import { useEffect, useRef, useState } from 'react'
import {
  DOC_KINDS, LENGTHS, TONES, docKind, makeOutline, writeDoc,
  type DocLength, type DocSpec, type DocTone,
} from '../lib/aiWrite'
import { aiConfigured } from '../lib/aiApi'
import { connState, openAiConnect } from '../lib/aiConnect'
import { useDocStore } from '../store/docStore'
import { useMemosStore } from '../store/memosStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { flash } from '../lib/flash'

interface Props {
  /** 리본에서 어떤 갈래로 불렀나 */
  initialKind?: string
  onClose: () => void
}

const DRAFT_KEY = 'jan-v2-aiwrite-spec'

interface Draft {
  kind: string
  length: DocLength
  tone: DocTone
  reader: string
}

const BLANK: Draft = { kind: 'report', length: 'normal', tone: 'plain', reader: '' }

/** 지난번에 고른 갈래·분량·말투를 그대로 꺼낸다 (주제만 새로 적게) */
function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return { ...BLANK, ...JSON.parse(raw) as Partial<Draft> }
  } catch { /* 기억 못 해도 쓰는 데는 지장이 없다 */ }
  return BLANK
}

/**
 * 문서 자동 작성 — 「이 주제로 문서 만들어 줘」 한 마디로 한 벌이 나온다.
 *
 * 두 걸음을 쓸 수 있게 두었다.
 *  · 「목차부터 보기」 — 목차를 먼저 받아 손보고 그 목차대로 본문을 채운다.
 *    사람이 한 번 끼어들면 결과가 크게 나아진다 (절이 겹치거나 빠지는 것을 여기서 잡는다).
 *  · 「바로 만들기」 — 급할 때 한 번에.
 *
 * 다 되면 새 메모로 앉히거나 쓰던 자리에 꽂는다. 지우고 다시 부탁하는 길도 함께 둔다.
 */
export function AiWritePanel({ initialKind, onClose }: Props) {
  const saved = loadDraft()
  const [topic, setTopic] = useState('')
  const [kind, setKind] = useState(initialKind || saved.kind)
  const [length, setLength] = useState<DocLength>(saved.length)
  const [tone, setTone] = useState<DocTone>(saved.tone)
  const [reader, setReader] = useState(saved.reader)
  const [extra, setExtra] = useState('')

  const [busy, setBusy] = useState<'' | 'outline' | 'write'>('')
  const [startedAt, setStartedAt] = useState(0)
  const [secs, setSecs] = useState(0)
  const [outline, setOutline] = useState('')
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')

  const topicRef = useRef<HTMLTextAreaElement>(null)
  const editor = useDocStore((s) => s.editor)
  const newMemo = useMemosStore((s) => s.newMemo)
  const updateCurrent = useMemosStore((s) => s.updateCurrent)
  const setCurrent = useMemosStore((s) => s.setCurrent)

  const info = docKind(kind)
  const conn = connState()
  const ready = aiConfigured()

  useEffect(() => { topicRef.current?.focus() }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  /* 기다리는 동안 몇 초가 갔는지 보여 준다 — 열 장짜리는 1분을 넘긴다.
     시작 시각을 눌린 자리에서 적어 두고 여기서는 셈만 한다 (효과가 렌더를 부르지 않게) */
  useEffect(() => {
    if (!busy) return
    const tick = () => setSecs(Math.round((Date.now() - startedAt) / 1000))
    const t = window.setInterval(tick, 500)
    return () => window.clearInterval(t)
  }, [busy, startedAt])

  function remember(patch: Partial<Draft>) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ kind, length, tone, reader, ...patch }))
    } catch { /* 못 적어도 그만 */ }
  }

  function currentSpec(): DocSpec {
    return { topic, kind, length, tone, reader, extra }
  }

  async function runOutline() {
    setError('')
    setStartedAt(Date.now())
    setSecs(0)
    setBusy('outline')
    const r = await makeOutline(currentSpec())
    setBusy('')
    if (!r.ok) { setError(r.error || '목차를 받지 못했다'); return }
    setOutline(r.outline || '')
  }

  async function runWrite(useOutline: boolean) {
    setError('')
    setStartedAt(Date.now())
    setSecs(0)
    setBusy('write')
    const r = await writeDoc(currentSpec(), useOutline ? outline : undefined)
    setBusy('')
    if (!r.ok) { setError(r.error || '문서를 받지 못했다'); return }
    setHtml(r.html || '')
    flash(`문서를 받았다 — 글자 ${r.chars?.toLocaleString()}자`)
  }

  /** 다 된 문서를 새 메모로 앉힌다 */
  function toNewMemo() {
    const id = newMemo()
    const ws = useWorkspaceStore.getState()
    if (ws.currentWsId) ws.assignMemo(id, ws.currentWsId)
    /* 제목은 문서의 <h1> 을 쓴다 — 없으면 주제 첫 줄 */
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, '').trim()
    updateCurrent({ title: (h1 || topic.split('\n')[0]).slice(0, 60), content: html })
    setCurrent(id)
    flash('새 메모로 앉혔다')
    onClose()
  }

  /** 쓰던 자리에 꽂는다 */
  function toCursor() {
    if (!editor || editor.isDestroyed) { flash('열어 둔 문서가 없다'); return }
    editor.chain().focus().insertContent(html).run()
    flash('쓰던 자리에 넣었다')
    onClose()
  }

  function onFormKey(e: React.KeyboardEvent) {
    /* 수식어 하나로 — 적다가 곧바로 시킨다 */
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (!busy && ready && topic.trim()) void runWrite(!!outline.trim())
    }
  }

  const waiting = busy !== ''

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-aiwrite" role="dialog" aria-label="문서 자동 작성" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>문서 자동 작성</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-modal-body jan-aiwrite-body" onKeyDown={onFormKey}>
          {!ready && (
            <div className="jan-aiwrite-noconn" role="alert">
              <span>AI 가 아직 이어지지 않았다 — 내가 쓰는 AI 를 잇고 나면 문서를 만들 수 있다.</span>
              <button className="jan-primary" onClick={() => { openAiConnect(); onClose() }}>AI 연결 열기</button>
            </div>
          )}

          <label className="jan-aiwrite-topic">
            <span>무엇을 만들까</span>
            <textarea
              ref={topicRef}
              value={topic}
              rows={2}
              aria-label="무엇을 만들까"
              placeholder={info.sample}
              onChange={(e) => setTopic(e.target.value)}
            />
          </label>

          <div className="jan-aiwrite-row">
            <label className="jan-chartdlg-field">
              <span>문서 갈래</span>
              <select
                value={kind}
                aria-label="문서 갈래"
                onChange={(e) => { setKind(e.target.value); remember({ kind: e.target.value }); setOutline(''); setHtml('') }}
              >
                {DOC_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </label>
            <label className="jan-chartdlg-field">
              <span>읽는 사람</span>
              <input
                type="text"
                value={reader}
                aria-label="읽는 사람"
                placeholder="임원 · 실무자 · 고객 · 학생 …"
                onChange={(e) => { setReader(e.target.value); remember({ reader: e.target.value }) }}
              />
            </label>
          </div>
          <p className="jan-aiwrite-frame">{info.hint}</p>

          <div className="jan-aiwrite-row">
            <fieldset className="jan-aiwrite-pick">
              <legend>분량</legend>
              {LENGTHS.map((l) => (
                <label key={l.key} className={length === l.key ? 'is-active' : ''}>
                  <input
                    type="radio"
                    name="jan-aiwrite-length"
                    checked={length === l.key}
                    aria-label={l.label + ' ' + l.hint}
                    onChange={() => { setLength(l.key); remember({ length: l.key }) }}
                  />
                  {l.label}
                </label>
              ))}
            </fieldset>
            <fieldset className="jan-aiwrite-pick">
              <legend>말투</legend>
              {TONES.map((t) => (
                <label key={t.key} className={tone === t.key ? 'is-active' : ''}>
                  <input
                    type="radio"
                    name="jan-aiwrite-tone"
                    checked={tone === t.key}
                    aria-label={t.label}
                    onChange={() => { setTone(t.key); remember({ tone: t.key }) }}
                  />
                  {t.label}
                </label>
              ))}
            </fieldset>
          </div>

          <label className="jan-aiwrite-topic">
            <span>알려 줄 것 · 꼭 넣을 것 (없으면 비워 둔다)</span>
            <textarea
              value={extra}
              rows={3}
              aria-label="알려 줄 것"
              placeholder={'아는 숫자 · 이름 · 날짜를 적어 두면 그대로 쓴다.\n적지 않은 숫자는 지어내지 않고 【확인: …】 로 남긴다.'}
              onChange={(e) => setExtra(e.target.value)}
            />
          </label>

          {outline && (
            <label className="jan-aiwrite-topic">
              <span>목차 — 고쳐도 된다. 이대로 본문을 채운다</span>
              <textarea
                value={outline}
                rows={8}
                aria-label="목차"
                onChange={(e) => setOutline(e.target.value)}
              />
            </label>
          )}

          {waiting && (
            <div className="jan-aiwrite-busy" role="status">
              {busy === 'outline' ? '목차를 짜는 중' : '문서를 쓰는 중'} … {secs}초
              <em>{length === 'full' ? '열 장짜리는 1~3분이 걸린다' : '창을 닫지 말고 기다린다'}</em>
            </div>
          )}
          {error && <div className="jan-aiwrite-error" role="alert">{error}</div>}

          {html && !waiting && (
            <div className="jan-aiwrite-done">
              {/* 미리보기 — 이 html 은 cleanDocHtml 을 지나온 것이다 (허용한 태그와 colspan·rowspan 만 남고
                  script·style·on… 은 모두 떨어진다). 모델이 낸 글이므로 그 걸름망 없이는 붙이지 않는다. */}
              <div className="jan-aiwrite-preview" aria-label="만들어진 문서 미리보기" dangerouslySetInnerHTML={{ __html: html }} />
              <div className="jan-aiwrite-donerow">
                <button className="jan-primary" onClick={toNewMemo}>새 메모로 앉히기</button>
                <button onClick={toCursor} disabled={!editor}>쓰던 자리에 넣기</button>
                <button onClick={() => { setHtml(''); void runWrite(!!outline.trim()) }}>다시 쓰기</button>
              </div>
              {/【확인:/.test(html) && (
                <p className="jan-aiwrite-frame">
                  【확인: …】 은 지어내지 않고 비워 둔 자리다 — 아는 값으로 채워 넣는다.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">
            {conn.ready ? `${conn.label} · ${conn.model}` : 'AI 연결 필요'} · Ctrl+Enter 로 바로 시작
          </span>
          <button onClick={onClose}>닫기</button>
          <button onClick={() => void runOutline()} disabled={waiting || !ready || !topic.trim()}>
            목차부터 보기
          </button>
          <button
            className="jan-primary"
            onClick={() => void runWrite(!!outline.trim())}
            disabled={waiting || !ready || !topic.trim()}
          >
            {outline.trim() ? '이 목차로 문서 쓰기' : '바로 만들기'}
          </button>
        </div>
      </div>
    </div>
  )
}

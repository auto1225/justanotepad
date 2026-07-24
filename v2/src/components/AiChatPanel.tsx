import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { runAi, aiConfigured } from '../lib/aiApi'
import { useMemosStore } from '../store/memosStore'

interface AiChatPanelProps {
  editor: Editor | null
  onClose: () => void
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

/**
 * Phase 14 — AI 챗 사이드 패널.
 * 현재 메모 본문을 컨텍스트로 사용. 메모리는 세션 내.
 * 응답에서 사용자가 "메모에 추가" 가능.
 */
export function AiChatPanel({ editor, onClose }: AiChatPanelProps) {
  const memo = useMemosStore((s) => s.current())
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function send() {
    const q = input.trim()
    if (!q || busy) return
    if (!aiConfigured()) {
      alert('설정에서 AI 키 또는 프록시를 활성화하세요.')
      return
    }
    const user: ChatMsg = { role: 'user', content: q, ts: Date.now() }
    setMessages((m) => [...m, user])
    setInput('')
    setBusy(true)

    // 메모 본문 컨텍스트 + 직전 대화
    const context = memo ? plainText(memo.content).slice(0, 4000) : ''
    const history = messages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`)
      .join('\n')
    const prompt = `당신은 사용자의 메모를 함께 다루는 한국어 AI 어시스턴트입니다.
${context ? '현재 메모 컨텍스트:\n' + context + '\n\n' : ''}${history ? '대화 기록:\n' + history + '\n\n' : ''}사용자 질문: ${q}

답변은 명확하고 구체적이며, 메모와 직접 관련 있는 경우 인용. 5문단 이내.`

    try {
      const r = await runAi('raw', prompt)
      if (r.ok && r.text) {
        setMessages((m) => [...m, { role: 'assistant', content: r.text!, ts: Date.now() }])
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: '[오류] ' + (r.error || '응답 없음'), ts: Date.now() }])
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: '[오류] ' + (e?.message || e), ts: Date.now() }])
    } finally {
      setBusy(false)
    }
  }

  function insertToMemo(text: string) {
    if (!editor) return
    // 모델 출력은 신뢰하지 않는 텍스트 — HTML 로 해석되지 않게 이스케이프
    editor.chain().focus().insertContent('<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>').run()
  }

  function clear() {
    if (confirm('대화 기록을 지울까요?')) setMessages([])
  }

  return (
    <div className="jan-chat-panel">
      <div className="jan-chat-head">
        <h3>AI 챗</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={clear} title="대화 지우기">초기화</button>
          <button onClick={onClose} title="닫기">×</button>
        </div>
      </div>
      <div className="jan-chat-body" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="jan-chat-empty">
            현재 메모를 컨텍스트로 사용해 질문할 수 있습니다.
            <br /><br />
            예: <i>"이 글 핵심 3줄로 요약해줘"</i>, <i>"이 내용에서 보완할 부분?"</i>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={'jan-chat-msg is-' + m.role}>
            <div className="jan-chat-bubble">{m.content}</div>
            {m.role === 'assistant' && (
              <button className="jan-chat-insert" onClick={() => insertToMemo(m.content)}>
                메모에 삽입 ↓
              </button>
            )}
          </div>
        ))}
        {busy && <div className="jan-chat-msg is-assistant"><div className="jan-chat-bubble">생각 중...</div></div>}
      </div>
      <div className="jan-chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="질문 입력... (Enter 전송, Shift+Enter 줄바꿈)"
          rows={3}
        />
        <button onClick={send} disabled={busy || !input.trim()}>전송</button>
      </div>
    </div>
  )
}

function plainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || '').replace(/\s+/g, ' ').trim()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

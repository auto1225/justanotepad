import { useEffect, useRef, useState } from 'react'
import {
  PROVIDERS, chooseProvider, connState, discoverLocal, forgetKey, keyWarning,
  providerInfo, testConnection, connectLocal, type LocalFind, type TestResult,
} from '../lib/aiConnect'
import { useSettingsStore, type AiProvider } from '../store/settingsStore'
import { flash } from '../lib/flash'

interface Props {
  onClose: () => void
}

/**
 * AI 연결 — 내가 쓰는 AI 를 이 앱에 잇는 자리.
 *
 * 두 가지를 붙들고 만들었다.
 *  · 키는 이 브라우저에만 적어 둔다. 부탁은 브라우저에서 그 회사로 곧장 가고,
 *    우리 서버를 거치지 않는다. 그러니 남의 컴퓨터에서 썼다면 「키 지우기」 로 치운다.
 *  · 「저장했다」 는 이어졌다는 뜻이 아니다. 그래서 진짜로 한 번 물어보는
 *    「연결 시험」 을 두었다 — 키가 틀렸는지, 요금이 떨어졌는지는 답을 받아 봐야 안다.
 *
 * 키가 아예 없어도 되는 길도 함께 둔다 — 내 컴퓨터에서 도는 모델(Ollama·LM Studio).
 * 「내 컴퓨터에서 찾기」 를 누르면 흔한 문을 두드려 찾아 곧바로 잇는다.
 */
export function AiConnectPanel({ onClose }: Props) {
  const settings = useSettingsStore()
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [finding, setFinding] = useState(false)
  const [found, setFound] = useState<LocalFind[] | null>(null)
  const keyRef = useRef<HTMLInputElement>(null)

  const provider = settings.aiProvider
  const info = providerInfo(provider)
  const state = connState()
  const key = info?.keyField ? settings[info.keyField] : ''
  const warn = info?.keyField ? keyWarning(provider, key) : ''

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  /* 제공자를 바꾸면 시험 결과는 지난 이야기가 된다 */
  function pick(id: AiProvider) {
    chooseProvider(id)
    setResult(null)
    setShowKey(false)
  }

  function setModel(v: string) {
    settings.setKey('aiModel', v)
    setResult(null)
  }

  async function paste() {
    try {
      const t = await navigator.clipboard.readText()
      if (!t.trim()) { flash('복사한 것이 없다'); return }
      if (info?.keyField) settings.setKey(info.keyField, t.trim())
      setResult(null)
      flash('붙여 넣었다')
    } catch {
      /* 브라우저가 읽기를 막으면 손으로 붙여 넣게 칸에 초점을 준다 */
      keyRef.current?.focus()
      flash('칸에 직접 붙여 넣으세요 (Ctrl+V)')
    }
  }

  async function test() {
    setTesting(true)
    setResult(null)
    const r = await testConnection()
    setResult(r)
    setTesting(false)
  }

  async function find() {
    setFinding(true)
    setFound(null)
    const list = await discoverLocal()
    setFound(list)
    setFinding(false)
    if (list.length === 0) {
      flash('내 컴퓨터에서 도는 모델을 못 찾았다 — Ollama 나 LM Studio 를 켜고 다시 찾는다', 3600)
      return
    }
    connectLocal(list[0])
    setResult(null)
    flash(`${list[0].kind} 에 이었다 — 모델 ${list[0].models.length}개`)
  }

  function clearKey() {
    forgetKey()
    setResult(null)
    flash('적어 둔 키를 지웠다')
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-aiconn" role="dialog" aria-label="AI 연결" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>AI 연결</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-modal-body jan-aiconn-body">
          <div className={'jan-aiconn-now' + (state.ready ? ' is-ready' : '')} role="status">
            {provider === 'none'
              ? <span>아직 아무것도 잇지 않았다 — 아래에서 쓰는 AI 를 고른다</span>
              : <span><strong>{state.label}</strong> · 모델 {state.model}
                {state.masked ? ` · 키 ${state.masked}` : ''}
                {state.missing ? ` — ${state.missing}` : ''}</span>}
          </div>

          <fieldset className="jan-aiconn-list">
            <legend>어떤 AI 를 쓰나</legend>
            {PROVIDERS.map((prov) => (
              <label key={prov.id} className={provider === prov.id ? 'is-active' : ''}>
                <input
                  type="radio"
                  name="jan-ai-provider"
                  checked={provider === prov.id}
                  onChange={() => pick(prov.id)}
                  aria-label={prov.label}
                />
                <strong>{prov.label}</strong>
                <span>{prov.note}</span>
              </label>
            ))}
            <label className={provider === 'none' ? 'is-active' : ''}>
              <input
                type="radio"
                name="jan-ai-provider"
                checked={provider === 'none'}
                onChange={() => pick('none')}
                aria-label="쓰지 않음"
              />
              <strong>쓰지 않음</strong>
              <span>AI 기능을 끈다</span>
            </label>
          </fieldset>

          {info?.keyField && (
            <div className="jan-aiconn-key">
              <label className="jan-chartdlg-field">
                <span>{info.label} 키</span>
                <input
                  ref={keyRef}
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  aria-label={info.label + ' 키'}
                  placeholder={info.keyHint}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => { settings.setKey(info.keyField!, e.target.value); setResult(null) }}
                />
              </label>
              <div className="jan-aiconn-keyrow">
                <button onClick={() => void paste()}>붙여넣기</button>
                <button onClick={() => setShowKey((v) => !v)} aria-pressed={showKey}>
                  {showKey ? '가리기' : '보기'}
                </button>
                <button onClick={clearKey} disabled={!key}>키 지우기</button>
                {info.keyUrl && (
                  <a href={info.keyUrl} target="_blank" rel="noreferrer noopener">키 받는 곳 열기</a>
                )}
              </div>
              {warn && <p className="jan-aiconn-warn" role="alert">{warn}</p>}
              <p className="jan-chartdlg-hint">
                키는 이 브라우저에만 적어 둔다 (우리 서버로 보내지 않는다). 부탁은 브라우저에서
                {' '}{info.label} 로 곧장 간다. 남의 컴퓨터에서 썼다면 「키 지우기」 로 치운다.
              </p>
            </div>
          )}

          {provider === 'local' && (
            <div className="jan-aiconn-local">
              <label className="jan-chartdlg-field">
                <span>모델 서버 주소</span>
                <input
                  type="text"
                  value={settings.localUrl}
                  aria-label="모델 서버 주소"
                  placeholder="http://localhost:11434/v1"
                  onChange={(e) => { settings.setKey('localUrl', e.target.value); setResult(null) }}
                />
              </label>
              <div className="jan-aiconn-keyrow">
                <button className="jan-primary" onClick={() => void find()} disabled={finding}>
                  {finding ? '찾는 중…' : '내 컴퓨터에서 찾기'}
                </button>
              </div>
              {found && found.length > 0 && (
                <div className="jan-aiconn-found">
                  {found.map((f) => (
                    <div key={f.url} className={f.url === settings.localUrl ? 'is-active' : ''}>
                      <strong>{f.kind}</strong>
                      <span>{f.url}</span>
                      <select
                        value={f.url === settings.localUrl ? settings.aiModel : (f.models[0] || '')}
                        aria-label={f.kind + ' 모델 고르기'}
                        onChange={(e) => { connectLocal(f, e.target.value); setResult(null) }}
                      >
                        {f.models.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              {found && found.length === 0 && (
                <p className="jan-aiconn-warn">
                  켜져 있는 모델 서버를 못 찾았다. Ollama 는 설치하고 한 번 모델을 받아 두면
                  (ollama pull llama3.1) 컴퓨터를 켤 때 함께 돈다.
                </p>
              )}
              <p className="jan-chartdlg-hint">
                내 컴퓨터 모델은 키도 요금도 없고, 글이 이 컴퓨터를 떠나지 않는다. 대신 회사 모델보다 느리고
                결과도 수수하다 — 긴 문서를 최고 수준으로 뽑을 때는 회사 모델을 쓴다.
              </p>
            </div>
          )}

          {provider === 'proxy' && (
            <p className="jan-chartdlg-hint">
              앱을 서버에 올려 두고 그 서버에 키를 넣어 둔 때만 된다 (개인 컴퓨터에서 그냥 열었다면
              닿지 않는다). 「연결 시험」 으로 갈린다.
            </p>
          )}

          {info && info.models.length > 0 && (
            <label className="jan-chartdlg-field">
              <span>모델</span>
              <select value={settings.aiModel} aria-label="모델" onChange={(e) => setModel(e.target.value)}>
                {info.models.map((m) => <option key={m} value={m}>{m}</option>)}
                {!info.models.includes(settings.aiModel) && settings.aiModel && (
                  <option value={settings.aiModel}>{settings.aiModel} (직접 적음)</option>
                )}
              </select>
            </label>
          )}
          {info?.freeModel && (
            <label className="jan-chartdlg-field">
              <span>모델 이름을 직접 적기</span>
              <input
                type="text"
                value={settings.aiModel}
                aria-label="모델 이름"
                placeholder="새 모델이 나오면 여기에 이름을 적는다"
                onChange={(e) => setModel(e.target.value)}
              />
            </label>
          )}

          {result && (
            <div className={'jan-aiconn-result' + (result.ok ? ' is-ok' : ' is-bad')} role="status">
              {result.ok
                ? <span>이어졌다 — {(result.ms / 1000).toFixed(1)}초에 답했다. 모델의 말: 「{result.said}」</span>
                : <span>못 이었다 — {result.error}</span>}
            </div>
          )}
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">
            {provider === 'none' ? 'AI 를 고르면 시험할 수 있다' : '시험은 아주 짧은 부탁 한 번이다 (요금이 거의 들지 않는다)'}
          </span>
          <button onClick={onClose}>닫기</button>
          <button
            className="jan-primary"
            onClick={() => void test()}
            disabled={testing || provider === 'none' || !state.ready}
          >
            {testing ? '물어보는 중…' : '연결 시험'}
          </button>
        </div>
      </div>
    </div>
  )
}

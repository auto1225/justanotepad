import { chatAi, defaultModelFor, localBase, openaiKeyState } from './aiApi'
import { useSettingsStore, type AiProvider } from '../store/settingsStore'

/**
 * 내 AI 를 이 앱에 잇는 일 — 어디에 무엇을 넣어야 하는지, 정말 이어졌는지.
 *
 * 이 앱은 사용자의 키를 서버로 보내지 않는다. 키는 이 브라우저에만 적어 두고,
 * 부탁은 브라우저에서 그 회사로 바로 간다 (BYOK — 자기 키로 쓰기).
 * 그래서 「이어졌다」 는 말을 믿을 수 있게, 진짜로 한 번 물어보는 시험 단추를 둔다.
 */

export interface ProviderInfo {
  id: AiProvider
  /** 사람에게 보일 이름 */
  label: string
  /** 한 줄 설명 */
  note: string
  /** 키를 적어 두는 설정 칸 (키가 필요 없으면 없다) */
  keyField?: 'anthropicKey' | 'openaiKey' | 'googleKey'
  /** 키 칸에 적어 줄 안내 */
  keyHint?: string
  /** 키가 이렇게 시작해야 한다 (틀린 칸에 붙여 넣는 실수를 잡는다) */
  keyPrefix?: string
  /** 키를 받아 오는 곳 */
  keyUrl?: string
  /** 골라 쓸 수 있는 모델 (맨 앞이 기본) */
  models: string[]
  /** 모델 이름을 직접 적을 수 있나 */
  freeModel: boolean
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    note: '긴 글을 짜임새 있게 쓴다 — 보고서·기획서에 잘 맞는다',
    keyField: 'anthropicKey',
    keyHint: 'sk-ant-... 로 시작하는 키',
    keyPrefix: 'sk-ant',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
    freeModel: true,
  },
  {
    id: 'openai',
    label: 'ChatGPT (OpenAI)',
    note: '값싼 모델부터 좋은 모델까지 폭이 넓다 (브라우저에서 곧장 쓰기는 OpenAI 쪽이 막을 때가 있다)',
    keyField: 'openaiKey',
    keyHint: 'sk-... 로 시작하는 키',
    keyPrefix: 'sk-',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
    freeModel: true,
  },
  {
    id: 'google',
    label: 'Gemini (Google)',
    note: '무료 몫이 넉넉해 처음 써 보기에 좋다',
    keyField: 'googleKey',
    keyHint: 'AIza... 로 시작하는 키',
    keyPrefix: 'AIza',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    freeModel: true,
  },
  {
    id: 'local',
    label: '내 컴퓨터 모델',
    note: '키도 요금도 없다 — Ollama·LM Studio 를 켜 두면 글이 밖으로 나가지 않는다',
    models: [],
    freeModel: true,
  },
  {
    id: 'proxy',
    label: '이 앱의 서버',
    note: '키 없이 바로 쓴다 — 서버에 키를 넣어 둔 때만 된다',
    models: ['gpt-4o-mini', 'claude-sonnet-4-6'],
    freeModel: true,
  },
]

export function providerInfo(id: AiProvider): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

/** 키를 통째로 보여 주지 않는다 — 앞뒤만 남긴다 (어깨너머로 읽히지 않게) */
export function maskKey(key: string): string {
  const k = (key || '').trim()
  if (!k) return ''
  if (k.length <= 12) return k.slice(0, 3) + '…'
  return k.slice(0, 7) + '…' + k.slice(-4)
}

export interface ConnState {
  provider: AiProvider
  /** 넣을 것을 다 넣었나 (정말 되는지는 시험해 봐야 안다) */
  ready: boolean
  label: string
  /** 지금 골라 둔 모델 */
  model: string
  /** 적어 둔 키를 가린 모습 (키가 없는 제공자는 빈 값) */
  masked: string
  /** 무엇이 비었는지 */
  missing: string
}

export function connState(): ConnState {
  const s = useSettingsStore.getState()
  const info = providerInfo(s.aiProvider)
  const model = s.aiModel || defaultModelFor(s.aiProvider)
  if (!info) {
    return { provider: 'none', ready: false, label: '연결 안 함', model, masked: '', missing: 'AI 를 고르지 않았다' }
  }
  const key = info.keyField ? s[info.keyField] : ''
  const needsKey = !!info.keyField && !key
  const needsUrl = s.aiProvider === 'local' && !s.localUrl.trim()
  return {
    provider: s.aiProvider,
    ready: !needsKey && !needsUrl,
    label: info.label,
    model,
    masked: maskKey(key),
    missing: needsKey ? '키를 아직 안 넣었다' : needsUrl ? '모델 서버 주소가 비었다' : '',
  }
}

/** 붙여 넣은 값이 그 제공자의 키처럼 생겼나 — 아니면 어디 키인지 짚어 준다 */
export function keyWarning(id: AiProvider, key: string): string {
  const k = (key || '').trim()
  if (!k) return ''
  const info = providerInfo(id)
  if (!info?.keyPrefix) return ''
  if (k.startsWith(info.keyPrefix)) return ''
  if (k.startsWith('sk-ant')) return '이건 Claude 키처럼 보인다 — 제공자를 Claude 로 바꾸세요'
  if (k.startsWith('AIza')) return '이건 Google 키처럼 보인다 — 제공자를 Gemini 로 바꾸세요'
  if (k.startsWith('sk-')) return '이건 OpenAI 키처럼 보인다 — 제공자를 ChatGPT 로 바꾸세요'
  return `${info.label} 키는 보통 ${info.keyPrefix}… 로 시작한다 — 붙여 넣은 값을 다시 살펴보세요`
}

export interface TestResult {
  ok: boolean
  /** 걸린 시간 (밀리초) */
  ms: number
  /** 모델이 실제로 돌려준 말 (짧게) */
  said?: string
  error?: string
}

/* 작은 모델도 알아들을 만큼 단출하게 (꺾쇠나 특수 기호를 넣으면 그것부터 되묻는 모델이 있다) */
const PING = '한국어로 연결됨 이라고만 답하세요.'

/**
 * 진짜로 한 번 물어본다 — 「저장했다」 가 아니라 「이어졌다」 를 확인하는 유일한 길.
 * 키가 틀렸는지, 요금이 떨어졌는지, 모델 이름이 없는지는 답을 받아 봐야 갈린다.
 */
export async function testConnection(): Promise<TestResult> {
  const s = useSettingsStore.getState()
  const started = performance.now()

  /* OpenAI 만 먼저 키를 따로 물어본다 — 글쓰기 문은 답에 브라우저용 허락 머리가 없어,
     키가 틀려도 「닿지 못했다」 로만 보인다. 읽을 수 있는 문으로 미리 갈라 준다. */
  if (s.aiProvider === 'openai' && s.openaiKey) {
    const state = await openaiKeyState(s.openaiKey)
    if (state === 'bad') {
      return { ok: false, ms: Math.round(performance.now() - started), error: 'OpenAI 키가 맞지 않는다 — 키를 다시 살펴보세요' }
    }
  }

  /* 내 컴퓨터 모델은 첫 부탁 때 모델을 메모리에 올린다 — 그 한 번이 1~2분 걸리기도 한다.
     여기서 30초에 끊으면 「답하지 않는다」 고 잘못 알려 주게 된다. */
  const patience = s.aiProvider === 'local' ? 180000 : 30000
  const r = await chatAi(PING, { maxTokens: 24, timeoutMs: patience })
  const ms = Math.round(performance.now() - started)
  if (!r.ok) return { ok: false, ms, error: r.error || '까닭을 알 수 없다' }
  const said = (r.text || '').trim().replace(/\s+/g, ' ').slice(0, 40)
  if (!said) return { ok: false, ms, error: '답이 비어 돌아왔다 — 모델 이름을 살펴보세요' }
  return { ok: true, ms, said }
}

export interface LocalFind {
  /** 찾은 서버 주소 */
  url: string
  /** 그 서버가 가진 모델 이름 */
  models: string[]
  /** 무엇으로 보이나 */
  kind: string
}

/* 내 컴퓨터에서 모델 서버가 흔히 쓰는 문 */
const LOCAL_PORTS: Array<{ url: string; kind: string }> = [
  { url: 'http://localhost:11434/v1', kind: 'Ollama' },
  { url: 'http://localhost:1234/v1', kind: 'LM Studio' },
  { url: 'http://localhost:8080/v1', kind: 'llama.cpp' },
  { url: 'http://localhost:5001/v1', kind: 'KoboldCpp' },
  { url: 'http://localhost:8000/v1', kind: 'vLLM' },
]

interface ModelList {
  data?: Array<{ id?: string }>
}

async function askModels(url: string): Promise<string[] | null> {
  const ac = new AbortController()
  const id = setTimeout(() => ac.abort(), 1500)   // 없는 문은 빨리 지나간다
  try {
    const r = await fetch(localBase(url) + '/models', { signal: ac.signal })
    if (!r.ok) return null
    const data = await r.json() as ModelList
    return (data.data || []).map((m) => m.id || '').filter(Boolean)
  } catch {
    return null
  } finally {
    clearTimeout(id)
  }
}

/**
 * 내 컴퓨터에 켜 둔 모델 서버를 찾는다 — 키를 넣지 않고 잇는 길이다.
 * 흔한 문 다섯 개를 한꺼번에 두드려 보고, 답한 것만 돌려준다.
 */
export async function discoverLocal(): Promise<LocalFind[]> {
  const found = await Promise.all(LOCAL_PORTS.map(async (port) => {
    const models = await askModels(port.url)
    return models ? { url: port.url, models, kind: port.kind } : null
  }))
  /* 모델을 받아 둔 곳을 앞에 놓는다 — 켜 두기만 하고 빈 서버가 먼저 잡히지 않게 */
  return found.filter((f): f is LocalFind => f !== null)
    .sort((a, b) => b.models.length - a.models.length)
}

/**
 * 찾은 내 컴퓨터 모델로 곧바로 잇는다.
 * 모델을 하나도 안 받아 둔 서버라면 이름을 비워 두지 않는다 — 빈 이름으로 부탁하면
 * 「그런 모델 없다」 는 말만 돌아와, 무엇이 빠졌는지 알 길이 없다.
 */
export function connectLocal(find: LocalFind, model?: string): boolean {
  const pick = model || find.models[0] || ''
  const s = useSettingsStore.getState()
  s.setKey('localUrl', find.url)
  s.setKey('aiProvider', 'local')
  if (!pick) return false          // 서버는 찾았지만 받아 둔 모델이 없다
  s.setKey('aiModel', pick)
  return true
}

/**
 * 제공자를 바꿀 때 모델도 그 집 것으로 맞춘다.
 * (예전 모델 이름이 남아 있으면 「그런 모델 없다」 는 대답만 돌아온다)
 */
export function chooseProvider(id: AiProvider): void {
  const s = useSettingsStore.getState()
  const info = providerInfo(id)
  const keep = info?.models.includes(s.aiModel)
  s.setKey('aiProvider', id)
  if (!keep) s.setKey('aiModel', info?.models[0] || defaultModelFor(id))
}

/** 적어 둔 키를 지운다 — 남의 컴퓨터에서 잠깐 썼을 때 */
export function forgetKey(): void {
  const s = useSettingsStore.getState()
  const info = providerInfo(s.aiProvider)
  if (info?.keyField) s.setKey(info.keyField, '')
}

/** AI 연결 창을 연다 */
export function openAiConnect(): void {
  window.dispatchEvent(new CustomEvent('jan-ai-connect'))
}

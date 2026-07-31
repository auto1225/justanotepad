/**
 * Phase 5+ — Claude/GPT API 연결.
 *   - direct mode: 사용자가 자기 키로 브라우저에서 직접 호출 (Anthropic/OpenAI)
 *   - proxy mode: /api/v2-ai 서버가 forward (사용자 키 불필요, 서버 키 사용)
 */
import { useSettingsStore } from '../store/settingsStore'

export type AiMode = 'summarize' | 'translate' | 'improve' | 'continue' | 'paper-cite' | 'raw'

const PROMPTS: Record<AiMode, (text: string) => string> = {
  // 이미 완성된 프롬프트를 그대로 전달 — 채팅/번역기처럼 자체 프롬프트를 만드는 호출자용.
  // (다른 모드로 감싸면 "요약해줘" 같은 지시가 이중으로 붙어 결과가 왜곡된다)
  raw: (t) => t,
  summarize: (t) =>
    `다음 글을 한국어로 핵심만 5줄 이내로 요약. 불필요한 군더더기 없이 정보 밀도 높게.\n\n${t}`,
  translate: (t) =>
    `Translate the following Korean text to natural English. Preserve formatting (paragraphs, lists). Output only the translation:\n\n${t}`,
  improve: (t) =>
    `다음 한국어 글을 더 명확하고 매끄럽게 다듬어줘. 의미는 유지하되 어색한 표현·중복 제거. 결과 텍스트만 반환:\n\n${t}`,
  continue: (t) =>
    `다음 글의 흐름을 이어서 자연스럽게 1~2문단을 더 작성. 같은 어조·시제 유지:\n\n${t}`,
  'paper-cite': (t) =>
    `Extract candidate citation references from the following research-style text. Return JSON: {"refs":[{"author":"","year":"","title":"","venue":""}]}.\n\n${t}`,
}

export interface AiCallResult {
  ok: boolean
  text?: string
  error?: string
}

const TIMEOUT_MS = 30000
const VISION_TIMEOUT_MS = 45000
/** 긴 문서를 쓸 때는 오래 기다린다 — 열 쪽짜리 보고서는 30초로 끝나지 않는다 */
const LONG_TIMEOUT_MS = 180000
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const DEFAULT_GOOGLE_MODEL = 'gemini-2.5-flash'
const DEFAULT_LOCAL_MODEL = 'llama3.1'
const DEFAULT_MAX_TOKENS = 2048

/** 제공자마다 기본으로 쓸 모델 */
export function defaultModelFor(provider: string): string {
  if (provider === 'anthropic') return DEFAULT_ANTHROPIC_MODEL
  if (provider === 'google') return DEFAULT_GOOGLE_MODEL
  if (provider === 'local') return DEFAULT_LOCAL_MODEL
  return DEFAULT_OPENAI_MODEL
}

/** 이 부탁에 얼마를 쓰고 얼마를 기다릴까 */
export interface AiRunOptions {
  /** 답으로 받을 최대 길이 (긴 문서는 8000 쯤) */
  maxTokens?: number
  timeoutMs?: number
}

interface AnthropicResponse {
  content?: Array<{ text?: string }>
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>
}

interface ProxyResponse {
  ok?: boolean
  text?: string
  error?: string
}

function withTimeout(timeoutMs = TIMEOUT_MS): { signal: AbortSignal; cancel: () => void } {
  const ac = new AbortController()
  const id = setTimeout(() => ac.abort(), timeoutMs)
  return { signal: ac.signal, cancel: () => clearTimeout(id) }
}

function safeError(prefix: string, raw: string): string {
  const trimmed = raw.replace(/sk-[a-zA-Z0-9-_]+/g, '[redacted-key]').slice(0, 250)
  return `${prefix}: ${trimmed}`
}

/**
 * 프로바이더와 모델 id 가 어긋나면 (예: Anthropic 선택 + gpt-4o-mini) 해당 프로바이더의
 * 기본 모델로 교정한다 — 공용 aiModel 필드 하나를 쓰는 설정 구조의 방어막.
 */
export function resolveModelForProvider(provider: 'anthropic' | 'openai', model: string): string {
  const isClaude = model.startsWith('claude')
  if (provider === 'anthropic') return isClaude ? model : DEFAULT_ANTHROPIC_MODEL
  return isClaude ? DEFAULT_OPENAI_MODEL : model || DEFAULT_OPENAI_MODEL
}

function errorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function callAnthropic(prompt: string, model: string, key: string, o: AiRunOptions = {}): Promise<AiCallResult> {
  const t = withTimeout(o.timeoutMs || TIMEOUT_MS)
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: t.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || DEFAULT_ANTHROPIC_MODEL,
        max_tokens: o.maxTokens || DEFAULT_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      return { ok: false, error: safeError(`Anthropic ${r.status}`, err) }
    }
    const data = await r.json() as AnthropicResponse
    const text = (data.content || []).map((block) => block.text || '').join('')
    return { ok: true, text }
  } catch (e: unknown) {
    if (errorName(e) === 'AbortError') return { ok: false, error: 'Anthropic 응답이 늦어 그만두었다' }
    return { ok: false, error: 'Anthropic 네트워크 오류: ' + errorMessage(e) }
  } finally {
    t.cancel()
  }
}

function imagePayload(dataUrl: string): { mimeType: string; data: string } {
  const [meta, data] = dataUrl.split(',')
  const mimeType = /data:([^;]+)/.exec(meta)?.[1] || 'image/jpeg'
  return { mimeType, data: data || '' }
}

/**
 * OpenAI 키가 살아 있는지만 물어본다.
 * /v1/models 는 브라우저에서 답을 읽을 수 있는 문이라(허락 머리가 붙어 온다),
 * 글쓰기 문이 막혀 「닿지 못했다」 로만 보일 때 무엇이 잘못됐는지 여기서 갈린다.
 */
export async function openaiKeyState(key: string): Promise<'ok' | 'bad' | 'unknown'> {
  const t = withTimeout(12000)
  try {
    const r = await fetch('https://api.openai.com/v1/models', {
      signal: t.signal,
      headers: { Authorization: `Bearer ${key}` },
    })
    if (r.ok) return 'ok'
    if (r.status === 401 || r.status === 403) return 'bad'
    return 'unknown'
  } catch {
    return 'unknown'
  } finally {
    t.cancel()
  }
}

async function callOpenAI(prompt: string, model: string, key: string, o: AiRunOptions = {}): Promise<AiCallResult> {
  const t = withTimeout(o.timeoutMs || TIMEOUT_MS)
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: t.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model || DEFAULT_OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: o.maxTokens || DEFAULT_MAX_TOKENS,
      }),
    })
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      return { ok: false, error: safeError(`OpenAI ${r.status}`, err) }
    }
    const data = await r.json() as OpenAIResponse
    const text = data.choices?.[0]?.message?.content || ''
    return { ok: true, text }
  } catch (e: unknown) {
    if (errorName(e) === 'AbortError') return { ok: false, error: 'OpenAI 응답이 늦어 그만두었다' }
    /* OpenAI 는 글쓰기 부탁의 「답」에 브라우저용 허락 머리를 붙이지 않는다.
       그래서 키가 틀렸을 때도 브라우저는 그 거절문을 읽지 못하고 「닿지 못했다」 로만 안다.
       무엇이 잘못됐는지 갈라 주려고, 읽을 수 있는 문(/v1/models)으로 키부터 물어본다. */
    const why = await openaiKeyState(key)
    if (why === 'bad') return { ok: false, error: 'OpenAI 키가 맞지 않는다 — 키를 다시 살펴보세요' }
    if (why === 'ok') {
      return { ok: false, error: 'OpenAI 가 이 브라우저에서 온 글쓰기 부탁을 막았다 (키는 맞다) — Claude·Gemini 를 쓰거나, 앱을 올려 둔 서버의 프록시를 거쳐야 한다' }
    }
    return { ok: false, error: 'OpenAI 에 닿지 못했다: ' + errorMessage(e) }
  } finally {
    t.cancel()
  }
}

async function callOpenAIVision(prompt: string, dataUrl: string, model: string, key: string): Promise<AiCallResult> {
  const t = withTimeout(VISION_TIMEOUT_MS)
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: t.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        }],
        max_tokens: 1800,
      }),
    })
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      return { ok: false, error: safeError(`OpenAI Vision ${r.status}`, err) }
    }
    const data = await r.json() as OpenAIResponse
    return { ok: true, text: data.choices?.[0]?.message?.content || '' }
  } catch (e: unknown) {
    if (errorName(e) === 'AbortError') return { ok: false, error: 'OpenAI Vision 타임아웃 (45초 초과)' }
    return { ok: false, error: 'OpenAI Vision 네트워크 오류: ' + errorMessage(e) }
  } finally {
    t.cancel()
  }
}

async function callAnthropicVision(prompt: string, dataUrl: string, model: string, key: string): Promise<AiCallResult> {
  const t = withTimeout(VISION_TIMEOUT_MS)
  const image = imagePayload(dataUrl)
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: t.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: 1800,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.data } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      return { ok: false, error: safeError(`Anthropic Vision ${r.status}`, err) }
    }
    const data = await r.json() as AnthropicResponse
    const text = (data.content || []).map((block) => block.text || '').join('')
    return { ok: true, text }
  } catch (e: unknown) {
    if (errorName(e) === 'AbortError') return { ok: false, error: 'Anthropic Vision 타임아웃 (45초 초과)' }
    return { ok: false, error: 'Anthropic Vision 네트워크 오류: ' + errorMessage(e) }
  } finally {
    t.cancel()
  }
}

interface GoogleResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  error?: { message?: string }
}

/** 구글 제미나이 — 키를 주소에 붙이지 않고 헤더로 보낸다 (주소는 기록에 남는다) */
async function callGoogle(prompt: string, model: string, key: string, o: AiRunOptions = {}): Promise<AiCallResult> {
  const t = withTimeout(o.timeoutMs || TIMEOUT_MS)
  const name = encodeURIComponent(model || DEFAULT_GOOGLE_MODEL)
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`, {
      method: 'POST',
      signal: t.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: o.maxTokens || DEFAULT_MAX_TOKENS },
      }),
    })
    const data = await r.json().catch(() => ({})) as GoogleResponse
    if (!r.ok) return { ok: false, error: safeError(`Google ${r.status}`, data.error?.message || '') }
    const text = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('')
    return { ok: true, text }
  } catch (e: unknown) {
    if (errorName(e) === 'AbortError') return { ok: false, error: 'Google 응답이 늦어 그만두었다' }
    return { ok: false, error: 'Google 연결 오류: ' + errorMessage(e) }
  } finally {
    t.cancel()
  }
}

/** 주소 끝을 다듬는다 — 사용자가 적는 값이라 /v1 이 붙었는지 제각각이다 */
export function localBase(url: string): string {
  const u = (url || 'http://localhost:11434/v1').trim().replace(/\/+$/, '')
  return /\/v\d+$/.test(u) ? u : u + '/v1'
}

/**
 * 내 컴퓨터에서 도는 모델 서버 (Ollama · LM Studio).
 * 둘 다 OpenAI 와 같은 말투를 쓰므로 같은 길로 부른다 — 키가 필요 없다.
 */
async function callLocal(prompt: string, model: string, url: string, o: AiRunOptions = {}): Promise<AiCallResult> {
  const t = withTimeout(o.timeoutMs || LONG_TIMEOUT_MS)   // 집 컴퓨터는 느릴 수 있다
  try {
    const r = await fetch(localBase(url) + '/chat/completions', {
      method: 'POST',
      signal: t.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || DEFAULT_LOCAL_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: o.maxTokens || DEFAULT_MAX_TOKENS,
      }),
    })
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      return { ok: false, error: safeError(`내 컴퓨터 모델 ${r.status}`, err) }
    }
    const data = await r.json() as OpenAIResponse
    return { ok: true, text: data.choices?.[0]?.message?.content || '' }
  } catch (e: unknown) {
    if (errorName(e) === 'AbortError') return { ok: false, error: '내 컴퓨터 모델이 답하지 않아 그만두었다' }
    return { ok: false, error: '내 컴퓨터 모델에 닿지 않는다 — 서버가 도는지, 주소가 맞는지 살펴본다 (' + errorMessage(e) + ')' }
  } finally {
    t.cancel()
  }
}

/** Vercel /api/v2-ai 프록시 호출 — 사용자 키 불필요. */
async function callProxy(prompt: string, providerHint: 'anthropic' | 'openai', model: string, dataUrl?: string): Promise<AiCallResult> {
  const t = withTimeout(dataUrl ? VISION_TIMEOUT_MS : TIMEOUT_MS)
  try {
    const r = await fetch('/api/v2-ai', {
      method: 'POST',
      signal: t.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: providerHint,
        model,
        prompt,
        image: dataUrl ? imagePayload(dataUrl) : undefined,
      }),
    })
    const data = await r.json().catch(() => ({ ok: false, error: '' })) as ProxyResponse
    if (r.status === 404) {
      return { ok: false, error: '이 앱을 올려 둔 서버에 프록시(/api/v2-ai)가 없다 — 내 키를 쓰거나 내 컴퓨터 모델을 고르세요' }
    }
    if (!r.ok || !data.ok) {
      return { ok: false, error: safeError(`서버 프록시 ${r.status}`, data.error || '까닭을 알려 주지 않았다') }
    }
    return { ok: true, text: data.text || '' }
  } catch (e: unknown) {
    if (errorName(e) === 'AbortError') return { ok: false, error: 'Proxy 타임아웃 (30초)' }
    return { ok: false, error: 'Proxy 네트워크 오류: ' + errorMessage(e) }
  } finally {
    t.cancel()
  }
}

function inferProxyBackend(model: string): 'anthropic' | 'openai' {
  return model.trim().toLowerCase().startsWith('claude') ? 'anthropic' : 'openai'
}

async function callProxyWithFallback(prompt: string, model: string, dataUrl?: string): Promise<AiCallResult> {
  const primaryBackend = inferProxyBackend(model)
  const primary = await callProxy(prompt, primaryBackend, model, dataUrl)
  if (primary.ok) return primary

  const fallbackBackend = primaryBackend === 'openai' ? 'anthropic' : 'openai'
  const fallbackModel = fallbackBackend === 'openai' ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL
  const fallback = await callProxy(prompt, fallbackBackend, fallbackModel, dataUrl)
  if (fallback.ok) return fallback

  /* 두 곳에 물어보고 둘 다 안 되면 까닭을 함께 적는다 — 같은 말이면 한 번만 */
  const reasons = [...new Set([primary.error, fallback.error].filter(Boolean))]
  return { ok: false, error: reasons.join(' / ') }
}

/**
 * 부탁 하나를 지금 연결된 곳으로 보낸다 — 모든 AI 기능이 지나는 한 문.
 * 지시문을 손대지 않으므로, 문서 자동 작성처럼 스스로 지시문을 짜는 쪽에서 쓴다.
 */
export async function chatAi(prompt: string, o: AiRunOptions = {}): Promise<AiCallResult> {
  const s = useSettingsStore.getState()
  const model = s.aiModel || defaultModelFor(s.aiProvider)
  if (s.aiProvider === 'anthropic') {
    if (!s.anthropicKey) return { ok: false, error: 'AI 연결 창에서 Anthropic 키를 넣으세요' }
    return callAnthropic(prompt, resolveModelForProvider('anthropic', model), s.anthropicKey, o)
  }
  if (s.aiProvider === 'openai') {
    if (!s.openaiKey) return { ok: false, error: 'AI 연결 창에서 OpenAI 키를 넣으세요' }
    return callOpenAI(prompt, resolveModelForProvider('openai', model), s.openaiKey, o)
  }
  if (s.aiProvider === 'google') {
    if (!s.googleKey) return { ok: false, error: 'AI 연결 창에서 Google 키를 넣으세요' }
    return callGoogle(prompt, model.startsWith('gemini') ? model : DEFAULT_GOOGLE_MODEL, s.googleKey, o)
  }
  if (s.aiProvider === 'local') {
    return callLocal(prompt, model, s.localUrl, o)
  }
  if (s.aiProvider === 'proxy') {
    return callProxyWithFallback(prompt, model || DEFAULT_OPENAI_MODEL)
  }
  return { ok: false, error: 'AI 가 연결되지 않았다 — AI 탭의 「AI 연결」 에서 잇는다' }
}

/** 미리 갖춘 지시문(요약·번역·다듬기…)에 글을 얹어 보낸다. */
export async function runAi(mode: AiMode, text: string): Promise<AiCallResult> {
  return chatAi(PROMPTS[mode](text))
}

export async function runAiVision(prompt: string, dataUrl: string): Promise<AiCallResult> {
  const s = useSettingsStore.getState()
  if (s.aiProvider === 'anthropic') {
    if (!s.anthropicKey) return { ok: false, error: '설정에서 Anthropic API 키를 입력하세요' }
    return callAnthropicVision(prompt, dataUrl, resolveModelForProvider('anthropic', s.aiModel || DEFAULT_ANTHROPIC_MODEL), s.anthropicKey)
  }
  if (s.aiProvider === 'openai') {
    if (!s.openaiKey) return { ok: false, error: '설정에서 OpenAI API 키를 입력하세요' }
    return callOpenAIVision(prompt, dataUrl, resolveModelForProvider('openai', s.aiModel || DEFAULT_OPENAI_MODEL), s.openaiKey)
  }
  if (s.aiProvider === 'proxy') {
    return callProxyWithFallback(prompt, s.aiModel || DEFAULT_OPENAI_MODEL, dataUrl)
  }
  if (s.aiProvider === 'none') {
    return { ok: false, error: 'AI 제공자가 꺼져 있습니다. 설정에서 서버 프록시 또는 개인 API 키를 선택하세요.' }
  }
  return { ok: false, error: 'AI 제공자가 설정되지 않음 — OCR 추출을 사용하거나 설정에서 AI를 연결하세요' }
}

export function aiConfigured(): boolean {
  const s = useSettingsStore.getState()
  if (s.aiProvider === 'anthropic') return !!s.anthropicKey
  if (s.aiProvider === 'openai') return !!s.openaiKey
  if (s.aiProvider === 'google') return !!s.googleKey
  if (s.aiProvider === 'local') return !!s.localUrl        // 내 컴퓨터 모델은 키가 없다
  if (s.aiProvider === 'proxy') return true
  return false
}

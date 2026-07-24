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
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'

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

async function callAnthropic(prompt: string, model: string, key: string): Promise<AiCallResult> {
  const t = withTimeout()
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
        max_tokens: 2048,
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
    if (errorName(e) === 'AbortError') return { ok: false, error: 'Anthropic 타임아웃 (30초 초과)' }
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

async function callOpenAI(prompt: string, model: string, key: string): Promise<AiCallResult> {
  const t = withTimeout()
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
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
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
    if (errorName(e) === 'AbortError') return { ok: false, error: 'OpenAI 타임아웃 (30초 초과)' }
    return { ok: false, error: 'OpenAI 네트워크 오류: ' + errorMessage(e) }
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
    const data = await r.json().catch(() => ({ ok: false, error: 'JSON 파싱 실패' })) as ProxyResponse
    if (!r.ok || !data.ok) {
      return { ok: false, error: safeError(`Proxy ${r.status}`, data.error || '') }
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

  return {
    ok: false,
    error: [primary.error, fallback.error].filter(Boolean).join(' / '),
  }
}

/** 메인 진입점. provider 에 따라 적절한 호출. */
export async function runAi(mode: AiMode, text: string): Promise<AiCallResult> {
  const s = useSettingsStore.getState()
  const prompt = PROMPTS[mode](text)
  if (s.aiProvider === 'anthropic') {
    if (!s.anthropicKey) return { ok: false, error: '설정에서 Anthropic API 키를 입력하세요' }
    return callAnthropic(prompt, resolveModelForProvider('anthropic', s.aiModel || DEFAULT_ANTHROPIC_MODEL), s.anthropicKey)
  }
  if (s.aiProvider === 'openai') {
    if (!s.openaiKey) return { ok: false, error: '설정에서 OpenAI API 키를 입력하세요' }
    return callOpenAI(prompt, resolveModelForProvider('openai', s.aiModel || DEFAULT_OPENAI_MODEL), s.openaiKey)
  }
  if (s.aiProvider === 'proxy') {
    // 모델 prefix 로 어느 backend 인지 추론
    const model = s.aiModel || DEFAULT_OPENAI_MODEL
    return callProxyWithFallback(prompt, model || DEFAULT_OPENAI_MODEL)
  }
  return { ok: false, error: 'AI 제공자가 설정되지 않음 — 설정 모달에서 선택' }
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
  if (s.aiProvider === 'proxy') return true
  return false
}

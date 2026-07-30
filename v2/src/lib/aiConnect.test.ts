import { describe, it, expect, beforeEach } from 'vitest'
import { PROVIDERS, chooseProvider, connState, forgetKey, keyWarning, maskKey, providerInfo } from './aiConnect'
import { localBase } from './aiApi'
import { useSettingsStore } from '../store/settingsStore'

beforeEach(() => {
  useSettingsStore.getState().reset()
})

describe('AI 연결 — 무엇에 이어져 있나', () => {
  it('처음에는 아무것도 이어져 있지 않다', () => {
    const s = connState()
    expect(s.provider).toBe('none')
    expect(s.ready).toBe(false)
  })

  it('키를 넣기 전에는 「넣을 것이 남았다」 고 알려 준다', () => {
    chooseProvider('anthropic')
    const s = connState()
    expect(s.ready).toBe(false)
    expect(s.missing).toContain('키')
  })

  it('키를 넣으면 준비된 것으로 본다 (정말 되는지는 시험이 가린다)', () => {
    chooseProvider('anthropic')
    useSettingsStore.getState().setKey('anthropicKey', 'sk-ant-abcdefghijklmnop')
    const s = connState()
    expect(s.ready).toBe(true)
    expect(s.label).toContain('Claude')
  })

  it('내 컴퓨터 모델은 키 없이 준비된다', () => {
    chooseProvider('local')
    const s = connState()
    expect(s.ready).toBe(true)
    expect(s.masked).toBe('')
  })

  it('제공자를 바꾸면 모델도 그 집 것으로 바뀐다 — 「그런 모델 없다」 를 막는다', () => {
    chooseProvider('openai')
    expect(useSettingsStore.getState().aiModel).toBe('gpt-4o-mini')
    chooseProvider('anthropic')
    expect(useSettingsStore.getState().aiModel).toMatch(/^claude/)
    chooseProvider('google')
    expect(useSettingsStore.getState().aiModel).toMatch(/^gemini/)
  })

  it('그 집 모델을 골라 뒀다면 제공자를 다시 골라도 그대로 둔다', () => {
    chooseProvider('anthropic')
    useSettingsStore.getState().setKey('aiModel', 'claude-opus-4-6')
    chooseProvider('anthropic')
    expect(useSettingsStore.getState().aiModel).toBe('claude-opus-4-6')
  })

  it('키 지우기는 지금 제공자의 키만 지운다', () => {
    const s = useSettingsStore.getState()
    s.setKey('anthropicKey', 'sk-ant-1234567890')
    s.setKey('openaiKey', 'sk-openai-1234567890')
    chooseProvider('anthropic')
    forgetKey()
    expect(useSettingsStore.getState().anthropicKey).toBe('')
    expect(useSettingsStore.getState().openaiKey).toBe('sk-openai-1234567890')
  })
})

describe('AI 연결 — 키 다루기', () => {
  it('키는 앞뒤만 보여 준다', () => {
    expect(maskKey('sk-ant-api03-abcdefghijklmnopqrstuv')).toBe('sk-ant-…stuv')
    expect(maskKey('')).toBe('')
    expect(maskKey('짧다')).toContain('…')
  })

  it('엉뚱한 칸에 붙여 넣으면 어디 키인지 짚어 준다', () => {
    expect(keyWarning('anthropic', 'AIzaSyABC')).toContain('Google')
    expect(keyWarning('google', 'sk-ant-abc')).toContain('Claude')
    expect(keyWarning('anthropic', 'sk-proj-abc')).toContain('OpenAI')
  })

  it('맞게 넣었으면 아무 말도 하지 않는다', () => {
    expect(keyWarning('anthropic', 'sk-ant-abc')).toBe('')
    expect(keyWarning('openai', 'sk-proj-abc')).toBe('')
    expect(keyWarning('google', 'AIzaSyABC')).toBe('')
    expect(keyWarning('anthropic', '')).toBe('')
  })

  it('키가 필요 없는 제공자에는 안내할 것이 없다', () => {
    expect(providerInfo('local')?.keyField).toBeUndefined()
    expect(providerInfo('proxy')?.keyField).toBeUndefined()
  })

  it('제공자마다 키 받는 곳을 알려 준다', () => {
    for (const p of PROVIDERS.filter((x) => x.keyField)) {
      expect(p.keyUrl).toMatch(/^https:\/\//)
      expect(p.keyPrefix).toBeTruthy()
    }
  })
})

describe('내 컴퓨터 모델 — 주소 다듬기', () => {
  it('/v1 이 없으면 붙이고, 빗금은 정리한다', () => {
    expect(localBase('http://localhost:11434')).toBe('http://localhost:11434/v1')
    expect(localBase('http://localhost:11434/v1/')).toBe('http://localhost:11434/v1')
    expect(localBase('  http://localhost:1234  ')).toBe('http://localhost:1234/v1')
    expect(localBase('')).toBe('http://localhost:11434/v1')
  })
})

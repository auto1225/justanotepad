import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 사용자 설정 — API 키, 동기화, 인용 스타일, 협업.
 */
export type CitationStyle = 'apa' | 'ieee' | 'mla'
export type AiProvider = 'anthropic' | 'openai' | 'google' | 'local' | 'proxy' | 'none'
export type SyncProvider = 'none' | 'local' | 'dropbox' | 'onedrive' | 'supabase'

interface SettingsState {
  anthropicKey: string
  openaiKey: string
  googleKey: string
  /** 내 컴퓨터에서 도는 모델 서버 (Ollama · LM Studio) — 키가 없어도 쓴다 */
  localUrl: string
  aiProvider: AiProvider
  aiModel: string

  supabaseUrl: string
  supabaseAnonKey: string
  supabaseEmail: string
  syncEnabled: boolean
  syncProvider: SyncProvider
  dropboxClientId: string
  onedriveClientId: string

  citationStyle: CitationStyle

  // Phase 8 — Yjs 협업
  collabEnabled: boolean
  collabWsUrl: string
  collabRoom: string
  collabUserName: string
  webhookUrls: string
  aiAutocomplete: boolean

  setKey: (k: keyof SettingsState, v: string | boolean) => void
  reset: () => void
}

const DEFAULTS = {
  anthropicKey: '',
  openaiKey: '',
  googleKey: '',
  localUrl: 'http://localhost:11434/v1',
  aiProvider: 'none' as AiProvider,
  aiModel: 'gpt-4o-mini',
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseEmail: '',
  syncEnabled: false,
  syncProvider: 'none' as SyncProvider,
  dropboxClientId: '',
  onedriveClientId: '',
  citationStyle: 'apa' as CitationStyle,
  collabEnabled: false,
  collabWsUrl: 'wss://demos.yjs.dev/ws',
  collabRoom: '',
  collabUserName: '',
  webhookUrls: '',
  aiAutocomplete: false,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setKey: (k, v) => set((s) => ({ ...s, [k]: v })),
      reset: () => set(DEFAULTS),
    }),
    { name: 'jan-v2-settings' }
  )
)

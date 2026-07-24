import { useEffect, useState } from 'react'
import { importV1FromLocalStorage, exportV2ToJson, importV2FromJsonAsync } from '../lib/v1Import'
import { importMarkdownFiles } from '../lib/bulkImport'
import { pdfFileToHtml } from '../lib/pdfImport'
import { downloadNotionZip } from '../lib/notionExport'
import { useMemosStore } from '../store/memosStore'
import { useI18nStore } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import { useThemeStore } from '../store/themeStore'
import { PAPER_STYLES, pageMarginsSummary, useUIStore } from '../store/uiStore'
import { useWritingGoalStore } from '../store/writingGoalStore'
import { useSettingsStore } from '../store/settingsStore'
import { getSession, getSupabaseConfigStatus, signInGoogle, signOut, syncNow, syncConfigured } from '../lib/supabaseSync'
import { PageSettingsModal } from './PageSettingsModal'
import { getLocalFirstStorageStats } from '../lib/localFirstStorage'
import { getBlobStorageStats } from '../lib/blobRefs'
import {
  chooseLocalSyncFolder,
  clearByocSyncError,
  getByocStatus,
  handleByocOAuthRedirectIfNeeded,
  pullByocSnapshot,
  pushByocSnapshot,
  readByocSyncHealth,
  startDropboxOAuth,
  startOneDriveOAuth,
  syncByocNow,
  type ByocSyncHealth,
  type ByocStatus,
} from '../lib/byocSync'

interface SettingsModalProps {
  onClose: () => void
  /** 열리자마자 스크롤할 섹션 — 헤더의 로그인(supabase)/동기화(byoc) 버튼용 */
  focusSection?: 'supabase' | 'byoc' | null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function readLastSyncAt(): number {
  return readByocSyncHealth().lastAt
}

function formatLastSyncAt(value: number): string {
  if (!value) return '기록 없음'
  return new Date(value).toLocaleString('ko-KR')
}

export function SettingsModal({ onClose, focusSection }: SettingsModalProps) {
  const [status, setStatus] = useState<string>('')
  const [supabaseUser, setSupabaseUser] = useState<string>('')
  const [checkingSession, setCheckingSession] = useState(false)
  const [showPageSettings, setShowPageSettings] = useState(false)
  const [storageSummary, setStorageSummary] = useState<{ backend: string; stateBytes: number; blobCount: number; blobBytes: number } | null>(null)
  const [byocStatus, setByocStatus] = useState<ByocStatus | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<number>(() => readLastSyncAt())
  const [syncHealth, setSyncHealth] = useState<ByocSyncHealth>(() => readByocSyncHealth())
  const memoCount = useMemosStore((s) => Object.keys(s.memos).length)
  const settings = useSettingsStore()
  const lang = useI18nStore((s) => s.lang)
  const setLang = useI18nStore((s) => s.setLang)
  const accent = useThemeStore((s) => s.accent)
  const setAccent = useThemeStore((s) => s.setAccent)
  const ui = useUIStore()
  const goal = useWritingGoalStore()
  const supabaseStatus = getSupabaseConfigStatus()
  const paperLabel = PAPER_STYLES.find((style) => style.value === ui.paperStyle)?.label.replace(' (기본)', '') || '줄노트'
  const orientationLabel = ui.pageOrientation === 'landscape' ? '가로' : '세로'
  const columnLabel = `${ui.pageColumnCount || 1}단`
  const marginLabel = pageMarginsSummary(ui.pageMarginsMm, ui.pageMarginMm)
  const localFolderLabel = byocStatus?.provider === 'local' ? byocStatus.label : ''

  function refreshSyncHealth() {
    const next = readByocSyncHealth()
    setSyncHealth(next)
    setLastSyncAt(next.lastAt)
  }

  useEffect(() => {
    if (!focusSection) return
    const selector = focusSection === 'supabase' ? '.jan-settings-supabase-section' : '.jan-settings-byoc-section'
    const el = document.querySelector(`.jan-settings-modal ${selector}`)
    el?.scrollIntoView({ block: 'start' })
  }, [focusSection])

  useEffect(() => {
    let cancelled = false
    if (!supabaseStatus.configured) return
    async function checkSession() {
      setCheckingSession(true)
      try {
        const session = await getSession()
        if (!cancelled) setSupabaseUser(session?.user.email || '')
      } catch {
        if (!cancelled) setSupabaseUser('')
      } finally {
        if (!cancelled) setCheckingSession(false)
      }
    }
    void checkSession()
    return () => {
      cancelled = true
    }
  }, [supabaseStatus.configured])

  useEffect(() => {
    let cancelled = false
    async function refreshStorageSummary() {
      const [stateStats, blobStats] = await Promise.all([getLocalFirstStorageStats(), getBlobStorageStats()])
      if (cancelled) return
      setStorageSummary({
        backend: stateStats.backend,
        stateBytes: stateStats.totalBytes,
        blobCount: blobStats.count,
        blobBytes: blobStats.bytes,
      })
    }
    refreshStorageSummary().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [memoCount, status])

  useEffect(() => {
    let cancelled = false
    getByocStatus().then((next) => {
      if (!cancelled) setByocStatus(next)
    }).catch(() => {
      if (!cancelled) setByocStatus(null)
    })
    return () => {
      cancelled = true
    }
  }, [settings.syncProvider, status])

  useEffect(() => {
    handleByocOAuthRedirectIfNeeded()
      .then((next) => {
        if (!next) return
        setByocStatus(next)
        setStatus(`${next.label} 연결 완료`)
      })
      .catch((error: unknown) => setStatus('개인 저장소 연결 실패: ' + errorMessage(error)))
  }, [])

  useEffect(() => {
    refreshSyncHealth()
  }, [status])

  useEffect(() => {
    window.addEventListener('jan-byoc-sync-health', refreshSyncHealth)
    window.addEventListener('storage', refreshSyncHealth)
    return () => {
      window.removeEventListener('jan-byoc-sync-health', refreshSyncHealth)
      window.removeEventListener('storage', refreshSyncHealth)
    }
  }, [])

  async function handleV1Import() {
    setStatus('v1 데이터를 가져오는 중...')
    const result = await importV1FromLocalStorage()
    setStatus(
      `v1 메모 ${result.imported}개 가져옴` +
      (result.skipped > 0 ? `, ${result.skipped}개 건너뜀` : '') +
      (result.errors.length > 0 ? `, 오류 ${result.errors.length}개` : '')
    )
  }

  async function handleExport() {
    setStatus('백업 파일을 만드는 중...')
    const json = await exportV2ToJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `justanotepad-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus(`${Object.keys(useMemosStore.getState().memos).length}개 메모 백업 완료`)
  }

  async function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const result = await importV2FromJsonAsync(text)
      setStatus(
        `백업 ${result.imported}개 가져옴` +
        (result.skipped > 0 ? `, ${result.skipped}개 건너뜀` : '') +
        (result.errors.length > 0 ? `, 오류 ${result.errors.length}개` : '')
      )
    }
    input.click()
  }

  async function handleSync() {
    settings.setKey('syncProvider', 'supabase')
    if (!syncConfigured()) {
      setStatus('Supabase 설정이 없습니다. config.js 또는 아래 고급 설정을 확인하세요')
      return
    }
    setStatus('동기화 중...')
    const r = await syncNow()
    if (r.ok) setStatus(`동기화 완료 — push ${r.pushed}, pull ${r.pulled}`)
    else setStatus(`동기화 실패: ${r.error}`)
    setLastSyncAt(readLastSyncAt())
  }

  async function handleSupabaseLogin() {
    settings.setKey('syncProvider', 'supabase')
    if (!syncConfigured()) {
      setStatus('Supabase 설정이 없습니다. config.js 또는 아래 고급 설정을 확인하세요')
      return
    }
    setStatus('Google 로그인으로 이동 중...')
    const result = await signInGoogle()
    if (!result.ok) setStatus(`로그인 실패: ${result.error}`)
  }

  async function handleChooseLocalFolder(label = '내 PC/클라우드 폴더') {
    setStatus('동기화 폴더를 선택하는 중...')
    try {
      const next = await chooseLocalSyncFolder(label)
      setByocStatus(next)
      setStatus(`개인 저장소 연결 완료: ${next.detail || next.label}`)
    } catch (error: unknown) {
      setStatus('폴더 연결 실패: ' + errorMessage(error))
    }
  }

  async function handleDropboxConnect() {
    setStatus('Dropbox 연결 준비 중...')
    try {
      await startDropboxOAuth()
    } catch (error: unknown) {
      setStatus('Dropbox 연결 실패: ' + errorMessage(error))
    }
  }

  async function handleOneDriveConnect() {
    setStatus('OneDrive 연결 준비 중...')
    try {
      await startOneDriveOAuth()
    } catch (error: unknown) {
      setStatus('OneDrive 연결 실패: ' + errorMessage(error))
    }
  }

  async function handleByocPush() {
    setStatus('개인 저장소로 백업 중...')
    const result = await pushByocSnapshot()
    if (result.ok) setStatus(`${result.provider} 백업 완료`)
    else setStatus(`백업 실패: ${result.error}`)
    refreshSyncHealth()
    getByocStatus().then(setByocStatus).catch(() => {})
  }

  async function handleByocSync() {
    setStatus('개인 저장소와 동기화 중...')
    const result = await syncByocNow()
    if (result.ok) setStatus(`${result.provider} 동기화 완료: 가져오기 ${result.pulled}, 백업 ${result.pushed}`)
    else setStatus(`동기화 실패: ${result.error}`)
    refreshSyncHealth()
    getByocStatus().then(setByocStatus).catch(() => {})
  }

  async function handleByocPull() {
    const ok = window.confirm('개인 저장소의 백업을 현재 v2 데이터에 병합할까요?')
    if (!ok) return
    setStatus('개인 저장소에서 가져오는 중...')
    const result = await pullByocSnapshot()
    if (result.ok) setStatus(`${result.provider} 가져오기 완료: ${result.pulled}개 항목 반영`)
    else setStatus(`가져오기 실패: ${result.error}`)
    refreshSyncHealth()
    getByocStatus().then(setByocStatus).catch(() => {})
  }

  async function handleSupabaseLogout() {
    const result = await signOut()
    if (result.ok) {
      setSupabaseUser('')
      setStatus('Supabase 로그아웃 완료')
    } else {
      setStatus(`로그아웃 실패: ${result.error}`)
    }
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>설정</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        {status && (
          <div style={{ padding: '8px 16px', background: 'color-mix(in srgb, #2196f3 10%, transparent)', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 13 }} role="status">
            {status}
          </div>
        )}
        <div className="jan-modal-body">
          {storageSummary && (
            <section className="jan-settings-section jan-settings-storage-section">
              <h4>로컬 저장 상태</h4>
              <div className="jan-storage-health" aria-label="로컬 저장 상태">
                <div>
                  <span>저장 위치</span>
                  <strong>{storageSummary.backend === 'indexeddb' ? 'IndexedDB' : 'localStorage'}</strong>
                </div>
                <div>
                  <span>노트 데이터</span>
                  <strong>{formatBytes(storageSummary.stateBytes)}</strong>
                </div>
                <div>
                  <span>이미지 블롭</span>
                  <strong>{storageSummary.blobCount}개 · {formatBytes(storageSummary.blobBytes)}</strong>
                </div>
              </div>
            </section>
          )}
          <section className="jan-settings-section">
            <h4>AI 제공자</h4>
            <div className="jan-settings-info">
              Ctrl+/ 로 AI 도우미 호출. 키는 브라우저 localStorage 에만 저장 (서버 전송 X).
            </div>
            <div className="jan-settings-row">
              <label>제공자:</label>
              <select
                value={settings.aiProvider}
                onChange={(e) => {
                  const provider = e.target.value
                  settings.setKey('aiProvider', provider)
                  // 공용 aiModel 이 이전 프로바이더의 모델로 남아 API 400 이 나는 것을 방지
                  const model = settings.aiModel
                  if (provider === 'anthropic' && !model.startsWith('claude')) settings.setKey('aiModel', 'claude-sonnet-4-6')
                  if (provider === 'openai' && model.startsWith('claude')) settings.setKey('aiModel', 'gpt-4o-mini')
                }}
              >
                <option value="none">사용 안 함</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="openai">OpenAI ChatGPT</option>
                <option value="proxy">서버 프록시 (키 불필요)</option>
              </select>
            </div>
            {settings.aiProvider === 'anthropic' && (
              <>
                <input
                  type="password"
                  placeholder="Anthropic API key (sk-ant-...)"
                  value={settings.anthropicKey}
                  onChange={(e) => settings.setKey('anthropicKey', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="모델명 (예: claude-sonnet-4-6)"
                  value={settings.aiModel}
                  onChange={(e) => settings.setKey('aiModel', e.target.value)}
                />
              </>
            )}
            {settings.aiProvider === 'openai' && (
              <>
                <input
                  type="password"
                  placeholder="OpenAI API key (sk-...)"
                  value={settings.openaiKey}
                  onChange={(e) => settings.setKey('openaiKey', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="모델명 (예: gpt-4o-mini)"
                  value={settings.aiModel}
                  onChange={(e) => settings.setKey('aiModel', e.target.value)}
                />
              </>
            )}
            {settings.aiProvider === 'proxy' && (
              <>
                <div className="jan-settings-info" style={{padding:'8px 10px',background:'rgba(76,175,80,0.08)',borderLeft:'3px solid #4caf50',borderRadius:4,marginTop:6}}>
                  서버 프록시 모드 — 사용자 키 불필요. 서버에서 forward.
                </div>
                <input type="text" placeholder="모델명 (기본: gpt-4o-mini, 또는 claude-sonnet-4-6)" value={settings.aiModel} onChange={(e) => settings.setKey('aiModel', e.target.value)} />
              </>
            )}
          </section>

          <section className="jan-settings-section jan-settings-byoc-section">
            <h4>개인 저장소 동기화</h4>
            <div className="jan-settings-info">
              v1 방식처럼 서버 개입을 최소화합니다. 내 PC 폴더를 Dropbox · OneDrive · Google Drive 데스크톱 동기화 폴더 안에 두면 그 클라우드가 기기 간 동기화를 맡습니다.
            </div>
            <div className="jan-sync-provider-grid">
              <button
                className={settings.syncProvider === 'local' && !localFolderLabel.includes('Google Drive') ? 'active' : ''}
                onClick={() => void handleChooseLocalFolder()}
              >
                <strong>내 PC/클라우드 폴더</strong>
                <span>Chrome·Edge 권장 · 가장 v1에 가까운 방식</span>
              </button>
              <button
                className={settings.syncProvider === 'dropbox' ? 'active' : ''}
                onClick={handleDropboxConnect}
              >
                <strong>Dropbox 직접 연결</strong>
                <span>데스크톱 앱 없이 Dropbox 계정으로 저장</span>
              </button>
              <button
                className={settings.syncProvider === 'onedrive' ? 'active' : ''}
                onClick={handleOneDriveConnect}
              >
                <strong>OneDrive 직접 연결</strong>
                <span>Microsoft 계정의 앱 전용 폴더에 저장</span>
              </button>
              <button
                className={settings.syncProvider === 'local' && localFolderLabel.includes('Google Drive') ? 'active' : ''}
                onClick={() => void handleChooseLocalFolder('Google Drive 데스크톱 폴더')}
              >
                <strong>Google Drive 데스크톱 폴더</strong>
                <span>Drive for desktop 폴더를 선택해 기기 간 동기화</span>
              </button>
            </div>
            <div className="jan-settings-info">
              현재 개인 저장소: <b>{byocStatus ? `${byocStatus.label}${byocStatus.detail ? ` · ${byocStatus.detail}` : ''}` : '확인 중...'}</b>
            </div>
            <div className="jan-settings-info">
              마지막 동기화: <b>{formatLastSyncAt(lastSyncAt)}</b>
            </div>
            {syncHealth.lastError && (
              <div className="jan-sync-health-alert" role="alert">
                <div>
                  <strong>최근 자동 백업 실패</strong>
                  <span>{formatLastSyncAt(syncHealth.lastErrorAt)} · {syncHealth.lastError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearByocSyncError()
                    refreshSyncHealth()
                  }}
                >
                  확인
                </button>
              </div>
            )}
            <div className="jan-settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={settings.syncEnabled && (settings.syncProvider === 'local' || settings.syncProvider === 'dropbox' || settings.syncProvider === 'onedrive')}
                  onChange={(e) => settings.setKey('syncEnabled', e.target.checked)}
                />
                {' '}개인 저장소 자동 백업
              </label>
            </div>
            <div className="jan-settings-actions">
              <button onClick={handleByocSync}>지금 동기화</button>
              <button onClick={handleByocPush}>백업만 저장</button>
              <button onClick={handleByocPull}>백업 가져오기</button>
            </div>
            <details>
              <summary>Dropbox 고급 설정</summary>
              <input
                type="text"
                placeholder="Dropbox Client ID (config.js 또는 여기 입력)"
                value={settings.dropboxClientId}
                onChange={(e) => settings.setKey('dropboxClientId', e.target.value)}
              />
            </details>
            <details>
              <summary>OneDrive 고급 설정</summary>
              <div className="jan-settings-info">
                Microsoft Azure 앱의 SPA Client ID가 필요합니다. 데이터는 OneDrive 앱 전용 폴더에 저장됩니다.
              </div>
              <input
                type="text"
                placeholder="Microsoft Azure App Client ID (config.js 또는 여기 입력)"
                value={settings.onedriveClientId}
                onChange={(e) => settings.setKey('onedriveClientId', e.target.value)}
              />
            </details>
          </section>

          <section className="jan-settings-section jan-settings-supabase-section">
            <h4>Supabase 클라우드 동기화</h4>
            <div className="jan-settings-info">
              {supabaseStatus.configured
                ? `${supabaseStatus.source === 'runtime' ? '기본' : '사용자'} Supabase 프로젝트 연결됨`
                : 'Supabase URL과 anon key가 필요합니다.'}
              {supabaseUser ? ` · 로그인: ${supabaseUser}` : checkingSession ? ' · 세션 확인 중...' : ' · 로그인 필요'}
            </div>
            <div className="jan-settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={settings.syncEnabled && settings.syncProvider === 'supabase'}
                  onChange={(e) => {
                    settings.setKey('syncProvider', 'supabase')
                    settings.setKey('syncEnabled', e.target.checked)
                  }}
                />
                {' '}자동 동기화
              </label>
            </div>
            <div className="jan-settings-actions">
              {!supabaseUser && <button onClick={handleSupabaseLogin}>Google 로그인</button>}
              {supabaseUser && <button onClick={handleSupabaseLogout}>로그아웃</button>}
              <button onClick={handleSync}>지금 동기화</button>
            </div>
            <details>
              <summary>고급 설정</summary>
              <input
                type="text"
                placeholder="Supabase URL override (비워두면 config.js 사용)"
                value={settings.supabaseUrl}
                onChange={(e) => settings.setKey('supabaseUrl', e.target.value)}
              />
              <input
                type="password"
                placeholder="anon key override (비워두면 config.js 사용)"
                value={settings.supabaseAnonKey}
                onChange={(e) => settings.setKey('supabaseAnonKey', e.target.value)}
              />
            </details>
          </section>

          <section className="jan-settings-section">
            <h4>데이터 관리</h4>
            <div className="jan-settings-info">
              현재 v2 메모: <b>{memoCount}개</b>
            </div>
            <div className="jan-settings-actions">
              <button onClick={handleExport}>JSON 백업 내보내기</button>
              <button onClick={handleImport}>백업 가져오기</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>Markdown 일괄 가져오기</h4>
            <div className="jan-settings-info">
              .md 파일들을 선택하면 각 파일이 별도 메모로 추가됩니다. 첫 줄 # 제목이 있으면 자동 인식.
            </div>
            <div className="jan-settings-actions">
              <button onClick={async () => {
                const input = document.createElement('input')
                input.type = 'file'
                input.multiple = true
                input.accept = '.md,text/markdown'
                input.onchange = async (e) => {
                  const files = Array.from((e.target as HTMLInputElement).files || [])
                  if (files.length === 0) return
                  const r = await importMarkdownFiles(files)
                  setStatus(`Markdown 가져오기: 가져옴 ${r.imported}, 건너뜀 ${r.skipped}, 오류 ${r.errors.length}`)
                }
                input.click()
              }}>Markdown 파일 선택</button>
            </div>
          </section>

                    <section className="jan-settings-section">
            <h4>PDF 가져오기 (텍스트 추출)</h4>
            <div className="jan-settings-info">
              PDF 페이지의 텍스트를 추출해 새 메모로 추가. PDF.js (CDN) 사용.
            </div>
            <div className="jan-settings-actions">
              <button onClick={async () => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'application/pdf,.pdf'
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (!file) return
                  setStatus('PDF 변환 중...')
                  try {
                    const r = await pdfFileToHtml(file)
                    const id = useMemosStore.getState().newMemo()
                    useMemosStore.setState((s) => {
                      const cur = s.memos[id]
                      if (!cur) return s
                      return { memos: { ...s.memos, [id]: { ...cur, title: file.name.replace(/\.pdf$/i, ''), content: r.html, updatedAt: Date.now() } } }
                    })
                    setStatus('PDF ' + r.pageCount + '페이지 변환 완료')
                  } catch (err: unknown) {
                    setStatus('PDF 변환 실패: ' + errorMessage(err))
                  }
                }
                input.click()
              }}>PDF 파일 선택</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>v1 메모 가져오기</h4>
            <div className="jan-settings-info">
              이전 버전 (justanotepad.com/legacy) 의 메모를 v2 로 변환합니다.
            </div>
            <div className="jan-settings-actions">
              <button onClick={handleV1Import}>v1 메모 가져오기</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>실시간 협업 (Yjs)</h4>
            <div className="jan-settings-info">
              WebSocket URL + 룸 이름 + 사용자명. 같은 룸의 다른 사용자와 동시 편집.
              테스트 서버: wss://demos.yjs.dev/ws (영속 X)
            </div>
            <input
              type="text"
              placeholder="WebSocket URL"
              value={settings.collabWsUrl}
              onChange={(e) => settings.setKey('collabWsUrl', e.target.value)}
            />
            <input
              type="text"
              placeholder="룸 이름 (예: my-shared-doc)"
              value={settings.collabRoom}
              onChange={(e) => settings.setKey('collabRoom', e.target.value)}
            />
            <input
              type="text"
              placeholder="사용자명 (커서에 표시)"
              value={settings.collabUserName}
              onChange={(e) => settings.setKey('collabUserName', e.target.value)}
            />
            <div className="jan-settings-actions">
              <button onClick={() => { settings.setKey('collabEnabled', !settings.collabEnabled); setStatus(settings.collabEnabled ? '협업 중지 — 새로고침 후 적용' : '협업 시작 — 새로고침 후 적용') }}>
                {settings.collabEnabled ? '협업 중지' : '협업 시작'}
              </button>
            </div>
          </section>

                    <section className="jan-settings-section">
            <h4>액센트 색상</h4>
            <div className="jan-settings-info">기본 #D97757 (테라코타) 또는 사용자 색상.</div>
            <div className="jan-settings-actions">
              {(['#D97757','#1976D2','#388E3C','#7B1FA2','#FBC02D','#E91E63','#5D4037','#00838F'] as string[]).map((c) => (
                <button key={c} onClick={() => setAccent(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: accent === c ? '3px solid #333' : '1px solid #ccc', cursor: 'pointer', padding: 0 }} aria-label={c} />
              ))}
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 32, height: 28, padding: 0, border: '1px solid #ccc', borderRadius: 4 }} />
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>언어 / Language</h4>
            <div className="jan-settings-row">
              <label>언어:</label>
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </div>
          </section>

                    <section className="jan-settings-section">
            <h4>Webhook (메모 저장 시 외부 알림)</h4>
            <div className="jan-settings-info">
              메모를 저장할 때마다 입력한 URL 들에 POST 요청을 보냅니다. 여러 개는 줄바꿈 또는 공백으로 구분.
            </div>
            <textarea
              placeholder="https://example.com/webhook"
              value={settings.webhookUrls}
              onChange={(e) => settings.setKey('webhookUrls', e.target.value)}
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontFamily: 'inherit', fontSize: 12 }}
            />
          </section>

          <section className="jan-settings-section">
            <h4>AI 인라인 자동완성 (실험)</h4>
            <div className="jan-settings-info">
              입력 멈추고 1.5초 후 다음 문장을 ghost text 로 제안. Tab 수락, Esc 거부.
            </div>
            <div className="jan-settings-row">
              <label>
                <input type="checkbox" checked={settings.aiAutocomplete} onChange={(e) => settings.setKey('aiAutocomplete', e.target.checked)} />
                {'  '}활성화
              </label>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>Notion 호환 ZIP 내보내기</h4>
            <div className="jan-settings-info">
              모든 메모를 .md 파일로 + index.md + 태그 메타. Notion "Markdown & CSV import" 호환.
            </div>
            <div className="jan-settings-actions">
              <button onClick={async () => {
                setStatus('ZIP 생성 중...')
                try {
                  await downloadNotionZip()
                  setStatus('ZIP 다운로드 완료')
                } catch (e: unknown) {
                  setStatus('ZIP 실패: ' + errorMessage(e))
                }
              }}>ZIP 다운로드</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>페이지 설정</h4>
            <div className="jan-settings-page-summary">
              <div>
                <strong>{ui.pageSize} · {orientationLabel}</strong>
                <span>{paperLabel} · {marginLabel} · {columnLabel}</span>
              </div>
              <button onClick={() => setShowPageSettings(true)}>페이지 설정 열기</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>편집 환경</h4>
            <div className="jan-settings-row">
              <label>
                <input type="checkbox" checked={ui.spellCheck} onChange={() => ui.toggleSpellCheck()} />
                {' '}맞춤법 검사 (브라우저 spellcheck)
              </label>
            </div>
            <div className="jan-settings-row">
              <label>일일 작성 목표 (자):</label>
              <input
                type="number"
                min={0}
                step={100}
                value={goal.dailyTarget}
                onChange={(e) => goal.setTarget(Number(e.target.value) || 0)}
                style={{ width: 100, padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
              />
              <span style={{ fontSize: 11, color: '#888' }}>
                오늘 {goal.todayCount}자 · {goal.totalDays}일 달성
              </span>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>버전 정보</h4>
            <div className="jan-settings-info">
              JustANotepad v2 (Beta) — TipTap 기반<br />
              Phase 5 (AI / Supabase / 인쇄 / 논문 / 역할 / HWPX / JustPin)
            </div>
          </section>

          {status && <div className="jan-settings-status">{status}</div>}
        </div>
      </div>
      {showPageSettings && <PageSettingsModal onClose={() => setShowPageSettings(false)} />}
    </div>
  )
}

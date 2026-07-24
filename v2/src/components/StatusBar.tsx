import type { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { useDocStore } from '../store/docStore'
import { useMemosStore } from '../store/memosStore'
import { useCollab } from '../hooks/useCollab'
import { useWritingGoalStore } from '../store/writingGoalStore'
import { PAPER_STYLES, pageMarginsSummary, useUIStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { PomodoroWidget } from './PomodoroWidget'
import { Icon } from './Icons'
import { fitPageZoom, setPageZoom } from '../lib/pageZoom'
import { readByocSyncHealth, readLocalSyncLabel, type ByocSyncHealth } from '../lib/byocSync'

interface StatusBarProps {
  editor: Editor | null
  onPageSettings?: () => void
  onSettings?: () => void
}

interface TextStats {
  chars: number
  words: number
  blocks: number
}

const EMPTY_STATS: TextStats = { chars: 0, words: 0, blocks: 0 }
const BYOC_PROVIDERS = new Set(['local', 'dropbox', 'onedrive'])

/**
 * Phase 17 — 강화된 StatusBar.
 * 글자/단어/단락 + 선택 영역 통계 + 저장 인디케이터 + 협업 + 줌 + 일일 목표 + 뽀모도로.
 */
export function StatusBar({ editor, onPageSettings, onSettings }: StatusBarProps) {
  const { savedAt } = useDocStore()
  const memo = useMemosStore((s) => s.current())
  const collab = useCollab()
  const goal = useWritingGoalStore()
  const syncEnabled = useSettingsStore((s) => s.syncEnabled)
  const syncProvider = useSettingsStore((s) => s.syncProvider)
  const zoom = useUIStore((s) => s.zoom)
  const focusMode = useUIStore((s) => s.focusMode)
  const toggleFocus = useUIStore((s) => s.toggleFocus)
  const pageSize = useUIStore((s) => s.pageSize)
  const pageOrientation = useUIStore((s) => s.pageOrientation)
  const pageMarginMm = useUIStore((s) => s.pageMarginMm)
  const pageMarginsMm = useUIStore((s) => s.pageMarginsMm)
  const pageColumnCount = useUIStore((s) => s.pageColumnCount)
  const paperStyle = useUIStore((s) => s.paperStyle)
  const showRulers = useUIStore((s) => s.showRulers)
  const viewLayout = useUIStore((s) => s.viewLayout)
  const [tick, setTick] = useState(0)
  const [syncHealth, setSyncHealth] = useState<ByocSyncHealth>(() => readByocSyncHealth())

  useEffect(() => {
    if (!editor) return
    const fn = () => setTick((t) => t + 1)
    editor.on('selectionUpdate', fn)
    editor.on('update', fn)
    return () => {
      editor.off('selectionUpdate', fn)
      editor.off('update', fn)
    }
  }, [editor])

  useEffect(() => {
    const refresh = () => setSyncHealth(readByocSyncHealth())
    refresh()
    window.addEventListener('jan-byoc-sync-health', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    const id = window.setInterval(refresh, 30000)
    return () => {
      window.removeEventListener('jan-byoc-sync-health', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
      window.clearInterval(id)
    }
  }, [])

  const docStats = editor ? getDocumentStats(editor) : EMPTY_STATS
  const selectionStats = editor ? getSelectionStats(editor) : EMPTY_STATS
  const dirty = !!memo && !!savedAt && memo.updatedAt > savedAt

  if (!editor) return null

  const sel = editor.state.selection
  const hasSel = !sel.empty
  void tick

  let saveLabel: string, saveClass = 'jan-save-badge'
  if (!savedAt) {
    // 파일로 저장한 적이 없어도 IndexedDB 자동 저장은 돌고 있다 — "저장 안 됨" 은 오해를 부른다
    if (memo?.updatedAt) { saveLabel = `자동 저장 · ${new Date(memo.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`; saveClass += ' is-saved' }
    else { saveLabel = '저장 안 됨'; saveClass += ' is-unsaved' }
  }
  else if (dirty) { saveLabel = '수정됨'; saveClass += ' is-dirty' }
  else { saveLabel = `저장: ${new Date(savedAt).toLocaleTimeString()}`; saveClass += ' is-saved' }

  const goalPct = goal.dailyTarget > 0 ? Math.min(100, Math.round((goal.todayCount / goal.dailyTarget) * 100)) : 0
  const paperLabel = PAPER_STYLES.find((style) => style.value === paperStyle)?.label.replace(' (기본)', '') || '줄노트'
  const viewLayoutLabel = viewLayout === 'draft' ? '초안' : '인쇄'
  const pageSummary = [
    viewLayoutLabel,
    pageSize,
    pageOrientation === 'landscape' ? '가로' : '세로',
    `${pageColumnCount}단`,
    `여백 ${pageMarginsSummary(pageMarginsMm, pageMarginMm)}`,
  ].join(' · ')
  const pageTitle = `${pageSummary} · ${paperLabel} · 눈금자 ${showRulers ? '켬' : '끔'}`

  const syncStatus = getSyncStatus(syncEnabled, syncProvider, syncHealth)

  return (
    <div className="jan-statusbar">
      <span>{docStats.chars}자</span>
      <span className="divider" />
      <span>{docStats.words}단어</span>
      <span className="divider" />
      <span>{docStats.blocks}단락</span>
      {hasSel && (
        <>
          <span className="divider" />
          <span style={{ color: '#D97757' }}>선택 {selectionStats.chars}자/{selectionStats.words}단어</span>
        </>
      )}
      <span className="divider" />
      <span className={saveClass}>{saveLabel}</span>
      {syncStatus && (
        <>
          <span className="divider" />
          <button
            type="button"
            className={`jan-sync-status-chip is-${syncStatus.kind}`}
            aria-label="개인 저장소 동기화 상태"
            title={syncStatus.title}
            onClick={onSettings}
          >
            <Icon name={syncStatus.kind === 'error' ? 'shield' : 'sync'} size={12} />
            <span>{syncStatus.label}</span>
          </button>
        </>
      )}
      <span className="divider" />
      <button
        type="button"
        className="jan-page-status-chip"
        aria-label="상태바 페이지 설정"
        title={pageTitle}
        onClick={onPageSettings}
      >
        <Icon name="page" size={12} />
        <span>{pageSummary}</span>
      </button>
      <span className="divider" />
      {focusMode && (
        <button type="button" className="jan-statusbar-chip" title="집중 모드 해제 (F11)" onClick={toggleFocus} style={{ background: 'rgba(217,119,87,0.15)', border: '1px solid rgba(217,119,87,0.4)', borderRadius: 4, padding: '1px 8px', fontSize: 11, cursor: 'pointer' }}>
          집중 모드
        </button>
      )}
      <span className="jan-zoom-control" aria-label="페이지 줌">
        <button type="button" aria-label="상태바 줌 아웃" title="줌 아웃" onClick={() => setPageZoom(zoom - 0.1)}>
          <Icon name="zoom-out" size={12} />
        </button>
        <button type="button" className="jan-zoom-value" aria-label="줌 100%로 리셋" title="100%로 리셋" onClick={() => setPageZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" aria-label="페이지 너비에 맞춤" title="페이지 너비에 맞춤" onClick={() => fitPageZoom('width')} style={{ fontSize: 11 }}>
          맞춤
        </button>
        <input
          type="range"
          className="jan-zoom-slider"
          aria-label="상태바 줌 슬라이더"
          min={35}
          max={200}
          step={5}
          value={Math.round(zoom * 100)}
          onChange={(event) => setPageZoom(Number(event.currentTarget.value) / 100)}
        />
        <button type="button" aria-label="상태바 줌 인" title="줌 인" onClick={() => setPageZoom(zoom + 0.1)}>
          <Icon name="zoom-in" size={12} />
        </button>
      </span>
      {goal.dailyTarget > 0 && (
        <>
          <span className="divider" />
          <span title={`오늘 ${goal.todayCount} / 목표 ${goal.dailyTarget}자`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 60, height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
              <span style={{ display: 'block', width: goalPct + '%', height: '100%', background: goalPct >= 100 ? '#4CAF50' : '#D97757', transition: 'width 0.3s' }} />
            </span>
            {goalPct}%
          </span>
        </>
      )}
      {collab.status !== 'disconnected' && (
        <>
          <span className="divider" />
          <span className={'jan-collab-badge is-' + collab.status}>
            {collab.status === 'connected' ? `협업 ${collab.peers}명` : '연결 중...'}
          </span>
        </>
      )}
      <PomodoroWidget />
      <span className="flex-spacer" />
      <span className="hint">Ctrl+S · Ctrl+K 링크 · Ctrl+Shift+P · F1</span>
    </div>
  )
}

function getDocumentStats(editor: Editor): TextStats {
  const stats: TextStats = { chars: 0, words: 0, blocks: 0 }
  editor.state.doc.descendants((node) => {
    if (node.isText) {
      const text = node.text || ''
      stats.chars += text.length
      stats.words += countWords(text)
    } else if (node.type.name === 'paragraph' || node.type.name === 'heading' || node.type.name === 'listItem' || node.type.name === 'taskItem') {
      stats.blocks += 1
    }
  })
  return stats
}

function getSelectionStats(editor: Editor): TextStats {
  const selection = editor.state.selection
  if (selection.empty) return EMPTY_STATS
  const text = editor.state.doc.textBetween(selection.from, selection.to, ' ')
  return {
    chars: text.length,
    words: countWords(text),
    blocks: 0,
  }
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function getSyncStatus(
  syncEnabled: boolean,
  syncProvider: string,
  health: ByocSyncHealth
): { kind: 'ok' | 'idle' | 'error'; label: string; title: string } | null {
  const provider = health.provider || syncProvider
  const providerLabel = formatSyncProvider(provider)

  if (health.lastError) {
    return {
      kind: 'error',
      label: `${providerLabel} 실패`,
      title: `최근 개인 저장소 백업 실패: ${formatSyncTime(health.lastErrorAt)} - ${health.lastError}`,
    }
  }

  if (!syncEnabled || !BYOC_PROVIDERS.has(syncProvider)) return null

  if (!health.lastAt) {
    return {
      kind: 'idle',
      label: '백업 대기',
      title: `${providerLabel} 개인 저장소 자동 백업이 켜져 있습니다. 아직 완료 기록은 없습니다.`,
    }
  }

  return {
    kind: 'ok',
    label: `백업 ${formatRelativeSyncTime(health.lastAt)}`,
    title: `${providerLabel} 개인 저장소 마지막 백업: ${formatSyncTime(health.lastAt)}`,
  }
}

function formatSyncProvider(provider: string): string {
  if (provider === 'local') return readLocalSyncLabel()
  if (provider === 'dropbox') return 'Dropbox'
  if (provider === 'onedrive') return 'OneDrive'
  if (provider === 'supabase') return 'Supabase'
  return '개인 저장소'
}

function formatSyncTime(value: number): string {
  if (!value) return '기록 없음'
  return new Date(value).toLocaleString('ko-KR')
}

function formatRelativeSyncTime(value: number): string {
  if (!value) return '대기'
  const elapsedMs = Date.now() - value
  const minutes = Math.max(0, Math.floor(elapsedMs / 60000))
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

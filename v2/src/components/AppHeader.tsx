import { useEffect, useState } from 'react'
import { Icon } from './Icons'
import { useUIStore } from '../store/uiStore'
import { useMemosStore } from '../store/memosStore'
import { useRoleToolsStore } from '../store/roleToolsStore'
import { flash } from '../lib/flash'
import { askText } from '../lib/promptModal'

interface AppHeaderProps {
  /** 문서(메모) 탭 — 헤더와 같은 줄에 놓아 줄 수를 하나 줄인다 (한글·워드처럼) */
  tabsSlot?: React.ReactNode
  onAccount: () => void
  onCmdPalette: () => void
  onSearch: () => void
  onSyncSettings?: () => void
  onGlobalSearch?: () => void
  onCalendar: () => void
  onOcr: () => void
  onChat: () => void
  onShare: () => void
  onSettings: () => void
  onHelp: () => void
  onAbout: () => void
  onAi?: () => void
  onPostit?: () => void
  onPaint?: () => void
  onRoles?: () => void
  onTemplates?: () => void
  onCards?: () => void
  onLectureNotes?: () => void
  onMeetingNotes?: () => void
}

/**
 * Phase 27 — v1 의 26개 topbar 버튼 모두 v2 에 이식.
 * 좌: 햄버거 + 로고 + 메모 제목 input + 포모도로 표시
 * 우: 명령팔레트/웹검색/AI/캘린더/JustPin/강의노트/회의노트/명함/그림판/이미지변환/역할대시보드/테마/검색/집중/도움말/홈허브/동기화/공유/로그인/창버튼
 */

/**
 * 통합 바 왼쪽 — 사이드바 단추 · 로고 · 문서 제목 · 문서 탭.
 * 리본 탭 줄과 같은 줄에 놓아 화면 한 줄을 통째로 아낀다 (한글의 제목 표시줄과 같은 구실).
 */
export function HeaderLeading() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  function toggleSidebarFromHeader() {
    // 모바일에서는 사이드바가 겹쳐 뜨므로 body 클래스로 여닫는다
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches) {
      document.body.classList.toggle('jan-mobile-sidebar-open')
      return
    }
    toggleSidebar()
  }

  return (
    <div className="jan-bar-leading">
      <button className="jan-header-btn" onClick={toggleSidebarFromHeader} title={sidebarCollapsed ? '사이드바 열기' : '사이드바 접기'} aria-label="메뉴">
        <Icon name="menu" size={17} />
      </button>
      <div className="jan-bar-logo" title="JustANotepad" aria-label="JustANotepad">
        <Icon name="file-text" size={15} />
      </div>
    </div>
  )
}

export function AppHeader(p: AppHeaderProps) {
  const { list } = useMemosStore()
  const roleCount = useRoleToolsStore((s) => s.selectedRoleIds.length)
  const [showMobileMore, setShowMobileMore] = useState(false)
  const [showHomeHub, setShowHomeHub] = useState(false)
  const setCurrentMemo = useMemosStore((s) => s.setCurrent)

  useEffect(() => {
    if (!showHomeHub) return
    const close = () => setShowHomeHub(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [showHomeHub])

  /* === 포모도로 인라인 타이머 === */
  const [pomoLeft, setPomoLeft] = useState<number | null>(null)
  useEffect(() => {
    if (pomoLeft === null) return
    const t = setTimeout(() => {
      if (pomoLeft <= 1000) {
        setPomoLeft(null)
        flash('포모도로 완료! 5분 휴식하세요', 4000)
        try { if ('Notification' in window && Notification.permission === 'granted') new Notification('포모도로 완료', { body: '5분 휴식하세요' }) } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
        return
      }
      setPomoLeft(pomoLeft - 1000)
    }, 1000)
    return () => clearTimeout(t)
  }, [pomoLeft])
  const togglePomo = async () => {
    if (pomoLeft !== null) { setPomoLeft(null); flash('포모도로를 중단했습니다'); return }
    const v = await askText('포모도로 시간 (분):', '25', { placeholder: '예: 25' })
    if (v === null) return
    const min = Number(v) || 25
    try { if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission() } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
    setPomoLeft(min * 60 * 1000)
  }
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  const pomoText = pomoLeft !== null
    ? `${String(Math.floor(pomoLeft / 60000)).padStart(2, '0')}:${String(Math.floor((pomoLeft % 60000) / 1000)).padStart(2, '0')}`
    : null

  useEffect(() => {
    if (!showMobileMore) return
    const close = () => setShowMobileMore(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [showMobileMore])

  const openRoleDash = () => {
    if (p.onRoles) p.onRoles()
    else alert('역할 팩 패널을 열 수 없습니다.')
  }
  const openHomeHub = () => {
    // 팝업 차단 시 아무 반응이 없던 window.open 방식 대신 인앱 목록으로
    setShowHomeHub((v) => !v)
  }
  const openSync = () => {
    if (p.onSyncSettings) p.onSyncSettings()
    else p.onSettings()
  }
  const openCms = () => {
    if (confirm('CMS 관리자 페이지로 이동합니다 (Super Admin 전용)')) {
      window.open(`${location.origin}/admin`, '_blank', 'noopener,noreferrer')
    }
  }
  type TauriWindow = {
    isAlwaysOnTop?: () => Promise<boolean>
    setAlwaysOnTop?: (value: boolean) => Promise<void>
    minimize?: () => Promise<void>
    toggleMaximize?: () => Promise<void>
    close?: () => Promise<void>
  }
  const getTauriWindow = (): TauriWindow | undefined =>
    (window as Window & { __TAURI__?: { window?: { getCurrent?: () => TauriWindow } } }).__TAURI__?.window?.getCurrent?.()
  const tauriPin = async () => {
    try {
      const w = getTauriWindow()
      if (!w) { alert('데스크톱 앱에서만 사용 가능'); return }
      if (w.setAlwaysOnTop) {
        const cur = await w.isAlwaysOnTop?.()
        await w.setAlwaysOnTop(!cur)
      }
    } catch (e: unknown) {
      alert('실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }
  const tauriMin = async () => {
    try { await getTauriWindow()?.minimize?.() } catch {
      // Desktop window controls are best-effort in the browser build.
    }
  }
  const tauriMax = async () => {
    try { await getTauriWindow()?.toggleMaximize?.() } catch {
      // Desktop window controls are best-effort in the browser build.
    }
  }
  const tauriClose = async () => {
    try { await getTauriWindow()?.close?.() } catch {
      // Desktop window controls are best-effort in the browser build.
    }
  }
  const runMobileMore = (action: () => void | Promise<void>) => {
    setShowMobileMore(false)
    void action()
  }
  /* 유틸 메뉴 — 문서 작업(리본)이 아닌 것들만 모아 갈래로 나눠 둔다.
     "유틸끼리" 묶여 있어야 무엇을 찾을지 감이 잡힌다. */
  type MoreItem = { label: string; icon: Parameters<typeof Icon>[0]['name']; help?: string; onClick: () => void | Promise<void> }
  const moreSections: Array<{ title: string; items: MoreItem[] }> = [
    {
      /* 만들기 도구·기록은 「도구」 탭으로, 찾기·집중·테마·설정은 파일·보기 탭으로 옮겼다.
         여기에는 리본에 자리가 마땅치 않은 앱 살림만 남긴다 (좁은 화면의 뒷문 구실도 한다). */
      title: '앱',
      items: [
        { label: '최근 메모 (홈 허브)', icon: 'home', help: 'home', onClick: openHomeHub },
        { label: '동기화', icon: 'sync', help: 'sync', onClick: openSync },
        { label: '도움말 (F1)', icon: 'help', help: 'help', onClick: p.onHelp },
        { label: '앱 정보 · 변경 내역', icon: 'info', help: 'about', onClick: p.onAbout },
        { label: 'CMS 관리자', icon: 'shield', help: 'cms', onClick: openCms },
      ],
    },
  ]
  return (
    <>
      <div className="jan-header-right">
        {/* 헤더에는 늘 쓰는 것만 남기고 나머지는 더보기(⋯)로 모았다.
            같은 기능이 리본에도 있으면 여기서는 뺀다 — 아이콘이 많을수록 아무것도 안 보인다.
            각 단추의 data-help 는 설명 카드(HelpTipLayer)가 읽는 열쇠다. */}
        {pomoText && (
          <button className="jan-header-btn jan-pomo-display" data-help="pomodoro" onClick={togglePomo} title="집중 타이머 (클릭: 정지)" style={{ minWidth: 58, fontFamily: 'monospace', fontWeight: 700 }}>
            {pomoText}
          </button>
        )}
        <button className="jan-header-btn jan-header-role-btn jan-header-extra" data-help="roles" onClick={openRoleDash} title="내 도구 / 역할 팩" aria-label="내 도구 / 역할 팩">
          <Icon name="briefcase" />
          <span className="jan-header-btn-label">내 도구</span>
          {roleCount > 0 && <span className="jan-header-role-badge">{roleCount}</span>}
        </button>
        {showHomeHub && (
          <div className="jan-home-hub" role="menu" aria-label="최근 메모">
            <div className="jan-home-hub-head">최근 메모</div>
            {list().slice(0, 20).map((m) => (
              <button key={m.id} role="menuitem" className="jan-home-hub-item" onClick={() => { setCurrentMemo(m.id); setShowHomeHub(false) }}>
                <span className="jan-home-hub-title">{m.title || '제목 없음'}</span>
                <span className="jan-home-hub-time">{m.updatedAt ? new Date(m.updatedAt).toLocaleString('ko-KR') : ''}</span>
              </button>
            ))}
            {list().length === 0 && <div className="jan-home-hub-empty">메모가 없습니다.</div>}
          </div>
        )}
        <span className="jan-header-sep" aria-hidden="true" />
        <div className="jan-header-more-wrap" onPointerDown={(e) => e.stopPropagation()}>
          <button
            className="jan-header-btn jan-header-more-btn"
            onClick={() => setShowMobileMore((open) => !open)}
            data-help="more"
            title="더보기"
            aria-label="더보기"
            aria-expanded={showMobileMore}
            aria-haspopup="menu"
          >
            <Icon name="sliders" />
            <span className="jan-header-btn-label">더보기</span>
          </button>
          {showMobileMore && (
            <div className="jan-header-more-menu" role="menu">
              {moreSections.map((sec) => (
                <div key={sec.title} className="jan-more-sec">
                  <div className="jan-more-sec-title">{sec.title}</div>
                  {sec.items.map((action) => (
                    <button key={action.label} data-help={action.help} onClick={() => runMobileMore(action.onClick)} role="menuitem">
                      <Icon name={action.icon} size={14} />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="jan-header-divider" />
        <button className="jan-header-btn jan-header-extra" onClick={p.onAccount} title="로그인 / 계정" aria-label="로그인"><Icon name="login" /><span className="jan-header-btn-label">로그인</span></button>
        {isTauri && (
          <>
            <button className="jan-header-btn jan-header-extra" onClick={tauriPin} title="항상 위에 (데스크톱)" aria-label="핀"><Icon name="pin" /></button>
            <button className="jan-header-btn jan-header-extra" onClick={tauriMin} title="최소화" aria-label="최소화"><Icon name="window-min" /></button>
            <button className="jan-header-btn jan-header-extra" onClick={tauriMax} title="최대화 / 복원" aria-label="최대화"><Icon name="window-max" /></button>
            <button className="jan-header-btn jan-header-close jan-header-extra" onClick={tauriClose} title="닫기" aria-label="닫기" style={{ background: 'rgba(220,60,60,0.35)' }}><Icon name="close" /></button>
          </>
        )}
      </div>
    </>
  )
}

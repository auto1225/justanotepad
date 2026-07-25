import { useEffect, useState } from 'react'
import { Icon } from './Icons'
import { useUIStore } from '../store/uiStore'
import { useThemeStore } from '../store/themeStore'
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
export function AppHeader(p: AppHeaderProps) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const focusMode = useUIStore((s) => s.focusMode)
  const toggleFocus = useUIStore((s) => s.toggleFocus)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const { current, updateCurrent, newMemo, list } = useMemosStore()
  const roleCount = useRoleToolsStore((s) => s.selectedRoleIds.length)
  const memo = current()
  const title = memo?.title || '새 메모'
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

  function cycleTheme() {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light')
  }

  function toggleSidebarFromHeader() {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches) {
      document.body.classList.toggle('jan-mobile-sidebar-open')
      return
    }
    toggleSidebar()
  }

  const themeIcon: 'sun' | 'moon' | 'auto' =
    theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'auto'

  /* === v1 전용 핸들러 (인라인 구현) === */
  const openWebSearch = () => {
    /* v1 의 인앱 웹 브라우저 호출 — onSearch prop 으로 모달 열기 */
    p.onSearch()
  }
  const openJustPin = () => {
    /* 새 메모를 빠른 메모 모드로 생성 */
    if (p.onPostit) p.onPostit()
    else { newMemo(); alert('새 JustPin 메모 생성됨') }
  }
  const insertLectureTemplate = () => {
    if (p.onLectureNotes) {
      p.onLectureNotes()
      return
    }
    newMemo()
    setTimeout(() => {
      updateCurrent({
        title: '강의노트 — ' + new Date().toLocaleDateString('ko-KR'),
        content: `<h2>강의 정보</h2><p><strong>과목:</strong> </p><p><strong>교수:</strong> </p><p><strong>날짜:</strong> ${new Date().toLocaleDateString('ko-KR')}</p><h2>핵심 개념</h2><ul><li></li></ul><h2>본문</h2><p></p><h2>질문 / 복습 포인트</h2><ul><li></li></ul>`,
      })
    }, 50)
  }
  const insertMeetingTemplate = () => {
    if (p.onMeetingNotes) {
      p.onMeetingNotes()
      return
    }
    newMemo()
    setTimeout(() => {
      updateCurrent({
        title: '회의노트 — ' + new Date().toLocaleDateString('ko-KR'),
        content: `<h2>회의 정보</h2><p><strong>일시:</strong> ${new Date().toLocaleString('ko-KR')}</p><p><strong>참석자:</strong> </p><p><strong>안건:</strong> </p><h2>논의 내용</h2><p></p><h2>결정사항</h2><ul><li></li></ul><h2>액션 아이템 (담당자/마감일)</h2><ul><li></li></ul>`,
      })
    }, 50)
  }
  const openImageConverter = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = () => {
      const file = inp.files?.[0]; if (!file) return
      const r = new FileReader()
      r.onload = () => {
        const img = new Image()
        img.onload = () => {
          const w = Number(window.prompt('새 가로 (px):', String(img.width))) || img.width
          const ratio = w / img.width
          const h = Math.round(img.height * ratio)
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h
          cv.getContext('2d')!.drawImage(img, 0, 0, w, h)
          const fmt = window.prompt('포맷 (png/jpeg/webp):', 'webp') || 'webp'
          const dataUrl = cv.toDataURL('image/' + fmt, 0.85)
          const a = document.createElement('a'); a.href = dataUrl; a.download = `converted.${fmt}`
          document.body.appendChild(a); a.click(); document.body.removeChild(a)
        }
        img.src = String(r.result)
      }
      r.readAsDataURL(file)
    }
    inp.click()
  }
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
  const mobileMoreActions: Array<{ label: string; icon: Parameters<typeof Icon>[0]['name']; onClick: () => void | Promise<void> }> = [
    { label: '명령 팔레트', icon: 'cmd', onClick: p.onCmdPalette },
    { label: 'AI 도우미', icon: 'ai', onClick: p.onAi || p.onChat },
    { label: '웹 검색', icon: 'globe', onClick: openWebSearch },
    { label: '빠른 메모', icon: 'page', onClick: p.onCalendar },
    { label: 'JustPin', icon: 'pin', onClick: openJustPin },
    { label: '강의노트', icon: 'mic', onClick: insertLectureTemplate },
    { label: '회의노트', icon: 'users', onClick: insertMeetingTemplate },
    { label: '명함', icon: 'cards', onClick: () => p.onCards?.() },
    { label: '그림판', icon: 'paint', onClick: () => p.onPaint?.() },
    { label: '이미지 변환', icon: 'image', onClick: openImageConverter },
    { label: '테마', icon: themeIcon, onClick: cycleTheme },
    { label: '집중 모드', icon: 'eye', onClick: toggleFocus },
    { label: 'OCR', icon: 'image-text', onClick: p.onOcr },
    { label: 'CMS', icon: 'shield', onClick: openCms },
    { label: '도움말', icon: 'help', onClick: p.onHelp },
    { label: '홈 허브', icon: 'home', onClick: openHomeHub },
    { label: '동기화', icon: 'sync', onClick: openSync },
    { label: '공유', icon: 'users', onClick: p.onShare },
    { label: '설정', icon: 'settings', onClick: p.onSettings },
    { label: '버전', icon: 'info', onClick: p.onAbout },
  ]
  return (
    <header className="jan-app-header">
      <div className="jan-header-left">
        <button className="jan-header-btn" onClick={toggleSidebarFromHeader} title={sidebarCollapsed ? '사이드바 열기' : '사이드바 접기'} aria-label="메뉴">
          <Icon name="menu" size={18} />
        </button>
        <div className="jan-header-logo">
          <Icon name="file-text" size={16} />
          <span>JustANotepad</span>
        </div>
      </div>

      <input type="text" className="jan-header-title-input" value={title} onChange={(e) => updateCurrent({ title: e.target.value })} placeholder="제목 없음" aria-label="메모 제목" />

      {p.tabsSlot}

      <div className="jan-header-right">
        {pomoText && (
          <button className="jan-header-btn jan-pomo-display" onClick={togglePomo} title="포모도로 (클릭: 정지)" style={{ minWidth: 64, fontFamily: 'monospace', fontWeight: 700 }}>
            {pomoText}
          </button>
        )}
        <button className="jan-header-btn jan-header-compact-extra" onClick={p.onCmdPalette} title="명령 팔레트 (Ctrl+Shift+P)" aria-label="명령 팔레트"><Icon name="cmd" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={openWebSearch} title="웹 검색" aria-label="웹 검색"><Icon name="globe" /></button>
        <button className="jan-header-btn jan-header-compact-extra" onClick={p.onAi || p.onChat} title="AI 어시스턴트 (Ctrl+/)" aria-label="AI"><Icon name="ai" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={p.onCalendar} title="빠른 메모 (Ctrl+Shift+J)" aria-label="빠른 메모"><Icon name="page" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={openJustPin} title="새 JustPin" aria-label="JustPin"><Icon name="pin" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={insertLectureTemplate} title="강의노트" aria-label="강의노트"><Icon name="mic" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={insertMeetingTemplate} title="회의노트" aria-label="회의노트"><Icon name="users" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={p.onCards} title="명함 / 카드 관리" aria-label="명함"><Icon name="cards" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={p.onPaint} title="그림판" aria-label="그림판"><Icon name="paint" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={openImageConverter} title="이미지 변환기" aria-label="이미지 변환"><Icon name="image" /></button>
        <button className="jan-header-btn jan-header-role-btn" onClick={openRoleDash} title="내 도구 / 역할 팩" aria-label="내 도구 / 역할 팩">
          <Icon name="briefcase" />
          {roleCount > 0 && <span className="jan-header-role-badge">{roleCount}</span>}
        </button>
        <button className="jan-header-btn jan-header-extra" onClick={cycleTheme} title={`테마: ${theme}`} aria-label="테마"><Icon name={themeIcon} /></button>
        <button className="jan-header-btn" onClick={p.onGlobalSearch || p.onSearch} title="전체 검색 (Ctrl+Shift+F)" aria-label="전체 검색"><Icon name="search" /></button>
        <button className={'jan-header-btn jan-header-extra' + (focusMode ? ' is-active' : '')} onClick={() => toggleFocus()} title="집중 모드 (F11)" aria-label="집중 모드"><Icon name="eye" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={p.onOcr} title="OCR" aria-label="OCR"><Icon name="image-text" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={openCms} title="CMS 관리자 (Super Admin)" aria-label="CMS"><Icon name="shield" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={p.onHelp} title="도움말 (F1)" aria-label="도움말"><Icon name="help" /></button>
        <span style={{ position: 'relative', display: 'inline-flex' }} onPointerDown={(e) => e.stopPropagation()}>
          <button className="jan-header-btn jan-header-extra" onClick={openHomeHub} title="홈 허브 — 최근 메모" aria-label="홈 허브" aria-expanded={showHomeHub}><Icon name="home" /></button>
          {showHomeHub && (
            <div
              role="menu"
              aria-label="최근 메모"
              style={{ position: 'absolute', top: '110%', right: 0, width: 300, maxHeight: 380, overflowY: 'auto', background: 'var(--jan-bg, #fff)', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 300, padding: '6px 0' }}
            >
              <div style={{ padding: '4px 12px 8px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>최근 메모</div>
              {list().slice(0, 20).map((m) => (
                <button
                  key={m.id}
                  role="menuitem"
                  onClick={() => { setCurrentMemo(m.id); setShowHomeHub(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'transparent', border: 0, cursor: 'pointer', fontSize: 13 }}
                >
                  <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title || '제목 없음'}</span>
                  <span style={{ display: 'block', fontSize: 11, color: '#888' }}>{m.updatedAt ? new Date(m.updatedAt).toLocaleString('ko-KR') : ''}</span>
                </button>
              ))}
              {list().length === 0 && <div style={{ padding: '10px 12px', color: '#999', fontSize: 12 }}>메모가 없습니다.</div>}
            </div>
          )}
        </span>
        <button className="jan-header-btn jan-header-extra" onClick={openSync} title="동기화 설정" aria-label="동기화"><Icon name="sync" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={p.onShare} title="공유" aria-label="공유"><Icon name="users" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={p.onSettings} title="설정 (Ctrl+,)" aria-label="설정"><Icon name="settings" /></button>
        <button className="jan-header-btn jan-header-extra" onClick={p.onAbout} title="버전 / 변경 내역" aria-label="버전"><Icon name="info" /></button>
        <div className="jan-header-more-wrap" onPointerDown={(e) => e.stopPropagation()}>
          <button
            className="jan-header-btn jan-header-more-btn"
            onClick={() => setShowMobileMore((open) => !open)}
            title="더보기"
            aria-label="더보기"
            aria-expanded={showMobileMore}
            aria-haspopup="menu"
          >
            <Icon name="sliders" />
          </button>
          {showMobileMore && (
            <div className="jan-header-more-menu" role="menu">
              {mobileMoreActions.map((action) => (
                <button key={action.label} onClick={() => runMobileMore(action.onClick)} role="menuitem">
                  <Icon name={action.icon} size={14} />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="jan-header-divider" />
        <button className="jan-header-btn jan-header-extra" onClick={p.onAccount} title="로그인 / 계정" aria-label="로그인"><Icon name="login" /></button>
        {isTauri && (
          <>
            <button className="jan-header-btn jan-header-extra" onClick={tauriPin} title="항상 위에 (데스크톱)" aria-label="핀"><Icon name="pin" /></button>
            <button className="jan-header-btn jan-header-extra" onClick={tauriMin} title="최소화" aria-label="최소화"><Icon name="window-min" /></button>
            <button className="jan-header-btn jan-header-extra" onClick={tauriMax} title="최대화 / 복원" aria-label="최대화"><Icon name="window-max" /></button>
            <button className="jan-header-btn jan-header-close jan-header-extra" onClick={tauriClose} title="닫기" aria-label="닫기" style={{ background: 'rgba(220,60,60,0.35)' }}><Icon name="close" /></button>
          </>
        )}
      </div>
    </header>
  )
}

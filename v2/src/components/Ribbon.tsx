import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'
import type { IconName } from './Icons'
import { shortLabel } from '../lib/ribbonLabel'

/**
 * 리본 메뉴 — 한글·워드 방식.
 *
 * 탭(파일·편집·보기·입력·서식·쪽·도구·논문)을 고르면 그 탭의 명령이 묶음별로 펼쳐진다.
 * 기존 드롭다운 메뉴와 같은 데이터를 쓰므로 명령이 하나도 빠지지 않는다 —
 * 묶음 구분선(divider)이 리본의 묶음 경계가 되고, 묶음마다 대표 명령은 큰 버튼으로,
 * 나머지는 묶음 끝의 더보기(▾)에 담긴다.
 *
 * 접근성: 버튼에 보이는 글자는 짧게 줄이되 aria-label·title 에는 원래 이름을 그대로 둔다.
 */

export interface RibbonItem {
  label: string
  /** 리본 버튼에 보일 짧은 이름 (없으면 label 에서 자동으로 줄인다) */
  short?: string
  hint?: string
  icon?: IconName
  divider?: string
  onClick?: () => void
}

export interface RibbonTab {
  label: string
  items: RibbonItem[]
  /** 표·그림처럼 대상을 골랐을 때만 나타나는 맥락 탭 (한글의 개체 탭) */
  context?: boolean
}

/** 묶음 오른쪽 아래 화살표 — 그 묶음의 전체 설정 창을 연다 (한글·워드의 대화상자 연결) */
export interface RibbonLauncher {
  label: string
  onClick: () => void
}

interface Section {
  caption: string
  items: RibbonItem[]
}

/** 묶음 안에서 큰 버튼으로 내보낼 최대 개수 — 나머지는 더보기로 */
const MAX_PRIMARY = 6

function splitSections(items: RibbonItem[]): Section[] {
  const out: Section[] = []
  let cur: Section = { caption: '', items: [] }
  items.forEach((it) => {
    if (it.divider) {
      if (cur.items.length) out.push(cur)
      cur = { caption: it.divider, items: [] }
      return
    }
    if (!it.onClick) return
    cur.items.push(it)
  })
  if (cur.items.length) out.push(cur)
  return out
}

function OverflowMenu({ items, caption }: { items: RibbonItem[]; caption: string }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div className="jan-ribbon-more" ref={wrapRef}>
      <button
        type="button"
        className={'jan-ribbon-btn is-more' + (open ? ' is-open' : '')}
        onClick={() => setOpen((v) => !v)}
        title={`${caption || '이 묶음'} 더보기 (${items.length}개)`}
        aria-label={`${caption || '이 묶음'} 더보기`}
        aria-expanded={open}
      >
        <Icon name="chevron-down" size={16} />
        <span>더보기</span>
      </button>
      {open && (
        <div className="jan-ribbon-dropdown" role="menu">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              className="jan-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                it.onClick?.()
              }}
            >
              {it.icon && <Icon name={it.icon} size={14} />}
              <span className="jan-menu-label">{it.label}</span>
              {it.hint && <span className="jan-menu-hint">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Ribbon({
  tabs,
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapsed,
  launchers = {},
  leading,
  trailing,
}: {
  tabs: RibbonTab[]
  activeTab: string
  onTabChange: (label: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  /** 묶음 이름 → 그 묶음의 전체 설정 창 */
  launchers?: Record<string, RibbonLauncher>
  /** 탭 줄 왼쪽 — 사이드바 단추·로고·문서 탭 (헤더 줄을 없애고 여기에 합쳤다) */
  leading?: React.ReactNode
  /** 탭 줄 오른쪽 — 자주 쓰는 도구 아이콘 */
  trailing?: React.ReactNode
}) {
  const active = tabs.find((t) => t.label === activeTab) || tabs[0]
  const sections = splitSections(active?.items || [])

  return (
    <div className={'jan-ribbon' + (collapsed ? ' is-collapsed' : '')}>
      <div className="jan-ribbon-bar">
        {leading}
        <div className="jan-ribbon-tabs" role="tablist" aria-label="리본 메뉴">
        {tabs.map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={t.label === active?.label}
            className={
              'jan-ribbon-tab' +
              (t.label === active?.label ? ' is-active' : '') +
              (t.context ? ' is-context' : '')
            }
            onClick={() => {
              onTabChange(t.label)
              if (collapsed) onToggleCollapsed() // 접혀 있으면 펴면서 그 탭을 보여준다
            }}
            onDoubleClick={() => onToggleCollapsed()} // 한글·워드처럼 탭 두 번 누르면 접기
          >
            {t.label}
          </button>
        ))}
        </div>
        <span className="jan-ribbon-tabs-spacer" />
        {trailing}
        <button
          type="button"
          className="jan-ribbon-collapse"
          onClick={onToggleCollapsed}
          title={collapsed ? '리본 펼치기' : '리본 접기'}
          aria-label={collapsed ? '리본 펼치기' : '리본 접기'}
        >
          <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} />
        </button>
      </div>
      {!collapsed && (
        <div className="jan-ribbon-body" role="tabpanel" aria-label={`${active?.label} 리본`}>
          {sections.map((sec, si) => {
            const primary = sec.items.slice(0, MAX_PRIMARY)
            const rest = sec.items.slice(MAX_PRIMARY)
            return (
              <div className="jan-ribbon-group" key={si}>
                <div className="jan-ribbon-items">
                  {primary.map((it, i) => (
                    <button
                      key={i}
                      type="button"
                      className="jan-ribbon-btn"
                      onClick={it.onClick}
                      title={it.hint ? `${it.label} (${it.hint})` : it.label}
                      aria-label={it.label}
                      /* 설명 카드 — 따로 적어 둔 안내가 있으면 그것을, 없으면 이름·단축키로 만든다 */
                      data-help={`ribbon:${it.label}`}
                      data-help-hint={it.hint || undefined}
                      data-help-group={sec.caption || undefined}
                    >
                      <Icon name={it.icon || 'file-text'} size={18} />
                      <span>{shortLabel(it)}</span>
                    </button>
                  ))}
                  {rest.length > 0 && <OverflowMenu items={rest} caption={sec.caption} />}
                  {launchers[sec.caption] && (
                    <button
                      type="button"
                      className="jan-ribbon-launcher"
                      onClick={launchers[sec.caption].onClick}
                      title={launchers[sec.caption].label}
                      aria-label={launchers[sec.caption].label}
                    >
                      <Icon name="chevron-down" size={11} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'
import type { IconName } from './Icons'

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
}

interface Section {
  caption: string
  items: RibbonItem[]
}

/** 묶음 안에서 큰 버튼으로 내보낼 최대 개수 — 나머지는 더보기로 */
const MAX_PRIMARY = 6

/** 리본 버튼에 쓸 짧은 이름 — 괄호·부연 설명을 걷어내고 앞부분만 남긴다 */
export function shortLabel(item: RibbonItem): string {
  if (item.short) return item.short
  let s = item.label
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s*[—·:].*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length > 7) {
    const cut = s.slice(0, 7)
    const sp = cut.lastIndexOf(' ')
    s = sp >= 3 ? cut.slice(0, sp) : cut
  }
  return s || item.label
}

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
}: {
  tabs: RibbonTab[]
  activeTab: string
  onTabChange: (label: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const active = tabs.find((t) => t.label === activeTab) || tabs[0]
  const sections = splitSections(active?.items || [])

  return (
    <div className={'jan-ribbon' + (collapsed ? ' is-collapsed' : '')}>
      <div className="jan-ribbon-tabs" role="tablist" aria-label="리본 메뉴">
        {tabs.map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={t.label === active?.label}
            className={'jan-ribbon-tab' + (t.label === active?.label ? ' is-active' : '')}
            onClick={() => {
              onTabChange(t.label)
              if (collapsed) onToggleCollapsed() // 접혀 있으면 펴면서 그 탭을 보여준다
            }}
            onDoubleClick={() => onToggleCollapsed()} // 한글·워드처럼 탭 두 번 누르면 접기
          >
            {t.label}
          </button>
        ))}
        <span className="jan-ribbon-tabs-spacer" />
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
                    >
                      <Icon name={it.icon || 'file-text'} size={18} />
                      <span>{shortLabel(it)}</span>
                    </button>
                  ))}
                  {rest.length > 0 && <OverflowMenu items={rest} caption={sec.caption} />}
                </div>
                {sec.caption && <div className="jan-ribbon-caption">{sec.caption}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

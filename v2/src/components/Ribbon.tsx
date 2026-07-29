import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  /** 이 단추를 누르면 열리는 아래 차림표 — 워드의 「▾」 가 붙은 단추 */
  menu?: RibbonItem[]
  /** 작은 단추로 (아이콘+글자 한 줄). 큰 단추 대신 세 개씩 층층이 쌓인다 */
  small?: boolean
  /** 격자로 늘어놓을 항목들 — 아홉 칸 맞춤·색판처럼 */
  grid?: { cols: number; items: RibbonItem[] }
  /** 펼쳤을 때 보일 것을 직접 그린다 — 워드의 색판·선 두께 고르개처럼 */
  panel?: () => React.ReactNode
}

export interface RibbonTab {
  label: string
  items: RibbonItem[]
  /** 표·그림처럼 대상을 골랐을 때만 나타나는 맥락 탭 (한글의 개체 탭) */
  context?: boolean
  /** 부가 묶음(AI·논문) — 코어 탭과 구분해 보여 준다 */
  extra?: boolean
  /** 부가 탭 앞에 붙는 작은 아이콘 */
  icon?: IconName
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

/**
 * 펼친 차림표를 화면 맨 위층에 띄운다.
 *
 * 리본 본문은 가로로 밀어 보는 상자(overflow-x:auto)라, 그 안에 놓인 차림표는
 * 잘려서 보이지 않는다. 그래서 몸통(body)에 따로 그리고 자리만 계산해 붙인다.
 */
function popoverSpot(el: HTMLElement | null): { left: number; top: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { left: Math.max(4, Math.min(r.left, window.innerWidth - 360)), top: r.bottom + 2 }
}

/** 펼친 동안 문서를 밀면 자리가 어긋나므로 닫는다 (워드도 그렇게 한다) */
function useCloseOnScroll(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])
}

/** 묶음 안에서 큰 버튼으로 내보낼 최대 개수 — 나머지는 더보기로 */
const MAX_PRIMARY = 9
/** 작은 버튼은 세 개씩 층층이 쌓이므로 조금 더 담는다 */
const MAX_SMALL = 9

/** 작은 단추를 세 개씩 나눈다 */
function smallColumns(items: RibbonItem[]): RibbonItem[][] {
  const cols: RibbonItem[][] = []
  for (let i = 0; i < items.length; i += 3) cols.push(items.slice(i, i + 3))
  return cols
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
    if (!it.onClick && !it.menu && !it.grid && !it.panel) return
    cur.items.push(it)
  })
  if (cur.items.length) out.push(cur)
  return out
}

function OverflowMenu({ items, caption }: { items: RibbonItem[]; caption: string }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)
  useCloseOnScroll(open, () => setOpen(false))

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false)
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
        ref={btnRef}
        type="button"
        className={'jan-ribbon-btn is-more' + (open ? ' is-open' : '')}
        onClick={() => { setSpot(popoverSpot(btnRef.current)); setOpen((v) => !v) }}
        title={`${caption} 더보기`}
        aria-label={`${caption} 더보기`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="chevron-down" size={16} />
        <span>더보기</span>
      </button>
      {open && spot && createPortal(
        <div className="jan-ribbon-dropdown" role="menu" ref={popRef} style={{ position: 'fixed', left: spot.left, top: spot.top }}>
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className="jan-menu-item"
              onClick={() => { it.onClick?.(); setOpen(false) }}
            >
              {it.icon && <Icon name={it.icon} size={14} />}
              <span className="jan-menu-label">{it.label}</span>
              {it.hint && <span className="jan-menu-hint">{it.hint}</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

/** 눌러서 펼치는 단추 — 워드의 「테두리 ▾」·「삭제 ▾」 처럼 */
function DropButton({ item, caption }: { item: RibbonItem; caption: string }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)
  useCloseOnScroll(open, () => setOpen(false))

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  /* 위아래 화살표로 항목을 옮겨 다닌다 — 마우스 없이도 쓸 수 있어야 한다 */
  const onKey = (e: React.KeyboardEvent) => {
    const buttons = [...(popRef.current?.querySelectorAll('button') ?? [])] as HTMLButtonElement[]
    if (!buttons.length) return
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length].focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length].focus() }
  }

  return (
    <div className="jan-ribbon-more" ref={wrapRef} onKeyDown={onKey}>
      <button
        ref={btnRef}
        type="button"
        className={'jan-ribbon-btn jan-ribbon-split' + (open ? ' is-open' : '')}
        onClick={() => { if (item.onClick) item.onClick(); setSpot(popoverSpot(btnRef.current)); setOpen((v) => !v) }}
        title={item.hint ? `${item.label} (${item.hint})` : item.label}
        aria-label={item.label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-help={`ribbon:${item.label}`}
        data-help-hint={item.hint || undefined}
        data-help-group={caption || undefined}
      >
        <Icon name={item.icon || 'file-text'} size={18} />
        <span>{shortLabel(item)} <Icon name="chevron-down" size={9} /></span>
      </button>
      {open && spot && createPortal(
        <div
          className={'jan-ribbon-dropdown' + (item.panel ? ' is-panel' : '')}
          role="menu"
          ref={popRef}
          style={{ position: 'fixed', left: spot.left, top: spot.top }}
        >
          {item.panel ? <div onClick={() => setOpen(false)}>{item.panel()}</div> : (item.menu || []).map((sub, i) => (
            sub.divider
              ? <div key={'d' + i} className="jan-menu-sep">{sub.divider}</div>
              : (
                <button
                  key={sub.label + i}
                  type="button"
                  role="menuitem"
                  className="jan-menu-item"
                  onClick={() => { sub.onClick?.(); setOpen(false) }}
                >
                  {sub.icon && <Icon name={sub.icon} size={14} />}
                  <span className="jan-menu-label">{sub.label}</span>
                  {sub.hint && <span className="jan-menu-hint">{sub.hint}</span>}
                </button>
              )
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

/** 격자 — 아홉 칸 맞춤처럼 작은 단추를 줄맞춰 놓는다 */
function GridBlock({ item }: { item: RibbonItem }) {
  const grid = item.grid!
  return (
    <div className="jan-ribbon-grid" role="group" aria-label={item.label} style={{ gridTemplateColumns: `repeat(${grid.cols}, 22px)` }}>
      {grid.items.map((sub, i) => (
        <button
          key={sub.label + i}
          type="button"
          className="jan-ribbon-gridbtn"
          onClick={sub.onClick}
          title={sub.label}
          aria-label={sub.label}
        >
          <Icon name={sub.icon || 'dot'} size={13} />
        </button>
      ))}
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
  tail,
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
  /** 탭 줄에서 리본 탭 바로 뒤 — 자주 쓰는 도구 아이콘 (멀리 떨어뜨리면 있는 줄도 모른다) */
  trailing?: React.ReactNode
  /** 바 오른쪽 끝 — 문서 탭 (브라우저 탭처럼) */
  tail?: React.ReactNode
}) {
  const active = tabs.find((t) => t.label === activeTab) || tabs[0]
  const sections = splitSections(active?.items || [])

  return (
    <div className={'jan-ribbon' + (collapsed ? ' is-collapsed' : '')}>
      <div className="jan-ribbon-bar">
        {leading}
        <div className="jan-ribbon-tabs" role="tablist" aria-label="리본 메뉴">
        {tabs.map((t, i) => (
          <Fragment key={t.label}>
          {/* 코어(문서 작업) 탭과 부가 탭 사이에 선을 하나 둔다 — 성격이 다르다는 신호 */}
          {t.extra && !tabs[i - 1]?.extra && <span className="jan-ribbon-tab-split" aria-hidden="true" />}
          <button
            type="button"
            role="tab"
            aria-selected={t.label === active?.label}
            className={
              'jan-ribbon-tab' +
              (t.label === active?.label ? ' is-active' : '') +
              (t.context ? ' is-context' : '') +
              (t.extra ? ' is-extra' : '')
            }
            onClick={() => {
              onTabChange(t.label)
              if (collapsed) onToggleCollapsed() // 접혀 있으면 펴면서 그 탭을 보여준다
            }}
            onDoubleClick={() => onToggleCollapsed()} // 한글·워드처럼 탭 두 번 누르면 접기
          >
            {t.icon && <Icon name={t.icon} size={13} />}
            {t.label}
          </button>
          </Fragment>
        ))}
        </div>
        {trailing}
        <span className="jan-ribbon-tabs-spacer" />
        {tail}
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
            /* 작은 단추·격자·분할 단추는 자리를 적게 먹으므로 큰 단추와 따로 센다 */
            const bigs = sec.items.filter((it) => !it.small)
            const smalls = sec.items.filter((it) => it.small)
            const primary = [...bigs.slice(0, MAX_PRIMARY), ...smalls.slice(0, MAX_SMALL)]
            const rest = [...bigs.slice(MAX_PRIMARY), ...smalls.slice(MAX_SMALL)]
            return (
              <div className="jan-ribbon-group" key={si}>
                <div className="jan-ribbon-items">
                  {primary.map((it, i) => (
                    it.grid ? <GridBlock key={i} item={it} />
                      : (it.menu || it.panel) ? <DropButton key={i} item={it} caption={sec.caption} />
                        : it.small ? null : (
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
                        )
                  ))}
                  {/* 작은 단추는 세 개씩 층층이 — 워드가 자리를 아끼는 방식 */}
                  {smallColumns(primary.filter((it) => it.small && !it.menu && !it.grid)).map((col, ci) => (
                    <div className="jan-ribbon-smallcol" key={'sc' + ci}>
                      {col.map((it, i) => (
                        <button
                          key={i}
                          type="button"
                          className="jan-ribbon-small"
                          onClick={it.onClick}
                          title={it.hint ? `${it.label} (${it.hint})` : it.label}
                          aria-label={it.label}
                          data-help={`ribbon:${it.label}`}
                          data-help-hint={it.hint || undefined}
                          data-help-group={sec.caption || undefined}
                        >
                          <Icon name={it.icon || 'dot'} size={13} />
                          <span>{shortLabel(it)}</span>
                        </button>
                      ))}
                    </div>
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
                {sec.caption && <div className="jan-ribbon-cap">{sec.caption}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

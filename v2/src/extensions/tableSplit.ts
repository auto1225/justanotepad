import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

/**
 * 쪽 경계에서 표를 행 단위로 나눈다 — 워드·한글과 같은 흐름.
 *
 * 예전에는 표가 통째로 다음 쪽으로 밀리거나, 밀 수 없으면 종이가 늘어났다.
 * 이제는 들어가는 행까지만 남기고 나머지를 다음 쪽으로 흘려보낸다.
 * 뒤쪽 조각에는 "이어짐" 표시를 달아, 저장할 때 다시 한 표로 합친다.
 * 제목 행 반복이 켜져 있으면 뒤 조각 맨 위에 제목 행을 복제해 넣는다
 * (그 행에는 '복제' 표시를 달아 두어 합칠 때 지운다).
 */

/**
 * 「쪼개지 말라」 (CSS break-inside: avoid) 를 문서 속성으로 받아 둔다.
 *
 * 붙여 넣은 마크업의 style="break-inside:avoid" 는 그대로는 살아남지 못한다 — 문서 구조에
 * style 자리가 없어 파싱에서 통째로 벗겨진다(실측: style 달린 행 0개). 벗겨진 뒤에 조판이
 * 「이 덩이는 쪼개지 마라」 를 알 길이 없다. 그래서 파싱하는 그 순간에 data-keep 으로 옮긴다 —
 * 목차 쪽 번호를 class 에서 data-* 로 옮겨 살린 것과 같은 수다.
 *
 * data-row-cont 는 쪽을 넘느라 「행 하나」 가 둘로 나뉘었다는 표시 (저장할 때 도로 합친다).
 */
const AVOID = /(^|;)\s*(page-)?break-inside\s*:\s*avoid/i

const keepAttr = {
  default: null as string | null,
  parseHTML: (el: HTMLElement) =>
    el.getAttribute('data-keep') || (AVOID.test(el.getAttribute('style') || '') ? '1' : null),
  renderHTML: (attrs: Record<string, unknown>) =>
    (attrs['data-keep'] ? { 'data-keep': String(attrs['data-keep']), style: 'break-inside: avoid' } : {}),
}

const rowContAttr = {
  default: null as string | null,
  parseHTML: (el: HTMLElement) => el.getAttribute('data-row-cont'),
  renderHTML: (attrs: Record<string, unknown>) =>
    (attrs['data-row-cont'] ? { 'data-row-cont': String(attrs['data-row-cont']) } : {}),
}

export const TableKeepAttrs = Extension.create({
  name: 'janTableKeep',
  addGlobalAttributes() {
    return [
      { types: ['table'], attributes: { 'data-keep': keepAttr } },
      { types: ['tableRow'], attributes: { 'data-keep': keepAttr, 'data-row-cont': rowContAttr } },
    ]
  },
})

/** 이 덩이는 통째로 넘겨야 한다 (break-inside: avoid) */
export function keepsWhole(node: PMNode | null | undefined): boolean {
  return !!node?.attrs?.['data-keep']
}

/** 표를 rowIndex 앞에서 둘로 나눈 노드 쌍 (나눌 수 없으면 null) */
export function splitTableAt(table: PMNode, rowIndex: number): { head: PMNode; tail: PMNode } | null {
  if (table.type.name !== 'table') return null
  const rows: PMNode[] = []
  table.forEach((row) => rows.push(row))
  if (rowIndex < 1 || rowIndex >= rows.length) return null

  const headRows = rows.slice(0, rowIndex)
  let tailRows = rows.slice(rowIndex)

  // 제목 행 반복 — 뒤 조각 맨 위에 첫 행을 복제해 얹는다
  if (table.attrs['data-repeat-header'] && rows[0]) {
    const cloned = rows[0].type.create({ ...rows[0].attrs, 'data-repeated': '1' }, rows[0].content)
    tailRows = [cloned, ...tailRows]
  }

  return {
    head: table.type.create(table.attrs, headRows),
    tail: table.type.create({ ...table.attrs, 'data-cont': '1' }, tailRows),
  }
}

/**
 * 이 표 자신의 행 — 칸 안에 든 표(중첩)의 행은 남의 것이다.
 *
 * querySelectorAll('tr') 은 칸 속 표의 행까지 함께 걷어 온다. 그 수로 나눌 자리를 세면
 * 바깥 행이 실제보다 많은 줄 알고 지면 밖까지 남겨 두고, 합칠 때 쓰면 안쪽 표의 행을
 * 바깥 표 끝에 옮겨 붙여 안쪽 표를 빈 껍데기로 만든다.
 */
export function ownRows(table: Element): HTMLElement[] {
  return [...table.querySelectorAll('tr')].filter((r) => r.closest('table') === table) as HTMLElement[]
}

/**
 * 남은 자리(roomPx)에 몇 행까지 들어가는지 센다.
 * 화면에 그려진 행 높이를 그대로 읽는다 — 계산으로 짐작하면 한두 줄씩 어긋난다.
 */
export function rowsThatFit(view: EditorView, tablePos: number, roomPx: number, scale: number): number {
  const dom = view.nodeDOM(tablePos)
  const el = dom instanceof HTMLElement ? (dom.querySelector('table') || dom) : null
  if (!el) return 0
  const rows = ownRows(el)
  if (rows.length < 2) return 0
  const top = el.getBoundingClientRect().top
  /* 남은 자리는 블록의 여백 바깥에서부터 잰 값이다. 표의 위·아래 여백도 그 자리를 먹으므로
     빼고 나서야 「행이 몇 개 들어가는가」 가 맞는다 — 안 빼면 한 행이 더 들어가는 줄 알고
     그만큼 지면 밖으로 삐져나온다 (그 쪽만 용지가 늘어난다). */
  const cs = window.getComputedStyle(el)
  const room = roomPx - (parseFloat(cs.marginTop) || 0) - (parseFloat(cs.marginBottom) || 0)
  let fit = 0
  for (const row of rows) {
    const bottom = (row.getBoundingClientRect().bottom - top) / (scale || 1)
    if (bottom > room) break
    fit++
  }
  return fit
}

/**
 * 표를 나눠 뒤 조각을 다음 쪽으로 넘긴다.
 * 성공하면 트랜잭션에 반영하고 true.
 */
export function splitTableAcrossPages(
  tr: Transaction,
  tablePos: number,
  table: PMNode,
  rowIndex: number
): boolean {
  const parts = splitTableAt(table, rowIndex)
  if (!parts) return false
  tr.replaceWith(tablePos, tablePos + table.nodeSize, [parts.head, parts.tail])
  return true
}

/* ── 칸 속 표까지 파고들어 나누기 ─────────────────────── */

/**
 * 안쪽 표를 나눌 자리 — 바깥 몇 번째 행의, 몇 번째 칸에 든, 몇 번째 아이인 표를, 몇 행에서.
 */
export interface DeepSplitPlan {
  rowIndex: number
  cellIndex: number
  /** 그 칸의 몇 번째 아이가 표인가 (칸 안에는 글도 함께 있을 수 있다) */
  childIndex: number
  innerRowIndex: number
}

/** 이 칸이 직접 품은 표 (더 깊은 표는 그 표의 몫이다) */
function ownTable(cell: Element): HTMLElement | null {
  return ([...cell.querySelectorAll('table')].find((t) => t.closest('td, th') === cell) as HTMLElement) || null
}

/**
 * 바깥 행 하나가 한 쪽보다 길 때, 그 행의 칸에 든 표를 나눌 자리를 찾는다.
 *
 * 바깥 표만 행 단위로 나뉘던 시절, 45행짜리 표를 칸에 넣으면 그 행은 쪼갤 수 없어
 * 그 쪽 용지가 751px 늘어났다(실측·A4). 워드·한글은 안쪽 표도 넘긴다.
 * 쪼개지 말라는 표시(data-keep)가 걸린 행·표는 건드리지 않는다.
 */
export function innerSplitPlan(
  view: EditorView,
  tablePos: number,
  table: PMNode,
  roomPx: number,
  scale: number
): DeepSplitPlan | null {
  const dom = view.nodeDOM(tablePos)
  const el = dom instanceof HTMLElement ? (dom.querySelector('table') || dom) : null
  if (!el) return null
  const rows = ownRows(el)
  if (!rows.length) return null
  const top = el.getBoundingClientRect().top
  const cs = window.getComputedStyle(el)
  const room = roomPx - (parseFloat(cs.marginTop) || 0) - (parseFloat(cs.marginBottom) || 0)
  const 아래 = (e: Element) => (e.getBoundingClientRect().bottom - top) / (scale || 1)

  // 들어가지 못하는 첫 행 — 그 행 안에서 나눠야 한다
  let r = 0
  while (r < rows.length && 아래(rows[r]) <= room) r += 1
  if (r >= rows.length) return null
  const rowNode = table.maybeChild(r)
  if (!rowNode || keepsWhole(rowNode)) return null

  const cells = [...rows[r].children]
  for (let c = 0; c < cells.length; c += 1) {
    const innerEl = ownTable(cells[c])
    if (!innerEl) continue
    const cellNode = rowNode.maybeChild(c)
    if (!cellNode) continue
    let childIndex = -1
    cellNode.forEach((child, _o, i) => { if (childIndex < 0 && child.type.name === 'table') childIndex = i })
    if (childIndex < 0) continue
    if (keepsWhole(cellNode.child(childIndex))) continue

    const innerRows = ownRows(innerEl)
    if (innerRows.length < 2) continue
    let fit = 0
    for (const ir of innerRows) {
      if (아래(ir) > room) break
      fit += 1
    }
    /* 한 행도 못 들어가면 여기서 나눠 봐야 앞 조각이 빈 껍데기가 된다 —
       표를 통째로 다음 쪽으로 밀고 (거기서는 자리가 넉넉하다) 다시 본다 */
    if (fit < 1 || fit >= innerRows.length) continue
    return { rowIndex: r, cellIndex: c, childIndex, innerRowIndex: fit }
  }
  return null
}

/** 빈 칸 하나 — 뒤 조각에서 다른 칸들이 앉을 자리 (합칠 때 이 빈 문단은 버린다) */
function emptyCell(cell: PMNode): PMNode | null {
  return cell.type.createAndFill(cell.attrs)
}

/**
 * 안쪽 표를 나누어 바깥 행 하나를 두 행으로 가른다.
 * 앞 조각에는 안쪽 표의 앞부분이, 뒤 조각에는 나머지가 들어간다.
 */
export function splitTableDeep(table: PMNode, plan: DeepSplitPlan): { head: PMNode; tail: PMNode } | null {
  if (table.type.name !== 'table') return null
  const rows: PMNode[] = []
  table.forEach((row) => rows.push(row))
  const row = rows[plan.rowIndex]
  if (!row) return null

  const headCells: PMNode[] = []
  const tailCells: PMNode[] = []
  let 갈랐다 = false
  let 막혔다 = false
  row.forEach((cell, _o, ci) => {
    if (ci === plan.cellIndex) {
      const blocks: PMNode[] = []
      cell.forEach((b) => blocks.push(b))
      const inner = blocks[plan.childIndex]
      const parts = inner && inner.type.name === 'table' ? splitTableAt(inner, plan.innerRowIndex) : null
      if (parts) {
        갈랐다 = true
        headCells.push(cell.type.create(cell.attrs, [...blocks.slice(0, plan.childIndex), parts.head]))
        tailCells.push(cell.type.create(cell.attrs, [parts.tail, ...blocks.slice(plan.childIndex + 1)]))
        return
      }
    }
    const 빈칸 = emptyCell(cell)
    if (!빈칸) { 막혔다 = true; return }
    headCells.push(cell)
    tailCells.push(빈칸)
  })
  if (!갈랐다 || 막혔다) return null

  const headRow = row.type.create(row.attrs, headCells)
  const tailRow = row.type.create({ ...row.attrs, 'data-row-cont': '1' }, tailCells)
  return {
    head: table.type.create(table.attrs, [...rows.slice(0, plan.rowIndex), headRow]),
    tail: table.type.create({ ...table.attrs, 'data-cont': '1' }, [tailRow, ...rows.slice(plan.rowIndex + 1)]),
  }
}

/** 안쪽 표를 나눠 뒤 조각을 다음 쪽으로 넘긴다 */
export function splitTableDeepAcrossPages(
  tr: Transaction,
  tablePos: number,
  table: PMNode,
  plan: DeepSplitPlan
): boolean {
  const parts = splitTableDeep(table, plan)
  if (!parts) return false
  tr.replaceWith(tablePos, tablePos + table.nodeSize, [parts.head, parts.tail])
  return true
}

/**
 * 저장·내보내기용 — 이어진 표 조각을 앞 표에 도로 붙인다.
 * (문단의 data-jan-cont 를 합치는 것과 같은 역변환)
 */
export function mergeContinuedTables(html: string): string {
  if (!html || (!html.includes('data-cont') && !html.includes('data-row-cont'))) return html
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
  const root = doc.getElementById('r')
  if (!root) return html
  /* 이 표 자신의 몸통 — 첫 tbody 를 그냥 집으면 첫 칸에 든 안쪽 표의 몸통을 집는다 */
  const ownBody = (table: Element) =>
    [...table.querySelectorAll('tbody')].find((b) => b.parentElement === table) || table

  /** 이어짐 표시가 붙은 표를 앞 표에 도로 붙인다. onlyTop 이면 바깥(최상위) 표만 본다 */
  const 표합치기 = (onlyTop: boolean) => {
    const nextTarget = () =>
      [...root.querySelectorAll('table[data-cont]')]
        .find((t) => !onlyTop || !t.parentElement?.closest('table')) || null
    let guard = 0
    let target = nextTarget()
    while (target && guard++ < 500) {
      // 앞에 있는 표를 찾는다 (사이에 쪽 래퍼가 벗겨져 문단이 끼어 있을 수 있다)
      let prev: Element | null = target.previousElementSibling
      while (prev && prev.tagName !== 'TABLE') prev = prev.previousElementSibling
      if (prev) {
        const body = ownBody(prev)
        // 제 행만 옮긴다 — 칸 속 표의 행까지 걷어 오면 안쪽 표가 빈 껍데기가 된다
        ownRows(target).forEach((row) => {
          if (row.hasAttribute('data-repeated')) row.remove()
          else body.appendChild(row)
        })
        target.remove()
      } else {
        target.removeAttribute('data-cont')
      }
      target = nextTarget()
    }
  }

  /** 뒤 조각의 빈 칸에 남는 빈 문단 — 합칠 때 도로 끌고 오면 없던 빈 줄이 생긴다 */
  const 빈줄 = (el: Element) =>
    el.nodeType === 1 && el.tagName === 'P' && !el.querySelector('*') && !(el.textContent || '').trim()

  /**
   * 쪽을 넘느라 둘로 나뉜 「행」 을 앞 행에 도로 합친다 (칸마다 짝을 맞춰 옮긴다).
   * 이것을 하고 나야 칸 속에서 나뉜 안쪽 표가 서로 이웃이 되어 합칠 수 있다.
   */
  const 행합치기 = () => {
    let guard = 0
    let row = root.querySelector('tr[data-row-cont]')
    while (row && guard++ < 500) {
      let prev: Element | null = row.previousElementSibling
      while (prev && prev.tagName !== 'TR') prev = prev.previousElementSibling
      if (prev) {
        const into = [...prev.children]
        ;[...row.children].forEach((cell, i) => {
          const target = into[i]
          if (!target) return
          ;[...cell.childNodes].forEach((child) => {
            if (빈줄(child as Element)) return
            target.appendChild(child)
          })
        })
        row.remove()
      } else {
        row.removeAttribute('data-row-cont')
      }
      row = root.querySelector('tr[data-row-cont]')
    }
  }

  표합치기(true)   // 바깥 표 조각부터 (나뉜 행이 한 몸통에 모인다)
  행합치기()       // 나뉜 행을 도로 한 행으로
  표합치기(false)  // 그제야 이웃이 된 안쪽 표 조각을 합친다
  return root.innerHTML
}

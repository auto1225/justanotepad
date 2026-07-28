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
 * 남은 자리(roomPx)에 몇 행까지 들어가는지 센다.
 * 화면에 그려진 행 높이를 그대로 읽는다 — 계산으로 짐작하면 한두 줄씩 어긋난다.
 */
export function rowsThatFit(view: EditorView, tablePos: number, roomPx: number, scale: number): number {
  const dom = view.nodeDOM(tablePos)
  const el = dom instanceof HTMLElement ? (dom.querySelector('table') || dom) : null
  if (!el) return 0
  const rows = [...el.querySelectorAll('tr')]
  if (rows.length < 2) return 0
  const top = el.getBoundingClientRect().top
  let fit = 0
  for (const row of rows) {
    const bottom = (row.getBoundingClientRect().bottom - top) / (scale || 1)
    if (bottom > roomPx) break
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

/**
 * 저장·내보내기용 — 이어진 표 조각을 앞 표에 도로 붙인다.
 * (문단의 data-jan-cont 를 합치는 것과 같은 역변환)
 */
export function mergeContinuedTables(html: string): string {
  if (!html || !html.includes('data-cont')) return html
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
  const root = doc.getElementById('r')
  if (!root) return html
  let guard = 0
  let target = root.querySelector('table[data-cont]')
  while (target && guard++ < 500) {
    // 앞에 있는 표를 찾는다 (사이에 쪽 래퍼가 벗겨져 문단이 끼어 있을 수 있다)
    let prev: Element | null = target.previousElementSibling
    while (prev && prev.tagName !== 'TABLE') prev = prev.previousElementSibling
    if (prev) {
      const body = prev.querySelector('tbody') || prev
      target.querySelectorAll('tr[data-repeated]').forEach((row) => row.remove())
      const rows = target.querySelectorAll('tr')
      rows.forEach((row) => body.appendChild(row))
      target.remove()
    } else {
      target.removeAttribute('data-cont')
    }
    target = root.querySelector('table[data-cont]')
  }
  return root.innerHTML
}

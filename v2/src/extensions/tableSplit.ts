import { Extension } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { Node as PMNode } from '@tiptap/pm/model'
import { ReplaceStep } from '@tiptap/pm/transform'
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

/**
 * 이 덩이는 통째로 넘겨야 한다.
 *
 * 두 가지다.
 *  · break-inside: avoid (data-keep) — 사람이 「쪼개지 말라」 고 적어 둔 것.
 *  · 「글자처럼 취급」 인 표 (data-wrap="inline") — 한글의 거동을 그대로 따른다.
 *    글자처럼 둔 표는 한 글자와 같아서 쪽보다 크더라도 나누지 않고 통째로 다음 쪽으로 간다.
 *    (감싸기·문단 사이인 표는 여백 자리만 건너뛰고 다음 쪽에 이어져 보인다 — 그래서 나눈다)
 *
 * 배치를 보지 않고 무엇이든 행 단위로 나누던 시절, 글자처럼 둔 표도 쪼개져
 * 문장 한가운데에서 표가 두 동강 났다.
 */
export function keepsWhole(node: PMNode | null | undefined): boolean {
  if (!node) return false
  if (node.attrs?.['data-keep']) return true
  return node.type?.name === 'table' && node.attrs?.['data-wrap'] === 'inline'
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

  /* 앞 조각에도 「뒤에 이어진다」 를 적어 둔다.
     조각들은 서로 다른 쪽(page node)에 들어앉아 CSS 로 이웃을 볼 수 없다 —
     앞 조각이 스스로 알지 못하면 아래 여백·아래 둥근 모서리·그림자를 그대로 그려
     쪽마다 표가 따로 끝난 것처럼 보인다. */
  return {
    head: table.type.create({ ...table.attrs, 'data-cont-next': '1' }, headRows),
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
 * 이 행이 자리를 차지하는가 — 숨은 행(display:none)은 상자가 **아예 없다.**
 *
 * 상자가 없으면 getBoundingClientRect() 가 0,0,0,0 을 준다. 아래에서 재는 값은
 * 「행 바닥 − 표 꼭대기」 인데, 화면을 내려 표 꼭대기가 음수가 되면 그 0 이
 * 「표 꼭대기에서 2,623px 아래」 라는 뜻으로 읽힌다 — 숨은 행 하나가 지면을 넘긴 것처럼
 * 보여 거기서 세기를 멈춘다.
 *
 * 실측(40행 표·5~14행 숨김·A4·본문 1280×720):
 *   화면 맨 위(표 top = +246)        앞 조각 36행 — 지면을 꽉 채운다
 *   2,923px 내려봄(표 top = −2,623)  앞 조각 **4행**(140px), 쪽 3 → **4**
 * 숨김이 없으면 두 경우 모두 15행으로 같았다. 즉 **화면을 어디까지 내렸느냐가 조판을
 * 바꾸고 있었다.** 상자가 없는 행은 재지 말고 건너뛴다 — 어느 조각에 넣어도 자리를
 * 먹지 않으니 「들어간다」 가 맞는 답이다.
 */
function hasBox(el: Element): boolean {
  return el.getClientRects().length > 0
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
  let 보이는행 = 0
  for (const row of rows) {
    if (!hasBox(row)) { fit++; continue }   // 자리를 안 먹는 행 — 어디에 두어도 같다
    const bottom = (row.getBoundingClientRect().bottom - top) / (scale || 1)
    if (bottom > room) break
    fit++
    보이는행++
  }
  /* 앞 조각이 죄다 숨은 행뿐이면 나눠 봐야 빈 껍데기 표만 한 쪽에 남는다 —
     그럴 바에는 표째 다음 쪽으로 민다 (워드·한글도 보이는 것이 없으면 넘긴다). */
  return 보이는행 > 0 ? fit : 0
}

/**
 * 이 행 경계를 세로 합침(rowspan)이 가로지르는가.
 *
 * 가로지르는 자리에서 나누면 앞 조각의 합친 칸은 조각 길이에 맞게 **깎이고**(4 → 2),
 * 뒤 조각 첫 행들에는 그 열의 칸이 **모자란다**. 비워 둔 채로 두면 prosemirror-tables 의
 * fixTables 가 네모꼴을 맞추려 빈 칸을 행 **끝에** 덧붙인다 — 열 자리도 틀리고, 그 칸이
 * 저장본에 그대로 남아 표가 부푼다. 실측(60행·4행마다 세로 합침):
 * 문서 77칸 → 저장본 80칸, 빈 칸 5개, rowspan 이 4·2·1 로 뒤섞였다.
 */
export function rowspanCrosses(table: PMNode, rowIndex: number): boolean {
  if (rowIndex <= 0) return false
  let r = 0
  let 가로지름 = false
  table.forEach((row) => {
    if (r < rowIndex && !가로지름) {
      row.forEach((cell) => {
        if (r + (Number(cell.attrs.rowspan) || 1) > rowIndex) 가로지름 = true
      })
    }
    r += 1
  })
  return 가로지름
}

/**
 * 세로 합침을 가로지르지 않는, rowIndex 이하의 가장 가까운 행 경계 (없으면 0).
 *
 * 워드는 합친 칸도 뚫고 나누지만, 우리는 나눈 표를 저장할 때 도로 한 표로 합친다 —
 * 뚫고 나누면 그 왕복에서 표가 상한다. 그래서 깨끗한 자리까지만 물러난다.
 * 합침이 길어 물러날 곳이 없으면 0 을 돌려주고, 그때는 표를 통째로 다음 쪽으로 민다.
 */
export function safeSplitRow(table: PMNode, rowIndex: number, min = 2): number {
  for (let r = rowIndex; r >= min; r -= 1) if (!rowspanCrosses(table, r)) return r
  return 0
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

  // 들어가지 못하는 첫 행 — 그 행 안에서 나눠야 한다 (숨은 행은 자리를 안 먹으니 건너뛴다)
  let r = 0
  while (r < rows.length && (!hasBox(rows[r]) || 아래(rows[r]) <= room)) r += 1
  if (r >= rows.length) return null
  const rowNode = table.maybeChild(r)
  if (!rowNode || keepsWhole(rowNode)) return null
  /* 이 행을 세로 합침이 가로지르면 깊이 나눔도 표를 상하게 한다 (바깥 표가 갈리므로) —
     그때는 나누지 말고 표째 다음 쪽으로 민다 */
  if (rowspanCrosses(table, r)) return null

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
    let 보이는행 = 0
    for (const ir of innerRows) {
      if (!hasBox(ir)) { fit += 1; continue }
      if (아래(ir) > room) break
      fit += 1
      보이는행 += 1
    }
    if (!보이는행) continue
    /* 한 행도 못 들어가면 여기서 나눠 봐야 앞 조각이 빈 껍데기가 된다 —
       표를 통째로 다음 쪽으로 밀고 (거기서는 자리가 넉넉하다) 다시 본다 */
    if (fit < 1 || fit >= innerRows.length) continue
    // 안쪽 표에서도 세로 합침은 뚫지 않는다
    const 안쪽자리 = safeSplitRow(cellNode.child(childIndex), fit, 1)
    if (안쪽자리 < 1) continue
    return { rowIndex: r, cellIndex: c, childIndex, innerRowIndex: 안쪽자리 }
  }
  return null
}

/**
 * 자리를 맞추려고 끼워 넣은 빈 칸.
 *
 * 깊이 나눔은 바깥 행 하나를 두 행으로 가른다 — 그러면 앞 행에는 나눈 칸까지만,
 * 뒤 행에는 나눈 칸부터만 남아 표가 네모꼴이 아니게 된다. 네모꼴이 아니면
 * prosemirror-tables 가 제 나름대로 칸을 채워 넣어 저장본에 없던 칸이 늘어난다.
 * 그래서 우리가 먼저, **표를 달고** 채운다 — 합칠 때 그 표를 보고 도로 걷어 낸다.
 */
function padCell(proto: PMNode): PMNode | null {
  return proto.type.createAndFill({
    ...proto.attrs,
    rowspan: 1,
    'data-jan-pad': '1',
  })
}

/**
 * 칸 속 표를 나누어 바깥 행 하나를 두 행으로 가른다 — **쪼개기**로 (매핑을 지킨다).
 *
 * 예전에는 바깥 표를 통째로 지우고 새 표 둘을 넣었다(replaceWith). 결과 문서는 같지만
 * **표 안의 모든 자리가 매핑에서 사라진다.** 그래서 칸 속 표의 칸에 글을 치고 그 표가 쪽을
 * 넘어가면 그 타자를 되돌릴 자리를 잃었다 — 실측: 안쪽 칸에 50자를 치고 Ctrl+Z 를 세 번
 * 눌러도 468자 → 438자에서 멎고 「속칸에친글」 이 그대로 남았다.
 *
 * 이제는 안쪽 표의 행과 행 사이를 **쪼개기만** 한다. 그 자리 위로 안쪽표·칸·행·바깥표를
 * 모두 닫았다 열어야 하므로 깊이가 넷이다(openStart = openEnd = 4). 끼어드는 것은 구조
 * 표시 여덟 글자뿐이라 칸 속 자리가 모두 살아남는다.
 *
 * tr.split 을 그대로 쓸 수는 없다 — 표에 isolating 이 걸려 있어 canSplit 이 언제나
 * 「안 된다」 고 답한다(사람이 선택을 표 밖으로 끌고 나가지 못하게 하는 빗장이다).
 * 그래서 걸음을 손으로 짜 넣어 보고, 스키마가 마다하면 그때 물러난다.
 */
export function splitTableDeepAcrossPages(
  tr: Transaction,
  tablePos: number,
  table: PMNode,
  plan: DeepSplitPlan
): boolean {
  if (table.type.name !== 'table') return false
  const row = table.maybeChild(plan.rowIndex)
  if (!row) return false
  const cell = row.maybeChild(plan.cellIndex)
  if (!cell) return false
  const inner = cell.maybeChild(plan.childIndex)
  if (!inner || inner.type.name !== 'table') return false
  if (plan.innerRowIndex < 1 || plan.innerRowIndex >= inner.childCount) return false

  /* 쪼갤 자리 — 바깥표 > 행 > 칸 > 안쪽표 를 차례로 파고들어 안쪽 행과 행 사이로 */
  let at = tablePos + 1
  for (let r = 0; r < plan.rowIndex; r++) at += table.child(r).nodeSize
  at += 1
  for (let c = 0; c < plan.cellIndex; c++) at += row.child(c).nodeSize
  at += 1
  for (let b = 0; b < plan.childIndex; b++) at += cell.child(b).nodeSize
  at += 1
  for (let ir = 0; ir < plan.innerRowIndex; ir++) at += inner.child(ir).nodeSize

  /* tr.split(at, 4, [뒤 조각들]) 이 만드는 것과 똑같은 걸음:
     「안쪽표·칸·행·바깥표를 닫고 — 다시 연다」 */
  const 앞 = Fragment.from(
    table.type.create({ ...table.attrs, 'data-cont-next': '1' }, Fragment.from(
      row.type.create(row.attrs, Fragment.from(
        cell.type.create(cell.attrs, Fragment.from(
          inner.type.create({ ...inner.attrs, 'data-cont-next': '1' })))))))
  )
  const 뒤 = Fragment.from(
    table.type.create({ ...table.attrs, 'data-cont': '1' }, Fragment.from(
      row.type.create({ ...row.attrs, 'data-row-cont': '1' }, Fragment.from(
        cell.type.create(cell.attrs, Fragment.from(
          inner.type.create({ ...inner.attrs, 'data-cont': '1' })))))))
  )
  if (tr.maybeStep(new ReplaceStep(at, at, new Slice(앞.append(뒤), 4, 4), true)).failed) return false

  /* 네모꼴 되찾기 — 쪼개기는 앞 행에 칸 0..k 만, 뒤 행에 칸 k..n 만 남긴다.
     끼워 넣기는 매핑을 깨지 않으므로 쪼갠 **뒤에** 채운다. 뒤(높은 자리)부터 넣어야
     앞의 자리가 흔들리지 않는다. fixTables 는 트랜잭션이 끝난 문서만 보므로
     그 사이에 잠깐 네모꼴이 아니어도 된다. */
  const head = tr.doc.nodeAt(tablePos)
  if (!head || head.type.name !== 'table') return true // 자리를 못 찾으면 그대로 둔다
  const 뒤표자리 = tablePos + head.nodeSize
  const 뒤행앞 = 뒤표자리 + 2                    // 표를 열고 행을 연 자리
  const 앞행끝 = tablePos + head.nodeSize - 2    // 행을 닫기 직전

  const 뒤채움: PMNode[] = []
  for (let c = 0; c < plan.cellIndex; c++) {
    const p = padCell(row.child(c))
    if (p) 뒤채움.push(p)
  }
  const 앞채움: PMNode[] = []
  for (let c = plan.cellIndex + 1; c < row.childCount; c++) {
    const p = padCell(row.child(c))
    if (p) 앞채움.push(p)
  }
  if (뒤채움.length) tr.insert(뒤행앞, Fragment.fromArray(뒤채움))
  if (앞채움.length) tr.insert(앞행끝, Fragment.fromArray(앞채움))
  return true
}

/**
 * 저장·내보내기용 — 이어진 표 조각을 앞 표에 도로 붙인다.
 * (문단의 data-jan-cont 를 합치는 것과 같은 역변환)
 */
export function mergeContinuedTables(html: string): string {
  if (!html || (!html.includes('data-cont') && !html.includes('data-row-cont') && !html.includes('data-jan-pad'))) return html
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
          /* 뒤 조각의 채움 칸은 자리만 맡고 있던 것이다 — 아무것도 옮기지 않는다 */
          if (cell.hasAttribute('data-jan-pad')) return
          /* 앞 조각의 채움 칸이면 그 안의 빈 문단을 먼저 버린다.
             그러지 않으면 옮겨 온 글 앞에 없던 빈 줄이 생긴다 (앞 칸이 뒤로 갈린 자리다). */
          if (target.hasAttribute('data-jan-pad')) {
            target.replaceChildren()
            target.removeAttribute('data-jan-pad')
          }
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
  /* 「뒤에 이어진다」 는 화면 조판을 위한 표시다 — 도로 한 표가 된 뒤에는 남을 자리가 없다.
     남겨 두면 저장본을 다시 열 때 아래 여백·둥근 모서리가 사라진 표가 된다. */
  root.querySelectorAll('table[data-cont-next]').forEach((t) => t.removeAttribute('data-cont-next'))
  /* 짝을 못 찾고 남은 채움 칸 — 표시만 지워 보통 빈 칸으로 둔다 (지우면 네모꼴이 깨진다) */
  root.querySelectorAll('[data-jan-pad]').forEach((c) => c.removeAttribute('data-jan-pad'))
  return root.innerHTML
}

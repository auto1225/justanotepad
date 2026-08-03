import { describe, expect, it } from 'vitest'
import { Schema, type Node as PMNode } from '@tiptap/pm/model'
import { keepsWhole, mergeContinuedTables, ownRows, rowspanCrosses, safeSplitRow, splitTableAt } from './tableSplit'

describe('쪽을 넘어 나뉜 표 합치기', () => {
  it('이어짐 표시가 붙은 표를 앞 표에 도로 붙인다', () => {
    const html =
      '<table><tbody><tr><th>이름</th></tr><tr><td>1</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr><td>2</td></tr><tr><td>3</td></tr></tbody></table>'
    const merged = mergeContinuedTables(html)
    expect(merged.match(/<table/g)).toHaveLength(1)
    expect(merged.match(/<tr/g)).toHaveLength(4) // 제목 + 1,2,3
    expect(merged).not.toContain('data-cont')
  })

  it('반복해 넣은 제목 행은 합칠 때 지운다', () => {
    const html =
      '<table><tbody><tr><th>이름</th></tr><tr><td>1</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr data-repeated="1"><th>이름</th></tr><tr><td>2</td></tr></tbody></table>'
    const merged = mergeContinuedTables(html)
    expect(merged.match(/<tr/g)).toHaveLength(3) // 제목 + 1 + 2 (복제된 제목은 빠진다)
    expect(merged).not.toContain('data-repeated')
  })

  it('세 조각으로 나뉘어도 모두 합친다', () => {
    const html =
      '<table><tbody><tr><td>1</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr><td>2</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr><td>3</td></tr></tbody></table>'
    const merged = mergeContinuedTables(html)
    expect(merged.match(/<table/g)).toHaveLength(1)
    expect(merged.match(/<tr/g)).toHaveLength(3)
  })

  it('앞에 붙일 표가 없으면 표시만 지운다 (내용을 잃지 않는다)', () => {
    const html = '<p>글</p><table data-cont="1"><tbody><tr><td>1</td></tr></tbody></table>'
    const merged = mergeContinuedTables(html)
    expect(merged).toContain('<td>1</td>')
    expect(merged).not.toContain('data-cont')
  })

  it('이어짐 표시가 없으면 그대로 둔다', () => {
    const html = '<table><tbody><tr><td>1</td></tr></tbody></table>'
    expect(mergeContinuedTables(html)).toBe(html)
  })
})

/**
 * 표 안에 든 표(중첩)를 남의 행으로 세면 표가 무너진다.
 *
 * querySelectorAll('tr') 은 칸 안에 든 표의 행까지 함께 걷어 온다. 그래서
 *  - 나눌 자리를 셀 때는 바깥 행이 몇 개인지를 부풀려 세어 쪽 밖으로 넘치고,
 *  - 합칠 때는 안쪽 표의 행을 뽑아 바깥 표 끝에 붙여 버려 안쪽 표가 빈 껍데기가 된다.
 * 표는 제 행만 제 것이다.
 */
describe('중첩된 표', () => {
  const html2dom = (html: string) => {
    const d = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
    return d.getElementById('r')!
  }

  it('제 행만 센다 — 칸 안에 든 표의 행은 세지 않는다', () => {
    const root = html2dom(
      '<table><tbody>' +
      '<tr><td><table><tbody><tr><td>안1</td></tr><tr><td>안2</td></tr></tbody></table></td></tr>' +
      '<tr><td>바깥2</td></tr>' +
      '</tbody></table>'
    )
    const outer = root.querySelector('table') as HTMLElement
    expect(outer.querySelectorAll('tr')).toHaveLength(4) // 모두 세면 넷 (부풀려진 수)
    expect(ownRows(outer)).toHaveLength(2)               // 바깥 표의 행은 둘뿐이다
  })

  it('합칠 때 안쪽 표의 행을 바깥으로 끌어내지 않는다', () => {
    const html =
      '<table><tbody><tr><td>1</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody>' +
      '<tr><td><table><tbody><tr><td>안A</td></tr><tr><td>안B</td></tr></tbody></table></td></tr>' +
      '<tr><td>2</td></tr>' +
      '</tbody></table>'
    const root = html2dom(mergeContinuedTables(html))
    const outer = root.querySelector('table') as HTMLElement
    expect(root.querySelectorAll('table')).toHaveLength(2)      // 바깥 하나 + 안쪽 하나
    expect(ownRows(outer)).toHaveLength(3)                      // 1 · 중첩이 든 행 · 2
    const inner = root.querySelector('table table') as HTMLElement
    expect(inner).not.toBeNull()
    expect(ownRows(inner)).toHaveLength(2)                      // 안쪽 표는 제 행 둘을 그대로 가진다
    expect(inner.textContent).toContain('안A')
    expect(inner.textContent).toContain('안B')
  })

  it('앞 조각 첫 칸에 표가 들어 있어도 뒤 조각을 그 안쪽 표에 붙이지 않는다', () => {
    const html =
      '<table><tbody><tr><td><table><tbody><tr><td>안</td></tr></tbody></table></td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr><td>뒤</td></tr></tbody></table>'
    const root = html2dom(mergeContinuedTables(html))
    const outer = root.querySelector('table') as HTMLElement
    const inner = root.querySelector('table table') as HTMLElement
    expect(ownRows(outer)).toHaveLength(2)  // 중첩이 든 행 + 뒤
    expect(ownRows(inner)).toHaveLength(1)  // 안쪽 표는 건드리지 않는다
    expect(inner.textContent).toBe('안')
  })

  /**
   * 칸 속 표가 한 쪽보다 길면 그 표까지 파고들어 나눈다 — 그때 「행 하나」 가 둘로 갈라진다.
   * 저장할 때 도로 한 행으로 붙지 않으면 문서가 영영 쪼개진 채로 남는다.
   */
  it('쪽을 넘느라 둘로 나뉜 행을 도로 한 행으로 합친다', () => {
    const html =
      '<table><tbody>' +
      '<tr><td><p>바깥 1</p></td><td><p>값 1</p></td></tr>' +
      '<tr><td><table><tbody><tr><td><p>안 1</p></td></tr><tr><td><p>안 2</p></td></tr></tbody></table></td><td><p>값 2</p></td></tr>' +
      '</tbody></table>' +
      '<table data-cont="1"><tbody>' +
      '<tr data-row-cont="1"><td><table data-cont="1"><tbody><tr><td><p>안 3</p></td></tr></tbody></table></td><td><p></p></td></tr>' +
      '<tr><td><p>바깥 3</p></td><td><p>값 3</p></td></tr>' +
      '</tbody></table>'
    const root = html2dom(mergeContinuedTables(html))
    const outer = root.querySelector('table') as HTMLElement
    const inner = root.querySelector('table table') as HTMLElement
    expect(root.querySelectorAll('table')).toHaveLength(2)   // 바깥 하나 + 안쪽 하나
    expect(ownRows(outer)).toHaveLength(3)                   // 바깥1 · 중첩이 든 행 · 바깥3
    expect(ownRows(inner)).toHaveLength(3)                   // 안쪽 표는 세 행이 다시 한 몸
    expect(inner.textContent).toBe('안 1안 2안 3')
    expect(root.innerHTML).not.toContain('data-cont')
    expect(root.innerHTML).not.toContain('data-row-cont')
  })

  it('나뉜 행을 합칠 때 뒤 조각의 빈 칸이 빈 문단을 끌고 오지 않는다', () => {
    /* 뒤 조각에서 다른 칸들은 빈 칸으로 앉는다 (칸 수를 맞춰야 하므로).
       그 빈 문단을 그대로 옮겨 붙이면 없던 빈 줄이 문서에 남는다. */
    const html =
      '<table><tbody>' +
      '<tr><td><table><tbody><tr><td><p>안 1</p></td></tr></tbody></table></td><td><p>값 2</p></td></tr>' +
      '</tbody></table>' +
      '<table data-cont="1"><tbody>' +
      '<tr data-row-cont="1"><td><table data-cont="1"><tbody><tr><td><p>안 2</p></td></tr></tbody></table></td><td><p></p></td></tr>' +
      '</tbody></table>'
    const root = html2dom(mergeContinuedTables(html))
    const outer = root.querySelector('table') as HTMLElement
    expect(ownRows(outer)).toHaveLength(1)                   // 두 조각이 한 행으로 붙었다
    const cells = [...(ownRows(outer)[0]).children]
    expect(cells).toHaveLength(2)
    expect(cells[1].querySelectorAll('p')).toHaveLength(1)   // 「값 2」 하나뿐 — 빈 줄이 붙지 않았다
    expect(cells[1].textContent).toBe('값 2')
  })

  it('앞에 붙일 행이 없으면 표시만 지운다 (내용을 잃지 않는다)', () => {
    const html = '<table><tbody><tr data-row-cont="1"><td><p>홀로 남은 뒤 조각</p></td></tr></tbody></table>'
    const merged = mergeContinuedTables(html)
    expect(merged).toContain('홀로 남은 뒤 조각')
    expect(merged).not.toContain('data-row-cont')
  })

  it('반복 제목 행을 지울 때 안쪽 표의 행은 건드리지 않는다', () => {
    const html =
      '<table><tbody><tr><th>이름</th></tr></tbody></table>' +
      '<table data-cont="1"><tbody>' +
      '<tr data-repeated="1"><th>이름</th></tr>' +
      '<tr><td><table><tbody><tr data-repeated="1"><td>안쪽 제목</td></tr></tbody></table></td></tr>' +
      '</tbody></table>'
    const root = html2dom(mergeContinuedTables(html))
    const inner = root.querySelector('table table') as HTMLElement
    expect(inner).not.toBeNull()
    expect(ownRows(inner)).toHaveLength(1)
    expect(inner.textContent).toContain('안쪽 제목')
  })
})

/* ── 나눈 조각이 「한 표」 로 보이게 하는 표시 ───────────────────────────
   조각들은 서로 다른 쪽(page node)에 들어앉아 CSS 로 이웃을 볼 수 없다.
   앞 조각이 「뒤에 이어진다」 를 스스로 알지 못하면 아래 여백·둥근 모서리·그림자를
   그대로 그려, 쪽마다 표가 따로 끝난 것처럼 보인다. */

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
    table: {
      content: 'tableRow+',
      group: 'block',
      tableRole: 'table',
      attrs: {
        'data-cont': { default: null },
        'data-cont-next': { default: null },
        'data-repeat-header': { default: null },
        'data-wrap': { default: null },
        'data-keep': { default: null },
      },
      toDOM: () => ['table', ['tbody', 0]],
    },
    tableRow: {
      content: 'tableCell+',
      tableRole: 'row',
      attrs: { 'data-repeated': { default: null }, 'data-keep': { default: null } },
      toDOM: () => ['tr', 0],
    },
    tableCell: {
      content: 'block+',
      tableRole: 'cell',
      // 세로·가로 합침 — 나눌 자리를 고를 때 이 값을 본다
      attrs: { rowspan: { default: 1 }, colspan: { default: 1 }, 'data-jan-pad': { default: null } },
      toDOM: () => ['td', 0],
    },
  },
})

/** 글 하나가 든 n행짜리 표 */
function 표만들기(rows: number, attrs: Record<string, string | null> = {}): PMNode {
  const 행 = Array.from({ length: rows }, (_, i) =>
    schema.nodes.tableRow.create(null, [
      schema.nodes.tableCell.create(null, schema.nodes.paragraph.create(null, schema.text(`행 ${i + 1}`))),
    ]))
  return schema.nodes.table.create(attrs, 행)
}

describe('조각이 한 표로 보이게 하는 표시', () => {
  it('앞 조각에도 「뒤에 이어진다」 를 적어 둔다', () => {
    const parts = splitTableAt(표만들기(6), 3)
    expect(parts).not.toBeNull()
    expect(parts!.head.attrs['data-cont-next']).toBe('1')
    expect(parts!.head.attrs['data-cont']).toBeFalsy()
    expect(parts!.tail.attrs['data-cont']).toBe('1')
  })

  it('가운데 조각은 앞뒤 표시를 함께 지닌다 (위아래 마감을 모두 접어야 한다)', () => {
    const 첫판 = splitTableAt(표만들기(9), 3)!
    const 두판 = splitTableAt(첫판.tail, 3)!
    expect(두판.head.attrs['data-cont']).toBe('1')
    expect(두판.head.attrs['data-cont-next']).toBe('1')
  })

  it('저장할 때는 「뒤에 이어진다」 표시가 남지 않는다', () => {
    const html =
      '<table data-cont-next="1"><tbody><tr><td>1</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr><td>2</td></tr></tbody></table>'
    const merged = mergeContinuedTables(html)
    expect(merged.match(/<table/g)).toHaveLength(1)
    expect(merged).not.toContain('data-cont-next')
    expect(merged).not.toContain('data-cont=')
  })

  it('앞에 붙일 표가 없어도 표시만 지운다', () => {
    const merged = mergeContinuedTables('<table data-cont-next="1"><tbody><tr><td>1</td></tr></tbody></table>')
    expect(merged).toContain('<td>1</td>')
    expect(merged).not.toContain('data-cont-next')
  })
})

/**
 * 배치에 따라 나뉘는가 — 한글의 거동을 기준으로 삼는다.
 *  · 「글자처럼 취급」 인 표는 한 글자와 같아 나누지 않고 통째로 다음 쪽으로 간다.
 *  · 그렇지 않은 표는 여백 자리만 건너뛰고 다음 쪽에 이어져 보인다 (그래서 나눈다).
 * 배치를 보지 않던 시절에는 글자처럼 둔 표도 행 단위로 쪼개졌다 (실측: 60행 표가 26·27·7 로).
 */
describe('배치에 따라 나눌지 정한다', () => {
  it('글자처럼 취급한 표는 통째로 넘긴다', () => {
    expect(keepsWhole(표만들기(4, { 'data-wrap': 'inline' }))).toBe(true)
  })

  it('감싸기·문단 사이인 표는 나눈다', () => {
    expect(keepsWhole(표만들기(4))).toBe(false)
    expect(keepsWhole(표만들기(4, { 'data-wrap': 'left' }))).toBe(false)
    expect(keepsWhole(표만들기(4, { 'data-wrap': 'right' }))).toBe(false)
  })

  it('「쪼개지 말라」 가 붙은 표는 배치와 상관없이 통째로 넘긴다', () => {
    expect(keepsWhole(표만들기(4, { 'data-keep': '1' }))).toBe(true)
  })

  it('행에는 배치가 없다 — data-keep 만 본다', () => {
    const 행 = 표만들기(2).child(0)
    expect(keepsWhole(행)).toBe(false)
    expect(keepsWhole(schema.nodes.tableRow.create({ 'data-keep': '1' }, 행.content))).toBe(true)
  })
})

/**
 * 세로 합침(rowspan)을 뚫고 나누면 저장 왕복에서 표가 상한다.
 *
 * 뚫으면 앞 조각의 합친 칸이 조각 길이에 맞게 깎이고(4 → 2), 뒤 조각 첫 행들에는 그 열의
 * 칸이 모자란다. 비워 두면 prosemirror-tables 의 fixTables 가 네모꼴을 맞추려 빈 칸을
 * 행 **끝에** 덧붙이는데 — 열 자리도 틀리고 그 칸이 저장본에 그대로 남는다.
 * 실측(60행·4행마다 세로 합침): 문서 75칸 → 저장본 80칸, 빈 칸 5개, rowspan 이 4·2·1 로 뒤섞였다.
 * 그래서 깨끗한 행 경계까지 물러난다.
 */
describe('세로 합침을 뚫지 않는 나눔 자리', () => {
  /** 4행마다 왼쪽 칸이 세로로 합쳐진 표 */
  function 합친표(rows: number): PMNode {
    const 글 = (t: string) => schema.nodes.paragraph.create(null, schema.text(t))
    const 행 = Array.from({ length: rows }, (_, i) =>
      schema.nodes.tableRow.create(null, i % 4 === 0
        ? [schema.nodes.tableCell.create({ rowspan: 4 }, 글(`묶음 ${i / 4}`)), schema.nodes.tableCell.create(null, 글(`값 ${i}`))]
        : [schema.nodes.tableCell.create(null, 글(`값 ${i}`))]))
    return schema.nodes.table.create(null, 행)
  }

  it('합침이 걸친 자리는 「가로지른다」 고 답한다', () => {
    const t = 합친표(12)
    expect(rowspanCrosses(t, 4)).toBe(false)   // 4의 배수는 깨끗한 경계
    expect(rowspanCrosses(t, 8)).toBe(false)
    expect(rowspanCrosses(t, 5)).toBe(true)    // 묶음 1(4~7)을 뚫는다
    expect(rowspanCrosses(t, 6)).toBe(true)
    expect(rowspanCrosses(t, 7)).toBe(true)
  })

  it('뚫는 자리에서는 깨끗한 앞 경계까지 물러난다', () => {
    const t = 합친표(12)
    expect(safeSplitRow(t, 7)).toBe(4)
    expect(safeSplitRow(t, 8)).toBe(8)
    expect(safeSplitRow(t, 11)).toBe(8)
  })

  it('물러날 곳이 없으면 0 — 그때는 표를 통째로 민다', () => {
    // 첫 칸이 여덟 행을 덮으면 2행·3행에서 나눌 자리가 없다
    const 글 = (t: string) => schema.nodes.paragraph.create(null, schema.text(t))
    const 행 = Array.from({ length: 8 }, (_, i) =>
      schema.nodes.tableRow.create(null, i === 0
        ? [schema.nodes.tableCell.create({ rowspan: 8 }, 글('큰 칸')), schema.nodes.tableCell.create(null, 글(`값 ${i}`))]
        : [schema.nodes.tableCell.create(null, 글(`값 ${i}`))]))
    expect(safeSplitRow(schema.nodes.table.create(null, 행), 5)).toBe(0)
  })

  it('합침이 없는 표는 재던 자리를 그대로 쓴다', () => {
    expect(safeSplitRow(표만들기(10), 7)).toBe(7)
  })
})

/**
 * 자리를 맞추려고 끼워 넣은 빈 칸(data-jan-pad)은 합칠 때 자취를 남기지 않는다.
 * 깊이 나눔이 바깥 행 하나를 두 행으로 가르면 앞뒤 행에 칸이 모자라 우리가 채운다.
 */
describe('채움 칸 걷어 내기', () => {
  const html2dom = (html: string) => {
    const d = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
    return d.getElementById('r')!
  }

  it('앞 조각의 채움 칸에는 뒤 조각의 글이 그대로 들어앉는다 (빈 줄을 남기지 않는다)', () => {
    const html =
      '<table><tbody><tr><td><p>왼쪽</p></td><td data-jan-pad="1"><p></p></td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr data-row-cont="1"><td><p>이어짐</p></td><td><p>값 2</p></td></tr></tbody></table>'
    const root = html2dom(mergeContinuedTables(html))
    const cells = [...(ownRows(root.querySelector('table')!)[0]).children]
    expect(cells).toHaveLength(2)
    expect(cells[1].querySelectorAll('p')).toHaveLength(1)  // 빈 문단이 앞에 남지 않았다
    expect(cells[1].textContent).toBe('값 2')
    expect(root.innerHTML).not.toContain('data-jan-pad')
  })

  it('뒤 조각의 채움 칸은 아무것도 옮기지 않는다', () => {
    const html =
      '<table><tbody><tr><td><p>왼쪽</p></td><td><p>값 2</p></td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr data-row-cont="1"><td data-jan-pad="1"><p></p></td><td><p>덧붙임</p></td></tr></tbody></table>'
    const root = html2dom(mergeContinuedTables(html))
    const cells = [...(ownRows(root.querySelector('table')!)[0]).children]
    expect(cells[0].textContent).toBe('왼쪽')          // 채움 칸이 덮어쓰지 않았다
    expect(cells[1].textContent).toBe('값 2덧붙임')
    expect(root.innerHTML).not.toContain('data-jan-pad')
  })

  it('짝을 못 찾은 채움 칸은 표시만 지운다 (칸을 없애면 네모꼴이 깨진다)', () => {
    const merged = mergeContinuedTables('<table><tbody><tr><td><p>가</p></td><td data-jan-pad="1"><p></p></td></tr></tbody></table>')
    expect(merged).not.toContain('data-jan-pad')
    expect(merged.match(/<td/g)).toHaveLength(2)
  })
})

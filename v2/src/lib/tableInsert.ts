/**
 * 표 삽입 — 워드의 「삽입 ▸ 표」 격자.
 * 칸 위로 마우스를 끌면 몇 행 몇 열인지 미리 보이고, 누르면 그대로 만들어진다.
 */

const MAX_ROWS = 8
const MAX_COLS = 10

export interface TableInsertChoice {
  rows: number
  cols: number
  withHeaderRow: boolean
}

/** 격자를 띄우고 고른 크기를 돌려준다 (취소하면 null) */
export function pickTableSize(): Promise<TableInsertChoice | null> {
  return new Promise((resolve) => {
    document.getElementById('jan-table-grid-picker')?.remove()
    const wrap = document.createElement('div')
    wrap.id = 'jan-table-grid-picker'
    wrap.className = 'jan-modal-overlay'

    const cells = Array.from({ length: MAX_ROWS * MAX_COLS }, (_, i) => {
      const r = Math.floor(i / MAX_COLS) + 1
      const c = (i % MAX_COLS) + 1
      return `<button type="button" class="jan-tg-cell" data-r="${r}" data-c="${c}" aria-label="${r}행 ${c}열"></button>`
    }).join('')

    wrap.innerHTML =
      '<div class="jan-modal jan-table-grid-modal" role="dialog" aria-label="표 삽입">' +
      '<div class="jan-modal-head"><h3>표 삽입</h3><button class="jan-modal-close" aria-label="닫기">닫기</button></div>' +
      '<div class="jan-modal-body">' +
      `<div class="jan-tg-grid" style="grid-template-columns:repeat(${MAX_COLS},1fr)">${cells}</div>` +
      '<p class="jan-tg-label" aria-live="polite">칸 위로 움직여 크기를 고르세요</p>' +
      '<label class="jan-tg-opt"><input type="checkbox" checked> 첫 행을 제목 행으로</label>' +
      '<div class="jan-tg-actions"><button type="button" class="jan-tg-custom">행·열 직접 입력...</button></div>' +
      '</div></div>'

    const grid = wrap.querySelector('.jan-tg-grid') as HTMLElement
    const label = wrap.querySelector('.jan-tg-label') as HTMLElement
    const header = wrap.querySelector('.jan-tg-opt input') as HTMLInputElement

    const highlight = (rows: number, cols: number) => {
      grid.querySelectorAll('.jan-tg-cell').forEach((el) => {
        const cell = el as HTMLElement
        const r = Number(cell.dataset.r)
        const c = Number(cell.dataset.c)
        cell.classList.toggle('is-on', r <= rows && c <= cols)
      })
      label.textContent = rows && cols ? `${rows}행 × ${cols}열` : '칸 위로 움직여 크기를 고르세요'
    }

    const done = (value: TableInsertChoice | null) => { wrap.remove(); resolve(value) }

    grid.addEventListener('mouseover', (e) => {
      const cell = (e.target as HTMLElement).closest('.jan-tg-cell') as HTMLElement | null
      if (cell) highlight(Number(cell.dataset.r), Number(cell.dataset.c))
    })
    grid.addEventListener('mouseleave', () => highlight(0, 0))
    grid.addEventListener('click', (e) => {
      const cell = (e.target as HTMLElement).closest('.jan-tg-cell') as HTMLElement | null
      if (cell) done({ rows: Number(cell.dataset.r), cols: Number(cell.dataset.c), withHeaderRow: header.checked })
    })
    wrap.querySelector('.jan-tg-custom')?.addEventListener('click', () => {
      const raw = window.prompt('행 × 열 (예: 5x3)', '5x3')
      if (!raw) return
      const m = /^(\d+)\s*[x×*]\s*(\d+)$/.exec(raw.trim())
      if (!m) return
      const rows = Math.max(1, Math.min(200, Number(m[1])))
      const cols = Math.max(1, Math.min(30, Number(m[2])))
      done({ rows, cols, withHeaderRow: header.checked })
    })
    wrap.querySelector('.jan-modal-close')?.addEventListener('click', () => done(null))
    wrap.addEventListener('click', (e) => { if (e.target === wrap) done(null) })
    document.addEventListener('keydown', function onKey(e) {
      if (e.key !== 'Escape') return
      document.removeEventListener('keydown', onKey)
      done(null)
    })

    document.body.appendChild(wrap)
  })
}

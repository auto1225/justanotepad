import { test, expect, type Page } from '@playwright/test'

/**
 * 표를 워드·한글 수준으로 — 쪽을 넘는 표가 「한 표」 로 보이는가, 여러 칸을 골라 크기를 바꿀 수 있는가.
 *
 * 여기 적힌 눈금은 모두 실제로 재어 본 값이다.
 *  ① 나뉜 조각마다 위아래 10px 여백·점선 테두리·둥근 모서리·그림자가 되풀이돼
 *    행마다 따로 떨어진 상자처럼 보였다 (실측: margin 10px/10px, border-top: dashed,
 *    효과를 켜면 조각마다 radius 10px·drop-shadow).
 *  ① 배치를 보지 않고 무엇이든 행 단위로 나누어, 한글에서 「글자처럼 취급」 인 표까지 쪼개졌다
 *    (실측: 60행 표가 26·27·7 로).
 *  ② 「열 너비를 같게」 가 지정이 없는 열의 폭을 0 으로 세어, 184px+152px 인 두 열을 고르면
 *    92px·92px 로 쭈그러들었다 (실측).
 *  ② 「행 높이 지정」 은 고른 행이 셋이어도 커서가 든 한 행만 고쳤다 (실측: [null,"60px",null,null]).
 */

/** 저장·내보내기가 실제로 쓰는 변환 (getSavableHtml) */
async function 저장본(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __janSavable: () => string }).__janSavable())
}

async function 문서를(page: Page, html: string) {
  await page.evaluate((h) => {
    const ed = (window as unknown as { __janEditor: { commands: { setContent: (h: string) => void } } }).__janEditor
    ed.commands.setContent(h)
  }, html)
}

/** 쪽 배치가 잦아들 때까지 (연속 세 번 같을 때까지) */
async function 조판끝(page: Page) {
  const snapshot = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.jan-page-node')]
        .map((p) => `${p.children.length}:${Math.round((p as HTMLElement).getBoundingClientRect().height)}`)
        .join(','))
  let prev = ''
  let stable = 0
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(150)
    const now = await snapshot()
    stable = now === prev && now !== '' ? stable + 1 : 0
    prev = now
    if (stable >= 3) return
  }
}

/** 이 표 자신의 행만 세는 셈 (칸 속 표의 행은 남의 것이다) */
async function 표조각(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.ProseMirror') as HTMLElement
    const own = (t: Element) => [...t.querySelectorAll('tr')].filter((r) => r.closest('table') === t)
    const 바깥 = [...root.querySelectorAll('table')].filter((t) => !t.parentElement?.closest('table'))
    return 바깥.map((t) => {
      const cs = getComputedStyle(t)
      const wrap = t.parentElement as HTMLElement
      const first = own(t)[0]?.querySelector('td, th') as HTMLElement | undefined
      return {
        행수: own(t).length,
        cont: wrap.getAttribute('data-cont'),
        contNext: wrap.getAttribute('data-cont-next'),
        marginTop: Math.round(parseFloat(cs.marginTop)),
        marginBottom: Math.round(parseFloat(cs.marginBottom)),
        radiusTop: Math.round(parseFloat(cs.borderTopLeftRadius)),
        radiusBottom: Math.round(parseFloat(cs.borderBottomLeftRadius)),
        filter: cs.filter,
        첫행위테두리: first ? getComputedStyle(first).borderTopStyle : '',
      }
    })
  })
}

async function 고른칸(page: Page) {
  return page.evaluate(() => ({
    수: document.querySelectorAll('.ProseMirror td.selectedCell, .ProseMirror th.selectedCell').length,
    종류: (window as unknown as { __janEditor: { state: { selection: unknown } } })
      .__janEditor.state.selection.constructor.name,
  }))
}

async function 열너비(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.ProseMirror tr:first-child > :is(td, th)')]
      .map((c) => Math.round(c.getBoundingClientRect().width)))
}

const 긴표 = (n: number) =>
  '<table><tbody>' +
  Array.from({ length: n }, (_, i) => `<tr><td><p>행 ${i + 1}</p></td><td><p>값 ${i + 1}</p></td></tr>`).join('') +
  '</tbody></table>'

test.describe('표 — 쪽 넘김과 여러 칸 다루기', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    const model = await page.evaluate(
      () => document.querySelector('[data-page-model]')?.getAttribute('data-page-model') ?? '')
    test.skip(model !== 'nodes', `독립 페이지 모델이 아님 (${model})`)
    await page.getByRole('button', { name: '새 메모', exact: true }).first().click()
    await page.locator('.jan-page-node').first().click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
  })

  /* ── ① 쪽을 넘는 표가 한 몸으로 보인다 ────────────────────────────── */

  test('① 나뉜 조각 사이에 빈틈이 없고 테두리가 끊기지 않는다', async ({ page }) => {
    await 문서를(page, '<p>표 앞</p>' + 긴표(60) + '<p>표 뒤</p>')
    await 조판끝(page)
    const 조각 = await 표조각(page)
    expect(조각.length).toBeGreaterThan(1)

    조각.forEach((it, i) => {
      const 첫조각 = i === 0
      const 끝조각 = i === 조각.length - 1
      // 이어짐 표시가 앞뒤로 제대로 붙어 있어야 마감을 접을 수 있다
      expect(it.cont).toBe(첫조각 ? null : '1')
      expect(it.contNext).toBe(끝조각 ? null : '1')
      // 조각 사이의 빈틈 — 이어지는 자리에는 표 여백을 두지 않는다
      if (!첫조각) expect(it.marginTop).toBe(0)
      if (!끝조각) expect(it.marginBottom).toBe(0)
      // 점선으로 끊긴 테두리 — 워드·한글은 이어진 표를 실선으로 그린다
      expect(it.첫행위테두리).toBe('solid')
    })
    // 바깥쪽 여백은 그대로 (첫 조각 위 · 끝 조각 아래)
    expect(조각[0].marginTop).toBeGreaterThan(0)
    expect(조각[조각.length - 1].marginBottom).toBeGreaterThan(0)
  })

  test('① 둥근 모서리와 그림자가 조각마다 되풀이되지 않는다', async ({ page }) => {
    await page.evaluate(() => document.documentElement.setAttribute('data-jan-effect', 'round'))
    await 문서를(page, '<p>표 앞</p>' + 긴표(60) + '<p>표 뒤</p>')
    await 조판끝(page)
    const 둥근 = await 표조각(page)
    expect(둥근.length).toBeGreaterThan(1)
    // 한 표의 위 모서리는 첫 조각에만, 아래 모서리는 끝 조각에만
    expect(둥근.map((t) => t.radiusTop)).toEqual([둥근[0].radiusTop, ...둥근.slice(1).map(() => 0)])
    expect(둥근[0].radiusTop).toBeGreaterThan(0)
    expect(둥근[둥근.length - 1].radiusBottom).toBeGreaterThan(0)
    expect(둥근.slice(0, -1).every((t) => t.radiusBottom === 0)).toBe(true)

    await page.evaluate(() => document.documentElement.setAttribute('data-jan-effect', 'soft'))
    await page.waitForTimeout(400)
    const 그림자 = await 표조각(page)
    // 조각마다 그림자가 깔리면 표가 쪽마다 끝난 것처럼 보인다 — 마지막 조각에만 남는다
    expect(그림자.slice(0, -1).every((t) => t.filter === 'none')).toBe(true)
    expect(그림자[그림자.length - 1].filter).not.toBe('none')
  })

  test('① 「글자처럼 취급」 인 표는 나누지 않고 통째로 다음 쪽으로 간다', async ({ page }) => {
    /* 한글의 거동: 글자처럼 둔 표는 한 글자와 같아 나누지 않는다.
       그렇지 않은 표는 여백 자리만 건너뛰고 다음 쪽에 이어져 보인다. */
    const 앞글 = '<p>' + '앞 글을 채운다. '.repeat(160) + '</p>'
    const 표 = '<table data-wrap="inline"><tbody>' +
      Array.from({ length: 24 }, (_, i) => `<tr><td><p>행 ${i + 1}</p></td></tr>`).join('') +
      '</tbody></table>'
    await 문서를(page, 앞글 + 표 + '<p>표 뒤</p>')
    await 조판끝(page)
    const 글자처럼 = await 표조각(page)
    expect(글자처럼.map((t) => t.행수)).toEqual([24])   // 한 조각 — 쪼개지 않았다
    expect(await page.evaluate(() => document.querySelectorAll('.jan-page-node').length)).toBeGreaterThan(1)

    // 견주기 — 배치를 풀면 같은 표가 쪽에 걸쳐 나뉜다
    await 문서를(page, 앞글 + 표.replace(' data-wrap="inline"', '') + '<p>표 뒤</p>')
    await 조판끝(page)
    const 보통 = await 표조각(page)
    expect(보통.length).toBeGreaterThan(1)
    expect(보통.reduce((a, t) => a + t.행수, 0)).toBe(24)  // 행을 하나도 잃지 않는다
  })

  test('① 저장하면 한 표로 돌아오고 조판 표시가 남지 않는다', async ({ page }) => {
    await 문서를(page, '<p>표 앞</p><table data-repeat-header="1"><tbody>' +
      '<tr><th><p>이름</p></th><th><p>값</p></th></tr>' +
      Array.from({ length: 60 }, (_, i) => `<tr><td><p>행 ${i + 1}</p></td><td><p>값 ${i + 1}</p></td></tr>`).join('') +
      '</tbody></table><p>표 뒤</p>')
    await 조판끝(page)
    expect((await 표조각(page)).length).toBeGreaterThan(1)

    const html = await 저장본(page)
    const m = await page.evaluate((h) => {
      const wrap = document.createElement('div')
      wrap.innerHTML = h
      return {
        표: wrap.querySelectorAll('table').length,
        행: wrap.querySelectorAll('tr').length,
        cont: wrap.querySelectorAll('[data-cont]').length,
        contNext: wrap.querySelectorAll('[data-cont-next]').length,
        repeated: wrap.querySelectorAll('[data-repeated]').length,
      }
    }, html)
    expect(m).toEqual({ 표: 1, 행: 61, cont: 0, contNext: 0, repeated: 0 })
  })

  /* ── ② 여러 칸을 골라 크기 바꾸기 ─────────────────────────────────── */

  /** 왼쪽 위에서 n개 열을 세로로 끝까지 고른다 (워드에서 열 머리를 끌어 고르는 것과 같다) */
  async function 열고르기(page: Page, n: number, rows: number) {
    await page.locator('.ProseMirror table td').first().click()
    await page.waitForTimeout(250)
    await page.keyboard.press('Alt+s')
    for (let i = 1; i < n; i++) await page.keyboard.press('Shift+ArrowRight')
    for (let i = 1; i < rows; i++) await page.keyboard.press('Shift+ArrowDown')
    await page.waitForTimeout(150)
  }

  const 표3x4 =
    '<table><tbody>' +
    Array.from({ length: 3 }, (_, r) =>
      '<tr>' + Array.from({ length: 4 }, (_, c) => `<td><p>${r}-${c}</p></td>`).join('') + '</tr>').join('') +
    '</tbody></table><p>뒤</p>'

  test('② 「열 너비를 같게」 는 고른 열의 폭 합을 지킨다', async ({ page }) => {
    await 문서를(page, 표3x4)
    await page.waitForTimeout(400)
    await page.locator('.ProseMirror table td').first().click()
    await page.waitForTimeout(200)
    for (let i = 0; i < 3; i++) await page.keyboard.press('Alt+ArrowRight')
    await page.waitForTimeout(300)
    const 전 = await 열너비(page)
    expect(전[0]).toBeGreaterThan(전[1])   // 첫 열만 넓혀 들쭉날쭉하게 만들었다

    await 열고르기(page, 2, 3)
    expect((await 고른칸(page)).수).toBe(6) // 3행 × 2열
    await page.keyboard.press('Alt+e')
    await page.waitForTimeout(400)

    const 후 = await 열너비(page)
    // 고른 두 열은 같아지고, 그 합은 그대로다 (예전에는 절반으로 쭈그러들었다)
    expect(Math.abs(후[0] - 후[1])).toBeLessThanOrEqual(1)
    expect(Math.abs((후[0] + 후[1]) - (전[0] + 전[1]))).toBeLessThanOrEqual(2)
    // 고르지 않은 열은 건드리지 않는다
    expect(후[2]).toBe(전[2])
    expect(후[3]).toBe(전[3])
    // 크기를 바꾼 뒤에도 고름이 살아 있다 (한 번 누를 때마다 풀리면 일이 안 된다)
    expect((await 고른칸(page)).수).toBe(6)
  })

  test('② 고른 열을 넓히면 그 열들이 함께 바뀐다 (리본 단추로)', async ({ page }) => {
    await 문서를(page, 표3x4)
    await page.waitForTimeout(400)
    await 열고르기(page, 2, 3)
    const 전 = await 열너비(page)

    await page.getByRole('tab', { name: '표 레이아웃' }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /셀 크기.*더보기/ }).first().click()
    await page.waitForTimeout(250)
    await page.locator('.jan-ribbon-dropdown button', { hasText: '열 너비 넓히기' }).first().click()
    await page.waitForTimeout(400)

    const 후 = await 열너비(page)
    expect(후[0]).toBeGreaterThan(전[0])   // 첫째 열
    expect(후[1]).toBeGreaterThan(전[1])   // 둘째 열 — 「한 칸만」 이 아니다
    expect((await 고른칸(page)).수).toBe(6)
    expect((await 고른칸(page)).종류).toBe('CellSelection')
  })

  test('② 「행 높이 지정」 창은 고른 행 전부에 걸린다', async ({ page }) => {
    await 문서를(page, 표3x4)
    await page.waitForTimeout(400)
    await page.locator('.ProseMirror table td').first().click()
    await page.waitForTimeout(250)
    await page.keyboard.press('Alt+s')
    await page.keyboard.press('Shift+ArrowDown')
    await page.waitForTimeout(150)

    await page.getByRole('tab', { name: '표 레이아웃' }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: '행 높이 지정 (창)' }).first().click()
    await page.waitForTimeout(400)
    await page.locator('.jan-modal input').first().fill('60px')
    await page.locator('.jan-modal button', { hasText: '확인' }).first().click()
    await page.waitForTimeout(400)

    const 높이 = await page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror tr')].map((r) => (r as HTMLElement).getAttribute('data-height')))
    expect(높이).toEqual(['60px', '60px', null])   // 고른 두 행만, 둘 다
  })

  /* ── 여러 칸을 고른 채 타자·Enter — 글이 사라지거나 표가 무너지면 안 된다 ── */

  test('② 여러 칸을 고른 채 글자를 치면 그 칸이 모두 비고 첫 칸에 들어간다', async ({ page }) => {
    /* 워드·한글의 거동. 예전에는 고른 네 칸 가운데 끝 칸 하나만 덮어쓰고 나머지는
       옛 글을 그대로 안고 있었다 (실측: 00·01·02·10·11·12 → 00·01·02·10·가·12). */
    await 문서를(page,
      '<table><tbody>' +
      Array.from({ length: 3 }, (_, r) =>
        '<tr>' + Array.from({ length: 3 }, (_, c) => `<td><p>${r}${c}</p></td>`).join('') + '</tr>').join('') +
      '</tbody></table><p>뒤</p>')
    await page.waitForTimeout(400)
    await page.locator('.ProseMirror table td').first().click()
    await page.waitForTimeout(250)
    await page.keyboard.press('Alt+s')
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Shift+ArrowDown')
    await page.waitForTimeout(150)
    expect((await 고른칸(page)).수).toBe(4)

    await page.keyboard.type('가')
    await page.waitForTimeout(400)
    const 글 = await page.evaluate(() =>
      ((document.querySelector('.ProseMirror') as HTMLElement).textContent || '').replace(/\s+/g, ''))
    expect(글).toBe('가0212202122뒤')   // 고른 00·01·10·11 이 비고 첫 칸에 「가」

    // 표 구조는 그대로다 — 저장했다 열어도 3행 9칸
    const html = await 저장본(page)
    expect((html.match(/<tr/g) || []).length).toBe(3)
    expect((html.match(/<td/g) || []).length).toBe(9)
  })

  test('② 여러 칸을 고른 채 Enter 를 눌러도 표가 무너지지 않는다', async ({ page }) => {
    await 문서를(page,
      '<table><tbody>' +
      Array.from({ length: 3 }, (_, r) =>
        '<tr>' + Array.from({ length: 3 }, (_, c) => `<td><p>${r}${c}</p></td>`).join('') + '</tr>').join('') +
      '</tbody></table><p>뒤</p>')
    await page.waitForTimeout(400)
    await page.locator('.ProseMirror table td').first().click()
    await page.waitForTimeout(250)
    await page.keyboard.press('Alt+c')   // 첫 열 전체
    await page.waitForTimeout(200)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)

    const 글 = await page.evaluate(() =>
      ((document.querySelector('.ProseMirror') as HTMLElement).textContent || '').replace(/\s+/g, ''))
    expect(글).toBe('010211122122뒤')   // 고른 열만 비었다 (예전에는 아무 일도 없었다)
    const html = await 저장본(page)
    expect((html.match(/<table/g) || []).length).toBe(1)
    expect((html.match(/<td/g) || []).length).toBe(9)
  })

  /* ── ③ 채운 것 ────────────────────────────────────────────────── */

  test('③ 나눈 표를 「앞 표와 합치기」 로 되돌린다', async ({ page }) => {
    await 문서를(page, 긴표(4) + '<p>뒤</p>')
    await page.waitForTimeout(400)
    // 셋째 행에 커서를 두고 표를 나눈다
    await page.locator('.ProseMirror table td').nth(4).click()
    await page.waitForTimeout(250)
    await page.keyboard.press('Shift+F10')
    await page.locator('.jan-table-ctx button', { hasText: '표 분할' }).first().click()
    await page.waitForTimeout(400)
    const 나눈뒤 = await 표조각(page)
    expect(나눈뒤.map((t) => t.행수)).toEqual([2, 2])

    // 뒤 표에 커서를 두고 도로 합친다
    await page.locator('.ProseMirror table').nth(1).locator('td').first().click()
    await page.waitForTimeout(250)
    await page.keyboard.press('Shift+F10')
    await page.locator('.jan-table-ctx button', { hasText: '앞 표와 합치기' }).first().click()
    await page.waitForTimeout(400)
    const 합친뒤 = await 표조각(page)
    expect(합친뒤.map((t) => t.행수)).toEqual([4])
    expect(await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).innerText))
      .toContain('행 4')
  })

  test('③ 「표를 나누지 않기」 를 켜면 쪽 경계에서 통째로 넘어간다', async ({ page }) => {
    await 문서를(page, '<p>' + '앞 글을 채운다. '.repeat(160) + '</p>' + 긴표(24) + '<p>표 뒤</p>')
    await 조판끝(page)
    expect((await 표조각(page)).length).toBeGreaterThan(1)  // 그냥 두면 나뉜다

    await page.locator('.ProseMirror table td').first().click()
    await page.waitForTimeout(250)
    await page.keyboard.press('Shift+F10')
    await page.locator('.jan-table-ctx button', { hasText: '표를 나누지 않기' }).first().click()
    await 조판끝(page)

    const 조각 = await 표조각(page)
    expect(조각.map((t) => t.행수)).toEqual([24])   // 한 조각 그대로 다음 쪽으로
    // 저장본에도 표시가 남아 다시 열어도 그대로다
    expect(await 저장본(page)).toContain('data-keep')
  })

  test('③ 끄는 도중 표가 쪽을 넘어가도 끌기가 죽지 않는다', async ({ page }) => {
    /* 크기를 끄는 사이에 표가 쪽 경계를 넘으면 조판이 노드를 지우고 다시 넣는다.
       고름에 기대면 그 순간 findTable() 이 표를 잃어 그다음 걸음부터 아무 일도 일어나지 않는다 —
       그림에서 실제로 겪고 고친 고장이다(ImageHandles). 표 손잡이도 같은 수를 썼다:
       끄는 동안 표의 자리를 붙들고, 문서가 바뀌면 그 자리도 함께 옮기고, 걸음마다 커서를 되돌린다.

       ※ 이 시험은 **못 지킨다**. 고침을 빼고도 그대로 통과한다 — 지금 조판에서는 나눌 때
         커서가 든 칸이 앞 조각에 남아 고름이 표 밖으로 나가지 않기 때문이다(실측:
         열 걸음 내내 「표안: true」, 열째 걸음에서 조각이 2개가 되어도 끌기는 이어졌다).
         고침은 그 전제가 깨지는 날(뒤 조각으로 넘어가는 나눔, 노드 통째 교체)을 위한 대비이고,
         지금 이 시험이 지키는 것은 「끌기가 끝까지 따라온다」 뿐이다. */
    await 문서를(page, '<p>' + '앞 글을 채운다. '.repeat(150) + '</p>' + 긴표(6) + '<p>표 뒤</p>')
    await 조판끝(page)
    await page.locator('.ProseMirror table td').first().click()
    await page.waitForTimeout(400)

    const 손잡이 = page.locator('.jan-th-rowsize').first()
    await expect(손잡이).toBeAttached()
    const box = await 손잡이.boundingBox()
    const 처음높이 = (await page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror tr')].map((r) => Math.round(r.getBoundingClientRect().height))))[0]

    // 한 번에 크게 끌어 표가 쪽 경계를 넘게 만든다 (걸음마다 조판이 돈다)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + i * 30)
      await page.waitForTimeout(80)
    }
    await page.mouse.up()
    await 조판끝(page)

    const 끝높이 = (await page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror tr')].map((r) => Math.round(r.getBoundingClientRect().height))))[0]
    // 끝까지 따라왔다 — 한 걸음 만에 죽었다면 30px 언저리에서 멈춘다
    expect(끝높이 - 처음높이).toBeGreaterThan(150)
    // 손잡이도 살아 있다
    await expect(page.locator('.jan-th-rowsize').first()).toBeAttached()
  })

  test('③ 「고른 글을 표로」 — 만들어 두고도 부르는 자리가 없던 것', async ({ page }) => {
    await 문서를(page, '<p>이름,나이,사는곳</p><p>가나,20,서울</p><p>다라,30,부산</p>')
    await page.waitForTimeout(400)
    await page.locator('.jan-page-node').first().click()
    await page.keyboard.press('Control+a')
    await page.waitForTimeout(200)

    await page.getByRole('tab', { name: '삽입' }).first().click()
    await page.waitForTimeout(300)
    await page.locator('button[aria-label^="표 삽입"] .jan-ribbon-caret').first().click()
    await page.waitForTimeout(250)
    await page.locator('.jan-ribbon-dropdown button', { hasText: '고른 글을 표로' }).first().click()
    await page.waitForTimeout(400)
    await page.locator('.jan-modal input').first().fill(',')
    await page.locator('.jan-modal button', { hasText: '확인' }).first().click()
    await page.waitForTimeout(500)

    const m = await page.evaluate(() => {
      const t = document.querySelector('.ProseMirror table')
      return {
        표: document.querySelectorAll('.ProseMirror table').length,
        행: t ? t.querySelectorAll('tr').length : 0,
        칸: t ? t.querySelectorAll('td, th').length : 0,
        글: (document.querySelector('.ProseMirror') as HTMLElement).textContent?.replace(/\s+/g, ''),
      }
    })
    expect(m.표).toBe(1)
    expect(m.행).toBe(3)
    expect(m.칸).toBe(9)
    expect(m.글).toContain('가나')
    expect(m.글).toContain('부산')
  })

  /* ── 사람이 실제로 하는 흐름 ─────────────────────────────────────── */

  test('흐름 — 만들고 · 합치고 · 넓히고 · 행을 더해 쪽을 넘긴 뒤 저장해도 그대로다', async ({ page }) => {
    await 문서를(page,
      '<table data-repeat-header="1"><tbody>' +
      '<tr><th><p>이름</p></th><th><p>값</p></th><th><p>비고</p></th></tr>' +
      Array.from({ length: 40 }, (_, i) => `<tr><td><p>행 ${i + 1}</p></td><td><p>${i + 1}</p></td><td><p>-</p></td></tr>`).join('') +
      '</tbody></table><p>뒤</p>')
    await 조판끝(page)

    // 1) 머리글의 두 칸을 골라 합친다
    await page.locator('.ProseMirror table th').first().click()
    await page.waitForTimeout(250)
    await page.keyboard.press('Alt+s')
    await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(150)
    await page.keyboard.press('Alt+m')
    await 조판끝(page)
    expect(await page.evaluate(() =>
      (document.querySelector('.ProseMirror th') as HTMLElement).getAttribute('colspan'))).toBe('2')

    // 2) 두 열을 골라 넓힌다 — 고름이 풀리지 않는다
    await page.locator('.ProseMirror table td').first().click()
    await page.waitForTimeout(250)
    await page.keyboard.press('Alt+s')
    await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(150)
    const 전 = await 열너비(page)
    await page.keyboard.press('Alt+ArrowRight')
    await 조판끝(page)
    const 후 = await 열너비(page)
    expect(후[0]).toBeGreaterThan(전[0])
    expect((await 고른칸(page)).종류).toBe('CellSelection')

    // 3) 행을 더 넣어 쪽을 더 넘긴다
    const 조각전 = (await 표조각(page)).length
    expect(조각전).toBeGreaterThan(1)
    /* 마지막 칸은 손잡이·상황 막대에 가려 눌리지 않을 수 있다 — 자리로 커서를 옮긴다 */
    await page.evaluate(() => {
      const ed = (window as unknown as { __janEditor: { state: { doc: { descendants: (f: (n: unknown, p: number) => void) => void } }; commands: { focus: (p: number) => void } } }).__janEditor
      let 끝칸 = 0
      ed.state.doc.descendants((n: unknown, pos: number) => {
        const node = n as { type: { name: string } }
        if (node.type.name === 'tableCell') 끝칸 = pos
      })
      ed.commands.focus(끝칸 + 2)
    })
    await page.waitForTimeout(300)
    for (let i = 0; i < 12; i++) await page.keyboard.press('Alt+i')
    await 조판끝(page)

    // 4) 쪽마다 제목 행이 다시 찍힌다 (조각 수 − 1 개)
    const 조각 = await 표조각(page)
    expect(조각.length).toBeGreaterThanOrEqual(조각전)
    const 반복 = await page.evaluate(() => document.querySelectorAll('.ProseMirror tr[data-repeated]').length)
    expect(반복).toBe(조각.length - 1)
    // 조각 사이에는 여전히 빈틈이 없다
    expect(조각.slice(1).every((t) => t.marginTop === 0)).toBe(true)

    // 5) 저장하면 한 표 — 합친 칸도 넓힌 열도 그대로다
    const html = await 저장본(page)
    const m = await page.evaluate((h) => {
      const wrap = document.createElement('div')
      wrap.innerHTML = h
      const th = wrap.querySelector('th')
      const first = wrap.querySelector('td')
      return {
        표: wrap.querySelectorAll('table').length,
        행: wrap.querySelectorAll('tr').length,
        머리colspan: th?.getAttribute('colspan') ?? null,
        첫칸너비: first?.getAttribute('colwidth') || (first as HTMLElement)?.style.width || '',
        cont: wrap.querySelectorAll('[data-cont], [data-cont-next], [data-repeated]').length,
      }
    }, html)
    expect(m.표).toBe(1)
    expect(m.행).toBe(53)          // 머리글 1 + 40 + 새로 넣은 12
    expect(m.머리colspan).toBe('2')
    expect(m.cont).toBe(0)
  })

  /**
   * 반복 제목 행은 화면에만 있어야 한다.
   *
   * 예전에는 나눌 때 첫 행을 복제해 **문서에** 넣었다. 화면은 맞았고 저장본도
   * mergeContinuedTables 가 지워 줘서 멀쩡했으므로 오래 눈에 띄지 않았는데,
   * 그 사이 문서 안에는 같은 글이 조각 수만큼 들어앉아 있었다 — 실측으로
   * 머리글이 doc.textContent 에 세 번 들어 있었다. 상태줄의 글자·낱말·문단 수
   * (StatusBar 의 getDocumentStats 는 doc.descendants 로 센다)와 찾기·바꾸기가
   * 그만큼 부풀었다. 지금은 위젯이라 문서에 없다.
   */
  test('반복 제목 행은 화면에만 있다 — 글자수와 찾기가 부풀지 않는다', async ({ page }) => {
    await 문서를(page,
      '<table data-repeat-header="1"><tbody>' +
      '<tr><th><p>머리글표식</p></th><th><p>값</p></th></tr>' +
      Array.from({ length: 70 }, (_, i) => `<tr><td><p>행 ${i + 1}</p></td><td><p>${i + 1}</p></td></tr>`).join('') +
      '</tbody></table><p>뒤</p>')
    await 조판끝(page)

    const 잰값 = await page.evaluate(() => {
      const ed = (window as unknown as {
        __janEditor: { state: { doc: { textContent: string; descendants: (f: (n: { type: { name: string } }) => void) => void } } }
      }).__janEditor
      let 문서행 = 0
      ed.state.doc.descendants((n) => { if (n.type.name === 'tableRow') 문서행 += 1 })
      return {
        화면반복: document.querySelectorAll('.ProseMirror tr[data-repeated]').length,
        화면행: document.querySelectorAll('.ProseMirror tr').length,
        문서행,
        문서머리글: ed.state.doc.textContent.split('머리글표식').length - 1,
      }
    })

    // 표가 실제로 갈라져야 이 시험에 뜻이 있다
    expect(잰값.화면반복).toBeGreaterThan(0)
    // 화면에는 조각마다 머리글이 다시 찍히고
    expect(잰값.화면행).toBe(잰값.문서행 + 잰값.화면반복)
    // 문서에는 딱 한 번뿐이다 (예전에는 조각 수만큼 = 화면반복 + 1 이었다)
    expect(잰값.문서머리글).toBe(1)
  })
})

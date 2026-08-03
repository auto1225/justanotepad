import { expect, test, type Page } from '@playwright/test'

/**
 * 표 속성 창 — 워드의 「표 속성」 대화상자.
 *
 * 예전에는 너비·행 높이·셀 여백을 **따로따로 묻는 프롬프트 셋**이었다
 * (Toolbar 의 askTableWidth · askRowHeight · askCellPadding).
 * 지금 값이 무엇인지 알려 주지도 않았고, 한 갈피에 모여 있지도 않았다.
 *
 * 여기서 재는 것은 「창이 뜬다」 가 아니라 **「창에서 값을 바꾸면 화면의 표가 실제로 바뀐다」** 다.
 * 모든 눈금은 getComputedStyle · getBoundingClientRect 로 잰 값이다.
 */

const T = '<table><tbody>' +
  '<tr><td><p>A</p></td><td><p>B</p></td><td><p>C</p></td></tr>' +
  '<tr><td><p>D</p></td><td><p>E</p></td><td><p>F</p></td></tr>' +
  '</tbody></table><p>표 뒤 문단</p>'

async function 표문서(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('./')
  await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.evaluate((h) => {
    (window as unknown as { __janEditor: { commands: { setContent: (h: string) => void } } })
      .__janEditor.commands.setContent(h)
  }, T)
  await expect(page.locator('.ProseMirror table td')).toHaveCount(6)
  await page.waitForTimeout(600)
}

/** 칸을 눌러 커서를 그 안에 둔다 */
async function 칸누르기(page: Page, index: number) {
  const cell = page.locator('.ProseMirror table td').nth(index)
  const want = (await cell.textContent())?.trim() ?? ''
  await cell.click()
  await expect.poll(async () => page.evaluate(() => {
    const s = window.getSelection()
    const n = s?.anchorNode
    const el = n && (n.nodeType === 1 ? (n as Element) : n.parentElement)
    return el?.closest('td')?.textContent?.trim() ?? ''
  })).toBe(want)
  await page.waitForTimeout(200)
}

const 창 = (page: Page) => page.locator('[role="dialog"][aria-label="표 속성"]')

async function 창열기(page: Page, tab = 'table') {
  await page.evaluate((t) => window.dispatchEvent(new CustomEvent('jan-table-props', { detail: { tab: t } })), tab)
  await expect(창(page)).toBeVisible()
}

/** 이 표 자신의 DOM 눈금 */
const 표재기 = (page: Page) => page.evaluate(() => {
  const t = document.querySelector('.ProseMirror table') as HTMLElement
  const wrap = t.closest('.tableWrapper') as HTMLElement
  const cs = getComputedStyle(t)
  const 첫칸 = t.querySelector('td') as HTMLElement
  const 칸스 = getComputedStyle(첫칸)
  const tr = t.getBoundingClientRect()
  const wr = wrap.getBoundingClientRect()
  return {
    표폭: Math.round(tr.width),
    껍데기폭: Math.round(wr.width),
    /* getComputedStyle 의 margin 은 auto 를 쓴 값(px)으로 풀어 준다 —
       가운데인지 오른쪽인지는 실제로 그려진 자리로 재야 한다 */
    왼틈: Math.round(tr.left - wr.left),
    오른틈: Math.round(wr.right - tr.right),
    표시된margin: `${cs.marginLeft}/${cs.marginRight}`,
    행높이: Math.round((t.querySelector('tr') as HTMLElement).getBoundingClientRect().height),
    첫열폭: Math.round(첫칸.getBoundingClientRect().width),
    칸여백: `${칸스.paddingTop} ${칸스.paddingLeft}`,
    세로맞춤: 칸스.verticalAlign,
    글자방향: 칸스.writingMode,
    바탕색: 칸스.backgroundColor,
  }
})

test.describe('표 속성 창', () => {
  test('갈피 넷을 화살표로 오가고 Esc 로 닫힌다 (키보드만으로)', async ({ page }) => {
    await 표문서(page)
    await 칸누르기(page, 0)
    await 창열기(page)

    const tabs = 창(page).locator('.jan-tblprops-tabs button')
    await expect(tabs).toHaveText(['표', '행', '열', '셀'])
    // 열리면 첫 갈피에 초점이 간다 — 마우스 없이 바로 다룰 수 있다
    await expect(tabs.nth(0)).toBeFocused()

    await page.keyboard.press('ArrowRight')
    await expect(tabs.nth(1)).toBeFocused()
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true')
    // 끝에서 한 번 더 누르면 처음으로 돈다
    await page.keyboard.press('ArrowRight')
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('Escape')
    await expect(창(page)).toHaveCount(0)
  })

  test('표 갈피 — 너비와 정렬을 바꾸면 그려진 표가 바뀐다', async ({ page }) => {
    await 표문서(page)
    await 칸누르기(page, 0)
    const 전 = await 표재기(page)

    await 창열기(page, 'table')
    await 창(page).getByRole('button', { name: '50%', exact: true }).click()
    await page.waitForTimeout(300)
    const 반 = await 표재기(page)
    // 껍데기의 절반쯤 — 5% 안으로 맞으면 실제로 물린 것이다
    expect(Math.abs(반.표폭 - 반.껍데기폭 / 2)).toBeLessThan(반.껍데기폭 * 0.05)
    expect(반.표폭).toBeLessThan(전.표폭 * 0.75)

    // 가운데 정렬 — 표가 좁아졌을 때만 눈에 보인다 (양쪽 틈이 같아진다)
    await 창(page).getByRole('button', { name: '가운데', exact: true }).click()
    await page.waitForTimeout(300)
    const 가운데 = await 표재기(page)
    expect(Math.abs(가운데.왼틈 - 가운데.오른틈)).toBeLessThanOrEqual(2)
    expect(가운데.왼틈).toBeGreaterThan(20)

    // 오른쪽 — 오른 틈이 없어지고 왼 틈이 다 간다
    await 창(page).getByRole('button', { name: '오른쪽', exact: true }).click()
    await page.waitForTimeout(300)
    const 오른 = await 표재기(page)
    expect(오른.오른틈).toBeLessThanOrEqual(2)
    expect(오른.왼틈).toBeGreaterThan(가운데.왼틈)

    // 왼쪽 — 반대로
    await 창(page).getByRole('button', { name: '왼쪽', exact: true }).click()
    await page.waitForTimeout(300)
    const 왼 = await 표재기(page)
    expect(왼.왼틈).toBeLessThanOrEqual(2)

    // 「자동」 이면 너비 지정이 풀려 도로 넓어진다
    await 창(page).getByRole('button', { name: '자동', exact: true }).click()
    await page.waitForTimeout(300)
    expect((await 표재기(page)).표폭).toBeGreaterThan(반.표폭)
  })

  test('행 갈피 — 행 높이를 넣으면 그 행이 실제로 그만큼 높아진다', async ({ page }) => {
    await 표문서(page)
    await 칸누르기(page, 0)
    const 전 = await 표재기(page)
    expect(전.행높이).toBeLessThan(70) // 손대기 전에는 한 줄 높이다

    await 창열기(page, 'row')
    await 창(page).locator('#jan-tblprops-h').fill('90')
    await page.waitForTimeout(400)
    const 후 = await 표재기(page)
    expect(Math.abs(후.행높이 - 90)).toBeLessThanOrEqual(2)

    // 창을 닫았다 다시 열면 지금 값이 그대로 보인다 (프롬프트는 늘 빈칸이었다)
    await page.keyboard.press('Escape')
    await 칸누르기(page, 0)
    await 창열기(page, 'row')
    await expect(창(page).locator('#jan-tblprops-h')).toHaveValue('90')

    // 「자동」 이면 지정이 풀려 한 줄 높이로 돌아온다
    await 창(page).getByRole('button', { name: '자동', exact: true }).click()
    await page.waitForTimeout(400)
    expect((await 표재기(page)).행높이).toBeLessThan(70)
  })

  test('열 갈피 — 열 너비를 넣으면 그 열이 실제로 그만큼 넓어진다', async ({ page }) => {
    await 표문서(page)
    await 칸누르기(page, 0)

    await 창열기(page, 'column')
    await 창(page).locator('#jan-tblprops-cw').fill('260')
    await page.waitForTimeout(400)
    expect(Math.abs((await 표재기(page)).첫열폭 - 260)).toBeLessThanOrEqual(4)

    await 창(page).getByRole('button', { name: /지정 지우기/ }).click()
    await page.waitForTimeout(400)
    expect((await 표재기(page)).첫열폭).toBeLessThan(250)
  })

  test('셀 갈피 — 여백·세로 맞춤·글자 방향·음영이 화면에 닿는다', async ({ page }) => {
    await 표문서(page)
    await 칸누르기(page, 0)
    await 창열기(page, 'cell')

    // 여백 — 위아래 14px · 좌우 20px
    await 창(page).getByLabel('위아래 여백').fill('14')
    await page.waitForTimeout(250)
    await 창(page).getByLabel('좌우 여백').fill('20')
    await page.waitForTimeout(300)
    expect((await 표재기(page)).칸여백).toBe('14px 20px')

    // 세로 맞춤 — 아래
    await 창(page).getByRole('button', { name: '아래', exact: true }).click()
    await page.waitForTimeout(250)
    expect((await 표재기(page)).세로맞춤).toBe('bottom')

    // 글자 방향 — 세로쓰기
    await 창(page).getByRole('button', { name: '세로쓰기', exact: true }).click()
    await page.waitForTimeout(250)
    expect((await 표재기(page)).글자방향).toContain('vertical')

    // 음영 — 표준 색 하나를 누르면 그 칸이 칠해진다
    const 칠전 = (await 표재기(page)).바탕색
    await 창(page).locator('.jan-tblfmt-std button').first().click()
    await page.waitForTimeout(250)
    expect((await 표재기(page)).바탕색).not.toBe(칠전)

    // 「기본값」 으로 여백을 되돌린다
    await 창(page).getByRole('button', { name: '기본값', exact: true }).click()
    await page.waitForTimeout(300)
    expect((await 표재기(page)).칸여백).not.toBe('14px 20px')
  })

  test('리본의 「속성」 단추가 이 창을 연다 — 프롬프트가 아니다', async ({ page }) => {
    await 표문서(page)
    await 칸누르기(page, 0)
    // 표에 커서가 들면 상황 탭(표)이 뜬다
    const 표탭 = page.getByRole('tab', { name: '표', exact: true })
    if (await 표탭.count()) await 표탭.first().click()
    await page.getByRole('button', { name: /표 속성 창/ }).first().click()
    await expect(창(page)).toBeVisible()
    await expect(창(page).locator('.jan-tblprops-tabs button')).toHaveCount(4)
  })
})

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 「서식」 탭 = 워드 홈 탭 — 클립보드·글꼴·단락·스타일·편집.
 * 눌러야 나오는 차림표(붙여넣기 갈래·대소문자·밑줄 모양·색판·줄 간격·목록 모양)까지 본다.
 */

async function withText(page: Page, text = 'hello WORLD test. second one') {
  await page.setViewportSize({ width: 1600, height: 950 })
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type(text)
  await page.getByRole('tab', { name: '서식', exact: true }).click()
  await page.waitForTimeout(300)
  return editor
}

/** 첫 문단을 통째로 고른다 */
async function selectLine(page: Page) {
  await page.locator('.ProseMirror p').first().click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')
  await page.waitForTimeout(150)
}

const open = async (page: Page, label: string) => {
  const button = page.locator(`.jan-ribbon-split[aria-label^="${label}"]`)
  const pop = page.locator('.jan-ribbon-dropdown')
  // 누를 때마다 열리고 닫히므로 열렸는지 보고 다시 누른다
  for (let tries = 0; tries < 3 && (await pop.count()) === 0; tries += 1) {
    await button.click()
    await page.waitForTimeout(200)
  }
  await expect(pop).toBeVisible()
}

test.describe('서식 탭 — 워드 홈', () => {
  test('묶음이 워드 홈과 같은 갈래로 나뉜다', async ({ page }) => {
    await withText(page)
    await expect(page.locator('.jan-ribbon-cap')).toHaveText(['클립보드', '글꼴', '단락', '스타일', '편집', '한국어 타이포'])
  })

  test('붙여넣기·선택·스타일 갤러리가 차림표로 열린다', async ({ page }) => {
    await withText(page)
    await open(page, '붙여넣기')
    await expect(page.locator('.jan-ribbon-dropdown button')).toHaveText([
      '원본 서식 유지', '서식 병합 (지금 문단에 맞춤)', '텍스트만 유지', '표로 붙여넣기 (CSV·엑셀)',
    ])
    await page.keyboard.press('Escape')

    await open(page, '선택')
    await expect(page.locator('.jan-ribbon-dropdown button')).toHaveCount(3)
    await page.keyboard.press('Escape')

    await open(page, '스타일 갤러리')
    // 워드의 스타일 갤러리 열다섯 가지 (표준·간격 없음·제목 1~3·부제·강조 셋·인용 둘·참조 둘·책 제목·목록 단락)
    await expect(page.locator('.jan-ribbon-dropdown button')).toHaveCount(15)
  })

  test('대/소문자 바꾸기 다섯 가지', async ({ page }) => {
    const editor = await withText(page, 'hello WORLD test')
    await selectLine(page)
    await open(page, '대/소문자')
    await page.locator('.jan-ribbon-dropdown button', { hasText: '모두 대문자로' }).click()
    await expect(editor).toContainText('HELLO WORLD TEST')

    await selectLine(page)
    await open(page, '대/소문자')
    await page.locator('.jan-ribbon-dropdown button', { hasText: '각 낱말의 첫 글자' }).click()
    await expect(editor).toContainText('HELLO WORLD TEST') // 이미 대문자면 그대로

    await selectLine(page)
    await open(page, '대/소문자')
    await page.locator('.jan-ribbon-dropdown button', { hasText: '모두 소문자로' }).click()
    await expect(editor).toContainText('hello world test')
  })

  test('글꼴 색·문자 음영·문자 테두리는 워드 색판으로 고른다', async ({ page }) => {
    await withText(page)
    await selectLine(page)
    await open(page, '글꼴 색')
    await expect(page.locator('.jan-wcolor-theme button')).toHaveCount(60)
    await page.locator('.jan-wcolor-std button').nth(1).click() // 빨강
    expect(await page.evaluate(() => {
      const el = document.querySelector('.ProseMirror p span[style*="color"]') as HTMLElement
      return el ? getComputedStyle(el).color : ''
    })).toBe('rgb(255, 0, 0)')

    await selectLine(page)
    await open(page, '문자 음영')
    await page.locator('.jan-wcolor-std button').nth(3).click()
    await expect(page.locator('.ProseMirror [data-char-shading]')).toHaveCount(1)

    await selectLine(page)
    await open(page, '문자 테두리')
    await page.locator('.jan-wcolor-std button').nth(7).click()
    await expect(page.locator('.ProseMirror [data-char-border]')).toHaveCount(1)
  })

  test('밑줄 모양을 고른다 (물결선까지)', async ({ page }) => {
    await withText(page)
    await selectLine(page)
    await open(page, '밑줄')
    await page.locator('.jan-ribbon-dropdown button', { hasText: '물결선' }).click()

    const el = page.locator('.ProseMirror [data-underline]')
    await expect(el).toHaveAttribute('data-underline', 'wavy')
    expect(await el.evaluate((e) => getComputedStyle(e).textDecorationStyle)).toBe('wavy')
  })

  test('줄 간격과 단락 앞뒤 공백', async ({ page }) => {
    await withText(page)
    await selectLine(page)
    await open(page, '줄 간격')
    await page.locator('.jan-ribbon-dropdown button', { hasText: '2.0' }).first().click()
    const p = page.locator('.ProseMirror p').first()
    await expect(p).toHaveAttribute('style', /line-height:\s*2/)

    await open(page, '줄 간격')
    await page.locator('.jan-ribbon-dropdown button', { hasText: '단락 앞에 공백 추가' }).click()
    await expect(p).toHaveAttribute('style', /margin-top:\s*12px/)
  })

  test('글머리·번호 모양 라이브러리', async ({ page }) => {
    await withText(page)
    await selectLine(page)
    await open(page, '글머리 기호')
    await page.locator('.jan-ribbon-dropdown button', { hasText: '체크' }).click()
    await expect(page.locator('.ProseMirror ul')).toHaveAttribute('data-bullet', 'check')

    await open(page, '번호 매기기')
    // 「i. ii. iii.」 도 함께 걸리므로 대문자 항목만 고른다
    await page.locator('.jan-ribbon-dropdown button').filter({ hasText: /^I\. II\. III\.$/ }).click()
    await expect(page.locator('.ProseMirror ol')).toHaveAttribute('data-number', 'upper-roman')
  })

  test('단락 음영과 단락 테두리', async ({ page }) => {
    await withText(page)
    await selectLine(page)
    await open(page, '단락 음영')
    await page.locator('.jan-wcolor-std button').nth(4).click()
    await expect(page.locator('.ProseMirror p[data-shading]').first()).toHaveCount(1)

    await open(page, '단락 테두리')
    await page.locator('.jan-ribbon-dropdown button', { hasText: '아래쪽 테두리' }).click()
    await expect(page.locator('.ProseMirror p[data-para-border]').first()).toHaveAttribute('data-para-border', 'bottom')
  })
  test('색판으로 고른 색이 정말 글자에 먹는다 — 리본이 선택을 뺏지 않는다', async ({ page }) => {
    const editor = await withText(page, '색이 먹는지 보는 문장')
    await selectLine(page)

    /* 예전에는 리본 단추가 초점을 가져가면서 고른 글이 풀려,
       색을 골라도 아무 데도 적용되지 않았다 (손으로 눌러 보고서야 드러났다) */
    await open(page, '글꼴 색')
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString() || '')).not.toBe('')

    await page.locator('.jan-wcolor-std button').nth(1).click() // 빨강
    const color = await page.evaluate(() => {
      const el = document.querySelector('.ProseMirror p span[style*="color"]') as HTMLElement
      return el ? getComputedStyle(el).color : ''
    })
    expect(color).toBe('rgb(255, 0, 0)')
    await expect(editor).toContainText('색이 먹는지')
  })

  test('리본이 창보다 넓으면 좌우 화살표로 나머지 묶음을 본다', async ({ page }) => {
    await withText(page)
    await page.setViewportSize({ width: 900, height: 900 })
    await page.waitForTimeout(300)

    const overflows = await page.evaluate(() => {
      const b = document.querySelector('.jan-ribbon-body') as HTMLElement
      return b.scrollWidth > b.clientWidth
    })
    expect(overflows).toBe(true)

    await expect(page.locator('.jan-ribbon-arrow')).toHaveCount(2)
    const before = await page.evaluate(() => (document.querySelector('.jan-ribbon-body') as HTMLElement).scrollLeft)
    await page.locator('.jan-ribbon-arrow.is-right').click()
    await expect.poll(() => page.evaluate(() => (document.querySelector('.jan-ribbon-body') as HTMLElement).scrollLeft))
      .toBeGreaterThan(before)
  })
})

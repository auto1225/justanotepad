import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 글자에 붙는 입력 것들 — 드롭캡(워드) · 덧말(한글) · 강조점(한글) · 글자 겹치기(한글).
 * 리본에서 눌러 넣고, 저장했다 다시 열어도 남아 있어야 한다.
 */

async function freshEditor(page: Page) {
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  return editor
}

/** 「글자 꾸밈」 명령 — 리본에 나와 있으면 그대로, 접혀 있으면 더보기를 열고 누른다 */
async function useTextCommand(page: Page, name: RegExp, owner?: string) {
  await page.getByRole('tab', { name: '텍스트', exact: true }).dispatchEvent('click')
  await page.waitForTimeout(150)

  /* 리본에 그대로 나와 있으면 그 단추를 누른다 (짧은 이름만 보이므로 aria-label 도 본다) */
  const labelled = page.locator('.jan-ribbon-body button')
  const count = await labelled.count()
  for (let i = 0; i < count; i += 1) {
    const aria = await labelled.nth(i).getAttribute('aria-label')
    if (aria && name.test(aria)) { await labelled.nth(i).dispatchEvent('click'); return }
  }

  /* 아니면 그 명령을 담고 있는 대표 단추(▾)를 열고 고른다 —
     아무 단추나 눌러 가며 찾으면 엉뚱한 명령이 실행돼 고른 글이 풀린다 */
  const item = page.locator('.jan-ribbon-dropdown button').filter({ hasText: name }).first()
  if (owner) {
    await page.locator(`.jan-ribbon-body button[aria-label^="${owner}"] .jan-ribbon-caret`).first().dispatchEvent('click')
    await page.waitForTimeout(200)
  }
  for (let tries = 0; tries < 4 && (await item.count()) === 0; tries += 1) {
    const more = page.locator('.jan-ribbon-body button[aria-label$="더보기"]').first()
    if (await more.count()) { await more.dispatchEvent('click'); await page.waitForTimeout(250) }
    else break
  }
  await expect(item).toHaveCount(1)
  await item.dispatchEvent('click')
}

/** 앱의 물음 창에 답한다 (브라우저 기본 prompt 가 아니다) */
async function answerPrompt(page: Page, value: string) {
  const modal = page.locator('.jan-prompt-modal')
  await expect(modal).toBeVisible()
  await modal.locator('input, textarea').first().fill(value)
  await modal.getByRole('button', { name: '확인' }).click()
  // 물음이 잇달아 뜨면 같은 창이 다시 쓰인다 — 사라지길 기다리지 않고 잠깐 쉰다
  await page.waitForTimeout(250)
}

/** 첫 문단의 앞 n 글자를 고른다 */
async function selectFirstChars(page: Page, n: number) {
  await page.evaluate((count) => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement
    pm.focus()
    const text = pm.querySelector('p')?.firstChild
    if (!text) return
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, count)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, n)
  await page.waitForTimeout(150)
}

test.describe('글자 입력 것들', () => {
  test('드롭캡은 첫 글자를 여러 줄 높이로 키운다', async ({ page }) => {
    await freshEditor(page)
    await page.keyboard.type('우주센서를 활용한 도심 주차환경 개선 방법')

    await page.getByRole('tab', { name: '텍스트', exact: true }).dispatchEvent('click')
    await page.locator('.jan-ribbon-body button[aria-label*="첫 문자 장식"]').first().dispatchEvent('click')

    const p = page.locator('.ProseMirror p').first()
    await expect(p).toHaveAttribute('data-dropcap', '3')
    const [normal, first] = await p.evaluate((el) => [
      getComputedStyle(el).fontSize,
      getComputedStyle(el, '::first-letter').fontSize,
    ])
    expect(parseFloat(first)).toBeGreaterThan(parseFloat(normal) * 2.5)

    // 저장했다 다시 열어도 남는다
    await page.waitForTimeout(1200)
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await expect(page.locator('.ProseMirror p').first()).toHaveAttribute('data-dropcap', '3')
  })

  test('강조점은 글자 위에 찍히고 아래로도 옮긴다', async ({ page }) => {
    await freshEditor(page)
    await page.keyboard.type('우주센서 주차 관제')
    await selectFirstChars(page, 4)
    await useTextCommand(page, /강조점: 점/, '강조점')

    const emph = page.locator('.ProseMirror .jan-emph')
    await expect(emph).toHaveCount(1)
    await expect(emph).toHaveText('우주센서')
    const style = await emph.evaluate((el) => getComputedStyle(el).webkitTextEmphasisStyle || '')
    expect(style).toContain('dot')

    await page.waitForTimeout(1200)
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await expect(page.locator('.ProseMirror .jan-emph')).toHaveCount(1)
  })

  test('덧말은 본말 위·아래에 달리고 루비로 남는다', async ({ page }) => {
    await freshEditor(page)
    await page.keyboard.type('센서 관제')
    await selectFirstChars(page, 2)

    await useTextCommand(page, /덧말 넣기 \(루비/, '덧말')
    await answerPrompt(page, '우주')

    const ruby = page.locator('.ProseMirror ruby')
    await expect(ruby).toHaveCount(1)
    await expect(ruby.locator('rt')).toHaveText('우주')
    await expect(ruby).toHaveAttribute('data-pos', 'over')

    await page.waitForTimeout(1200)
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await expect(page.locator('.ProseMirror ruby rt')).toHaveText('우주')
  })

  test('글자 겹치기는 아홉 자까지 한 자리에 포갠다', async ({ page }) => {
    await freshEditor(page)
    await page.keyboard.type('앞 ')

    await useTextCommand(page, /글자 겹치기/)
    await answerPrompt(page, '주차')   // 겹칠 글자
    await answerPrompt(page, 'circle') // 테두리

    const overlap = page.locator('.ProseMirror .jan-overlap')
    await expect(overlap).toHaveCount(1)
    await expect(overlap).toHaveAttribute('data-chars', '주차')
    await expect(overlap.locator('.jan-overlap-ch')).toHaveCount(2)
    // 두 글자가 같은 자리에 겹쳐 있다
    const [a, b] = await overlap.locator('.jan-overlap-ch').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)))
    expect(Math.abs(a - b)).toBeLessThan(3)
  })
})

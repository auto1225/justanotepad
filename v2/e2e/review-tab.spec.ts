import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 검수 탭 — 워드 「검토」 자리.
 * 추적을 켜고 실제로 글을 쳐서 표시가 남는지, 적용·되돌리기가 되는지,
 * 한자·동의어·접근성·단어 개수·편집 제한이 실제로 움직이는지 본다.
 */

async function ready(page: Page, html = '<h1>주차 회의</h1><p>확인이 필요하다</p>') {
  await page.setViewportSize({ width: 1500, height: 940 })
  await page.addInitScript(() => {
    localStorage.setItem('jan-v2-role-onboarded', '1')
    /* 지난 판의 추적 상태·제한이 남아 있으면 시험이 흔들린다 */
    localStorage.removeItem('jan-v2-track-on')
    localStorage.removeItem('jan-v2-track-mode')
    localStorage.setItem('jan-v2-author', '검사원')
    Object.keys(localStorage).filter((k) => k.startsWith('jan-v2-protect')).forEach((k) => localStorage.removeItem(k))
  })
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.evaluate((source) => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement
    pm.focus()
    const dt = new DataTransfer()
    dt.setData('text/html', source)
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, html)
  await expect(editor.locator('h1')).toHaveCount(1)
  await page.waitForTimeout(400)
  await page.locator('.jan-ribbon-tab', { hasText: /^검수$/ }).first().click()
  return editor
}

/** 추적을 켠다 (이미 켜져 있으면 그대로 둔다) */
async function trackOn(page: Page) {
  const off = page.locator('button[aria-label^="변경 내용 추적 켜기"]')
  if (await off.count()) await off.first().click()
  await expect(page.locator('button[aria-label^="변경 내용 추적 끄기"]')).toHaveCount(1)
}

test.describe('검수 탭', () => {
  test('묶음이 워드 「검토」 와 같은 차례로 나뉜다', async ({ page }) => {
    await ready(page)
    const caps = await page.locator('.jan-ribbon-group .jan-ribbon-cap').allInnerTexts()
    expect(caps.slice(0, 8)).toEqual([
      '언어 교정', '소리 · 접근성', '언어', '메모', '변경 내용 추적', '변경 내용', '견주기 · 보호', '감추기 · 기록',
    ])
  })

  test('추적을 켜고 글을 치면 넣은 글에 표시가 남는다', async ({ page }) => {
    const editor = await ready(page)
    await trackOn(page)

    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' 정말로')

    const ins = editor.locator('ins.jan-ins')
    await expect(ins).toHaveCount(1)
    await expect(ins.first()).toContainText('정말로')
    await expect(ins.first()).toHaveAttribute('data-by', '검사원')
  })

  test('추적 중 지운 글은 사라지지 않고 줄이 그어진다', async ({ page }) => {
    const editor = await ready(page)
    await trackOn(page)

    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')

    const del = editor.locator('del.jan-del')
    await expect(del).toHaveCount(1)
    await expect(del.first()).toContainText('필요하다'.slice(-4))
    /* 글자는 그대로 남아 있다 — 표시만 붙었다 */
    await expect(editor.locator('p').first()).toContainText('필요하다')
  })

  test('적용하면 지운 글이 정말 사라지고, 되돌리면 넣은 글이 걷힌다', async ({ page }) => {
    const editor = await ready(page)
    await trackOn(page)

    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')
    await page.keyboard.type('있다')

    await expect(editor.locator('del.jan-del')).toHaveCount(1)
    await expect(editor.locator('ins.jan-ins')).toHaveCount(1)

    // 모두 적용 → 지운 글은 없어지고 넣은 글은 보통 글이 된다
    await page.locator('button[aria-label="이 변경 적용"]').first().click()
    await page.locator('.jan-ribbon-dropdown button.jan-menu-item', { hasText: '모두 적용' }).click()
    await expect(editor.locator('del.jan-del')).toHaveCount(0)
    await expect(editor.locator('ins.jan-ins')).toHaveCount(0)
    await expect(editor.locator('p').first()).toContainText('확인이 있다')
    await expect(editor.locator('p').first()).not.toContainText('필요하다')
  })

  test('모두 되돌리면 문서가 고치기 전으로 돌아온다', async ({ page }) => {
    const editor = await ready(page)
    await trackOn(page)

    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')
    await page.keyboard.type('있다')

    await page.locator('button[aria-label="이 변경 되돌림"]').first().click()
    await page.locator('.jan-ribbon-dropdown button.jan-menu-item', { hasText: '모두 되돌림' }).click()
    await expect(editor.locator('del.jan-del')).toHaveCount(0)
    await expect(editor.locator('ins.jan-ins')).toHaveCount(0)
    await expect(editor.locator('p').first()).toHaveText('확인이 필요하다')
  })

  test('검토 창에 고친 자리가 쌓이고 하나씩 적용된다', async ({ page }) => {
    const editor = await ready(page)
    await trackOn(page)
    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' 그렇다')

    await page.locator('button[aria-label^="검토 창 열기"]').first().click()
    const pane = page.locator('.jan-revpane')
    await expect(pane).toBeVisible()
    await expect(pane.locator('.jan-revpane-row')).toHaveCount(1)
    await expect(pane.locator('.jan-revpane-kind').first()).toHaveText('넣음')

    await pane.locator('button[aria-label="이 변경 적용"]').first().click()
    await expect(pane.locator('.jan-revpane-row')).toHaveCount(0)
    await expect(editor.locator('ins.jan-ins')).toHaveCount(0)
    await expect(editor.locator('p').first()).toContainText('그렇다')
  })

  test('표시 방식을 「고친 뒤 모습」 으로 하면 지운 글이 감춰진다', async ({ page }) => {
    const editor = await ready(page)
    await trackOn(page)
    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')
    await expect(editor.locator('del.jan-del')).toHaveCount(1)

    await page.locator('button[aria-label^="표시 방식"]').first().click()
    const menu = page.locator('.jan-ribbon-dropdown')
    await expect(menu).toBeVisible()
    await menu.locator('button.jan-menu-item', { hasText: '고친 뒤 모습' }).click()
    await expect(editor.locator('del.jan-del').first()).toBeHidden()
    await expect(page.locator('html')).toHaveAttribute('data-jan-track', 'final')

    // 다시 「모든 수정 내용」 으로 돌리면 지운 글이 보인다
    await page.locator('button[aria-label^="표시 방식"]').first().click()
    await page.locator('.jan-ribbon-dropdown button.jan-menu-item', { hasText: '모든 수정 내용' }).click()
    await expect(editor.locator('del.jan-del').first()).toBeVisible()
  })

  test('한자로 바꾸기 — 사전에 하나뿐인 말은 바로 바뀐다', async ({ page }) => {
    const editor = await ready(page)
    /* 「주차」 는 후보가 둘이라 창이 뜨고, 「주차장」 은 하나라 바로 바뀐다 */
    await editor.locator('h1').first().click()
    await page.keyboard.press('Home')
    for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowRight')

    await page.locator('button[aria-label="한자로 바꾸기"]').first().click()
    const dialog = page.locator('.jan-worddlg')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.jan-worddlg-word strong')).toHaveText('주차')
    await expect(dialog.locator('.jan-worddlg-list button').first()).toContainText('駐車')

    // 한글(한자) 모양으로 넣는다
    await dialog.locator('input[aria-label="한글(한자)"]').check()
    await dialog.locator('.jan-worddlg-list button').first().click()
    await expect(editor.locator('h1')).toContainText('주차(駐車)')
  })

  test('동의어 사전은 커서가 짚은 낱말을 바꿔 준다', async ({ page }) => {
    const editor = await ready(page)
    await editor.locator('p').first().click()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')      // 「확인이」 안에 커서만 둔다

    await page.locator('button[aria-label^="동의어 사전"]').first().click()
    const dialog = page.locator('.jan-worddlg')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('점검')
    await dialog.locator('ul[aria-label="비슷한 말"] button', { hasText: '점검' }).click()
    await expect(editor.locator('p').first()).toContainText('점검')
  })

  test('접근성 검사가 설명 없는 그림을 찾고 그 자리에서 고쳐 준다', async ({ page }) => {
    const editor = await ready(page)
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></p>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await expect(editor.locator('img')).toHaveCount(1)

    await page.locator('button[aria-label^="접근성 검사"]').first().click()
    const dialog = page.locator('.jan-a11ydlg')
    await expect(dialog).toBeVisible()
    const row = dialog.locator('.jan-a11ydlg-row', { hasText: '그림에 설명이 없다' })
    await expect(row).toHaveCount(1)

    await row.locator('button', { hasText: '설명 넣기' }).click()
    const prompt = page.locator('.jan-prompt-modal')
    await expect(prompt).toBeVisible()
    await prompt.locator('input, textarea').first().fill('주차장 안내판')
    await prompt.getByRole('button', { name: '확인' }).click()

    await expect(dialog.locator('.jan-a11ydlg-row', { hasText: '그림에 설명이 없다' })).toHaveCount(0)
    await expect(editor.locator('img')).toHaveAttribute('alt', '주차장 안내판')
  })

  test('단어 개수는 공백 없는 글자수와 원고지 매수까지 센다', async ({ page }) => {
    await ready(page)
    await page.locator('button[aria-label^="단어 개수"]').first().click()
    const dialog = page.locator('.jan-countdlg')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('공백 없이')
    await expect(dialog).toContainText('원고지')
    const row = dialog.locator('tr', { hasText: '글자 (공백 없이)' })
    await expect(row.locator('td')).toHaveText('11')      // 주차 회의 + 확인이 필요하다
  })

  test('메모를 바꿔도 새 문서가 온통 「넣음」 으로 물들지 않는다', async ({ page }) => {
    const editor = await ready(page)
    await trackOn(page)
    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' 하나')
    await expect(editor.locator('ins.jan-ins')).toHaveCount(1)

    // 새 메모로 갔다가 돌아온다 — 실어 온 글에는 표시가 붙지 않아야 한다
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(600)
    await expect(editor.locator('ins.jan-ins')).toHaveCount(0)
    await page.locator('.jan-sidebar-item', { hasText: '확인이 필요하다' }).first().click()
    await page.waitForTimeout(800)
    /* 돌아온 문서에는 아까 넣은 표시 하나만 있다 (실어 온 글 전체가 아니라) */
    await expect(editor.locator('ins.jan-ins')).toHaveCount(1)
    await expect(editor.locator('ins.jan-ins').first()).toContainText('하나')
  })

  test('되돌리기는 넣은 글과 표시를 함께 걷는다', async ({ page }) => {
    const editor = await ready(page)
    await trackOn(page)
    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type('추가')
    await expect(editor.locator('ins.jan-ins')).toHaveCount(1)

    await page.keyboard.press('Control+z')
    await expect(editor.locator('ins.jan-ins')).toHaveCount(0)
    await expect(editor.locator('p').first()).toHaveText('확인이 필요하다')
  })

  test('붙여넣은 글에도 넣음 표시가 남는다', async ({ page }) => {
    const editor = await ready(page)
    await trackOn(page)
    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/plain', ' 붙여넣은 문장')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await expect(editor.locator('ins.jan-ins')).toHaveCount(1)
    await expect(editor.locator('ins.jan-ins').first()).toContainText('붙여넣은 문장')
  })

  test('메모만 달기로 잠그면 본문은 못 고치고 메모는 달린다', async ({ page }) => {
    const editor = await ready(page)
    await page.locator('button[aria-label^="편집 제한"]').first().click()
    const dialog = page.locator('.jan-protdlg')
    await dialog.locator('input[aria-label="메모만 달기"]').check()
    await dialog.getByRole('button', { name: '이대로 걸기' }).click()

    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type('막힘')
    await expect(editor.locator('p').first()).toHaveText('확인이 필요하다')

    // 글을 골라 메모를 다는 길은 열려 있다
    await page.keyboard.press('Home')
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.locator('button[aria-label^="새 메모 달기"]').first().click()
    const prompt = page.locator('.jan-prompt-modal')
    await expect(prompt).toBeVisible()
    await prompt.locator('input, textarea').first().fill('여기를 다시 보자')
    await prompt.getByRole('button', { name: '확인' }).click()
    await expect(editor.locator('.jan-comment')).toHaveCount(1)
  })

  test('읽기만으로 잠그면 글이 고쳐지지 않는다', async ({ page }) => {
    const editor = await ready(page)
    await page.locator('button[aria-label^="편집 제한"]').first().click()
    const dialog = page.locator('.jan-protdlg')
    await expect(dialog).toBeVisible()
    await dialog.locator('input[aria-label="읽기만"]').check()
    await dialog.getByRole('button', { name: '이대로 걸기' }).click()

    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type('막혀야 한다')
    await expect(editor.locator('p').first()).toHaveText('확인이 필요하다')

    // 다시 풀면 고칠 수 있다
    await page.locator('button[aria-label^="편집 제한"]').first().click()
    await dialog.locator('input[aria-label="제한 없음"]').check()
    await dialog.getByRole('button', { name: '이대로 걸기' }).click()
    await editor.locator('p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' 이제 된다')
    await expect(editor.locator('p').first()).toContainText('이제 된다')
  })
})

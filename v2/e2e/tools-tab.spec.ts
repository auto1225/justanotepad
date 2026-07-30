import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'

/**
 * 도구 탭 — 창을 열어 만들고 적는 앱 도구 여덟 가지.
 * 열리는지만 보지 않고, 넣고 바꾸고 저장까지 해 본다.
 */

/** 시험용 그림 — 앱에 들어 있는 실제 PNG (64×64) 를 쓴다 */
function fixtureFile(): string {
  return path.join(process.cwd(), 'public', 'icons', 'jan-file-64.png')
}

async function ready(page: Page) {
  await page.setViewportSize({ width: 1500, height: 940 })
  await page.addInitScript(() => {
    localStorage.setItem('jan-v2-role-onboarded', '1')
    /* 포스트잇은 여기서 비우지 않는다 — 이 script 는 새로고침 때도 돌아
       「껐다 켜도 남는가」 를 보는 시험이 스스로 지운 셈이 된다 */
    localStorage.removeItem('jan.v2.meeting-notes.draft')
    localStorage.removeItem('jan-v2-quick-target')
  })
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  return editor
}

async function tool(page: Page, label: string) {
  await page.locator('.jan-ribbon-tab', { hasText: /^도구$/ }).first().click()
  await page.waitForTimeout(200)
  await page.locator(`.jan-ribbon-body button[aria-label^="${label}"]`).first().click()
  await page.waitForTimeout(500)
}

test.describe('도구 탭', () => {
  test('묶음은 만들기와 기록 둘이다', async ({ page }) => {
    await ready(page)
    await page.locator('.jan-ribbon-tab', { hasText: /^도구$/ }).first().click()
    const caps = await page.locator('.jan-ribbon-group .jan-ribbon-cap').allInnerTexts()
    expect(caps).toEqual(['만들기', '기록'])
  })

  test('이미지 변환 — 크기·형식을 고치면 미리보기와 용량이 함께 바뀐다', async ({ page }) => {
    await ready(page)
    await tool(page, '이미지 변환')
    const dialog = page.locator('.jan-imgconv')
    await expect(dialog).toBeVisible()

    await dialog.locator('input[aria-label="바꿀 그림 파일"]').setInputFiles(fixtureFile())
    await expect(dialog.locator('.jan-imgconv-orig')).toContainText('64×64')
    await expect(dialog.locator('.jan-imgconv-view img')).toBeVisible()

    // 비율을 고정한 채 가로를 바꾸면 세로가 따라온다
    await dialog.locator('input[aria-label="가로 픽셀"]').fill('32')
    await expect(dialog.locator('input[aria-label="세로 픽셀"]')).toHaveValue('32')
    await expect(dialog.locator('.jan-imgconv-out')).toContainText('32×32')

    // 형식을 바꾸면 저장 이름도 바뀐다
    await dialog.locator('input[aria-label="JPG"]').check()
    await expect(dialog.locator('.jan-imgconv-name')).toContainText('.jpg')
    await expect(dialog.locator('input[aria-label="화질"]')).toBeVisible()   // 손실 형식만 화질을 묻는다

    await dialog.locator('input[aria-label="PNG"]').check()
    await expect(dialog.locator('.jan-imgconv-name')).toContainText('.png')
  })

  test('이미지 변환 — 문서에 넣고 파일로도 저장한다', async ({ page }) => {
    const editor = await ready(page)
    await tool(page, '이미지 변환')
    const dialog = page.locator('.jan-imgconv')
    await dialog.locator('input[aria-label="바꿀 그림 파일"]').setInputFiles(fixtureFile())
    await expect(dialog.locator('.jan-imgconv-view img')).toBeVisible()

    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: '파일로 저장' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/64px\.(png|webp|jpg)$/)

    await dialog.getByRole('button', { name: '문서에 넣기' }).click()
    await expect(editor.locator('img')).toHaveCount(1)
    await expect(page.locator('.jan-imgconv')).toHaveCount(0)
  })

  test('빠른 메모 — 쓰던 자리에 넣고, 고른 곳을 기억한다', async ({ page }) => {
    const editor = await ready(page)
    await editor.click()
    await page.keyboard.type('앞글 ')

    await tool(page, '빠른 메모')
    const quick = page.locator('.jan-quick')
    await expect(quick).toBeVisible()
    await quick.locator('input[aria-label="쓰던 자리에 넣기"]').check()
    await quick.locator('textarea').fill('여기에 꽂힌다')
    await quick.getByRole('button', { name: '저장' }).click()
    await expect(editor).toContainText('여기에 꽂힌다')

    // 다시 열면 지난번 고른 자리가 그대로다
    await tool(page, '빠른 메모')
    await expect(page.locator('.jan-quick input[aria-label="쓰던 자리에 넣기"]')).toBeChecked()
    await page.keyboard.press('Escape')
  })

  test('포스트잇 — 한 장이 자기 창에 뜨고, 창 안에서 서식까지 쓴다', async ({ page, context }) => {
    await ready(page)
    await page.evaluate(() => localStorage.removeItem('jan-v2-postits'))
    await tool(page, '포스트잇')
    const panel = page.locator('.jan-postit-modal')

    await panel.locator('textarea[aria-label="새 포스트잇 내용"]').fill('첫째 장')
    await panel.getByRole('button', { name: '새 포스트잇 띄우기' }).click()
    await page.waitForTimeout(600)
    await panel.locator('textarea[aria-label="새 포스트잇 내용"]').fill('둘째 장')
    await panel.getByRole('button', { name: '새 포스트잇 띄우기' }).click()
    await page.waitForTimeout(600)

    /* 두 장이 각자 창에 뜬다 (한 창에 몰아넣지 않는다) */
    const wins = context.pages().filter((p) => p !== page)
    expect(wins).toHaveLength(2)

    /* 창 안에 작은 편집기와 서식 단추가 있다 */
    const win = wins[wins.length - 1]
    await expect(win.locator('#pad')).toBeVisible()
    await expect(win.locator('.bar button[data-cmd="bold"]')).toBeVisible()
    await expect(win.locator('.bar button[data-cmd="insertUnorderedList"]')).toBeVisible()

    /* 굵게로 적은 글이 서식째로 저장된다 */
    await win.locator('#pad').click()
    await win.keyboard.press('End')
    await win.locator('.bar button[data-cmd="bold"]').click()
    await win.keyboard.type(' 굵게')
    await win.waitForTimeout(500)
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-postits') || '[]'))
    expect(String(saved[0].html)).toContain('<b>')
    expect(String(saved[0].text)).toContain('굵게')
    expect(saved[0].open).toBe(true)
    expect(typeof saved[0].w).toBe('number')     // 창 크기를 적어 둔다

    /* 목록 카드에 「떠 있음」 표가 붙는다 */
    await expect(panel.locator('.jan-postit-card.is-live')).toHaveCount(2)
  })

  test('포스트잇 — 껐다 켜도 지난번에 띄워 둔 것을 그 자리에 되살린다', async ({ page, context }) => {
    await ready(page)
    await page.evaluate(() => localStorage.removeItem('jan-v2-postits'))
    await tool(page, '포스트잇')
    const panel = page.locator('.jan-postit-modal')
    await panel.locator('textarea[aria-label="새 포스트잇 내용"]').fill('껐다 켜도 남는다')
    await panel.getByRole('button', { name: '새 포스트잇 띄우기' }).click()
    await page.waitForTimeout(700)

    /* 창을 닫고(컴퓨터를 끈 셈) 앱을 다시 연다 */
    for (const w of context.pages().filter((p) => p !== page)) await w.close()
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    const chip = page.locator('.jan-postit-reopen')
    await expect(chip).toBeVisible({ timeout: 8000 })
    await expect(chip).toContainText('1장')
    await chip.getByRole('button', { name: '다시 띄우기' }).click()
    await page.waitForTimeout(900)

    const back = context.pages().filter((p) => p !== page)
    expect(back).toHaveLength(1)
    await expect(back[0].locator('#pad')).toContainText('껐다 켜도 남는다')
  })

  test('포스트잇 — 껍데기 없는 창에 모아 볼 수도 있다', async ({ page }) => {
    await ready(page)
    await page.evaluate(() => localStorage.removeItem('jan-v2-postits'))
    const support = await page.evaluate(() => 'documentPictureInPicture' in window)
    test.skip(!support, '이 브라우저는 껍데기 없는 창(Document PiP)을 못 띄운다')

    await tool(page, '포스트잇')
    const panel = page.locator('.jan-postit-modal')
    await panel.locator('textarea[aria-label="새 포스트잇 내용"]').fill('모아 보기 시험')
    await panel.getByRole('button', { name: '새 포스트잇 띄우기' }).click()
    await page.waitForTimeout(600)
    await panel.getByRole('button', { name: /모아 보기/ }).click()
    await page.waitForTimeout(700)

    const inside = await page.evaluate(() => {
      const w = (window as unknown as { documentPictureInPicture?: { window?: Window | null } }).documentPictureInPicture?.window
      return w ? { notes: w.document.querySelectorAll('.note').length, dots: w.document.querySelectorAll('.note .dot').length } : null
    })
    expect(inside).toMatchObject({ notes: 1, dots: 6 })
  })

  test('강의 노트는 강의 갈래로 열린다 — 지난번 회의 초안이 있어도', async ({ page }) => {
    await ready(page)
    // 먼저 회의 노트를 열어 초안을 남긴다
    await tool(page, '회의 노트')
    let modal = page.locator('.jan-meeting-modal')
    await expect(modal.locator('h3')).toHaveText('회의노트')
    await modal.locator('input[placeholder="제목"]').fill('주차 회의')
    await page.waitForTimeout(400)
    await modal.locator('.jan-modal-close').click()

    // 강의 노트를 누르면 강의로 열려야 한다 (예전에는 초안 때문에 회의로 열렸다)
    await tool(page, '강의 노트')
    modal = page.locator('.jan-meeting-modal')
    await expect(modal.locator('h3')).toHaveText('강의노트')
  })

  test('글자 인식 창은 그림을 받을 채비가 되어 있다', async ({ page }) => {
    await ready(page)
    await tool(page, '글자 인식')
    const modal = page.locator('.jan-ocr-modal')
    await expect(modal).toBeVisible()
    await expect(modal.locator('select')).toBeVisible()          // 언어 고르기
    await expect(modal.locator('input[type="file"]')).toHaveCount(1)
  })

  test('명함·카드 창은 목록과 내보내기를 갖췄다', async ({ page }) => {
    await ready(page)
    await tool(page, '명함')
    const modal = page.locator('.jan-cards-modal')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('button', { name: '명함 추가' })).toBeVisible()
    await expect(modal.getByRole('button', { name: 'CSV' })).toBeVisible()
    await expect(modal.getByRole('button', { name: 'vCard' })).toBeVisible()
  })

  test('그림판은 그리기 도구를 갖추고 문서로 보낸다', async ({ page }) => {
    await ready(page)
    await tool(page, '그림판')
    const modal = page.locator('.jan-paint-modal')
    await expect(modal).toBeVisible()
    await expect(modal.locator('button[aria-label="연필"]')).toBeVisible()
    await expect(modal.locator('button[aria-label="지우개"]')).toBeVisible()
    await expect(modal.locator('canvas').first()).toBeVisible()
  })
})

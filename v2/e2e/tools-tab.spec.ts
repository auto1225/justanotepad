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
    localStorage.removeItem('jan-v2-postits')
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

  test('포스트잇 — 카드에서 글·색을 바로 고치고 메모로 옮긴다', async ({ page }) => {
    const editor = await ready(page)
    await tool(page, '포스트잇')
    const panel = page.locator('.jan-postit-modal')
    await expect(panel).toBeVisible()

    await panel.locator('textarea').first().fill('장 볼 것')
    await panel.getByRole('button', { name: '새 포스트잇 띄우기' }).click()
    await page.waitForTimeout(400)

    const card = panel.locator('.jan-postit-card').first()
    await expect(card).toBeVisible()
    // 카드에서 글을 고치면 그대로 저장된다
    await card.locator('textarea[aria-label="포스트잇 내용"]').fill('장 볼 것 — 우유')
    await page.waitForTimeout(300)
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-postits') || '[]'))
    expect(String(saved[0].text)).toContain('우유')

    // 색도 카드에서 바꾼다
    await card.locator('button[aria-label^="색 바꾸기"]').nth(2).click()
    await page.waitForTimeout(300)
    const recolored = await page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-postits') || '[]'))
    expect(recolored[0].color).not.toBe(saved[0].color)

    // 「메모로」 는 쓰던 자리에 옮긴다
    await card.getByRole('button', { name: '메모로' }).click()
    await page.waitForTimeout(300)
    await expect(editor).toContainText('우유')
  })

  test('포스트잇 — 껍데기 없는 창에 메모지만 뜨고, 거기서 고친 글이 목록에 비친다', async ({ page }) => {
    await ready(page)
    const support = await page.evaluate(() => 'documentPictureInPicture' in window)
    test.skip(!support, '이 브라우저는 껍데기 없는 창(Document PiP)을 못 띄운다')

    await tool(page, '포스트잇')
    const panel = page.locator('.jan-postit-modal')
    await panel.locator('textarea').first().fill('우유 · 계란')
    await panel.getByRole('button', { name: '새 포스트잇 띄우기' }).click()
    await page.waitForTimeout(900)

    /* 뜬 창에는 주소창·탭이 없다 — 우리가 넣은 메모지만 있다 */
    const inside = await page.evaluate(() => {
      const w = (window as unknown as { documentPictureInPicture?: { window?: Window | null } }).documentPictureInPicture?.window
      if (!w) return null
      return {
        notes: w.document.querySelectorAll('.note').length,
        text: (w.document.querySelector('.note textarea') as HTMLTextAreaElement | null)?.value || '',
        dots: w.document.querySelectorAll('.note .dot').length,
      }
    })
    expect(inside).toMatchObject({ notes: 1, text: '우유 · 계란', dots: 6 })

    /* 떠 있는 창에서 고치면 목록과 저장소에 그대로 간다 */
    await page.evaluate(() => {
      const w = (window as unknown as { documentPictureInPicture?: { window?: Window | null } }).documentPictureInPicture?.window
      const ta = w?.document.querySelector('.note textarea') as HTMLTextAreaElement | null
      if (!ta) return
      ta.value = '우유 · 계란 · 빵'
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.waitForTimeout(300)
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-postits') || '[]'))
    expect(String(saved[0].text)).toContain('빵')
    await expect(panel.locator('.jan-postit-card textarea').first()).toHaveValue(/빵/)

    /* 「모두 띄우기」 는 목록에 있는 것을 한 창에 쌓는다 */
    await panel.locator('textarea').first().fill('두 번째')
    await panel.getByRole('button', { name: '새 포스트잇 띄우기' }).click()
    await page.waitForTimeout(700)
    await panel.getByRole('button', { name: '모두 띄우기' }).click()
    await page.waitForTimeout(500)
    const count = await page.evaluate(() => {
      const w = (window as unknown as { documentPictureInPicture?: { window?: Window | null } }).documentPictureInPicture?.window
      return w ? w.document.querySelectorAll('.note').length : 0
    })
    expect(count).toBe(2)
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

import { expect, test } from '@playwright/test'

test.describe('role pack and my tools', () => {
  test('selects roles, opens a tool, and inserts a template', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      localStorage.removeItem('jan-v2-role-tools')
    })
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    await page.getByLabel('내 도구 / 역할 팩').click()
    await expect(page.locator('.jan-rolepack-modal')).toBeVisible()
    await expect(page.getByText('어떻게 쓰실 건가요?')).toBeVisible()

    await page.getByRole('button', { name: /대학생/ }).click()
    await page.getByRole('button', { name: /기획자/ }).click()
    await page.locator('.jan-rolepack-modal').getByRole('button', { name: '적용' }).click()

    await expect(page.getByText('내 도구 모음')).toBeVisible()
    await expect(page.locator('.jan-role-tool-card').filter({ hasText: 'GPA 계산기' })).toBeVisible()
    await page.locator('.jan-role-tool-card').filter({ hasText: 'D-Day' }).click()
    await expect(page.getByText('등록된 D-Day가 없습니다')).toBeVisible()

    await page.getByPlaceholder('이름').fill('QA 마감')
    await page.locator('input[name="date"]').fill('2026-12-31')
    await page.getByRole('button', { name: '+ 추가' }).click()
    await expect(page.getByText('QA 마감')).toBeVisible()

    await page.locator('.jan-rolepack-back').click()
    await page.locator('.jan-rolepack-nav button').filter({ hasText: '템플릿' }).click()
    await page.getByRole('button', { name: 'PRD' }).first().click()
    await expect(page.locator('.ProseMirror').first()).toContainText('PRD')
  })
})

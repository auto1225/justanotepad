import { test, expect } from '@playwright/test'

/**
 * 내 컴퓨터 모델 — 진짜 Ollama 가 쓴 글로 끝까지.
 *
 * ai-local.spec.ts 는 시험이 스스로 띄운 작은 서버가 정해 둔 답을 돌려준다.
 * 그래서 우리 코드가 무엇을 실어 보내는지까지는 보지만, 「진짜 모델이 답하는 데 얼마나 걸리는가」
 * 는 못 본다 — 실제로 그 자리에서 걸렸다. 처음 부르는 모델은 메모리에 올리느라 1~2분이 걸리는데
 * 연결 시험이 30초에 끊어 「답하지 않는다」 고 잘못 알려 주고 있었다.
 *
 * 여기서는 정해 둔 답이 없다. 모델이 그 자리에서 지어낸 글이 미리보기에 서고 메모로 앉는지를 본다.
 * 받아 둔 모델이 없는 컴퓨터에서는 건너뛴다 — 없는 것을 두고 깨졌다고 할 일은 아니다.
 */

const OLLAMA = 'http://127.0.0.1:11434'
let ready = ''   // 받아 둔 모델 이름, 없으면 빈 칸

test.beforeAll(async () => {
  try {
    const r = await fetch(`${OLLAMA}/v1/models`, { signal: AbortSignal.timeout(3000) })
    const body = await r.json() as { data?: Array<{ id?: string }> }
    ready = body.data?.[0]?.id || ''
  } catch {
    ready = ''
  }
})

test('진짜 모델이 쓴 문서가 메모로 앉는다', async ({ page }) => {
  test.skip(!ready, '받아 둔 모델이 없다 — ollama pull qwen2.5:3b 를 한 번 하면 이 시험이 돈다')
  /* 처음 부르는 모델은 메모리에 올리는 데만 1~2분이 걸린다 — 넉넉히 기다린다 */
  test.setTimeout(600000)

  await page.goto('./')
  await page.evaluate(() => {
    localStorage.removeItem('jan-v2-settings')
    localStorage.removeItem('jan-v2-aiwrite-spec')
  })
  await page.reload()
  await page.locator('.ProseMirror').first().waitFor({ state: 'visible' })

  /* 1) 키 없이 내 컴퓨터에서 찾아 잇는다 */
  await page.locator('.jan-ribbon-tab', { hasText: /^AI$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="AI 연결"]').first().click()
  const dlg = page.locator('.jan-aiconn')
  await expect(dlg).toBeVisible()
  await dlg.getByLabel('내 컴퓨터 모델').check()
  await dlg.getByRole('button', { name: '내 컴퓨터에서 찾기' }).click()
  await expect(dlg.locator('.jan-aiconn-found')).toContainText('Ollama', { timeout: 30000 })

  /* 받아 둔 모델을 골라 이었다 — 이름이 비어 있으면 「그런 모델 없다」 만 돌아온다 */
  await expect(dlg.locator('.jan-aiconn-now.is-ready')).toContainText(ready)

  /* 2) 연결 시험 — 첫 부탁이라 모델을 올리는 시간까지 견뎌야 한다 */
  await dlg.getByRole('button', { name: '연결 시험' }).click()
  await expect(dlg.locator('.jan-aiconn-result.is-ok')).toContainText('이어졌다', { timeout: 300000 })
  await dlg.getByRole('button', { name: '닫기' }).first().click()

  /* 3) 문서 자동 작성 — 정해 둔 답이 없다, 모델이 그 자리에서 짓는다 */
  await page.keyboard.press('Alt+j')
  const w = page.locator('.jan-aiwrite')
  await expect(w).toBeVisible()
  await expect(w.locator('.jan-aiwrite-noconn')).toHaveCount(0)
  await w.getByLabel('무엇을 만들까').fill('사내 종이 문서를 줄이기 위한 전자결재 도입')
  await w.getByLabel('읽는 사람').fill('총무팀장')
  await w.getByRole('button', { name: '바로 만들기' }).click()

  const preview = w.locator('.jan-aiwrite-preview')
  await expect(preview).toBeVisible({ timeout: 540000 })

  /* 글월은 부를 때마다 달라진다 — 낱말이 아니라 「문서의 꼴」 을 본다 */
  expect(await preview.locator('h1, h2, h3').count()).toBeGreaterThan(0)
  const text = (await preview.innerText()).trim()
  expect(text.length).toBeGreaterThan(200)
  expect(text).toMatch(/결재|전자/)

  /* 4) 새 메모로 앉히기 — 미리보기에 선 글이 그대로 메모가 된다 */
  await w.getByRole('button', { name: '새 메모로 앉히기' }).click()
  const doc = page.locator('.ProseMirror').first()
  await expect(doc).toContainText(/결재|전자/, { timeout: 20000 })
  expect((await doc.innerText()).trim().length).toBeGreaterThan(200)
})

import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'

/**
 * 내 컴퓨터 모델 — 가로채기 없이 진짜 서버를 두고 처음부터 끝까지.
 *
 * 다른 AI 시험은 부탁을 가로채 정해 둔 답을 돌려주므로 우리 코드까지만 본다.
 * 여기서는 시험이 스스로 작은 서버를 띄운다 (Ollama·LM Studio 와 같은 말투).
 * 그래서 부탁이 정말 소켓을 지나 나가고, 서버가 받은 몸통을 우리가 들여다볼 수 있다 —
 * 찾기 → 이음 → 연결 시험 → 문서 만들기 → 메모로 앉히기 까지 한 줄로 잇는다.
 */

/* 찾기가 두드리는 문들 — 앞에서부터 비어 있는 데 하나를 골라 쓴다.
   (진짜 Ollama 를 켜 둔 컴퓨터에서도 이 시험이 돌아야 한다) */
const PORTS: Array<[number, string]> = [[11434, 'Ollama'], [1234, 'LM Studio'], [8080, 'llama.cpp'], [5001, 'KoboldCpp'], [8000, 'vLLM']]
let kind = ''
const DOC = [
  '<h1>재택근무 확대에 따른 사무공간 재배치 계획</h1>',
  '<h2>1. 요약</h2><p>좌석 이용률이 【확인: 최근 3개월 평균】 로 떨어졌다.</p>',
  '<h2>2. 현황</h2><table><thead><tr><th>층</th><th>좌석</th></tr></thead>',
  '<tbody><tr><td>3층</td><td>120</td></tr></tbody></table>',
  '<h2>3. 권고</h2><ul><li>4층을 반납한다</li></ul>',
].join('')

/** 서버가 받은 부탁의 몸통 — 무엇을 실어 보냈는지 여기서 확인한다 */
const asked: Array<{ model: string; prompt: string }> = []
let server: Server

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const head = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type,authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    }
    if (req.method === 'OPTIONS') { res.writeHead(204, head); res.end(); return }
    if ((req.url || '').endsWith('/models')) {
      res.writeHead(200, head)
      res.end(JSON.stringify({ data: [{ id: 'llama3.1:8b' }, { id: 'qwen2.5:7b' }] }))
      return
    }
    if ((req.url || '').endsWith('/chat/completions')) {
      let raw = ''
      req.on('data', (c) => { raw += c })
      req.on('end', () => {
        const body = JSON.parse(raw || '{}') as { model?: string; messages?: Array<{ content?: string }> }
        const prompt = body.messages?.[0]?.content || ''
        asked.push({ model: body.model || '', prompt })
        res.writeHead(200, head)
        res.end(JSON.stringify({ choices: [{ message: { content: prompt.includes('연결 확인') ? '연결됨' : DOC } }] }))
      })
      return
    }
    res.writeHead(404, head)
    res.end('{}')
  })
  for (const [port, name] of PORTS) {
    const ok = await new Promise<boolean>((done) => {
      server.once('error', () => done(false))
      server.listen(port, () => done(true))
    })
    if (ok) { kind = name; break }
  }
  if (!kind) throw new Error('시험용 모델 서버를 띄울 빈 문이 없다')
})

test.afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()))
})

test('내 컴퓨터 모델을 찾아 잇고, 그 모델로 문서를 만들어 메모로 앉힌다', async ({ page }) => {
  test.setTimeout(90000)
  asked.length = 0
  await page.goto('./')
  await page.evaluate(() => {
    localStorage.removeItem('jan-v2-settings')
    localStorage.removeItem('jan-v2-aiwrite-spec')
  })
  await page.reload()
  await page.locator('.ProseMirror').first().waitFor({ state: 'visible' })

  /* 1) 리본에서 AI 연결을 연다 */
  await page.locator('.jan-ribbon-tab', { hasText: /^AI$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="AI 연결"]').first().click()
  const dlg = page.locator('.jan-aiconn')
  await expect(dlg).toBeVisible()

  /* 2) 키를 넣지 않고 내 컴퓨터에서 찾아 잇는다 */
  await dlg.getByLabel('내 컴퓨터 모델').check()
  await dlg.getByRole('button', { name: '내 컴퓨터에서 찾기' }).click()
  await expect(dlg.locator('.jan-aiconn-found')).toContainText(kind, { timeout: 20000 })
  await expect(dlg.locator('.jan-aiconn-now.is-ready')).toContainText('내 컴퓨터 모델')

  /* 3) 연결 시험 — 진짜 서버가 답한다 */
  await dlg.getByRole('button', { name: '연결 시험' }).click()
  await expect(dlg.locator('.jan-aiconn-result.is-ok')).toContainText('이어졌다', { timeout: 30000 })
  await expect(dlg.locator('.jan-aiconn-result')).toContainText('연결됨')
  expect(asked[0].model).toBe('llama3.1:8b')          // 찾은 모델을 그대로 썼다
  await dlg.getByRole('button', { name: '닫기' }).first().click()

  /* 4) 문서 자동 작성 */
  await page.keyboard.press('Alt+j')
  const w = page.locator('.jan-aiwrite')
  await expect(w).toBeVisible()
  await expect(w.locator('.jan-aiwrite-noconn')).toHaveCount(0)
  await w.getByLabel('무엇을 만들까').fill('재택근무 확대에 따른 사무공간 재배치 계획')
  await w.getByLabel('읽는 사람').fill('경영지원본부장')
  await w.getByRole('button', { name: '바로 만들기' }).click()
  await expect(w.locator('.jan-aiwrite-preview h1')).toBeVisible({ timeout: 60000 })
  await expect(w.locator('.jan-aiwrite-preview table')).toHaveCount(1)

  /* 서버가 받은 지시문에 갈래 · 주제 · 읽는 사람 · 지어내지 말라는 말이 실려 있다 */
  const wrote = asked[1].prompt
  expect(wrote).toContain('업무 보고서')
  expect(wrote).toContain('재택근무 확대')
  expect(wrote).toContain('경영지원본부장')
  expect(wrote).toContain('지어내지 않는다')

  /* 5) 새 메모로 앉히기 — 문서와 제목까지 */
  await w.getByRole('button', { name: '새 메모로 앉히기' }).click()
  const doc = page.locator('.ProseMirror').first()
  await expect(doc).toContainText('사무공간 재배치')
  await expect(doc.locator('table')).toHaveCount(1)
  await expect(page.locator('.jan-memo-tab.is-active .jan-memo-tab-title')).toContainText('재배치')
})

test('첫 안내 창은 쓰고 있는 사람을 덮지 않는다', async ({ page }) => {
  /* 처음 온 사람에게 뜨는 역할 팩 안내가, 열어 둔 창 위로 뛰어들면
     눌러 둔 것이 안 눌리고 까닭도 모른다 — 손을 놓을 때까지 기다려야 한다 */
  await page.goto('./')
  await page.evaluate(() => {
    localStorage.removeItem('jan-v2-role-onboarded')
    localStorage.removeItem('jan-v2-settings')
  })
  await page.reload()
  await page.locator('.ProseMirror').first().waitFor({ state: 'visible' })

  await page.locator('.jan-ribbon-tab', { hasText: /^AI$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="AI 연결"]').first().click()
  await expect(page.locator('.jan-aiconn')).toBeVisible()

  /* 안내가 뜰 만한 시간이 지나도 내 창이 그대로다 */
  await page.waitForTimeout(4000)
  await expect(page.locator('.jan-rolepack-overlay')).toHaveCount(0)
  await expect(page.locator('.jan-aiconn')).toBeVisible()

  /* 창을 닫으면 그제야 안내가 뜬다 */
  await page.locator('.jan-aiconn').getByRole('button', { name: '닫기' }).first().click()
  await expect(page.locator('.jan-rolepack-overlay')).toBeVisible({ timeout: 8000 })
})

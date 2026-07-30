import { test, expect, type Page } from '@playwright/test'

/**
 * AI 연결 · 문서 자동 작성 — 실제로 눌러 보고 확인한다.
 *
 * 진짜 회사 서버를 부르지 않는다. 대신 그 주소로 가는 부탁을 가로채 정해 둔 답을 돌려준다 —
 * 그러면 키 없이도 「눌러서 → 부탁이 나가고 → 받은 것이 문서로 앉는」 전 길을 검증할 수 있다.
 * 가로챈 부탁의 몸통도 들여다본다 (모델 이름과 지시문이 제대로 실려 나가는지).
 */

const ANTHROPIC = 'https://api.anthropic.com/v1/messages'

/** 이 컴퓨터에 적어 둔 것을 지우고 새로 시작한다 */
async function fresh(page: Page) {
  await page.goto('./')
  await page.evaluate(() => {
    localStorage.removeItem('jan-v2-settings')
    localStorage.removeItem('jan-v2-aiwrite-spec')
  })
  await page.reload()
  await page.locator('.ProseMirror').first().waitFor({ state: 'visible' })
}

/** Claude 로 가는 부탁을 가로채 정해 둔 답을 돌려준다 */
async function fakeClaude(page: Page, text: string, seen: string[] = []) {
  await page.route(ANTHROPIC, async (route) => {
    seen.push(route.request().postData() || '')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text }] }),
    })
  })
}

/** AI 연결 창을 연다 — 자리표가 없는 창이라 리본에서 연다 (한 번 하는 일이다) */
async function openConnect(page: Page) {
  await page.locator('.jan-ribbon-tab', { hasText: /^AI$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="AI 연결"]').first().click()
}

/** AI 연결 창을 열고 Claude 를 골라 키를 적어 둔다 (키는 시험용 값이다) */
async function connectClaude(page: Page) {
  await openConnect(page)
  const dlg = page.locator('.jan-aiconn')
  await expect(dlg).toBeVisible()
  await dlg.getByLabel('Claude (Anthropic)').check()
  await dlg.getByLabel('Claude (Anthropic) 키').fill('sk-ant-test-key-for-e2e')
  return dlg
}

test.describe('AI 연결', () => {
  test('창을 열어 제공자를 고르고 키를 넣으면 「이어졌다」 로 바뀐다', async ({ page }) => {
    await fresh(page)
    await openConnect(page)
    const dlg = page.locator('.jan-aiconn')
    await expect(dlg).toBeVisible()

    /* 처음에는 아무것도 안 이어져 있고 시험 단추가 잠겨 있다 */
    await expect(dlg.locator('.jan-aiconn-now')).toContainText('아직 아무것도')
    await expect(dlg.getByRole('button', { name: '연결 시험' })).toBeDisabled()

    /* 다섯 갈래 + 쓰지 않음 */
    await expect(dlg.locator('.jan-aiconn-list > label')).toHaveCount(6)

    await dlg.getByLabel('Claude (Anthropic)').check()
    await expect(dlg.locator('.jan-aiconn-now')).toContainText('키를 아직 안 넣었다')

    await dlg.getByLabel('Claude (Anthropic) 키').fill('sk-ant-test-key-for-e2e')
    /* 키는 가려서 보여 준다 — 통째로 비치지 않는다 */
    await expect(dlg.locator('.jan-aiconn-now')).toContainText('sk-ant-…')
    await expect(dlg.locator('.jan-aiconn-now')).not.toContainText('test-key-for')
    await expect(dlg.locator('.jan-aiconn-now.is-ready')).toBeVisible()
    await expect(dlg.getByRole('button', { name: '연결 시험' })).toBeEnabled()
  })

  test('엉뚱한 칸에 붙여 넣으면 어디 키인지 짚어 준다', async ({ page }) => {
    await fresh(page)
    await openConnect(page)
    const dlg = page.locator('.jan-aiconn')
    await dlg.getByLabel('Claude (Anthropic)').check()
    await dlg.getByLabel('Claude (Anthropic) 키').fill('AIzaSyFakeGoogleKey')
    await expect(dlg.locator('.jan-aiconn-warn')).toContainText('Google')
  })

  test('연결 시험은 진짜로 물어보고 답한 말을 보여 준다', async ({ page }) => {
    await fresh(page)
    const seen: string[] = []
    await fakeClaude(page, '연결됨', seen)
    const dlg = await connectClaude(page)

    await dlg.getByRole('button', { name: '연결 시험' }).click()
    await expect(dlg.locator('.jan-aiconn-result.is-ok')).toContainText('이어졌다')
    await expect(dlg.locator('.jan-aiconn-result')).toContainText('연결됨')

    /* 부탁이 정말 나갔고, 고른 모델이 실려 갔다 */
    expect(seen).toHaveLength(1)
    const body = JSON.parse(seen[0]) as { model: string; messages: Array<{ content: string }> }
    expect(body.model).toMatch(/^claude/)
    expect(body.messages[0].content).toContain('연결 확인')
  })

  test('키가 틀리면 까닭을 그대로 보여 준다 — 「저장했다」 로 넘기지 않는다', async ({ page }) => {
    await fresh(page)
    await page.route(ANTHROPIC, (route) => route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'invalid x-api-key' } }),
    }))
    const dlg = await connectClaude(page)
    await dlg.getByRole('button', { name: '연결 시험' }).click()
    await expect(dlg.locator('.jan-aiconn-result.is-bad')).toContainText('못 이었다')
    await expect(dlg.locator('.jan-aiconn-result')).toContainText('401')
  })

  test('키 지우기를 누르면 적어 둔 것이 사라진다', async ({ page }) => {
    await fresh(page)
    const dlg = await connectClaude(page)
    await dlg.getByRole('button', { name: '키 지우기' }).click()
    await expect(dlg.getByLabel('Claude (Anthropic) 키')).toHaveValue('')
    const saved = await page.evaluate(() => localStorage.getItem('jan-v2-settings') || '')
    expect(saved).not.toContain('sk-ant-test-key')
  })

  test('내 컴퓨터 모델은 키 칸이 없고 서버를 찾아 준다', async ({ page }) => {
    await fresh(page)
    await openConnect(page)
    const dlg = page.locator('.jan-aiconn')
    await dlg.getByLabel('내 컴퓨터 모델').check()
    await expect(dlg.locator('.jan-aiconn-key')).toHaveCount(0)
    await expect(dlg.getByLabel('모델 서버 주소')).toHaveValue('http://localhost:11434/v1')

    /* 켜 둔 것이 있는 것처럼 흉내 내고 찾기를 누른다 */
    await page.route('**/localhost:1234/v1/models', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'qwen2.5-7b' }, { id: 'llama3.1-8b' }] }),
    }))
    await dlg.getByRole('button', { name: '내 컴퓨터에서 찾기' }).click()
    await expect(dlg.locator('.jan-aiconn-found')).toContainText('LM Studio')
    await expect(dlg.getByLabel('LM Studio 모델 고르기')).toBeVisible()
    /* 찾은 것으로 곧바로 이어진다 — 키를 넣은 적이 없다 */
    await expect(dlg.locator('.jan-aiconn-now.is-ready')).toContainText('내 컴퓨터 모델')
  })
})

const FAKE_DOC = [
  '<h1>상반기 고객 이탈 원인 분석</h1>',
  '<h2>1. 요약</h2><p>이탈률이 【확인: 지난해 이탈률】 에서 12%로 올랐다.</p>',
  '<h2>2. 현황</h2>',
  '<table><thead><tr><th>구분</th><th>1분기</th></tr></thead><tbody><tr><td>이탈</td><td>8%</td></tr></tbody></table>',
  '<h2>3. 권고</h2><ul><li>첫 달 안내를 손본다</li></ul>',
].join('')

test.describe('문서 자동 작성', () => {
  test('AI 가 안 이어져 있으면 잇는 길을 알려 준다', async ({ page }) => {
    await fresh(page)
    await page.keyboard.press('Alt+j')
    const dlg = page.locator('.jan-aiwrite')
    await expect(dlg).toBeVisible()
    await expect(dlg.locator('.jan-aiwrite-noconn')).toContainText('이어지지 않았다')
    await dlg.getByRole('button', { name: 'AI 연결 열기' }).click()
    await expect(page.locator('.jan-aiconn')).toBeVisible()
  })

  test('주제 한 줄로 문서를 만들어 표까지 미리 보여 준다', async ({ page }) => {
    await fresh(page)
    const seen: string[] = []
    await fakeClaude(page, FAKE_DOC, seen)
    const conn = await connectClaude(page)
    await conn.getByRole('button', { name: '닫기' }).first().click()

    await page.keyboard.press('Alt+j')
    const dlg = page.locator('.jan-aiwrite')
    await expect(dlg.locator('.jan-aiwrite-noconn')).toHaveCount(0)

    await dlg.getByLabel('무엇을 만들까').fill('상반기 고객 이탈 원인 분석과 대응 방안')
    await dlg.getByLabel('읽는 사람').fill('임원')
    await dlg.getByRole('button', { name: '바로 만들기' }).click()

    /* 미리보기에 제목 · 표 · 목록이 살아 있다 */
    const preview = dlg.locator('.jan-aiwrite-preview')
    await expect(preview.locator('h1')).toHaveText('상반기 고객 이탈 원인 분석')
    await expect(preview.locator('table th').first()).toHaveText('구분')
    await expect(preview.locator('ul li')).toHaveCount(1)
    /* 지어내지 않고 비워 둔 자리를 짚어 준다 */
    await expect(dlg.locator('.jan-aiwrite-frame').last()).toContainText('【확인:')

    /* 나간 지시문에 갈래 · 주제 · 읽는 사람 · 지어내지 말라는 말이 실려 있다 */
    const body = JSON.parse(seen[0]) as { max_tokens: number; messages: Array<{ content: string }> }
    const prompt = body.messages[0].content
    expect(prompt).toContain('업무 보고서')
    expect(prompt).toContain('상반기 고객 이탈')
    expect(prompt).toContain('임원')
    expect(prompt).toContain('지어내지 않는다')
    expect(body.max_tokens).toBeGreaterThan(2000)
  })

  test('목차를 먼저 받아 고쳐 넣으면 그 목차로 본문을 쓴다', async ({ page }) => {
    await fresh(page)
    const seen: string[] = []
    /* 첫 부탁은 목차, 둘째 부탁은 문서 */
    let turn = 0
    await page.route(ANTHROPIC, async (route) => {
      seen.push(route.request().postData() || '')
      const text = turn++ === 0 ? '1. 요약 — 결론 먼저\n2. 현황 — 표\n3. 권고' : FAKE_DOC
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: [{ type: 'text', text }] }),
      })
    })
    const conn = await connectClaude(page)
    await conn.getByRole('button', { name: '닫기' }).first().click()

    await page.keyboard.press('Alt+j')
    const dlg = page.locator('.jan-aiwrite')
    await dlg.getByLabel('무엇을 만들까').fill('고객 이탈 분석')
    await dlg.getByRole('button', { name: '목차부터 보기' }).click()

    const outline = dlg.getByLabel('목차')
    await expect(outline).toHaveValue(/1\. 요약/)
    await outline.fill('1. 요약\n2. 원인\n3. 내가 고친 절')
    /* 목차가 있으면 단추 이름이 바뀐다 */
    await dlg.getByRole('button', { name: '이 목차로 문서 쓰기' }).click()
    await expect(dlg.locator('.jan-aiwrite-preview h1')).toBeVisible()

    /* 둘째 부탁에 내가 고친 목차가 그대로 실려 갔다 */
    expect(seen).toHaveLength(2)
    const second = JSON.parse(seen[1]) as { messages: Array<{ content: string }> }
    expect(second.messages[0].content).toContain('내가 고친 절')
    expect(second.messages[0].content).toContain('아래 목차대로')
  })

  test('다 된 문서를 새 메모로 앉히면 제목까지 붙는다', async ({ page }) => {
    await fresh(page)
    await fakeClaude(page, FAKE_DOC)
    const conn = await connectClaude(page)
    await conn.getByRole('button', { name: '닫기' }).first().click()

    await page.keyboard.press('Alt+j')
    const dlg = page.locator('.jan-aiwrite')
    await dlg.getByLabel('무엇을 만들까').fill('이탈 분석')
    await dlg.getByRole('button', { name: '바로 만들기' }).click()
    await expect(dlg.locator('.jan-aiwrite-preview h1')).toBeVisible()
    await dlg.getByRole('button', { name: '새 메모로 앉히기' }).click()

    /* 창이 닫히고 문서에 그 글이 들어와 있다 */
    await expect(page.locator('.jan-aiwrite')).toHaveCount(0)
    const doc = page.locator('.ProseMirror').first()
    await expect(doc).toContainText('상반기 고객 이탈 원인 분석')
    await expect(doc.locator('table')).toHaveCount(1)
    /* 제목은 문서의 큰 제목을 따른다 — 문서 탭에 그대로 붙는다 */
    await expect(page.locator('.jan-memo-tab.is-active .jan-memo-tab-title'))
      .toContainText('상반기 고객 이탈 원인 분석')
  })

  test('갈래를 고르면 그 갈래의 뼈대로 부탁한다 — 회의록과 강의 노트는 다른 문서다', async ({ page }) => {
    await fresh(page)
    const seen: string[] = []
    await fakeClaude(page, FAKE_DOC, seen)
    const conn = await connectClaude(page)
    await conn.getByRole('button', { name: '닫기' }).first().click()

    await page.keyboard.press('Alt+j')
    const dlg = page.locator('.jan-aiwrite')
    await dlg.getByLabel('문서 갈래').selectOption('lecture')
    await dlg.getByLabel('무엇을 만들까').fill('비전공자를 위한 데이터베이스 기초')
    await dlg.getByRole('button', { name: '바로 만들기' }).click()
    await expect(dlg.locator('.jan-aiwrite-preview')).toBeVisible()

    const prompt = (JSON.parse(seen[0]) as { messages: Array<{ content: string }> }).messages[0].content
    expect(prompt).toContain('강의 노트')
    expect(prompt).toContain('차시')          // 강의에만 있는 뼈대
    expect(prompt).not.toContain('결재를 받고 고객에게 나가는 문서를 쓴다\n\n아래 조건으로 문서 한 벌을 완성한다.\n\n문서 갈래: 업무 보고서')
  })

  test('리본 AI 탭에서 갈래를 골라 바로 열 수 있다', async ({ page }) => {
    await fresh(page)
    await page.locator('.jan-ribbon-tab', { hasText: /^AI$/ }).first().click()
    /* 「문서 자동 작성」 은 몸통(누르면 곧바로 열림)과 ▾(갈래 고르기)로 나뉘어 있다 */
    const btn = page.locator('.jan-ribbon-body button[aria-label="문서 자동 작성"]').first()
    await expect(btn).toBeVisible()
    await btn.locator('.jan-ribbon-caret').click()
    await page.getByRole('menuitem', { name: '회의록' }).click()
    const dlg = page.locator('.jan-aiwrite')
    await expect(dlg).toBeVisible()
    await expect(dlg.getByLabel('문서 갈래')).toHaveValue('meeting')
  })

  test('AI 연결도 리본 AI 탭 끝에 있다', async ({ page }) => {
    await fresh(page)
    await page.locator('.jan-ribbon-tab', { hasText: /^AI$/ }).first().click()
    await page.locator('.jan-ribbon-body button[aria-label="AI 연결"]').first().click()
    await expect(page.locator('.jan-aiconn')).toBeVisible()
  })
})

test.describe('회의 · 강의 노트 — 받아 적은 것으로 문서 세우기', () => {
  /* 받아 적은 글은 말한 순서대로 들어온다 — 그것을 회의록의 순서로 옮기는 것이 이 기능이다 */
  const TALK = '오늘 3분기 출시 일정을 봅니다. 김대리 준비가 2주 늦습니다. 그럼 9월 15일로 미루기로 합니다. 박과장이 고객사에 알리기로 하죠.'
  const NOTES = [
    '<h1>3분기 출시 일정 조정 회의</h1>',
    '<h2>결정 사항</h2><ol><li>출시일을 9월 15일로 미룬다</li></ol>',
    '<h2>할 일</h2><table><thead><tr><th>할 일</th><th>담당</th></tr></thead>',
    '<tbody><tr><td>고객사 통보</td><td>박과장</td></tr></tbody></table>',
  ].join('')

  test('AI 로 회의록 만들기를 누르면 받아 적은 글이 회의록으로 앉는다', async ({ page }) => {
    await fresh(page)
    const seen: string[] = []
    await fakeClaude(page, NOTES, seen)
    const conn = await connectClaude(page)
    await conn.getByRole('button', { name: '닫기' }).first().click()

    /* 도구 탭에서 회의 노트 창을 연다 */
    await page.locator('.jan-ribbon-tab', { hasText: /^도구$/ }).first().click()
    await page.locator('.jan-ribbon-body button[aria-label^="회의 노트"]').first().click()
    const dlg = page.locator('.jan-meeting-modal')
    await expect(dlg).toBeVisible()

    /* 손으로 받아 적는다 (녹음은 이 자리에서 검증하지 않는다 — 마이크가 없다) */
    await dlg.locator('textarea[placeholder^="수동으로"]').fill(TALK)
    await dlg.getByRole('button', { name: '발언 추가' }).click()

    await dlg.getByRole('button', { name: 'AI 로 회의록 만들기' }).click()
    await expect(dlg.locator('.jan-meeting-status')).toContainText('문서로 세워 넣었습니다')

    /* 문서에 결정 사항과 할 일 표가 들어왔다 */
    const doc = page.locator('.ProseMirror').first()
    await expect(doc).toContainText('9월 15일로 미룬다')
    await expect(doc.locator('table')).toHaveCount(1)

    /* 나간 지시문에 회의록의 뼈대와 「지어내지 말라」 가 실려 있다 */
    const prompt = (JSON.parse(seen[0]) as { messages: Array<{ content: string }> }).messages[0].content
    expect(prompt).toContain('회의록')
    expect(prompt).toContain('결정 사항')
    expect(prompt).toContain('지어내지 않는다')
    expect(prompt).toContain('9월 15일')       // 받아 적은 글이 그대로 실려 갔다
  })

  test('AI 가 안 이어져 있으면 그 자리에서 잇게 한다', async ({ page }) => {
    await fresh(page)
    await page.locator('.jan-ribbon-tab', { hasText: /^도구$/ }).first().click()
    await page.locator('.jan-ribbon-body button[aria-label^="회의 노트"]').first().click()
    const dlg = page.locator('.jan-meeting-modal')
    await dlg.locator('textarea[placeholder^="수동으로"]').fill('간단한 회의 기록')
    await dlg.getByRole('button', { name: '발언 추가' }).click()
    await dlg.getByRole('button', { name: 'AI 로 회의록 만들기' }).click()
    await expect(dlg.locator('.jan-meeting-status')).toContainText('AI 가 이어지지 않았습니다')
    await dlg.getByRole('button', { name: 'AI 연결', exact: true }).click()
    await expect(page.locator('.jan-aiconn')).toBeVisible()
  })
})

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 자료 탭 — 워드 「참조」 자리.
 * 목차·미주·인용/참고 문헌·캡션 목차·색인·근거 목차가 실제로 심어지고,
 * 문서가 바뀐 뒤 「고쳐 넣기」 를 누르면 그 자리에서 새로 만들어져야 한다.
 */

async function ready(page: Page, html = '<h1>첫 장</h1><p>본문 하나</p><h2>둘째 절</h2><p>주차 정보가 흐른다</p>') {
  await page.setViewportSize({ width: 1500, height: 940 })
  await page.addInitScript(() => {
    localStorage.setItem('jan-v2-role-onboarded', '1')
    localStorage.removeItem('jan-v2-sources')
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
  await page.waitForTimeout(500)
  await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
  return editor
}

/** 앱의 물음 창에 답한다 */
async function answer(page: Page, value: string) {
  const modal = page.locator('.jan-prompt-modal')
  await expect(modal).toBeVisible()
  await modal.locator('input, textarea').first().fill(value)
  await modal.getByRole('button', { name: '확인' }).click()
  await page.waitForTimeout(250)
}

test.describe('자료 탭', () => {
  test('묶음이 워드 「참조」 와 같은 차례로 나뉜다', async ({ page }) => {
    await ready(page)
    const caps = await page.locator('.jan-ribbon-group .jan-ribbon-cap').allInnerTexts()
    expect(caps).toEqual(['목차', '각주 · 미주', '인용 · 참고 문헌', '캡션 · 참조', '색인 · 근거'])
  })

  test('목차는 제목에서 만들어지고, 제목이 바뀌면 그 자리에서 새로 만들어진다', async ({ page }) => {
    const editor = await ready(page)
    await page.locator('button[aria-label^="목차 넣기"]').first().click()

    const rows = page.locator('.ProseMirror [data-jan-field="toc"]')
    await expect(rows).toHaveCount(3)                    // 머리글 + 제목 둘
    await expect(rows.nth(1)).toContainText('첫 장')

    // 제목을 고치고 다시 누르면 목차가 둘로 늘지 않고 그 자리에서 바뀐다
    await editor.locator('h1').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' 고침')
    await page.locator('button[aria-label^="목차 넣기"]').first().click()
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText('첫 장 고침')
  })

  test('미주는 문서 끝에 모이고 표식이 함께 생긴다', async ({ page }) => {
    const editor = await ready(page)
    await editor.locator('p').last().click()
    await page.keyboard.press('End')
    await page.locator('button[aria-label^="미주 삽입"]').first().click()

    await expect(page.locator('.ProseMirror .jan-en-ref')).toHaveCount(1)
    await expect(page.locator('.ProseMirror [data-jan-field="endnote"]')).toHaveCount(2) // 머리글 + 한 줄
  })

  test('색인은 표시한 말만 모으고 쪽 번호를 붙인다', async ({ page }) => {
    const editor = await ready(page)
    await editor.locator('p').last().click()
    await page.keyboard.press('Home')
    for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowRight')

    await page.locator('button[aria-label^="색인 항목 표시"]').first().click()
    await answer(page, '주차')
    await expect(page.locator('.ProseMirror [data-index]')).toHaveCount(1)

    await page.locator('button[aria-label^="색인 항목 표시"] .jan-ribbon-caret').first().click()
    await page.locator('.jan-ribbon-dropdown button.jan-menu-item', { hasText: '색인 넣기' }).click()
    const rows = page.locator('.ProseMirror [data-jan-field="index"]')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('주차')
  })

  test('출처를 넣으면 인용과 참고 문헌이 그 표기 방식으로 만들어진다', async ({ page }) => {
    await ready(page)
    await page.locator('button[aria-label^="출처 관리"]').first().click()
    const dialog = page.locator('.jan-srcdlg')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: '새 출처' }).click()
    await dialog.locator('input[aria-label="저자"]').fill('홍길동')
    await dialog.locator('input[aria-label="제목"]').fill('레이더 주차 감지')
    await dialog.locator('input[aria-label="연도"]').fill('2026')
    await expect(dialog.locator('.jan-srcdlg-preview')).toContainText('(홍길동, 2026)')   // APA

    // 표기 방식을 IEEE 로 바꾸면 참고 문헌 모양이 번호식으로 바뀐다
    await dialog.locator('select[aria-label="표기 방식"]').selectOption('IEEE')
    await expect(dialog.locator('.jan-srcdlg-preview')).toContainText('[1] 홍길동')

    await dialog.getByRole('button', { name: '참고 문헌 목록 넣기' }).click()
    const bib = page.locator('.ProseMirror [data-jan-field="bib"]')
    await expect(bib).toHaveCount(2)
    await expect(bib.nth(1)).toContainText('레이더 주차 감지')
  })

  test('근거(법령·판례)를 표시하면 근거 목차가 갈래별로 만들어진다', async ({ page }) => {
    const editor = await ready(page)
    await editor.locator('p').first().click()
    await page.keyboard.press('Home')
    for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowRight')

    await page.locator('button[aria-label^="근거 표시"]').first().click()
    await answer(page, '주차장법 제6조')
    await answer(page, '법령')
    await expect(page.locator('.ProseMirror [data-authority]')).toHaveCount(1)

    await page.locator('button[aria-label^="근거 표시"] .jan-ribbon-caret').first().click()
    await page.locator('.jan-ribbon-dropdown button.jan-menu-item', { hasText: '근거 목차 넣기' }).click()
    const rows = page.locator('.ProseMirror [data-jan-field="auth"]')
    await expect(rows.first()).toContainText('근거 목차')
    await expect(rows.filter({ hasText: '주차장법 제6조' })).toHaveCount(1)
  })
})

/**
 * 목차의 쪽 번호 — 워드에서 사람이 가장 먼저 확인하는 자리다.
 *
 * 두 군데가 조용히 틀려 있었다.
 *  하나. 쪽 번호를 <span class="jan-toc-page"> 로 넣었는데 class 는 문서 구조에 없어
 *        저장·재파싱에서 벗겨진다. 그래서 「제1장 제목」 뒤에 숫자가 그대로 달라붙어
 *        «제1장 제목1» 이 되고, 점선(leader)도 함께 사라졌다.
 *  둘.  쪽 번호를 목차를 넣기 「전」 의 화면에서 읽었다. 목차가 차지한 만큼 뒤가 밀리므로
 *        열여섯 제목 가운데 열다섯이 한 쪽씩 어긋났다 — 목차 자신이 만든 오차다.
 */
test.describe('목차의 쪽 번호', () => {
  /** 여러 쪽에 걸치는 문서를 만든다 */
  async function 긴문서(page: Page, 장수 = 16) {
    await page.setViewportSize({ width: 1500, height: 940 })
    await page.addInitScript(() => { localStorage.setItem('jan-v2-role-onboarded', '1') })
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.evaluate((n: number) => {
      const ed = (window as unknown as { __janEditor: { commands: { setContent: (h: string) => void } } }).__janEditor
      const parts: string[] = []
      for (let i = 1; i <= n; i++) {
        parts.push(`<h1>제${i}장</h1>`)
        for (let j = 0; j < 5; j++) parts.push(`<p>${i}-${j} 본문. ` + '가나다라마바사아자차카타파하'.repeat(6) + '</p>')
      }
      ed.commands.setContent(parts.join(''))
    }, 장수)
    await 앉을때까지(page, 3)
    return editor
  }

  /** 쪽 나눔이 앉을 때까지 — 쪽 수가 두 번 연달아 같으면 앉은 것으로 본다 */
  async function 앉을때까지(page: Page, 최소쪽 = 2) {
    await expect(async () => {
      const a = await page.locator('.jan-page-node').count()
      await page.waitForTimeout(600)
      const b = await page.locator('.jan-page-node').count()
      expect(a).toBe(b)
      expect(b).toBeGreaterThanOrEqual(최소쪽)
    }).toPass({ timeout: 40000 })
  }

  /** 제목이 실제로 놓인 쪽과 목차에 적힌 쪽 */
  async function 쪽비교(page: Page) {
    return page.evaluate(() => {
      const root = document.querySelector('.ProseMirror') as HTMLElement
      const pages = [...root.querySelectorAll('[data-jan-page]')]
      const 실제 = [...root.querySelectorAll('h1')].map((h) => pages.indexOf(h.closest('[data-jan-page]')!) + 1)
      const 적힌 = [...root.querySelectorAll('[data-jan-field="toc"] [data-jan-page-num]')]
        .map((s) => Number((s.textContent || '').trim()))
      return { 실제, 적힌, 쪽수: pages.length }
    })
  }

  test('쪽 번호가 제목 글에 달라붙지 않고 제 칸에 앉는다 — 점선이 사이를 채운다', async ({ page }) => {
    await 긴문서(page, 8)
    await page.locator('.ProseMirror').first().click()
    await page.keyboard.press('Control+Home')
    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="목차 넣기"]').first().click()

    const 쪽칸 = page.locator('.ProseMirror [data-jan-field="toc"] [data-jan-page-num]')
    await expect(쪽칸).toHaveCount(8) // 제목 여덟 개

    /* 제목과 번호가 붙어 «제1장1» 이 되면 안 된다 — 사이를 점선이 잇고 번호는 오른쪽 끝에 앉는다 */
    const 사이 = await page.evaluate(() => {
      const row = document.querySelector('.ProseMirror [data-jan-field="toc"] [data-jan-page-num]')!
        .closest('[data-jan-field="toc"]') as HTMLElement
      const 번호 = row.querySelector('[data-jan-page-num]') as HTMLElement
      const 앞 = row.firstElementChild as HTMLElement // 제목 링크
      const cs = getComputedStyle(번호)
      const nr = 번호.getBoundingClientRect()
      return {
        떨어짐: Math.round(nr.left - 앞.getBoundingClientRect().right),
        점선칸너비: Math.round(nr.width),
        점선: cs.borderBottomStyle,
        정렬: cs.textAlign,
        오른끝: Math.round(row.getBoundingClientRect().right - nr.right),
      }
    })
    expect(사이.떨어짐).toBeGreaterThanOrEqual(4)  // 제목 글에 붙어 있지 않다
    expect(사이.점선칸너비).toBeGreaterThan(60)     // 점선이 제목과 번호 사이를 채운다
    expect(사이.점선).toBe('dotted')
    expect(사이.정렬).toBe('right')                // 번호는 그 칸의 오른쪽 끝
    expect(Math.abs(사이.오른끝)).toBeLessThan(3)  // 칸은 줄 오른쪽 끝까지 뻗는다
  })

  test('목차가 밀어낸 쪽까지 셈해 실제 쪽과 맞춘다', async ({ page }) => {
    await 긴문서(page, 16)
    await page.locator('.ProseMirror').first().click()
    await page.keyboard.press('Control+Home')
    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="목차 넣기"]').first().click()

    await expect(async () => {
      const { 실제, 적힌 } = await 쪽비교(page)
      expect(적힌).toHaveLength(실제.length)
      expect(적힌).toEqual(실제)
    }).toPass({ timeout: 40000 })
  })

  /* 이 시험이 지키는 것과 못 지키는 것 — 쪽 칸 노드가 없으면 떨어진다(적힌 쪽이 하나도 안 잡힌다).
     그러나 「쪽 나눔이 앉은 뒤 다시 적기」 를 빼도 통과한다: 고쳐 넣을 때는 목차 줄 수가 그대로라
     목차 자신이 쪽을 밀지 않아 한 걸음만으로도 맞는다. 그 두 걸음째는 위 시험이 지킨다. */
  test('글이 늘어 제목이 뒤로 밀리면 고쳐 넣기가 새 쪽을 적는다', async ({ page }) => {
    const editor = await 긴문서(page, 10)
    await editor.click()
    await page.keyboard.press('Control+Home')
    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="목차 넣기"]').first().click()
    await expect(async () => {
      const { 실제, 적힌 } = await 쪽비교(page)
      expect(적힌).toEqual(실제)
    }).toPass({ timeout: 40000 })

    /* 둘째 장 앞에 한 쪽 분량을 끼워 넣어 뒤 제목을 모두 민다 */
    await page.evaluate(() => {
      const ed = (window as unknown as {
        __janEditor: {
          state: { doc: { descendants: (f: (n: { type: { name: string }; textContent: string }, p: number) => void) => void } }
          chain: () => { focus: () => { setTextSelection: (p: number) => { insertContent: (h: string) => { run: () => void } } } }
        }
      }).__janEditor
      let at = -1
      ed.state.doc.descendants((n, pos) => {
        if (at < 0 && n.type.name === 'heading' && n.textContent.includes('제3장')) at = pos
      })
      ed.chain().focus().setTextSelection(at)
        .insertContent('<p>' + '끼워 넣은 긴 글. 가나다라마바사아자차카타파하'.repeat(60) + '</p>').run()
    })
    await 앉을때까지(page, 4)

    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="목차 넣기"]').first().click()
    await expect(async () => {
      const { 실제, 적힌 } = await 쪽비교(page)
      expect(적힌).toEqual(실제)
    }).toPass({ timeout: 40000 })
  })
})

/**
 * 그림·표 목차는 캡션 라벨을 겹쳐 적지 않는다.
 *
 * 캡션 줄은 «Fig. 1. 첫째 그림» 이다. 목차를 만들 때 앞의 라벨을 «그림|표 n.» 인 줄 알고
 * 벗기려 했으나 실제 라벨은 «Fig. 1.» 이라 하나도 벗겨지지 않았다.
 * 그래서 «그림 1. Fig. 1. 첫째 그림» 처럼 번호가 두 번 적혔다.
 */
test.describe('그림 목차', () => {
  test('캡션 라벨을 벗겨 번호를 한 번만 적는다', async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 940 })
    await page.addInitScript(() => { localStorage.setItem('jan-v2-role-onboarded', '1') })
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    await page.keyboard.type('도입')

    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="캡션 넣기"]').first().click()
    await answer(page, '첫째 그림')
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="캡션 넣기"]').first().click()
    await answer(page, '둘째 그림')

    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="그림 목차"]').first().click()

    const rows = page.locator('.ProseMirror [data-jan-field="figlist"]')
    await expect(rows).toHaveCount(3) // 머리글 + 둘
    await expect(rows.nth(1)).toContainText('첫째 그림')
    /* «그림 1. Fig. 1. 첫째 그림» 이 되면 안 된다 */
    await expect(rows.nth(1)).not.toContainText('Fig.')
    await expect(rows.nth(2)).not.toContainText('Fig.')
    /* 쪽 번호도 글에 달라붙지 않고 제 칸에 있다 */
    await expect(rows.nth(1).locator('[data-jan-page-num]')).toHaveCount(1)
  })
})

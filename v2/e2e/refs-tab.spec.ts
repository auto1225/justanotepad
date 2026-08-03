import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

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
 * 캡션과 상호 참조는 한 벌이어야 한다.
 *
 * 참조 갈래가 두 벌로 따로 놀았다. 상호 참조 창은 image·table 「노드」 만 세고, 캡션(paperTag)은
 * 논문 쪽 번호 매기기가 따로 세었다. 그래서 캡션이 셋 있는 문서에서 창은
 * 「그림 (0) · 표 (0)」 이라고 했다(실측). 워드에서 「참조 대상: 그림」 은 곧 캡션 목록이다.
 *
 * 라벨도 갈라져 있었다 — 캡션은 «Fig. 1.» 인데 그림 목차는 「그림 n.」 이라, 한 문서에 이름이 둘.
 */
test.describe('캡션과 상호 참조', () => {
  /** 캡션 넣기 (그림 · 표) */
  async function 캡션(page: Page, kind: 'figure' | 'table', text: string) {
    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    if (kind === 'figure') {
      await page.locator('button[aria-label^="캡션 넣기"]').first().click()
    } else {
      await page.locator('button[aria-label^="캡션 넣기"] .jan-ribbon-caret').first().click()
      await page.locator('.jan-ribbon-dropdown button.jan-menu-item', { hasText: '표 캡션' }).click()
    }
    await answer(page, text)
    /* 문서 끝으로 — 편집기 한가운데를 누르면 원자 조각(상호 참조)이 통째로 골라져
       다음에 넣는 것이 그것을 지워 버린다. 초점만 주고 자리는 키로 옮긴다 */
    await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).focus())
    await page.keyboard.press('Control+End')
  }

  test('캡션 라벨은 한국어로 적고, 문서 설정으로 바꾸면 이미 있는 캡션도 함께 바뀐다', async ({ page }) => {
    await ready(page)
    await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).focus())
    await page.keyboard.press('Control+End')
    await 캡션(page, 'figure', '첫째 그림')
    await 캡션(page, 'table', '첫째 표')

    const 라벨 = () => page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror [data-paper-tag]')].map((el) => (el.textContent || '').trim()))
    expect(await 라벨()).toEqual(['그림 1.', '표 1.'])

    /* 워드 「캡션 › 레이블」 자리 — 영어로 바꾸면 문서 전체가 함께 바뀐다 */
    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="캡션 넣기"] .jan-ribbon-caret').first().click()
    await page.locator('.jan-ribbon-dropdown button.jan-menu-item', { hasText: '캡션 라벨을 영어로' }).click()
    await expect.poll(라벨).toEqual(['Fig. 1.', 'Table 1.'])

    // 되돌리면 다시 한국어
    await page.locator('button[aria-label^="캡션 넣기"] .jan-ribbon-caret').first().click()
    await page.locator('.jan-ribbon-dropdown button.jan-menu-item', { hasText: '캡션 라벨을 한국어로' }).click()
    await expect.poll(라벨).toEqual(['그림 1.', '표 1.'])
  })

  test('상호 참조 창이 캡션을 대상으로 센다 — 창의 셈과 캡션이 어긋나지 않는다', async ({ page }) => {
    await ready(page)
    await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).focus())
    await page.keyboard.press('Control+End')
    await 캡션(page, 'figure', '첫째 그림')
    await 캡션(page, 'figure', '둘째 그림')
    await 캡션(page, 'table', '첫째 표')

    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="상호 참조"]').first().click()
    const dlg = page.locator('.jan-xrefdlg')
    await expect(dlg).toBeVisible()

    /* 예전에는 「그림 (0) · 표 (0)」 이었다 */
    const 갈래 = await dlg.locator('select').first().locator('option').allInnerTexts()
    expect(갈래).toContain('그림 (2)')
    expect(갈래).toContain('표 (1)')

    await dlg.locator('select').first().selectOption('figure')
    expect(await dlg.locator('.jan-xrefdlg-list button').allInnerTexts())
      .toEqual(['그림 1 — 첫째 그림', '그림 2 — 둘째 그림'])

    // 둘째 그림을 가리키는 참조를 넣는다
    await dlg.locator('.jan-xrefdlg-list button').nth(1).click()
    await dlg.getByRole('button', { name: '넣기' }).click()
    const xref = page.locator('.ProseMirror .jan-xref')
    await expect(xref).toHaveCount(1)
    await expect(xref).toHaveText('그림 2 — 둘째 그림')

    /* 앞에 캡션을 하나 끼워 넣으면 번호가 밀리고 참조도 따라간다 (이미 되던 것을 깨지 않는다).
       커서는 편집기에 직접 놓는다 — 화면을 눌러 옮기면 원자 조각(상호 참조)이 골라져
       다음에 넣는 것이 그것을 지운다 */
    await page.evaluate(() => {
      const ed = (window as unknown as {
        __janEditor: { chain: () => { focus: () => { setTextSelection: (p: number) => { run: () => void } } } }
      }).__janEditor
      ed.chain().focus().setTextSelection(1).run()
    })
    await 캡션(page, 'figure', '맨 앞에 끼운 그림')
    await expect(async () => {
      await expect(xref).toHaveText('그림 3 — 둘째 그림')
    }).toPass({ timeout: 10000 })
  })
})

/**
 * 심어 둔 목록은 스스로 따라가거나, 어긋났다고 눈에 띄게 알려야 한다.
 *
 * 캡션 번호와 본문 참조는 스스로 따라가는데 목차 쪽 번호는 「고쳐 넣기」 를 눌러야만 맞았다
 * (워드 F9 수준). 글이 밀려 제목이 다른 쪽으로 가면 5쪽이라 적힌 제목이 7쪽에 있었다(실측).
 */
test.describe('목차가 스스로 따라간다', () => {
  async function 긴문서(page: Page, 장수: number) {
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
    await page.waitForTimeout(2500)
    return editor
  }

  const 쪽비교 = (page: Page) => page.evaluate(() => {
    const root = document.querySelector('.ProseMirror') as HTMLElement
    const pages = [...root.querySelectorAll('[data-jan-page]')]
    return {
      실제: [...root.querySelectorAll('h1')].map((h) => pages.indexOf(h.closest('[data-jan-page]')!) + 1),
      적힌: [...root.querySelectorAll('[data-jan-field="toc"] [data-jan-page-num]')].map((s) => Number((s.textContent || '').trim())),
    }
  })

  test('글이 늘어 제목이 뒤로 밀리면 목차 쪽 번호가 스스로 따라간다', async ({ page }) => {
    await 긴문서(page, 10)
    await page.locator('.ProseMirror').first().click()
    await page.keyboard.press('Control+Home')
    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="목차 넣기"]').first().click()
    await expect(async () => {
      const { 실제, 적힌 } = await 쪽비교(page)
      expect(적힌).toEqual(실제)
    }).toPass({ timeout: 40000 })

    /* 넣을 때 한 번 도는 「앉으면 다시 적기」 가 완전히 끝나기를 기다린다 —
       그것이 아직 돌고 있으면 이 시험은 새 감시가 없어도 통과해 아무것도 지키지 못한다
       (넣기 시각 기준 최대 24걸음 × 250ms) */
    await page.waitForTimeout(9000)

    /* 제3장 앞에 한 쪽 분량을 끼워 넣어 뒤 제목을 모두 민다 — 아무것도 누르지 않는다 */
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

    await expect(async () => {
      const { 실제, 적힌 } = await 쪽비교(page)
      expect(적힌).toHaveLength(실제.length)
      expect(적힌).toEqual(실제)
      /* 쪽만 밀린 것은 스스로 고쳤으므로 「고쳐야 함」 은 뜨지 않는다 */
      expect(await page.locator('.ProseMirror [data-jan-field="toc"][data-jan-stale]').count()).toBe(0)
    }).toPass({ timeout: 40000 })
  })

  test('제목이 늘면 스스로 고치지 않고 「고쳐 넣기 필요」 를 눈에 띄게 알린다', async ({ page }) => {
    /* 줄을 다시 만드는 일은 문서 크기를 바꾼다 — 조용히 하면 되돌리기가 더럽혀지고
       쪽 나눔이 다시 흔들린다. 워드가 필드에 음영을 깔아 알리는 것과 같은 자리다. */
    await 긴문서(page, 6)
    await page.locator('.ProseMirror').first().click()
    await page.keyboard.press('Control+Home')
    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="목차 넣기"]').first().click()
    const 머리 = page.locator('.ProseMirror [data-jan-field="toc"][data-jan-field-role="head"]')
    await expect(머리).toHaveCount(1)
    await expect(page.locator('.ProseMirror [data-jan-field="toc"][data-jan-stale]')).toHaveCount(0)

    // 제목을 하나 더 만든다 — 줄 수가 달라져 쪽만 고쳐서는 맞지 않는다
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
      ed.chain().focus().setTextSelection(at).insertContent('<h1>새로 넣은 장</h1><p>새 본문</p>').run()
    })
    await expect(page.locator('.ProseMirror [data-jan-field="toc"][data-jan-stale]')).toHaveCount(1, { timeout: 20000 })
    /* 그 알림은 눈에 보여야 한다 (::after 로 붙인 글) */
    const 알림 = await page.evaluate(() => {
      const el = document.querySelector('.ProseMirror [data-jan-field="toc"][data-jan-stale]') as HTMLElement
      const cs = getComputedStyle(el, '::after')
      return { 글: cs.content, 넓이: el.getBoundingClientRect().width }
    })
    expect(알림.글).toContain('고쳐')
    expect(알림.넓이).toBeGreaterThan(0)

    // 「고쳐 넣기」 를 누르면 알림이 사라진다
    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="목차 넣기"]').first().click()
    await expect(page.locator('.ProseMirror [data-jan-field="toc"][data-jan-stale]')).toHaveCount(0, { timeout: 20000 })
  })
})

/**
 * 참고 문헌·미주는 매달린 들여쓰기로 조판된다 (APA·MLA·시카고가 모두 요구한다).
 *
 * 그 조판을 문단 class 에 걸어 두었더니 class 가 저장·재파싱에서 벗겨져 한 번도 걸린 적이
 * 없었다 — 실측으로 text-indent 0px · class null. 목차 쪽 번호와 같은 뿌리다.
 */
test.describe('참고 문헌·미주 조판', () => {
  const 잰다 = (page: Page, kind: string) => page.evaluate((k) =>
    [...document.querySelectorAll(`.ProseMirror [data-jan-field="${k}"]`)].map((el) => {
      const cs = getComputedStyle(el as HTMLElement)
      return { 머리: el.getAttribute('data-jan-field-role') === 'head', 내어쓰기: cs.textIndent, 왼여백: cs.paddingLeft }
    }), kind)

  test('참고 문헌 항목은 둘째 줄부터 들여쓰고, 머리글은 그대로 둔다', async ({ page }) => {
    await ready(page)
    /* ready 가 출처를 비우므로 그 뒤에 넣는다 (넣기 단추가 그때 읽는다) */
    await page.evaluate(() => {
      localStorage.setItem('jan-v2-sources', JSON.stringify([{
        id: 's1', type: 'journal', authors: '홍길동', year: '2026',
        title: '두 줄이 넘도록 길게 적은 제목 — 매달린 들여쓰기가 실제로 걸리는지 보기 위한 항목입니다',
        container: '한국주차학회지', publisher: '', volume: '3', pages: '1-20', url: '', accessed: '',
      }]))
    })
    await page.locator('button[aria-label^="참고 문헌"]').first().click()
    await page.waitForTimeout(400)

    const 줄 = await 잰다(page, 'bib')
    expect(줄).toHaveLength(2)
    expect(줄[0].머리).toBe(true)
    expect(줄[0].내어쓰기).toBe('0px')                      // 머리글은 튀어나오지 않는다
    expect(parseFloat(줄[1].내어쓰기)).toBeLessThan(-10)    // 첫 줄만 내밀고
    expect(parseFloat(줄[1].왼여백)).toBeGreaterThan(10)    // 나머지 줄은 그만큼 들어간다
    expect(parseFloat(줄[1].왼여백)).toBeCloseTo(-parseFloat(줄[1].내어쓰기), 0)
  })

  test('미주도 같은 조판이고, 머리글 위에는 가름줄이 있다', async ({ page }) => {
    const editor = await ready(page)
    await editor.locator('p').last().click()
    await page.keyboard.press('End')
    await page.locator('button[aria-label^="미주 삽입"]').first().click()
    await page.waitForTimeout(400)

    const 줄 = await 잰다(page, 'endnote')
    expect(줄[0].머리).toBe(true)
    expect(parseFloat(줄[1].내어쓰기)).toBeLessThan(-10)
    const 가름줄 = await page.evaluate(() => {
      const el = document.querySelector('.ProseMirror [data-jan-field="endnote"][data-jan-field-role="head"]') as HTMLElement
      return getComputedStyle(el).borderTopWidth
    })
    expect(parseFloat(가름줄)).toBeGreaterThan(0)  // 본문과 미주를 가르는 줄 (워드와 같다)
  })
})

/**
 * 무거운 문서 — 붙박이 강의 노트(9쪽 · 그림 5장 · 제목 20개).
 *
 * 목록을 스스로 맞추는 일은 문서가 바뀔 때마다 도는 일이라, 무거운 문서에서 맴돌면
 * 화면이 통째로 멈춘다. 「맞춘다」 와 「멎는다」 를 한자리에서 함께 본다.
 */
test.describe('무거운 문서에서도 목차가 맞고, 그러면서 멎는다', () => {
  const JAN = path.join(process.cwd(), 'e2e', 'fixtures', 'lecture.jan')

  test('강의 노트에 목차를 넣으면 쪽이 다 맞고, 그 뒤 문서가 조용해진다', async ({ page }) => {
    const bytes = readFileSync(JAN).toString('base64')
    await page.setViewportSize({ width: 1500, height: 940 })
    await page.goto('./')
    await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    /* 파일 고르기 창은 자동화가 못 연다 — 고른 셈 치고 그 뒤 길을 그대로 태운다 */
    await page.addInitScript((b64: string) => {
      ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => {
        const bin = atob(b64)
        const buf = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i)
        const file = new File([buf], '강의 노트.jan')
        return [{ kind: 'file', name: file.name, getFile: async () => file }]
      }
    }, bytes)
    await page.reload()
    const doc = page.locator('.ProseMirror').first()
    await doc.waitFor({ state: 'visible' })
    await page.locator('.jan-ribbon-tab', { hasText: /^파일$/ }).first().click()
    await page.locator('.jan-ribbon-body button[aria-label*="열기"]').first().click()
    await expect(doc.locator('img')).toHaveCount(5, { timeout: 30000 })
    await page.waitForTimeout(9000) // 쪽 나눔이 앉을 틈

    // 문서 맨 앞에 목차를 넣는다
    await page.evaluate(() => {
      const ed = (window as unknown as {
        __janEditor: { chain: () => { focus: () => { setTextSelection: (p: number) => { run: () => void } } } }
      }).__janEditor
      ed.chain().focus().setTextSelection(1).run()
    })
    await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
    await page.locator('button[aria-label^="목차 넣기"]').first().click()

    await expect(async () => {
      const { 실제, 적힌 } = await page.evaluate(() => {
        const root = document.querySelector('.ProseMirror') as HTMLElement
        const pages = [...root.querySelectorAll('[data-jan-page]')]
        const 제목 = [...root.querySelectorAll('h1, h2, h3')].filter((h) => (h.textContent || '').trim())
        return {
          실제: 제목.map((h) => pages.indexOf(h.closest('[data-jan-page]')!) + 1),
          적힌: [...root.querySelectorAll('[data-jan-field="toc"] [data-jan-page-num]')].map((s) => Number((s.textContent || '').trim())),
        }
      })
      expect(적힌.length).toBeGreaterThanOrEqual(20)  // 제목 스무 개가 다 잡혔다
      expect(적힌).toEqual(실제)
    }).toPass({ timeout: 60000 })

    /* 이제 아무도 건드리지 않는다 — 그런데도 문서가 계속 바뀌면 맴도는 것이다
       (쪽 맞추기가 스스로를 다시 부르면 무거운 문서에서 화면이 멈춘다) */
    const seen = await page.evaluate(async () => {
      const editor = (window as unknown as {
        __janEditor: {
          on: (e: string, f: (p: unknown) => void) => void
          off: (e: string, f: (p: unknown) => void) => void
          view: { dom: HTMLElement }
        }
      }).__janEditor
      let 문서변경 = 0
      const onTx = (p: unknown) => {
        if ((p as { transaction: { docChanged: boolean } }).transaction.docChanged) 문서변경 += 1
      }
      editor.on('transaction', onTx)
      await new Promise((r) => setTimeout(r, 5000))
      editor.off('transaction', onTx)
      return { 문서변경, 쪽: editor.view.dom.querySelectorAll('[data-jan-page]').length }
    })
    expect(seen.쪽).toBeGreaterThan(3)
    expect(seen.문서변경).toBeLessThan(5)  // 맴돌면 5초에 수백 번이 된다
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

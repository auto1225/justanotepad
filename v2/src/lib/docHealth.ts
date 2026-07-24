import type { Editor } from '@tiptap/react'

/**
 * 문서 건강 점수 — 일반 문서용 품질 진단 (논문 검사기의 일반화판).
 * 5개 영역 × 20점 = 100점 만점. 영역별 감점 사유와 개선 제안을 함께 제공한다.
 *
 * 영역: 가독성 · 구조 · 링크 무결성 · 미디어 · 백업 안전성
 */

export interface HealthDetail {
  level: 'ok' | 'warn' | 'error'
  text: string
  /** 개선 제안 (있을 때만) */
  fix?: string
}

export interface HealthArea {
  key: string
  label: string
  score: number // 0~20
  details: HealthDetail[]
}

export interface HealthReport {
  total: number // 0~100
  grade: string
  areas: HealthArea[]
}

export const LAST_BACKUP_KEY = 'jan-v2-last-backup'

/** 백업 실행 시각 기록 — JSON 백업/Gist 공유 성공 시 호출 */
export function markBackupDone(): void {
  try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())) } catch {}
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function computeDocHealth(editor: Editor): HealthReport {
  const dom = editor.view.dom
  const fullText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
  const words = fullText.split(/\s+/).filter(Boolean)
  const areas: HealthArea[] = []

  /* ── 1. 가독성 (문장·문단 길이 분포) ── */
  {
    const details: HealthDetail[] = []
    let score = 20
    if (!words.length) {
      score = 0
      details.push({ level: 'warn', text: '내용이 비어 있습니다' })
    } else {
      const sentences = fullText.split(/(?<=[.!?다요음됨])\s+/).map((s) => s.trim()).filter(Boolean)
      const longSentences = sentences.filter((s) => s.split(/\s+/).length > 60)
      if (longSentences.length) {
        const ratio = longSentences.length / Math.max(1, sentences.length)
        score -= clamp(Math.round(ratio * 40), 2, 10)
        details.push({ level: 'warn', text: `60단어를 넘는 문장 ${longSentences.length}개 (${Math.round(ratio * 100)}%)`, fix: '긴 문장은 둘로 나누면 읽기 쉬워집니다' })
      } else {
        details.push({ level: 'ok', text: `문장 길이 양호 (${sentences.length}문장)` })
      }
      const paras = [...dom.querySelectorAll('.ProseMirror > p, p')].map((p) => (p.textContent || '').length)
      const hugeParas = paras.filter((n) => n > 800).length
      if (hugeParas) {
        score -= clamp(hugeParas * 2, 2, 6)
        details.push({ level: 'warn', text: `800자를 넘는 문단 ${hugeParas}개`, fix: '한 문단은 하나의 생각 — 문단을 나누세요' })
      }
      const avgLen = words.length / Math.max(1, sentences.length)
      if (avgLen <= 30) details.push({ level: 'ok', text: `평균 문장 길이 ${Math.round(avgLen)}단어` })
    }
    areas.push({ key: 'read', label: '가독성', score: clamp(score, 0, 20), details })
  }

  /* ── 2. 구조 (제목 계층) ── */
  {
    const details: HealthDetail[] = []
    let score = 20
    const headings = [...dom.querySelectorAll('h1, h2, h3')]
    const levels = headings.map((h) => Number(h.tagName[1]))
    if (!headings.length) {
      if (words.length > 800) {
        score -= 12
        details.push({ level: 'warn', text: `${words.length}단어 문서에 제목이 없습니다`, fix: '제목(H1~H3)을 넣으면 목차·개요·탐색이 살아납니다' })
      } else {
        details.push({ level: 'ok', text: '짧은 문서 — 제목 없어도 무방' })
      }
    } else {
      details.push({ level: 'ok', text: `제목 ${headings.length}개` })
      // 계층 건너뜀 (H1 → H3)
      let skips = 0
      for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) skips++
      if (levels.length && levels[0] > 1) skips++
      if (skips) {
        score -= clamp(skips * 3, 3, 8)
        details.push({ level: 'warn', text: `제목 계층 건너뜀 ${skips}곳 (예: H1 다음 바로 H3)`, fix: '한 단계씩 내려가야 개요가 정확해집니다' })
      }
      // 빈 섹션
      let empty = 0
      headings.forEach((h) => {
        const next = h.nextElementSibling
        if (!next || /^H[1-3]$/.test(next.tagName)) empty++
      })
      if (empty) {
        score -= clamp(empty * 2, 2, 6)
        details.push({ level: 'warn', text: `내용이 비어 있는 섹션 ${empty}개` })
      }
    }
    areas.push({ key: 'structure', label: '구조', score: clamp(score, 0, 20), details })
  }

  /* ── 3. 링크 무결성 ── */
  {
    const details: HealthDetail[] = []
    let score = 20
    const links = [...dom.querySelectorAll('a[href]')]
    const emptyHref = links.filter((a) => {
      const h = a.getAttribute('href') || ''
      return !h || h === '#'
    }).length
    if (emptyHref) {
      score -= clamp(emptyHref * 3, 3, 8)
      details.push({ level: 'error', text: `주소가 빈 링크 ${emptyHref}개`, fix: '링크를 다시 걸거나 서식을 지우세요' })
    }
    // 내부 앵커(#id) → 대상 존재 확인
    const anchors = links.filter((a) => (a.getAttribute('href') || '').startsWith('#') && (a.getAttribute('href') || '').length > 1)
    let brokenAnchor = 0
    anchors.forEach((a) => {
      const id = (a.getAttribute('href') || '').slice(1)
      if (!dom.querySelector(`[id="${CSS.escape(id)}"]`)) brokenAnchor++
    })
    if (brokenAnchor) {
      score -= clamp(brokenAnchor * 3, 3, 8)
      details.push({ level: 'error', text: `깨진 내부 책갈피 링크 ${brokenAnchor}개`, fix: '대상 책갈피가 삭제되었습니다' })
    }
    // 논문 상호참조 무결성
    const targetKeys = new Set<string>()
    dom.querySelectorAll('span[data-paper-tag="eqnum"],span[data-paper-tag="figlabel"],span[data-paper-tag="tablabel"]').forEach((el) => {
      const k = el.getAttribute('data-key'); if (k) targetKeys.add(k)
    })
    let brokenRef = 0
    dom.querySelectorAll('span[data-paper-tag="ref"]').forEach((el) => {
      const k = el.getAttribute('data-key')
      if (!k || !targetKeys.has(k)) brokenRef++
    })
    if (brokenRef) {
      score -= clamp(brokenRef * 3, 3, 8)
      details.push({ level: 'error', text: `깨진 상호참조 ${brokenRef}개`, fix: '논문 메뉴의 "번호 재정렬"을 실행하세요' })
    }
    if (!emptyHref && !brokenAnchor && !brokenRef) {
      details.push({ level: 'ok', text: links.length ? `링크 ${links.length}개 모두 정상` : '링크 없음 — 문제 없음' })
    }
    areas.push({ key: 'links', label: '링크', score: clamp(score, 0, 20), details })
  }

  /* ── 4. 미디어 (캡션·표 헤더) ── */
  {
    const details: HealthDetail[] = []
    let score = 20
    const imgs = [...dom.querySelectorAll('img')]
    if (imgs.length) {
      let noCap = 0
      imgs.forEach((img) => {
        const next = img.closest('p, figure')?.nextElementSibling
        const hasCaption = (next && next.getAttribute('data-paper-block') === 'figcap') || !!img.closest('figure')?.querySelector('figcaption')
        const hasAlt = !!(img.getAttribute('alt') || img.getAttribute('title'))
        if (!hasCaption && !hasAlt) noCap++
      })
      if (noCap) {
        score -= clamp(noCap * 3, 3, 10)
        details.push({ level: 'warn', text: `설명 없는 이미지 ${noCap}/${imgs.length}개`, fix: '캡션이나 설명을 달면 검색·내보내기 품질이 올라갑니다' })
      } else {
        details.push({ level: 'ok', text: `이미지 ${imgs.length}개 모두 설명 있음` })
      }
    } else {
      details.push({ level: 'ok', text: '이미지 없음 — 문제 없음' })
    }
    const tables = [...dom.querySelectorAll('table')]
    const noTh = tables.filter((t) => !t.querySelector('th')).length
    if (noTh) {
      score -= clamp(noTh * 2, 2, 6)
      details.push({ level: 'warn', text: `헤더 행이 없는 표 ${noTh}/${tables.length}개`, fix: '첫 행을 헤더로 지정하면 구조가 명확해집니다' })
    } else if (tables.length) {
      details.push({ level: 'ok', text: `표 ${tables.length}개 모두 헤더 있음` })
    }
    areas.push({ key: 'media', label: '미디어', score: clamp(score, 0, 20), details })
  }

  /* ── 5. 백업 안전성 ── */
  {
    const details: HealthDetail[] = []
    let score = 20
    let last = 0
    try { last = Number(localStorage.getItem(LAST_BACKUP_KEY)) || 0 } catch {}
    if (!last) {
      score -= 10
      details.push({ level: 'warn', text: '백업 기록이 없습니다', fix: '파일 메뉴 → "JSON 백업 내보내기"로 전체 백업을 남기세요' })
    } else {
      const days = (Date.now() - last) / 86400000
      if (days > 7) {
        score -= 8
        details.push({ level: 'warn', text: `마지막 백업 ${Math.floor(days)}일 전`, fix: '일주일에 한 번은 JSON 백업을 권장합니다' })
      } else if (days > 3) {
        score -= 4
        details.push({ level: 'warn', text: `마지막 백업 ${Math.floor(days)}일 전` })
      } else {
        details.push({ level: 'ok', text: days < 1 ? '오늘 백업 완료' : `마지막 백업 ${Math.floor(days)}일 전 — 양호` })
      }
    }
    // 문서 크기 (대용량 dataURL 이미지 내장 경고)
    const htmlLen = editor.getHTML().length
    if (htmlLen > 2_000_000) {
      score -= 6
      details.push({ level: 'warn', text: `문서 크기 ${(htmlLen / 1048576).toFixed(1)}MB — 매우 큽니다`, fix: '큰 이미지는 첨부 파일로 옮기면 속도가 개선됩니다' })
    } else {
      details.push({ level: 'ok', text: `문서 크기 ${htmlLen > 1024 ? (htmlLen / 1024).toFixed(0) + 'KB' : htmlLen + 'B'}` })
    }
    areas.push({ key: 'backup', label: '백업', score: clamp(score, 0, 20), details })
  }

  const total = areas.reduce((s, a) => s + a.score, 0)
  const grade = total >= 90 ? '최상' : total >= 75 ? '양호' : total >= 60 ? '보통' : '주의'
  return { total, grade, areas }
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 건강 점수 리포트 오버레이 */
export function showHealthReport(report: HealthReport): void {
  document.getElementById('jan-doc-health-report')?.remove()
  const wrap = document.createElement('div')
  wrap.id = 'jan-doc-health-report'
  wrap.className = 'jan-modal-overlay'
  const color = report.total >= 90 ? '#2e7d32' : report.total >= 75 ? '#558b2f' : report.total >= 60 ? '#ef6c00' : '#c62828'
  const badge = (lv: HealthDetail['level']) => (lv === 'ok' ? 'OK' : lv === 'warn' ? '주의' : '오류')
  const areaHtml = report.areas.map((a) => {
    const pct = Math.round((a.score / 20) * 100)
    return (
      `<div class="jan-health-area">` +
      `<div class="jan-health-area-head"><span>${escapeHtml(a.label)}</span><span>${a.score}/20</span></div>` +
      `<div class="jan-health-bar"><div class="jan-health-bar-fill" style="width:${pct}%"></div></div>` +
      a.details.map((d) =>
        `<div class="jan-lint-item is-${d.level}"><span class="jan-lint-badge">${badge(d.level)}</span><span>${escapeHtml(d.text)}${d.fix ? `<em class="jan-health-fix">${escapeHtml(d.fix)}</em>` : ''}</span></div>`
      ).join('') +
      `</div>`
    )
  }).join('')
  wrap.innerHTML =
    '<div class="jan-modal jan-lint-modal jan-health-modal" role="dialog" aria-label="문서 건강 점수">' +
    '<div class="jan-modal-head"><h3>문서 건강 점수</h3><button class="jan-modal-close" aria-label="닫기">닫기</button></div>' +
    '<div class="jan-modal-body jan-lint-body">' +
    `<div class="jan-health-score" style="color:${color}"><strong>${report.total}</strong><span>/100 · ${report.grade}</span></div>` +
    areaHtml +
    '</div></div>'
  const close = () => wrap.remove()
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close() })
  wrap.querySelector('.jan-modal-close')?.addEventListener('click', close)
  document.body.appendChild(wrap)
}

import { getStats } from '../lib/analytics'
import { APP_VERSION } from '../lib/version'

interface AboutModalProps {
  onClose: () => void
}

/* 판 번호는 lib/version.ts 한 곳에서만 정한다 */
const VERSION = APP_VERSION

const CHANGELOG: Array<{ ver: string; date: string; items: string[] }> = [
  {
    ver: '2.0.0',
    date: '2026-04',
    items: [
      'Phase 9 — Slash 메뉴, ErrorBoundary, 이미지 드롭/붙여넣기, Auto-save 인디케이터, PWA, 분석',
      'Phase 8 — 멘션, Yjs 협업 UI, Playwright, i18n (ko/en/ja), 체크리스트/콜아웃/임베드, 접근성',
      'Phase 7 — Yjs, KaTeX 수식, Mermaid, 모바일 반응형, Service Worker, lazy load, Vitest',
      'Phase 6 — Markdown IO, 전체 검색, 태그, 다크 모드, 자동 목차, 그림판, 단축키 도움말',
      'Phase 5 — 인쇄 미리보기, AI API, Supabase, 논문 모드, 역할 팩, HWPX, JustPin',
      'Phase 4 — AI 도우미 placeholder, 설정 모달, v1 import, JSON 백업/복원',
      'Phase 3 — 명령 팔레트',
      'Phase 2 — 사이드바, 다중 메모, 번들 분리',
      'Phase 1 — TipTap 마이그레이션 (contenteditable → ProseMirror)',
    ],
  },
]

export function AboutModal({ onClose }: AboutModalProps) {
  const stats = getStats()
  const totalEvents = Object.values(stats.events).reduce((a, b) => a + b, 0)

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>JustANotepad {VERSION}</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <section className="jan-settings-section">
            <h4>버전 정보</h4>
            <div className="jan-settings-info">
              JustANotepad {VERSION} (Beta) — TipTap v3 기반<br />
              <a href="https://justanotepad.com" target="_blank" rel="noopener noreferrer">justanotepad.com</a>
            </div>
          </section>
          <section className="jan-settings-section">
            <h4>이용 통계 (로컬)</h4>
            <div className="jan-settings-info">
              첫 사용: {new Date(stats.firstSeenAt).toLocaleDateString()}<br />
              최근 활동: {stats.lastEventAt ? new Date(stats.lastEventAt).toLocaleString() : '-'}<br />
              총 이벤트: {totalEvents}회<br />
              주요 이벤트: {Object.entries(stats.events).slice(0, 5).map(([k, v]) => `${k}(${v})`).join(', ') || '-'}
            </div>
          </section>
          <section className="jan-settings-section">
            <h4>변경 내역</h4>
            {CHANGELOG.map((c) => (
              <div key={c.ver} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>v{c.ver} · {c.date}</div>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
                  {c.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}

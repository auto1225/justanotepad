import { useMemo, useState } from 'react'
import { useMemosStore } from '../store/memosStore'

interface DiffModalProps {
  onClose: () => void
}

/**
 * Phase 13 — 두 메모/버전 비교 (라인 단위 diff).
 * 좌우 분할 화면 + 색상 강조.
 */
export function DiffModal({ onClose }: DiffModalProps) {
  const memos = useMemosStore((s) => s.memos)
  const memoList = Object.values(memos)
  const [leftId, setLeftId] = useState(memoList[0]?.id || '')
  const [rightId, setRightId] = useState(memoList[1]?.id || memoList[0]?.id || '')

  const left = memos[leftId]
  const right = memos[rightId]

  const diff = useMemo(() => {
    if (!left || !right) return null
    const aLines = plainText(left.content).split('\n')
    const bLines = plainText(right.content).split('\n')
    return computeDiff(aLines, bLines)
  }, [left, right])

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>메모 비교</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-diff-pickers">
            <select value={leftId} onChange={(e) => setLeftId(e.target.value)}>
              {memoList.map((m) => <option key={m.id} value={m.id}>{m.title || '무제'}</option>)}
            </select>
            <span>↔</span>
            <select value={rightId} onChange={(e) => setRightId(e.target.value)}>
              {memoList.map((m) => <option key={m.id} value={m.id}>{m.title || '무제'}</option>)}
            </select>
          </div>
          {diff && (
            <div className="jan-diff-view">
              {diff.map((line, i) => (
                <div key={i} className={'jan-diff-line is-' + line.kind}>
                  <span className="jan-diff-marker">
                    {line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' '}
                  </span>
                  <span className="jan-diff-text">{line.text}</span>
                </div>
              ))}
              {diff.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#999' }}>차이 없음</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function plainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  // 블록 요소 경계를 개행으로 살려야 줄 단위 diff 가 동작한다
  div.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, tr, div').forEach((el) => {
    el.appendChild(document.createTextNode('\n'))
  })
  return (div.textContent || '').replace(/\n{2,}/g, '\n').trim()
}

interface DiffLine {
  kind: 'add' | 'del' | 'same'
  text: string
}

/** 간단한 LCS 기반 라인 diff. */
function computeDiff(a: string[], b: string[]): DiffLine[] {
  const m = a.length, n = b.length
  // dp[i][j] = LCS length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  // backtrack
  const out: DiffLine[] = []
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.unshift({ kind: 'same', text: a[i - 1] })
      i--; j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.unshift({ kind: 'del', text: a[i - 1] })
      i--
    } else {
      out.unshift({ kind: 'add', text: b[j - 1] })
      j--
    }
  }
  while (i > 0) { out.unshift({ kind: 'del', text: a[i - 1] }); i-- }
  while (j > 0) { out.unshift({ kind: 'add', text: b[j - 1] }); j-- }
  return out.filter((l) => l.text.trim() !== '' || l.kind !== 'same')
}

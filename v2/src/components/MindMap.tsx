import { useMemo } from 'react'
import type { Editor } from '@tiptap/react'
import { useMemosStore } from '../store/memosStore'

interface MindMapProps {
  editor: Editor | null
  onClose: () => void
}

interface Node {
  id: string
  text: string
  level: number
  children: Node[]
}

/**
 * Phase 12 — 헤딩 트리 → SVG 마인드맵.
 * H1 = 루트, H2/H3 = 자식 노드. 외부 라이브러리 0.
 */
export function MindMap({ editor, onClose }: MindMapProps) {
  const memoTitle = useMemosStore((s) => s.current()?.title) || ''
  // 훅은 조기 반환보다 먼저 호출돼야 한다 (Rules of Hooks — editor 가 null↔값 사이를
  // 오가면 훅 개수가 달라져 크래시)
  const tree = useMemo(() => {
    if (!editor) return []
    const headings: Array<{ level: number; text: string }> = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') {
        headings.push({
          level: node.attrs.level || 1,
          text: node.textContent || '(빈 제목)',
        })
      }
      return true
    })
    return buildTree(headings)
  }, [editor])

  if (!editor) return null

  if (tree.length === 0) {
    return (
      <div className="jan-modal-overlay" onClick={onClose}>
        <div className="jan-modal jan-mindmap-modal" onClick={(e) => e.stopPropagation()}>
          <div className="jan-modal-head">
            <h3>마인드맵</h3>
            <button className="jan-modal-close" onClick={onClose}>닫기</button>
          </div>
          <div className="jan-modal-body">
            <div className="jan-mindmap-empty">제목 (H1, H2, H3) 이 없습니다. 메모에 헤딩을 추가하세요.</div>
          </div>
        </div>
      </div>
    )
  }

  // 단일 가상 루트 (메모 제목으로 가능, 단순화 — 첫 H1 또는 가상)
  const root: Node = tree.length === 1 ? tree[0] : { id: 'root', text: memoTitle || '메모', level: 0, children: tree }
  const layout = layoutTree(root)

  function downloadSvg() {
    const svg = document.getElementById('jan-mindmap-svg')?.outerHTML
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mindmap.svg'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-mindmap-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>마인드맵 ({countAll(root)} 노드)</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={downloadSvg}>SVG 다운로드</button>
            <button className="jan-modal-close" onClick={onClose}>닫기</button>
          </div>
        </div>
        <div className="jan-modal-body" style={{ overflow: 'auto' }}>
          <svg
            id="jan-mindmap-svg"
            xmlns="http://www.w3.org/2000/svg"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            style={{ background: 'transparent', minWidth: '100%' }}
          >
            {layout.edges.map((e, i) => (
              <path
                key={i}
                d={`M${e.x1},${e.y1} C${e.x1 + 60},${e.y1} ${e.x2 - 60},${e.y2} ${e.x2},${e.y2}`}
                fill="none"
                stroke="#D97757"
                strokeWidth="1.5"
                opacity="0.7"
              />
            ))}
            {layout.nodes.map((n, i) => (
              <g key={i}>
                <rect
                  x={n.x - n.w / 2}
                  y={n.y - 14}
                  width={n.w}
                  height="28"
                  rx="6"
                  ry="6"
                  fill={n.level === 0 ? '#5D4037' : n.level === 1 ? '#D97757' : '#FFB74D'}
                  opacity={n.level === 0 ? 1 : 0.85}
                />
                <text
                  x={n.x}
                  y={n.y + 4}
                  textAnchor="middle"
                  fill="#fff"
                  fontFamily="Noto Sans KR, sans-serif"
                  fontSize="13"
                  fontWeight="600"
                >
                  {trim(n.text, n.level === 0 ? 30 : 24)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}

function buildTree(headings: Array<{ level: number; text: string }>): Node[] {
  const roots: Node[] = []
  const stack: Node[] = []
  let counter = 0
  for (const h of headings) {
    const node: Node = { id: 'h' + counter++, text: h.text, level: h.level, children: [] }
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) stack.pop()
    if (stack.length === 0) roots.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }
  return roots
}

interface LayoutNode {
  x: number
  y: number
  w: number
  level: number
  text: string
}
interface Edge {
  x1: number
  y1: number
  x2: number
  y2: number
}

function layoutTree(root: Node): { nodes: LayoutNode[]; edges: Edge[]; width: number; height: number } {
  const X_GAP = 220
  const Y_GAP = 40
    // 더 단순한 2-pass 구현
  const placed: Array<{ node: Node; x: number; y: number; w: number }> = []
  let _leafY = 30
  function place(n: Node, depth: number): { x: number; y: number } {
    const x = 50 + depth * X_GAP
    let y: number
    if (n.children.length === 0) {
      y = _leafY
      _leafY += Y_GAP
    } else {
      const childYs = n.children.map((c) => place(c, depth + 1).y)
      y = (Math.min(...childYs) + Math.max(...childYs)) / 2
    }
    const w = Math.max(80, Math.min(220, n.text.length * 9 + 24))
    placed.push({ node: n, x, y, w })
    return { x, y }
  }
  place(root, 0)

  // edges
  const finalNodes: LayoutNode[] = placed.map((p) => ({ x: p.x, y: p.y, w: p.w, level: p.node.level, text: p.node.text }))
  const finalEdges: Edge[] = []
  for (const p of placed) {
    for (const c of p.node.children) {
      const cp = placed.find((q) => q.node === c)!
      finalEdges.push({
        x1: p.x + p.w / 2,
        y1: p.y,
        x2: cp.x - cp.w / 2,
        y2: cp.y,
      })
    }
  }

  const maxX = Math.max(...placed.map((p) => p.x + p.w / 2)) + 30
  const maxY = Math.max(...placed.map((p) => p.y)) + 40

  return { nodes: finalNodes, edges: finalEdges, width: maxX, height: maxY }
}

function countAll(n: Node): number {
  return 1 + n.children.reduce((a, c) => a + countAll(c), 0)
}
function trim(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

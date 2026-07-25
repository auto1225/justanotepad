/**
 * 기능 설명 카드에 들어가는 작은 인포그래픽.
 *
 * 글로만 설명하면 처음 보는 사람은 그림이 안 그려진다 —
 * 각 기능이 "화면에서 무슨 일을 하는지" 한 장으로 보여 준다.
 * 모두 인라인 SVG(색은 카드 테마 변수를 따른다).
 */
const W = 220
const H = 96

type ArtProps = { name?: string }

const paper = 'var(--tip-paper, #ffffff)'
const line = 'var(--tip-line, #d8d3e6)'
const ink = 'var(--tip-ink, #3b3550)'
const soft = 'var(--tip-soft, #8d86a8)'
const brand = 'var(--tip-brand, #6C4FD8)'
const warm = 'var(--tip-warm, #D97757)'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-hidden="true" className="jan-help-art">
      <rect x="0" y="0" width={W} height={H} rx="8" fill="var(--tip-bg, #f6f4ff)" />
      {children}
    </svg>
  )
}

/** 종이 한 장 + 글줄 — 여러 그림에서 재사용 */
function Sheet({ x = 12, y = 14, w = 84, h = 68, lines = 4 }: { x?: number; y?: number; w?: number; h?: number; lines?: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="4" fill={paper} stroke={line} />
      {Array.from({ length: lines }, (_, i) => (
        <rect key={i} x={x + 8} y={y + 12 + i * 12} width={w - 16 - (i === lines - 1 ? 18 : 0)} height="4" rx="2" fill={line} />
      ))}
    </>
  )
}

export function HelpArt({ name }: ArtProps) {
  switch (name) {
    case 'palette':
      return (
        <Frame>
          <rect x="26" y="16" width="168" height="64" rx="7" fill={paper} stroke={line} />
          <rect x="36" y="26" width="148" height="14" rx="7" fill="var(--tip-bg, #f1eeff)" />
          <circle cx="45" cy="33" r="4" fill={soft} />
          <rect x="54" y="31" width="58" height="4" rx="2" fill={soft} />
          <rect x="36" y="46" width="148" height="12" rx="3" fill={brand} opacity="0.16" />
          <rect x="42" y="50" width="52" height="4" rx="2" fill={brand} />
          <rect x="36" y="62" width="148" height="10" rx="3" fill="none" />
          <rect x="42" y="65" width="70" height="4" rx="2" fill={line} />
          <text x="150" y="70" fontSize="9" fill={soft}>Ctrl+⇧+P</text>
        </Frame>
      )
    case 'search':
      return (
        <Frame>
          <Sheet x={12} y={16} w={58} h={64} lines={3} />
          <Sheet x={80} y={16} w={58} h={64} lines={3} />
          <Sheet x={148} y={16} w={58} h={64} lines={3} />
          <circle cx="110" cy="52" r="20" fill={paper} stroke={brand} strokeWidth="3" opacity="0.95" />
          <line x1="124" y1="66" x2="140" y2="82" stroke={brand} strokeWidth="4" strokeLinecap="round" />
          <rect x="96" y="50" width="28" height="4" rx="2" fill={warm} />
        </Frame>
      )
    case 'ai':
      return (
        <Frame>
          <Sheet x={14} y={14} w={92} h={68} lines={4} />
          <path d="M120 48h44" stroke={soft} strokeWidth="2" strokeDasharray="4 3" />
          <path d="M164 48l-8-5v10z" fill={soft} />
          <rect x="120" y="14" width="86" height="26" rx="6" fill={brand} opacity="0.14" />
          <rect x="128" y="24" width="46" height="5" rx="2.5" fill={brand} />
          <rect x="120" y="56" width="86" height="26" rx="6" fill={paper} stroke={line} />
          <rect x="128" y="66" width="60" height="5" rx="2.5" fill={line} />
          <path d="M188 20l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill={warm} />
        </Frame>
      )
    case 'quick':
      return (
        <Frame>
          <Sheet x={12} y={14} w={120} h={68} lines={4} />
          <g transform="rotate(-6 168 52)">
            <rect x="138" y="24" width="62" height="58" rx="4" fill="#FFE9A8" stroke="#E3C86A" />
            <rect x="146" y="36" width="42" height="4" rx="2" fill="#B79A45" />
            <rect x="146" y="46" width="34" height="4" rx="2" fill="#B79A45" />
            <rect x="146" y="56" width="38" height="4" rx="2" fill="#B79A45" />
          </g>
        </Frame>
      )
    case 'focus':
      return (
        <Frame>
          <rect x="8" y="10" width="204" height="76" rx="6" fill={ink} opacity="0.82" />
          <rect x="64" y="18" width="92" height="60" rx="4" fill={paper} />
          <rect x="74" y="30" width="72" height="4" rx="2" fill={line} />
          <rect x="74" y="40" width="72" height="4" rx="2" fill={line} />
          <rect x="74" y="50" width="52" height="4" rx="2" fill={line} />
          <rect x="74" y="60" width="62" height="4" rx="2" fill={line} />
        </Frame>
      )
    case 'roles':
      return (
        <Frame>
          <rect x="70" y="30" width="80" height="52" rx="7" fill={brand} opacity="0.16" stroke={brand} />
          <path d="M96 30v-6a14 14 0 0 1 28 0v6" fill="none" stroke={brand} strokeWidth="3" />
          <rect x="86" y="46" width="20" height="20" rx="4" fill={paper} stroke={line} />
          <rect x="114" y="46" width="20" height="20" rx="4" fill={paper} stroke={line} />
          <rect x="92" y="53" width="8" height="3" rx="1.5" fill={warm} />
          <rect x="120" y="53" width="8" height="3" rx="1.5" fill={warm} />
          <text x="20" y="56" fontSize="10" fill={soft}>교사</text>
          <text x="176" y="56" fontSize="10" fill={soft}>연구</text>
        </Frame>
      )
    case 'theme':
      return (
        <Frame>
          <rect x="18" y="18" width="88" height="60" rx="6" fill={paper} stroke={line} />
          <circle cx="62" cy="48" r="13" fill="#F6C94A" />
          <rect x="114" y="18" width="88" height="60" rx="6" fill="#2B2740" />
          <path d="M164 38a12 12 0 1 0 10 18 14 14 0 0 1-10-18z" fill="#E9E4FF" />
        </Frame>
      )
    case 'settings':
      return (
        <Frame>
          <circle cx="110" cy="48" r="22" fill="none" stroke={brand} strokeWidth="3" />
          <circle cx="110" cy="48" r="7" fill={brand} opacity="0.35" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4
            return <rect key={i} x={108} y={18} width="4" height="8" rx="2" fill={brand} transform={`rotate(${(a * 180) / Math.PI} 110 48)`} />
          })}
          <rect x="24" y="34" width="52" height="5" rx="2.5" fill={line} />
          <rect x="24" y="48" width="40" height="5" rx="2.5" fill={line} />
          <rect x="24" y="62" width="46" height="5" rx="2.5" fill={line} />
        </Frame>
      )
    case 'account':
      return (
        <Frame>
          <circle cx="64" cy="40" r="14" fill={brand} opacity="0.3" />
          <path d="M44 74a20 20 0 0 1 40 0z" fill={brand} opacity="0.3" />
          <rect x="104" y="26" width="96" height="46" rx="6" fill={paper} stroke={line} />
          <rect x="114" y="38" width="52" height="5" rx="2.5" fill={line} />
          <rect x="114" y="52" width="34" height="5" rx="2.5" fill={line} />
          <path d="M96 48h20" stroke={soft} strokeWidth="2" strokeDasharray="4 3" />
        </Frame>
      )
    case 'more':
      return (
        <Frame>
          <rect x="60" y="20" width="100" height="58" rx="7" fill={paper} stroke={line} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx="76" cy={34 + i * 16} r="4" fill={brand} opacity="0.5" />
              <rect x="88" y={32 + i * 16} width="56" height="4" rx="2" fill={line} />
            </g>
          ))}
        </Frame>
      )
    case 'paint':
      return (
        <Frame>
          <rect x="16" y="14" width="132" height="68" rx="5" fill={paper} stroke={line} />
          <path d="M30 68c18-26 34-8 48-26s28-6 40-16" fill="none" stroke={warm} strokeWidth="4" strokeLinecap="round" />
          <path d="M168 24l24 24-10 10-24-24z" fill={brand} opacity="0.28" />
          <path d="M158 34l14 14-16 6 2-20z" fill={brand} />
        </Frame>
      )
    case 'ocr':
      return (
        <Frame>
          <rect x="14" y="18" width="80" height="60" rx="5" fill="#EFE9FF" stroke={line} />
          <circle cx="38" cy="38" r="7" fill="#F6C94A" />
          <path d="M20 70l22-20 16 14 14-10 16 16z" fill={brand} opacity="0.35" />
          <path d="M104 48h26" stroke={soft} strokeWidth="2" strokeDasharray="4 3" />
          <path d="M130 48l-8-5v10z" fill={soft} />
          <rect x="140" y="18" width="66" height="60" rx="5" fill={paper} stroke={line} />
          {[0, 1, 2, 3].map((i) => <rect key={i} x="148" y={30 + i * 12} width={i === 3 ? 30 : 50} height="4" rx="2" fill={line} />)}
        </Frame>
      )
    case 'postit':
      return (
        <Frame>
          <rect x="16" y="16" width="120" height="64" rx="5" fill={paper} stroke={line} />
          <rect x="26" y="28" width="80" height="4" rx="2" fill={line} />
          <rect x="26" y="40" width="94" height="4" rx="2" fill={line} />
          <g transform="rotate(8 172 48)">
            <rect x="142" y="22" width="60" height="56" rx="3" fill="#FFE9A8" stroke="#E3C86A" />
            <circle cx="172" cy="22" r="5" fill={warm} />
            <rect x="150" y="38" width="40" height="4" rx="2" fill="#B79A45" />
            <rect x="150" y="48" width="30" height="4" rx="2" fill="#B79A45" />
          </g>
        </Frame>
      )
    case 'share':
      return (
        <Frame>
          <Sheet x={14} y={16} w={80} h={64} lines={3} />
          <circle cx="140" cy="30" r="9" fill={brand} opacity="0.35" />
          <circle cx="140" cy="66" r="9" fill={brand} opacity="0.35" />
          <circle cx="186" cy="48" r="9" fill={brand} />
          <path d="M148 34l30 10M148 62l30-10" stroke={soft} strokeWidth="2" />
          <path d="M100 48h28" stroke={soft} strokeWidth="2" strokeDasharray="4 3" />
        </Frame>
      )
    case 'sync':
      return (
        <Frame>
          <Sheet x={14} y={20} w={70} h={58} lines={3} />
          <rect x="136" y="20" width="70" height="58" rx="4" fill={paper} stroke={line} />
          {[0, 1, 2].map((i) => <rect key={i} x="146" y={32 + i * 12} width={i === 2 ? 30 : 50} height="4" rx="2" fill={line} />)}
          <path d="M96 40h28l-6-6M124 58H96l6 6" stroke={brand} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Frame>
      )
    case 'help':
      return (
        <Frame>
          <circle cx="110" cy="48" r="26" fill={brand} opacity="0.14" />
          <text x="110" y="60" fontSize="34" fontWeight="700" textAnchor="middle" fill={brand}>?</text>
          <rect x="20" y="70" width="46" height="5" rx="2.5" fill={line} />
          <rect x="154" y="70" width="46" height="5" rx="2.5" fill={line} />
        </Frame>
      )
    case 'web':
      return (
        <Frame>
          <circle cx="60" cy="48" r="26" fill="none" stroke={brand} strokeWidth="2.5" />
          <ellipse cx="60" cy="48" rx="12" ry="26" fill="none" stroke={brand} strokeWidth="2" />
          <path d="M34 48h52M38 34h44M38 62h44" stroke={brand} strokeWidth="1.6" />
          <path d="M96 48h24" stroke={soft} strokeWidth="2" strokeDasharray="4 3" />
          <Sheet x={128} y={18} w={78} h={60} lines={3} />
        </Frame>
      )
    case 'cards':
      return (
        <Frame>
          <g transform="rotate(-7 78 50)">
            <rect x="24" y="28" width="92" height="52" rx="5" fill={paper} stroke={line} />
            <circle cx="46" cy="46" r="8" fill={brand} opacity="0.3" />
            <rect x="60" y="42" width="44" height="4" rx="2" fill={line} />
            <rect x="60" y="52" width="34" height="4" rx="2" fill={line} />
          </g>
          <rect x="120" y="22" width="88" height="56" rx="5" fill={paper} stroke={brand} />
          <rect x="130" y="36" width="48" height="5" rx="2.5" fill={brand} opacity="0.6" />
          <rect x="130" y="48" width="62" height="4" rx="2" fill={line} />
          <rect x="130" y="58" width="40" height="4" rx="2" fill={line} />
        </Frame>
      )
    case 'image':
      return (
        <Frame>
          <rect x="16" y="20" width="76" height="58" rx="5" fill="#EFE9FF" stroke={line} />
          <path d="M22 70l20-18 14 12 12-9 18 15z" fill={brand} opacity="0.35" />
          <text x="54" y="34" fontSize="10" textAnchor="middle" fill={soft}>HEIC</text>
          <path d="M102 48h22l-6-5m6 5-6 5" stroke={soft} strokeWidth="2" fill="none" />
          <rect x="134" y="26" width="72" height="46" rx="5" fill={paper} stroke={line} />
          <text x="170" y="54" fontSize="12" textAnchor="middle" fill={brand}>PNG</text>
        </Frame>
      )
    case 'home':
      return (
        <Frame>
          <path d="M110 16l44 30h-14v32h-60V46H66z" fill={brand} opacity="0.18" stroke={brand} />
          <rect x="96" y="56" width="28" height="22" rx="2" fill={paper} stroke={line} />
          <rect x="20" y="66" width="34" height="5" rx="2.5" fill={line} />
          <rect x="166" y="66" width="34" height="5" rx="2.5" fill={line} />
        </Frame>
      )
    case 'mic':
      return (
        <Frame>
          <rect x="96" y="16" width="20" height="34" rx="10" fill={brand} opacity="0.5" />
          <path d="M88 44a18 18 0 0 0 36 0" fill="none" stroke={brand} strokeWidth="3" />
          <path d="M106 62v10" stroke={brand} strokeWidth="3" />
          <path d="M132 30h10M132 40h16M132 50h12" stroke={soft} strokeWidth="2" />
          <Sheet x={14} y={20} w={62} h={56} lines={3} />
        </Frame>
      )
    case 'meeting':
      return (
        <Frame>
          <circle cx="42" cy="34" r="9" fill={brand} opacity="0.35" />
          <circle cx="66" cy="34" r="9" fill={brand} opacity="0.22" />
          <circle cx="90" cy="34" r="9" fill={brand} opacity="0.35" />
          <rect x="26" y="52" width="80" height="28" rx="4" fill={paper} stroke={line} />
          <rect x="34" y="60" width="50" height="4" rx="2" fill={line} />
          <rect x="34" y="70" width="36" height="4" rx="2" fill={line} />
          <rect x="122" y="18" width="84" height="62" rx="5" fill={paper} stroke={brand} />
          <rect x="132" y="30" width="30" height="5" rx="2.5" fill={brand} opacity="0.7" />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="132" y={44 + i * 12} width="8" height="8" rx="2" fill="none" stroke={soft} />
              <rect x="146" y={46 + i * 12} width="46" height="4" rx="2" fill={line} />
            </g>
          ))}
        </Frame>
      )
    case 'timer':
      return (
        <Frame>
          <circle cx="110" cy="50" r="28" fill={paper} stroke={brand} strokeWidth="3" />
          <path d="M110 50V30" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M110 50l14 9" stroke={warm} strokeWidth="3" strokeLinecap="round" />
          <path d="M110 22a28 28 0 0 1 25 15" fill="none" stroke={warm} strokeWidth="4" strokeLinecap="round" />
          <text x="34" y="54" fontSize="11" fill={soft}>25:00</text>
        </Frame>
      )
    case 'table':
      return (
        <Frame>
          <rect x="30" y="18" width="160" height="60" rx="4" fill={paper} stroke={line} />
          <rect x="30" y="18" width="160" height="16" rx="4" fill={brand} opacity="0.18" />
          {[62, 110, 158].map((x) => <line key={x} x1={x} y1="18" x2={x} y2="78" stroke={line} />)}
          {[34, 50, 62].map((y) => <line key={y} x1="30" y1={y} x2="190" y2={y} stroke={line} />)}
          <rect x="38" y="23" width="16" height="5" rx="2.5" fill={brand} />
          <rect x="70" y="23" width="16" height="5" rx="2.5" fill={brand} />
          <rect x="38" y="40" width="14" height="4" rx="2" fill={line} />
          <rect x="70" y="40" width="20" height="4" rx="2" fill={line} />
        </Frame>
      )
    case 'toc':
      return (
        <Frame>
          <rect x="20" y="16" width="86" height="64" rx="4" fill={paper} stroke={brand} />
          <rect x="28" y="26" width="34" height="5" rx="2.5" fill={brand} />
          <rect x="28" y="40" width="52" height="4" rx="2" fill={line} />
          <rect x="28" y="50" width="52" height="4" rx="2" fill={line} />
          <rect x="28" y="60" width="40" height="4" rx="2" fill={line} />
          <path d="M112 48h22l-6-5m6 5-6 5" stroke={soft} strokeWidth="2" fill="none" />
          <Sheet x={142} y={16} w={64} h={64} lines={4} />
          <rect x="150" y="24" width="26" height="5" rx="2.5" fill={warm} />
        </Frame>
      )
    case 'footnote':
      return (
        <Frame>
          <Sheet x={40} y={12} w={140} h={54} lines={3} />
          <text x="150" y="30" fontSize="9" fill={warm}>[1]</text>
          <line x1="48" y1="72" x2="96" y2="72" stroke={soft} />
          <text x="48" y="86" fontSize="9" fill={soft}>[1] 출처 · 덧붙임</text>
        </Frame>
      )
    case 'formula':
      return (
        <Frame>
          <rect x="28" y="22" width="164" height="52" rx="6" fill={paper} stroke={line} />
          <text x="110" y="56" fontSize="22" textAnchor="middle" fill={ink} fontFamily="Georgia, serif">
            E = mc²
          </text>
          <text x="44" y="38" fontSize="11" fill={soft}>∑</text>
          <text x="170" y="66" fontSize="11" fill={soft}>∫</text>
        </Frame>
      )
    case 'diagram':
      return (
        <Frame>
          <rect x="18" y="38" width="46" height="22" rx="4" fill={paper} stroke={brand} />
          <path d="M64 49h22" stroke={soft} strokeWidth="2" />
          <path d="M86 49l-7-4v8z" fill={soft} />
          <path d="M110 30l20 19-20 19-20-19z" fill={brand} opacity="0.2" stroke={brand} />
          <path d="M130 49h22" stroke={soft} strokeWidth="2" />
          <path d="M152 49l-7-4v8z" fill={soft} />
          <rect x="154" y="24" width="46" height="20" rx="4" fill={paper} stroke={line} />
          <rect x="154" y="54" width="46" height="20" rx="4" fill={paper} stroke={line} />
        </Frame>
      )
    default:
      return (
        <Frame>
          <Sheet x={66} y={14} w={88} h={68} lines={4} />
        </Frame>
      )
  }
}

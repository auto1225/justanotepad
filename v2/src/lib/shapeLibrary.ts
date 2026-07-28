/**
 * 도형 꾸러미 — 워드 「삽입 › 도형」 갈래를 그대로 따랐다.
 * 선 / 사각형 / 기본 도형 / 블록 화살표 / 순서도 / 별 및 현수막 / 설명선.
 *
 * 도형은 100×100 자리 안에 그린 SVG 조각이다 (viewBox="0 0 100 100").
 * 실제 크기는 개체가 정하고, 여기서는 모양만 맡는다 — 그래서 어떤 크기로
 * 늘려도 뭉개지지 않는다.
 */

export interface ShapeDef {
  key: string
  label: string
  group: string
  /** 그리는 방법 — path 하나로 되는 것이 대부분 */
  path: string
  /** 선으로만 이루어진 도형 (채우기 없음) */
  lineOnly?: boolean
  /** 화살표 머리를 붙인다 */
  arrow?: 'end' | 'both'
  /** 글자를 담을 수 있는 자리 (백분율: 왼쪽·위·너비·높이) */
  textBox?: [number, number, number, number]
}

const R = 'M4 4 H96 V96 H4 Z'

export const SHAPES: ShapeDef[] = [
  /* ── 선 ── */
  { key: 'line', label: '선', group: '선', path: 'M2 98 L98 2', lineOnly: true },
  { key: 'arrow', label: '화살표', group: '선', path: 'M2 98 L98 2', lineOnly: true, arrow: 'end' },
  { key: 'arrow2', label: '양쪽 화살표', group: '선', path: 'M2 98 L98 2', lineOnly: true, arrow: 'both' },
  { key: 'elbow', label: '꺾인 연결선', group: '선', path: 'M2 98 L50 98 L50 2 L98 2', lineOnly: true, arrow: 'end' },
  { key: 'curve', label: '곡선', group: '선', path: 'M2 98 Q50 2 98 50', lineOnly: true },

  /* ── 사각형 ── */
  { key: 'rect', label: '직사각형', group: '사각형', path: R, textBox: [8, 8, 84, 84] },
  { key: 'round-rect', label: '둥근 직사각형', group: '사각형', path: 'M20 4 H80 A16 16 0 0 1 96 20 V80 A16 16 0 0 1 80 96 H20 A16 16 0 0 1 4 80 V20 A16 16 0 0 1 20 4 Z', textBox: [10, 10, 80, 80] },
  { key: 'snip-rect', label: '한쪽 모서리가 잘린 사각형', group: '사각형', path: 'M4 4 H76 L96 24 V96 H4 Z', textBox: [8, 10, 82, 80] },
  { key: 'frame', label: '액자', group: '사각형', path: 'M4 4 H96 V96 H4 Z M20 20 V80 H80 V20 Z' },

  /* ── 기본 도형 ── */
  { key: 'ellipse', label: '타원', group: '기본 도형', path: 'M50 4 A46 46 0 1 1 49.9 4 Z', textBox: [18, 24, 64, 52] },
  { key: 'triangle', label: '삼각형', group: '기본 도형', path: 'M50 4 L96 96 H4 Z', textBox: [22, 45, 56, 45] },
  { key: 'right-triangle', label: '직각 삼각형', group: '기본 도형', path: 'M4 4 V96 H96 Z', textBox: [10, 55, 60, 35] },
  { key: 'diamond', label: '마름모', group: '기본 도형', path: 'M50 2 L98 50 L50 98 L2 50 Z', textBox: [24, 32, 52, 36] },
  { key: 'parallelogram', label: '평행사변형', group: '기본 도형', path: 'M24 8 H98 L76 92 H2 Z', textBox: [18, 22, 64, 56] },
  { key: 'trapezoid', label: '사다리꼴', group: '기본 도형', path: 'M24 8 H76 L96 92 H4 Z', textBox: [22, 25, 56, 55] },
  { key: 'pentagon', label: '오각형', group: '기본 도형', path: 'M50 2 L98 38 L80 96 H20 L2 38 Z', textBox: [22, 30, 56, 50] },
  { key: 'hexagon', label: '육각형', group: '기본 도형', path: 'M28 6 H72 L96 50 L72 94 H28 L4 50 Z', textBox: [22, 26, 56, 48] },
  { key: 'octagon', label: '팔각형', group: '기본 도형', path: 'M32 4 H68 L96 32 V68 L68 96 H32 L4 68 V32 Z', textBox: [16, 24, 68, 52] },
  { key: 'cross', label: '십자', group: '기본 도형', path: 'M36 4 H64 V36 H96 V64 H64 V96 H36 V64 H4 V36 H36 Z', textBox: [22, 38, 56, 24] },
  { key: 'cylinder', label: '원통', group: '기본 도형', path: 'M4 18 A46 14 0 0 1 96 18 V82 A46 14 0 0 1 4 82 Z M4 18 A46 14 0 0 0 96 18', textBox: [12, 32, 76, 44] },
  { key: 'heart', label: '하트', group: '기본 도형', path: 'M50 92 C10 62 2 36 18 20 C34 4 50 16 50 30 C50 16 66 4 82 20 C98 36 90 62 50 92 Z' },
  { key: 'moon', label: '초승달', group: '기본 도형', path: 'M62 4 A46 46 0 1 0 62 96 A38 38 0 1 1 62 4 Z' },
  { key: 'lightning', label: '번개', group: '기본 도형', path: 'M56 2 L20 54 H44 L36 98 L80 40 H54 Z' },

  /* ── 블록 화살표 ── */
  { key: 'arrow-right', label: '오른쪽 화살표', group: '블록 화살표', path: 'M2 32 H60 V8 L98 50 L60 92 V68 H2 Z', textBox: [8, 38, 44, 24] },
  { key: 'arrow-left', label: '왼쪽 화살표', group: '블록 화살표', path: 'M98 32 H40 V8 L2 50 L40 92 V68 H98 Z', textBox: [46, 38, 44, 24] },
  { key: 'arrow-up', label: '위쪽 화살표', group: '블록 화살표', path: 'M32 98 V40 H8 L50 2 L92 40 H68 V98 Z', textBox: [36, 48, 28, 44] },
  { key: 'arrow-down', label: '아래쪽 화살표', group: '블록 화살표', path: 'M32 2 V60 H8 L50 98 L92 60 H68 V2 Z', textBox: [36, 8, 28, 44] },
  { key: 'arrow-lr', label: '좌우 화살표', group: '블록 화살표', path: 'M2 50 L26 20 V36 H74 V20 L98 50 L74 80 V64 H26 V80 Z', textBox: [30, 40, 40, 20] },
  { key: 'arrow-bent', label: '굽은 화살표', group: '블록 화살표', path: 'M4 96 V40 A28 28 0 0 1 32 12 H62 V2 L98 26 L62 50 V40 H36 A4 4 0 0 0 32 44 V96 Z' },
  { key: 'chevron', label: '갈매기형 수장', group: '블록 화살표', path: 'M2 8 H62 L98 50 L62 92 H2 L38 50 Z', textBox: [18, 38, 52, 24] },

  /* ── 순서도 ── */
  { key: 'fc-process', label: '순서도: 처리', group: '순서도', path: R, textBox: [8, 8, 84, 84] },
  { key: 'fc-decision', label: '순서도: 판단', group: '순서도', path: 'M50 2 L98 50 L50 98 L2 50 Z', textBox: [24, 32, 52, 36] },
  { key: 'fc-terminator', label: '순서도: 시작/끝', group: '순서도', path: 'M28 12 H72 A38 38 0 0 1 72 88 H28 A38 38 0 0 1 28 12 Z', textBox: [18, 30, 64, 40] },
  { key: 'fc-data', label: '순서도: 자료', group: '순서도', path: 'M24 12 H98 L76 88 H2 Z', textBox: [20, 28, 60, 44] },
  { key: 'fc-document', label: '순서도: 문서', group: '순서도', path: 'M4 8 H96 V78 Q72 96 50 82 Q28 68 4 84 Z', textBox: [12, 18, 76, 50] },
  { key: 'fc-database', label: '순서도: 저장소', group: '순서도', path: 'M4 18 A46 14 0 0 1 96 18 V82 A46 14 0 0 1 4 82 Z', textBox: [12, 34, 76, 40] },
  { key: 'fc-prep', label: '순서도: 준비', group: '순서도', path: 'M24 8 H76 L98 50 L76 92 H24 L2 50 Z', textBox: [24, 34, 52, 32] },

  /* ── 별 및 현수막 ── */
  { key: 'star4', label: '별: 4개 꼭짓점', group: '별 및 현수막', path: 'M50 2 L62 38 L98 50 L62 62 L50 98 L38 62 L2 50 L38 38 Z' },
  { key: 'star5', label: '별: 5개 꼭짓점', group: '별 및 현수막', path: 'M50 2 L61 36 L98 36 L68 58 L79 94 L50 72 L21 94 L32 58 L2 36 L39 36 Z' },
  { key: 'star6', label: '별: 6개 꼭짓점', group: '별 및 현수막', path: 'M50 2 L68 32 L96 32 L82 62 L96 92 L68 88 L50 98 L32 88 L4 92 L18 62 L4 32 L32 32 Z' },
  { key: 'ribbon', label: '현수막', group: '별 및 현수막', path: 'M2 20 H98 V72 H78 L88 92 L50 76 L12 92 L22 72 H2 Z', textBox: [16, 28, 68, 36] },
  { key: 'scroll', label: '두루마리', group: '별 및 현수막', path: 'M12 16 H98 V84 H12 A10 10 0 0 1 12 64 H4 V26 A10 10 0 0 1 12 16 Z', textBox: [20, 28, 70, 44] },

  /* ── 설명선 ── */
  { key: 'callout-rect', label: '사각형 설명선', group: '설명선', path: 'M4 4 H96 V70 H56 L38 96 L34 70 H4 Z', textBox: [10, 12, 80, 50] },
  { key: 'callout-round', label: '둥근 설명선', group: '설명선', path: 'M20 4 H80 A16 16 0 0 1 96 20 V54 A16 16 0 0 1 80 70 H56 L36 96 L34 70 H20 A16 16 0 0 1 4 54 V20 A16 16 0 0 1 20 4 Z', textBox: [14, 14, 72, 46] },
  { key: 'callout-cloud', label: '구름 설명선', group: '설명선', path: 'M26 24 A16 16 0 0 1 54 14 A18 18 0 0 1 84 26 A14 14 0 0 1 84 62 H30 A16 16 0 0 1 26 24 Z M26 70 A6 6 0 1 1 26 71 Z M16 86 A5 5 0 1 1 16 87 Z', textBox: [26, 24, 52, 32] },
  { key: 'callout-oval', label: '타원 설명선', group: '설명선', path: 'M50 6 A44 32 0 1 1 49.9 6 Z M40 68 L30 96 L54 72 Z', textBox: [20, 22, 60, 34] },
]

export const SHAPE_GROUPS = [...new Set(SHAPES.map((s) => s.group))]

export function shapeByKey(key: string): ShapeDef | undefined {
  return SHAPES.find((s) => s.key === key)
}

/**
 * 아이콘 — 워드 「삽입 › 아이콘」. 선으로만 그린 조각이라 어떤 색에도 어울린다.
 * (한글의 그리기마당 자리이기도 하다 — 갈래로 묶어 두었다)
 */
export interface IconDef { key: string; label: string; group: string; path: string }

export const CLIPART: IconDef[] = [
  { key: 'user', label: '사람', group: '사람', path: 'M50 46a18 18 0 1 0 0-36 18 18 0 0 0 0 36Z M16 92c0-19 15-30 34-30s34 11 34 30' },
  { key: 'users', label: '여러 사람', group: '사람', path: 'M38 42a15 15 0 1 0 0-30 15 15 0 0 0 0 30Z M4 88c0-16 15-26 34-26s34 10 34 26 M70 20a13 13 0 1 1 0 26 M78 62c10 3 18 12 18 26' },
  { key: 'home', label: '집', group: '장소', path: 'M10 46 50 12l40 34 M20 44v44h60V44 M40 88V62h20v26' },
  { key: 'building', label: '건물', group: '장소', path: 'M20 90V16h60v74 M34 30h10 M56 30h10 M34 48h10 M56 48h10 M34 66h10 M56 66h10' },
  { key: 'car', label: '자동차', group: '탈것', path: 'M12 62 20 38h60l8 24 M8 62h84v18H8Z M26 80v8 M74 80v8 M26 70h8 M66 70h8' },
  { key: 'parking', label: '주차', group: '탈것', path: 'M14 10h72v80H14Z M38 74V32h16a12 12 0 0 1 0 24H38' },
  { key: 'sensor', label: '센서', group: '기술', path: 'M50 54a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M50 54v34 M28 22a32 32 0 0 1 44 0 M18 10a48 48 0 0 1 64 0' },
  { key: 'wifi', label: '무선', group: '기술', path: 'M50 80a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M32 56a26 26 0 0 1 36 0 M18 40a46 46 0 0 1 64 0' },
  { key: 'cloud', label: '구름', group: '기술', path: 'M28 76a20 20 0 0 1 2-40 24 24 0 0 1 44 6 18 18 0 0 1-4 34Z' },
  { key: 'chart', label: '그래프', group: '자료', path: 'M14 86h72 M14 86V20 M30 86V56 M48 86V34 M66 86V46 M84 86V26' },
  { key: 'doc', label: '문서', group: '자료', path: 'M24 10h36l18 18v62H24Z M60 10v18h18 M36 48h30 M36 62h30 M36 76h18' },
  { key: 'folder', label: '폴더', group: '자료', path: 'M10 26h30l8 10h42v50H10Z' },
  { key: 'check', label: '확인', group: '표시', path: 'M50 92a42 42 0 1 0 0-84 42 42 0 0 0 0 84Z M32 50l14 14 24-28' },
  { key: 'warn', label: '경고', group: '표시', path: 'M50 10 94 88H6Z M50 40v24 M50 74v2' },
  { key: 'info', label: '알림', group: '표시', path: 'M50 92a42 42 0 1 0 0-84 42 42 0 0 0 0 84Z M50 44v28 M50 30v2' },
  { key: 'star', label: '별', group: '표시', path: 'M50 8 62 38l32 2-25 21 8 31-27-18-27 18 8-31-25-21 32-2Z' },
  { key: 'clock', label: '시계', group: '표시', path: 'M50 92a42 42 0 1 0 0-84 42 42 0 0 0 0 84Z M50 26v26l18 10' },
  { key: 'mail', label: '편지', group: '소통', path: 'M10 24h80v52H10Z M10 24l40 30 40-30' },
  { key: 'phone', label: '전화', group: '소통', path: 'M26 12c10 0 12 18 8 22-4 4-8 6-6 12 4 10 14 20 24 24 6 2 8-2 12-6 4-4 22-2 22 8 0 8-8 16-18 16C40 88 12 60 12 30c0-10 8-18 14-18Z' },
  { key: 'chat', label: '말풍선', group: '소통', path: 'M10 16h80v52H44L24 88V68H10Z' },
  { key: 'gear', label: '톱니', group: '기술', path: 'M50 64a14 14 0 1 0 0-28 14 14 0 0 0 0 28Z M50 6v12 M50 82v12 M6 50h12 M82 50h12 M19 19l8 8 M73 73l8 8 M81 19l-8 8 M27 73l-8 8' },
  { key: 'lock', label: '자물쇠', group: '표시', path: 'M24 44h52v46H24Z M34 44V30a16 16 0 0 1 32 0v14 M50 62v12' },
]

export const CLIPART_GROUPS = [...new Set(CLIPART.map((c) => c.group))]

/**
 * 글맵시 틀 — 한글의 글맵시(워드의 WordArt 변환)에 해당한다.
 * 글자가 흐를 길을 SVG path 로 준다.
 */
export interface WordArtDef { key: string; label: string; path: string | null; skew?: string }

export const WORDART: WordArtDef[] = [
  { key: 'plain', label: '곧게', path: null },
  { key: 'arch-up', label: '위로 굽은 활', path: 'M10 90 Q200 -10 390 90' },
  { key: 'arch-down', label: '아래로 굽은 활', path: 'M10 20 Q200 130 390 20' },
  { key: 'wave', label: '물결', path: 'M10 60 Q100 10 200 60 T390 60' },
  { key: 'wave2', label: '큰 물결', path: 'M10 70 Q70 0 140 70 T280 70 T400 70' },
  { key: 'circle-top', label: '동그라미 위', path: 'M30 100 A170 90 0 0 1 370 100' },
  { key: 'circle-bottom', label: '동그라미 아래', path: 'M30 20 A170 90 0 0 0 370 20' },
  { key: 'slope-up', label: '오르막', path: 'M10 100 L390 20' },
  { key: 'slope-down', label: '내리막', path: 'M10 20 L390 100' },
  { key: 'flag', label: '깃발', path: 'M10 40 Q110 100 200 40 T390 40' },
  { key: 'triangle-up', label: '세모 위', path: 'M10 100 L200 20 L390 100' },
  { key: 'valley', label: '골짜기', path: 'M10 20 L200 100 L390 20' },
]

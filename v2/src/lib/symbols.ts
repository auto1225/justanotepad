/**
 * 문자표 — 워드 「삽입 › 기호」, 한글 「입력 › 문자표(Ctrl+F10)」.
 *
 * 예전에는 여든 자 남짓한 붙박이 목록이었다. 실제로 문서를 쓰다 보면
 * 없는 글자가 자꾸 나온다 — 그래서 갈래를 넓히고 이름으로 찾을 수 있게 했다.
 * 이름은 한국어와 영어를 함께 달아 두 쪽 어느 말로 찾아도 걸린다.
 */

export interface SymbolDef {
  ch: string
  /** 찾을 때 쓰는 말 — 한국어·영어를 띄어쓰기로 이어 둔다 */
  name: string
}

export interface SymbolGroup {
  key: string
  label: string
  items: SymbolDef[]
}

/** 문자 하나에 이름을 붙인다 */
const s = (ch: string, name: string): SymbolDef => ({ ch, name })

/** 이어진 코드 구간을 한꺼번에 (이름은 같은 말머리를 나눠 쓴다) */
function range(from: number, to: number, name: string): SymbolDef[] {
  const out: SymbolDef[] = []
  for (let code = from; code <= to; code += 1) out.push(s(String.fromCodePoint(code), name))
  return out
}

export const SYMBOL_TABLE: SymbolGroup[] = [
  {
    key: 'punct',
    label: '문장 부호',
    items: [
      s('·', '가운뎃점 middle dot'), s('…', '말줄임표 ellipsis'), s('—', '줄표 em dash'), s('–', '반줄표 en dash'),
      s('‥', '두 점 two dot leader'), s('“', '큰따옴표 여는 quote'), s('”', '큰따옴표 닫는 quote'),
      s('‘', '작은따옴표 여는 quote'), s('’', '작은따옴표 닫는 quote'), s('「', '낫표 여는 bracket'), s('」', '낫표 닫는 bracket'),
      s('『', '겹낫표 여는 bracket'), s('』', '겹낫표 닫는 bracket'), s('〈', '홑화살괄호 여는'), s('〉', '홑화살괄호 닫는'),
      s('《', '겹화살괄호 여는'), s('》', '겹화살괄호 닫는'), s('【', '검은 대괄호 여는'), s('】', '검은 대괄호 닫는'),
      s('〔', '거북 괄호 여는'), s('〕', '거북 괄호 닫는'), s('¶', '문단 기호 pilcrow'), s('§', '절 기호 section'),
      s('†', '칼표 dagger'), s('‡', '겹칼표 double dagger'), s('•', '가운데 점 bullet'), s('‰', '천분율 permille'),
      s('′', '프라임 prime'), s('″', '겹프라임 double prime'), s('¡', '거꾸로 느낌표'), s('¿', '거꾸로 물음표'),
    ],
  },
  {
    key: 'arrow',
    label: '화살표',
    items: [
      ...range(0x2190, 0x21bb, '화살표 arrow'),
      s('⇒', '두 줄 오른쪽 화살표 implies'), s('⇔', '두 줄 양쪽 화살표 iff'),
      s('➔', '굵은 화살표 arrow'), s('➜', '굵은 화살표 arrow'), s('➤', '삼각 화살표 arrow'),
    ],
  },
  {
    key: 'math',
    label: '수학',
    items: [
      s('±', '플러스 마이너스 plus minus'), s('×', '곱하기 times'), s('÷', '나누기 divide'), s('≠', '같지 않다 not equal'),
      s('≈', '거의 같다 approx'), s('≡', '항등 identical'), s('≤', '작거나 같다 leq'), s('≥', '크거나 같다 geq'),
      s('∞', '무한 infinity'), s('∑', '시그마 합 sum'), s('∏', '곱 product'), s('∫', '적분 integral'),
      s('∬', '이중 적분'), s('∮', '선 적분 contour'), s('√', '루트 sqrt'), s('∛', '세제곱근 cbrt'),
      s('∂', '편미분 partial'), s('∇', '나블라 nabla'), s('∈', '원소 element'), s('∉', '원소 아님'),
      s('⊂', '부분집합 subset'), s('⊃', '포함 superset'), s('∪', '합집합 union'), s('∩', '교집합 intersection'),
      s('∅', '공집합 empty'), s('∀', '모든 forall'), s('∃', '존재 exists'), s('∴', '그러므로 therefore'),
      s('∵', '왜냐하면 because'), s('∝', '비례 propto'), s('⊥', '수직 perp'), s('∥', '평행 parallel'),
      s('∠', '각 angle'), s('°', '도 degree'), s('′', '분 minute'), s('″', '초 second'),
      s('≒', '근사 almost equal'), s('≪', '훨씬 작다'), s('≫', '훨씬 크다'), s('⊕', '직합 oplus'), s('⊗', '텐서곱 otimes'),
    ],
  },
  {
    key: 'greek',
    label: '그리스 문자',
    items: [...range(0x391, 0x3a9, '그리스 대문자 greek'), ...range(0x3b1, 0x3c9, '그리스 소문자 greek')],
  },
  {
    key: 'unit',
    label: '단위 · 통화',
    items: [
      s('₩', '원 won'), s('$', '달러 dollar'), s('€', '유로 euro'), s('£', '파운드 pound'), s('¥', '엔 위안 yen'),
      s('¢', '센트 cent'), s('₫', '동 dong'), s('₹', '루피 rupee'), s('₽', '루블 ruble'), s('₺', '리라 lira'),
      s('℃', '섭씨 celsius'), s('℉', '화씨 fahrenheit'), s('㎜', '밀리미터 mm'), s('㎝', '센티미터 cm'),
      s('㎞', '킬로미터 km'), s('㎡', '제곱미터 m2'), s('㎥', '세제곱미터 m3'), s('㎏', '킬로그램 kg'),
      s('㎎', '밀리그램 mg'), s('㎖', '밀리리터 ml'), s('㎘', '킬로리터 kl'), s('㏄', '시시 cc'),
      s('㎐', '헤르츠 hz'), s('㎑', '킬로헤르츠 khz'), s('㎒', '메가헤르츠 mhz'), s('㎓', '기가헤르츠 ghz'),
      s('㎾', '킬로와트 kw'), s('㎩', '파스칼 pa'), s('㏈', '데시벨 db'), s('Å', '옹스트롬 angstrom'),
      s('µ', '마이크로 micro'), s('Ω', '옴 ohm'), s('％', '전각 퍼센트'), s('‱', '만분율'),
    ],
  },
  {
    key: 'shape',
    label: '도형 · 기호',
    items: [
      ...range(0x25a0, 0x25ff, '도형 shape'),
      s('★', '별 star'), s('☆', '흰 별 star'), s('✓', '체크 check'), s('✔', '굵은 체크 check'),
      s('✗', '가위표 cross'), s('✘', '굵은 가위표 cross'), s('☐', '빈 네모 checkbox'), s('☑', '체크 네모 checkbox'),
      s('☒', '가위표 네모 checkbox'), s('♠', '스페이드 spade'), s('♥', '하트 heart'), s('♦', '다이아 diamond'),
      s('♣', '클로버 club'), s('☎', '전화 phone'), s('✉', '편지 mail'), s('✂', '가위 scissors'),
      s('✎', '연필 pencil'), s('☀', '해 sun'), s('☁', '구름 cloud'), s('☂', '우산 umbrella'), s('❄', '눈 snow'),
      s('☺', '웃는 얼굴 smile'), s('☹', '찡그린 얼굴 sad'), s('⚠', '경고 warning'), s('⚡', '번개 lightning'),
      s('♪', '음표 note'), s('♬', '두 음표 note'), s('☯', '음양 yinyang'), s('☮', '평화 peace'),
    ],
  },
  {
    key: 'circled',
    label: '원 · 괄호 글자',
    items: [
      ...range(0x2460, 0x2473, '동그라미 숫자 circled number'),
      ...range(0x2474, 0x2487, '괄호 숫자 parenthesized number'),
      ...range(0x24b6, 0x24cf, '동그라미 알파벳 circled letter'),
      ...range(0x3260, 0x327b, '동그라미 한글 circled hangul'),
      s('㈜', '주식회사 company'), s('㈔', '사단법인'), s('㈖', '재단법인'), s('№', '번호 number'),
      s('℡', '전화 번호 tel'), s('™', '상표 trademark'), s('©', '저작권 copyright'), s('®', '등록상표 registered'),
    ],
  },
  {
    key: 'roman',
    label: '로마 숫자 · 분수',
    items: [
      ...range(0x2160, 0x216b, '로마 숫자 대문자 roman'),
      ...range(0x2170, 0x217b, '로마 숫자 소문자 roman'),
      s('½', '이분의 일 half'), s('⅓', '삼분의 일'), s('⅔', '삼분의 이'), s('¼', '사분의 일 quarter'),
      s('¾', '사분의 삼'), s('⅕', '오분의 일'), s('⅙', '육분의 일'), s('⅛', '팔분의 일'),
      s('⁰', '위 첨자 0 superscript'), s('¹', '위 첨자 1'), s('²', '위 첨자 2'), s('³', '위 첨자 3'),
      ...range(0x2080, 0x2089, '아래 첨자 subscript'),
    ],
  },
  {
    key: 'kana',
    label: '일본 글자 · 발음',
    items: [
      ...range(0x3041, 0x3096, '히라가나 hiragana'),
      ...range(0x30a1, 0x30f6, '가타카나 katakana'),
      s('ˇ', '캐런 caron'), s('ˉ', '장음 macron'), s('˘', '브레브 breve'), s('˚', '위 고리 ring'),
    ],
  },
  {
    key: 'proof',
    label: '교정 부호',
    items: [
      s('⌐', '빼기 교정'), s('¬', '부정 not'), s('⌒', '이어 붙이기'), s('⌂', '들여쓰기 집'),
      s('␣', '사이 띄우기 space'), s('␥', '줄 바꾸기'), s('↵', '줄 바꿈 return'), s('⏎', '되돌림 return'),
      s('※', '참고 reference'), s('⁂', '별표 셋 asterism'), s('‼', '겹느낌표'), s('⁉', '물음 느낌표'),
    ],
  },
]

/** 이름·글자로 찾는다 — 빈 말이면 갈래 그대로 */
export function searchSymbols(query: string, limit = 240): SymbolDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: SymbolDef[] = []
  for (const group of SYMBOL_TABLE) {
    for (const item of group.items) {
      if (item.ch === q || item.name.toLowerCase().includes(q) || group.label.includes(q)) {
        out.push(item)
        if (out.length >= limit) return out
      }
    }
  }
  // 코드 값으로도 찾는다 (U+AC00 · ac00 · 0xac00)
  const hex = q.replace(/^(u\+|0x)/, '')
  if (/^[0-9a-f]{2,6}$/.test(hex)) {
    const code = parseInt(hex, 16)
    if (code > 0 && code <= 0x10ffff) out.unshift(s(String.fromCodePoint(code), `U+${hex.toUpperCase()}`))
  }
  return out
}

/** 최근에 쓴 문자 — 워드·한글처럼 맨 앞에 보여 준다 */
const RECENT_KEY = 'jan-v2-recent-symbols'

export function recentSymbols(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]
  } catch { return [] }
}

export function rememberSymbol(ch: string): void {
  try {
    const list = [ch, ...recentSymbols().filter((c) => c !== ch)].slice(0, 24)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch { /* 저장 못 해도 문자는 들어간다 */ }
}

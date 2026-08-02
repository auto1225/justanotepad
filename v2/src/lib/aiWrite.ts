import { chatAi } from './aiApi'

/**
 * 문서 자동 작성 — 「무엇을 만들어 달라」 한 마디로 문서 한 벌이 나오게.
 *
 * 잘 쓰는 사람이 쓴 것처럼 나오게 하려고 세 가지를 지시문에 박았다.
 *  1. 문서 종류마다 짜임을 못 박는다. 보고서와 회의록과 강의 노트는 뼈대가 다르다 —
 *     「알아서 잘」 이라고 맡기면 어디서 본 듯한 밋밋한 글이 온다.
 *  2. 모르는 숫자를 지어내지 말라고 시킨다. 대신 【확인: …】 로 채울 자리를 남기게 한다.
 *     전문가가 만든 문서와 그럴듯한 글의 갈림길이 바로 여기다.
 *  3. 겉치레 문장을 금지한다 (「본 문서는 …에 대하여 살펴본다」, 「다양한 노력이 필요하다」).
 *
 * 그리고 두 걸음으로 쓴다 — 먼저 목차를 받아 사람이 손보고, 그 목차대로 본문을 채운다.
 * 한 번에 통째로 쓰게 하면 앞뒤가 겹치고 뒤로 갈수록 성의가 떨어진다.
 */

export interface DocKind {
  key: string
  label: string
  /** 무엇을 만드는 자리인지 */
  hint: string
  /** 이 종류의 뼈대 — 지시문에 그대로 들어간다 */
  frame: string
  /** 주제 칸에 보여 줄 보기 글 */
  sample: string
}

export const DOC_KINDS: DocKind[] = [
  {
    key: 'report',
    label: '업무 보고서',
    hint: '무엇을 했고 무엇을 하겠다 — 결론부터',
    sample: '상반기 고객 이탈 원인 분석과 대응 방안',
    frame: [
      '1. 요약 — 결론과 요청 사항을 먼저. 세 줄 이내, 숫자 포함',
      '2. 배경 — 왜 지금 이 보고인가',
      '3. 현황 — 사실과 수치만. 표 하나로 정리',
      '4. 분석 — 원인을 근거와 함께. 짐작과 사실을 갈라 적는다',
      '5. 대안 비교 — 두세 가지 안을 표로 (안 / 드는 것 / 얻는 것 / 위험)',
      '6. 권고 — 하나를 고르고 그 까닭',
      '7. 실행 계획 — 할 일 · 담당 · 기한 표',
      '8. 남은 문제 — 결정이 필요한 것',
    ].join('\n'),
  },
  {
    key: 'plan',
    label: '사업 · 제품 기획서',
    hint: '무엇을 왜 어떻게 만들 것인가',
    sample: '동네 세탁소를 잇는 모바일 수거 서비스',
    frame: [
      '1. 한 줄 정의 — 누구의 어떤 불편을 어떻게 없애는가',
      '2. 문제 — 지금 사람들이 겪는 일. 겪는 사람의 말투로 한 대목',
      '3. 시장과 대상 — 크기와 쪼갠 무리, 첫 고객은 누구',
      '4. 해법 — 핵심 기능 세 가지. 각각 무엇을 없애 주는지',
      '5. 남과 다른 점 — 비슷한 것과 견준 표',
      '6. 사업 방식 — 어디서 돈이 들어오고 얼마가 나가는가',
      '7. 실행 계획 — 단계 · 할 일 · 기한 표',
      '8. 드는 돈과 사람',
      '9. 위험과 대비 — 표 (위험 / 그러면 / 미리 할 일)',
      '10. 성공을 무엇으로 재는가 — 지표와 목표 숫자',
    ].join('\n'),
  },
  {
    key: 'proposal',
    label: '제안서',
    hint: '고객에게 내는 제안 — 상대의 과제부터',
    sample: '중소 제조사를 위한 생산 관리 시스템 도입 제안',
    frame: [
      '1. 제안 요지 — 무엇을 얼마에 언제까지',
      '2. 고객의 과제 — 우리가 이해한 상황 (상대가 「그렇다」 할 만큼 구체적으로)',
      '3. 제안 내용 — 무엇을 드리는가. 항목별로',
      '4. 수행 방안 — 어떻게 할 것인가, 단계별로',
      '5. 일정 — 주 단위 표',
      '6. 참여 인력과 역할',
      '7. 비용 — 항목별 표와 합계',
      '8. 왜 우리인가 — 비슷한 일을 해낸 근거',
      '9. 기대 효과 — 되도록 숫자로',
    ].join('\n'),
  },
  {
    key: 'meeting',
    label: '회의록',
    hint: '결정과 할 일이 남는 회의록',
    sample: '3분기 신제품 출시 일정 조정 회의',
    frame: [
      '머리에 일시 · 장소 · 참석자 · 작성자를 표로',
      '1. 안건 — 번호로',
      '2. 논의 요지 — 안건마다 나온 의견을 갈래로 (누가 말했는지 함께)',
      '3. 결정 사항 — 번호로. 결정이 아닌 것은 여기 적지 않는다',
      '4. 할 일 — 표 (할 일 / 담당 / 기한 / 상태)',
      '5. 보류 · 다음에 다룰 것',
      '6. 다음 회의 — 날짜와 안건',
    ].join('\n'),
  },
  {
    key: 'lecture',
    label: '강의 노트 · 강의 계획',
    hint: '가르칠 것을 차례와 예시로',
    sample: '비전공자를 위한 데이터베이스 기초 4주 강의',
    frame: [
      '1. 이 강의를 들으면 무엇을 할 수 있게 되나 — 할 수 있는 일로 적는다 (「이해한다」 대신 「직접 만든다」)',
      '2. 미리 알아야 할 것',
      '3. 차시 구성 — 표 (차시 / 주제 / 다룰 것 / 과제)',
      '4. 핵심 개념 — 개념마다 한 줄 정의 + 왜 필요한가 + 흔한 오해',
      '5. 예시와 실습 — 손으로 따라 할 것',
      '6. 확인 문제 — 다섯 문제와 답',
      '7. 더 볼 것',
    ].join('\n'),
  },
  {
    key: 'manual',
    label: '사용 안내서 · 매뉴얼',
    hint: '따라 하면 되는 절차서',
    sample: '사내 전자결재 시스템 사용 안내',
    frame: [
      '1. 이 글로 무엇을 할 수 있나',
      '2. 미리 갖출 것',
      '3. 하는 순서 — 번호로. 한 걸음에 한 가지 일만. 눌러야 할 것은 「」 로 감싼다',
      '4. 자주 겪는 일 — 표 (이런 일이 나면 / 까닭 / 이렇게 한다)',
      '5. 해서는 안 되는 것',
      '6. 말 뜻 — 낯선 낱말 풀이',
      '7. 물어볼 곳',
    ].join('\n'),
  },
  {
    key: 'notice',
    label: '공지문 · 안내문',
    hint: '한 번 읽고 알 수 있게',
    sample: '건물 정기 소방 점검에 따른 엘리베이터 운행 중단 안내',
    frame: [
      '제목 — 무엇이 언제 어떻게 되는지 제목만 읽어도 알게',
      '1. 알리는 말 — 핵심을 한 문단으로. 날짜 · 시간 · 대상이 반드시 들어간다',
      '2. 자세한 내용 — 표로',
      '3. 살펴 주실 것 — 불편과 대비',
      '4. 물어볼 곳 — 담당과 연락처',
      '맺음말은 짧게. 겉치레 인사는 한 줄까지',
    ].join('\n'),
  },
  {
    key: 'mail',
    label: '업무 편지 · 공문',
    hint: '보내는 글 한 통',
    sample: '납품 지연에 대한 사과와 새 일정 안내',
    frame: [
      '받는 이 · 제목을 먼저',
      '첫 문단 — 무슨 일로 쓰는가. 두 문장 안에 요지가 나온다',
      '가운데 — 사정과 근거. 필요하면 표 하나',
      '요청 — 상대가 무엇을 언제까지 해 주면 되는지 또박또박',
      '맺음 — 다음에 우리가 할 일과 연락처',
      '전체를 한 장 안에. 겉치레 문장은 두 줄까지',
    ].join('\n'),
  },
  {
    key: 'paper',
    label: '연구 계획 · 논문 개요',
    hint: '연구의 틀을 세운다',
    sample: '원격 근무가 신입 개발자의 숙련에 미치는 영향',
    frame: [
      '1. 연구 배경 — 무엇이 알려져 있고 무엇이 비어 있나',
      '2. 문제 제기와 연구 질문 — 질문을 번호로. 답할 수 있는 크기로 좁힌다',
      '3. 선행 연구 — 갈래로 묶어 정리하고, 우리 연구가 어디에 놓이는지',
      '4. 연구 방법 — 자료 · 대상 · 절차 · 분석 방법. 남이 그대로 따라 할 수 있게',
      '5. 예상 결과와 해석의 갈림길',
      '6. 이 연구의 몫 — 학문에 무엇을, 현장에 무엇을',
      '7. 일정 — 표',
      '8. 참고문헌 — 저자(연도) 꼴로. 실제로 있는지 확인하라는 표시를 함께',
    ].join('\n'),
  },
  {
    key: 'analysis',
    label: '분석 리포트',
    hint: '자료를 읽어 시사점을 낸다',
    sample: '국내 편의점 도시락 시장 3년 흐름과 진입 기회',
    frame: [
      '1. 핵심 발견 세 가지 — 각각 한 문장 + 근거 숫자',
      '2. 무엇을 어떻게 살폈나 — 자료 출처와 기간, 셈법',
      '3. 흐름 — 표와 함께. 늘고 줄어든 폭을 숫자로',
      '4. 갈라 보기 — 무리별 · 지역별 · 시기별 가운데 뜻이 있는 것만',
      '5. 해석 — 왜 그런가. 다른 설명도 함께 짚는다',
      '6. 시사점 — 그래서 무엇을 할 것인가',
      '7. 이 분석의 한계 — 무엇을 말할 수 없나',
    ].join('\n'),
  },
  {
    key: 'free',
    label: '그 밖 — 내가 정한다',
    hint: '뼈대까지 주제에 맞게 알아서',
    sample: '주민센터에 낼 반려견 놀이터 조성 건의서',
    frame: '주제에 가장 맞는 짜임을 스스로 세운다. 그 문서 갈래에서 흔히 쓰는 차례를 따르고, 무엇을 왜 그렇게 놓았는지 첫 줄에 밝히지 않는다 (문서만 남긴다).',
  },
]

export function docKind(key: string): DocKind {
  return DOC_KINDS.find((k) => k.key === key) || DOC_KINDS[0]
}

export type DocLength = 'short' | 'normal' | 'long' | 'full'
export type DocTone = 'formal' | 'plain' | 'friendly'

export const LENGTHS: Array<{ key: DocLength; label: string; hint: string; words: string; tokens: number }> = [
  { key: 'short', label: '한 장', hint: '요지만', words: '600자 안팎', tokens: 2000 },
  { key: 'normal', label: '두세 장', hint: '보통 보고서', words: '1500자 안팎', tokens: 4000 },
  { key: 'long', label: '다섯 장', hint: '자세히', words: '3000자 안팎', tokens: 8000 },
  { key: 'full', label: '열 장', hint: '갖춘 문서', words: '6000자 이상', tokens: 16000 },
]

export const TONES: Array<{ key: DocTone; label: string; rule: string }> = [
  { key: 'formal', label: '격식체', rule: '- 하십시오체를 쓴다. 회사 · 관공서에 내는 문서의 말투다.' },
  { key: 'plain', label: '보통', rule: '- 서술체(-다)로 담백하게 쓴다. 사내 문서 · 보고서의 말투다.' },
  { key: 'friendly', label: '친근하게', rule: '- 해요체로 편하게 쓴다. 다만 늘어지지 않게 한다.' },
]

export interface DocSpec {
  /** 무엇을 만들어 달라 */
  topic: string
  kind: string
  length: DocLength
  tone: DocTone
  /** 누가 읽나 */
  reader: string
  /** 더 알려 줄 것 (아는 사실 · 수치 · 꼭 넣을 것) */
  extra: string
  /** 어디까지 끌어다 쓸까 — 준 자료만인가, 밖의 자료까지인가 (없으면 준 자료만) */
  sources?: DocSources
}

/**
 * 자료의 울타리.
 *  given — 준 것 밖으로 나가지 않는다. 강의를 받아 적은 그대로 정리할 때.
 *  web   — 밖의 자료까지 끌어온다. 그림 자리와 출처 후보를 함께 낸다.
 * 이 갈래는 사람이 고르는 것이다 — 받아 적은 것만 정리하려는 사람에게
 * 밖에서 끌어온 이야기를 섞으면, 그것이 강의에서 나온 말인지 아닌지 알 수 없게 된다.
 */
export type DocSources = 'given' | 'web'

export const SOURCE_MODES: Array<{ key: DocSources; label: string; hint: string; rule: string }> = [
  {
    key: 'given',
    label: '준 자료만',
    hint: '받아 적은 것 · 적어 준 것 안에서',
    rule: [
      '- 위에 준 자료 안에서만 쓴다. 밖에서 사실 · 숫자 · 이름 · 연구를 끌어오지 않는다.',
      '- 준 자료에 없어 비는 자리는 【확인: 무엇】 으로 남긴다.',
    ].join('\n'),
  },
  {
    key: 'web',
    label: '웹 자료까지',
    hint: '그림 자리와 출처를 함께 낸다',
    rule: [
      '- 준 자료를 뼈대로 삼되, 널리 알려진 사실 · 값 · 연구를 보태 살을 붙인다.',
      '- 보탠 것은 어디서 온 말인지 밝힌다. 절 끝에 「출처: 지은이, 제목, 해」 한 줄을 붙인다.',
      '- 그림이 있어야 알아듣는 자리에는 그 자리에 문단 하나로',
      '  〔그림 n — 무엇을 보여 주는 그림인가 · 어떤 자료를 찾으면 되나〕 라고 적는다.',
      '  (앱이 그 자리에 그림을 앉힌다 — 직접 그림을 그리거나 주소를 지어내지 않는다)',
      '- 마지막에 「더 볼 것」 절을 두고, 실제로 있는 책 · 논문 · 문서를 지은이 · 해와 함께 적는다.',
      '- 확실하지 않은 것은 적지 않는다. 그럴듯한 가짜 출처보다 빈자리가 낫다.',
    ].join('\n'),
  },
]

export function sourceRule(s: DocSpec): string {
  const m = SOURCE_MODES.find((x) => x.key === (s.sources || 'given')) || SOURCE_MODES[0]
  return `자료의 울타리 — ${m.label}:\n${m.rule}`
}

const HTML_RULE = [
  '결과는 문서 본문만 낸다. 인사말 · 설명 · 「알겠습니다」 같은 말을 앞뒤에 붙이지 않는다.',
  'HTML 로만 적는다. 마크다운(#, **, - )을 쓰지 않고, 코드 울타리(```)로 감싸지 않는다.',
  '쓸 수 있는 것: <h1> <h2> <h3> <p> <ul> <ol> <li> <strong> <em> <blockquote> <table> <thead> <tbody> <tr> <th> <td> <hr>',
  '<h1> 은 문서 제목 하나만. 큰 절은 <h2>, 그 아래는 <h3>.',
  '표는 <table><thead><tr><th>…</th></tr></thead><tbody>…</tbody></table> 꼴로 온전히 적는다.',
  '<style> <script> class= style= 같은 것은 넣지 않는다.',
].join('\n')

const QUALITY_RULE = [
  '모르는 사실 · 수치 · 이름을 지어내지 않는다. 채워야 할 자리는 【확인: 무엇】 으로 남긴다.',
  '  (예: 【확인: 2025년 매출액】, 【확인: 담당 부서】) — 그럴듯한 가짜 숫자보다 빈자리가 낫다.',
  '겉치레 문장을 쓰지 않는다: 「본 문서는 …에 대해 살펴본다」, 「다양한 노력이 필요하다」,',
  '  「급변하는 시대에」, 「아무쪼록」, 「~라고 할 수 있다」.',
  '한 문단은 세 문장 안. 한 문장은 한 가지 뜻만.',
  '뭉뚱그리는 말(여러 가지, 다양한, 상당한, 적절한)을 숫자나 이름으로 바꾼다.',
  '늘어놓기만 하지 않는다 — 견주고 고르고 그 까닭을 적는다.',
  '표는 두 개 이상 넣는다. 눈으로 견줄 것은 문장이 아니라 표로 적는다.',
  '같은 말을 절마다 되풀이하지 않는다.',
].join('\n')

function spec(s: DocSpec): string {
  const kind = docKind(s.kind)
  const len = LENGTHS.find((l) => l.key === s.length) || LENGTHS[1]
  const tone = TONES.find((t) => t.key === s.tone) || TONES[1]
  return [
    `문서 갈래: ${kind.label}`,
    `주제: ${s.topic}`,
    s.reader.trim() ? `읽는 사람: ${s.reader.trim()}` : '',
    `분량: ${len.words}`,
    `말투: ${tone.label}\n${tone.rule}`,
    s.extra.trim() ? `반드시 담을 것 · 알려 주는 사실:\n${s.extra.trim()}` : '',
  ].filter(Boolean).join('\n')
}

const ROLE = '너는 이 갈래의 문서를 20년 써 온 사람이다. 실제로 결재를 받고 고객에게 나가는 문서를 쓴다.'

/** 1단계 — 목차를 먼저 받는다 (사람이 손볼 수 있게) */
export function outlinePrompt(s: DocSpec): string {
  const kind = docKind(s.kind)
  return [
    ROLE,
    '',
    '먼저 목차만 짠다. 본문은 아직 쓰지 않는다.',
    '',
    spec(s),
    '',
    '이 갈래의 뼈대:',
    kind.frame,
    '',
    '목차를 이렇게 낸다:',
    '- 절마다 한 줄: 「번호. 제목 — 여기에 담을 것 (분량)」',
    '- 뼈대를 따르되, 이 주제에 없는 절은 빼고 필요한 절은 더한다',
    '- 표가 들어갈 절에는 「표: 무엇을 견주는 표」 라고 적는다',
    '- 다른 말 없이 목차만 낸다 (평문, HTML 아님)',
  ].join('\n')
}

/** 2단계 — 목차대로 본문을 채운다 */
export function writePrompt(s: DocSpec, outline: string): string {
  return [
    ROLE,
    '',
    '아래 목차대로 문서를 완성한다.',
    '',
    spec(s),
    '',
    '목차:',
    outline.trim(),
    '',
    '지킬 것:',
    QUALITY_RULE,
    '',
    sourceRule(s),
    '',
    HTML_RULE,
  ].join('\n')
}

/** 한 걸음에 바로 — 목차를 안 보고 곧장 문서를 받는다 */
export function directPrompt(s: DocSpec): string {
  const kind = docKind(s.kind)
  return [
    ROLE,
    '',
    '아래 조건으로 문서 한 벌을 완성한다.',
    '',
    spec(s),
    '',
    '이 갈래의 뼈대 (주제에 맞게 덜고 더한다):',
    kind.frame,
    '',
    '지킬 것:',
    QUALITY_RULE,
    '',
    sourceRule(s),
    '',
    HTML_RULE,
  ].join('\n')
}

/* ── 받아 온 답을 문서에 넣을 수 있는 꼴로 ───────────────────────────── */

const TAGS = /^(H1|H2|H3|H4|P|UL|OL|LI|STRONG|EM|B|I|U|S|BLOCKQUOTE|TABLE|THEAD|TBODY|TFOOT|TR|TH|TD|BR|HR)$/
const KEEP_ATTR = /^(colspan|rowspan)$/

/** 코드 울타리를 벗긴다 — 시키지 않아도 ```html 로 감싸 오는 모델이 있다 */
function unfence(text: string): string {
  const t = text.trim()
  const m = /^```[a-z]*\s*\n([\s\S]*?)\n?```$/i.exec(t)
  return (m ? m[1] : t).trim()
}

/** 마크다운으로 온 답을 표까지 살려 HTML 로 옮긴다 (HTML 로 달라 해도 더러 그냥 온다) */
export function markdownToHtml(md: string): string {
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  let table: string[][] | null = null

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }
  const closeTable = () => {
    if (!table || table.length === 0) { table = null; return }
    const [head, ...rows] = table
    const th = head.map((c) => `<th>${inline(c)}</th>`).join('')
    const body = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
    out.push(`<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`)
    table = null
  }

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) { closeList(); closeTable(); continue }

    /* 표 — | 로 나눈 줄이 이어지는 동안 모은다 (--- 로만 된 줄은 가름줄이라 버린다) */
    if (/^\|.*\|$/.test(line)) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim())
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue
      closeList()
      table = table || []
      table.push(cells)
      continue
    }
    closeTable()

    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue }

    const ul = /^[-*+]\s+(.*)$/.exec(line)
    if (ul) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul' }
      out.push(`<li>${inline(ul[1])}</li>`)
      continue
    }
    const ol = /^\d+[.)]\s+(.*)$/.exec(line)
    if (ol) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol' }
      out.push(`<li>${inline(ol[1])}</li>`)
      continue
    }
    if (/^([-*_])\1{2,}$/.test(line)) { closeList(); out.push('<hr>'); continue }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) { closeList(); out.push(`<blockquote><p>${inline(quote[1])}</p></blockquote>`); continue }

    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  closeTable()
  return out.join('')
}

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 굵게 · 기울임만 옮긴다 */
function inline(t: string): string {
  return esc(t)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<strong>$1</strong>')
}

/**
 * 받아 온 HTML 에서 문서에 넣어도 되는 것만 남긴다.
 * 모델이 낸 글이므로 <script> 나 onclick 이 섞여 들어올 길을 아예 끊는다.
 */
export function cleanDocHtml(html: string): string {
  const doc = new DOMParser().parseFromString('<div id="jan-root">' + html + '</div>', 'text/html')
  const root = doc.getElementById('jan-root')
  if (!root) return ''

  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      walk(child)
      if (!TAGS.test(child.tagName)) {
        /* 허락하지 않은 껍데기는 벗기고 안의 글만 살린다 */
        child.replaceWith(...[...child.childNodes])
        continue
      }
      for (const attr of [...child.attributes]) {
        if (!KEEP_ATTR.test(attr.name)) child.removeAttribute(attr.name)
      }
    }
  }
  root.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((n) => n.remove())
  walk(root)
  return root.innerHTML.trim()
}

/** 모델이 무엇으로 답했든 문서에 넣을 HTML 로 만든다 */
export function htmlFromAi(text: string): string {
  const body = unfence(text || '')
  if (!body) return ''
  /* 태그가 거의 없으면 마크다운으로 온 것이다 */
  const tagged = (body.match(/<(h[1-4]|p|ul|ol|li|table)\b/gi) || []).length
  const html = tagged >= 2 ? body : markdownToHtml(body)
  return cleanDocHtml(html)
}

export interface WriteResult {
  ok: boolean
  html?: string
  error?: string
  /** 몇 자를 받았나 */
  chars?: number
}

function tokensFor(length: DocLength): number {
  return (LENGTHS.find((l) => l.key === length) || LENGTHS[1]).tokens
}

/** 목차 한 벌을 받는다 */
export async function makeOutline(s: DocSpec): Promise<{ ok: boolean; outline?: string; error?: string }> {
  if (!s.topic.trim()) return { ok: false, error: '무엇을 만들지 한 줄 적으세요' }
  const r = await chatAi(outlinePrompt(s), { maxTokens: 1200, timeoutMs: 60000 })
  if (!r.ok) return { ok: false, error: r.error }
  const outline = unfence(r.text || '')
  if (!outline) return { ok: false, error: '목차가 비어 돌아왔다 — 다시 부탁해 보세요' }
  return { ok: true, outline }
}

/** 문서를 쓴다 — 목차를 주면 그대로 채우고, 없으면 곧장 쓴다 */
export async function writeDoc(s: DocSpec, outline?: string): Promise<WriteResult> {
  if (!s.topic.trim()) return { ok: false, error: '무엇을 만들지 한 줄 적으세요' }
  const prompt = outline?.trim() ? writePrompt(s, outline) : directPrompt(s)
  const r = await chatAi(prompt, { maxTokens: tokensFor(s.length), timeoutMs: 240000 })
  if (!r.ok) return { ok: false, error: r.error }
  const html = htmlFromAi(r.text || '')
  if (!html) return { ok: false, error: '문서가 비어 돌아왔다 — 분량을 줄이거나 다시 부탁해 보세요' }
  return { ok: true, html, chars: html.replace(/<[^>]+>/g, '').length }
}

/**
 * 회의 · 강의를 받아 적은 글을 문서로 세운다.
 * 녹취록은 말이 겹치고 되풀이되므로, 짜임을 세우는 일이 절반이다.
 */
export async function writeFromTranscript(
  transcript: string,
  kind: 'meeting' | 'lecture',
  title: string,
  /* 받아 적은 글은 기본이 「준 자료만」 이다 — 회의록에 밖의 이야기가 섞이면
     그것이 회의에서 나온 말인지 알 수 없게 된다. 강의 노트는 사람이 넓힐 수 있다. */
  sources: DocSources = 'given',
): Promise<WriteResult> {
  const body = transcript.trim()
  if (!body) return { ok: false, error: '받아 적은 글이 없다' }
  const k = docKind(kind)
  const prompt = [
    ROLE,
    '',
    `아래는 ${kind === 'meeting' ? '회의' : '강의'}를 받아 적은 글이다. 이것으로 ${k.label} 한 벌을 만든다.`,
    title.trim() ? `제목: ${title.trim()}` : '',
    '',
    '이 갈래의 뼈대:',
    k.frame,
    '',
    '받아 적은 글을 다룰 때:',
    '- 말한 순서가 아니라 뼈대의 순서로 옮긴다',
    '- 되풀이된 말과 잡담은 버린다',
    '- 누가 말했는지가 뜻이 있는 대목만 이름을 남긴다',
    '- 글에 없는 결정 · 숫자 · 기한을 지어내지 않는다. 흐릿한 것은 【확인: 무엇】 으로 남긴다',
    kind === 'meeting'
      ? '- 「하기로 한다」 는 결정, 「해 보자」 는 할 일로 갈라 적는다'
      : '- 강사가 짚어 준 핵심과 흘려 말한 곁가지를 갈라 적는다',
    '',
    '지킬 것:',
    QUALITY_RULE,
    '',
    sourceRule({ sources } as DocSpec),
    '',
    HTML_RULE,
    '',
    '받아 적은 글:',
    body.slice(0, 24000),
  ].filter(Boolean).join('\n')

  const r = await chatAi(prompt, { maxTokens: 8000, timeoutMs: 240000 })
  if (!r.ok) return { ok: false, error: r.error }
  const html = htmlFromAi(r.text || '')
  if (!html) return { ok: false, error: '문서가 비어 돌아왔다' }
  return { ok: true, html, chars: html.replace(/<[^>]+>/g, '').length }
}

/** 문서 자동 작성 창을 연다 */
export function openAiWrite(kind?: string): void {
  window.dispatchEvent(new CustomEvent('jan-ai-write', { detail: { kind } }))
}

/**
 * 기능 설명 카드에 들어갈 내용.
 *
 * 아이콘만 봐서는 무슨 기능인지 알 수 없다 — 처음 쓰는 사람이 마우스를 올렸을 때
 * "무엇을 하는지 / 언제 쓰면 좋은지"가 한눈에 들어오도록 그림과 함께 보여 준다.
 *
 * art 는 components/HelpArt 의 그림 이름이다.
 */
export interface FeatureGuide {
  /** 카드 제목 */
  title: string
  /** 한 줄 요약 — 무엇을 하는 기능인가 */
  summary: string
  /** 이럴 때 쓴다 — 구체적인 상황 */
  when?: string
  /** 단축키 */
  shortcut?: string
  /** 함께 보면 좋은 기능 */
  also?: string
  /** 그림 이름 (HelpArt) */
  art?: string
}

export const FEATURE_GUIDE: Record<string, FeatureGuide> = {
  'cmd-palette': {
    title: '명령 팔레트',
    summary: '이 앱의 모든 기능을 이름으로 찾아 바로 실행합니다. 메뉴 위치를 몰라도 됩니다.',
    when: '"표", "쪽 나눔", "PDF" 처럼 하고 싶은 일을 적으면 관련 명령이 걸러져 나옵니다.',
    shortcut: 'Ctrl+Shift+P',
    also: '문서 안 글자를 찾을 때는 전체 검색',
    art: 'palette',
  },
  'global-search': {
    title: '전체 검색',
    summary: '지금 문서가 아니라 저장된 모든 메모의 본문·제목·태그를 한 번에 뒤집니다.',
    when: '어느 메모에 썼는지 기억나지 않는 문장을 찾을 때.',
    shortcut: 'Ctrl+Shift+F',
    art: 'search',
  },
  ai: {
    title: 'AI 도우미',
    summary: '선택한 문단을 다듬고, 요약하고, 이어 쓰고, 표로 정리합니다.',
    when: '초안을 정리하거나 긴 회의록에서 결론만 뽑아낼 때.',
    shortcut: 'Ctrl+/',
    also: '문서 전체 대화는 AI 탭의 문서 채팅',
    art: 'ai',
  },
  'quick-memo': {
    title: '빠른 메모',
    summary: '문서를 벗어나지 않고 작은 창에 즉시 적어 두는 임시 메모장입니다.',
    when: '통화 중 받아 적을 때처럼 지금 문서를 건드리기 싫을 때.',
    shortcut: 'Ctrl+Shift+J',
    art: 'quick',
  },
  focus: {
    title: '집중 모드',
    summary: '사이드바와 도구를 감추고 종이만 남깁니다. 다시 누르면 돌아옵니다.',
    when: '초안을 길게 쓸 때, 화면의 방해 요소를 없애고 싶을 때.',
    shortcut: 'F11',
    art: 'focus',
  },
  roles: {
    title: '내 도구 · 역할 팩',
    summary: '직업·역할에 맞는 서식과 도구 묶음입니다. 고르면 리본과 템플릿이 그 일에 맞게 바뀝니다.',
    when: '교사·연구자·기획자처럼 자주 쓰는 문서 형식이 정해져 있을 때.',
    art: 'roles',
  },
  theme: {
    title: '테마',
    summary: '밝게 / 어둡게 / 시스템 설정 따르기를 번갈아 바꿉니다.',
    when: '야간 작업이나 눈이 부실 때.',
    art: 'theme',
  },
  settings: {
    title: '설정',
    summary: '저장 위치, 동기화, AI 키, 맞춤법, 자동 저장 주기 등 앱 전체 설정입니다.',
    shortcut: 'Ctrl+,',
    art: 'settings',
  },
  account: {
    title: '계정 · 로그인',
    summary: '로그인하면 여러 기기에서 같은 메모를 볼 수 있습니다. 로그인 없이도 모든 기능이 동작합니다.',
    when: '집과 사무실에서 같은 문서를 이어서 쓸 때.',
    art: 'account',
  },
  more: {
    title: '더보기',
    summary: '자주 쓰지 않는 도구를 모아 둔 곳입니다 — 그림판, OCR, 명함, 공유, 동기화, 도움말 등.',
    when: '헤더에는 자주 쓰는 것만 두고 나머지는 여기에서 찾습니다.',
    art: 'more',
  },
  paint: {
    title: '그림판',
    summary: '문서에 넣을 그림을 직접 그리고, 넣어 둔 이미지 위에 주석을 답니다.',
    when: '화면 캡처에 화살표와 설명을 얹을 때.',
    art: 'paint',
  },
  ocr: {
    title: '글자 인식 (OCR)',
    summary: '사진·스캔 이미지 속 글자를 읽어 편집할 수 있는 텍스트로 바꿉니다.',
    when: '종이 문서를 찍어 와서 다시 타이핑하기 싫을 때.',
    art: 'ocr',
  },
  postit: {
    title: 'JustPin 포스트잇',
    summary: '화면 위에 항상 떠 있는 작은 쪽지입니다. 앱을 닫아도 남습니다.',
    when: '할 일이나 전화번호를 눈에 보이게 붙여 둘 때.',
    art: 'postit',
  },
  share: {
    title: '공유',
    summary: '지금 문서를 링크 하나로 만들어 읽기 전용으로 보여 줍니다. 서버 저장 없이 링크 안에 담깁니다.',
    when: '가볍게 초안을 보여 주고 의견을 받을 때.',
    art: 'share',
  },
  sync: {
    title: '동기화',
    summary: '내 저장소(개인 클라우드)와 메모를 맞춰 둡니다. 기기를 바꿔도 이어서 씁니다.',
    art: 'sync',
  },
  help: {
    title: '도움말',
    summary: '단축키 목록과 기능 안내를 봅니다.',
    shortcut: 'F1',
    art: 'help',
  },
  'web-search': {
    title: '웹 검색',
    summary: '앱을 벗어나지 않고 옆 창에서 자료를 찾아 문서로 끌어옵니다.',
    when: '인용할 자료나 출처를 확인할 때.',
    art: 'web',
  },
  cards: {
    title: '명함 · 카드',
    summary: '명함 사진에서 이름·연락처를 뽑아 카드로 모아 둡니다.',
    when: '행사에서 받은 명함을 정리할 때.',
    art: 'cards',
  },
  'image-convert': {
    title: '이미지 변환',
    summary: 'HEIC·PNG·JPG 형식을 바꾸고 크기를 줄여 문서에 가볍게 넣습니다.',
    art: 'image',
  },
  home: {
    title: '홈 허브',
    summary: '최근에 연 메모를 모아 보여 줍니다. 목록에서 바로 이동합니다.',
    art: 'home',
  },
  about: {
    title: '버전 · 변경 내역',
    summary: '지금 버전과 무엇이 새로 들어왔는지 봅니다.',
    art: 'help',
  },
  cms: {
    title: 'CMS 관리자',
    summary: '운영자용 관리 화면입니다. 일반 사용에는 필요하지 않습니다.',
    art: 'settings',
  },
  lecture: {
    title: '강의 노트',
    summary: '녹음과 받아쓰기를 함께 켜고 강의용 서식으로 문서를 시작합니다.',
    when: '수업이나 세미나를 들으며 정리할 때.',
    art: 'mic',
  },
  meeting: {
    title: '회의 노트',
    summary: '참석자·안건·결정·할 일 칸이 있는 회의록 서식으로 시작합니다. 녹음·받아쓰기도 함께.',
    when: '회의를 진행하며 바로 정리할 때.',
    art: 'meeting',
  },
  pomodoro: {
    title: '집중 타이머',
    summary: '25분 집중 / 5분 휴식을 재 줍니다. 누르면 멈춥니다.',
    art: 'timer',
  },

  /* ── 리본에서 자주 찾는 기능 — 키는 'ribbon:' + 리본에 적힌 이름 ── */
  'ribbon:표 (3×3)': {
    title: '표 넣기',
    summary: '3행 3열 표를 넣습니다. 넣은 뒤에는 리본에 표 탭이 나타나 행·열 추가, 셀 병합, 합계·평균까지 이어서 할 수 있습니다.',
    when: '숫자나 항목을 견주어 보여 줄 때. 표 안에서 Tab 키로 칸을 옮깁니다.',
    art: 'table',
  },
  'ribbon:목차 (제목 기반 자동 생성)': {
    title: '목차 만들기',
    summary: '문서의 제목 1~3 을 훑어 목차를 자동으로 만듭니다. 제목을 고치고 다시 누르면 새로 만들어집니다.',
    when: '보고서·논문처럼 앞에 차례가 필요한 문서.',
    art: 'toc',
  },
  'ribbon:각주 삽입': {
    title: '각주',
    summary: '커서 자리에 각주 번호를 넣고 쪽 아래에 설명 줄을 만듭니다. 번호는 자동으로 다시 매겨집니다.',
    when: '출처를 밝히거나 본문 흐름을 끊지 않고 덧붙일 때.',
    art: 'footnote',
  },
  'ribbon:수식 스튜디오 (전 분야 기호·공식)': {
    title: '수식',
    summary: '분수·적분·행렬·화학식을 골라 넣고, LaTeX 로도 직접 씁니다. 문장 안에 섞여 들어갑니다.',
    when: '이공계 보고서나 시험지를 만들 때.',
    art: 'formula',
  },
  'ribbon:다이어그램 (Mermaid)': {
    title: '다이어그램',
    summary: '글로 적으면 순서도·조직도로 그려 줍니다(Mermaid). 그림 파일 없이 문서 안에서 고칠 수 있습니다.',
    when: '업무 흐름이나 구조를 설명할 때.',
    art: 'diagram',
  },
  'ribbon:그림판 (그리기·손글씨·도형)': {
    title: '그림판',
    summary: '문서에 넣을 그림을 직접 그리고, 넣어 둔 이미지 위에 주석을 답니다.',
    when: '화면 캡처에 화살표와 설명을 얹을 때.',
    art: 'paint',
  },
}

export function getGuide(id: string): FeatureGuide | null {
  return FEATURE_GUIDE[id] || null
}

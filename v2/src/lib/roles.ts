import type { IconName } from '../components/Icons'
import { V1_EXTRA_ROLES, V1_ROLE_TEMPLATE_ADDITIONS } from './v1RoleTemplates'

export type RoleToolId =
  | 'timetable'
  | 'ledger'
  | 'gpa'
  | 'dday'
  | 'med'
  | 'vital'
  | 'shop'
  | 'meal'
  | 'timetrack'
  | 'attendance'
  | 'groupProj'
  | 'examPlan'
  | 'projPipe'
  | 'paperList'

export interface RoleTemplate {
  name: string
  html: string
}

export interface Role {
  id: string
  name: string
  icon: IconName
  color: string
  desc: string
  tools: RoleToolId[]
  templates: RoleTemplate[]
}

export interface RoleTool {
  id: RoleToolId
  name: string
  desc: string
  icon: IconName
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}

let roleTemplateDocumentSeq = 0

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function roleTemplateYmd(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
}

function nextRoleTemplateInvoiceNo(date: Date): string {
  roleTemplateDocumentSeq = (roleTemplateDocumentSeq % 99999) + 1
  return `INV-${roleTemplateYmd(date)}-${String(roleTemplateDocumentSeq).padStart(5, '0')}`
}

export function formatRoleTemplateDate(date = new Date()): string {
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`
}

export function materializeRoleTemplateHtml(html: string, date = new Date()): string {
  const rendered = html
    .replace(/2026\. 4\. 26\./g, formatRoleTemplateDate(date))
    .replace(/PRD-2026-001/g, `PRD-${date.getFullYear()}-001`)

  return /INV-(?:1777180963006|\d{13})/.test(rendered)
    ? rendered.replace(/INV-(?:1777180963006|\d{13})/g, nextRoleTemplateInvoiceNo(date))
    : rendered
}

export function materializeRoleTemplate(template: RoleTemplate, date = new Date()): RoleTemplate {
  return { ...template, html: materializeRoleTemplateHtml(template.html, date) }
}

const table = (rows: string) => `<table><tbody>${rows}</tbody></table>`
const row = (...cells: string[]) => `<tr>${cells.map((c, i) => (i % 2 === 0 ? `<th>${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`
const checklist = (items: string[]) => items.map((it) => `<ul data-type="taskList"><li data-type="taskItem" data-checked="false">${it}</li></ul>`).join('')

const meeting = (): string => `<h2>회의록 — ${today()}</h2>
${table(`${row('참석자', '', '장소', '')}${row('안건', '', '주관', '')}`)}
<h3>아젠다</h3><ol><li></li><li></li></ol>
<h3>논의</h3><p></p>
<h3>결정 사항</h3><ul><li></li></ul>
<h3>액션 아이템</h3><table><tbody><tr><th>담당</th><th>내용</th><th>마감</th></tr><tr><td></td><td></td><td></td></tr></tbody></table>`

const weeklyReport = (): string => `<h2>주간 리포트 — ${today()}</h2>
<h3 style="color:#2e7d32;">이번 주 완료</h3><ul><li></li></ul>
<h3 style="color:#1976d2;">진행 중</h3><ul><li></li></ul>
<h3 style="color:var(--accent);">다음 주 계획</h3><ul><li></li></ul>
<h3 style="color:#d32f2f;">리스크</h3><ul><li></li></ul>`

const studyNote = (): string => `<h2>학습 노트 — [주제]</h2>
<h3>핵심 개념</h3><ul><li></li></ul>
<h3>예제</h3><pre><code></code></pre>
<h3>이해 점검</h3><ol><li></li><li></li></ol>
<h3>참고 자료</h3><ul><li></li></ul>`

const prd = (): string => `<h1>PRD — [기능명]</h1>
${table(`${row('문서 ID', `PRD-${new Date().getFullYear()}-001`, '상태', '초안')}${row('작성자', '', '업데이트', today())}`)}
<h2>문제 정의</h2>
${table(`${row('문제', '고객의 어떤 문제를 해결하나')}${row('대상 사용자', '세그먼트·볼륨')}${row('현재 우회책', '지금은 어떻게 해결하나')}${row('안 하면 잃는 것', '기회비용')}`)}
<h2>성공 지표</h2>
<table><tbody><tr><th>지표</th><th>Baseline</th><th>목표</th><th>측정</th></tr><tr><td>Primary</td><td></td><td></td><td></td></tr><tr><td>Secondary</td><td></td><td></td><td></td></tr><tr><td>Guardrail</td><td></td><td></td><td></td></tr></tbody></table>
<h2>요구사항</h2>
<table><tbody><tr><th>우선순위</th><th>요구사항</th><th>수용 기준</th></tr><tr><td>MUST</td><td></td><td>Given/When/Then</td></tr><tr><td>SHOULD</td><td></td><td></td></tr><tr><td>COULD</td><td></td><td></td></tr></tbody></table>
<h2>릴리스 계획</h2>${checklist(['디자인 리뷰', '개발 시작', 'QA', '출시'])}`

const sprint = (): string => `<h1>스프린트 계획</h1>
${table(`${row('기간', `${today()} ~`, '목표', '한 문장')}${row('Capacity', '__일 × __명', 'Velocity', '지난 평균 __')}`)}
<h2>커밋 티켓</h2>
<table><tbody><tr><th>#</th><th>티켓</th><th>담당</th><th>SP</th><th>리스크</th></tr><tr><td>1</td><td></td><td></td><td></td><td></td></tr><tr><td>2</td><td></td><td></td><td></td><td></td></tr></tbody></table>
<h2>리스크 & 완화책</h2><ul><li></li></ul>`

const paper = (): string => `<h2>논문 리뷰</h2>
<p><b>제목:</b> </p><p><b>저자:</b> </p><p><b>DOI:</b> </p>
<h3>핵심 요약</h3><p></p>
<h3>방법론</h3><p></p>
<h3>결과</h3><p></p>
<h3>비판 / 인사이트</h3><p></p>`

const experiment = (): string => `<h2>실험 노트 — ${today()}</h2>
<h3>목적</h3><p></p>
<h3>프로토콜</h3><p></p>
<h3>결과</h3><p></p>
<h3>고찰</h3><p></p>`

const designReview = (): string => `<h2>디자인 리뷰 — [프로젝트]</h2>
${table(`${row('일시', today(), 'Figma', 'link')}${row('참석자', '', '단계', '와이어 / 시안 / 고충실도')}`)}
<h3>리뷰 목표</h3><p></p>
<h3>좋았던 점</h3><ul><li></li></ul>
<h3>개선 포인트</h3>
<table><tbody><tr><th>P</th><th>이슈</th><th>근거</th><th>제안</th><th>결정</th></tr><tr><td>P0</td><td></td><td></td><td></td><td></td></tr><tr><td>P1</td><td></td><td></td><td></td><td></td></tr></tbody></table>`

const interview = (): string => `<h2>유저 인터뷰 계획 — [주제]</h2>
<h3>연구 질문</h3><ol><li></li><li></li><li></li></ol>
<h3>스크리너</h3><table><tbody><tr><th>기준</th><th>포함 / 제외</th></tr><tr><td>세그먼트</td><td></td></tr><tr><td>제품 사용 빈도</td><td></td></tr></tbody></table>
<h3>인터뷰 가이드</h3><ol><li>배경</li><li>최근 행동</li><li>문제 상황</li><li>대안 탐색</li><li>마무리</li></ol>`

const techSpec = (): string => `<h1>기술 스펙 — [제목]</h1>
${table(`${row('작성자', '', '상태', '초안')}${row('리뷰어', '', '날짜', today())}`)}
<h2>TL;DR (3줄)</h2><p></p>
<h2>Context &amp; 문제</h2><p></p>
<h2>목표 &amp; 비목표</h2>
${table(`<tr><th>In Scope</th><th>Out of Scope</th></tr><tr><td></td><td></td></tr>`)}
<h2>제안 설계 (아키텍처)</h2><p>주요 컴포넌트, 데이터 흐름, DB 스키마…</p>
<h2>대안과 trade-off</h2>
${table(`<tr><th>옵션</th><th>장점</th><th>단점</th><th>선택</th></tr><tr><td>A</td><td></td><td></td><td>선택</td></tr><tr><td>B</td><td></td><td></td><td></td></tr>`)}
<h2>리스크·보안·성능·마이그레이션</h2>
<ul><li><b>성능:</b> </li><li><b>보안:</b> </li><li><b>마이그레이션:</b> </li><li><b>롤백:</b> </li></ul>
<h2>일정 &amp; 마일스톤</h2>${checklist(['Design 리뷰 완료', 'Feature flag 배포', '점진적 출시 10% → 50% → 100%', '문서·운영 가이드 업데이트'])}`

const codeReview = (): string => `<h2>코드 리뷰 체크리스트</h2>
<h3>기능</h3>${checklist(['요구사항 구현', '엣지 케이스 처리', '기존 기능 회귀 없음'])}
<h3>안전성</h3>${checklist(['입력 검증', '민감 정보 로그 없음', '동시성 문제 없음'])}
<h3>테스트</h3>${checklist(['단위 테스트', '실제 동작 검증', 'QA 체크 완료'])}`

const financeReport = (): string => `<h2>월간 재무 점검 — ${today()}</h2>
<table><tbody><tr><th>항목</th><th>예산</th><th>실제</th><th>차이</th></tr><tr><td>수입</td><td></td><td></td><td></td></tr><tr><td>지출</td><td></td><td></td><td></td></tr><tr><td>저축</td><td></td><td></td><td></td></tr></tbody></table>
<h3>다음 액션</h3><ul><li></li></ul>`

const healthMemo = (): string => `<h2>건강 기록 — ${today()}</h2>
${table(`${row('혈압', '', '혈당', '')}${row('복용 약', '', '증상', '')}`)}
<h3>의사에게 물어볼 것</h3><ul><li></li></ul>`

const daily = (): string => `<h2>${new Date().toLocaleDateString('ko-KR')} 일기</h2>
<p>날씨: </p><p>기분: </p><p>오늘 있었던 일: </p><p>내일 할 일: </p>`

const assignment = (): string => `<h2>과제 트래커</h2>
<table><tbody><tr><th>과목</th><th>과제명</th><th>마감일</th><th>상태</th></tr><tr><td></td><td></td><td></td><td>진행중</td></tr></tbody></table>`

const wrongAnswer = (): string => `<h2>오답노트 — ${today()}</h2>
<table><tbody><tr><th>과목</th><th>문제</th><th>내 답</th><th>정답</th><th>해설</th><th>재풀이</th></tr><tr><td></td><td></td><td></td><td></td><td></td><td>□</td></tr></tbody></table>`

const recipe = (): string => `<h2>레시피 — [요리명]</h2>
${table(`${row('인분', '__', '시간', '__분')}`)}
<h3>재료</h3><ul><li></li></ul>
<h3>조리 순서</h3><ol><li></li></ol>
<h3>팁</h3><ul><li></li></ul>`

export const ROLE_TOOLS: Record<RoleToolId, RoleTool> = {
  timetable: { id: 'timetable', name: '시간표', desc: '월~금 강의·업무 시간표', icon: 'table' },
  ledger: { id: 'ledger', name: '가계부', desc: '수입·지출·월별 요약', icon: 'hash' },
  gpa: { id: 'gpa', name: 'GPA 계산기', desc: '학점 평균 계산', icon: 'hash' },
  dday: { id: 'dday', name: 'D-Day', desc: '시험·일정 카운트다운', icon: 'clock' },
  med: { id: 'med', name: '약 복용', desc: '오늘 복용 체크', icon: 'heart' },
  vital: { id: 'vital', name: '혈압·혈당', desc: '건강 수치 기록', icon: 'heart' },
  shop: { id: 'shop', name: '장보기', desc: '카테고리별 체크리스트', icon: 'list-check' },
  meal: { id: 'meal', name: '식단', desc: '주간 아침·점심·저녁 계획', icon: 'table' },
  timetrack: { id: 'timetrack', name: '타임 트래킹', desc: '작업별 시간 기록', icon: 'clock' },
  attendance: { id: 'attendance', name: '출결 관리', desc: '과목별 출석률', icon: 'check' },
  groupProj: { id: 'groupProj', name: '조별과제', desc: '팀 역할·마감 관리', icon: 'users' },
  examPlan: { id: 'examPlan', name: '시험 계획표', desc: '시험·공부 계획', icon: 'page' },
  projPipe: { id: 'projPipe', name: '프로젝트 파이프라인', desc: '업무 단계 관리', icon: 'kanban' },
  paperList: { id: 'paperList', name: '논문 리딩 리스트', desc: '논문 상태 추적', icon: 'file-text' },
}

const CORE_ROLES: Role[] = [
  { id: 'elementary', name: '초등학생', icon: 'palette', color: '#ff9800', desc: '그림일기·숙제·받아쓰기', tools: ['dday', 'shop'], templates: [{ name: '오늘의 일기', html: daily() }, { name: '숙제 체크리스트', html: checklist(['국어 숙제', '수학 숙제', '영어 숙제']) }] },
  { id: 'middle', name: '중학생', icon: 'file-text', color: '#29b6f6', desc: '시간표·시험·단어장', tools: ['timetable', 'examPlan', 'dday'], templates: [{ name: '영단어장', html: '<h2>영단어장</h2><p>Q: apple<br>A: 사과</p><p>Q: school<br>A: 학교</p>' }, { name: '과목별 노트', html: studyNote() }] },
  { id: 'high', name: '고등학생', icon: 'focus', color: '#ef5350', desc: '수능 D-Day·오답노트·학습 타이머', tools: ['timetable', 'examPlan', 'dday'], templates: [{ name: '오답노트', html: wrongAnswer() }, { name: '모의고사 기록', html: '<h2>모의고사 성적</h2><table><tbody><tr><th>회차</th><th>국어</th><th>수학</th><th>영어</th><th>탐구</th><th>총점</th></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>' }] },
  { id: 'college', name: '대학생', icon: 'cards', color: '#4caf50', desc: '강의 시간표·GPA·과제', tools: ['timetable', 'gpa', 'attendance', 'groupProj', 'dday'], templates: [{ name: '과제 트래커', html: assignment() }, { name: '조별 과제 노트', html: '<h2>조별 과제</h2><h3>팀원</h3><ul><li></li></ul><h3>역할 분담</h3><p></p><h3>진행 상황</h3><p></p>' }] },
  { id: 'grad', name: '대학원생', icon: 'file-text', color: '#7e57c2', desc: '논문 관리·연구노트·인용', tools: ['paperList', 'timetrack', 'dday'], templates: [{ name: '논문 노트', html: paper() }, { name: '실험 노트', html: experiment() }, { name: '지도교수 미팅', html: meeting() }] },
  { id: 'office-junior', name: '회사원(주니어)', icon: 'briefcase', color: '#26a69a', desc: '회의록·일정·To-do', tools: ['projPipe', 'timetrack', 'dday'], templates: [{ name: '회의록', html: meeting() }, { name: '오늘 할 일', html: `<h2>오늘 할 일 — ${today()}</h2>${checklist(['긴급·중요', '중요', '평소'])}` }] },
  { id: 'office-senior', name: '회사원(시니어/매니저)', icon: 'users', color: '#ef6c00', desc: '팀 미팅·프로젝트·1:1·OKR', tools: ['projPipe', 'timetrack', 'dday'], templates: [{ name: '1:1 미팅 노트', html: '<h2>1:1 미팅 — [상대]</h2><h3>체크인</h3><p></p><h3>업무 진행</h3><p></p><h3>커리어 논의</h3><p></p><h3>액션 아이템</h3><ul><li></li></ul>' }, { name: '주간 리포트', html: weeklyReport() }] },
  { id: 'freelancer', name: '프리랜서', icon: 'briefcase', color: '#8d6e63', desc: '견적서·타임트래킹·고객 CRM', tools: ['projPipe', 'timetrack', 'dday', 'ledger'], templates: [{ name: '견적서', html: '<h2>견적서</h2><p><b>고객:</b> </p><p><b>프로젝트:</b> </p><table><tbody><tr><th>항목</th><th>수량</th><th>단가</th><th>금액</th></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table><p><b>합계:</b> </p>' }, { name: '청구서', html: `<h2>청구서 #INV-${Date.now()}</h2><p><b>청구일:</b> ${today()}</p><p><b>지급 기한:</b> </p><p><b>입금 계좌:</b> </p>` }] },
  { id: 'homemaker', name: '가정주부', icon: 'heart', color: '#ec407a', desc: '가계부·장보기·식단·가족 일정', tools: ['ledger', 'shop', 'meal', 'dday'], templates: [{ name: '가족 일정', html: '<h2>가족 이번 달 일정</h2><table><tbody><tr><th>날짜</th><th>내용</th><th>참여자</th></tr><tr><td></td><td></td><td></td></tr></tbody></table>' }, { name: '요리 레시피', html: recipe() }] },
  { id: 'senior', name: '노년층', icon: 'heart', color: '#FAE100', desc: '약 복용·혈압·병원 일정', tools: ['med', 'vital', 'dday'], templates: [{ name: '병원 일정', html: healthMemo() }] },
  { id: 'pm', name: '기획자(PM/PO)', icon: 'focus', color: '#3f51b5', desc: 'PRD·스프린트·백로그·지표', tools: ['projPipe', 'timetrack', 'dday'], templates: [{ name: 'PRD', html: prd() }, { name: '스프린트 계획', html: sprint() }, { name: '제품 지표 리뷰', html: weeklyReport() }] },
  { id: 'designer', name: '디자이너(UX/UI)', icon: 'palette', color: '#e91e63', desc: '디자인 리뷰·유저 리서치', tools: ['timetrack', 'dday', 'projPipe'], templates: [{ name: '디자인 리뷰', html: designReview() }, { name: '유저 인터뷰 계획', html: interview() }] },
  { id: 'dev', name: '개발자', icon: 'code', color: '#607d8b', desc: '기술 스펙·코드 리뷰·인시던트', tools: ['projPipe', 'timetrack', 'dday'], templates: [{ name: '기술 스펙', html: techSpec() }, { name: '코드 리뷰 체크리스트', html: codeReview() }, { name: '개발 일지', html: `<h2>개발 일지 — ${today()}</h2><h3>오늘 한 일</h3><ul><li></li></ul><h3>막힌 곳</h3><ul><li></li></ul><h3>내일 할 일</h3><ul><li></li></ul>` }] },
  { id: 'data', name: '데이터 분석가', icon: 'hash', color: '#00bcd4', desc: 'SQL·대시보드·리포트', tools: ['projPipe', 'timetrack', 'dday'], templates: [{ name: '분석 리포트', html: weeklyReport() }, { name: 'SQL Playbook', html: '<h2>SQL Playbook</h2><pre><code>SELECT date_trunc(\'day\', created_at) AS day, count(*) FROM events GROUP BY 1;</code></pre><h3>결과 해석</h3><ul><li></li></ul>' }] },
  { id: 'marketer', name: '마케터', icon: 'send', color: '#ff5722', desc: '캠페인·카피·채널 분석', tools: ['projPipe', 'dday', 'timetrack'], templates: [{ name: '캠페인 브리프', html: '<h2>캠페인 브리프</h2><h3>목표</h3><ul><li></li></ul><h3>타깃</h3><p></p><h3>메시지</h3><ul><li></li></ul><h3>KPI</h3><table><tbody><tr><th>채널</th><th>예산</th><th>노출</th><th>전환</th></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>' }] },
  { id: 'sales', name: '영업', icon: 'phone', color: '#ffa726', desc: '리드·파이프라인·미팅 노트', tools: ['projPipe', 'timetrack', 'dday'], templates: [{ name: '영업 파이프라인', html: '<h2>영업 파이프라인</h2><table><tbody><tr><th>단계</th><th>건수</th><th>예상 가치</th><th>이번 주 액션</th></tr><tr><td>Qualified</td><td></td><td></td><td></td></tr><tr><td>Proposal</td><td></td><td></td><td></td></tr></tbody></table>' }, { name: '디스커버리 콜 노트', html: meeting() }] },
  { id: 'teacher', name: '교사·강사', icon: 'users', color: '#6d4c41', desc: '수업 계획·출결·시험', tools: ['attendance', 'examPlan', 'dday'], templates: [{ name: '수업 계획안', html: '<h2>수업 계획안</h2><h3>학습 목표</h3><ul><li></li></ul><h3>수업 흐름</h3><ol><li></li></ol><h3>평가</h3><p></p>' }, { name: '학습 노트', html: studyNote() }] },
  { id: 'researcher', name: '연구자', icon: 'file-text', color: '#3949ab', desc: '논문·실험·리딩 리스트', tools: ['paperList', 'timetrack', 'dday'], templates: [{ name: '논문 리뷰', html: paper() }, { name: '실험 노트', html: experiment() }] },
  { id: 'writer', name: '작가·콘텐츠', icon: 'file-text', color: '#5e35b1', desc: '원고·기획·출간 일정', tools: ['projPipe', 'dday', 'timetrack'], templates: [{ name: '글감 기획', html: '<h2>글감 기획</h2><h3>핵심 메시지</h3><p></p><h3>독자</h3><p></p><h3>구성</h3><ol><li></li></ol>' }] },
  { id: 'finance', name: '재무·회계', icon: 'hash', color: '#2e7d32', desc: '예산·정산·월간 리포트', tools: ['ledger', 'projPipe', 'dday'], templates: [{ name: '월간 재무 점검', html: financeReport() }] },
]

function mergeTemplates(base: RoleTemplate[], additions: RoleTemplate[]): RoleTemplate[] {
  const additionNames = new Set(additions.map((template) => template.name))
  return [...additions, ...base.filter((template) => !additionNames.has(template.name))]
}

const CORE_ROLES_WITH_V1_TEMPLATES = CORE_ROLES.map((role) => {
  const additions = V1_ROLE_TEMPLATE_ADDITIONS[role.id] || []
  return additions.length > 0 ? { ...role, templates: mergeTemplates(role.templates, additions) } : role
})

const CORE_ROLE_IDS = new Set(CORE_ROLES_WITH_V1_TEMPLATES.map((role) => role.id))

export const ROLES: Role[] = [
  ...CORE_ROLES_WITH_V1_TEMPLATES,
  ...V1_EXTRA_ROLES.filter((role) => !CORE_ROLE_IDS.has(role.id)),
]

export function findRole(id: string): Role | undefined {
  return ROLES.find((r) => r.id === id)
}

export function roleToolsFor(roleIds: string[]): RoleTool[] {
  const ids = new Set<RoleToolId>()
  roleIds.forEach((id) => {
    const role = findRole(id)
    role?.tools.forEach((tool) => ids.add(tool))
  })
  return [...ids].map((id) => ROLE_TOOLS[id]).filter(Boolean)
}

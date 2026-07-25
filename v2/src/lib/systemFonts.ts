/**
 * 이 컴퓨터에 깔린 글꼴 목록.
 *
 * 두 갈래로 모은다.
 *  1) Local Font Access API(queryLocalFonts) — 크롬/엣지에서 사용자가 허용하면 설치된 글꼴을 전부 준다.
 *     사용자 제스처(버튼 클릭) 안에서 불러야 하고 권한 창이 뜬다.
 *  2) 폴백: 잘 알려진 글꼴 이름을 하나씩 document.fonts.check 로 두드려 설치 여부를 확인한다.
 *     권한이 필요 없고 즉시 되지만, 미리 아는 이름만 찾을 수 있다.
 *
 * 결과는 localStorage 에 담아 다음 실행에서 바로 쓴다(글꼴을 새로 설치했으면 다시 불러오기).
 */

const CACHE_KEY = 'jan-v2-system-fonts'
const CACHE_VER = 1

export interface FontEntry {
  /** CSS font-family 값 (따옴표 포함해 그대로 쓸 수 있는 형태) */
  value: string
  /** 사람이 읽는 이름 */
  label: string
}

interface LocalFontData {
  family: string
  fullName?: string
  postscriptName?: string
  style?: string
}
type QueryLocalFonts = () => Promise<LocalFontData[]>

/** 윈도우·한글 환경에서 흔한 글꼴 — 폴백 탐지에 쓰는 후보 목록 */
const CANDIDATES: string[] = [
  // 한글
  '맑은 고딕', 'Malgun Gothic', '바탕', 'Batang', '바탕체', 'BatangChe', '돋움', 'Dotum', '돋움체', 'DotumChe',
  '굴림', 'Gulim', '굴림체', 'GulimChe', '궁서', 'Gungsuh', '궁서체', 'GungsuhChe', '휴먼명조', 'HY견고딕',
  'HY견명조', 'HY중고딕', 'HY얕은샘물M', 'HCR Batang', 'HCR Dotum', '함초롬바탕', '함초롬돋움',
  '나눔고딕', 'NanumGothic', '나눔명조', 'NanumMyeongjo', '나눔바른고딕', 'NanumBarunGothic',
  '나눔스퀘어', 'NanumSquare', '나눔손글씨 펜', '본고딕', 'Noto Sans KR', 'Noto Serif KR',
  'Pretendard', 'SUIT', 'Spoqa Han Sans Neo', 'KoPubWorld돋움체', 'KoPubWorld바탕체',
  'Gmarket Sans', '에스코어드림', 'S-Core Dream', '카페24 아네모네', '배달의민족 주아',
  // 라틴
  'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria', 'Candara', 'Century Gothic',
  'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Franklin Gothic Medium',
  'Garamond', 'Georgia', 'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Palatino Linotype',
  'Segoe UI', 'Segoe UI Semibold', 'Segoe Script', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
  'Verdana', 'Wingdings', 'Webdings', 'Symbol', 'Marlett', 'MS Gothic', 'MS Mincho',
  'Sitka Text', 'Bahnschrift', 'Ink Free', 'Gabriola', 'Microsoft Sans Serif', 'MV Boli',
  'Cascadia Code', 'Cascadia Mono', 'D2Coding', 'Fira Code', 'JetBrains Mono', 'Source Code Pro',
  // 중국어·일본어(윈도우 기본 포함)
  'SimSun', 'SimHei', 'Microsoft YaHei', 'Microsoft JhengHei', 'Meiryo', 'Yu Gothic', 'Yu Mincho',
  'MS PGothic', 'MS PMincho', 'Malgun Gothic Semilight',
]

/** CSS 에 넣을 때 따옴표가 필요한 이름이면 감싼다 */
export function cssFontValue(family: string): string {
  return /^[a-zA-Z0-9\-_ ]+$/.test(family) && !/\s\d/.test(family) ? family : `"${family.replace(/"/g, '')}"`
}

function readCache(): FontEntry[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v: number; fonts: FontEntry[] }
    if (parsed?.v !== CACHE_VER || !Array.isArray(parsed.fonts) || !parsed.fonts.length) return null
    return parsed.fonts
  } catch {
    return null
  }
}

function writeCache(fonts: FontEntry[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_VER, fonts }))
  } catch { /* 저장 실패는 무시 — 목록은 매번 다시 만들 수 있다 */ }
}

function toEntries(families: string[]): FontEntry[] {
  const seen = new Set<string>()
  const out: FontEntry[] = []
  for (const f of families) {
    const name = f.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push({ value: cssFontValue(name), label: name })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'ko'))
}

/** 권한 없이 즉시 되는 탐지 — 후보 이름을 두드려 설치된 것만 남긴다 */
export function detectInstalledFonts(candidates: string[] = CANDIDATES): FontEntry[] {
  if (typeof document === 'undefined' || !document.fonts?.check) return []
  const found: string[] = []
  for (const name of candidates) {
    try {
      if (document.fonts.check(`16px ${cssFontValue(name)}`)) found.push(name)
    } catch { /* 이름이 이상하면 건너뛴다 */ }
  }
  return toEntries(found)
}

/** 이 브라우저가 설치 글꼴 전체 목록을 줄 수 있는가 */
export function canQueryLocalFonts(): boolean {
  return typeof window !== 'undefined' && typeof (window as unknown as { queryLocalFonts?: QueryLocalFonts }).queryLocalFonts === 'function'
}

/**
 * 설치된 글꼴 전부 불러오기 — 반드시 사용자 클릭 안에서 호출한다(권한 창).
 * 실패하면 폴백 탐지 결과를 돌려준다.
 */
export async function loadAllSystemFonts(): Promise<{ fonts: FontEntry[]; granted: boolean }> {
  if (canQueryLocalFonts()) {
    try {
      const q = (window as unknown as { queryLocalFonts: QueryLocalFonts }).queryLocalFonts
      const list = await q()
      const fonts = toEntries(list.map((f) => f.family))
      if (fonts.length) {
        writeCache(fonts)
        return { fonts, granted: true }
      }
    } catch { /* 사용자가 거부했거나 지원하지 않는다 → 폴백 */ }
  }
  const fonts = detectInstalledFonts()
  if (fonts.length) writeCache(fonts)
  return { fonts, granted: false }
}

/** 저장된 목록이 있으면 그것을, 없으면 폴백 탐지 결과를 준다 (권한 창 없음) */
export function getKnownFonts(): FontEntry[] {
  return readCache() || detectInstalledFonts()
}

/** 저장된 목록을 지운다 — 글꼴을 새로 설치한 뒤 다시 읽을 때 */
export function clearFontCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch { /* 무시 */ }
}

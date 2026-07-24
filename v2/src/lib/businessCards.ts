import type { BusinessCard, BusinessCardInput } from '../store/businessCardsStore'

export interface SnsPlatform {
  key: string
  name: string
  color: string
  placeholder: string
  match: RegExp | null
  normalize: (value: string) => string
}

export const SNS_PLATFORMS: SnsPlatform[] = [
  {
    key: 'linkedin',
    name: 'LinkedIn',
    color: '#0A66C2',
    placeholder: 'linkedin.com/in/name',
    match: /(?:linkedin\.com|lnkd\.in)\/(?:in|company|pub)\/([^/\s?]+)/i,
    normalize: (value) => value.startsWith('http') ? value : `https://www.linkedin.com/in/${value.replace(/^@/, '').trim()}`,
  },
  {
    key: 'twitter',
    name: 'X',
    color: '#111111',
    placeholder: '@username',
    match: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,15})/i,
    normalize: (value) => {
      const clean = value.replace(/^@/, '').trim()
      return value.startsWith('http') ? value : `https://x.com/${clean}`
    },
  },
  {
    key: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    placeholder: 'facebook.com/name',
    match: /(?:facebook\.com|fb\.com)\/([^/\s?]+)/i,
    normalize: (value) => value.startsWith('http') ? value : `https://facebook.com/${value.replace(/^@/, '').trim()}`,
  },
  {
    key: 'instagram',
    name: 'Instagram',
    color: '#E4405F',
    placeholder: '@username',
    match: /instagram\.com\/([a-zA-Z0-9._]+)/i,
    normalize: (value) => {
      const clean = value.replace(/^@/, '').trim()
      return value.startsWith('http') ? value : `https://instagram.com/${clean}`
    },
  },
  {
    key: 'kakao',
    name: 'KakaoTalk',
    color: '#7A6100',
    placeholder: '오픈채팅 링크 또는 ID',
    match: /open\.kakao\.com\/o\/([^/\s?]+)/i,
    normalize: (value) => value.startsWith('http') ? value : `https://open.kakao.com/o/${value.replace(/^@/, '').trim()}`,
  },
  {
    key: 'wechat',
    name: 'WeChat',
    color: '#07C160',
    placeholder: 'WeChat ID',
    match: null,
    normalize: (value) => value.trim(),
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    color: '#25D366',
    placeholder: '+82 10-0000-0000',
    match: /wa\.me\/(\+?\d+)|api\.whatsapp\.com\/send\?phone=(\+?\d+)/i,
    normalize: (value) => {
      const digits = value.replace(/\D/g, '')
      return digits ? `https://wa.me/${digits}` : value.trim()
    },
  },
  {
    key: 'line',
    name: 'Line',
    color: '#00B900',
    placeholder: '@lineid 또는 링크',
    match: /line\.me\/ti\/p\/([^/\s?]+)|lin\.ee\/([^/\s?]+)/i,
    normalize: (value) => value.startsWith('http') ? value : `https://line.me/ti/p/~${value.replace(/^@/, '').trim()}`,
  },
  {
    key: 'telegram',
    name: 'Telegram',
    color: '#26A5E4',
    placeholder: '@username',
    match: /t\.me\/([a-zA-Z0-9_]+)/i,
    normalize: (value) => {
      const clean = value.replace(/^@/, '').trim()
      return value.startsWith('http') ? value : `https://t.me/${clean}`
    },
  },
  {
    key: 'github',
    name: 'GitHub',
    color: '#181717',
    placeholder: 'github username',
    match: /github\.com\/([a-zA-Z0-9-]+)/i,
    normalize: (value) => {
      const clean = value.replace(/^@/, '').trim()
      return value.startsWith('http') ? value : `https://github.com/${clean}`
    },
  },
  {
    key: 'youtube',
    name: 'YouTube',
    color: '#D40000',
    placeholder: '@channel',
    match: /youtube\.com\/(?:@|c\/|channel\/|user\/)([^/\s?]+)|youtu\.be\/([^/\s?]+)/i,
    normalize: (value) => {
      if (value.startsWith('http')) return value
      return value.startsWith('@') ? `https://youtube.com/${value}` : `https://youtube.com/@${value.trim()}`
    },
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    color: '#111111',
    placeholder: '@username',
    match: /tiktok\.com\/@([a-zA-Z0-9._]+)/i,
    normalize: (value) => {
      const clean = value.replace(/^@/, '').trim()
      return value.startsWith('http') ? value : `https://tiktok.com/@${clean}`
    },
  },
  {
    key: 'naver',
    name: 'Naver Blog',
    color: '#03C75A',
    placeholder: 'blog.naver.com/id',
    match: /blog\.naver\.com\/([^/\s?]+)/i,
    normalize: (value) => value.startsWith('http') ? value : `https://blog.naver.com/${value.replace(/^@/, '').trim()}`,
  },
  {
    key: 'threads',
    name: 'Threads',
    color: '#111111',
    placeholder: '@username',
    match: /threads\.net\/@([a-zA-Z0-9._]+)/i,
    normalize: (value) => {
      const clean = value.replace(/^@/, '').trim()
      return value.startsWith('http') ? value : `https://threads.net/@${clean}`
    },
  },
  {
    key: 'slack',
    name: 'Slack',
    color: '#4A154B',
    placeholder: 'workspace.slack.com',
    match: /([a-zA-Z0-9-]+)\.slack\.com/i,
    normalize: (value) => value.trim(),
  },
  {
    key: 'discord',
    name: 'Discord',
    color: '#5865F2',
    placeholder: 'handle 또는 초대링크',
    match: /discord\.(?:gg|com\/invite)\/([^/\s?]+)/i,
    normalize: (value) => value.trim(),
  },
]

export const EMPTY_CARD: BusinessCardInput = {
  name: '',
  nameEn: '',
  company: '',
  department: '',
  position: '',
  mobile: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
  address: '',
  group: '',
  tags: [],
  memo: '',
  favorite: false,
  sns: {},
  meetings: [],
}

const CARD_FIELD_ALIASES: Record<string, keyof BusinessCardInput | 'linkedin'> = {
  name: 'name',
  이름: 'name',
  성함: 'name',
  fullname: 'name',
  fullnamekr: 'name',
  full_name: 'name',
  nameen: 'nameEn',
  영문이름: 'nameEn',
  영문명: 'nameEn',
  englishname: 'nameEn',
  english_name: 'nameEn',
  company: 'company',
  회사: 'company',
  회사명: 'company',
  organization: 'company',
  org: 'company',
  department: 'department',
  dept: 'department',
  부서: 'department',
  division: 'department',
  position: 'position',
  title: 'position',
  jobtitle: 'position',
  job_title: 'position',
  직책: 'position',
  직위: 'position',
  mobile: 'mobile',
  cell: 'mobile',
  cellphone: 'mobile',
  mobilephone: 'mobile',
  휴대전화: 'mobile',
  휴대폰: 'mobile',
  핸드폰: 'mobile',
  phone: 'phone',
  tel: 'phone',
  telephone: 'phone',
  officephone: 'phone',
  전화: 'phone',
  대표전화: 'phone',
  fax: 'fax',
  팩스: 'fax',
  email: 'email',
  'e-mail': 'email',
  이메일: 'email',
  website: 'website',
  homepage: 'website',
  url: 'website',
  웹사이트: 'website',
  address: 'address',
  주소: 'address',
  tags: 'tags',
  태그: 'tags',
  memo: 'memo',
  note: 'memo',
  notes: 'memo',
  메모: 'memo',
  favorite: 'favorite',
  즐겨찾기: 'favorite',
  group: 'group',
  그룹: 'group',
  linkedin: 'linkedin',
}

export function makeCardDraft(card?: BusinessCard | null): BusinessCardInput {
  if (!card) return { ...EMPTY_CARD, tags: [], sns: {}, meetings: [] }
  return {
    ...card,
    tags: [...card.tags],
    sns: { ...card.sns },
    meetings: [...card.meetings],
  }
}

export function cleanPhone(value: string): string {
  return value.replace(/\D/g, '')
}

export function splitTags(value: string): string[] {
  return Array.from(
    new Set(value.split(/[,;]/).map((tag) => tag.trim().replace(/^#/, '').toLowerCase()).filter(Boolean))
  )
}

export function detectSnsFromUrl(text: string): { key: string; value: string } | null {
  const value = text.trim()
  if (!value) return null
  for (const platform of SNS_PLATFORMS) {
    if (platform.match && platform.match.test(value)) return { key: platform.key, value }
  }
  return null
}

export function getSnsUrl(key: string, value: string): string | null {
  const platform = SNS_PLATFORMS.find((item) => item.key === key)
  if (!platform || !value.trim()) return null
  try {
    const normalized = platform.normalize(value.trim())
    return /^https?:\/\//i.test(normalized) ? normalized : null
  } catch {
    return null
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeVCard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function unescapeVCard(value: string): string {
  return value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function foldVCardLine(line: string): string {
  if (line.length <= 75) return line
  const chunks = [line.slice(0, 75)]
  for (let index = 75; index < line.length; index += 74) chunks.push(' ' + line.slice(index, index + 74))
  return chunks.join('\r\n')
}

function photoLine(dataUrl?: string): string[] {
  if (!dataUrl?.startsWith('data:image')) return []
  const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i)
  if (!match) return []
  const type = match[1].toUpperCase().replace('JPG', 'JPEG')
  return [foldVCardLine(`PHOTO;ENCODING=b;TYPE=${type}:${match[2]}`)]
}

export function cardToVCard(card: BusinessCard, opts?: { includePhoto?: boolean }): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0']
  if (card.name || card.nameEn) lines.push(`FN:${escapeVCard(card.name || card.nameEn)}`)
  if (card.name) lines.push(`N:${escapeVCard(card.name)};;;;`)
  if (card.nameEn) lines.push(`X-NAME-EN:${escapeVCard(card.nameEn)}`)
  if (card.company) lines.push(`ORG:${escapeVCard(card.company)}${card.department ? ';' + escapeVCard(card.department) : ''}`)
  if (card.position) lines.push(`TITLE:${escapeVCard(card.position)}`)
  if (card.mobile) lines.push(`TEL;TYPE=CELL:${escapeVCard(card.mobile)}`)
  if (card.phone) lines.push(`TEL;TYPE=WORK:${escapeVCard(card.phone)}`)
  if (card.fax) lines.push(`TEL;TYPE=FAX:${escapeVCard(card.fax)}`)
  if (card.email) lines.push(`EMAIL;TYPE=WORK:${escapeVCard(card.email)}`)
  if (card.website) lines.push(`URL:${escapeVCard(card.website)}`)
  if (card.address) lines.push(`ADR;TYPE=WORK:;;${escapeVCard(card.address)};;;;`)
  for (const [key, value] of Object.entries(card.sns || {})) {
    if (!value) continue
    lines.push(`X-SOCIALPROFILE;TYPE=${escapeVCard(key)}:${escapeVCard(getSnsUrl(key, value) || value)}`)
  }
  if (card.memo) lines.push(`NOTE:${escapeVCard(card.memo)}`)
  if (opts?.includePhoto !== false) lines.push(...photoLine(card.frontImage))
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

export function cardsToCsv(cards: BusinessCard[]): string {
  const snsHeaders = SNS_PLATFORMS.map((platform) => platform.name)
  const headers = ['이름', '영문이름', '회사', '부서', '직책', '휴대폰', '전화', '팩스', '이메일', '웹사이트', '주소', '그룹', '태그', '메모', '즐겨찾기', ...snsHeaders]
  const rows = cards.map((card) => [
    card.name,
    card.nameEn,
    card.company,
    card.department,
    card.position,
    card.mobile,
    card.phone,
    card.fax,
    card.email,
    card.website,
    card.address,
    card.group,
    card.tags.join(';'),
    card.memo,
    card.favorite ? 'Y' : '',
    ...SNS_PLATFORMS.map((platform) => card.sns?.[platform.key] || ''),
  ])
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`
  return '\uFEFF' + [headers.join(','), ...rows.map((row) => row.map(cell).join(','))].join('\r\n')
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const ch = line[index]
    if (ch === '"' && quoted && line[index + 1] === '"') {
      current += '"'
      index++
    } else if (ch === '"') {
      quoted = !quoted
    } else if (ch === ',' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

function fieldAlias(header: string): keyof BusinessCardInput | 'linkedin' | null {
  const compact = header.trim().replace(/^\uFEFF/, '')
  const normalized = compact.replace(/[\s_-]+/g, '').toLowerCase()
  return CARD_FIELD_ALIASES[compact] || CARD_FIELD_ALIASES[compact.toLowerCase()] || CARD_FIELD_ALIASES[normalized] || null
}

export function parseCsv(text: string): BusinessCardInput[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  const snsHeaderMap = new Map<string, string>()
  SNS_PLATFORMS.forEach((platform) => {
    snsHeaderMap.set(platform.name.toLowerCase(), platform.key)
    snsHeaderMap.set(platform.key.toLowerCase(), platform.key)
    snsHeaderMap.set(`sns:${platform.key}`, platform.key)
  })

  return lines
    .slice(1)
    .map((line) => {
      const cells = parseCsvLine(line)
      const card: BusinessCardInput = { ...EMPTY_CARD, tags: [], sns: {}, meetings: [] }
      headers.forEach((header, index) => {
        const value = (cells[index] || '').trim()
        if (!value) return
        const snsKey = snsHeaderMap.get(header.toLowerCase())
        if (snsKey) {
          card.sns[snsKey] = value
          return
        }
        const key = fieldAlias(header)
        if (!key) return
        if (key === 'linkedin') card.sns.linkedin = value
        else if (key === 'tags') card.tags = splitTags(value)
        else if (key === 'favorite') card.favorite = /^[yt1]/i.test(value)
        else card[key] = value as never
      })
      return card
    })
    .filter((card) => card.name || card.company || card.email || card.mobile || card.phone)
}

export function parseVCard(text: string): BusinessCardInput[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  return unfolded
    .split(/BEGIN:VCARD/i)
    .slice(1)
    .map((block) => {
      const card: BusinessCardInput = { ...EMPTY_CARD, tags: [], sns: {}, meetings: [] }
      for (const line of block.split(/\r?\n/)) {
        const match = line.match(/^([^:;]+)([^:]*):(.*)$/)
        if (!match) continue
        const key = match[1].toUpperCase()
        const params = match[2].toUpperCase()
        const rawValue = match[3].trim()
        const value = unescapeVCard(rawValue)
        if (key === 'FN') card.name = value
        else if (key === 'N' && !card.name) card.name = value.split(';').filter(Boolean).join(' ')
        else if (key === 'X-NAME-EN') card.nameEn = value
        else if (key === 'ORG') {
          const [company, department] = value.split(';')
          card.company = company || ''
          card.department = department || ''
        } else if (key === 'TITLE') card.position = value
        else if (key === 'EMAIL') card.email = value
        else if (key === 'URL') card.website = value
        else if (key === 'ADR') card.address = value.split(';').filter(Boolean).join(' ')
        else if (key === 'NOTE') card.memo = value
        else if (key === 'TEL') {
          if (params.includes('CELL')) card.mobile = value
          else if (params.includes('FAX')) card.fax = value
          else card.phone = value
        } else if (key === 'X-SOCIALPROFILE' || key === 'IMPP') {
          const detected = detectSnsFromUrl(value)
          const type = match[2].match(/(?:TYPE|X-SERVICE-TYPE)=([^;:]+)/i)?.[1]?.toLowerCase()
          const platform = detected?.key || SNS_PLATFORMS.find((item) => item.key === type || item.name.toLowerCase() === type)?.key
          if (platform) card.sns[platform] = value
        } else if (key === 'PHOTO' && /ENCODING=B/i.test(params)) {
          const imageType = params.match(/TYPE=([A-Z0-9]+)/)?.[1]?.toLowerCase().replace('jpg', 'jpeg') || 'jpeg'
          card.frontImage = `data:image/${imageType};base64,${rawValue}`
        }
      }
      return card
    })
    .filter((card) => card.name || card.company || card.email || card.mobile || card.phone)
}

export function findDuplicate(cards: BusinessCard[], draft: BusinessCardInput): BusinessCard | null {
  const email = draft.email.trim().toLowerCase()
  const mobile = cleanPhone(draft.mobile)
  const phone = cleanPhone(draft.phone)
  return cards.find((card) => {
    if (draft.id && card.id === draft.id) return false
    if (email && card.email.trim().toLowerCase() === email) return true
    if (mobile && cleanPhone(card.mobile) === mobile) return true
    return !!(phone && cleanPhone(card.phone) === phone)
  }) || null
}

export function cardToHtml(card: BusinessCard): string {
  const rows = [
    ['이름', card.name],
    ['회사', [card.company, card.department].filter(Boolean).join(' / ')],
    ['직책', card.position],
    ['휴대폰', card.mobile],
    ['전화', card.phone],
    ['이메일', card.email],
    ['웹사이트', card.website],
    ['주소', card.address],
    ['SNS', Object.entries(card.sns || {}).map(([key, value]) => `${key}: ${value}`).join(' / ')],
    ['태그', card.tags.map((tag) => `#${tag}`).join(' ')],
    ['메모', card.memo],
  ].filter(([, value]) => value)
  return `<div class="jan-business-card-embed"><h3>${escapeHtml(card.name || card.company || '명함')}</h3>${rows.map(([key, value]) => `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</p>`).join('')}</div><p></p>`
}

const COMPANY_HINT_RE = /(주식회사|\(주\)|㈜|회사|법인|재단|협회|병원|의원|학원|학교|대학|연구소|센터|공사|공단|관광|건설|산업|상사|무역|전자|테크|시스템|솔루션|서비스|주차|\b(?:inc\.?|corp\.?|ltd\.?|labs?|studio|group|company)\b|\bco\.?\s*(?:ltd\.?|kr)?\b)/i
const TITLE_RE = /(대표|팀장|실장|과장|차장|부장|이사|상무|전무|사장|연구원|매니저|디자이너|개발자|manager|director|ceo|cto|cfo|designer|engineer)/i
const ADDRESS_RE = /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|전라|경상|제주|특별자치도|광역시|시 |구 |동 |읍 |면 |로 |길 |번지|building|street|road|suite)/i
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?0\d{1,2}\)?|[1-9]\d{0,2})[-.\s]?\d{3,4}[-.\s]?\d{4}/g
const MOBILE_LABEL_RE = /(?:mobile|cell|hp|휴대전화|휴대폰|핸드폰|모바일|(?:^|[\s/])m)\s*[:：.-]?\s*/i
const PHONE_LABEL_RE = /(?:tel|telephone|phone|office|대표전화|전화|문의|(?:^|[\s/])t)\s*[:：.-]?\s*/i
const FAX_LABEL_RE = /(?:fax|팩스|(?:^|[\s/])f)\s*[:：.-]?\s*/i
const NAME_LABEL_RE = /^(?:name|이름|성함)\s*[:：.-]?\s*/i
const COMPANY_LABEL_RE = /^(?:company|company name|회사|회사명|상호|법인명|organization|org)\s*[:：.-]?\s*/i
const DEPARTMENT_LABEL_RE = /^(?:department|dept|부서|소속|division)\s*[:：.-]?\s*/i
const POSITION_LABEL_RE = /^(?:position|title|job title|직책|직위|역할)\s*[:：.-]?\s*/i
const EMAIL_LABEL_RE = /^(?:e-?mail|이메일|메일)\s*[:：.-]?\s*/i
const WEBSITE_LABEL_RE = /^(?:website|homepage|url|web|웹사이트|홈페이지)\s*[:：.-]?\s*/i
const ADDRESS_LABEL_RE = /^(?:address|addr|주소|소재지)\s*[:：.-]?\s*/i
const NOISE_LINE_RE = /^(?:명함(?:에서)?\s*(?:읽은|추출한)?\s*정보|명함\s*정보|추출\s*결과|ocr\s*결과|분석\s*결과|business\s*card\s*(?:info|information|result))\s*[:：.-]?$/i
const INLINE_LABEL_BOUNDARY_RE = /\s+(?=(?:name|이름|성함|company|company name|회사|회사명|상호|법인명|organization|org|department|dept|부서|소속|division|position|title|job title|직책|직위|역할|mobile|cell|hp|휴대전화|휴대폰|핸드폰|모바일|tel|telephone|phone|office|대표전화|전화|문의|fax|팩스|e-?mail|이메일|메일|website|homepage|url|web|웹사이트|홈페이지|address|addr|주소|소재지)\s*[:：.-]?\s+)/gi

function isMobileNumber(value: string): boolean {
  return /^01[016789]\d{7,8}$/.test(normalizeKoreanPhone(value))
}

function phonesFromText(value: string): string[] {
  return Array.from(value.matchAll(PHONE_RE)).map((match) => match[0].trim()).filter(Boolean)
}

function normalizeKoreanPhone(value: string): string {
  const digits = cleanPhone(value)
  if (digits.startsWith('82')) return `0${digits.slice(2)}`
  return digits
}

function samePhone(a: string, b: string): boolean {
  return !!a && !!b && normalizeKoreanPhone(a) === normalizeKoreanPhone(b)
}

function extractPhoneFromLine(line: string): string {
  return phonesFromText(line)[0] || ''
}

function extractPhoneAfterLabel(line: string, label: RegExp): string {
  const match = label.exec(line)
  if (!match) return ''
  const rest = line.slice((match.index || 0) + match[0].length)
  return phonesFromText(rest)[0] || extractPhoneFromLine(line)
}

function textAfterLabel(line: string, label: RegExp): string {
  const match = label.exec(line)
  if (!match) return ''
  return line.slice((match.index || 0) + match[0].length).replace(/\s+/g, ' ').trim()
}

function firstLabeledValue(lines: string[], label: RegExp): string {
  return lines.map((line) => textAfterLabel(line, label)).find(Boolean) || ''
}

function splitContactLines(text: string): string[] {
  return text
    .replace(INLINE_LABEL_BOUNDARY_RE, '\n')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !NOISE_LINE_RE.test(line))
}

function likelyKoreanNameToken(value: string): boolean {
  return /^[가-힣]{2,4}$/.test(value) && !COMPANY_HINT_RE.test(value) && !TITLE_RE.test(value) && !ADDRESS_RE.test(value)
}

function koreanNameTokenFromLine(line: string): string {
  const fromTitle = nameFromTitleLine(line)
  if (fromTitle) return fromTitle
  const tokens = line.split(/\s+/).map((token) => token.replace(/[^\p{L}]/gu, '')).filter(Boolean)
  return tokens.find(likelyKoreanNameToken) || ''
}

function cleanCompanyLine(line: string, nameToRemove = ''): string {
  const withoutLabel = line
    .replace(COMPANY_LABEL_RE, '')
    .trim()
  const withoutEmbeddedName = nameToRemove
    ? withoutLabel.split(nameToRemove).join(' ')
    : withoutLabel
  const withoutOcrBullet = withoutEmbeddedName.replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s+/g, ' ').trim()
  const singleHangulPrefix = withoutOcrBullet.match(/^([가-힣])\s+(.+)$/)
  if (singleHangulPrefix && COMPANY_HINT_RE.test(singleHangulPrefix[2])) return singleHangulPrefix[2].trim()
  return withoutOcrBullet
}

function titleFromLine(line: string): string {
  return line.match(TITLE_RE)?.[0] || ''
}

function nameFromTitleLine(line: string): string {
  const beforeTitle = line.match(/^([가-힣]{2,4})\s*(?:대표|팀장|실장|과장|차장|부장|이사|상무|전무|사장|연구원|매니저)\b/)
  if (beforeTitle) return beforeTitle[1]
  const afterTitle = line.match(/(?:대표|팀장|실장|과장|차장|부장|이사|상무|전무|사장|연구원|매니저)\s*[:：-]?\s*([가-힣]{2,4})/)
  return afterTitle?.[1] || ''
}

export function parseContactText(text: string): Partial<BusinessCardInput> {
  const normalized = text.replace(/\t/g, ' ').replace(/[|·•]/g, '\n')
  const lines = splitContactLines(normalized)
  const email = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.(?:com|co\.kr|kr|net|org|io|ai|dev|edu|gov|jp|cn)\b/i)?.[0] || ''
  const websiteCandidates = normalized.match(/https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[a-z0-9-]+\.(?:com|co\.kr|kr|net|org|io|ai|dev)(?:\/[^\s<>()]*)?/gi) || []
  const labeledEmail = firstLabeledValue(lines, EMAIL_LABEL_RE)
  const labeledWebsite = firstLabeledValue(lines, WEBSITE_LABEL_RE)
  const website = labeledWebsite || websiteCandidates.find((candidate) => !email.includes(candidate.replace(/^https?:\/\//i, '').replace(/^www\./i, ''))) || ''
  const phoneMatches = phonesFromText(normalized)
  const mobileLine = lines.find((line) => MOBILE_LABEL_RE.test(line) && extractPhoneFromLine(line))
  const phoneLine = lines.find((line) => PHONE_LABEL_RE.test(line) && extractPhoneFromLine(line))
  const faxLine = lines.find((line) => FAX_LABEL_RE.test(line) && extractPhoneFromLine(line))
  const labeledMobile = mobileLine ? extractPhoneAfterLabel(mobileLine, MOBILE_LABEL_RE) : ''
  const labeledPhone = phoneLine ? extractPhoneAfterLabel(phoneLine, PHONE_LABEL_RE) : ''
  const fax = faxLine ? extractPhoneAfterLabel(faxLine, FAX_LABEL_RE) : ''
  const mobile = labeledMobile || phoneMatches.find(isMobileNumber) || ''
  const phone = labeledPhone || phoneMatches.find((item) => !samePhone(item, mobile) && !samePhone(item, fax)) || ''
  const labeledCompany = firstLabeledValue(lines, COMPANY_LABEL_RE)
  const labeledDepartment = firstLabeledValue(lines, DEPARTMENT_LABEL_RE)
  const labeledPosition = firstLabeledValue(lines, POSITION_LABEL_RE)
  const labeledAddress = firstLabeledValue(lines, ADDRESS_LABEL_RE)
  const companyLine = labeledCompany || lines.find((line) => COMPANY_HINT_RE.test(line)) || ''
  const titleLine = lines.find((line) => TITLE_RE.test(line)) || ''
  const addressLine = labeledAddress || lines.find((line) => ADDRESS_RE.test(line)) || ''
  const labelLike = (line: string) =>
    NAME_LABEL_RE.test(line) ||
    COMPANY_LABEL_RE.test(line) ||
    DEPARTMENT_LABEL_RE.test(line) ||
    POSITION_LABEL_RE.test(line) ||
    EMAIL_LABEL_RE.test(line) ||
    WEBSITE_LABEL_RE.test(line) ||
    ADDRESS_LABEL_RE.test(line)
  const contactLike = (line: string) =>
    line.includes('@') ||
    /https?:\/\/|www\.|\.com|\.co\.kr|\.kr|tel|fax|mobile|email|전화|휴대|팩스/i.test(line) ||
    /\d{2,}/.test(line) ||
    labelLike(line)
  const labeledName = lines.map((line) => textAfterLabel(line, NAME_LABEL_RE)).find((value) => value && !COMPANY_HINT_RE.test(value) && !contactLike(value)) || ''
  const nameFromTitle = titleLine ? nameFromTitleLine(titleLine) : ''
  const embeddedName = !labeledCompany && companyLine ? koreanNameTokenFromLine(companyLine) : ''
  const koreanNameLine = lines.find((line) =>
    /^[가-힣]{2,4}$/.test(line) &&
    line !== companyLine &&
    line !== addressLine &&
    !TITLE_RE.test(line) &&
    !COMPANY_HINT_RE.test(line) &&
    !contactLike(line)
  ) || ''
  const nameLine = labeledName || nameFromTitle || koreanNameLine || embeddedName || lines.find((line) =>
    line !== companyLine &&
    line !== titleLine &&
    line !== addressLine &&
    !contactLike(line) &&
    line.length <= 32
  ) || ''
  const englishName = lines.find((line) =>
    /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line) &&
    line !== nameLine
  ) || ''
  const sns = extractSnsFromText(normalized)
  const used = new Set([nameLine, englishName, companyLine, titleLine, addressLine].filter(Boolean))
  const memo = lines.filter((line) => !used.has(line) && !contactLike(line)).slice(0, 8).join('\n')
  return {
    name: nameLine,
    nameEn: englishName,
    company: companyLine ? cleanCompanyLine(companyLine, nameLine) : '',
    department: labeledDepartment,
    position: labeledPosition || titleFromLine(titleLine),
    mobile,
    phone,
    fax,
    email: email || labeledEmail,
    website,
    address: addressLine,
    sns,
    memo,
  }
}

export function extractSnsFromText(text: string): Record<string, string> {
  const sns: Record<string, string> = {}
  const candidates = text.match(/https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[a-z0-9.-]+\.[a-z]{2,}\/[^\s<>()]+/gi) || []
  for (const candidate of candidates) {
    const detected = detectSnsFromUrl(candidate)
    if (detected) sns[detected.key] = detected.value
  }
  const handles = Array.from(text.matchAll(/(?:instagram|twitter|x|threads|telegram|github|youtube)\s*[:：]?\s*(@?[a-zA-Z0-9._-]+)/gi))
  for (const match of handles) {
    const key = match[1].toLowerCase() === 'x' ? 'twitter' : match[1].toLowerCase()
    const value = match[2]
    if (SNS_PLATFORMS.some((platform) => platform.key === key)) sns[key] = value
  }
  return sns
}

export function parseAiBusinessCardJson(text: string): Partial<BusinessCardInput> | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) {
    const fallback = parseContactText(cleaned)
    return hasUsefulCardPatch(fallback) ? fallback : null
  }
  try {
    const raw = JSON.parse(match[0]) as unknown
    const data = unwrapAiBusinessCardRecord(raw)
    if (!data) return null
    const card = aiRecordToBusinessCardPatch(data)
    return hasUsefulCardPatch(card) ? card : null
  } catch {
    const fallback = parseContactText(cleaned)
    return hasUsefulCardPatch(fallback) ? fallback : null
  }
}

function hasUsefulCardPatch(card: Partial<BusinessCardInput> | null | undefined): card is Partial<BusinessCardInput> {
  if (!card) return false
  return !!(
    card.name ||
    card.company ||
    card.mobile ||
    card.phone ||
    card.fax ||
    card.email ||
    card.website ||
    card.address ||
    card.position ||
    Object.values(card.sns || {}).some(Boolean)
  )
}

function unwrapAiBusinessCardRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value.find(isPlainRecord) || null
  if (!isPlainRecord(value)) return null
  if (Object.keys(value).some((key) => !!fieldAlias(key) || /^(sns|social|socials|contact|contacts|연락처)$/i.test(key))) {
    return value
  }
  for (const key of ['businessCard', 'business_card', 'card', 'contact', 'result', 'data']) {
    const nested = value[key]
    if (isPlainRecord(nested)) return nested
    if (Array.isArray(nested)) return nested.find(isPlainRecord) || null
  }
  return value
}

function aiRecordToBusinessCardPatch(record: Record<string, unknown>): Partial<BusinessCardInput> {
  const card: Partial<BusinessCardInput> = { sns: {} }
  const assign = (key: keyof BusinessCardInput | 'linkedin', value: unknown) => {
    if (key === 'tags') {
      if (Array.isArray(value)) card.tags = splitTags(value.filter((item): item is string => typeof item === 'string').join(','))
      else if (typeof value === 'string') card.tags = splitTags(value)
      return
    }
    if (key === 'favorite') {
      if (typeof value === 'boolean') card.favorite = value
      else if (typeof value === 'string') card.favorite = /^[yt1]|true|yes|즐겨/i.test(value.trim())
      return
    }
    if (key === 'linkedin') {
      const str = stringValue(value)
      if (str) card.sns!.linkedin = str
      return
    }
    const str = stringValue(value)
    if (str) card[key] = str as never
  }

  const walk = (source: Record<string, unknown>) => {
    for (const [rawKey, value] of Object.entries(source)) {
      if (value == null) continue
      const key = rawKey.trim()
      const lowerKey = key.replace(/[\s_-]+/g, '').toLowerCase()
      if ((lowerKey === 'sns' || lowerKey === 'social' || lowerKey === 'socials' || lowerKey === 'socialprofiles') && isPlainRecord(value)) {
        for (const [snsKey, snsValue] of Object.entries(value)) {
          const str = stringValue(snsValue)
          if (str) card.sns![snsKey] = str
        }
        continue
      }
      if ((lowerKey === 'contact' || lowerKey === 'contacts' || lowerKey === '연락처') && isPlainRecord(value)) {
        walk(value)
        continue
      }
      const alias = fieldAlias(key)
      if (alias) assign(alias, value)
    }
  }

  walk(record)
  if (card.website && !/^https?:\/\//i.test(card.website)) card.website = card.website.replace(/^www\./i, 'www.')
  return card
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

export const BUSINESS_CARD_VISION_PROMPT = `이 이미지는 명함입니다. 아래 JSON 형식으로 정보를 정확히 추출하여 **JSON 객체만** 반환하세요. 마크다운이나 설명 없이, 중괄호로 시작하고 중괄호로 끝나야 합니다. 없는 필드는 빈 문자열 ""로 두고 추측하지 마세요.

{
  "name": "이름",
  "nameEn": "영문 이름",
  "company": "회사명",
  "department": "부서",
  "position": "직책",
  "mobile": "휴대폰",
  "phone": "대표전화",
  "fax": "팩스",
  "email": "이메일",
  "website": "웹사이트",
  "address": "주소",
  "memo": "추가 메모",
  "sns": {
    "linkedin": "",
    "twitter": "",
    "facebook": "",
    "instagram": "",
    "kakao": "",
    "wechat": "",
    "whatsapp": "",
    "line": "",
    "telegram": "",
    "github": "",
    "youtube": "",
    "tiktok": "",
    "naver": "",
    "threads": "",
    "slack": "",
    "discord": ""
  }
}

주의사항:
- 전화번호는 명함에 적힌 그대로의 형식을 유지하되, 가능하면 하이픈(-) 구분을 사용
- 휴대폰은 010/011/016/017/018/019 또는 +82 10 형식으로 시작하는 번호
- 이름이 한글과 영문 둘 다 있으면 name/nameEn으로 분리
- 직책과 부서를 구분 (예: "영업1팀 팀장"이면 department=영업1팀, position=팀장)
- 명함에 없는 필드는 절대 추측하지 말고 빈 문자열
- SNS는 명함에 명시된 것만 추출하고, 없으면 sns: {} 빈 객체`

export interface CardStats {
  total: number
  favorites: number
  withEmail: number
  withMobile: number
  withAddress: number
  withImage: number
  topCompanies: Array<[string, number]>
  topTags: Array<[string, number]>
  oldestDate: string
}

export function getCardStats(cards: BusinessCard[]): CardStats {
  const companies = new Map<string, number>()
  const tags = new Map<string, number>()
  let withEmail = 0
  let withMobile = 0
  let withAddress = 0
  let withImage = 0
  let oldest = Date.now()
  for (const card of cards) {
    if (card.company) companies.set(card.company, (companies.get(card.company) || 0) + 1)
    for (const tag of card.tags) tags.set(tag, (tags.get(tag) || 0) + 1)
    if (card.email) withEmail++
    if (card.mobile) withMobile++
    if (card.address) withAddress++
    if (card.frontImage || card.backImage) withImage++
    oldest = Math.min(oldest, card.createdAt || Date.now())
  }
  return {
    total: cards.length,
    favorites: cards.filter((card) => card.favorite).length,
    withEmail,
    withMobile,
    withAddress,
    withImage,
    topCompanies: Array.from(companies.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8),
    topTags: Array.from(tags.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8),
    oldestDate: cards.length ? new Date(oldest).toLocaleDateString('ko-KR') : '-',
  }
}

const IMAGE_FILE_RE = /\.(avif|bmp|gif|jpe?g|png|svg|webp|hei[cf])$/i
const HEIC_FILE_RE = /\.(hei[cf])$/i

function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase()
  return type === 'image/heic' || type === 'image/heif' || HEIC_FILE_RE.test(file.name)
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(dataUrl: string, errorMessage: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(errorMessage))
    image.src = dataUrl
  })
}

function drawImageToJpeg(image: HTMLImageElement, maxWidth: number): string {
  const scale = Math.min(1, maxWidth / image.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지 캔버스를 만들 수 없습니다')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.88)
}

async function convertHeicToJpeg(file: File): Promise<Blob> {
  try {
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    return Array.isArray(converted) ? converted[0] : converted
  } catch {
    throw new Error('HEIC 이미지를 JPEG로 변환하지 못했습니다. JPG 또는 PNG로 저장한 뒤 다시 시도하세요.')
  }
}

export async function readImageFile(file: File, maxWidth = 1600): Promise<string> {
  const isHeic = isHeicFile(file)
  if (!file.type.startsWith('image/') && !IMAGE_FILE_RE.test(file.name)) {
    throw new Error('이미지 파일만 사용할 수 있습니다')
  }
  const source = isHeic ? await convertHeicToJpeg(file) : file
  const dataUrl = await readBlobAsDataUrl(source)
  const image = await loadImage(dataUrl, '이미지를 읽을 수 없습니다. JPG, PNG, WebP 또는 HEIC 이미지를 사용하세요.')
  return drawImageToJpeg(image, maxWidth)
}

export function rotateImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.height
      canvas.height = image.width
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('이미지 캔버스를 만들 수 없습니다'))
        return
      }
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(image, -image.width / 2, -image.height / 2)
      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    image.onerror = () => reject(new Error('이미지를 회전할 수 없습니다'))
    image.src = dataUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('이미지를 OCR용으로 변환할 수 없습니다'))
    }, type)
  })
}

export async function preprocessImageForOcr(dataUrl: string, targetLongEdge = 2200): Promise<Blob> {
  const image = await loadImage(dataUrl, 'OCR용 이미지를 읽을 수 없습니다')
  const longEdge = Math.max(image.width, image.height)
  const scale = longEdge > targetLongEdge
    ? targetLongEdge / longEdge
    : longEdge < 1200
      ? Math.min(2, 1200 / longEdge)
      : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('이미지 캔버스를 만들 수 없습니다')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128))
    const value = contrasted > 232 ? 255 : contrasted < 32 ? 0 : contrasted
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
    data[index + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return canvasToBlob(canvas, 'image/png')
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

export function buildQrUrl(card: BusinessCard): string {
  // 사진(base64 수십 KB)을 넣으면 QR 용량 초과로 스캔 불가 — 연락처 필드만 인코딩
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(cardToVCard(card, { includePhoto: false }))}`
}

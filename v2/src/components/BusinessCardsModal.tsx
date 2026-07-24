import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react'
import type { Editor } from '@tiptap/react'
import { Icon } from './Icons'
import { runAiVision } from '../lib/aiApi'
import { ocrImage } from '../lib/ocr'
import {
  BUSINESS_CARD_VISION_PROMPT,
  SNS_PLATFORMS,
  buildQrUrl,
  cardToHtml,
  cardToVCard,
  cardsToCsv,
  dataUrlToBlob,
  findDuplicate,
  getCardStats,
  getSnsUrl,
  makeCardDraft,
  parseAiBusinessCardJson,
  parseContactText,
  parseCsv,
  parseVCard,
  preprocessImageForOcr,
  readImageFile,
  rotateImageDataUrl,
  splitTags,
  detectSnsFromUrl,
  type CardStats,
} from '../lib/businessCards'
import { useBusinessCardsStore, type BusinessCard, type BusinessCardInput } from '../store/businessCardsStore'

interface BusinessCardsModalProps {
  editor: Editor | null
  onClose: () => void
}

type CardFilter = 'all' | 'favorite' | 'recent' | `group:${string}` | `tag:${string}`
type CardSort = 'updatedAt' | 'createdAt' | 'name' | 'company'
type DetailMode = 'detail' | 'stats' | 'qr'
type ImageField = 'frontImage' | 'backImage'
const CARD_IMAGE_ACCEPT = 'image/*,.heic,.heif'

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 800)
}

function comparableDraft(draft: BusinessCardInput) {
  return {
    ...draft,
    tags: [...draft.tags].sort(),
    meetings: [...draft.meetings],
    sns: Object.fromEntries(Object.entries(draft.sns || {}).sort(([a], [b]) => a.localeCompare(b))),
  }
}

function hasDraftPayload(draft: BusinessCardInput): boolean {
  return !!(
    draft.name ||
    draft.nameEn ||
    draft.company ||
    draft.department ||
    draft.position ||
    draft.mobile ||
    draft.phone ||
    draft.fax ||
    draft.email ||
    draft.website ||
    draft.address ||
    draft.group ||
    draft.memo ||
    draft.frontImage ||
    draft.backImage ||
    draft.tags.length ||
    Object.values(draft.sns || {}).some(Boolean)
  )
}

function mergeCardDraft(current: BusinessCardInput, patch: Partial<BusinessCardInput>): BusinessCardInput {
  const next: BusinessCardInput = {
    ...current,
    sns: { ...current.sns },
    tags: [...current.tags],
    meetings: [...current.meetings],
  }
  const stringFields: Array<keyof BusinessCardInput> = [
    'name',
    'nameEn',
    'company',
    'department',
    'position',
    'mobile',
    'phone',
    'fax',
    'email',
    'website',
    'address',
    'group',
    'memo',
  ]
  for (const field of stringFields) {
    const value = patch[field]
    if (typeof value === 'string' && value.trim()) {
      next[field] = value.trim() as never
    }
  }
  if (patch.tags?.length) next.tags = Array.from(new Set([...next.tags, ...patch.tags]))
  if (patch.sns) {
    for (const [key, value] of Object.entries(patch.sns)) {
      if (value) next.sns[key] = value
    }
  }
  if (patch.frontImage) next.frontImage = patch.frontImage
  if (patch.backImage) next.backImage = patch.backImage
  return next
}

function makeMailto(card: BusinessCard): string {
  return `mailto:${encodeURIComponent(card.email)}`
}

function makeTel(card: BusinessCard): string {
  return `tel:${(card.mobile || card.phone).replace(/[^\d+]/g, '')}`
}

function normalizeWebsite(value: string): string {
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function ImageSlot({
  label,
  image,
  onPick,
  onDropFile,
  onRotate,
  onClear,
}: {
  label: string
  image?: string
  onPick: () => void
  onDropFile: (file: File) => void
  onRotate: () => void
  onClear: () => void
}) {
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) onDropFile(file)
  }

  return (
    <div className="jan-card-image-slot" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <div className="jan-card-image-label">{label}</div>
      {image ? (
        <>
          <button className="jan-card-image-preview" onClick={onPick} title={`${label} 변경`}>
            <img src={image} alt={`${label} 미리보기`} />
          </button>
          <div className="jan-card-image-tools">
            <button onClick={onRotate} title="회전"><Icon name="refresh-cw" /></button>
            <button onClick={onClear} title="제거"><Icon name="trash" /></button>
          </div>
        </>
      ) : (
        <button className="jan-card-image-empty" onClick={onPick}>
          <Icon name="image" />
          <span>이미지 업로드 또는 드래그</span>
        </button>
      )}
    </div>
  )
}

function SnsEditor({
  sns,
  onChange,
}: {
  sns: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="jan-card-sns-grid">
      {SNS_PLATFORMS.map((platform) => (
        <label className="jan-card-sns-field" key={platform.key}>
          <span><i style={{ background: platform.color }} />{platform.name}</span>
          <input
            value={sns[platform.key] || ''}
            placeholder={platform.placeholder}
            onChange={(e) => onChange(platform.key, e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              const detected = detectSnsFromUrl(text)
              if (detected && detected.key !== platform.key) {
                e.preventDefault()
                onChange(detected.key, detected.value)
              }
            }}
          />
        </label>
      ))}
    </div>
  )
}

function SnsChips({ card, onCopy }: { card: BusinessCard; onCopy: (value: string) => void }) {
  const entries = SNS_PLATFORMS
    .map((platform) => ({ platform, value: card.sns?.[platform.key] || '' }))
    .filter((entry) => entry.value)
  if (!entries.length) return null
  return (
    <div className="jan-card-sns-chips">
      <h5>SNS · 메신저</h5>
      <div>
        {entries.map(({ platform, value }) => {
          const url = getSnsUrl(platform.key, value)
          return (
            <button
              key={platform.key}
              style={{ borderColor: platform.color + '55', color: platform.color }}
              onClick={() => url ? window.open(url, '_blank') : onCopy(value)}
              title={`${platform.name}: ${value}`}
            >
              {platform.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatsView({ stats }: { stats: CardStats }) {
  const metric = [
    ['전체', stats.total],
    ['즐겨찾기', stats.favorites],
    ['휴대폰', stats.withMobile],
    ['이메일', stats.withEmail],
    ['주소', stats.withAddress],
    ['이미지', stats.withImage],
  ]
  return (
    <div className="jan-card-stats">
      <h4>명함 통계</h4>
      <div className="jan-card-stat-grid">
        {metric.map(([label, value]) => (
          <div key={label}><strong>{value}</strong><span>{label}</span></div>
        ))}
      </div>
      <div className="jan-card-rank">
        <h5>상위 회사</h5>
        {stats.topCompanies.length ? stats.topCompanies.map(([name, count]) => (
          <p key={name}><span>{name}</span><b>{count}</b></p>
        )) : <em>회사 데이터 없음</em>}
      </div>
      <div className="jan-card-rank">
        <h5>상위 태그</h5>
        {stats.topTags.length ? stats.topTags.map(([name, count]) => (
          <p key={name}><span>#{name}</span><b>{count}</b></p>
        )) : <em>태그 데이터 없음</em>}
      </div>
      <small>가장 오래된 명함: {stats.oldestDate}</small>
    </div>
  )
}

function QrView({ card, onEdit }: { card: BusinessCard; onEdit: () => void }) {
  return (
    <div className="jan-card-qr">
      <h4>내 명함 QR</h4>
      <img src={buildQrUrl(card)} alt="내 명함 QR 코드" />
      <strong>{card.name || card.company}</strong>
      <span>{[card.company, card.position].filter(Boolean).join(' · ')}</span>
      <p>상대방이 스캔하면 연락처 앱에 바로 저장할 수 있습니다.</p>
      <button onClick={onEdit}><Icon name="settings" />정보 수정</button>
    </div>
  )
}

export function BusinessCardsModal({ editor, onClose }: BusinessCardsModalProps) {
  const cardsRecord = useBusinessCardsStore((state) => state.cards)
  const groups = useBusinessCardsStore((state) => state.groups)
  const myCardId = useBusinessCardsStore((state) => state.myCardId)
  const addCard = useBusinessCardsStore((state) => state.addCard)
  const updateCard = useBusinessCardsStore((state) => state.updateCard)
  const deleteCard = useBusinessCardsStore((state) => state.deleteCard)
  const toggleFavorite = useBusinessCardsStore((state) => state.toggleFavorite)
  const addGroup = useBusinessCardsStore((state) => state.addGroup)
  const removeGroup = useBusinessCardsStore((state) => state.removeGroup)
  const renameGroup = useBusinessCardsStore((state) => state.renameGroup)
  const setMyCard = useBusinessCardsStore((state) => state.setMyCard)
  const importCards = useBusinessCardsStore((state) => state.importCards)
  const addMeeting = useBusinessCardsStore((state) => state.addMeeting)
  const [filter, setFilter] = useState<CardFilter>('all')
  const [sort, setSort] = useState<CardSort>('updatedAt')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(myCardId || null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailMode, setDetailMode] = useState<DetailMode>('detail')
  const [draft, setDraft] = useState<BusinessCardInput>(() => makeCardDraft())
  const [status, setStatus] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [aiBusy, setAiBusy] = useState(false)
  const [recentCutoff] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000)
  const importInputRef = useRef<HTMLInputElement>(null)
  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const cards = useMemo(() => Object.values(cardsRecord), [cardsRecord])
  const selectedCard = selectedId ? cardsRecord[selectedId] : null
  const myCard = myCardId ? cardsRecord[myCardId] : null
  const duplicate = useMemo(() => findDuplicate(cards, draft), [cards, draft])
  const stats = useMemo(() => getCardStats(cards), [cards])
  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of cards) {
      for (const tag of card.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [cards])
  const visibleCards = useMemo(() => {
    const lower = query.trim().toLowerCase()
    return cards
      .filter((card) => {
        if (filter === 'favorite' && !card.favorite) return false
        if (filter === 'recent' && card.createdAt < recentCutoff) return false
        if (filter.startsWith('group:') && card.group !== filter.slice(6)) return false
        if (filter.startsWith('tag:') && !card.tags.includes(filter.slice(4))) return false
        if (!lower) return true
        return [
          card.name,
          card.nameEn,
          card.company,
          card.department,
          card.position,
          card.mobile,
          card.phone,
          card.email,
          card.website,
          card.address,
          card.memo,
          card.tags.join(' '),
          Object.values(card.sns || {}).join(' '),
        ].join(' ').toLowerCase().includes(lower)
      })
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name, 'ko')
        if (sort === 'company') return a.company.localeCompare(b.company, 'ko')
        return (b[sort] || 0) - (a[sort] || 0)
      })
  }, [cards, filter, query, sort, recentCutoff])
  const extractionBusy = ocrBusy || aiBusy
  const draftDirty = useMemo(() => {
    if (!editingId) return false
    if (editingId === 'new') return hasDraftPayload(draft)
    const original = cardsRecord[editingId]
    if (!original) return hasDraftPayload(draft)
    return JSON.stringify(comparableDraft(draft)) !== JSON.stringify(comparableDraft(makeCardDraft(original)))
  }, [cardsRecord, draft, editingId])

  function confirmDiscardDraft(): boolean {
    if (extractionBusy) {
      setStatus('추출이 끝난 뒤 닫거나 취소하세요')
      return false
    }
    if (!draftDirty) return true
    return window.confirm('저장하지 않은 명함 초안이 있습니다. 닫으면 변경 내용이 사라집니다.')
  }

  function requestClose() {
    if (confirmDiscardDraft()) onClose()
  }

  function cancelEdit() {
    if (!confirmDiscardDraft()) return
    setEditingId(null)
    setStatus('')
  }

  function updateDraft<K extends keyof BusinessCardInput>(key: K, value: BusinessCardInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateSns(key: string, value: string) {
    setDraft((current) => ({ ...current, sns: { ...current.sns, [key]: value } }))
  }

  function applyExtracted(patch: Partial<BusinessCardInput>, label: string) {
    setEditingId((current) => current || 'new')
    setDetailMode('detail')
    setDraft((current) => mergeCardDraft(current, patch))
    setStatus(`${label}에서 명함 초안을 채웠습니다. 기존 값과 다른 항목은 새 추출값으로 교정했습니다. 확인 후 저장하세요.`)
  }

  function beginAdd() {
    setEditingId('new')
    setDetailMode('detail')
    setDraft(makeCardDraft())
    setStatus('')
  }

  function beginEdit(card: BusinessCard) {
    setEditingId(card.id)
    setDetailMode('detail')
    setDraft(makeCardDraft(card))
    setStatus('')
  }

  function saveDraft() {
    if (extractionBusy) {
      setStatus('추출이 끝난 뒤 저장하세요')
      return
    }
    if (!draft.name && !draft.company) {
      setStatus('이름 또는 회사명은 꼭 필요합니다')
      return
    }
    if (editingId && editingId !== 'new' && cardsRecord[editingId]) {
      updateCard(editingId, draft)
      setSelectedId(editingId)
      setStatus('명함을 수정했습니다')
    } else {
      const id = addCard(draft)
      setSelectedId(id)
      setStatus('새 명함을 추가했습니다')
    }
    setEditingId(null)
    setDetailMode('detail')
  }

  function removeSelected(card: BusinessCard) {
    if (!window.confirm(`"${card.name || card.company}" 명함을 삭제할까요?`)) return
    deleteCard(card.id)
    setSelectedId(null)
    setEditingId(null)
    setStatus('명함을 삭제했습니다')
  }

  function exportVCard(cardsToExport: BusinessCard[]) {
    if (!cardsToExport.length) {
      setStatus('내보낼 명함이 없습니다')
      return
    }
    const vcfName = cardsToExport.length === 1
      ? `${(cardsToExport[0].name || cardsToExport[0].nameEn || '명함').replace(/[\\/:*?"<>|]/g, '_')}.vcf`
      : 'justanotepad-contacts.vcf'
    downloadText(vcfName, cardsToExport.map((c) => cardToVCard(c)).join('\r\n'), 'text/vcard;charset=utf-8')
    setStatus(`${cardsToExport.length}개 명함을 vCard로 내보냈습니다`)
  }

  function exportCsv(cardsToExport: BusinessCard[]) {
    if (!cardsToExport.length) {
      setStatus('내보낼 명함이 없습니다')
      return
    }
    downloadText('justanotepad-contacts.csv', cardsToCsv(cardsToExport), 'text/csv;charset=utf-8')
    setStatus(`${cardsToExport.length}개 명함을 CSV로 내보냈습니다`)
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const imported = file.name.toLowerCase().endsWith('.vcf') ? parseVCard(text) : parseCsv(text)
      const count = importCards(imported)
      setStatus(`${count}개 명함을 가져왔습니다`)
    } catch (error) {
      setStatus(`가져오기 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      e.target.value = ''
    }
  }

  async function handleImageFile(file: File, field: ImageField) {
    try {
      setStatus(`${field === 'frontImage' ? '앞면' : '뒷면'} 이미지 처리 중입니다...`)
      const dataUrl = await readImageFile(file)
      setEditingId((current) => current || 'new')
      setDetailMode('detail')
      setDraft((current) => ({ ...current, [field]: dataUrl }))
      setStatus(`${field === 'frontImage' ? '앞면' : '뒷면'} 이미지를 초안에 추가했습니다. 저장을 눌러 확정하세요.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function rotateImage(field: ImageField) {
    const dataUrl = draft[field]
    if (!dataUrl) return
    try {
      const rotated = await rotateImageDataUrl(dataUrl)
      updateDraft(field, rotated)
      setStatus('이미지를 회전했습니다')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  function handlePasteImage(e: ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          void handleImageFile(file, 'frontImage')
        }
        return
      }
    }
  }

  function extractFromMemo() {
    const text = editor?.getText({ blockSeparator: '\n' }) || editor?.state.doc.textContent || ''
    if (!text.trim()) {
      setStatus('현재 메모에 추출할 텍스트가 없습니다')
      return
    }
    applyExtracted(parseContactText(text), '현재 메모')
  }

  async function extractImageText(): Promise<string> {
    const dataUrl = draft.frontImage || draft.backImage
    if (!dataUrl) throw new Error('먼저 명함 이미지를 업로드하세요')
    setStatus('OCR용 이미지 보정 중입니다...')
    const blob = await preprocessImageForOcr(dataUrl).catch(() => dataUrlToBlob(dataUrl))
    return (await ocrImage(blob, 'kor+eng', setOcrProgress)).trim()
  }

  async function extractFromImageOcr() {
    const dataUrl = draft.frontImage || draft.backImage
    if (!dataUrl) {
      setStatus('먼저 명함 이미지를 업로드하세요')
      return
    }
    setOcrBusy(true)
    setOcrProgress(0)
    try {
      const text = await extractImageText()
      if (!text) {
        setStatus('OCR 결과가 비어 있습니다. 더 선명한 이미지를 사용해보세요.')
        return
      }
      applyExtracted(parseContactText(text), 'OCR')
    } catch (error) {
      setStatus(`OCR 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setOcrBusy(false)
      setOcrProgress(1)
    }
  }

  async function extractFromImageAi() {
    const dataUrl = draft.frontImage || draft.backImage
    if (!dataUrl) {
      setStatus('먼저 명함 이미지를 업로드하세요')
      return
    }
    setAiBusy(true)
    let usedOcrFallback = false
    try {
      const result = await runAiVision(BUSINESS_CARD_VISION_PROMPT, dataUrl)
      if (result.ok && result.text) {
        const parsed = parseAiBusinessCardJson(result.text)
        if (parsed) {
          applyExtracted(parsed, 'AI')
          return
        }
      }
      setStatus(`AI 추출 실패: ${result.error || '응답 파싱 실패'} · OCR 보정 추출로 대신 시도합니다.`)
      usedOcrFallback = true
      setOcrBusy(true)
      setOcrProgress(0)
      const text = await extractImageText()
      if (!text) {
        setStatus(`AI 추출 실패: ${result.error || '응답 없음'} · OCR 결과도 비어 있습니다.`)
        return
      }
      applyExtracted(parseContactText(text), 'OCR 보정')
      setStatus(`AI 서버/키가 준비되지 않아 OCR 보정 추출로 채웠습니다. 설정에서 OpenAI 키 또는 서버 OPENAI_API_KEY를 연결하면 AI Vision을 사용합니다.`)
    } catch (error) {
      setStatus(`AI 추출 오류: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setAiBusy(false)
      if (usedOcrFallback) {
        setOcrBusy(false)
        setOcrProgress(1)
      }
    }
  }

  function insertCard(card: BusinessCard) {
    if (!editor) return
    editor.chain().focus().insertContent(cardToHtml(card)).run()
    setStatus('현재 메모에 명함 정보를 삽입했습니다')
  }

  function addMeetingPrompt(card: BusinessCard) {
    const date = window.prompt('미팅 날짜:', new Date().toISOString().slice(0, 10))
    if (!date) return
    const place = window.prompt('장소:', '') || ''
    const note = window.prompt('메모:', '') || ''
    addMeeting(card.id, { date, place, note })
    setStatus('미팅 기록을 추가했습니다')
  }

  function handleAddGroup() {
    const name = window.prompt('새 그룹명:')
    if (!name) return
    addGroup(name)
    setFilter(`group:${name.trim()}`)
  }

  function handleRenameGroup(name: string) {
    const next = window.prompt('새 그룹명:', name)
    if (!next || next === name) return
    renameGroup(name, next)
    setFilter(`group:${next}`)
  }

  function handleRemoveGroup(name: string) {
    if (!window.confirm(`"${name}" 그룹을 삭제할까요? 명함은 삭제되지 않습니다.`)) return
    removeGroup(name)
    setFilter('all')
  }

  function showMyCard() {
    if (myCard) {
      setSelectedId(myCard.id)
      setEditingId(null)
      setDetailMode('qr')
      setStatus('내 명함을 표시합니다')
      return
    }
    beginAdd()
    setStatus('내 명함으로 사용할 정보를 먼저 저장한 뒤 상세 화면에서 내 명함으로 지정하세요')
  }

  function copyText(value: string) {
    navigator.clipboard?.writeText(value).then(
      () => setStatus('복사했습니다'),
      () => setStatus(value)
    )
  }

  const qrCard = (myCardId ? cardsRecord[myCardId] : null) || selectedCard

  return (
    <div className="jan-modal-overlay" onClick={requestClose}>
      <div className="jan-modal jan-cards-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head jan-cards-head">
          <div className="jan-cards-title">
            <Icon name="cards" size={20} />
            <h3>명함관리</h3>
            <span>{visibleCards.length} / {cards.length}개</span>
          </div>
          <div className="jan-cards-actions">
            <button onClick={beginAdd}><Icon name="plus" />명함 추가</button>
            <button onClick={() => importInputRef.current?.click()}><Icon name="download" />가져오기</button>
            <button onClick={() => { setEditingId(null); setDetailMode('stats') }}><Icon name="sliders" />통계</button>
            <button onClick={showMyCard}><Icon name="qr" />내 명함</button>
            <button onClick={() => exportCsv(visibleCards)}><Icon name="upload" />CSV</button>
            <button onClick={() => exportVCard(visibleCards)}><Icon name="card" />vCard</button>
            <button className="jan-modal-close" onClick={requestClose}>닫기</button>
          </div>
        </div>

        <div className="jan-cards-body">
          <aside className="jan-cards-side">
            <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}><Icon name="users" />전체<span>{cards.length}</span></button>
            <button className={filter === 'favorite' ? 'is-active' : ''} onClick={() => setFilter('favorite')}><Icon name="heart" />즐겨찾기<span>{cards.filter((card) => card.favorite).length}</span></button>
            <button className={filter === 'recent' ? 'is-active' : ''} onClick={() => setFilter('recent')}><Icon name="history" />최근 7일</button>
            <div className="jan-cards-side-label">그룹</div>
            {groups.map((group) => (
              <div className="jan-cards-group-row" key={group}>
                <button className={filter === `group:${group}` ? 'is-active' : ''} onClick={() => setFilter(`group:${group}`)}><Icon name="briefcase" />{group}</button>
                <button title="이름 변경" onClick={() => handleRenameGroup(group)}><Icon name="settings" /></button>
                <button title="삭제" onClick={() => handleRemoveGroup(group)}><Icon name="trash" /></button>
              </div>
            ))}
            <button className="jan-cards-dashed" onClick={handleAddGroup}><Icon name="plus" />그룹 추가</button>
            <div className="jan-cards-side-label">태그</div>
            {tags.map(([tag, count]) => (
              <button key={tag} className={filter === `tag:${tag}` ? 'is-active' : ''} onClick={() => setFilter(`tag:${tag}`)}><Icon name="tag" />{tag}<span>{count}</span></button>
            ))}
          </aside>

          <main className="jan-cards-list-pane">
            <div className="jan-cards-searchbar">
              <div className="jan-cards-search">
                <Icon name="search" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름, 회사, 전화, 이메일, SNS, 태그 검색" />
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value as CardSort)}>
                <option value="updatedAt">최근 수정순</option>
                <option value="createdAt">추가순</option>
                <option value="name">이름순</option>
                <option value="company">회사순</option>
              </select>
            </div>
            <div className="jan-cards-list">
              {visibleCards.length === 0 ? (
                <div className="jan-cards-empty">
                  <Icon name="cards" size={34} />
                  <strong>{cards.length ? '조건에 맞는 명함이 없습니다' : '아직 명함이 없습니다'}</strong>
                  <span>{cards.length ? '검색어 또는 필터를 바꿔보세요.' : '명함을 추가하거나 CSV/vCard 파일에서 가져오세요.'}</span>
                </div>
              ) : visibleCards.map((card) => (
                <button
                  className={'jan-card-tile' + (selectedId === card.id ? ' is-selected' : '')}
                  key={card.id}
                  onClick={() => { setSelectedId(card.id); setEditingId(null); setDetailMode('detail') }}
                >
                  {card.frontImage ? <img className="jan-card-tile-img" src={card.frontImage} alt="" /> : <span className="jan-card-avatar">{(card.name || card.company || '?').slice(0, 1).toUpperCase()}</span>}
                  <span className="jan-card-main">
                    <strong>{card.name || '이름 없음'}{myCardId === card.id ? ' · 내 명함' : ''}</strong>
                    <span>{[card.company, card.position].filter(Boolean).join(' · ') || '회사/직책 없음'}</span>
                    <em>{card.email || card.mobile || card.phone || '연락처 없음'}</em>
                  </span>
                  {card.favorite && <Icon name="heart" className="jan-card-fav" />}
                </button>
              ))}
            </div>
          </main>

          <aside className="jan-cards-detail">
            {editingId ? (
              <div className="jan-card-form" onPaste={handlePasteImage}>
                <h4>{editingId === 'new' ? '명함 추가' : '명함 편집'}</h4>
                <div className="jan-card-image-panel">
                  <ImageSlot
                    label="명함 앞면"
                    image={draft.frontImage}
                    onPick={() => frontInputRef.current?.click()}
                    onDropFile={(file) => void handleImageFile(file, 'frontImage')}
                    onRotate={() => void rotateImage('frontImage')}
                    onClear={() => updateDraft('frontImage', undefined)}
                  />
                  <ImageSlot
                    label="명함 뒷면"
                    image={draft.backImage}
                    onPick={() => backInputRef.current?.click()}
                    onDropFile={(file) => void handleImageFile(file, 'backImage')}
                    onRotate={() => void rotateImage('backImage')}
                    onClear={() => updateDraft('backImage', undefined)}
                  />
                </div>
                <div className="jan-cards-actions wrap">
                  <button onClick={() => cameraInputRef.current?.click()}><Icon name="image" />카메라</button>
                  <button onClick={() => void extractFromImageOcr()} disabled={ocrBusy || aiBusy}><Icon name="image-text" />{ocrBusy ? `OCR ${Math.round(ocrProgress * 100)}%` : 'OCR 추출'}</button>
                  <button onClick={() => void extractFromImageAi()} disabled={ocrBusy || aiBusy}><Icon name="ai" />{aiBusy ? 'AI 분석 중' : 'AI 추출'}</button>
                  <button onClick={extractFromMemo} disabled={extractionBusy}><Icon name="wand" />현재 메모에서 추출</button>
                </div>
                {status && <div className="jan-settings-status jan-cards-inline-status">{status}</div>}
                <div className="jan-card-form-grid">
                  <label>이름<input value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} /></label>
                  <label>영문명<input value={draft.nameEn} onChange={(e) => updateDraft('nameEn', e.target.value)} /></label>
                  <label className="span-2">회사<input value={draft.company} onChange={(e) => updateDraft('company', e.target.value)} /></label>
                  <label>부서<input value={draft.department} onChange={(e) => updateDraft('department', e.target.value)} /></label>
                  <label>직책<input value={draft.position} onChange={(e) => updateDraft('position', e.target.value)} /></label>
                  <label>휴대폰<input value={draft.mobile} onChange={(e) => updateDraft('mobile', e.target.value)} /></label>
                  <label>전화<input value={draft.phone} onChange={(e) => updateDraft('phone', e.target.value)} /></label>
                  <label>팩스<input value={draft.fax} onChange={(e) => updateDraft('fax', e.target.value)} /></label>
                  <label>이메일<input type="email" value={draft.email} onChange={(e) => updateDraft('email', e.target.value)} /></label>
                  <label>웹사이트<input value={draft.website} onChange={(e) => updateDraft('website', e.target.value)} /></label>
                  <label className="span-2">주소<input value={draft.address} onChange={(e) => updateDraft('address', e.target.value)} /></label>
                  <label>그룹<input list="jan-card-groups" value={draft.group} onChange={(e) => updateDraft('group', e.target.value)} /></label>
                  <label>태그<input value={draft.tags.join(', ')} onChange={(e) => updateDraft('tags', splitTags(e.target.value))} /></label>
                  <label className="span-2">메모<textarea value={draft.memo} onChange={(e) => updateDraft('memo', e.target.value)} rows={4} /></label>
                </div>
                <datalist id="jan-card-groups">
                  {groups.map((group) => <option value={group} key={group} />)}
                </datalist>
                <SnsEditor sns={draft.sns} onChange={updateSns} />
                <label className="jan-card-check"><input type="checkbox" checked={draft.favorite} onChange={(e) => updateDraft('favorite', e.target.checked)} />즐겨찾기</label>
                {duplicate && <div className="jan-card-warning">동일 이메일/전화의 명함이 있습니다: {duplicate.name || duplicate.company}</div>}
                <div className="jan-cards-actions">
                  <button onClick={cancelEdit} disabled={extractionBusy}>취소</button>
                  <button className="primary" onClick={saveDraft} disabled={extractionBusy}><Icon name="check" />저장</button>
                </div>
              </div>
            ) : detailMode === 'stats' ? (
              <StatsView stats={stats} />
            ) : detailMode === 'qr' && qrCard ? (
              <QrView card={qrCard} onEdit={() => beginEdit(qrCard)} />
            ) : selectedCard ? (
              <div className="jan-card-profile">
                {(selectedCard.frontImage || selectedCard.backImage) && (
                  <div className="jan-card-profile-images">
                    {selectedCard.frontImage && <button onClick={() => window.open(selectedCard.frontImage, '_blank')}><img src={selectedCard.frontImage} alt="명함 앞면" /></button>}
                    {selectedCard.backImage && <button onClick={() => window.open(selectedCard.backImage, '_blank')}><img src={selectedCard.backImage} alt="명함 뒷면" /></button>}
                  </div>
                )}
                <div className="jan-card-profile-head">
                  <span className="jan-card-avatar big">{(selectedCard.name || selectedCard.company || '?').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <h4>{selectedCard.name || '이름 없음'}{myCardId === selectedCard.id ? ' · 내 명함' : ''}</h4>
                    <p>{[selectedCard.company, selectedCard.department, selectedCard.position].filter(Boolean).join(' · ') || '회사 정보 없음'}</p>
                  </div>
                </div>
                <div className="jan-card-quick-actions">
                  {(selectedCard.mobile || selectedCard.phone) && <button onClick={() => window.open(makeTel(selectedCard), '_blank')}><Icon name="phone" />전화</button>}
                  {selectedCard.email && <button onClick={() => window.open(makeMailto(selectedCard), '_blank')}><Icon name="send" />메일</button>}
                  {selectedCard.website && <button onClick={() => window.open(normalizeWebsite(selectedCard.website), '_blank')}><Icon name="globe" />웹</button>}
                  {selectedCard.address && <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(selectedCard.address)}`, '_blank')}><Icon name="map" />지도</button>}
                </div>
                <dl>
                  {[
                    ['휴대폰', selectedCard.mobile],
                    ['전화', selectedCard.phone],
                    ['팩스', selectedCard.fax],
                    ['이메일', selectedCard.email],
                    ['웹사이트', selectedCard.website],
                    ['주소', selectedCard.address],
                    ['그룹', selectedCard.group],
                    ['태그', selectedCard.tags.map((tag) => `#${tag}`).join(' ')],
                    ['메모', selectedCard.memo],
                  ].filter(([, value]) => value).map(([key, value]) => (
                    <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
                <SnsChips card={selectedCard} onCopy={copyText} />
                <div className="jan-card-meetings">
                  <h5>미팅 기록</h5>
                  {selectedCard.meetings.length === 0 ? <p>기록 없음</p> : selectedCard.meetings.map((meeting) => (
                    <div key={meeting.id}><strong>{meeting.date}</strong><span>{meeting.place}</span><p>{meeting.note}</p></div>
                  ))}
                </div>
                <div className="jan-cards-actions wrap">
                  <button onClick={() => toggleFavorite(selectedCard.id)}><Icon name="heart" />{selectedCard.favorite ? '즐겨찾기 해제' : '즐겨찾기'}</button>
                  <button onClick={() => { setMyCard(myCardId === selectedCard.id ? null : selectedCard.id); setStatus(myCardId === selectedCard.id ? '내 명함 지정을 해제했습니다' : '내 명함으로 지정했습니다') }}><Icon name="qr" />{myCardId === selectedCard.id ? '내 명함 해제' : '내 명함 지정'}</button>
                  <button onClick={() => beginEdit(selectedCard)}><Icon name="settings" />편집</button>
                  <button onClick={() => insertCard(selectedCard)}><Icon name="send" />메모에 삽입</button>
                  <button onClick={() => exportVCard([selectedCard])}><Icon name="card" />vCard</button>
                  <button onClick={() => addMeetingPrompt(selectedCard)}><Icon name="clock" />미팅 추가</button>
                  <button className="danger" onClick={() => removeSelected(selectedCard)}><Icon name="trash" />삭제</button>
                </div>
              </div>
            ) : (
              <div className="jan-cards-empty detail">
                <Icon name="user" size={32} />
                <strong>명함을 선택하세요</strong>
                <span>사진 OCR, 상세 보기, 메모 삽입, vCard 내보내기를 여기서 처리합니다.</span>
              </div>
            )}
          </aside>
        </div>

        {status && <div className="jan-settings-status jan-cards-status">{status}</div>}
        <input ref={importInputRef} type="file" accept=".csv,.vcf,text/csv,text/vcard" onChange={handleImport} hidden />
        <input ref={frontInputRef} type="file" accept={CARD_IMAGE_ACCEPT} onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImageFile(file, 'frontImage'); e.target.value = '' }} hidden />
        <input ref={backInputRef} type="file" accept={CARD_IMAGE_ACCEPT} onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImageFile(file, 'backImage'); e.target.value = '' }} hidden />
        <input ref={cameraInputRef} type="file" accept={CARD_IMAGE_ACCEPT} capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImageFile(file, 'frontImage'); e.target.value = '' }} hidden />
      </div>
    </div>
  )
}

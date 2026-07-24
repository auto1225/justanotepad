import { useMemosStore, type Memo, type SortMode, type TrashedMemo } from '../store/memosStore'
import { useTagsStore } from '../store/tagsStore'
import { DEFAULT_WORKSPACE_ID, useWorkspaceStore, type Workspace } from '../store/workspaceStore'
import { useBusinessCardsStore, type BusinessCard } from '../store/businessCardsStore'
import { migrateV1Html } from './migration'
import { useTemplatesStore, type MemoTemplate } from '../store/templatesStore'
import { useSnippetsStore, type Snippet } from '../store/snippetsStore'
import { useMacrosStore, type Macro } from '../store/macrosStore'
import { useRoleToolsStore, type RoleToolData } from '../store/roleToolsStore'
import { useVersionsStore, type Version } from '../store/versionsStore'
import { useSettingsStore } from '../store/settingsStore'
import { DEFAULT_MEMO_PAGE_SETTINGS, normalizeMemoPageSettings, useUIStore } from '../store/uiStore'
import { useThemeStore } from '../store/themeStore'
import { useTypographyStore } from '../store/typographyStore'
import { useWritingGoalStore } from '../store/writingGoalStore'
import type { AttachmentSnapshot } from './attachments'

export interface V2Snapshot {
  app: 'justanotepad'
  version: 2
  exportedAt: number
  memos: Record<string, Memo>
  trashed: Record<string, TrashedMemo>
  order: string[]
  currentId: string | null
  sortMode: SortMode
  tags: {
    byMemo: Record<string, string[]>
  }
  workspaces: {
    workspaces: Record<string, Workspace>
    byMemo: Record<string, string>
    currentWsId: string | null
  }
  businessCards: {
    cards: Record<string, BusinessCard>
    groups: string[]
    myCardId: string | null
  }
  extras?: {
    templates?: MemoTemplate[]
    snippets?: Snippet[]
    macros?: Macro[]
    roleTools?: {
      selectedRoleIds: string[]
      roleData: RoleToolData
    }
    versions?: {
      byMemo: Record<string, Version[]>
    }
    settings?: Record<string, unknown>
    ui?: Record<string, unknown>
    theme?: Record<string, unknown>
    typography?: Record<string, unknown>
    writingGoal?: Record<string, unknown>
    attachments?: AttachmentSnapshot[]
  }
}

export interface SnapshotApplyResult {
  applied: boolean
  memosChanged: number
  trashChanged: number
  tagsChanged: number
  workspacesChanged: number
  cardsChanged: number
  extrasChanged: number
}

interface V1Tab {
  id?: string
  name?: string
  title?: string
  html?: string
  content?: string
  pinned?: boolean
  tag?: string
  wsId?: string
  pageSize?: string
  pageMargins?: unknown
  paperStyle?: string
}

interface V1Workspace {
  id?: string
  name?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeMemo(raw: unknown): Memo | null {
  if (!isRecord(raw)) return null
  const id = safeString(raw.id, '')
  if (!id) return null
  const now = Date.now()
  return {
    id,
    title: safeString(raw.title, '무제'),
    content: safeString(raw.content, '<p></p>'),
    createdAt: safeNumber(raw.createdAt, now),
    updatedAt: safeNumber(raw.updatedAt, now),
    pinned: raw.pinned === true,
    pageSettings: normalizeMemoPageSettings(raw.pageSettings),
  }
}

function normalizeTrash(raw: unknown): TrashedMemo | null {
  const memo = normalizeMemo(raw)
  if (!memo || !isRecord(raw)) return null
  return {
    ...memo,
    trashedAt: safeNumber(raw.trashedAt, memo.updatedAt),
  }
}

function normalizeMemoRecord(raw: unknown): Record<string, Memo> {
  const result: Record<string, Memo> = {}
  if (!isRecord(raw)) return result
  for (const value of Object.values(raw)) {
    const memo = normalizeMemo(value)
    if (memo) result[memo.id] = memo
  }
  return result
}

function normalizeTrashRecord(raw: unknown): Record<string, TrashedMemo> {
  const result: Record<string, TrashedMemo> = {}
  if (!isRecord(raw)) return result
  for (const value of Object.values(raw)) {
    const memo = normalizeTrash(value)
    if (memo) result[memo.id] = memo
  }
  return result
}

function normalizeTags(raw: unknown): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  if (!isRecord(raw)) return result
  for (const [memoId, tags] of Object.entries(raw)) {
    if (!Array.isArray(tags)) continue
    result[memoId] = tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean)
  }
  return result
}

function normalizeWorkspaceRecord(raw: unknown): Record<string, Workspace> {
  const fallback: Record<string, Workspace> = {
    [DEFAULT_WORKSPACE_ID]: { id: DEFAULT_WORKSPACE_ID, name: '기본', color: '#D97757', createdAt: 0 },
  }
  if (!isRecord(raw)) return fallback
  const result: Record<string, Workspace> = {}
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue
    result[id] = {
      id,
      name: safeString(value.name, '기본'),
      color: safeString(value.color, '#D97757'),
      createdAt: safeNumber(value.createdAt, 0),
    }
  }
  return Object.keys(result).length ? result : fallback
}

function normalizeWorkspaceMap(raw: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!isRecord(raw)) return result
  for (const [memoId, workspaceId] of Object.entries(raw)) {
    if (typeof workspaceId === 'string' && workspaceId) result[memoId] = workspaceId
  }
  return result
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function pickDataState(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    const value = source[key]
    if (typeof value !== 'function' && value !== undefined) result[key] = value
  }
  return result
}

function normalizeExtras(raw: unknown): V2Snapshot['extras'] | undefined {
  if (!isRecord(raw)) return undefined
  const extras: V2Snapshot['extras'] = {}

  if (Array.isArray(raw.templates)) extras.templates = cloneJson(raw.templates) as MemoTemplate[]
  if (Array.isArray(raw.snippets)) extras.snippets = cloneJson(raw.snippets) as Snippet[]
  if (Array.isArray(raw.macros)) extras.macros = cloneJson(raw.macros) as Macro[]
  if (isRecord(raw.roleTools)) {
    extras.roleTools = {
      selectedRoleIds: normalizeStringArray(raw.roleTools.selectedRoleIds),
      roleData: isRecord(raw.roleTools.roleData) ? (cloneJson(raw.roleTools.roleData) as RoleToolData) : {},
    }
  }
  if (isRecord(raw.versions) && isRecord(raw.versions.byMemo)) {
    extras.versions = { byMemo: cloneJson(raw.versions.byMemo) as Record<string, Version[]> }
  }
  for (const key of ['settings', 'ui', 'theme', 'typography', 'writingGoal'] as const) {
    if (isRecord(raw[key])) extras[key] = cloneJson(raw[key]) as Record<string, unknown>
  }
  if (Array.isArray(raw.attachments)) extras.attachments = cloneJson(raw.attachments) as AttachmentSnapshot[]

  return Object.keys(extras).length ? extras : undefined
}

function createExtrasSnapshot(): V2Snapshot['extras'] {
  return {
    templates: cloneJson(useTemplatesStore.getState().templates),
    snippets: cloneJson(useSnippetsStore.getState().snippets),
    macros: cloneJson(useMacrosStore.getState().macros),
    roleTools: {
      selectedRoleIds: cloneJson(useRoleToolsStore.getState().selectedRoleIds),
      roleData: cloneJson(useRoleToolsStore.getState().roleData),
    },
    versions: {
      byMemo: cloneJson(useVersionsStore.getState().byMemo),
    },
    settings: pickDataState(useSettingsStore.getState() as unknown as Record<string, unknown>, [
      'aiProvider',
      'aiModel',
      'syncEnabled',
      'syncProvider',
      'dropboxClientId',
      'onedriveClientId',
      'citationStyle',
      'collabEnabled',
      'collabWsUrl',
      'collabRoom',
      'collabUserName',
      'aiAutocomplete',
    ]),
    ui: pickDataState(useUIStore.getState() as unknown as Record<string, unknown>, [
      'focusMode',
      'readingMode',
      'spellCheck',
      'sidebarCollapsed',
      'headingNumbers',
      'showRulers',
      'viewLayout',
      'zoom',
      'paperStyle',
      'pageSize',
      'pageOrientation',
      'pageMarginMm',
      'pageMarginsMm',
      'pageColumnCount',
    ]),
    theme: pickDataState(useThemeStore.getState() as unknown as Record<string, unknown>, ['theme', 'accent']),
    typography: pickDataState(useTypographyStore.getState() as unknown as Record<string, unknown>, [
      'fontFamily',
      'lineHeight',
      'paragraphSpacing',
      'fontSize',
    ]),
    writingGoal: pickDataState(useWritingGoalStore.getState() as unknown as Record<string, unknown>, [
      'dailyTarget',
      'todayCount',
      'todayKey',
      'totalDays',
    ]),
  }
}

function normalizeBusinessCard(raw: unknown, fallbackId: string): BusinessCard | null {
  if (!isRecord(raw)) return null
  const now = Date.now()
  const id = safeString(raw.id, fallbackId)
  const sns: Record<string, string> = {}
  if (isRecord(raw.sns)) {
    for (const [key, value] of Object.entries(raw.sns)) {
      if (typeof value === 'string' && value.trim()) sns[key] = value.trim()
    }
  } else if (typeof raw.sns === 'string' && raw.sns.trim()) {
    sns.profile = raw.sns.trim()
  }
  if (typeof raw.linkedin === 'string' && raw.linkedin.trim() && !sns.linkedin) {
    sns.linkedin = raw.linkedin.trim()
  }
  const rawMeetings = Array.isArray(raw.meetings) ? raw.meetings : Array.isArray(raw.meetingHistory) ? raw.meetingHistory : []
  const meetings = rawMeetings.length
    ? rawMeetings.filter(isRecord).map((meeting, index) => ({
        id: safeString(meeting.id, `mt_${id}_${index}`),
        date: safeString(meeting.date, ''),
        place: safeString(meeting.place, ''),
        note: safeString(meeting.note || meeting.memo, ''),
        createdAt: safeNumber(meeting.createdAt, now),
      }))
    : []
  return {
    id,
    name: safeString(raw.name, ''),
    nameEn: safeString(raw.nameEn, ''),
    company: safeString(raw.company, ''),
    department: safeString(raw.department, ''),
    position: safeString(raw.position, ''),
    mobile: safeString(raw.mobile, ''),
    phone: safeString(raw.phone, ''),
    fax: safeString(raw.fax, ''),
    email: safeString(raw.email, ''),
    website: safeString(raw.website, ''),
    address: safeString(raw.address, ''),
    group: safeString(raw.group, ''),
    tags: normalizeStringArray(raw.tags).map((tag) => tag.replace(/^#/, '').toLowerCase()),
    memo: safeString(raw.memo, ''),
    favorite: raw.favorite === true,
    sns,
    meetings,
    frontImage: typeof raw.frontImage === 'string' ? raw.frontImage : typeof raw.frontImg === 'string' ? raw.frontImg : typeof raw.photoBase64 === 'string' ? raw.photoBase64 : undefined,
    backImage: typeof raw.backImage === 'string' ? raw.backImage : typeof raw.backImg === 'string' ? raw.backImg : undefined,
    createdAt: safeNumber(raw.createdAt, now),
    updatedAt: safeNumber(raw.updatedAt, now),
  }
}

function normalizeBusinessCardRecord(raw: unknown): Record<string, BusinessCard> {
  const result: Record<string, BusinessCard> = {}
  if (Array.isArray(raw)) {
    raw.forEach((value, index) => {
      const card = normalizeBusinessCard(value, `bc_import_${index}`)
      if (card) result[card.id] = card
    })
    return result
  }
  if (!isRecord(raw)) return result
  for (const [id, value] of Object.entries(raw)) {
    const card = normalizeBusinessCard(value, id)
    if (card) result[card.id] = card
  }
  return result
}

function snapshotFromV2(raw: Record<string, unknown>): V2Snapshot | null {
  const memos = normalizeMemoRecord(raw.memos)
  if (!Object.keys(memos).length) return null

  const tags = isRecord(raw.tags) ? normalizeTags(raw.tags.byMemo) : {}
  const rawWorkspaces = isRecord(raw.workspaces) ? raw.workspaces : null
  const workspaces = isRecord(raw.workspaces)
    ? normalizeWorkspaceRecord(raw.workspaces.workspaces)
    : normalizeWorkspaceRecord(null)
  const workspaceMap = rawWorkspaces ? normalizeWorkspaceMap(rawWorkspaces.byMemo) : {}
  const rawCards = isRecord(raw.businessCards) ? raw.businessCards : null
  const rawOrder = Array.isArray(raw.order) ? raw.order.filter((id): id is string => typeof id === 'string') : []
  const order = [...rawOrder.filter((id) => memos[id]), ...Object.keys(memos).filter((id) => !rawOrder.includes(id))]
  const currentId = typeof raw.currentId === 'string' && memos[raw.currentId] ? raw.currentId : order[0] || null
  const sortMode = ['recent', 'title', 'created', 'manual'].includes(String(raw.sortMode))
    ? (raw.sortMode as SortMode)
    : 'recent'

  return {
    app: 'justanotepad',
    version: 2,
    exportedAt: safeNumber(raw.exportedAt, Date.now()),
    memos,
    trashed: normalizeTrashRecord(raw.trashed),
    order,
    currentId,
    sortMode,
    tags: { byMemo: tags },
    workspaces: {
      workspaces,
      byMemo: workspaceMap,
      currentWsId: typeof rawWorkspaces?.currentWsId === 'string' ? rawWorkspaces.currentWsId : null,
    },
    businessCards: {
      cards: rawCards ? normalizeBusinessCardRecord(rawCards.cards) : {},
      groups: rawCards ? normalizeStringArray(rawCards.groups) : [],
      myCardId: typeof rawCards?.myCardId === 'string' ? rawCards.myCardId : null,
    },
    extras: normalizeExtras(raw.extras),
  }
}

function snapshotFromV1(raw: Record<string, unknown>): V2Snapshot | null {
  if (!Array.isArray(raw.tabs)) return null
  const now = Date.now()
  const memos: Record<string, Memo> = {}
  const tags: Record<string, string[]> = {}
  const workspaceMap: Record<string, string> = {}
  const order: string[] = []

  for (const tab of raw.tabs as V1Tab[]) {
    const id = safeString(tab.id, `m_${now.toString(36)}_${order.length}`)
    const content = tab.html || tab.content || '<p></p>'
    memos[id] = {
      id,
      title: tab.name || tab.title || '무제',
      content: migrateV1Html(content),
      createdAt: now,
      updatedAt: now,
      pinned: tab.pinned === true,
      pageSettings: normalizeMemoPageSettings(v1PageSettings(tab.pageSize, tab.pageMargins, tab.paperStyle)),
    }
    order.push(id)
    if (tab.tag) tags[id] = [String(tab.tag).toLowerCase()]
    if (tab.wsId) workspaceMap[id] = tab.wsId
  }

  if (!order.length) return null

  const workspaces: Record<string, Workspace> = {}
  if (Array.isArray(raw.workspaces)) {
    for (const ws of raw.workspaces as V1Workspace[]) {
      if (!ws.id) continue
      workspaces[ws.id] = {
        id: ws.id,
        name: ws.name || '공간',
        color: '#D97757',
        createdAt: now,
      }
    }
  }
  if (!Object.keys(workspaces).length) {
    workspaces[DEFAULT_WORKSPACE_ID] = { id: DEFAULT_WORKSPACE_ID, name: '기본', color: '#D97757', createdAt: 0 }
  }

  const cards = normalizeBusinessCardRecord(raw.businessCards)
  const myCard = normalizeBusinessCard(raw.myCard, 'bc_my_card')
  const myCardId = myCard && (myCard.name || myCard.company || myCard.email || myCard.mobile || myCard.phone)
    ? myCard.id
    : null
  if (myCardId && myCard) cards[myCard.id] = { ...myCard, favorite: true }

  return {
    app: 'justanotepad',
    version: 2,
    exportedAt: now,
    memos,
    trashed: {},
    order,
    currentId: safeString(raw.activeId, order[0]),
    sortMode: 'manual',
    tags: { byMemo: tags },
    workspaces: {
      workspaces,
      byMemo: workspaceMap,
      currentWsId: null,
    },
    businessCards: {
      cards,
      groups: normalizeStringArray(raw.cardGroups),
      myCardId,
    },
  }
}

function v1PageSettings(pageSize: unknown, pageMargins: unknown, paperStyle: unknown) {
  const key = typeof pageSize === 'string' ? pageSize.toLowerCase() : ''
  const sizeMap: Record<string, { pageSize: string; pageOrientation: string }> = {
    a4p: { pageSize: 'A4', pageOrientation: 'portrait' },
    a4l: { pageSize: 'A4', pageOrientation: 'landscape' },
    a3p: { pageSize: 'A3', pageOrientation: 'portrait' },
    a3l: { pageSize: 'A3', pageOrientation: 'landscape' },
    b4p: { pageSize: 'B4', pageOrientation: 'portrait' },
    b4l: { pageSize: 'B4', pageOrientation: 'landscape' },
    a5p: { pageSize: 'A5', pageOrientation: 'portrait' },
    a5l: { pageSize: 'A5', pageOrientation: 'landscape' },
    b5p: { pageSize: 'B5', pageOrientation: 'portrait' },
    b5l: { pageSize: 'B5', pageOrientation: 'landscape' },
    letterp: { pageSize: 'Letter', pageOrientation: 'portrait' },
    letterl: { pageSize: 'Letter', pageOrientation: 'landscape' },
  }
  return {
    ...DEFAULT_MEMO_PAGE_SETTINGS,
    ...(sizeMap[key] || {}),
    paperStyle,
    pageMarginsMm: pageMargins,
  }
}

export function snapshotFromCloudData(data: unknown): V2Snapshot | null {
  if (!isRecord(data)) return null
  return snapshotFromV2(data) || snapshotFromV1(data)
}

export function createV2Snapshot(): V2Snapshot {
  const memos = useMemosStore.getState()
  const tags = useTagsStore.getState()
  const workspaces = useWorkspaceStore.getState()
  const businessCards = useBusinessCardsStore.getState()
  return {
    app: 'justanotepad',
    version: 2,
    exportedAt: Date.now(),
    memos: memos.memos,
    trashed: memos.trashed,
    order: memos.order,
    currentId: memos.currentId,
    sortMode: memos.sortMode,
    tags: { byMemo: tags.byMemo },
    workspaces: {
      workspaces: workspaces.workspaces,
      byMemo: workspaces.byMemo,
      currentWsId: workspaces.currentWsId,
    },
    businessCards: {
      cards: businessCards.cards,
      groups: businessCards.groups,
      myCardId: businessCards.myCardId,
    },
    extras: createExtrasSnapshot(),
  }
}

export function applyV2Snapshot(snapshot: V2Snapshot): SnapshotApplyResult {
  const current = useMemosStore.getState()
  const nextMemos = { ...current.memos }
  const nextTrash = { ...current.trashed }
  let memosChanged = 0
  let trashChanged = 0

  for (const memo of Object.values(snapshot.memos)) {
    const localTrash = nextTrash[memo.id]
    if (localTrash && localTrash.trashedAt >= memo.updatedAt) continue
    const localMemo = nextMemos[memo.id]
    // 동률(같은 타임스탬프)이면 로컬 우선 — 원격 사본이 최신일 때만 덮어쓴다
    if (!localMemo || localMemo.updatedAt < memo.updatedAt) {
      nextMemos[memo.id] = memo
      delete nextTrash[memo.id]
      memosChanged++
    }
  }

  for (const trashed of Object.values(snapshot.trashed)) {
    const localMemo = nextMemos[trashed.id]
    if (localMemo && localMemo.updatedAt > trashed.trashedAt) continue
    const localTrash = nextTrash[trashed.id]
    if (!localTrash || localTrash.trashedAt < trashed.trashedAt) {
      delete nextMemos[trashed.id]
      nextTrash[trashed.id] = trashed
      trashChanged++
    }
  }

  const incomingOrder = snapshot.order.filter((id) => nextMemos[id])
  const localRest = current.order.filter((id) => nextMemos[id] && !incomingOrder.includes(id))
  const order = [...incomingOrder, ...localRest]
  const currentId = snapshot.currentId && nextMemos[snapshot.currentId] ? snapshot.currentId : current.currentId || order[0] || null

  useMemosStore.setState({
    memos: nextMemos,
    trashed: nextTrash,
    order,
    currentId,
    sortMode: snapshot.sortMode,
  })

  const currentTags = useTagsStore.getState().byMemo
  const nextTags = { ...currentTags, ...snapshot.tags.byMemo }
  const tagsChanged = JSON.stringify(currentTags) === JSON.stringify(nextTags) ? 0 : 1
  if (tagsChanged) useTagsStore.setState({ byMemo: nextTags })

  const currentWorkspaces = useWorkspaceStore.getState()
  const nextWorkspaceState = {
    workspaces: { ...currentWorkspaces.workspaces, ...snapshot.workspaces.workspaces },
    byMemo: { ...currentWorkspaces.byMemo, ...snapshot.workspaces.byMemo },
    currentWsId: currentWorkspaces.currentWsId || snapshot.workspaces.currentWsId,
  }
  const workspacesChanged =
    JSON.stringify({
      workspaces: currentWorkspaces.workspaces,
      byMemo: currentWorkspaces.byMemo,
      currentWsId: currentWorkspaces.currentWsId,
    }) === JSON.stringify(nextWorkspaceState)
      ? 0
      : 1
  if (workspacesChanged) useWorkspaceStore.setState(nextWorkspaceState)

  const currentCards = useBusinessCardsStore.getState()
  const nextCards = { ...currentCards.cards }
  for (const card of Object.values(snapshot.businessCards.cards)) {
    const localCard = nextCards[card.id]
    if (!localCard || localCard.updatedAt <= card.updatedAt) nextCards[card.id] = card
  }
  const nextGroups = Array.from(new Set([...currentCards.groups, ...snapshot.businessCards.groups])).sort((a, b) => a.localeCompare(b, 'ko'))
  const nextMyCardId = currentCards.myCardId || snapshot.businessCards.myCardId
  const cardsChanged =
    JSON.stringify({
      cards: currentCards.cards,
      groups: currentCards.groups,
      myCardId: currentCards.myCardId,
    }) === JSON.stringify({ cards: nextCards, groups: nextGroups, myCardId: nextMyCardId })
      ? 0
      : 1
  if (cardsChanged) {
    useBusinessCardsStore.setState({
      cards: nextCards,
      groups: nextGroups,
      myCardId: nextMyCardId,
    })
  }

  let extrasChanged = 0
  if (snapshot.extras) {
    const extras = snapshot.extras
    if (extras.templates) {
      useTemplatesStore.setState({ templates: extras.templates })
      extrasChanged++
    }
    if (extras.snippets) {
      useSnippetsStore.setState({ snippets: extras.snippets })
      extrasChanged++
    }
    if (extras.macros) {
      useMacrosStore.setState({ macros: extras.macros })
      extrasChanged++
    }
    if (extras.roleTools) {
      useRoleToolsStore.setState({
        selectedRoleIds: extras.roleTools.selectedRoleIds,
        roleData: extras.roleTools.roleData,
      })
      extrasChanged++
    }
    if (extras.versions) {
      useVersionsStore.setState({ byMemo: extras.versions.byMemo })
      extrasChanged++
    }
    if (extras.settings) {
      useSettingsStore.setState(extras.settings as Partial<ReturnType<typeof useSettingsStore.getState>>)
      extrasChanged++
    }
    if (extras.ui) {
      useUIStore.setState(extras.ui as Partial<ReturnType<typeof useUIStore.getState>>)
      extrasChanged++
    }
    if (extras.theme) {
      useThemeStore.setState(extras.theme as Partial<ReturnType<typeof useThemeStore.getState>>)
      useThemeStore.getState().apply()
      extrasChanged++
    }
    if (extras.typography) {
      useTypographyStore.setState(extras.typography as Partial<ReturnType<typeof useTypographyStore.getState>>)
      useTypographyStore.getState().apply()
      extrasChanged++
    }
    if (extras.writingGoal) {
      useWritingGoalStore.setState(extras.writingGoal as Partial<ReturnType<typeof useWritingGoalStore.getState>>)
      extrasChanged++
    }
  }

  return {
    applied: memosChanged + trashChanged + tagsChanged + workspacesChanged + cardsChanged + extrasChanged > 0,
    memosChanged,
    trashChanged,
    tagsChanged,
    workspacesChanged,
    cardsChanged,
    extrasChanged,
  }
}

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Editor } from '@tiptap/react'
import { Icon } from './Icons'
import { ROLE_TOOLS, ROLES, materializeRoleTemplate, roleToolsFor, type Role, type RoleTemplate, type RoleToolId } from '../lib/roles'
import {
  isoDate,
  isoMonth,
  isoWeek,
  makeRoleToolId,
  useRoleToolsStore,
  type AttendanceEntry,
  type CourseEntry,
  type DdayEntry,
  type LedgerEntry,
  type MedEntry,
  type ShopEntry,
  type SimpleTask,
  type TimeEntry,
  type VitalEntry,
} from '../store/roleToolsStore'
import { useMemosStore } from '../store/memosStore'

interface RolesPanelProps {
  editor: Editor | null
  onClose: () => void
  initialTool?: RoleToolId | null
}

interface ToolProps {
  createMemo: (title: string, html: string) => void
  setStatus: (message: string) => void
}

const LEDGER_CATS = {
  expense: ['식비', '교통', '주거', '쇼핑', '의료', '문화', '교육', '통신', '경조사', '기타'],
  income: ['급여', '용돈', '투자', '환급', '기타'],
}

const SHOP_CATS = ['채소', '과일', '육류', '수산', '유제품', '냉동', '곡류', '조미료', '간식', '생활용품', '기타']
const TIMETABLE_DAYS = ['월', '화', '수', '목', '금']
const TIMETABLE_PERIODS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
const CELL_COLORS = ['#ef5350', '#ab47bc', '#5c6bc0', '#29b6f6', '#26a69a', '#66bb6a', '#ffa726', '#8d6e63']
const GPA_GRADES = [
  ['A+', 4.5],
  ['A', 4.0],
  ['B+', 3.5],
  ['B', 3.0],
  ['C+', 2.5],
  ['C', 2.0],
  ['D+', 1.5],
  ['D', 1.0],
  ['F', 0],
] as const

function formText(form: HTMLFormElement, name: string): string {
  return String(new FormData(form).get(name) || '').trim()
}

function formNumber(form: HTMLFormElement, name: string): number {
  return Number(String(new FormData(form).get(name) || '').trim())
}

function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function ddayLabel(date: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  if (Number.isNaN(target.getTime())) return '날짜 오류'
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff > 0) return `D-${diff}`
  if (diff === 0) return 'D-Day'
  return `D+${Math.abs(diff)}`
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 200)
}

export function RolesPanel({ editor, onClose, initialTool = null }: RolesPanelProps) {
  const selectedRoleIds = useRoleToolsStore((s) => s.selectedRoleIds)
  const toggleRole = useRoleToolsStore((s) => s.toggleRole)
  const [view, setView] = useState<'dashboard' | 'roles' | 'templates'>(selectedRoleIds.length ? 'dashboard' : 'roles')
  const [toolId, setToolId] = useState<RoleToolId | null>(initialTool)
  const [status, setStatus] = useState('')
  const { newMemo, updateCurrent } = useMemosStore()

  const selectedRoles = useMemo(
    () => selectedRoleIds.map((id) => ROLES.find((r) => r.id === id)).filter(Boolean) as Role[],
    [selectedRoleIds]
  )
  const tools = useMemo(() => roleToolsFor(selectedRoleIds), [selectedRoleIds])
  const templateRoles = selectedRoles.length ? selectedRoles : ROLES

  if (!editor) return null

  function insertTemplate(template: RoleTemplate) {
    const tpl = materializeRoleTemplate(template)
    editor?.chain().focus().insertContent(tpl.html).run()
    setStatus(`현재 메모에 "${tpl.name}" 템플릿을 삽입했습니다.`)
  }

  function createMemo(title: string, html: string) {
    newMemo()
    updateCurrent({ title, content: html })
    setStatus(`"${title}" 메모를 새로 만들었습니다.`)
  }

  function generateTemplateMemos(roleIds = selectedRoleIds) {
    const roles = roleIds.map((id) => ROLES.find((r) => r.id === id)).filter(Boolean) as Role[]
    let count = 0
    roles.forEach((role) => {
      role.templates.forEach((tpl) => {
        const rendered = materializeRoleTemplate(tpl)
        const title = `${role.name} - ${rendered.name}`
        useMemosStore.getState().newMemo()
        useMemosStore.getState().updateCurrent({ title, content: rendered.html })
        count += 1
      })
    })
    setStatus(`${count}개 역할 템플릿 메모를 생성했습니다.`)
  }

  const currentTool = toolId ? ROLE_TOOLS[toolId] : null

  return (
    <div className="jan-modal-overlay jan-rolepack-overlay" onClick={onClose}>
      <div className="jan-modal jan-roles-modal jan-rolepack-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head jan-rolepack-head">
          <div className="jan-rolepack-title">
            <Icon name="briefcase" size={20} />
            <div>
              <h3>내 도구 / 역할 팩</h3>
              <span>v1처럼 역할을 고르고, 필요한 도구와 템플릿을 바로 씁니다.</span>
            </div>
          </div>
          <button className="jan-modal-close" onClick={onClose}><Icon name="close" /> 닫기</button>
        </div>

        <div className="jan-modal-body jan-rolepack-body">
          <aside className="jan-rolepack-nav">
            <button className={view === 'dashboard' && !toolId ? 'is-active' : ''} onClick={() => { setToolId(null); setView('dashboard') }}>
              <Icon name="briefcase" /> 내 도구
              {selectedRoleIds.length > 0 && <span>{selectedRoleIds.length}</span>}
            </button>
            <button className={view === 'roles' ? 'is-active' : ''} onClick={() => { setToolId(null); setView('roles') }}>
              <Icon name="users" /> 역할 선택
            </button>
            <button className={view === 'templates' ? 'is-active' : ''} onClick={() => { setToolId(null); setView('templates') }}>
              <Icon name="file-plus" /> 템플릿
            </button>
            <div className="jan-rolepack-nav-note">
              {selectedRoles.length
                ? selectedRoles.map((r) => <span key={r.id} style={{ color: r.color }}>{r.name}</span>)
                : <span>아직 선택된 역할이 없습니다.</span>}
            </div>
          </aside>

          <main className="jan-rolepack-main">
            {toolId && currentTool ? (
              <section>
                <div className="jan-rolepack-tool-head">
                  <button className="jan-rolepack-back" onClick={() => setToolId(null)}><Icon name="chevron-left" /> 내 도구</button>
                  <div>
                    <h4><Icon name={currentTool.icon} /> {currentTool.name}</h4>
                    <p>{currentTool.desc}</p>
                  </div>
                </div>
                <RoleToolPanel toolId={toolId} createMemo={createMemo} setStatus={setStatus} />
              </section>
            ) : view === 'roles' ? (
              <RoleSelection selectedRoleIds={selectedRoleIds} toggleRole={toggleRole} setView={setView} generateTemplateMemos={generateTemplateMemos} onSkip={onClose} />
            ) : view === 'templates' ? (
              <TemplateLibrary roles={templateRoles} insertTemplate={insertTemplate} generateTemplateMemos={generateTemplateMemos} />
            ) : (
              <Dashboard selectedRoles={selectedRoles} tools={tools} setToolId={setToolId} setView={setView} generateTemplateMemos={generateTemplateMemos} />
            )}
            {status && <div className="jan-rolepack-status">{status}</div>}
          </main>
        </div>
      </div>
    </div>
  )
}

function RoleSelection({
  selectedRoleIds,
  toggleRole,
  setView,
  generateTemplateMemos,
  onSkip,
}: {
  selectedRoleIds: string[]
  toggleRole: (id: string) => void
  setView: (view: 'dashboard' | 'roles' | 'templates') => void
  generateTemplateMemos: () => void
  onSkip: () => void
}) {
  return (
    <section>
      <div className="jan-rolepack-section-head">
        <div>
          <h4>어떻게 쓰실 건가요?</h4>
          <p>필요한 것만 고르면 내 도구와 템플릿이 자동으로 모입니다. 여러 개 선택할 수 있습니다.</p>
        </div>
        <strong>선택: {selectedRoleIds.length}개</strong>
      </div>
      <div className="jan-role-card-grid">
        {ROLES.map((role) => {
          const selected = selectedRoleIds.includes(role.id)
          return (
            <button
              key={role.id}
              className={'jan-role-card' + (selected ? ' selected' : '')}
              style={{ '--role-color': role.color } as CSSProperties}
              onClick={() => toggleRole(role.id)}
              aria-pressed={selected}
            >
              <Icon name={role.icon} size={28} />
              <span className="jan-role-name">{role.name}</span>
              <span className="jan-role-desc">{role.desc}</span>
              <span className="jan-role-check"><Icon name="check" size={12} /></span>
            </button>
          )
        })}
      </div>
      <div className="jan-rolepack-actions">
        <button onClick={onSkip}>일단 그냥 메모장으로</button>
        <button onClick={() => setView('dashboard')} className="primary">적용</button>
        <button onClick={generateTemplateMemos} disabled={selectedRoleIds.length === 0}>선택 역할 템플릿 메모 생성</button>
      </div>
    </section>
  )
}

function Dashboard({
  selectedRoles,
  tools,
  setToolId,
  setView,
  generateTemplateMemos,
}: {
  selectedRoles: Role[]
  tools: Array<(typeof ROLE_TOOLS)[RoleToolId]>
  setToolId: (id: RoleToolId) => void
  setView: (view: 'dashboard' | 'roles' | 'templates') => void
  generateTemplateMemos: () => void
}) {
  if (!selectedRoles.length) {
    return (
      <section className="jan-rolepack-empty">
        <Icon name="users" size={48} />
        <h4>아직 역할을 선택하지 않았습니다</h4>
        <p>학생·회사원·주부·PM·개발자 등 상황에 맞춰 도구를 꺼내드립니다.</p>
        <button className="primary" onClick={() => setView('roles')}>역할 선택하기</button>
      </section>
    )
  }

  return (
    <section>
      <div className="jan-rolepack-section-head">
        <div>
          <h4>내 도구 모음</h4>
          <p>선택한 역할에서 중복 도구를 합쳐 보여줍니다.</p>
        </div>
        <button onClick={() => setView('roles')}>역할 변경</button>
      </div>
      <div className="jan-role-chip-row">
        {selectedRoles.map((role) => (
          <span key={role.id} style={{ '--role-color': role.color } as CSSProperties}>
            <Icon name={role.icon} /> {role.name}
          </span>
        ))}
      </div>
      <div className="jan-role-tool-grid">
        {tools.map((tool) => (
          <button key={tool.id} className="jan-role-tool-card" onClick={() => setToolId(tool.id)}>
            <Icon name={tool.icon} size={32} />
            <span>{tool.name}</span>
            <small>{tool.desc}</small>
          </button>
        ))}
      </div>
      <div className="jan-rolepack-template-callout">
        <div>
          <strong>역할 템플릿</strong>
          <p>선택한 역할의 문서 골조를 현재 메모에 삽입하거나 새 메모로 만들 수 있습니다.</p>
        </div>
        <button onClick={() => setView('templates')}>템플릿 보기</button>
        <button onClick={generateTemplateMemos}>템플릿 다시 생성</button>
      </div>
    </section>
  )
}

function TemplateLibrary({
  roles,
  insertTemplate,
  generateTemplateMemos,
}: {
  roles: Role[]
  insertTemplate: (template: RoleTemplate) => void
  generateTemplateMemos: (ids?: string[]) => void
}) {
  return (
    <section>
      <div className="jan-rolepack-section-head">
        <div>
          <h4>역할 템플릿</h4>
          <p>v1 역할팩의 주요 문서 골조를 TipTap HTML로 바로 삽입합니다.</p>
        </div>
      </div>
      <div className="jan-role-template-sections">
        {roles.map((role) => (
          <section key={role.id} className="jan-role-template-section">
            <div className="jan-role-template-role" style={{ '--role-color': role.color } as CSSProperties}>
              <Icon name={role.icon} />
              <strong>{role.name}</strong>
              <button onClick={() => generateTemplateMemos([role.id])}>이 역할 메모 생성</button>
            </div>
            <div className="jan-roles-templates">
              {role.templates.map((tpl) => (
                <button key={tpl.name} className="jan-roles-template" onClick={() => insertTemplate(tpl)}>
                  {tpl.name}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function RoleToolPanel({ toolId, createMemo, setStatus }: ToolProps & { toolId: RoleToolId }) {
  switch (toolId) {
    case 'timetable': return <TimetableTool createMemo={createMemo} setStatus={setStatus} />
    case 'ledger': return <LedgerTool createMemo={createMemo} setStatus={setStatus} />
    case 'gpa': return <GpaTool createMemo={createMemo} setStatus={setStatus} />
    case 'dday': return <DdayTool createMemo={createMemo} setStatus={setStatus} />
    case 'med': return <MedTool createMemo={createMemo} setStatus={setStatus} />
    case 'vital': return <VitalTool createMemo={createMemo} setStatus={setStatus} />
    case 'shop': return <ShopTool createMemo={createMemo} setStatus={setStatus} />
    case 'meal': return <MealTool createMemo={createMemo} setStatus={setStatus} />
    case 'timetrack': return <TimetrackTool createMemo={createMemo} setStatus={setStatus} />
    case 'attendance': return <AttendanceTool createMemo={createMemo} setStatus={setStatus} />
    case 'groupProj': return <SimpleTaskTool id="groupProj" title="조별과제" createMemo={createMemo} setStatus={setStatus} />
    case 'examPlan': return <SimpleTaskTool id="examPlan" title="시험 계획표" createMemo={createMemo} setStatus={setStatus} />
    case 'projPipe': return <SimpleTaskTool id="projPipe" title="프로젝트 파이프라인" createMemo={createMemo} setStatus={setStatus} />
    case 'paperList': return <SimpleTaskTool id="paperList" title="논문 리딩 리스트" createMemo={createMemo} setStatus={setStatus} />
    default: return null
  }
}

function TimetableTool({ createMemo, setStatus }: ToolProps) {
  const data = useRoleToolsStore((s) => s.roleData.timetable) || { semester: '2026-1학기', cells: {} }
  const updateTool = useRoleToolsStore((s) => s.updateTool)

  function updateCell(key: string) {
    const cur = data.cells[key]
    const name = window.prompt('강의명 / 일정명 (빈값이면 삭제)', cur?.name || '')
    if (name === null) return
    updateTool('timetable', (prev) => {
      const next = prev || { semester: data.semester, cells: {} }
      const cells = { ...next.cells }
      if (!name.trim()) {
        delete cells[key]
        return { ...next, cells }
      }
      const room = window.prompt('장소 (선택)', cur?.room || '') || ''
      const prof = window.prompt('담당 / 교수 (선택)', cur?.prof || '') || ''
      cells[key] = { name: name.trim(), room, prof, color: cur?.color || CELL_COLORS[Object.keys(cells).length % CELL_COLORS.length] }
      return { ...next, cells }
    })
    setStatus('시간표가 저장되었습니다.')
  }

  function saveMemo() {
    const rows = TIMETABLE_PERIODS.map((period, pi) => {
      const cells = TIMETABLE_DAYS.map((_, di) => {
        const c = data.cells[`${pi}-${di}`]
        return `<td>${c ? `<b>${escapeHtml(c.name)}</b><br>${escapeHtml(c.room || '')}` : ''}</td>`
      }).join('')
      return `<tr><th>${period}</th>${cells}</tr>`
    }).join('')
    createMemo(`시간표 ${data.semester}`, `<h2>${escapeHtml(data.semester)} 시간표</h2><table><tbody><tr><th>시간</th>${TIMETABLE_DAYS.map((d) => `<th>${d}</th>`).join('')}</tr>${rows}</tbody></table>`)
  }

  return (
    <div className="jan-role-tool">
      <div className="jan-role-inline-controls">
        <input value={data.semester} onChange={(e) => updateTool('timetable', (prev) => ({ semester: e.target.value, cells: prev?.cells || {} }))} aria-label="학기" />
        <button onClick={saveMemo}>메모로 저장</button>
      </div>
      <table className="jan-role-table jan-timetable">
        <tbody>
          <tr><th>시간</th>{TIMETABLE_DAYS.map((d) => <th key={d}>{d}</th>)}</tr>
          {TIMETABLE_PERIODS.map((period, pi) => (
            <tr key={period}>
              <th>{period}</th>
              {TIMETABLE_DAYS.map((day, di) => {
                const key = `${pi}-${di}`
                const cell = data.cells[key]
                return (
                  <td key={day} onClick={() => updateCell(key)} className="jan-time-cell">
                    {cell && <span style={{ background: cell.color }}><b>{cell.name}</b><small>{cell.room}</small></span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LedgerTool({ createMemo, setStatus }: ToolProps) {
  const data = useRoleToolsStore((s) => s.roleData.ledger) || { entries: [] as LedgerEntry[] }
  const updateTool = useRoleToolsStore((s) => s.updateTool)
  const [month, setMonth] = useState(isoMonth())
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all')
  const monthEntries = data.entries.filter((e) => e.date.startsWith(month))
  const visible = monthEntries.filter((e) => filter === 'all' || e.type === filter).sort((a, b) => b.date.localeCompare(a.date))
  const income = monthEntries.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0)
  const expense = monthEntries.filter((e) => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0)

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const type = formText(form, 'type') as 'expense' | 'income'
    const amount = formNumber(form, 'amount')
    if (!amount || amount <= 0) { setStatus('금액을 입력하세요.'); return }
    const entry: LedgerEntry = { id: makeRoleToolId('ld'), type, date: formText(form, 'date') || isoDate(), category: formText(form, 'category'), amount, note: formText(form, 'note') }
    updateTool('ledger', (prev) => ({ entries: [...(prev?.entries || []), entry] }))
    form.reset()
    setStatus('가계부 내역을 추가했습니다.')
  }

  function remove(id: string) {
    updateTool('ledger', (prev) => ({ entries: (prev?.entries || []).filter((e) => e.id !== id) }))
  }

  function exportCsv() {
    const csv = '일자,구분,카테고리,금액,메모\r\n' + data.entries.map((e) => `${e.date},${e.type === 'expense' ? '지출' : '수입'},"${e.category}",${e.amount},"${(e.note || '').replace(/"/g, '""')}"`).join('\r\n')
    downloadCsv(`ledger-${isoDate()}.csv`, csv)
  }

  function saveMemo() {
    const rows = visible.map((e) => `<tr><td>${e.date}</td><td>${e.type === 'expense' ? '지출' : '수입'}</td><td>${escapeHtml(e.category)}</td><td>${money(e.amount)}</td><td>${escapeHtml(e.note || '')}</td></tr>`).join('')
    createMemo(`가계부 ${month}`, `<h2>가계부 ${month}</h2><p>수입 ${money(income)} · 지출 ${money(expense)} · 잔액 ${money(income - expense)}</p><table><tbody><tr><th>일자</th><th>구분</th><th>카테고리</th><th>금액</th><th>메모</th></tr>${rows}</tbody></table>`)
  }

  return (
    <div className="jan-role-tool">
      <div className="jan-ledger-summary">
        <span>수입 <b className="pos">{money(income)}</b></span>
        <span>지출 <b className="neg">{money(expense)}</b></span>
        <span>잔액 <b className={income - expense >= 0 ? 'pos' : 'neg'}>{money(income - expense)}</b></span>
      </div>
      <form className="jan-role-form-grid" onSubmit={add}>
        <select name="type" defaultValue="expense">{(['expense', 'income'] as const).map((t) => <option key={t} value={t}>{t === 'expense' ? '지출' : '수입'}</option>)}</select>
        <input name="date" type="date" defaultValue={isoDate()} />
        <select name="category">{[...LEDGER_CATS.expense, ...LEDGER_CATS.income].map((c) => <option key={c}>{c}</option>)}</select>
        <input name="amount" type="number" min="0" placeholder="금액" />
        <input name="note" placeholder="메모" />
        <button className="primary">추가</button>
      </form>
      <div className="jan-role-inline-controls">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">전체</option><option value="expense">지출</option><option value="income">수입</option></select>
        <button onClick={exportCsv}>CSV</button>
        <button onClick={saveMemo}>메모로 저장</button>
      </div>
      <div className="jan-role-list">
        {visible.length === 0 ? <div className="jan-role-empty-row">내역이 없습니다</div> : visible.map((e) => (
          <div className="jan-role-list-row" key={e.id}>
            <span>{e.date.slice(5)}</span><b className={e.type === 'income' ? 'pos' : 'neg'}>{e.type === 'income' ? '수입' : '지출'}</b><span>{e.category} {e.note && <small>· {e.note}</small>}</span><strong>{money(e.amount)}</strong><button onClick={() => remove(e.id)}><Icon name="trash" /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function GpaTool({ createMemo }: ToolProps) {
  const data = useRoleToolsStore((s) => s.roleData.gpa) || { scale: 4.5, courses: [{ id: makeRoleToolId('gpa'), name: '', credit: 3, grade: 4.5 }] as CourseEntry[] }
  const updateTool = useRoleToolsStore((s) => s.updateTool)
  const courses = data.courses.length ? data.courses : [{ id: makeRoleToolId('gpa'), name: '', credit: 3, grade: 4.5 }]
  const totalCredit = courses.reduce((sum, c) => sum + (Number(c.credit) || 0), 0)
  const raw = totalCredit ? courses.reduce((sum, c) => sum + (Number(c.credit) || 0) * (Number(c.grade) || 0), 0) / totalCredit : 0
  const gpa = data.scale === 4.5 ? raw : (raw / 4.5) * data.scale

  function patchCourse(id: string, patch: Partial<CourseEntry>) {
    updateTool('gpa', (prev) => ({ scale: prev?.scale || data.scale, courses: courses.map((c) => c.id === id ? { ...c, ...patch } : c) }))
  }

  function saveMemo() {
    const rows = courses.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td>${c.credit}</td><td>${GPA_GRADES.find((g) => g[1] === c.grade)?.[0] || c.grade}</td></tr>`).join('')
    createMemo('GPA 기록', `<h2>GPA 기록</h2><p>평점 평균: <b>${gpa.toFixed(2)}</b> / ${data.scale}</p><table><tbody><tr><th>과목</th><th>학점</th><th>성적</th></tr>${rows}</tbody></table>`)
  }

  return (
    <div className="jan-role-tool">
      <div className="jan-gpa-result">평점 평균 <b>{gpa.toFixed(2)}</b><select value={data.scale} onChange={(e) => updateTool('gpa', (prev) => ({ scale: Number(e.target.value), courses: prev?.courses || courses }))}><option value={4.5}>/ 4.5</option><option value={4.3}>/ 4.3</option><option value={4.0}>/ 4.0</option></select></div>
      <table className="jan-role-table">
        <tbody>
          <tr><th>과목</th><th>학점</th><th>성적</th><th></th></tr>
          {courses.map((c) => (
            <tr key={c.id}>
              <td><input value={c.name} onChange={(e) => patchCourse(c.id, { name: e.target.value })} placeholder="과목명" /></td>
              <td><input type="number" value={c.credit} onChange={(e) => patchCourse(c.id, { credit: Number(e.target.value) })} /></td>
              <td><select value={c.grade} onChange={(e) => patchCourse(c.id, { grade: Number(e.target.value) })}>{GPA_GRADES.map(([n, v]) => <option key={n} value={v}>{n} ({v.toFixed(1)})</option>)}</select></td>
              <td><button onClick={() => updateTool('gpa', (prev) => ({ scale: prev?.scale || data.scale, courses: courses.filter((x) => x.id !== c.id) }))}><Icon name="trash" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="jan-rolepack-actions"><button onClick={() => updateTool('gpa', (prev) => ({ scale: prev?.scale || data.scale, courses: [...courses, { id: makeRoleToolId('gpa'), name: '', credit: 3, grade: 4.5 }] }))}>+ 과목 추가</button><button onClick={saveMemo}>메모로 저장</button></div>
    </div>
  )
}

function DdayTool({ createMemo, setStatus }: ToolProps) {
  const data = useRoleToolsStore((s) => s.roleData.dday) || { list: [] as DdayEntry[] }
  const updateTool = useRoleToolsStore((s) => s.updateTool)
  const sorted = [...data.list].sort((a, b) => a.date.localeCompare(b.date))

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const title = formText(form, 'title')
    const date = formText(form, 'date')
    if (!title || !date) { setStatus('이름과 날짜를 입력하세요.'); return }
    updateTool('dday', (prev) => ({ list: [...(prev?.list || []), { id: makeRoleToolId('dd'), title, date, memo: formText(form, 'memo') }] }))
    form.reset()
    setStatus('D-Day를 추가했습니다.')
  }

  function saveMemo() {
    const rows = sorted.map((d) => `<tr><td>${ddayLabel(d.date)}</td><td>${escapeHtml(d.title)}</td><td>${d.date}</td><td>${escapeHtml(d.memo || '')}</td></tr>`).join('')
    createMemo('D-Day 목록', `<h2>D-Day 목록</h2><table><tbody><tr><th>D</th><th>이름</th><th>날짜</th><th>메모</th></tr>${rows}</tbody></table>`)
  }

  return (
    <div className="jan-role-tool">
      <form className="jan-role-form-grid" onSubmit={add}>
        <input name="title" placeholder="이름" />
        <input name="date" type="date" defaultValue={isoDate()} />
        <input name="memo" placeholder="메모" />
        <button className="primary">+ 추가</button>
      </form>
      <div className="jan-role-list">
        {sorted.length === 0 ? <div className="jan-role-empty-row">등록된 D-Day가 없습니다</div> : sorted.map((d) => (
          <div className="jan-dday-row" key={d.id}>
            <b className={ddayLabel(d.date) === 'D-Day' ? 'today' : ''}>{ddayLabel(d.date)}</b>
            <span><strong>{d.title}</strong><small>{d.date}{d.memo ? ` · ${d.memo}` : ''}</small></span>
            <button onClick={() => updateTool('dday', (prev) => ({ list: (prev?.list || []).filter((x) => x.id !== d.id) }))}><Icon name="trash" /></button>
          </div>
        ))}
      </div>
      <div className="jan-rolepack-actions"><button onClick={saveMemo}>메모로 저장</button></div>
    </div>
  )
}

function MedTool({ setStatus }: ToolProps) {
  const data = useRoleToolsStore((s) => s.roleData.med) || { list: [] as MedEntry[], log: {} }
  const updateTool = useRoleToolsStore((s) => s.updateTool)
  const today = isoDate()
  const todayLog = data.log[today] || {}

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const name = formText(form, 'name')
    const times = formText(form, 'times').split(',').map((t) => t.trim()).filter(Boolean)
    if (!name || times.length === 0) { setStatus('약 이름과 복용 시간을 입력하세요.'); return }
    updateTool('med', (prev) => ({ list: [...(prev?.list || []), { id: makeRoleToolId('med'), name, dose: formText(form, 'dose'), times }], log: prev?.log || {} }))
    form.reset()
  }

  function toggle(medId: string, time: string, checked: boolean) {
    updateTool('med', (prev) => {
      const log = { ...(prev?.log || {}) }
      const day = { ...(log[today] || {}) }
      const key = `${medId}:${time}`
      if (checked) day[key] = Date.now()
      else delete day[key]
      log[today] = day
      return { list: prev?.list || [], log }
    })
  }

  return (
    <div className="jan-role-tool">
      <form className="jan-role-form-grid" onSubmit={add}>
        <input name="name" placeholder="약 이름" />
        <input name="dose" placeholder="용량 예: 1정" />
        <input name="times" placeholder="08:00, 20:00" />
        <button className="primary">+ 약 추가</button>
      </form>
      <div className="jan-role-list">
        {data.list.length === 0 ? <div className="jan-role-empty-row">등록된 약이 없습니다</div> : data.list.map((m) => (
          <div className="jan-med-row" key={m.id}>
            <div><b>{m.name}</b><small>{m.dose}</small></div>
            <div>{m.times.map((time) => <label key={time}><input type="checkbox" checked={!!todayLog[`${m.id}:${time}`]} onChange={(e) => toggle(m.id, time, e.target.checked)} /> {time}</label>)}</div>
            <button onClick={() => updateTool('med', (prev) => ({ list: (prev?.list || []).filter((x) => x.id !== m.id), log: prev?.log || {} }))}><Icon name="trash" /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function VitalTool({ setStatus }: ToolProps) {
  const data = useRoleToolsStore((s) => s.roleData.vital) || { records: [] as VitalEntry[] }
  const updateTool = useRoleToolsStore((s) => s.updateTool)
  const [type, setType] = useState<'bp' | 'glucose' | 'weight'>('bp')
  const recs = data.records.filter((r) => r.type === type).sort((a, b) => b.dt.localeCompare(a.dt)).slice(0, 20)

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const v1 = formNumber(form, 'v1')
    if (!v1) { setStatus('값을 입력하세요.'); return }
    updateTool('vital', (prev) => ({ records: [...(prev?.records || []), { id: makeRoleToolId('vt'), type, dt: formText(form, 'dt') || new Date().toISOString(), v1, v2: formNumber(form, 'v2') || undefined, pulse: formNumber(form, 'pulse') || undefined, note: formText(form, 'note') }] }))
    form.reset()
  }

  return (
    <div className="jan-role-tool">
      <form className="jan-role-form-grid" onSubmit={add}>
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="bp">혈압</option><option value="glucose">혈당</option><option value="weight">체중</option></select>
        <input name="dt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
        <input name="v1" type="number" placeholder={type === 'bp' ? '수축기' : type === 'glucose' ? '혈당' : '체중'} />
        {type === 'bp' && <><input name="v2" type="number" placeholder="이완기" /><input name="pulse" type="number" placeholder="맥박" /></>}
        <input name="note" placeholder="메모" />
        <button className="primary">기록</button>
      </form>
      <div className="jan-role-list">
        {recs.length === 0 ? <div className="jan-role-empty-row">기록이 없습니다</div> : recs.map((r) => (
          <div className="jan-role-list-row" key={r.id}><span>{new Date(r.dt).toLocaleString('ko-KR')}</span><b>{type === 'bp' ? `${r.v1}/${r.v2 || '-'}` : r.v1}</b><span>{r.pulse ? `맥박 ${r.pulse}` : ''} {r.note}</span><button onClick={() => updateTool('vital', (prev) => ({ records: (prev?.records || []).filter((x) => x.id !== r.id) }))}><Icon name="trash" /></button></div>
        ))}
      </div>
    </div>
  )
}

function ShopTool({ createMemo, setStatus }: ToolProps) {
  const data = useRoleToolsStore((s) => s.roleData.shop) || { list: [] as ShopEntry[] }
  const updateTool = useRoleToolsStore((s) => s.updateTool)
  const grouped = data.list.reduce<Record<string, ShopEntry[]>>((acc, item) => {
    acc[item.cat] = acc[item.cat] || []
    acc[item.cat].push(item)
    return acc
  }, {})

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const name = formText(form, 'name')
    if (!name) { setStatus('품목을 입력하세요.'); return }
    updateTool('shop', (prev) => ({ list: [...(prev?.list || []), { id: makeRoleToolId('shop'), name, cat: formText(form, 'cat'), done: false }] }))
    form.reset()
  }

  function saveMemo() {
    const html = Object.entries(grouped).map(([cat, items]) => `<h3>${escapeHtml(cat)}</h3><ul>${items.map((it) => `<li>${it.done ? '✓ ' : ''}${escapeHtml(it.name)}</li>`).join('')}</ul>`).join('')
    createMemo('장보기 리스트', `<h2>장보기 리스트</h2>${html}`)
  }

  return (
    <div className="jan-role-tool">
      <form className="jan-role-form-grid" onSubmit={add}>
        <input name="name" placeholder="추가할 품목" />
        <select name="cat">{SHOP_CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <button className="primary">추가</button>
      </form>
      <div className="jan-rolepack-actions"><button onClick={() => updateTool('shop', (prev) => ({ list: (prev?.list || []).filter((x) => !x.done) }))}>완료 항목 삭제</button><button onClick={saveMemo}>메모로 저장</button></div>
      {Object.entries(grouped).length === 0 ? <div className="jan-role-empty-row">품목을 추가하세요</div> : Object.entries(grouped).map(([cat, items]) => (
        <section className="jan-shop-group" key={cat}><h5>{cat} ({items.length})</h5>{items.map((item) => <label key={item.id} className={item.done ? 'done' : ''}><input type="checkbox" checked={item.done} onChange={(e) => updateTool('shop', (prev) => ({ list: (prev?.list || []).map((x) => x.id === item.id ? { ...x, done: e.target.checked } : x) }))} /> {item.name}<button onClick={() => updateTool('shop', (prev) => ({ list: (prev?.list || []).filter((x) => x.id !== item.id) }))}><Icon name="close" /></button></label>)}</section>
      ))}
    </div>
  )
}

function MealTool({ createMemo }: ToolProps) {
  const data = useRoleToolsStore((s) => s.roleData.meal) || { week: isoWeek(), plans: {} }
  const updateTool = useRoleToolsStore((s) => s.updateTool)
  const week = data.week || isoWeek()
  const plan = data.plans[week] || {}
  const days = ['월', '화', '수', '목', '금', '토', '일']
  const meals = [['breakfast', '아침'], ['lunch', '점심'], ['dinner', '저녁']] as const

  function patch(key: string, value: string) {
    updateTool('meal', (prev) => {
      const next = prev || { week, plans: {} }
      return { ...next, week, plans: { ...next.plans, [week]: { ...(next.plans[week] || {}), [key]: value } } }
    })
  }

  function saveMemo() {
    const rows = meals.map(([mk, label]) => `<tr><th>${label}</th>${days.map((_, di) => `<td>${escapeHtml(plan[`${mk}-${di}`] || '')}</td>`).join('')}</tr>`).join('')
    createMemo(`식단 ${week}`, `<h2>식단 ${week}</h2><table><tbody><tr><th></th>${days.map((d) => `<th>${d}</th>`).join('')}</tr>${rows}</tbody></table>`)
  }

  return (
    <div className="jan-role-tool">
      <div className="jan-role-inline-controls"><input type="week" value={week} onChange={(e) => updateTool('meal', (prev) => ({ week: e.target.value, plans: prev?.plans || {} }))} /><button onClick={saveMemo}>메모로 저장</button></div>
      <table className="jan-role-table jan-meal-table"><tbody><tr><th></th>{days.map((d) => <th key={d}>{d}</th>)}</tr>{meals.map(([mk, label]) => <tr key={mk}><th>{label}</th>{days.map((d, di) => <td key={d}><textarea value={plan[`${mk}-${di}`] || ''} onChange={(e) => patch(`${mk}-${di}`, e.target.value)} /></td>)}</tr>)}</tbody></table>
    </div>
  )
}

function TimetrackTool({ setStatus }: ToolProps) {
  const data = useRoleToolsStore((s) => s.roleData.timetrack) || { entries: [] as TimeEntry[], current: null }
  const updateTool = useRoleToolsStore((s) => s.updateTool)
  const [now, setNow] = useState(() => Date.now())
  const currentStart = data.current?.start

  useEffect(() => {
    if (!currentStart) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [currentStart])

  function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (data.current) { setStatus('이미 진행 중인 작업이 있습니다.'); return }
    const name = formText(e.currentTarget, 'name')
    if (!name) { setStatus('프로젝트/작업명을 입력하세요.'); return }
    updateTool('timetrack', (prev) => ({ entries: prev?.entries || [], current: { name, start: Date.now() } }))
    e.currentTarget.reset()
  }

  function stop() {
    if (!data.current) return
    const entry: TimeEntry = { id: makeRoleToolId('time'), name: data.current.name, start: data.current.start, end: Date.now() }
    updateTool('timetrack', (prev) => ({ entries: [...(prev?.entries || []), entry], current: null }))
  }

  const totalToday = data.entries
    .filter((e) => new Date(e.start).toDateString() === new Date().toDateString())
    .reduce((sum, e) => sum + e.end - e.start, 0)

  return (
    <div className="jan-role-tool">
      <form className="jan-role-form-grid" onSubmit={start}><input name="name" placeholder="프로젝트 / 작업명" /><button className="primary">시작</button></form>
      {data.current && <div className="jan-current-timer"><b>{data.current.name}</b><strong>{formatDuration(now - data.current.start)}</strong><button onClick={stop}>정지</button></div>}
      <div className="jan-role-summary-line">오늘 누적: <b>{formatDuration(totalToday)}</b></div>
      <div className="jan-role-list">
        {data.entries.slice().reverse().slice(0, 20).map((e) => <div className="jan-role-list-row" key={e.id}><b>{e.name}</b><span>{new Date(e.start).toLocaleString('ko-KR')}</span><strong>{formatDuration(e.end - e.start)}</strong><button onClick={() => updateTool('timetrack', (prev) => ({ entries: (prev?.entries || []).filter((x) => x.id !== e.id), current: prev?.current || null }))}><Icon name="trash" /></button></div>)}
      </div>
    </div>
  )
}

function AttendanceTool({ createMemo, setStatus }: ToolProps) {
  const data = useRoleToolsStore((s) => s.roleData.attendance) || { list: [] as AttendanceEntry[] }
  const updateTool = useRoleToolsStore((s) => s.updateTool)

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const course = formText(e.currentTarget, 'course')
    if (!course) { setStatus('과목명을 입력하세요.'); return }
    updateTool('attendance', (prev) => ({ list: [...(prev?.list || []), { id: makeRoleToolId('att'), course, attended: formNumber(e.currentTarget, 'attended') || 0, total: formNumber(e.currentTarget, 'total') || 0 }] }))
    e.currentTarget.reset()
  }

  function saveMemo() {
    const rows = data.list.map((x) => `<tr><td>${escapeHtml(x.course)}</td><td>${x.attended}/${x.total}</td><td>${x.total ? Math.round((x.attended / x.total) * 100) : 0}%</td></tr>`).join('')
    createMemo('출결 관리', `<h2>출결 관리</h2><table><tbody><tr><th>과목</th><th>출석</th><th>출석률</th></tr>${rows}</tbody></table>`)
  }

  return (
    <div className="jan-role-tool">
      <form className="jan-role-form-grid" onSubmit={add}><input name="course" placeholder="과목명" /><input name="attended" type="number" placeholder="출석" /><input name="total" type="number" placeholder="전체" /><button className="primary">추가</button></form>
      <div className="jan-rolepack-actions"><button onClick={saveMemo}>메모로 저장</button></div>
      <div className="jan-role-list">{data.list.map((x) => <div className="jan-role-list-row" key={x.id}><b>{x.course}</b><span>{x.attended}/{x.total}</span><strong>{x.total ? Math.round((x.attended / x.total) * 100) : 0}%</strong><button onClick={() => updateTool('attendance', (prev) => ({ list: (prev?.list || []).filter((i) => i.id !== x.id) }))}><Icon name="trash" /></button></div>)}</div>
    </div>
  )
}

function SimpleTaskTool({ id, title, createMemo, setStatus }: ToolProps & { id: 'groupProj' | 'examPlan' | 'projPipe' | 'paperList'; title: string }) {
  const data = useRoleToolsStore((s) => s.roleData[id]) || { tasks: [] as SimpleTask[] }
  const updateTool = useRoleToolsStore((s) => s.updateTool)
  const statusOptions = id === 'projPipe' ? ['Backlog', 'Doing', 'Review', 'Done'] : id === 'paperList' ? ['읽을 예정', '읽는 중', '정리 완료'] : ['대기', '진행', '완료']

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const taskTitle = formText(e.currentTarget, 'title')
    if (!taskTitle) { setStatus('항목명을 입력하세요.'); return }
    updateTool(id, (prev) => ({ tasks: [...(((prev as { tasks?: SimpleTask[] } | undefined)?.tasks) || []), { id: makeRoleToolId(id), title: taskTitle, owner: formText(e.currentTarget, 'owner'), due: formText(e.currentTarget, 'due'), status: formText(e.currentTarget, 'status'), note: formText(e.currentTarget, 'note') }] } as never))
    e.currentTarget.reset()
  }

  function remove(taskId: string) {
    updateTool(id, (prev) => ({ tasks: (((prev as { tasks?: SimpleTask[] } | undefined)?.tasks) || []).filter((x) => x.id !== taskId) } as never))
  }

  function saveMemo() {
    const rows = data.tasks.map((x) => `<tr><td>${escapeHtml(x.title)}</td><td>${escapeHtml(x.owner || '')}</td><td>${escapeHtml(x.due || '')}</td><td>${escapeHtml(x.status || '')}</td><td>${escapeHtml(x.note || '')}</td></tr>`).join('')
    createMemo(title, `<h2>${escapeHtml(title)}</h2><table><tbody><tr><th>항목</th><th>담당</th><th>마감</th><th>상태</th><th>메모</th></tr>${rows}</tbody></table>`)
  }

  return (
    <div className="jan-role-tool">
      <form className="jan-role-form-grid" onSubmit={add}>
        <input name="title" placeholder={id === 'paperList' ? '논문 제목' : '항목'} />
        <input name="owner" placeholder="담당 / 저자" />
        <input name="due" type="date" />
        <select name="status">{statusOptions.map((s) => <option key={s}>{s}</option>)}</select>
        <input name="note" placeholder="메모" />
        <button className="primary">추가</button>
      </form>
      <div className="jan-rolepack-actions"><button onClick={saveMemo}>메모로 저장</button></div>
      <div className="jan-role-list">
        {data.tasks.length === 0 ? <div className="jan-role-empty-row">항목이 없습니다</div> : data.tasks.map((task) => <div className="jan-role-list-row" key={task.id}><b>{task.title}</b><span>{task.owner}</span><span>{task.due}</span><strong>{task.status}</strong><button onClick={() => remove(task.id)}><Icon name="trash" /></button></div>)}
      </div>
    </div>
  )
}

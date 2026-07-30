interface KeyboardHelpProps {
  onClose: () => void
}

/**
 * Phase 6 — 키보드 단축키 도움말.
 * Ctrl+? 또는 F1.
 */
const SHORTCUTS: Array<{ category: string; items: Array<[string, string]> }> = [
  {
    category: '파일',
    items: [
      ['Ctrl+S', '저장 (showSaveFilePicker)'],
      ['Ctrl+O', '파일 열기'],
      ['Ctrl+P', '인쇄 (브라우저)'],
      ['Ctrl+Alt+P', '인쇄 미리보기 (Paged.js)'],
      ['Ctrl+N', '새 메모'],
    ],
  },
  {
    category: '편집',
    items: [
      ['Ctrl+B', '굵게'],
      ['Ctrl+I', '기울임'],
      ['Ctrl+U', '밑줄'],
      ['Ctrl+Z', '실행 취소'],
      ['Ctrl+Shift+Z', '다시 실행'],
    ],
  },
  {
    category: '단락',
    items: [
      ['Ctrl+Alt+1~3', '제목 1~3'],
      ['Ctrl+Shift+N', '일반 문단'],
      ['Ctrl+L', '왼쪽 정렬'],
      ['Ctrl+E', '가운데 정렬'],
      ['Ctrl+R', '오른쪽 정렬'],
      ['Ctrl+J', '양쪽 정렬'],
      ['Tab / Shift+Tab', '목록 들여쓰기 / 내어쓰기'],
      ['Ctrl+M / Ctrl+Shift+M', '목록 단계 올림 / 내림'],
    ],
  },
  {
    category: '도구',
    items: [
      ['Ctrl+K', '링크 삽입/수정'],
      ['Ctrl+Shift+P', '명령 팔레트'],
      ['Ctrl+/', 'AI 도우미'],
      ['Ctrl+,', '설정'],
      ['Ctrl+Shift+F', '전체 검색'],
      ['F1 / Ctrl+?', '단축키 도움말'],
    ],
  },
  {
    /* 검수 탭 — 수식어는 하나만 쓴다 (F7·Shift+F7 은 워드 자리, F9 는 한글 자리) */
    category: '검수',
    items: [
      ['F7', '맞춤법 검사 켬/끔'],
      ['Shift+F7', '동의어 사전'],
      ['F9', '한자로 바꾸기'],
      ['Alt+U', '변경 내용 추적 켬/끔'],
      ['Alt+F11', '검토 창'],
      ['Alt+, / Alt+.', '이전 / 다음 변경으로'],
      ['Ctrl+Alt+M', '고른 글에 메모 달기'],
    ],
  },
  {
    /* AI — 수식어는 하나만 */
    category: 'AI',
    items: [
      ['Alt+J', '문서 자동 작성'],
      ['Ctrl+/', 'AI 도우미'],
      ['Ctrl+P', '명령 팔레트에서 「AI 연결」 찾기'],
    ],
  },
]

export function KeyboardHelp({ onClose }: KeyboardHelpProps) {
  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>키보드 단축키</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          {SHORTCUTS.map((group) => (
            <section key={group.category} className="jan-help-section">
              <h4>{group.category}</h4>
              <table className="jan-help-table">
                <tbody>
                  {group.items.map(([key, desc]) => (
                    <tr key={key}>
                      <td><kbd>{key}</kbd></td>
                      <td>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

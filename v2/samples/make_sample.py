# -*- coding: utf-8 -*-
"""JustANotepad v2 기능 점검용 샘플 문서(.html) 생성.

앱의 저장 형식과 같은 '평면 HTML' 이라 파일 → 열기로 바로 불러온다.
표·그림·수식·콜아웃·목록·정렬·쪽 나눔 등 편집기 기능을 한 문서에서 훑는다.
"""
import base64
import io
import os


def svg_uri(svg: str) -> str:
    return 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode('utf-8')).decode('ascii')


CHART = """<svg xmlns="http://www.w3.org/2000/svg" width="520" height="240" viewBox="0 0 520 240">
  <rect width="520" height="240" fill="#ffffff"/>
  <g stroke="#d7dbe0" stroke-width="1">
    <line x1="60" y1="20" x2="60" y2="200"/><line x1="60" y1="200" x2="500" y2="200"/>
    <line x1="60" y1="155" x2="500" y2="155" stroke-dasharray="3 3"/>
    <line x1="60" y1="110" x2="500" y2="110" stroke-dasharray="3 3"/>
    <line x1="60" y1="65" x2="500" y2="65" stroke-dasharray="3 3"/>
  </g>
  <g fill="#D97757">
    <rect x="90" y="128" width="46" height="72"/><rect x="180" y="96" width="46" height="104"/>
    <rect x="270" y="60" width="46" height="140"/><rect x="360" y="38" width="46" height="162"/>
  </g>
  <g fill="#5b6068" font-family="sans-serif" font-size="12" text-anchor="middle">
    <text x="113" y="218">1분기</text><text x="203" y="218">2분기</text>
    <text x="293" y="218">3분기</text><text x="383" y="218">4분기</text>
  </g>
  <g fill="#8a9099" font-family="sans-serif" font-size="11" text-anchor="end">
    <text x="52" y="204">0</text><text x="52" y="159">40</text><text x="52" y="114">80</text><text x="52" y="69">120</text>
  </g>
</svg>"""

DIAGRAM = """<svg xmlns="http://www.w3.org/2000/svg" width="420" height="150" viewBox="0 0 420 150">
  <rect width="420" height="150" fill="#ffffff"/>
  <g font-family="sans-serif" font-size="12" text-anchor="middle">
    <rect x="14" y="45" width="106" height="52" rx="6" fill="#eef4ff" stroke="#5b7cc4"/>
    <text x="67" y="76" fill="#31456e">초안 작성</text>
    <rect x="157" y="45" width="106" height="52" rx="6" fill="#fff3e8" stroke="#D97757"/>
    <text x="210" y="76" fill="#8a4a2c">검토 · 수정</text>
    <rect x="300" y="45" width="106" height="52" rx="6" fill="#eafaf3" stroke="#2f9c7c"/>
    <text x="353" y="76" fill="#1f6a53">인쇄 · 배포</text>
  </g>
  <g stroke="#9aa1ab" stroke-width="1.5" fill="none" marker-end="url(#a)">
    <path d="M120 71 H150"/><path d="M263 71 H293"/>
  </g>
  <defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
    <path d="M0 0 L8 4 L0 8 z" fill="#9aa1ab"/></marker></defs>
</svg>"""

LONG = ('한 쪽을 글자로 꽉 채운 뒤 넘치는 줄부터 다음 쪽으로 흘러가는지 보기 위한 문단입니다. '
        '워드나 한글처럼 문단이 쪽 경계에 걸리면 들어갈 수 있는 줄까지만 앞 쪽에 남고, '
        '나머지 줄은 다음 쪽 첫 줄로 이어집니다. 줄 간격을 바꾸면 뒤 쪽 내용이 앞으로 올라와 다시 채워지고, '
        '내용을 지우면 그만큼 되돌아옵니다. ')

parts = []
A = parts.append

A('<h1 style="text-align: center">문서 기능 점검 샘플</h1>')
A('<p style="text-align: center"><em>표 · 그림 · 수식 · 서식 · 쪽 나눔을 한 문서에서 확인합니다</em></p>')
A('<p style="text-align: center">2026. 7. 25. · JustANotepad v2</p>')

A('<h2>1. 글자 · 문단 서식</h2>')
A('<p>본문 글자에 <strong>굵게</strong>, <em>기울임</em>, <u>밑줄</u>, <s>취소선</s>, '
  '<mark data-color="#FFEB3B" style="background-color: #FFEB3B">형광펜</mark>, '
  '<span style="color: #D97757">글자색</span>을 적용했습니다. '
  '화학식 H<sub>2</sub>O 와 지수 x<sup>2</sup> 처럼 아래·위 첨자도 쓸 수 있습니다.</p>')
A('<p style="text-align: left">왼쪽 정렬 문단입니다.</p>')
A('<p style="text-align: center">가운데 정렬 문단입니다.</p>')
A('<p style="text-align: right">오른쪽 정렬 문단입니다.</p>')
A('<p style="text-align: justify">양쪽 정렬 문단입니다. ' + LONG[:120] + '</p>')
A('<p data-indent="2" style="margin-left: 48px">왼쪽 들여쓰기 2단계(48px)를 준 문단입니다. '
  '눈금자의 아래쪽 삼각형 손잡이를 끌어도 같은 값이 바뀝니다.</p>')
A('<p style="text-indent: 24px">첫 줄만 24px 들여쓴 문단입니다. ' + LONG[:90] + '</p>')

A('<h2>2. 목록</h2>')
A('<ul><li><p>글머리 기호 항목</p></li><li><p>두 번째 항목</p>'
  '<ul><li><p>한 단계 들어간 항목</p></li></ul></li></ul>')
A('<ol><li><p>번호 목록 첫째</p></li><li><p>번호 목록 둘째</p></li></ol>')
A('<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>끝난 일</p></div></li>'
  '<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>남은 일</p></div></li></ul>')

A('<h2>3. 인용 · 코드 · 강조 상자</h2>')
A('<blockquote><p>문서는 읽는 사람이 길을 잃지 않게 하는 것이 첫째다.</p></blockquote>')
A('<pre><code>function pageHeight(mm) {\n  return (mm * 96) / 25.4   // mm → px\n}</code></pre>')
A('<div data-callout="" data-kind="info"><p>정보 상자 — 참고할 내용을 담습니다.</p></div>')
A('<div data-callout="" data-kind="warn"><p>경고 상자 — 주의할 내용을 담습니다.</p></div>')

A('<h2>4. 표</h2>')
A('<p>제목 행이 있는 기본 표입니다. 표 안에 커서를 두면 리본에 <strong>표</strong> 탭이 나타납니다.</p>')
A('<table><tbody>'
  '<tr><th><p>구분</p></th><th><p>1분기</p></th><th><p>2분기</p></th><th><p>3분기</p></th><th><p>4분기</p></th></tr>'
  '<tr><td><p>계약 건수</p></td><td><p>36</p></td><td><p>52</p></td><td><p>70</p></td><td><p>81</p></td></tr>'
  '<tr><td><p>해지 건수</p></td><td><p>4</p></td><td><p>6</p></td><td><p>5</p></td><td><p>7</p></td></tr>'
  '<tr><td><p>순증</p></td><td><p>32</p></td><td><p>46</p></td><td><p>65</p></td><td><p>74</p></td></tr>'
  '</tbody></table>')
A('<p>표 탭의 <strong>합계 · 평균 · 개수</strong>는 숫자 열에서 바로 계산되고, '
  '<strong>오름/내림차순</strong>은 제목 행을 남긴 채 자료 행만 정렬합니다.</p>')
A('<p>셀 배경으로 강조한 표입니다.</p>')
A('<table><tbody>'
  '<tr><th><p>항목</p></th><th><p>기준</p></th><th><p>결과</p></th></tr>'
  '<tr><td><p>여백</p></td><td><p>20mm</p></td><td style="background-color: #eafaf3"><p>적합</p></td></tr>'
  '<tr><td><p>줄 간격</p></td><td><p>1.5</p></td><td style="background-color: #eafaf3"><p>적합</p></td></tr>'
  '<tr><td><p>본문 글꼴</p></td><td><p>10.5pt</p></td><td style="background-color: #fdecec"><p>확인 필요</p></td></tr>'
  '</tbody></table>')

A('<h2>5. 그림</h2>')
A('<img src="%s" width="520">' % svg_uri(CHART))
A('<p style="text-align: center"><em>그림 1. 분기별 계약 추이</em></p>')
A('<p>그림을 누르면 리본에 <strong>그림</strong> 탭이 나타나 크기(작게·중간·크게·본문 너비)와 '
  '배치(왼쪽·가운데·오른쪽)를 바로 바꿀 수 있습니다.</p>')
A('<img src="%s" width="420">' % svg_uri(DIAGRAM))
A('<p style="text-align: center"><em>그림 2. 문서 작업 흐름</em></p>')

A('<hr class="jan-page-break" data-page-break="1" />')
A('<p></p>')

A('<h2>6. 수식 · 참조</h2>')
A('<p>본문 안에 수식을 넣습니다: <span data-math="inline" data-latex="E = mc^2" class="jan-math-inline"></span> '
  '그리고 <span data-math="inline" data-latex="\\int_0^1 x^2\\,dx = \\tfrac13" class="jan-math-inline"></span>.</p>')
A('<p>바깥 자료는 <a href="https://justanotepad.com" target="_blank">링크</a>로 연결합니다.</p>')

A('<h2>7. 쪽을 넘기는 긴 문단</h2>')
A('<p>' + LONG * 12 + '</p>')
A('<p>' + LONG * 8 + '</p>')

html = '\n'.join(parts)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '샘플문서_기능점검.html')
io.open(out, 'w', encoding='utf-8', newline='').write(html)
print(out, len(html), '바이트')

/**
 * Phase 18 — 라인아트 SVG 아이콘 라이브러리.
 * CLAUDE.md 규칙 #1 — 이모지 절대 금지. 모든 아이콘은 stroke="currentColor" SVG.
 */

interface IconProps {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

export type IconName =
  | 'save' | 'open' | 'print' | 'preview' | 'undo' | 'redo'
  | 'bold' | 'italic' | 'underline' | 'strike' | 'highlight'
  | 'palette' | 'paint' | 'fill'
  | 'align-left' | 'align-center' | 'align-right' | 'align-justify'
  | 'list-bullet' | 'list-numbered' | 'list-check'
  | 'quote' | 'code' | 'h1' | 'h2' | 'h3'
  | 'table' | 'image' | 'link' | 'unlink'
  | 'search' | 'find' | 'replace'
  | 'chevron-down' | 'chevron-up' | 'chevron-left' | 'chevron-right'
  | 'menu' | 'plus' | 'close' | 'check' | 'minus'
  | 'pin' | 'pin-on' | 'star' | 'star-on' | 'heart'
  | 'ai' | 'sparkle' | 'wand'
  | 'moon' | 'sun' | 'auto'
  | 'zoom-in' | 'zoom-out'
  | 'mic' | 'mic-off' | 'volume' | 'volume-off' | 'speaker'
  | 'eye' | 'eye-off' | 'lock' | 'unlock'
  | 'file-text' | 'file-plus' | 'folder' | 'trash'
  | 'settings' | 'help' | 'info' | 'bell'
  | 'users' | 'user' | 'login' | 'phone' | 'map'
  | 'paperclip' | 'language' | 'translate'
  | 'image-text' | 'page' | 'globe' | 'cloud'
  | 'maximize' | 'minimize' | 'focus' | 'tag' | 'hash'
  | 'cmd' | 'paragraph' | 'briefcase' | 'sync' | 'home' | 'shield' | 'clock' | 'page-break' | 'columns' | 'sup' | 'box' | 'qr' | 'history' | 'download' | 'upload' | 'dot' | 'send' | 'card' | 'cards' | 'sliders' | 'refresh-cw' | 'window-min' | 'window-max' | 'window-pin' | 'kanban'
  | 'chart' | 'pen' | 'cube' | 'smart' | 'signature' | 'stamp' | 'eraser'

const PATHS: Record<IconName, string> = {
  // 파일
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
  open: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  print: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
  preview: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z',
  undo: 'M3 7v6h6 M21 17a9 9 0 00-15-6.7L3 13',
  redo: 'M21 7v6h-6 M3 17a9 9 0 0115-6.7L21 13',
  // 서식
  bold: 'M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z',
  italic: 'M19 4h-9 M14 20H5 M15 4L9 20',
  underline: 'M6 3v7a6 6 0 006 6 6 6 0 006-6V3 M4 21h16',
  strike: 'M16 4H9a3 3 0 00-2.83 4 M14 12a4 4 0 010 8H6 M4 12h16',
  highlight: 'M9 11l-6 6v3h3l6-6 M14 6l3 3 M22 2l-3 3-3-3 6-3 3 6-3 3z',
  // 색상
  palette: 'M12 22a10 10 0 110-20 10 10 0 0110 10c0 1-1 2-2 2h-4a2 2 0 100 4c0 1-1 4-4 4z M13.5 6.5a1 1 0 11-2 0 1 1 0 012 0z M17.5 10.5a1 1 0 11-2 0 1 1 0 012 0z M6.5 12.5a1 1 0 11-2 0 1 1 0 012 0z M8.5 7.5a1 1 0 11-2 0 1 1 0 012 0z',
  paint: 'M19 11h2v6H3v-6h2 M19 11V5H5v6 M12 11V2',
  fill: 'M19 11l-7-7-7 7 7 7zM5 11h14M2 22h20',
  // 정렬
  'align-left': 'M17 10H3 M21 6H3 M21 14H3 M17 18H3',
  'align-center': 'M18 10H6 M21 6H3 M21 14H3 M18 18H6',
  'align-right': 'M21 10H7 M21 6H3 M21 14H3 M21 18H7',
  'align-justify': 'M21 10H3 M21 6H3 M21 14H3 M21 18H3',
  // 리스트
  'list-bullet': 'M9 6h12 M9 12h12 M9 18h12 M5 6h.01 M5 12h.01 M5 18h.01',
  'list-numbered': 'M10 6h11 M10 12h11 M10 18h11 M4 6h1v4 M4 10h2 M6 18H4c1-4 3-3 3-5 0-2-3-1-3 0',
  'list-check': 'M9 6h12 M9 12h12 M9 18h12 M3 6l1 1 2-2 M3 12l1 1 2-2 M3 18l1 1 2-2',
  // 노드
  quote: 'M3 21c3-3 3-9 0-12 3 0 6 3 6 6V21z M14 21c3-3 3-9 0-12 3 0 6 3 6 6V21z',
  code: 'M16 18l6-6-6-6 M8 6l-6 6 6 6',
  h1: 'M4 12h8 M4 18V6 M12 18V6 M17 12l3-2v8',
  h2: 'M4 12h8 M4 18V6 M12 18V6 M21 18h-4c0-4 4-3 4-6 0-2-4-2-4 0',
  h3: 'M4 12h8 M4 18V6 M12 18V6 M17.5 10.5c0-2 4-2 4 0s-4 0-4 3 4 1 4-1',
  // 삽입
  table: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18',
  image: 'M3 3h18v18H3z M8.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z M21 15l-5-5L5 21',
  link: 'M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1 M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1',
  unlink: 'M18 8l4-4 M2 22l4-4 M11 11a5 5 0 005-5 M13 13a5 5 0 00-5 5 M15 18l-1 1a5 5 0 01-7-7l1-1 M9 6l1-1a5 5 0 017 7l-1 1',
  // 기타
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4-4',
  find: 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4-4 M8 11h6 M11 8v6',
  replace: 'M3 7h13l-3-3 M21 17H8l3 3 M14 7l5 5-5 5',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  plus: 'M12 5v14 M5 12h14',
  close: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 13l4 4L19 7',
  minus: 'M5 12h14',
  pin: 'M12 17v5 M9 7h6l1 9H8z',
  'pin-on': 'M12 17v5 M9 7h6l1 9H8z M9 7l3-5 3 5',
  star: 'M12 2l3 7h7l-6 5 2 8-6-4-6 4 2-8-6-5h7z',
  'star-on': 'M12 2l3 7h7l-6 5 2 8-6-4-6 4 2-8-6-5h7z',
  heart: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z',
  ai: 'M12 2L9 9l-7 3 7 3 3 7 3-7 7-3-7-3z M19 3v4 M21 5h-4',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  wand: 'M15 4V2 M15 16v-2 M8 9h2 M20 9h2 M18 5l-1 1 M18 13l-1-1 M14 9a5 5 0 100 0 M3 21l9-9',
  moon: 'M21 13a9 9 0 11-9-9 7 7 0 009 9z',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10z M12 1v2 M12 21v2 M4 12H1 M23 12h-3 M5 5l1 1 M19 19l-1-1 M5 19l1-1 M19 5l-1 1',
  auto: 'M12 22a10 10 0 100-20 10 10 0 000 20z M12 2v20 M2 12h20',
  'zoom-in': 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4-4 M11 7v8 M7 11h8',
  'zoom-out': 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4-4 M7 11h8',
  mic: 'M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z M19 11a7 7 0 01-14 0 M12 18v4 M8 22h8',
  'mic-off': 'M1 1l22 22 M9 9v2a3 3 0 005 2 M14 6V5a2 2 0 00-4 0v3 M19 11a7 7 0 01-1 4 M5 11a7 7 0 0011 5 M12 18v4 M8 22h8',
  volume: 'M11 5L6 9H2v6h4l5 4V5z M19 12a4 4 0 00-2-3 M22 12a8 8 0 00-4-7',
  'volume-off': 'M11 5L6 9H2v6h4l5 4V5z M23 9l-6 6 M17 9l6 6',
  speaker: 'M11 5L6 9H2v6h4l5 4V5z M15.5 8.5a5 5 0 010 7 M18.5 5.5a9 9 0 010 13',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z',
  'eye-off': 'M1 1l22 22 M10 10a3 3 0 004 4 M9 4l3 0 11 8s-2 4-7 6 M5 6L1 12s4 8 11 8c2 0 4-1 5-1',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 018 0v4',
  unlock: 'M5 11h14v10H5z M8 11V7a4 4 0 017 -3',
  'file-text': 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  'file-plus': 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M12 18v-6 M9 15h6',
  folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  trash: 'M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6 M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  help: 'M12 22a10 10 0 100-20 10 10 0 000 20z M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3 M12 17h.01',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20z M12 16v-4 M12 8h.01',
  bell: 'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  login: 'M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4 M10 17l5-5-5-5 M15 12H3',
  phone: 'M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.08 4.18 2 2 0 014.06 2h3a2 2 0 012 1.72c.13 1 .36 1.96.7 2.87a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.21-1.21a2 2 0 012.11-.45c.91.34 1.87.57 2.87.7A2 2 0 0122 16.92z',
  map: 'M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z M9 3v15 M15 6v15',
  paperclip: 'M21.44 11.05l-9.19 9.19a6 6 0 11-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 11-2.83-2.83l8.49-8.49',
  language: 'M12 22a10 10 0 100-20 10 10 0 000 20z M2 12h20 M12 2c2 3 3 6 3 10 0 4-1 7-3 10-2-3-3-6-3-10 0-4 1-7 3-10z',
  translate: 'M5 8l6 6 M4 14l6-6 2-3 M2 5h12 M7 2h1 M22 22l-5-10-5 10 M14 18h6',
  'image-text': 'M3 3h18v18H3z M8.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z M21 15l-5-5L5 21',
  page: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6',
  globe: 'M12 22a10 10 0 100-20 10 10 0 000 20z M2 12h20 M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10c-2.5-3-4-6.5-4-10s1.5-7 4-10z',
  cloud: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
  maximize: 'M8 3H3v5 M21 8V3h-5 M3 16v5h5 M16 21h5v-5',
  minimize: 'M4 14h6v6 M20 10h-6V4 M14 10l7-7 M3 21l7-7',
  focus: 'M8 3H5a2 2 0 00-2 2v3 M16 3h3a2 2 0 012 2v3 M21 16v3a2 2 0 01-2 2h-3 M8 21H5a2 2 0 01-2-2v-3 M9 12h6 M12 9v6',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01',
  hash: 'M4 9h16 M4 15h16 M10 3L8 21 M16 3l-2 18',
  cmd: 'M18 3a3 3 0 10-3 3v12a3 3 0 103-3H6a3 3 0 10-3 3V6a3 3 0 103 3h12',
  paragraph: 'M13 4v16 M17 4v16 M19 4H9.5a4.5 4.5 0 100 9H13',
  briefcase: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16',
  sync: 'M21 2v6h-6 M3 12a9 9 0 0115-6.7L21 8 M3 22v-6h6 M21 12a9 9 0 01-15 6.7L3 16',
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2',
  'page-break': 'M3 3h18v6H3z M3 21h18v-6H3z M9 12l3 3 3-3 M12 9v6',
  columns: 'M3 3h7v18H3z M14 3h7v18h-7z',
  sup: 'M4 18l6-12 6 12 M16 6h4 M18 4v4',
  box: 'M3 3h18v18H3z',
  qr: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h3v3h-3z M21 21v-3h-3 M21 14v-3 M14 21v-3 M17 14h4',
  history: 'M3 3v6h6 M3.5 11A9 9 0 1112 21 M12 7v5l3 2',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  dot: 'M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0',
  send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
  card: 'M3 5h18v14H3z M3 10h18',
  cards: 'M3 7h12v12H3z M9 3h12v12 M5 11h8 M5 14h6',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  'refresh-cw': 'M21 3v6h-6 M3 21v-6h6 M21 9a9 9 0 00-15-3 M3 15a9 9 0 0015 3',
  'window-min': 'M5 12h14',
  'window-max': 'M3 3h18v18H3z',
  'window-pin': 'M12 17v5 M9 7h6l1 9H8z',
  kanban: 'M3 3h6v18H3z M11 3h6v12h-6z M19 3h2v8h-2z',
  // 차트 — 세로 막대 셋
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  // 펜 (서명)
  pen: 'M12 19l7-7a2.8 2.8 0 0 0-4-4l-7 7-1 5 5-1z M3 21h6',
  // 3D 상자
  cube: 'M12 2l9 5v10l-9 5-9-5V7z M12 12l9-5 M12 12v10 M12 12L3 7',
  // 스마트 도해 — 위 하나, 아래 둘
  smart: 'M9 2h6v5H9z M2 15h6v5H2z M16 15h6v5h-6z M12 7v4 M5 15v-2h14v2',
  // 서명란 — 밑줄 위의 서명
  signature: 'M3 17c3-6 5 2 8-2s4 1 7-3 M3 21h18',
  // 도장 — 손잡이를 쥔 인장과 찍히는 자리
  stamp: 'M9 2h6v5l2 4H7l2-4z M4 15h16v3H4z M3 21h18',
  // 지우개 — 비스듬히 누운 몸통과 지워지는 줄
  eraser: 'M8.5 20H20 M15.5 4.5l4 4L10 18H6.5L4 15.5z M9.5 8.5l6 6',
}

export function Icon({ name, size = 16, className = '', strokeWidth = 2 }: IconProps) {
  const d = PATHS[name]
  if (!d) return null
  // path 분리 (M ... 으로 시작하는 부분 마다)
  const segments = d.split(/(?= M)/).map((s) => s.trim())
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={'jan-ico ' + className}
      aria-hidden="true"
    >
      {segments.map((s, i) => <path key={i} d={s} />)}
    </svg>
  )
}

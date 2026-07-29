/**
 * 앱·문서 아이콘(PNG) 을 그려 낸다.
 *
 * 왜 손으로 그리나: 윈도가 파일 형식 아이콘으로 쓰는 것은 PNG 다.
 * (SVG 는 브라우저 탭에서는 되지만 운영체제 파일 아이콘으로는 못 쓴다)
 * 그림 도구를 새로 들이지 않으려고, 사각형·삼각형만으로 그린 뒤 PNG 로 굽는다.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../public/icons')

const BRAND = [0xd9, 0x77, 0x57] // 앱 주황
const INK = [0x2b, 0x2b, 0x2b]
const PAPER = [0xff, 0xff, 0xff]
const LINE = [0xc8, 0xcf, 0xd8]

function canvas(size) {
  return { size, data: new Uint8Array(size * size * 4) }
}

function blend(c, x, y, [r, g, b], a = 1) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size || a <= 0) return
  const i = (y * c.size + x) * 4
  const src = Math.min(1, a)
  const dstA = c.data[i + 3] / 255
  const outA = src + dstA * (1 - src)
  for (let k = 0; k < 3; k++) {
    const dst = c.data[i + k]
    c.data[i + k] = Math.round(([r, g, b][k] * src + dst * dstA * (1 - src)) / (outA || 1))
  }
  c.data[i + 3] = Math.round(outA * 255)
}

/** 모서리가 둥근 네모 — 가장자리는 부드럽게(안티에일리어싱) 채운다 */
function roundRect(c, x0, y0, w, h, r, color, alpha = 1) {
  for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) {
      const cx = Math.min(Math.max(x + 0.5, x0 + r), x0 + w - r)
      const cy = Math.min(Math.max(y + 0.5, y0 + r), y0 + h - r)
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const cover = d <= r - 0.5 ? 1 : d >= r + 0.5 ? 0 : r + 0.5 - d
      if (cover > 0) blend(c, x, y, color, alpha * cover)
    }
  }
}

/** 오른쪽 위 접힌 모서리 */
function fold(c, x1, y1, size, color) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x + y <= size) blend(c, Math.round(x1 - size + x), Math.round(y1 + y), color, 1)
    }
  }
}

/** 굵기 있는 선분 (letters 를 그리는 데 쓴다) */
function line(c, x1, y1, x2, y2, w, color) {
  const minX = Math.floor(Math.min(x1, x2) - w), maxX = Math.ceil(Math.max(x1, x2) + w)
  const minY = Math.floor(Math.min(y1, y2) - w), maxY = Math.ceil(Math.max(y1, y2) + w)
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy || 1
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5 - x1, py = y + 0.5 - y1
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2))
      const d = Math.hypot(px - dx * t, py - dy * t)
      const cover = d <= w / 2 - 0.5 ? 1 : d >= w / 2 + 0.5 ? 0 : w / 2 + 0.5 - d
      if (cover > 0) blend(c, x, y, color, cover)
    }
  }
}

/** 형식 이름 "JAN" — 글꼴을 들이지 않고 획으로 그린다 */
function janWord(c, cx, cy, h, color) {
  const w = h * 0.62          // 글자 폭
  const gap = h * 0.30
  const stroke = Math.max(1.2, h * 0.17)
  const left = cx - (w * 3 + gap * 2) / 2
  const top = cy - h / 2, bot = cy + h / 2
  // J
  let x = left
  line(c, x + w * 0.78, top, x + w * 0.78, bot - w * 0.28, stroke, color)
  line(c, x + w * 0.78, bot - w * 0.28, x + w * 0.52, bot, stroke, color)
  line(c, x + w * 0.52, bot, x + w * 0.20, bot, stroke, color)
  line(c, x + w * 0.20, bot, x + w * 0.02, bot - w * 0.26, stroke, color)
  // A
  x = left + w + gap
  line(c, x, bot, x + w / 2, top, stroke, color)
  line(c, x + w / 2, top, x + w, bot, stroke, color)
  line(c, x + w * 0.22, cy + h * 0.16, x + w * 0.78, cy + h * 0.16, stroke, color)
  // N
  x = left + (w + gap) * 2
  line(c, x, bot, x, top, stroke, color)
  line(c, x, top, x + w, bot, stroke, color)
  line(c, x + w, bot, x + w, top, stroke, color)
}

function png(c) {
  const { size, data } = c
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // 필터 없음
    Buffer.from(data.subarray(y * size * 4, (y + 1) * size * 4)).copy(raw, y * (size * 4 + 1) + 1)
  }
  const chunks = []
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length)
    const head = Buffer.concat([Buffer.from(type, 'ascii'), body])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(head) >>> 0)
    chunks.push(len, head, crc)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  chunk('IHDR', ihdr)
  chunk('IDAT', deflateSync(raw, { level: 9 }))
  chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks])
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return c ^ -1
}

/** 앱 아이콘 — 주황 판에 흰 종이 */
function appIcon(size, maskable) {
  const c = canvas(size)
  const u = size / 32
  roundRect(c, 0, 0, size, size, maskable ? size / 2 : 6 * u, BRAND)
  const pad = maskable ? 9 * u : 7 * u
  const pw = size - pad * 2
  const ph = pw * 1.24
  const py = (size - ph) / 2
  roundRect(c, pad, py, pw, ph, 1.6 * u, PAPER)
  fold(c, pad + pw, py, 5 * u, [0xf1, 0xd9, 0xcd])
  for (let i = 0; i < 4; i++) {
    const y = py + ph * 0.30 + i * ph * 0.15
    const w = i === 3 ? pw * 0.42 : pw * 0.62
    roundRect(c, pad + pw * 0.19, y, w, 1.5 * u, 0.75 * u, i === 0 ? BRAND : LINE)
  }
  return png(c)
}

/** 문서 아이콘 (.jan) — 흰 종이에 주황 띠, 오른쪽 아래에 형식 이름 자리 */
function fileIcon(size) {
  const c = canvas(size)
  const u = size / 32
  const pw = size * 0.74
  const ph = size * 0.90
  const px = (size - pw) / 2
  const py = (size - ph) / 2
  roundRect(c, px, py, pw, ph, 2 * u, [0xd8, 0xdd, 0xe4])          // 종이 테두리
  roundRect(c, px + 0.6 * u, py + 0.6 * u, pw - 1.2 * u, ph - 1.2 * u, 1.6 * u, PAPER)
  fold(c, px + pw - 0.6 * u, py + 0.6 * u, 7 * u, [0xe7, 0xec, 0xf2]) // 접힌 모서리
  for (let i = 0; i < 4; i++) {                                    // 본문 줄 (띠 위까지만)
    const y = py + ph * 0.31 + i * ph * 0.095
    const w = i === 3 ? pw * 0.36 : pw * 0.56
    roundRect(c, px + pw * 0.16, y, w, 1.2 * u, 0.6 * u, LINE)
  }
  roundRect(c, px + pw * 0.16, py + ph * 0.18, pw * 0.44, 2 * u, u, INK, 0.85) // 제목 줄
  const bandY = py + ph * 0.70
  roundRect(c, px, bandY, pw, ph * 0.30, 2 * u, BRAND)             // 형식 띠
  janWord(c, px + pw / 2, bandY + ph * 0.15, ph * 0.15, PAPER)     // 띠 안에 JAN
  return png(c)
}

mkdirSync(OUT, { recursive: true })
writeFileSync(resolve(OUT, 'app-192.png'), appIcon(192, false))
writeFileSync(resolve(OUT, 'app-512.png'), appIcon(512, false))
writeFileSync(resolve(OUT, 'app-maskable-512.png'), appIcon(512, true))
writeFileSync(resolve(OUT, 'jan-file-256.png'), fileIcon(256))
writeFileSync(resolve(OUT, 'jan-file-64.png'), fileIcon(64))
console.log('아이콘 5개를 public/icons 에 그렸다')

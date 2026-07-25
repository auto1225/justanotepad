/**
 * Phase 5+ — HWPX 내보내기 (표 + 이미지 추가).
 *
 * HWPX = ZIP 컨테이너 + OWPML XML (KS X 6101).
 * Hancom Office, Polaris Office, 한컴독스 호환.
 *
 * 지원 요소:
 *   - <p>, <h1>~<h6>, <li>, <blockquote> → <hp:p> 단락
 *   - <table> → <hp:tbl> + <hp:tr> + <hp:tc>
 *   - <img> → <hp:pic> (data URL 만 inline 처리)
 */
import JSZip from 'jszip'
import { resolveBlobRefsInHtml } from './blobRefs'

const VERSION_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" targetApplication="WORDPROCESSOR" major="5" minor="0" micro="3" buildNumber="0" os="windows" application="JustANotepad" appVersion="2.0.0"/>`

const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <odf:file-entry odf:full-path="/" odf:media-type="application/hwp+zip"/>
  <odf:file-entry odf:full-path="version.xml" odf:media-type="application/xml"/>
  <odf:file-entry odf:full-path="Contents/header.xml" odf:media-type="application/xml"/>
  <odf:file-entry odf:full-path="Contents/section0.xml" odf:media-type="application/xml"/>
</odf:manifest>`

const HEADER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" version="1.31">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces>
      <hh:fontface lang="HANGUL"><hh:font id="0" type="TTF" name="맑은 고딕"/></hh:fontface>
    </hh:fontfaces>
    <hh:charProperties>
      <hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
      </hh:charPr>
      <hh:charPr id="1" height="1200" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
      </hh:charPr>
    </hh:charProperties>
    <hh:paraProperties>
      <hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="JUSTIFY" vertical="BASELINE"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
        <hh:margin>
          <hc:intent xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" value="0"/>
          <hc:left xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" value="0"/>
          <hc:right xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" value="0"/>
          <hc:prev xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" value="0"/>
          <hc:next xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" value="0"/>
        </hh:margin>
        <hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>
        <hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
      </hh:paraPr>
    </hh:paraProperties>
  </hh:refList>
</hh:head>`

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface ImageRef {
  binItemId: number
  href: string
  ext: string
  data?: ArrayBuffer
}

interface BuildContext {
  paraId: number
  picId: number
  tblId: number
  binItemId: number
  images: ImageRef[]
  body: string[]
}

function newPara(text: string, charPrId = 0): string {
  return `
    <hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
      <hp:run charPrIDRef="${charPrId}">
        <hp:t>${escXml(text)}</hp:t>
      </hp:run>
      <hp:linesegarray>
        <hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/>
      </hp:linesegarray>
    </hp:p>`
}

function emptyPara(): string {
  return `
    <hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
      <hp:run charPrIDRef="0"/>
      <hp:linesegarray>
        <hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/>
      </hp:linesegarray>
    </hp:p>`
}

function tableXml(ctx: BuildContext, table: HTMLTableElement): string {
  const rows = Array.from(table.rows)
  if (rows.length === 0) return ''
  const cols = Math.max(...rows.map((r) => r.cells.length))
  ctx.tblId++
  const tblId = ctx.tblId
  const cellsXml = rows
    .map((row, ri) => {
      const cellArr = Array.from(row.cells)
      const trCells = cellArr
        .map((cell, ci) => {
          const txt = (cell.textContent || '').trim()
          const isHeader = cell.tagName.toLowerCase() === 'th'
          const cellPara = newPara(txt, isHeader ? 1 : 0)
          return `<hp:tc name="" header="${isHeader ? '1' : '0'}" hasMargin="0" protect="0" editable="1" dirty="0" borderFillIDRef="2">
            <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" padding="0" textChar="0" hasTextRef="0" hasNumRef="0">${cellPara}</hp:subList>
            <hp:cellAddr colAddr="${ci}" rowAddr="${ri}"/>
            <hp:cellSpan colSpan="1" rowSpan="1"/>
            <hp:cellSz width="${Math.floor(40000 / cols)}" height="2000"/>
            <hp:cellMargin left="0" right="0" top="0" bottom="0"/>
          </hp:tc>`
        })
        .join('')
      return `<hp:tr>${trCells}</hp:tr>`
    })
    .join('')

  return `
    <hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
      <hp:run charPrIDRef="0">
        <hp:tbl id="${tblId}" zOrder="${tblId}" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rows.length}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="2" noAdjust="0">
          <hp:sz width="42520" widthRelTo="ABSOLUTE" height="${rows.length * 2000}" heightRelTo="ABSOLUTE" protect="0"/>
          <hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
          <hp:outMargin left="283" right="283" top="283" bottom="283"/>
          <hp:inMargin left="510" right="510" top="141" bottom="141"/>
          ${cellsXml}
        </hp:tbl>
      </hp:run>
      <hp:linesegarray>
        <hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/>
      </hp:linesegarray>
    </hp:p>`
}

async function imageXml(ctx: BuildContext, img: HTMLImageElement): Promise<string> {
  const src = img.src
  if (!src) return emptyPara()
  ctx.picId++
  ctx.binItemId++
  const binItemId = ctx.binItemId
  let ext = 'png'
  let data: ArrayBuffer | undefined
  try {
    if (src.startsWith('data:')) {
      const m = src.match(/^data:image\/(\w+);base64,(.+)$/)
      if (m) {
        ext = m[1] === 'jpeg' ? 'jpg' : m[1]
        const bin = atob(m[2])
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        data = arr.buffer
      }
    } else {
      const r = await fetch(src)
      if (r.ok) {
        data = await r.arrayBuffer()
        const m = r.headers.get('content-type')?.match(/image\/(\w+)/)
        if (m) ext = m[1] === 'jpeg' ? 'jpg' : m[1]
      }
    }
  } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }

  if (!data) return emptyPara()
  ctx.images.push({ binItemId, href: `BIN${binItemId.toString().padStart(4, '0')}.${ext}`, ext, data })

  const w = Math.min(img.naturalWidth || 400, 600) * 100 // HWPUNIT = 1/7200 inch ≈ 100 per px
  const h = Math.min(img.naturalHeight || 300, 450) * 100

  return `
    <hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
      <hp:run charPrIDRef="0">
        <hp:pic id="${ctx.picId}" zOrder="${ctx.picId}" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" reverse="0" instid="0">
          <hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${h}" heightRelTo="ABSOLUTE" protect="0"/>
          <hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
          <hp:outMargin left="0" right="0" top="0" bottom="0"/>
          <hp:img binaryItemIDRef="${binItemId}" alpha="0" bright="0" contrast="0" effect="REAL_PIC"/>
          <hp:imgRect>
            <hc:pt0 xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" x="0" y="0"/>
            <hc:pt1 xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" x="${w}" y="0"/>
            <hc:pt2 xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" x="${w}" y="${h}"/>
            <hc:pt3 xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" x="0" y="${h}"/>
          </hp:imgRect>
          <hp:imgClip left="0" right="0" top="0" bottom="0"/>
          <hp:inMargin left="0" right="0" top="0" bottom="0"/>
        </hp:pic>
      </hp:run>
      <hp:linesegarray>
        <hp:lineseg textpos="0" vertpos="0" vertsize="${h}" textheight="${h}" baseline="${Math.floor(h * 0.85)}" spacing="600" horzpos="0" horzsize="42520" flags="393216"/>
      </hp:linesegarray>
    </hp:p>`
}

async function walkChildren(ctx: BuildContext, root: Element) {
  for (const node of Array.from(root.children)) {
    const tag = node.tagName.toLowerCase()
    if (tag === 'table') {
      ctx.body.push(tableXml(ctx, node as HTMLTableElement))
    } else if (tag === 'img') {
      ctx.body.push(await imageXml(ctx, node as HTMLImageElement))
    } else if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'].includes(tag)) {
      // 안에 img 가 있으면 분리 처리
      const img = node.querySelector('img')
      if (img) {
        const t = (node.textContent || '').trim()
        if (t) ctx.body.push(newPara(t))
        ctx.body.push(await imageXml(ctx, img as HTMLImageElement))
      } else {
        const text = (node.textContent || '').trim()
        if (text) {
          const isHeading = /^h[1-6]$/.test(tag)
          ctx.body.push(newPara(text, isHeading ? 1 : 0))
        }
      }
    } else if (['ul', 'ol', 'div'].includes(tag)) {
      await walkChildren(ctx, node)
    } else {
      // unknown — text fallback
      const t = (node.textContent || '').trim()
      if (t) ctx.body.push(newPara(t))
    }
  }
}

function buildSectionXml(body: string[]): string {
  const inner = body.length > 0 ? body.join('') : emptyPara()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">
  ${inner}
</hs:sec>`
}

/** TipTap HTML → HWPX(.hwpx) Blob. 표/이미지 포함. */
export async function exportHwpx(html: string): Promise<Blob> {
  const div = document.createElement('div')
  div.innerHTML = html

  const ctx: BuildContext = {
    paraId: 0,
    picId: 0,
    tblId: 0,
    binItemId: 0,
    images: [],
    body: [],
  }
  await walkChildren(ctx, div)

  const zip = new JSZip()
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' })
  zip.file('version.xml', VERSION_XML)
  zip.folder('META-INF')!.file('manifest.xml', MANIFEST_XML)
  const c = zip.folder('Contents')!
  c.file('header.xml', HEADER_XML)
  c.file('section0.xml', buildSectionXml(ctx.body))

  // BinData 디렉터리 (이미지)
  if (ctx.images.length > 0) {
    const binDir = zip.folder('BinData')!
    for (const img of ctx.images) {
      if (img.data) binDir.file(img.href, img.data)
    }
  }

  return zip.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' })
}

/** 다운로드 헬퍼. */
export async function downloadHwpx(html: string, filename: string) {
  // 큰 이미지는 jan-blob:// 참조로 외부화돼 있다 — 해석하지 않으면 내보내기에서 이미지가 사라진다
  html = await resolveBlobRefsInHtml(html)
  const blob = await exportHwpx(html)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.replace(/\.[^/.]+$/, '') + '.hwpx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

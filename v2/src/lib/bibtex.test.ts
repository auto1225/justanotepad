import { describe, expect, it } from 'vitest'
import { parseBibtex, bibEntryToCitation, citationsToBibtex, parseBibAuthors } from './bibtex'
import { formatBibEntry, formatInline, type Citation } from './citationFormat'
import { htmlToLatex } from './latexExport'

const SAMPLE_BIB = `
@article{vaswani2017,
  author = {Ashish Vaswani and Noam Shazeer and Niki Parmar},
  title = {Attention Is All You Need},
  journal = {NeurIPS},
  year = {2017},
  pages = {5998--6008}
}

@book{knuth1997,
  author = {Knuth, Donald E.},
  title = {The Art of Computer Programming},
  publisher = {Addison-Wesley},
  year = 1997
}
`

describe('bibtex', () => {
  it('parses multiple entries with braces, quotes, and bare numbers', () => {
    const entries = parseBibtex(SAMPLE_BIB)
    expect(entries).toHaveLength(2)
    expect(entries[0].type).toBe('article')
    expect(entries[0].key).toBe('vaswani2017')
    expect(entries[0].fields.title).toBe('Attention Is All You Need')
    expect(entries[1].fields.year).toBe('1997')
  })

  it('converts "Last, First" and "First Last" author forms', () => {
    expect(parseBibAuthors('Knuth, Donald E.')).toEqual(['Donald E. Knuth'])
    expect(parseBibAuthors('Ada Lovelace and Alan Turing')).toEqual(['Ada Lovelace', 'Alan Turing'])
  })

  it('maps entries to citations (pages -- normalized, booktitle for proceedings)', () => {
    const c = bibEntryToCitation(parseBibtex(SAMPLE_BIB)[0])
    expect(c.authors[0]).toBe('Ashish Vaswani')
    expect(c.pages).toBe('5998-6008')
    expect(c.venue).toBe('NeurIPS')
  })

  it('round-trips citations back to BibTeX', () => {
    const cites = parseBibtex(SAMPLE_BIB).map(bibEntryToCitation)
    const bib = citationsToBibtex(cites)
    expect(bib).toContain('@article{vaswani2017')
    expect(bib).toContain('pages = {5998--6008}')
    expect(bib).toContain('@book{')
  })
})

describe('citation styles (global)', () => {
  const c: Citation = { id: 'x', authors: ['Yann LeCun', 'Yoshua Bengio', 'Geoffrey Hinton'], title: 'Deep learning', year: '2015', venue: 'Nature', volume: '521', issue: '7553', pages: '436-444' }

  it('formats Chicago author-date', () => {
    const s = formatBibEntry(c, 'chicago')
    expect(s).toContain('and Geoffrey Hinton')
    expect(s).toContain('(2015)')
  })
  it('formats Harvard with inverted names', () => {
    const s = formatBibEntry(c, 'harvard')
    expect(s).toContain('LeCun, Y.')
    expect(s).toContain("(2015) 'Deep learning'")
  })
  it('formats Vancouver numbered with compact names', () => {
    const s = formatBibEntry(c, 'vancouver', 0)
    expect(s.startsWith('1. LeCun Y')).toBe(true)
    expect(s).toContain(';521(7553):436-444')
  })
  it('inline: vancouver numeric, chicago author-year', () => {
    expect(formatInline(c, 'vancouver', 4)).toBe('[5]')
    expect(formatInline(c, 'chicago', 0)).toBe('(LeCun 2015)')
  })
})

describe('latex export', () => {
  it('converts headings, marks, equations, captions, and refs', () => {
    const html =
      '<h1>Intro</h1>' +
      '<p><strong>bold</strong> and <em>it</em> with 5% &amp; $2</p>' +
      '<p data-paper-block="eq" data-paper-key="eqA"><span data-math="inline" latex="E=mc^2"></span><span data-paper-tag="eqnum" data-key="eqA" data-n="1"></span></p>' +
      '<p data-paper-block="figcap" data-paper-key="figB"><span data-paper-tag="figlabel" data-key="figB" data-n="1"></span> System diagram</p>' +
      '<p>See <span data-paper-tag="ref" data-ref-type="eq" data-key="eqA" data-n="1"></span> and <span data-paper-tag="ref" data-ref-type="fig" data-key="figB" data-n="1"></span></p>' +
      '<ul><li>one</li><li>two</li></ul>'
    const tex = htmlToLatex(html, 'My Paper')
    expect(tex).toContain('\\section{Intro}')
    expect(tex).toContain('\\textbf{bold}')
    expect(tex).toContain('5\\% \\& \\$2')
    expect(tex).toContain('\\begin{equation}\nE=mc^2\n\\label{eq:eqA}')
    expect(tex).toContain('\\caption{System diagram}')
    expect(tex).toContain('\\label{fig:figB}')
    expect(tex).toContain('\\eqref{eq:eqA}')
    expect(tex).toContain('Fig.~\\ref{fig:figB}')
    expect(tex).toContain('\\begin{itemize}')
    expect(tex).toContain('\\title{My Paper}')
  })
})

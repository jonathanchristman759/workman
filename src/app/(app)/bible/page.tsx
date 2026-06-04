import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useLanguage } from '@/hooks/useLanguage'

interface BibleVerse {
  id:          string
  translation: string
  book:        string
  book_number: number
  chapter:     number
  verse:       number
  text:        string
}

const OT_BOOKS_EN = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
]

const NT_BOOKS_EN = [
  'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians',
  'Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians',
  '1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
  '1 John','2 John','3 John','Jude','Revelation',
]

const OT_BOOKS_ES = [
  'Génesis','Éxodo','Levítico','Números','Deuteronomio','Josué','Jueces','Rut',
  '1 Samuel','2 Samuel','1 Reyes','2 Reyes','1 Crónicas','2 Crónicas','Esdras',
  'Nehemías','Ester','Job','Salmos','Proverbios','Eclesiastés','Cantares',
  'Isaías','Jeremías','Lamentaciones','Ezequiel','Daniel','Oseas','Joel','Amós',
  'Abdías','Jonás','Miqueas','Nahúm','Habacuc','Sofonías','Hageo','Zacarías','Malaquías',
]

const NT_BOOKS_ES = [
  'Mateo','Marcos','Lucas','Juan','Hechos','Romanos','1 Corintios','2 Corintios',
  'Gálatas','Efesios','Filipenses','Colosenses','1 Tesalonicenses','2 Tesalonicenses',
  '1 Timoteo','2 Timoteo','Tito','Filemón','Hebreos','Santiago','1 Pedro','2 Pedro',
  '1 Juan','2 Juan','3 Juan','Judas','Apocalipsis',
]

const ES_TO_EN: Record<string, string> = {
  'Génesis':'Genesis','Éxodo':'Exodus','Levítico':'Leviticus','Números':'Numbers',
  'Deuteronomio':'Deuteronomy','Josué':'Joshua','Jueces':'Judges','Rut':'Ruth',
  '1 Reyes':'1 Kings','2 Reyes':'2 Kings','1 Crónicas':'1 Chronicles','2 Crónicas':'2 Chronicles',
  'Esdras':'Ezra','Nehemías':'Nehemiah','Ester':'Esther','Salmos':'Psalms',
  'Proverbios':'Proverbs','Eclesiastés':'Ecclesiastes','Cantares':'Song of Solomon',
  'Isaías':'Isaiah','Jeremías':'Jeremiah','Lamentaciones':'Lamentations',
  'Ezequiel':'Ezekiel','Daniel':'Daniel','Oseas':'Hosea','Joel':'Joel','Amós':'Amos',
  'Abdías':'Obadiah','Jonás':'Jonah','Miqueas':'Micah','Nahúm':'Nahum',
  'Habacuc':'Habakkuk','Sofonías':'Zephaniah','Hageo':'Haggai','Zacarías':'Zechariah',
  'Malaquías':'Malachi','Mateo':'Matthew','Marcos':'Mark','Lucas':'Luke','Juan':'John',
  'Hechos':'Acts','Romanos':'Romans','1 Corintios':'1 Corinthians','2 Corintios':'2 Corinthians',
  'Gálatas':'Galatians','Efesios':'Ephesians','Filipenses':'Philippians',
  'Colosenses':'Colossians','1 Tesalonicenses':'1 Thessalonians','2 Tesalonicenses':'2 Thessalonians',
  '1 Timoteo':'1 Timothy','2 Timoteo':'2 Timothy','Tito':'Titus','Filemón':'Philemon',
  'Hebreos':'Hebrews','Santiago':'James','1 Pedro':'1 Peter','2 Pedro':'2 Peter',
  '1 Juan':'1 John','2 Juan':'2 John','3 Juan':'3 John','Judas':'Jude',
  'Apocalipsis':'Revelation',
}

const FONT_SIZES = [14, 16, 18, 20]

const BOOK_ALIASES: Record<string, string> = {
  'gen':'Genesis','ex':'Exodus','exo':'Exodus','lev':'Leviticus','num':'Numbers',
  'deut':'Deuteronomy','deu':'Deuteronomy','josh':'Joshua','jos':'Joshua',
  'judg':'Judges','jdg':'Judges','ruth':'Ruth','rut':'Ruth',
  '1sam':'1 Samuel','2sam':'2 Samuel','1ki':'1 Kings','2ki':'2 Kings',
  '1kgs':'1 Kings','2kgs':'2 Kings','1chr':'1 Chronicles','2chr':'2 Chronicles',
  '1chron':'1 Chronicles','2chron':'2 Chronicles','ezra':'Ezra','neh':'Nehemiah',
  'est':'Esther','esth':'Esther','job':'Job','ps':'Psalms','psa':'Psalms',
  'pss':'Psalms','prov':'Proverbs','pro':'Proverbs','eccl':'Ecclesiastes',
  'ecc':'Ecclesiastes','song':'Song of Solomon','sos':'Song of Solomon',
  'isa':'Isaiah','jer':'Jeremiah','lam':'Lamentations','ezek':'Ezekiel',
  'eze':'Ezekiel','dan':'Daniel','hos':'Hosea','joel':'Joel','amos':'Amos',
  'obad':'Obadiah','jonah':'Jonah','jon':'Jonah','mic':'Micah','nah':'Nahum',
  'hab':'Habakkuk','zeph':'Zephaniah','zep':'Zephaniah','hag':'Haggai',
  'zech':'Zechariah','zec':'Zechariah','mal':'Malachi','matt':'Matthew',
  'mat':'Matthew','mark':'Mark','mrk':'Mark','luke':'Luke','luk':'Luke',
  'john':'John','jn':'John','acts':'Acts','act':'Acts','rom':'Romans',
  '1cor':'1 Corinthians','2cor':'2 Corinthians','gal':'Galatians',
  'eph':'Ephesians','phil':'Philippians','php':'Philippians','col':'Colossians',
  '1thess':'1 Thessalonians','2thess':'2 Thessalonians','1thes':'1 Thessalonians',
  '2thes':'2 Thessalonians','1tim':'1 Timothy','2tim':'2 Timothy','tit':'Titus',
  'titus':'Titus','phlm':'Philemon','philem':'Philemon','heb':'Hebrews',
  'jas':'James','jam':'James','1pet':'1 Peter','2pet':'2 Peter','1pe':'1 Peter',
  '2pe':'2 Peter','1jn':'1 John','2jn':'2 John','3jn':'3 John','jude':'Jude',
  'rev':'Revelation','apoc':'Revelation',
}

function parseJumpQuery(query: string): { book: string; chapter: number; verse?: number } | null {
  const q = query.trim()
  if (!q) return null

  // Match: optional number + book name + chapter + optional verse
  // Handles: "John 3:16", "1 Cor 13:4", "Ps 23", "1Cor 13"
  const match = q.match(/^(\d\s)?([a-zA-Z]+\.?)\s+(\d+)(?::(\d+))?$/)
  if (!match) return null

  const prefix  = match[1] ? match[1].trim() : ''
  const bookRaw = (prefix + match[2]).toLowerCase().replace(/\s+/g, '').replace(/\./g, '')
  const chapter = parseInt(match[3])
  const verse   = match[4] ? parseInt(match[4]) : undefined

  let book = BOOK_ALIASES[bookRaw]

  if (!book) {
    const allBooks = [
      'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
      '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
      'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
      'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
      'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah',
      'Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
      '2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
      '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
      'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
    ]
    book = allBooks.find(b => b.toLowerCase().replace(/\s+/g, '').startsWith(bookRaw)) ?? ''
  }

  if (!book || !chapter) return null
  return { book, chapter, verse }
}

interface HistoryEntry { book: string; chapter: number }

export default function BiblePage() {
  const { language } = useLanguage()
  const navigate     = useNavigate()

  const otBooks = language === 'ES' ? OT_BOOKS_ES : OT_BOOKS_EN
  const ntBooks = language === 'ES' ? NT_BOOKS_ES : NT_BOOKS_EN

  const [translation,     setTranslation]     = useState<'KJV' | 'RVR60'>('KJV')
  const [selectedBook,    setSelectedBook]     = useState(localStorage.getItem('bible_book') ?? 'Genesis')
const [selectedChapter, setSelectedChapter]  = useState(parseInt(localStorage.getItem('bible_chapter') ?? '1'))
  const [chapterCount,    setChapterCount]     = useState(50)
  const [verses,          setVerses]           = useState<BibleVerse[]>([])
  const [loading,         setLoading]          = useState(false)
  const [highlighted,     setHighlighted]      = useState<Set<number>>(new Set())
  const [showBookPanel,   setShowBookPanel]    = useState(true)
  const savedSettings = (() => { try { return JSON.parse(localStorage.getItem('bible_settings') ?? '{}') } catch { return {} } })()
const [fontSize,      setFontSize]      = useState<number>(savedSettings.fontSize ?? 16)
const [showVerseNums, setShowVerseNums] = useState<boolean>(savedSettings.showVerseNums ?? true)
const [viewMode,      setViewMode]      = useState<'paragraph' | 'line'>(savedSettings.viewMode ?? 'paragraph')
  const [fullscreen,      setFullscreen]       = useState(false)
  const [showSettings,    setShowSettings]     = useState(false)
  const [history,         setHistory]          = useState<HistoryEntry[]>([])
  const [historyIndex,    setHistoryIndex]     = useState(-1)
  const isNavigatingHistory = useRef(false)
  const verseListRef = useRef<HTMLDivElement>(null)
  const [jumpQuery, setJumpQuery] = useState('')
  const pendingChapter = useRef<number | null>(null)
const pendingVerse   = useRef<number | null>(null)
const [contextMenu, setContextMenu] = useState<{
  x: number; y: number; verse: BibleVerse
} | null>(null)

useEffect(() => {
  function handleClick() { setContextMenu(null) }
  document.addEventListener('click', handleClick)
  return () => document.removeEventListener('click', handleClick)
}, [])

function handleContextMenu(e: React.MouseEvent, verse: BibleVerse) {
  e.preventDefault()
  setContextMenu({ x: e.clientX, y: e.clientY, verse })
}

function toSuperscript(n: number): string {
  const map: Record<string, string> = {
    '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'
  }
  return String(n).split('').map(d => map[d] ?? d).join('')
}

async function handleCopyVerse(verse: BibleVerse) {
  if (highlighted.size > 1 && highlighted.has(verse.verse)) {
    const sorted = verses.filter(v => highlighted.has(v.verse))
    const ref = `${sorted[0].book} ${sorted[0].chapter}:${sorted[0].verse}-${sorted[sorted.length-1].verse}`
    const text = ref + ' — "' + sorted.map(v => `${toSuperscript(v.verse)}${v.text}`).join(' ') + '"'
    await navigator.clipboard.writeText(text)
  } else {
    await navigator.clipboard.writeText(`${verse.book} ${verse.chapter}:${verse.verse} — "${verse.text}"`)
  }
  setContextMenu(null)
}

async function handleCopyRef(verse: BibleVerse) {
  if (highlighted.size > 1 && highlighted.has(verse.verse)) {
    const nums = verses
      .filter(v => highlighted.has(v.verse))
      .map(v => v.verse)
    const first = nums[0]
    const last  = nums[nums.length - 1]
    await navigator.clipboard.writeText(`${verse.book} ${verse.chapter}:${first}-${last}`)
  } else {
    await navigator.clipboard.writeText(`${verse.book} ${verse.chapter}:${verse.verse}`)
  }
  setContextMenu(null)
}

function handleLookUpLexicon(verse: BibleVerse) {
  navigate(`/lexicon?book=${encodeURIComponent(verse.book)}&chapter=${verse.chapter}`)
  setContextMenu(null)
}

function handleStartSermonFromVerse(verse: BibleVerse) {
  navigate(`/sermons/new?passage=${encodeURIComponent(`${verse.book} ${verse.chapter}:${verse.verse}`)}`)
  setContextMenu(null)
}

  // Persist settings
  useEffect(() => {
  localStorage.setItem('bible_book',    selectedBook)
  localStorage.setItem('bible_chapter', String(selectedChapter))
}, [selectedBook, selectedChapter])

  useEffect(() => {
    localStorage.setItem('bible_settings', JSON.stringify({ fontSize, showVerseNums, viewMode }))
  }, [fontSize, showVerseNums, viewMode])

  // Load chapter count when book changes
  useEffect(() => {
  async function loadChapterCount() {
    try {
      const count = await invoke<number>('get_chapter_count', {
        translation: 'KJV',
        book: selectedBook,
      })
      setChapterCount(count)
      if (pendingChapter.current !== null) {
  setSelectedChapter(pendingChapter.current)
  pendingChapter.current = null
} else if (!isNavigatingHistory.current && selectedBook !== (localStorage.getItem('bible_book') ?? 'Genesis')) {
  setSelectedChapter(1)
}
    } catch {}
  }
  loadChapterCount()
}, [selectedBook])

  // Load verses
  useEffect(() => {
  async function loadVerses() {
    setLoading(true)
    setHighlighted(new Set())
    try {
      const dbBookName = translation === 'RVR60'
        ? (Object.entries(ES_TO_EN).find(([, en]) => en === selectedBook)?.[0] ?? selectedBook)
        : selectedBook
      const data = await invoke<BibleVerse[]>('get_passage', {
        translation,
        book:    dbBookName,
        chapter: selectedChapter,
      })
      setVerses(data)
      verseListRef.current?.scrollTo({ top: 0 })
      if (pendingVerse.current !== null) {
        const verse = pendingVerse.current
        pendingVerse.current = null
        setTimeout(() => {
          const el = document.getElementById(`bible-verse-${verse}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    } catch {}
    finally { setLoading(false) }
  }
  loadVerses()
}, [selectedBook, selectedChapter, translation])

  // History tracking
  useEffect(() => {
    if (isNavigatingHistory.current) {
      isNavigatingHistory.current = false
      return
    }
    setHistory(prev => {
      const entry = { book: selectedBook, chapter: selectedChapter }
      const trimmed = prev.slice(0, historyIndex + 1)
      return [...trimmed, entry]
    })
    setHistoryIndex(prev => prev + 1)
  }, [selectedBook, selectedChapter])

  function navigateHistory(dir: 'back' | 'forward') {
    const newIndex = dir === 'back' ? historyIndex - 1 : historyIndex + 1
    if (newIndex < 0 || newIndex >= history.length) return
    isNavigatingHistory.current = true
    const entry = history[newIndex]
    setSelectedBook(entry.book)
    setSelectedChapter(entry.chapter)
    setHistoryIndex(newIndex)
  }

  function toggleHighlight(verse: number) {
    setHighlighted(prev => {
      const next = new Set(prev)
      next.has(verse) ? next.delete(verse) : next.add(verse)
      return next
    })
  }

  function handleBookSelect(bookName: string) {
    const dbBook = language === 'ES' ? (ES_TO_EN[bookName] ?? bookName) : bookName
    setSelectedBook(dbBook)
    setHighlighted(new Set())
  }

  function handleStartSermon() {
    const passage = `${selectedBook} ${selectedChapter}`
    navigate(`/sermons/new?passage=${encodeURIComponent(passage)}`)
  }

  function handleJump(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return
  const result = parseJumpQuery(jumpQuery)
  if (!result) return

  pendingChapter.current = result.chapter
  if (result.verse) pendingVerse.current = result.verse

  setSelectedBook(result.book)
  setSelectedChapter(result.chapter)
  setJumpQuery('')
  if (result.verse) {
    // Scroll to verse after load
    setTimeout(() => {
      const el = document.getElementById(`bible-verse-${result.verse}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 400)
  }
}

  const displayBook = language === 'ES'
    ? (Object.entries(ES_TO_EN).find(([, en]) => en === selectedBook)?.[0] ?? selectedBook)
    : selectedBook

  const canGoBack    = historyIndex > 0
  const canGoForward = historyIndex < history.length - 1

  return (
    <AppLayout>
      <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

        {/* ── BOOK PANEL ── */}
        {showBookPanel && !fullscreen && (
          <div style={{
            width: 220, minWidth: 220,
            borderRight: '1px solid var(--color-border-subtle)',
            overflowY: 'auto',
            background: 'var(--color-bg-secondary)',
            padding: '12px 0',
          }}>
            <p style={{
              fontSize: 10, fontWeight: 600, color: 'var(--color-text-hint)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '0 12px', margin: '0 0 6px',
            }}>
              {language === 'ES' ? 'Antiguo Testamento' : 'Old Testament'}
            </p>
            {otBooks.map(book => {
              const dbBook = language === 'ES' ? (ES_TO_EN[book] ?? book) : book
              return (
                <button key={book} onClick={() => handleBookSelect(book)} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '5px 12px', border: 'none',
                  background: dbBook === selectedBook ? 'var(--color-accent-muted)' : 'transparent',
                  color: dbBook === selectedBook ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  fontWeight: dbBook === selectedBook ? 600 : 400,
                }}>
                  {book}
                </button>
              )
            })}
            <p style={{
              fontSize: 10, fontWeight: 600, color: 'var(--color-text-hint)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '8px 12px 6px', margin: 0,
            }}>
              {language === 'ES' ? 'Nuevo Testamento' : 'New Testament'}
            </p>
            {ntBooks.map(book => {
              const dbBook = language === 'ES' ? (ES_TO_EN[book] ?? book) : book
              return (
                <button key={book} onClick={() => handleBookSelect(book)} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '5px 12px', border: 'none',
                  background: dbBook === selectedBook ? 'var(--color-accent-muted)' : 'transparent',
                  color: dbBook === selectedBook ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  fontWeight: dbBook === selectedBook ? 600 : 400,
                }}>
                  {book}
                </button>
              )
            })}
          </div>
        )}

        {/* ── MAIN READING AREA ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ── TOOLBAR ── */}
          <div style={{
  display: 'flex', alignItems: 'center', gap: 8,
  padding: fullscreen ? '6px 24px' : '8px 16px',
  borderBottom: '1px solid var(--color-border-subtle)',
  background: 'var(--color-bg-primary)',
  flexWrap: 'wrap',
}}>

            {/* Book panel toggle */}
            {!fullscreen && (
              <button onClick={() => setShowBookPanel(p => !p)} style={{
                padding: '4px 8px', borderRadius: 6,
                border: '1px solid var(--color-border-default)',
                background: showBookPanel ? 'var(--color-accent-muted)' : 'var(--color-bg-secondary)',
                color: showBookPanel ? 'var(--color-accent)' : 'var(--color-text-muted)',
                cursor: 'pointer', fontSize: 14,
              }}>☰</button>
            )}

            {/* History back/forward */}
            <button onClick={() => navigateHistory('back')} disabled={!canGoBack} style={{
              padding: '4px 8px', borderRadius: 6,
              border: '1px solid var(--color-border-default)',
              background: 'var(--color-bg-secondary)',
              color: canGoBack ? 'var(--color-text-secondary)' : 'var(--color-text-hint)',
              cursor: canGoBack ? 'pointer' : 'not-allowed',
              opacity: canGoBack ? 1 : 0.4, fontSize: 13,
            }}>←</button>
            <button onClick={() => navigateHistory('forward')} disabled={!canGoForward} style={{
              padding: '4px 8px', borderRadius: 6,
              border: '1px solid var(--color-border-default)',
              background: 'var(--color-bg-secondary)',
              color: canGoForward ? 'var(--color-text-secondary)' : 'var(--color-text-hint)',
              cursor: canGoForward ? 'pointer' : 'not-allowed',
              opacity: canGoForward ? 1 : 0.4, fontSize: 13,
            }}>→</button>

            {/* Book + chapter */}
            <span style={{
              fontSize: 15, fontWeight: 600,
              fontFamily: 'var(--font-serif)',
              color: 'var(--color-text-primary)', minWidth: 120,
            }}>
              {displayBook} {selectedChapter}
            </span>

            {/* Chapter nav */}
            <button onClick={() => setSelectedChapter(c => Math.max(1, c - 1))}
              disabled={selectedChapter <= 1} style={{
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--color-border-default)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
              cursor: selectedChapter <= 1 ? 'not-allowed' : 'pointer',
              opacity: selectedChapter <= 1 ? 0.5 : 1, fontSize: 13,
            }}>←</button>
            <select value={selectedChapter}
              onChange={e => setSelectedChapter(parseInt(e.target.value))} style={{
              padding: '4px 8px', borderRadius: 6,
              border: '1px solid var(--color-border-default)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}>
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{language === 'ES' ? 'Cap.' : 'Ch.'} {n}</option>
              ))}
            </select>
            <button onClick={() => setSelectedChapter(c => Math.min(chapterCount, c + 1))}
              disabled={selectedChapter >= chapterCount} style={{
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--color-border-default)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
              cursor: selectedChapter >= chapterCount ? 'not-allowed' : 'pointer',
              opacity: selectedChapter >= chapterCount ? 0.5 : 1, fontSize: 13,
            }}>→</button>

            <input
  type="text"
  value={jumpQuery}
  onChange={e => setJumpQuery(e.target.value)}
  onKeyDown={handleJump}
  placeholder={language === 'ES' ? 'Ir a… (ej. Juan 3:16)' : 'Go to… (e.g. John 3:16)'}
  style={{
    padding: '4px 10px', borderRadius: 6,
    border: '1px solid var(--color-border-default)',
    background: 'var(--color-bg-secondary)',
    color: 'var(--color-text-primary)',
    fontSize: 12, fontFamily: 'var(--font-sans)',
    outline: 'none', width: 160,
  }}
/>

            {/* Translation toggle */}
            {!fullscreen && (
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border-default)' }}>
              {(['KJV', 'RVR60'] as const).map(t => (
                <button key={t} onClick={() => setTranslation(t)} style={{
                  padding: '4px 10px', border: 'none',
                  background: translation === t ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                  color: translation === t ? 'var(--color-accent-text)' : 'var(--color-text-muted)',
                  fontSize: 11, fontFamily: 'var(--font-sans)',
                  fontWeight: translation === t ? 600 : 400, cursor: 'pointer',
                }}>{t}</button>
              ))}
            </div>
  )}

            {/* Settings panel toggle */}
            <div style={{ position: 'relative', marginLeft: 4 }}>
              <button onClick={() => setShowSettings(p => !p)} style={{
                padding: '4px 8px', borderRadius: 6,
                border: `1px solid ${showSettings ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                background: showSettings ? 'var(--color-accent-muted)' : 'var(--color-bg-secondary)',
                color: showSettings ? 'var(--color-accent)' : 'var(--color-text-muted)',
                cursor: 'pointer', fontSize: 13,
              }} title={language === 'ES' ? 'Opciones de lectura' : 'Reading options'}>⚙</button>

              {showSettings && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 6,
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px', zIndex: 200, minWidth: 220,
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  {/* Font size */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {language === 'ES' ? 'Tamaño de fuente' : 'Font size'}
                    </p>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {FONT_SIZES.map(s => (
                        <button key={s} onClick={() => setFontSize(s)} style={{
                          padding: '3px 8px', borderRadius: 4, fontSize: 11,
                          border: `1px solid ${fontSize === s ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                          background: fontSize === s ? 'var(--color-accent-muted)' : 'transparent',
                          color: fontSize === s ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}>{s}px</button>
                      ))}
                    </div>
                  </div>

                  {/* Verse numbers */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {language === 'ES' ? 'Números de versículo' : 'Verse numbers'}
                    </p>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[true, false].map(v => (
                        <button key={String(v)} onClick={() => setShowVerseNums(v)} style={{
                          padding: '3px 10px', borderRadius: 4, fontSize: 11,
                          border: `1px solid ${showVerseNums === v ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                          background: showVerseNums === v ? 'var(--color-accent-muted)' : 'transparent',
                          color: showVerseNums === v ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}>
                          {v ? (language === 'ES' ? 'Mostrar' : 'Show') : (language === 'ES' ? 'Ocultar' : 'Hide')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* View mode */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {language === 'ES' ? 'Modo de vista' : 'View mode'}
                    </p>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['paragraph', 'line'] as const).map(m => (
                        <button key={m} onClick={() => setViewMode(m)} style={{
                          padding: '3px 10px', borderRadius: 4, fontSize: 11,
                          border: `1px solid ${viewMode === m ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                          background: viewMode === m ? 'var(--color-accent-muted)' : 'transparent',
                          color: viewMode === m ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}>
                          {m === 'paragraph'
                            ? (language === 'ES' ? 'Párrafo' : 'Paragraph')
                            : (language === 'ES' ? 'Por versículo' : 'Per verse')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen toggle */}
            <button onClick={() => { setFullscreen(p => !p); setShowBookPanel(false); setShowSettings(false) }} style={{
              padding: '4px 8px', borderRadius: 6,
              border: `1px solid ${fullscreen ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
              background: fullscreen ? 'var(--color-accent-muted)' : 'var(--color-bg-secondary)',
              color: fullscreen ? 'var(--color-accent)' : 'var(--color-text-muted)',
              cursor: 'pointer', fontSize: 13,
            }} title={language === 'ES' ? 'Pantalla completa' : 'Full screen'}>
              {fullscreen ? '⊠' : '⊡'}
            </button>

            {/* Start sermon */}
            {highlighted.size > 0 ? (
              <button onClick={handleStartSermon} style={{
                marginLeft: 'auto', padding: '5px 12px', borderRadius: 6,
                border: '1px solid var(--color-accent)',
                background: 'var(--color-accent)', color: 'var(--color-accent-text)',
                fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 500, cursor: 'pointer',
              }}>
                {highlighted.size} {language === 'ES' ? 'versículos · + Nuevo sermón' : 'verses · + Start sermon'}
              </button>
            ) : (
              <button onClick={handleStartSermon} style={{
                marginLeft: 'auto', padding: '5px 12px', borderRadius: 6,
                border: '1px solid var(--color-border-default)',
                background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
                fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}>
                {language === 'ES' ? '+ Nuevo sermón desde aquí' : '+ Start sermon from here'}
              </button>
            )}
          </div>

          {/* ── VERSE LIST ── */}
          <div ref={verseListRef} style={{
  flex: 1, overflowY: 'auto',
  padding: fullscreen ? '48px 120px' : '24px 40px',
  maxWidth: fullscreen ? 900 : 720,
  width: '100%', margin: '0 auto',
}}>
            {loading ? (
              <p style={{ color: 'var(--color-text-hint)', fontSize: 13 }}>
                {language === 'ES' ? 'Cargando…' : 'Loading…'}
              </p>
            ) : verses.length === 0 ? (
              <p style={{ color: 'var(--color-text-hint)', fontSize: 13 }}>
                {language === 'ES' ? 'No se encontraron versículos.' : 'No verses found.'}
              </p>
            ) : viewMode === 'paragraph' ? (
              <div style={{ fontFamily: 'var(--font-serif)', lineHeight: 1.9 }}>
                {verses.map(v => (
                  <span key={v.id} id={`bible-verse-${v.verse}`} onClick={() => toggleHighlight(v.verse)} onContextMenu={(e) => handleContextMenu(e, v)} style={{
                    cursor: 'pointer',
                    background: highlighted.has(v.verse) ? 'var(--color-accent-muted)' : 'transparent',
                    borderRadius: 3, padding: '1px 2px', transition: 'background 0.15s',
                  }}>
                    {showVerseNums && (
                      <sup style={{
                        fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
                        marginRight: 3, verticalAlign: 'super', fontFamily: 'var(--font-sans)',
                      }}>{v.verse}</sup>
                    )}
                    <span style={{ fontSize, color: 'var(--color-text-primary)' }}>
                      {v.text}{' '}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-serif)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {verses.map(v => (
                  <div key={v.id} id={`bible-verse-${v.verse}`} onClick={() => toggleHighlight(v.verse)} onContextMenu={(e) => handleContextMenu(e, v)} style={{
                    cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '4px 6px', borderRadius: 4,
                    background: highlighted.has(v.verse) ? 'var(--color-accent-muted)' : 'transparent',
                    transition: 'background 0.15s',
                  }}>
                    {showVerseNums && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
                        minWidth: 24, paddingTop: 4, fontFamily: 'var(--font-sans)',
                        textAlign: 'right',
                      }}>{v.verse}</span>
                    )}
                    <span style={{ fontSize, color: 'var(--color-text-primary)', lineHeight: 1.7 }}>
                      {v.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {contextMenu && (
  <div style={{
    position: 'fixed',
    top:      contextMenu.y,
    left:     contextMenu.x,
    zIndex:   1000,
    background:   'var(--color-bg-primary)',
    border:       '1px solid var(--color-border-default)',
    borderRadius: 'var(--radius-md)',
    boxShadow:    '0 4px 16px rgba(0,0,0,0.12)',
    padding:      '4px',
    minWidth:     200,
  }}>
    {[
      {
        label: language === 'ES' ? 'Copiar versículo' : 'Copy verse',
        icon: '📋',
        onClick: () => handleCopyVerse(contextMenu.verse),
      },
      {
        label: language === 'ES' ? 'Copiar referencia' : 'Copy reference',
        icon: '🔗',
        onClick: () => handleCopyRef(contextMenu.verse),
      },
      {
        label: highlighted.has(contextMenu.verse.verse)
          ? (language === 'ES' ? 'Quitar resaltado' : 'Remove highlight')
          : (language === 'ES' ? 'Resaltar versículo' : 'Highlight verse'),
        icon: '🖊',
        onClick: () => { toggleHighlight(contextMenu.verse.verse); setContextMenu(null) },
      },
      {
        label: language === 'ES' ? 'Ver en léxico' : 'Look up in Lexicon',
        icon: '📖',
        onClick: () => handleLookUpLexicon(contextMenu.verse),
      },
      {
        label: language === 'ES' ? '+ Nuevo sermón desde aquí' : '+ Start sermon from here',
        icon: '✍',
        onClick: () => handleStartSermonFromVerse(contextMenu.verse),
      },
    ].map((item) => (
      <button
        key={item.label}
        onClick={item.onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '7px 10px',
          background: 'transparent',
          border: 'none', borderRadius: 4,
          color: 'var(--color-text-primary)',
          fontSize: 12, fontFamily: 'var(--font-sans)',
          cursor: 'pointer', textAlign: 'left',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ fontSize: 13 }}>{item.icon}</span>
        {item.label}
      </button>
    ))}
  </div>
)}
      </div>
    </AppLayout>
  )
}
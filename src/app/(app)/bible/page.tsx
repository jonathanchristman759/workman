import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useLanguage } from '@/hooks/useLanguage'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface BibleVerse {
  id:          string
  translation: string
  book:        string
  book_number: number
  chapter:     number
  verse:       number
  text:        string
}

// ─────────────────────────────────────────────
// BOOK LISTS
// ─────────────────────────────────────────────

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

// Map Spanish book names to English for DB queries
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

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function BiblePage() {
  const { language }   = useLanguage()
  const navigate       = useNavigate()

  const otBooks = language === 'ES' ? OT_BOOKS_ES : OT_BOOKS_EN
  const ntBooks = language === 'ES' ? NT_BOOKS_ES : NT_BOOKS_EN

  const [translation,    setTranslation]    = useState<'KJV' | 'RVR60'>('KJV')
  const [selectedBook,   setSelectedBook]   = useState('Genesis')
  const [selectedChapter, setSelectedChapter] = useState(1)
  const [chapterCount,   setChapterCount]   = useState(50)
  const [verses,         setVerses]         = useState<BibleVerse[]>([])
  const [loading,        setLoading]        = useState(false)
  const [highlighted,    setHighlighted]    = useState<Set<number>>(new Set())
  const [showBookPanel,  setShowBookPanel]  = useState(true)
  const verseListRef = useRef<HTMLDivElement>(null)

  // Load chapter count when book changes
  useEffect(() => {
    async function loadChapterCount() {
      try {
        const count = await invoke<number>('get_chapter_count', {
          translation: 'KJV',
          book:        selectedBook,
        })
        setChapterCount(count)
        setSelectedChapter(1)
      } catch (err) {
        console.error('Failed to get chapter count:', err)
      }
    }
    loadChapterCount()
  }, [selectedBook])

  // Load verses when book, chapter, or translation changes
  useEffect(() => {
    async function loadVerses() {
      setLoading(true)
      setHighlighted(new Set())
      try {
        // RVR60 uses Spanish book names in the DB
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
      } catch (err) {
        console.error('Failed to load verses:', err)
      } finally {
        setLoading(false)
      }
    }
    loadVerses()
  }, [selectedBook, selectedChapter, translation])

  function toggleHighlight(verse: number) {
    setHighlighted(prev => {
      const next = new Set(prev)
      if (next.has(verse)) next.delete(verse)
      else next.add(verse)
      return next
    })
  }

  function handleBookSelect(bookName: string) {
    // Convert ES name to EN for DB query
    const dbBook = language === 'ES' ? (ES_TO_EN[bookName] ?? bookName) : bookName
    setSelectedBook(dbBook)
    setHighlighted(new Set())
  }

  function handleStartSermon() {
    const passage = `${selectedBook} ${selectedChapter}`
    navigate(`/sermons/new?passage=${encodeURIComponent(passage)}`)
  }

  const displayBook = language === 'ES'
    ? (Object.entries(ES_TO_EN).find(([, en]) => en === selectedBook)?.[0] ?? selectedBook)
    : selectedBook

  return (
    <AppLayout>
      <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

        {/* ── BOOK PANEL ── */}
        {showBookPanel && (
          <div style={{
            width:      220,
            minWidth:   220,
            borderRight: '1px solid var(--color-border-subtle)',
            overflowY:  'auto',
            background: 'var(--color-bg-secondary)',
            padding:    '12px 0',
          }}>
            {/* OT */}
            <p style={{
              fontSize:   10,
              fontWeight: 600,
              color:      'var(--color-text-hint)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding:    '0 12px',
              margin:     '0 0 6px',
            }}>
              {language === 'ES' ? 'Antiguo Testamento' : 'Old Testament'}
            </p>
            {otBooks.map(book => {
              const dbBook = language === 'ES' ? (ES_TO_EN[book] ?? book) : book
              return (
                <button
                  key={book}
                  onClick={() => handleBookSelect(book)}
                  style={{
                    display:    'block',
                    width:      '100%',
                    textAlign:  'left',
                    padding:    '5px 12px',
                    border:     'none',
                    background: dbBook === selectedBook ? 'var(--color-accent-muted)' : 'transparent',
                    color:      dbBook === selectedBook ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    fontSize:   12,
                    fontFamily: 'var(--font-sans)',
                    cursor:     'pointer',
                    fontWeight: dbBook === selectedBook ? 600 : 400,
                  }}
                >
                  {book}
                </button>
              )
            })}

            {/* NT */}
            <p style={{
              fontSize:   10,
              fontWeight: 600,
              color:      'var(--color-text-hint)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding:    '8px 12px 6px',
              margin:     0,
            }}>
              {language === 'ES' ? 'Nuevo Testamento' : 'New Testament'}
            </p>
            {ntBooks.map(book => {
              const dbBook = language === 'ES' ? (ES_TO_EN[book] ?? book) : book
              return (
                <button
                  key={book}
                  onClick={() => handleBookSelect(book)}
                  style={{
                    display:    'block',
                    width:      '100%',
                    textAlign:  'left',
                    padding:    '5px 12px',
                    border:     'none',
                    background: dbBook === selectedBook ? 'var(--color-accent-muted)' : 'transparent',
                    color:      dbBook === selectedBook ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    fontSize:   12,
                    fontFamily: 'var(--font-sans)',
                    cursor:     'pointer',
                    fontWeight: dbBook === selectedBook ? 600 : 400,
                  }}
                >
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
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '10px 20px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background:   'var(--color-bg-primary)',
            flexWrap:     'wrap',
          }}>
            {/* Toggle book panel */}
            <button
              onClick={() => setShowBookPanel(p => !p)}
              title={language === 'ES' ? 'Mostrar/ocultar libros' : 'Toggle book list'}
              style={{
                padding:    '5px 8px',
                borderRadius: 6,
                border:     '1px solid var(--color-border-default)',
                background: showBookPanel ? 'var(--color-accent-muted)' : 'var(--color-bg-secondary)',
                color:      showBookPanel ? 'var(--color-accent)' : 'var(--color-text-muted)',
                cursor:     'pointer',
                fontSize:   14,
              }}
            >
              ☰
            </button>

            {/* Book + chapter display */}
            <span style={{
              fontSize:   15,
              fontWeight: 600,
              fontFamily: 'var(--font-serif)',
              color:      'var(--color-text-primary)',
              minWidth:   120,
            }}>
              {displayBook} {selectedChapter}
            </span>

            {/* Chapter nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => setSelectedChapter(c => Math.max(1, c - 1))}
                disabled={selectedChapter <= 1}
                style={{
                  padding:    '4px 10px',
                  borderRadius: 6,
                  border:     '1px solid var(--color-border-default)',
                  background: 'var(--color-bg-secondary)',
                  color:      'var(--color-text-secondary)',
                  cursor:     selectedChapter <= 1 ? 'not-allowed' : 'pointer',
                  opacity:    selectedChapter <= 1 ? 0.5 : 1,
                  fontSize:   13,
                }}
              >←</button>

              <select
                value={selectedChapter}
                onChange={e => setSelectedChapter(parseInt(e.target.value))}
                style={{
                  padding:    '4px 8px',
                  borderRadius: 6,
                  border:     '1px solid var(--color-border-default)',
                  background: 'var(--color-bg-secondary)',
                  color:      'var(--color-text-primary)',
                  fontSize:   12,
                  fontFamily: 'var(--font-sans)',
                  cursor:     'pointer',
                }}
              >
                {Array.from({ length: chapterCount }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>
                    {language === 'ES' ? 'Cap.' : 'Ch.'} {n}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setSelectedChapter(c => Math.min(chapterCount, c + 1))}
                disabled={selectedChapter >= chapterCount}
                style={{
                  padding:    '4px 10px',
                  borderRadius: 6,
                  border:     '1px solid var(--color-border-default)',
                  background: 'var(--color-bg-secondary)',
                  color:      'var(--color-text-secondary)',
                  cursor:     selectedChapter >= chapterCount ? 'not-allowed' : 'pointer',
                  opacity:    selectedChapter >= chapterCount ? 0.5 : 1,
                  fontSize:   13,
                }}
              >→</button>
            </div>

            {/* Translation toggle */}
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border-default)' }}>
              {(['KJV', 'RVR60'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTranslation(t)}
                  style={{
                    padding:    '4px 10px',
                    border:     'none',
                    background: translation === t ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                    color:      translation === t ? 'var(--color-accent-text)' : 'var(--color-text-muted)',
                    fontSize:   11,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: translation === t ? 600 : 400,
                    cursor:     'pointer',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Highlighted count + start sermon */}
            {highlighted.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {highlighted.size} {language === 'ES' ? 'versículos seleccionados' : 'verses selected'}
                </span>
                <button
                  onClick={handleStartSermon}
                  style={{
                    padding:    '5px 12px',
                    borderRadius: 6,
                    border:     '1px solid var(--color-accent)',
                    background: 'var(--color-accent)',
                    color:      'var(--color-accent-text)',
                    fontSize:   12,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    cursor:     'pointer',
                  }}
                >
                  {language === 'ES' ? '+ Nuevo sermón desde aquí' : '+ Start sermon from here'}
                </button>
              </div>
            )}

            {/* Start sermon button (no selection) */}
            {highlighted.size === 0 && (
              <button
                onClick={handleStartSermon}
                style={{
                  marginLeft:  'auto',
                  padding:     '5px 12px',
                  borderRadius: 6,
                  border:      '1px solid var(--color-border-default)',
                  background:  'var(--color-bg-secondary)',
                  color:       'var(--color-text-secondary)',
                  fontSize:    12,
                  fontFamily:  'var(--font-sans)',
                  cursor:      'pointer',
                }}
              >
                {language === 'ES' ? '+ Nuevo sermón desde aquí' : '+ Start sermon from here'}
              </button>
            )}
          </div>

          {/* ── VERSE LIST ── */}
          <div
            ref={verseListRef}
            style={{
              flex:      1,
              overflowY: 'auto',
              padding:   '24px 40px',
              maxWidth:  720,
              width:     '100%',
              margin:    '0 auto',
            }}
          >
            {loading ? (
              <p style={{ color: 'var(--color-text-hint)', fontSize: 13 }}>
                {language === 'ES' ? 'Cargando…' : 'Loading…'}
              </p>
            ) : verses.length === 0 ? (
              <p style={{ color: 'var(--color-text-hint)', fontSize: 13 }}>
                {language === 'ES' ? 'No se encontraron versículos.' : 'No verses found.'}
              </p>
            ) : (
              <div style={{ fontFamily: 'var(--font-serif)', lineHeight: 1.9 }}>
                {verses.map(v => (
                  <span
                    key={v.id}
                    onClick={() => toggleHighlight(v.verse)}
                    style={{
                      cursor:       'pointer',
                      background:   highlighted.has(v.verse) ? 'var(--color-accent-muted)' : 'transparent',
                      borderRadius: 3,
                      padding:      '1px 2px',
                      transition:   'background 0.15s',
                    }}
                  >
                    <sup style={{
                      fontSize:    10,
                      fontWeight:  600,
                      color:       'var(--color-accent)',
                      marginRight: 3,
                      verticalAlign: 'super',
                      fontFamily:  'var(--font-sans)',
                    }}>
                      {v.verse}
                    </sup>
                    <span style={{
                      fontSize: 16,
                      color:    'var(--color-text-primary)',
                    }}>
                      {v.text}{' '}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </AppLayout>
  )
}

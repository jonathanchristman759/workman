// Workman — lexicon/page.tsx
// apps/web/src/app/(app)/lexicon/page.tsx
// Full lexicon workspace — interlinear view, word detail, bookmarks



import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useLanguage } from '@/hooks/useLanguage'
import { invoke } from '@tauri-apps/api/core'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface LexiconWord {
  strongsNumber:   string
  language:        'HEBREW' | 'ARAMAIC' | 'GREEK'
  originalWord:    string
  transliteration: string
  pronunciation?:  string | null
  partOfSpeech?:   string | null
  glosses:         string[]
  definition?:     string | null
  ntOtCount?:      number | null
  occurrences:     Occurrence[]
}

interface Occurrence {
  id:           string
  book:         string
  chapter:      number
  verse:        number
  kjvRendering: string
  parsing?:     string | null
}

interface BibleVerse {
  book:    string
  chapter: number
  verse:   number
  text:    string
}

interface InterlinearWord {
  kjvRendering:    string
  parsing?:        string | null
  strongsNumber:   string
  language:        string
  originalWord:    string
  transliteration: string
  glosses:         string[]
  partOfSpeech?:   string | null
}

interface PassageData {
  verses:      BibleVerse[]
  interlinear: Record<number, InterlinearWord[]>
}

interface Bookmark {
  id:            string
  strongsNumber: string
  originalWord:  string
  language:      string
  passageRef?:   string | null
  note?:         string | null
  savedAt:       string
}

// ─────────────────────────────────────────────
// LANGUAGE BADGE
// ─────────────────────────────────────────────

function LangBadge({ lang }: { lang: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    GREEK:   { bg: 'var(--color-interactive-muted)', text: 'var(--color-interactive)'  },
    HEBREW:  { bg: 'var(--color-accent-muted)',      text: 'var(--color-accent-text)'  },
    ARAMAIC: { bg: 'var(--color-success-muted)',     text: 'var(--color-success)'      },
  }
  const c = colors[lang] ?? colors.GREEK
  return (
    <span style={{
      fontSize:     10,
      padding:      '2px 7px',
      borderRadius: 'var(--radius-full)',
      background:   c.bg,
      color:        c.text,
      fontWeight:   500,
    }}>
      {lang.charAt(0) + lang.slice(1).toLowerCase()}
    </span>
  )
}

// ─────────────────────────────────────────────
// WORD UNIT — single interlinear word cell
// ─────────────────────────────────────────────

function WordUnit({
  word, isSelected, onClick,
}: {
  word:       InterlinearWord
  isSelected: boolean
  onClick:    () => void
}) {
  return (
    <div
      onClick={onClick}
      title={`${word.strongsNumber} — ${word.glosses[0] ?? ''}`}
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        padding:       '5px 7px',
        borderRadius:  'var(--radius-md)',
        border:        `1px solid ${isSelected ? 'var(--color-accent)' : 'transparent'}`,
        background:    isSelected ? 'var(--color-accent-muted)' : 'transparent',
        cursor:        'pointer',
        transition:    'background 100ms, border-color 100ms',
        minWidth:      40,
      }}
    >
      <span style={{
        fontFamily: 'var(--font-serif)',
        fontSize:   16,
        color:      isSelected ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
        lineHeight: 1.3,
      }}>
        {word.originalWord}
      </span>
      <span style={{ fontSize: 9, color: 'var(--color-text-hint)', marginTop: 1 }}>
        {word.transliteration}
      </span>
      <span style={{ fontSize: 10, color: 'var(--color-interactive)', marginTop: 1 }}>
        {word.kjvRendering}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────
// WORD DETAIL PANEL
// ─────────────────────────────────────────────

function WordDetailPanel({
  word, bookmark, language, passageRef, onBookmarkSaved,
}: {
  word:            LexiconWord
  bookmark?:       { id: string; note?: string | null } | null
  language:        string
  passageRef:      string
  onBookmarkSaved: () => void
}) {
  const [tab,      setTab]      = useState<'parsing' | 'glosses' | 'occurrences'>('parsing')
  const [note,     setNote]     = useState(bookmark?.note ?? '')
  const [saving,   setSaving]   = useState(false)
  const [bookmarked, setBookmarked] = useState(!!bookmark)

  async function handleSaveBookmark() {
    setSaving(true)
    try {
      await invoke('save_bookmark', { input: {
        strongsNumber:   word.strongsNumber,
        originalWord:    word.originalWord,
        transliteration: word.transliteration,
        language:        word.language,
        passageRef,
        note: note || undefined,
      }})
      setBookmarked(true)
      onBookmarkSaved()
    } catch (err) {
      console.error('Bookmark save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveBookmark() {
    try {
      await invoke('delete_bookmark', { strongsNumber: word.strongsNumber })
      setBookmarked(false)
      onBookmarkSaved()
    } catch (err) {
      console.error('Bookmark remove failed:', err)
    }
  }

  const parseRows = [
    { label: language === 'ES' ? 'Parte del discurso' : 'Part of speech', value: word.partOfSpeech },
    { label: language === 'ES' ? 'Transliteración'    : 'Transliteration', value: word.transliteration },
    { label: language === 'ES' ? 'Pronunciación'      : 'Pronunciation',   value: word.pronunciation },
    { label: language === 'ES' ? 'Número Strong\'s'   : 'Strong\'s number', value: word.strongsNumber },
    { label: language === 'ES' ? 'Apariciones'        : 'NT/OT count',      value: word.ntOtCount ? `${word.ntOtCount}×` : null },
  ].filter((r) => r.value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Word header */}
      <div style={{
        background:   'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding:      '12px 14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize:   22,
            margin:     '0 0 3px',
            color:      'var(--color-text-primary)',
          }}>
            {word.originalWord}
          </p>
          <LangBadge lang={word.language} />
        </div>
        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-interactive)', margin: '0 0 4px' }}>
          {word.transliteration} · {word.strongsNumber}
        </p>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>
          {word.glosses.slice(0, 3).join(', ')}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-subtle)' }}>
        {(['parsing', 'glosses', 'occurrences'] as const).map((t) => {
          const labels = {
            parsing:     language === 'ES' ? 'Análisis'    : 'Parsing',
            glosses:     language === 'ES' ? 'Significados': 'Glosses',
            occurrences: language === 'ES' ? 'Apariciones' : 'Occurrences',
          }
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex:         1,
                padding:      '7px 4px',
                fontSize:     10,
                fontWeight:   tab === t ? 500 : 400,
                color:        tab === t ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                background:   'transparent',
                border:       'none',
                borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
                cursor:       'pointer',
                fontFamily:   'var(--font-sans)',
              }}
            >
              {labels[t]}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'parsing' && (
          <div>
            {parseRows.map((row) => (
              <div key={row.label} style={{
                display:        'flex',
                justifyContent: 'space-between',
                padding:        '5px 0',
                borderBottom:   '1px solid var(--color-border-subtle)',
                fontSize:       12,
              }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{row.value}</span>
              </div>
            ))}
            {word.definition && (
              <p style={{
                fontSize:   11,
                color:      'var(--color-text-secondary)',
                lineHeight: 1.6,
                margin:     '10px 0 0',
                padding:    '10px',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}>
                {word.definition}
              </p>
            )}
          </div>
        )}

        {tab === 'glosses' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {word.glosses.map((g) => (
              <span key={g} className="workman-badge workman-badge-accent" style={{ fontSize: 11 }}>
                {g}
              </span>
            ))}
          </div>
        )}

        {tab === 'occurrences' && (
          <div>
            {word.occurrences.slice(0, 12).map((occ) => (
              <div key={occ.id} style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                padding:        '5px 8px',
                background:     'var(--color-bg-secondary)',
                borderRadius:   'var(--radius-md)',
                marginBottom:   4,
                fontSize:       11,
              }}>
                <span style={{ color: 'var(--color-interactive)', fontWeight: 500, minWidth: 80 }}>
                  {occ.book} {occ.chapter}:{occ.verse}
                </span>
                <span style={{ color: 'var(--color-text-secondary)', flex: 1, textAlign: 'right' }}>
                  {occ.kjvRendering}
                </span>
              </div>
            ))}
            {word.occurrences.length > 12 && (
              <p style={{ fontSize: 10, color: 'var(--color-text-hint)', textAlign: 'center', margin: '6px 0 0' }}>
                {language === 'ES'
                  ? `+${word.occurrences.length - 12} más`
                  : `+${word.occurrences.length - 12} more`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bookmark */}
      <div style={{
        background:   'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding:      '10px 12px',
      }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
          {bookmarked
            ? (language === 'ES' ? '★ Guardado en favoritos' : '★ Bookmarked')
            : (language === 'ES' ? 'Guardar en favoritos' : 'Save to bookmarks')}
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={language === 'ES' ? 'Añadir nota personal…' : 'Add a personal note…'}
          rows={2}
          style={{
            width:        '100%',
            padding:      '6px 8px',
            borderRadius: 'var(--radius-md)',
            border:       '1px solid var(--color-border-default)',
            background:   'var(--color-bg-primary)',
            color:        'var(--color-text-primary)',
            fontSize:     11,
            fontFamily:   'var(--font-sans)',
            resize:       'none',
            outline:      'none',
            marginBottom: 6,
            boxSizing:    'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleSaveBookmark}
            disabled={saving}
            style={{
              flex:         1,
              padding:      '5px',
              borderRadius: 'var(--radius-md)',
              border:       '1px solid var(--color-accent)',
              background:   'var(--color-accent)',
              color:        'var(--color-accent-text)',
              fontSize:     11,
              fontFamily:   'var(--font-sans)',
              cursor:       'pointer',
              fontWeight:   500,
            }}
          >
            {saving
              ? (language === 'ES' ? 'Guardando…' : 'Saving…')
              : (language === 'ES' ? 'Guardar'    : 'Save')}
          </button>
          {bookmarked && (
            <button
              onClick={handleRemoveBookmark}
              className="workman-btn"
              style={{ fontSize: 11, padding: '5px 10px' }}
            >
              {language === 'ES' ? 'Eliminar' : 'Remove'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN LEXICON PAGE
// ─────────────────────────────────────────────

export default function LexiconPage() {
  const [searchParams] = useSearchParams()
  const { language }        = useLanguage()
  const [searchQuery, setSearchQuery]     = useState('')
  const [langFilter,  setLangFilter]      = useState<'GREEK' | 'HEBREW' | 'ARAMAIC' | ''>('')
  const [passage,     setPassage]         = useState({
    book:    searchParams.get('book')    ?? 'John',
    chapter: searchParams.get('chapter') ?? '10',
    translation: language === 'ES' ? 'RVR60' : 'KJV',
  })
  const [passageData,     setPassageData]     = useState<PassageData | null>(null)
  const [selectedWord,    setSelectedWord]    = useState<InterlinearWord | null>(null)
  const [wordDetail,      setWordDetail]      = useState<LexiconWord | null>(null)
  const [wordBookmark,    setWordBookmark]    = useState<{ id: string; note?: string | null } | null>(null)
  const [bookmarks,       setBookmarks]       = useState<Bookmark[]>([])
  const [searchResults,   setSearchResults]   = useState<LexiconWord[]>([])
  const [loadingPassage,  setLoadingPassage]  = useState(false)
  const [loadingWord,     setLoadingWord]     = useState(false)
  const [view,            setView]            = useState<'interlinear' | 'bookmarks'>('interlinear')

  // ── LOAD PASSAGE ──────────────────────────

  const loadPassage = useCallback(async () => {
    setLoadingPassage(true)
    setSelectedWord(null)
    setWordDetail(null)
    try {
      const data = await invoke<PassageData>('get_passage_interlinear', {
  book: passage.book,
  chapter: parseInt(passage.chapter),
  translation: passage.translation,
})
setPassageData({ verses: [], interlinear: data })
    } catch (err) {
      console.error('Passage load failed:', err)
    } finally {
      setLoadingPassage(false)
    }
  }, [passage])

  useEffect(() => { loadPassage() }, [loadPassage])

  // ── LOAD BOOKMARKS ─────────────────────────

  const loadBookmarks = useCallback(async () => {
    try {
      const data = await invoke<Bookmark[]>('get_bookmarks')
setBookmarks(data)
    } catch {}
  }, [])

  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  // ── WORD CLICK ────────────────────────────

  async function handleWordClick(word: InterlinearWord) {
    setSelectedWord(word)
    setLoadingWord(true)
    try {
      const data = await invoke<LexiconWord>('get_word', {
  strongsNumber: word.strongsNumber
})
setWordDetail(data)
setWordBookmark(null)
    } catch (err) {
      console.error('Word detail load failed:', err)
    } finally {
      setLoadingWord(false)
    }
  }

  // ── SEARCH ────────────────────────────────

  async function handleSearch() {
    if (searchQuery.trim().length < 2) return
    try {
      const params = new URLSearchParams({ q: searchQuery })
      if (langFilter) params.set('lang', langFilter)
      const data = await invoke<LexiconWord[]>('search_words', {
  query: searchQuery,
  language: langFilter || undefined,
})
setSearchResults(data)
    } catch {}
  }

  const passageRef = `${passage.book} ${passage.chapter}`

  return (
    <AppLayout>
      <div style={{
        background:   'var(--color-bg-primary)',
        border:       '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow:     'hidden',
      }}>

        {/* ── TOP BAR ── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '10px 16px',
          borderBottom:   '1px solid var(--color-border-subtle)',
          flexWrap:       'wrap',
          gap:            10,
        }}>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
            {language === 'ES' ? 'Léxico' : 'Lexicon'}
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Passage selector */}
            <select
              value={passage.book}
              onChange={(e) => setPassage((p) => ({ ...p, book: e.target.value }))}
              style={selectStyle}
            >
              {(language === 'ES'
                ? ['Génesis','Éxodo','Salmos','Proverbios','Isaías','Mateo','Marcos','Lucas','Juan','Hechos','Romanos','Apocalipsis']
                : ['Genesis','Exodus','Psalms','Proverbs','Isaiah','Matthew','Mark','Luke','John','Acts','Romans','Revelation']
              ).map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <input
              type="number"
              value={passage.chapter}
              onChange={(e) => setPassage((p) => ({ ...p, chapter: e.target.value }))}
              min={1}
              style={{ ...selectStyle, width: 56 }}
            />

            <div style={{ width: 1, height: 20, background: 'var(--color-border-default)' }} />

            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={language === 'ES' ? 'Buscar palabra…' : 'Search word…'}
              style={{ ...selectStyle, width: 160 }}
            />
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value as typeof langFilter)}
              style={selectStyle}
            >
              <option value="">{language === 'ES' ? 'Todo' : 'All'}</option>
              <option value="GREEK">Greek</option>
              <option value="HEBREW">Hebrew</option>
              <option value="ARAMAIC">Aramaic</option>
            </select>
            <button onClick={handleSearch} className="workman-btn" style={{ fontSize: 11, padding: '5px 12px' }}>
              {language === 'ES' ? 'Buscar' : 'Search'}
            </button>

            {/* View toggle */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['interlinear', 'bookmarks'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    fontSize:     11,
                    padding:      '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    border:       '1px solid var(--color-border-default)',
                    background:   view === v ? 'var(--color-bg-secondary)' : 'transparent',
                    color:        view === v ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    fontWeight:   view === v ? 500 : 400,
                    cursor:       'pointer',
                    fontFamily:   'var(--font-sans)',
                  }}
                >
                  {v === 'interlinear'
                    ? (language === 'ES' ? 'Interlineal' : 'Interlinear')
                    : (language === 'ES' ? 'Favoritos'   : 'Bookmarks')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 270px',
          minHeight:           560,
        }}>

          {/* ── MAIN PANEL ── */}
          <div style={{
            padding:     '16px 20px',
            borderRight: '1px solid var(--color-border-subtle)',
            overflowY:   'auto',
          }}>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {language === 'ES' ? `${searchResults.length} resultados` : `${searchResults.length} results`}
                </p>
                {searchResults.map((w) => (
                  <div
                    key={w.strongsNumber}
                    onClick={() => handleWordClick(w as unknown as InterlinearWord)}
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      gap:            12,
                      padding:        '8px 12px',
                      background:     'var(--color-bg-secondary)',
                      borderRadius:   'var(--radius-md)',
                      marginBottom:   5,
                      cursor:         'pointer',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--color-text-primary)', minWidth: 50 }}>
                      {w.originalWord}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-interactive)', margin: 0 }}>
                        {w.transliteration} · {w.strongsNumber}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                        {w.glosses.slice(0, 2).join(', ')}
                      </p>
                    </div>
                    <LangBadge lang={w.language} />
                  </div>
                ))}
                <button
                  onClick={() => setSearchResults([])}
                  className="workman-btn"
                  style={{ fontSize: 11, marginTop: 4 }}
                >
                  {language === 'ES' ? '← Volver al interlineal' : '← Back to interlinear'}
                </button>
              </div>
            )}

            {/* Interlinear view */}
            {view === 'interlinear' && searchResults.length === 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
                  {passageRef} — {language === 'ES' ? 'vista interlineal' : 'interlinear view'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
                  {language === 'ES'
                    ? 'Haz clic en cualquier palabra para ver su detalle en el original.'
                    : 'Click any word to see its original language detail.'}
                </p>

                {loadingPassage ? (
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {language === 'ES' ? 'Cargando pasaje…' : 'Loading passage…'}
                  </p>
                ) : passageData ? (
                  passageData.verses.map((v) => (
                    <div key={`${v.chapter}-${v.verse}`} style={{ marginBottom: 20 }}>
                      <p style={{
                        fontSize:      11,
                        fontWeight:    500,
                        color:         'var(--color-interactive)',
                        margin:        '0 0 6px',
                        letterSpacing: '0.04em',
                      }}>
                        {v.book} {v.chapter}:{v.verse}
                      </p>

                      {/* Interlinear word row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                        {(passageData.interlinear[v.verse] ?? []).map((word, i) => (
                          <WordUnit
                            key={`${word.strongsNumber}-${i}`}
                            word={word}
                            isSelected={selectedWord?.strongsNumber === word.strongsNumber}
                            onClick={() => handleWordClick(word)}
                          />
                        ))}
                      </div>

                      {/* KJV text */}
                      <p style={{
                        fontFamily:  'var(--font-serif)',
                        fontStyle:   'italic',
                        fontSize:    13,
                        color:       'var(--color-text-secondary)',
                        margin:      0,
                        paddingLeft: 4,
                        lineHeight:  1.7,
                      }}>
                        "{v.text}"
                      </p>
                    </div>
                  ))
                ) : null}
              </div>
            )}

            {/* Bookmarks view */}
            {view === 'bookmarks' && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
                  {language === 'ES' ? 'Palabras guardadas' : 'Saved words'}
                </p>
                {bookmarks.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {language === 'ES'
                      ? 'Aún no tienes palabras guardadas. Haz clic en una palabra y guárdala.'
                      : "No bookmarks yet. Click a word and save it to build your personal reference."}
                  </p>
                ) : (
                  bookmarks.map((b) => (
                    <div key={b.id} style={{
                      padding:      '10px 12px',
                      background:   'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 6,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--color-text-primary)' }}>
                            {b.originalWord}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--color-interactive)', marginLeft: 8 }}>
                            {b.strongsNumber}
                          </span>
                        </div>
                        <LangBadge lang={b.language} />
                      </div>
                      {b.passageRef && (
                        <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
                          {b.passageRef}
                        </p>
                      )}
                      {b.note && (
                        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '4px 0 0', fontStyle: 'italic' }}>
                          "{b.note}"
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── WORD DETAIL SIDE PANEL ── */}
          <div style={{ padding: '14px', overflowY: 'auto' }}>
            {loadingWord ? (
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {language === 'ES' ? 'Cargando…' : 'Loading…'}
              </p>
            ) : wordDetail ? (
              <WordDetailPanel
                word={wordDetail}
                bookmark={wordBookmark}
                language={language}
                passageRef={passageRef}
                onBookmarkSaved={loadBookmarks}
              />
            ) : (
              <div style={{ textAlign: 'center', paddingTop: 40 }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-hint)', lineHeight: 1.6 }}>
                  {language === 'ES'
                    ? 'Haz clic en cualquier palabra en el interlineal para ver su análisis completo.'
                    : 'Click any word in the interlinear view to see its full analysis.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

const selectStyle: React.CSSProperties = {
  padding:      '6px 10px',
  borderRadius: 'var(--radius-md)',
  border:       '1px solid var(--color-border-default)',
  background:   'var(--color-bg-primary)',
  color:        'var(--color-text-primary)',
  fontSize:     12,
  fontFamily:   'var(--font-sans)',
  outline:      'none',
}

// Workman — sermons/new/page.tsx
// apps/web/src/app/(app)/sermons/new/page.tsx
// Form to create a new sermon — passage, title, mode, delivery date



import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useLanguage } from '@/hooks/useLanguage'
import { invoke } from '@tauri-apps/api/core'

type EditorMode = 'OUTLINE' | 'MANUSCRIPT' | 'NOTES'

const BIBLE_BOOKS_EN = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges',
  'Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes',
  'Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
  'Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk',
  'Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John',
  'Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians',
  'Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy',
  '2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
  '1 John','2 John','3 John','Jude','Revelation',
]

const BIBLE_BOOKS_ES = [
  'Génesis','Éxodo','Levítico','Números','Deuteronomio','Josué','Jueces',
  'Rut','1 Samuel','2 Samuel','1 Reyes','2 Reyes','1 Crónicas','2 Crónicas',
  'Esdras','Nehemías','Ester','Job','Salmos','Proverbios','Eclesiastés',
  'Cantares','Isaías','Jeremías','Lamentaciones','Ezequiel','Daniel',
  'Oseas','Joel','Amós','Abdías','Jonás','Miqueas','Nahúm','Habacuc',
  'Sofonías','Hageo','Zacarías','Malaquías','Mateo','Marcos','Lucas','Juan',
  'Hechos','Romanos','1 Corintios','2 Corintios','Gálatas','Efesios',
  'Filipenses','Colosenses','1 Tesalonicenses','2 Tesalonicenses','1 Timoteo',
  '2 Timoteo','Tito','Filemón','Hebreos','Santiago','1 Pedro','2 Pedro',
  '1 Juan','2 Juan','3 Juan','Judas','Apocalipsis',
]

export default function NewSermonPage() {
  const router         = useNavigate()
  const { language }   = useLanguage()

  const [title,        setTitle]        = useState('')
  const [book,         setBook]         = useState('')
  const [chapter,      setChapter]      = useState('')
  const [verseStart,   setVerseStart]   = useState('')
  const [verseEnd,     setVerseEnd]     = useState('')
  const [mode,         setMode]         = useState<EditorMode>('OUTLINE')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [seriesName,   setSeriesName]   = useState('')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [repeatWarning,setRepeatWarning]= useState<string | null>(null)
  const [searchParams] = useSearchParams()

// Pre-fill from "Start sermon from here" button
useEffect(() => {
  const passage = searchParams.get('passage')
  if (passage) {
    // Parse "John 10" or "John 10:1" format
    const parts = passage.split(' ')
    // Handle multi-word book names like "1 Corinthians"
    const chapterPart = parts[parts.length - 1]
    const hasChapter = /^\d+/.test(chapterPart) && parts.length > 1
    if (hasChapter) {
      const bookName = parts.slice(0, -1).join(' ')
      const chapterVerse = chapterPart.split(':')
      setBook(bookName)
      setChapter(chapterVerse[0])
      if (chapterVerse[1]) setVerseStart(chapterVerse[1])
    } else {
      setBook(passage)
    }
  }
}, [searchParams])

  const books = language === 'ES' ? BIBLE_BOOKS_ES : BIBLE_BOOKS_EN

  function buildPassageRef(): string {
    if (!book) return ''
    let ref = book
    if (chapter) {
      ref += ` ${chapter}`
      if (verseStart) {
        ref += `:${verseStart}`
        if (verseEnd) ref += `–${verseEnd}`
      }
    }
    return ref
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setRepeatWarning(null)
    setLoading(true)

    const passageRef = buildPassageRef()
    if (!passageRef) {
      setError(language === 'ES' ? 'Selecciona un libro.' : 'Please select a book.')
      setLoading(false)
      return
    }

    try {
      const data = await invoke<{
  sermon: { id: string }
  repeatWarning: { message: string; lastTitle: string } | null
}>('create_sermon', {
  input: {
    title:         title || passageRef,
    passage_ref:   passageRef,
    book:          book || undefined,
    chapter_start: chapter ? parseInt(chapter) : undefined,
    mode,
    delivery_date: deliveryDate || undefined,
  }
})

      if (data.repeatWarning) {
        setRepeatWarning(
          language === 'ES'
            ? `Nota: predicaste ${data.repeatWarning.lastTitle} recientemente.`
            : `Note: you preached ${data.repeatWarning.lastTitle} recently.`
        )
        // Still navigate — just show the warning
      }

      router(`/sermons/${data.sermon.id}`)
    } catch (err) {
  console.error('Create sermon error:', err)
  setError(err instanceof Error ? err.message : String(err))
} finally {
      setLoading(false)
    }
  }

  const modeOptions: { value: EditorMode; label: string; desc: string }[] = [
    {
      value: 'OUTLINE',
      label: language === 'ES' ? 'Esquema' : 'Outline',
      desc:  language === 'ES'
        ? 'Puntos principales y subpuntos estructurados'
        : 'Structured main points and sub-points',
    },
    {
      value: 'MANUSCRIPT',
      label: language === 'ES' ? 'Manuscrito' : 'Manuscript',
      desc:  language === 'ES'
        ? 'Escribe el sermón completo palabra por palabra'
        : 'Write the full sermon word-for-word',
    },
    {
      value: 'NOTES',
      label: language === 'ES' ? 'Notas' : 'Notes',
      desc:  language === 'ES'
        ? 'Notas libres sin estructura'
        : 'Freeform notes with no structure',
    },
  ]

  return (
    <AppLayout>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 4px', color: 'var(--color-text-primary)' }}>
            {language === 'ES' ? 'Nuevo sermón' : 'New sermon'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            {language === 'ES'
              ? 'Elige tu pasaje y comienza a prepararte.'
              : 'Choose your passage and start preparing.'}
          </p>
        </div>

        <div className="workman-card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Passage */}
            <div>
              <label style={labelStyle}>
                {language === 'ES' ? 'Pasaje bíblico' : 'Scripture passage'}
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={book}
                  onChange={(e) => setBook(e.target.value)}
                  required
                  style={{ ...inputStyle, flex: 2, minWidth: 140 }}
                >
                  <option value="">{language === 'ES' ? 'Libro…' : 'Book…'}</option>
                  {books.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  placeholder={language === 'ES' ? 'Cap.' : 'Ch.'}
                  min={1}
                  style={{ ...inputStyle, width: 64 }}
                />
                <input
                  type="number"
                  value={verseStart}
                  onChange={(e) => setVerseStart(e.target.value)}
                  placeholder={language === 'ES' ? 'v.' : 'v.'}
                  min={1}
                  style={{ ...inputStyle, width: 60 }}
                />
                <span style={{ alignSelf: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>–</span>
                <input
                  type="number"
                  value={verseEnd}
                  onChange={(e) => setVerseEnd(e.target.value)}
                  placeholder={language === 'ES' ? 'fin' : 'end'}
                  min={1}
                  style={{ ...inputStyle, width: 60 }}
                />
              </div>
              {book && (
                <p style={{ fontSize: 11, color: 'var(--color-accent)', margin: '5px 0 0' }}>
                  {buildPassageRef()}
                </p>
              )}
            </div>

            {/* Title */}
            <div>
              <label style={labelStyle}>
                {language === 'ES' ? 'Título del sermón' : 'Sermon title'}{' '}
                <span style={{ color: 'var(--color-text-hint)', fontWeight: 400 }}>
                  ({language === 'ES' ? 'opcional' : 'optional'})
                </span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === 'ES'
                  ? 'El Buen Pastor…'
                  : 'The Good Shepherd…'}
                style={inputStyle}
              />
              <p style={{ fontSize: 10, color: 'var(--color-text-hint)', margin: '4px 0 0' }}>
                {language === 'ES'
                  ? 'Si lo dejas vacío se usará la referencia del pasaje.'
                  : 'Leave blank to use the passage reference as the title.'}
              </p>
            </div>

            {/* Delivery date */}
            <div>
              <label style={labelStyle}>
                {language === 'ES' ? 'Fecha de predicación' : 'Delivery date'}{' '}
                <span style={{ color: 'var(--color-text-hint)', fontWeight: 400 }}>
                  ({language === 'ES' ? 'opcional' : 'optional'})
                </span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Mode */}
            <div>
              <label style={labelStyle}>
                {language === 'ES' ? 'Modo de edición' : 'Writing mode'}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {modeOptions.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display:      'flex',
                      alignItems:   'flex-start',
                      gap:          10,
                      padding:      '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border:       `1px solid ${mode === opt.value ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                      background:   mode === opt.value ? 'var(--color-accent-muted)' : 'var(--color-bg-primary)',
                      cursor:       'pointer',
                      transition:   'border-color 100ms, background 100ms',
                    }}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={opt.value}
                      checked={mode === opt.value}
                      onChange={() => setMode(opt.value)}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
                        {opt.label}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                        {opt.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Repeat warning */}
            {repeatWarning && (
              <div style={{
                padding:      '10px 12px',
                background:   'var(--color-warning-muted)',
                borderRadius: 'var(--radius-md)',
                borderLeft:   '3px solid var(--color-warning)',
              }}>
                <p style={{ fontSize: 12, color: 'var(--color-warning)', margin: 0 }}>
                  {repeatWarning}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <p style={{
                fontSize:     12,
                color:        'var(--color-danger)',
                background:   'var(--color-danger-muted)',
                padding:      '8px 12px',
                borderRadius: 6,
                margin:       0,
              }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => router(-1)}
                className="workman-btn"
                style={{ fontSize: 13 }}
              >
                {language === 'ES' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading || !book}
                style={{
                  padding:      '8px 20px',
                  borderRadius: 'var(--radius-md)',
                  border:       '1px solid var(--color-accent)',
                  background:   'var(--color-accent)',
                  color:        'var(--color-accent-text)',
                  fontSize:     13,
                  fontWeight:   500,
                  fontFamily:   'var(--font-sans)',
                  cursor:       loading || !book ? 'not-allowed' : 'pointer',
                  opacity:      loading || !book ? 0.7 : 1,
                }}
              >
                {loading
                  ? (language === 'ES' ? 'Creando…' : 'Creating…')
                  : (language === 'ES' ? 'Crear sermón →' : 'Create sermon →')}
              </button>
            </div>

          </form>
        </div>

        {/* Verse */}
        <div className="workman-scripture" style={{ marginTop: 20 }}>
          {language === 'ES'
            ? '"Procura con diligencia presentarte a Dios aprobado, como obrero que no tiene de qué avergonzarse, que usa bien la palabra de verdad." — 2 Timoteo 2:15'
            : '"Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth." — 2 Timothy 2:15'}
        </div>

      </div>
    </AppLayout>
  )
}

const labelStyle: React.CSSProperties = {
  display:      'block',
  fontSize:     12,
  fontWeight:   500,
  color:        'var(--color-text-secondary)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width:         '100%',
  padding:       '8px 10px',
  border:        '1px solid var(--color-border-default)',
  borderRadius:  'var(--radius-md)',
  background:    'var(--color-bg-primary)',
  color:         'var(--color-text-primary)',
  fontSize:      13,
  fontFamily:    'var(--font-sans)',
  outline:       'none',
  boxSizing:     'border-box',
}

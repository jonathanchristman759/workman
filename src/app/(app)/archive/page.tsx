

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { AppLayout } from '@/components/layout/AppLayout'
import { useLanguage } from '@/hooks/useLanguage'

interface ArchiveSermon {
  id:           string
  title:        string
  passageRef:   string
  book?:        string | null
  status:       string
  deliveryDate?: string | null
  wordCount:    number
  series?:      { title: string } | null
}

interface Coverage {
  [book: string]: { count: number; chapters: number[] }
}

const ALL_BOOKS = [
  'Gen','Exo','Lev','Num','Deu','Jos','Jdg','Rut','1Sa','2Sa',
  '1Ki','2Ki','1Ch','2Ch','Ezr','Neh','Est','Job','Psa','Pro',
  'Ecc','SoS','Isa','Jer','Lam','Eze','Dan','Hos','Joe','Amo',
  'Oba','Jon','Mic','Nah','Hab','Zep','Hag','Zec','Mal',
  'Mat','Mar','Luk','Joh','Act','Rom','1Co','2Co','Gal','Eph',
  'Php','Col','1Th','2Th','1Ti','2Ti','Tit','Phm','Heb','Jas',
  '1Pe','2Pe','1Jo','2Jo','3Jo','Jud','Rev',
]

const BOOK_FULL_NAMES: Record<string, string> = {
  Gen:'Genesis',Exo:'Exodus',Lev:'Leviticus',Num:'Numbers',Deu:'Deuteronomy',
  Jos:'Joshua',Jdg:'Judges',Rut:'Ruth','1Sa':'1 Samuel','2Sa':'2 Samuel',
  '1Ki':'1 Kings','2Ki':'2 Kings','1Ch':'1 Chronicles','2Ch':'2 Chronicles',
  Ezr:'Ezra',Neh:'Nehemiah',Est:'Esther',Job:'Job',Psa:'Psalms',Pro:'Proverbs',
  Ecc:'Ecclesiastes',SoS:'Song of Solomon',Isa:'Isaiah',Jer:'Jeremiah',
  Lam:'Lamentations',Eze:'Ezekiel',Dan:'Daniel',Hos:'Hosea',Joe:'Joel',
  Amo:'Amos',Oba:'Obadiah',Jon:'Jonah',Mic:'Micah',Nah:'Nahum',Hab:'Habakkuk',
  Zep:'Zephaniah',Hag:'Haggai',Zec:'Zechariah',Mal:'Malachi',
  Mat:'Matthew',Mar:'Mark',Luk:'Luke',Joh:'John',Act:'Acts',Rom:'Romans',
  '1Co':'1 Corinthians','2Co':'2 Corinthians',Gal:'Galatians',Eph:'Ephesians',
  Php:'Philippians',Col:'Colossians','1Th':'1 Thessalonians','2Th':'2 Thessalonians',
  '1Ti':'1 Timothy','2Ti':'2 Timothy',Tit:'Titus',Phm:'Philemon',Heb:'Hebrews',
  Jas:'James','1Pe':'1 Peter','2Pe':'2 Peter','1Jo':'1 John','2Jo':'2 John',
  '3Jo':'3 John',Jud:'Jude',Rev:'Revelation',
}

export default function ArchivePage() {
  const { language } = useLanguage()
  const [sermons,  setSermons]  = useState<ArchiveSermon[]>([])
  const [coverage, setCoverage] = useState<Coverage>({})
  const [search,   setSearch]   = useState('')
  const [year,     setYear]     = useState('')
  const [status,   setStatus]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [stats,    setStats]    = useState({ total: 0, books: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (year)   params.set('year', year)
      if (status) params.set('status', status)

      const [sermonsRes, coverageRes] = await Promise.all([
        invoke<ArchiveSermon[]>('get_sermons', {
  search: search || undefined,
  year: year ? parseInt(year) : undefined,
  status: status || undefined,
}),
        invoke<{ book: string; count: number; chapters: number[] }[]>('get_coverage'),
      ])

      const coverageMap: Coverage = {}
coverageRes.forEach((entry) => {
  coverageMap[entry.book] = { count: entry.count, chapters: entry.chapters }
})
setSermons(sermonsRes)
setCoverage(coverageMap)
setStats({
  total: sermonsRes.length,
  books: coverageRes.length,
})
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, year, status])

  useEffect(() => { load() }, [load])

  function getCoverageStatus(abbr: string): 'preached' | 'partial' | 'none' {
    const full = BOOK_FULL_NAMES[abbr]
    if (!full || !coverage[full]) return 'none'
    return coverage[full].count >= 3 ? 'preached' : 'partial'
  }

  const coverageColors = {
    preached: { bg: 'var(--color-success-muted)',  text: 'var(--color-success)'  },
    partial:  { bg: 'var(--color-warning-muted)',  text: 'var(--color-warning)'  },
    none:     { bg: 'var(--color-bg-secondary)',   text: 'var(--color-text-hint)'},
  }

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)

  return (
    <AppLayout>
      <div style={{
        background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
            {language === 'ES' ? 'Archivo de sermones' : 'Sermon archive'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/archive/import" style={{ textDecoration: 'none' }}>
              <button className="workman-btn" style={{ fontSize: 12 }}>
                ↑ {language === 'ES' ? 'Importar' : 'Import'}
              </button>
            </Link>
            <button className="workman-btn" style={{ fontSize: 12 }}>
              ↓ {language === 'ES' ? 'Exportar todo' : 'Export all'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', minHeight: 560 }}>

          {/* Sidebar filters */}
          <div style={{ padding: '14px', borderRight: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'ES' ? 'Buscar…' : 'Search…'}
              style={filterInputStyle} />

            <div>
              <p style={filterLabelStyle}>{language === 'ES' ? 'Año' : 'Year'}</p>
              <select value={year} onChange={(e) => setYear(e.target.value)} style={{ ...filterInputStyle }}>
                <option value="">{language === 'ES' ? 'Todos los años' : 'All years'}</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <p style={filterLabelStyle}>{language === 'ES' ? 'Estado' : 'Status'}</p>
              {[
                { value: '',         label: language === 'ES' ? 'Todos'       : 'All'       },
                { value: 'DELIVERED',label: language === 'ES' ? 'Predicados'  : 'Delivered' },
                { value: 'IMPORTED', label: language === 'ES' ? 'Importados'  : 'Imported'  },
                { value: 'DRAFT',    label: language === 'ES' ? 'Borradores'  : 'Drafts'    },
              ].map((s) => (
                <button key={s.value} onClick={() => setStatus(s.value)} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  fontSize: 12, padding: '4px 8px', borderRadius: 6,
                  border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  background: status === s.value ? 'var(--color-accent-muted)' : 'transparent',
                  color:      status === s.value ? 'var(--color-accent-text)'  : 'var(--color-text-secondary)',
                  fontWeight: status === s.value ? 500 : 400, marginBottom: 2,
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main area */}
          <div style={{ padding: '14px', overflowY: 'auto' }}>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { value: stats.total, label: language === 'ES' ? 'Sermones totales' : 'Total sermons' },
                { value: stats.books, label: language === 'ES' ? 'Libros predicados' : 'Books preached' },
                { value: `${Math.round((stats.books / 66) * 100)}%`, label: language === 'ES' ? 'Cobertura del canon' : 'Canon coverage' },
              ].map((s) => (
                <div key={s.label} style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '3px 0 0' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Coverage map */}
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                  {language === 'ES' ? 'Mapa de cobertura' : 'Passage coverage map'}
                </p>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                  {stats.books}/66 {language === 'ES' ? 'libros' : 'books'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {ALL_BOOKS.map((abbr) => {
                  const cs = getCoverageStatus(abbr)
                  const c  = coverageColors[cs]
                  return (
                    <div
                      key={abbr}
                      title={BOOK_FULL_NAMES[abbr]}
                      style={{
                        fontSize: 9, padding: '3px 4px', borderRadius: 3,
                        background: c.bg, color: c.text, cursor: 'default',
                        minWidth: 26, textAlign: 'center',
                      }}
                    >
                      {abbr}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {[
                  { cs: 'preached', label: language === 'ES' ? 'Predicado' : 'Preached' },
                  { cs: 'partial',  label: language === 'ES' ? 'Parcial'   : 'Partial'  },
                  { cs: 'none',     label: language === 'ES' ? 'Sin predicar' : 'Not yet' },
                ].map(({ cs, label }) => {
                  const c = coverageColors[cs as keyof typeof coverageColors]
                  return (
                    <div key={cs} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg }} />
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sermon list */}
            {loading ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {language === 'ES' ? 'Cargando…' : 'Loading…'}
              </p>
            ) : sermons.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {language === 'ES' ? 'No se encontraron sermones.' : 'No sermons found.'}
              </p>
            ) : (
              sermons.map((s) => (
                <Link key={s.id} to={`/sermons/${s.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px',
                    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)', marginBottom: 6, cursor: 'pointer',
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                        {s.title}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                        {s.passageRef}
                        {s.series && ` · ${s.series.title}`}
                        {s.deliveryDate && ` · ${new Date(s.deliveryDate).toLocaleDateString()}`}
                        {s.status === 'IMPORTED' && ` · ${language === 'ES' ? 'Importado' : 'Imported'}`}
                      </p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3l4 4-4 4" stroke="var(--color-text-hint)" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

const filterLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--color-text-secondary)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

const filterInputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: 12, fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500,
  color: 'var(--color-text-primary)',
  margin: '0 0 14px',
  paddingBottom: 8,
  borderBottom: '1px solid var(--color-border-subtle)',
}

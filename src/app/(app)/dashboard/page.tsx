// Workman — dashboard/page.tsx
// apps/web/src/app/(app)/dashboard/page.tsx



import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/components/providers/AuthProvider'
import { useLanguage } from '@/hooks/useLanguage'
import { invoke } from '@tauri-apps/api/core'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface Sermon {
  id:            string
  title:         string
  passage_ref:   string
  status:        string
  word_count:    number
  delivery_date: string | null
  updated_at:    string
  series_title?: string | null
}

interface DashboardStats {
  totalSermons:    number
  booksPreached:   number
  seriesCompleted: number
  savedIllustrations: number
}

interface DashboardData {
  activeSermon:  Sermon | null
  recentSermons: Sermon[]
  stats:         DashboardStats
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now   = new Date()
  const target = new Date(dateStr)
  const diff  = target.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function estimateMinutes(wordCount: number): number {
  return Math.round(wordCount / 130)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  })
}

function outlineProgress(sermon: Sermon): number {
  // Rough heuristic — word count relative to a typical 30-min sermon (~3,900 words)
  return Math.min(Math.round((sermon.word_count / 3900) * 100), 100)
}

// ─────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      background:   'var(--color-bg-secondary)',
      borderRadius: 'var(--radius-md)',
      padding:      '10px 12px',
      textAlign:    'center',
    }}>
      <p style={{ fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
        {value.toLocaleString()}
      </p>
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
        {label}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────────

export default function DashboardPage() {
  const { user }        = useAuth()
  const { t, language } = useLanguage()
  const [data, setData]     = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // Load active/recent sermons and stats in parallel
        const [sermons, coverage] = await Promise.all([
  invoke<Sermon[]>('get_sermons', {}),
  invoke<{ book: string; count: number }[]>('get_coverage'),
])

const active = sermons.find(
  (s) => s.status === 'DRAFT' || s.status === 'IN_PROGRESS'
) ?? null
const recent = sermons
  .filter((s) => s.status === 'DELIVERED' || s.status === 'IMPORTED')
  .slice(0, 4)

setData({
  activeSermon:  active,
  recentSermons: recent,
  stats: {
    totalSermons:       sermons.length,
    booksPreached:      coverage.length,
    seriesCompleted:    0,
    savedIllustrations: 0,
  },
})
      } catch (err) {
        console.error('Dashboard load failed:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const greeting = language === 'ES'
    ? `Bienvenido, ${user?.name?.split(' ')[0]}`
    : `Welcome back, ${user?.name?.split(' ')[0]}`

  return (
    <AppLayout>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* ── GREETING ── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontSize:   22,
            fontWeight: 500,
            margin:     '0 0 4px',
            color:      'var(--color-text-primary)',
          }}>
            {greeting}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            {language === 'ES'
              ? 'Aquí está tu espacio de trabajo para hoy.'
              : "Here's your workspace for today."}
          </p>
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading…</p>
        ) : (
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap:                 16,
          }}>

            {/* ── LEFT COLUMN ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Active sermon card */}
              {data?.activeSermon ? (
                <div className="workman-card">
                  <div style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'flex-start',
                    marginBottom:   12,
                  }}>
                    <div>
                      <p style={{
                        fontSize:      11,
                        color:         'var(--color-text-hint)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        margin:        '0 0 4px',
                      }}>
                        {language === 'ES' ? 'Sermón actual' : 'Current sermon'}
                      </p>
                      <p style={{ fontSize: 17, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
                        {data.activeSermon.title}
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-serif)',
                        fontStyle:  'italic',
                        fontSize:   13,
                        color:      'var(--color-text-secondary)',
                        margin:     '3px 0 0',
                      }}>
                        {data.activeSermon.passage_ref}
                      </p>
                    </div>
                    <span className="workman-badge workman-badge-success">
                      {language === 'ES' ? 'En progreso' : 'In progress'}
                    </span>
                  </div>

                  {/* Metrics row */}
                  <div style={{
                    display:             'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap:                 8,
                    marginBottom:        12,
                  }}>
                    <div style={{
                      background:   'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      padding:      '10px',
                      textAlign:    'center',
                    }}>
                      <p style={{ fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
                        {data.activeSermon.word_count.toLocaleString()}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                        {language === 'ES' ? 'palabras' : 'words'} ·{' '}
                        ~{estimateMinutes(data.activeSermon.word_count)} min
                      </p>
                    </div>
                    <div style={{
                      background:   'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      padding:      '10px',
                      textAlign:    'center',
                    }}>
                      <p style={{ fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
                        {outlineProgress(data.activeSermon)}%
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                        {language === 'ES' ? 'completo' : 'complete'}
                      </p>
                    </div>
                    <div style={{
                      background:   'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      padding:      '10px',
                      textAlign:    'center',
                    }}>
                      {data.activeSermon.delivery_date ? (
                        <>
                          <p style={{ fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
                            {formatDate(data.activeSermon.delivery_date)}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                            {daysUntil(data.activeSermon.delivery_date)} {language === 'ES' ? 'días' : 'days away'}
                          </p>
                        </>
                      ) : (
                        <>
                          <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--color-text-muted)' }}>—</p>
                          <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                            {language === 'ES' ? 'sin fecha' : 'no date set'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    height:       4,
                    background:   'var(--color-bg-tertiary)',
                    borderRadius: 2,
                    marginBottom: 4,
                    overflow:     'hidden',
                  }}>
                    <div style={{
                      height:       4,
                      width:        `${outlineProgress(data.activeSermon)}%`,
                      background:   'var(--color-accent)',
                      borderRadius: 2,
                      transition:   'width 400ms ease',
                    }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: '0 0 12px' }}>
                    {outlineProgress(data.activeSermon)}% {language === 'ES' ? 'completado' : 'complete'}
                  </p>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/sermons/${data.activeSermon.id}`} style={{ flex: 1, textDecoration: 'none' }}>
                      <button style={{
                        width:         '100%',
                        padding:       '7px',
                        borderRadius:  6,
                        border:        '1px solid var(--color-accent)',
                        background:    'var(--color-accent)',
                        color:         'var(--color-accent-text)',
                        fontSize:      12,
                        fontWeight:    500,
                        fontFamily:    'var(--font-sans)',
                        cursor:        'pointer',
                      }}>
                        {language === 'ES' ? 'Continuar editando' : 'Continue editing'}
                      </button>
                    </Link>
                    <Link to={`/lexicon?ref=${encodeURIComponent(data.activeSermon.passage_ref)}`}
                      style={{ flex: 1, textDecoration: 'none' }}>
                      <button className="workman-btn" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
                        {language === 'ES' ? 'Abrir en léxico' : 'Open in lexicon'}
                      </button>
                    </Link>
                  </div>
                </div>
              ) : (
                /* No active sermon */
                <div className="workman-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
                  <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 16px' }}>
                    {language === 'ES'
                      ? 'No tienes un sermón activo. ¿Listo para empezar?'
                      : "You don't have an active sermon. Ready to start one?"}
                  </p>
                  <Link to="/sermons/new" style={{ textDecoration: 'none' }}>
                    <button style={{
                      padding:    '8px 20px',
                      borderRadius: 6,
                      border:     '1px solid var(--color-accent)',
                      background: 'var(--color-accent)',
                      color:      'var(--color-accent-text)',
                      fontSize:   13,
                      fontWeight: 500,
                      fontFamily: 'var(--font-sans)',
                      cursor:     'pointer',
                    }}>
                      {language === 'ES' ? '+ Nuevo sermón' : '+ New sermon'}
                    </button>
                  </Link>
                </div>
              )}

              {/* AI study assistant hint */}
              <div className="workman-card">
                <p style={{
                  fontSize:   13,
                  fontWeight: 500,
                  color:      'var(--color-text-primary)',
                  margin:     '0 0 8px',
                }}>
                  {language === 'ES' ? 'Asistente de estudio' : 'Study assistant'}
                </p>
                {data?.activeSermon ? (
                  <div style={{
                    background:   'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding:      '10px 12px',
                    marginBottom: 8,
                  }}>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 5px' }}>
                      {language === 'ES'
                        ? `Sugerido para ${data.activeSermon.passage_ref}`
                        : `Suggested for ${data.activeSermon.passage_ref}`}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 3px' }}>
                      · {language === 'ES'
                          ? 'Contexto cultural: pastoreo en Judea del siglo I'
                          : 'Cultural background: shepherding in 1st-century Judea'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 3px' }}>
                      · {language === 'ES'
                          ? 'Estudio de palabra griega: ποιμήν (poimén)'
                          : 'Greek word study: ποιμήν (poimén) — shepherd'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                      · {language === 'ES'
                          ? 'Referencias cruzadas: Salmo 23, Ezequiel 34'
                          : 'Cross-references: Psalm 23, Ezekiel 34, Isaiah 40:11'}
                    </p>
                  </div>
                ) : null}
                <p style={{
                  fontSize:   10,
                  color:      'var(--color-text-hint)',
                  fontStyle:  'italic',
                  margin:     0,
                }}>
                  {language === 'ES'
                    ? 'Solo para investigación y estudio. Workman no escribe sermones.'
                    : 'Research and study only. Workman does not write sermons.'}
                </p>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Ministry stats */}
              <div className="workman-card">
                <p style={{
                  fontSize:   12,
                  fontWeight: 500,
                  color:      'var(--color-text-primary)',
                  margin:     '0 0 10px',
                }}>
                  {language === 'ES' ? 'Tu ministerio' : 'Your ministry'}
                </p>
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap:                 6,
                }}>
                  <StatCard
                    value={data?.stats.totalSermons ?? 0}
                    label={language === 'ES' ? 'Sermones archivados' : 'Sermons archived'}
                  />
                  <StatCard
                    value={data?.stats.booksPreached ?? 0}
                    label={language === 'ES' ? 'Libros predicados' : 'Books preached'}
                  />
                  <StatCard
                    value={data?.stats.seriesCompleted ?? 0}
                    label={language === 'ES' ? 'Series completadas' : 'Series completed'}
                  />
                  <StatCard
                    value={data?.stats.savedIllustrations ?? 0}
                    label={language === 'ES' ? 'Ilustraciones guardadas' : 'Saved illustrations'}
                  />
                </div>
              </div>

              {/* Recent sermons */}
              <div className="workman-card">
                <p style={{
                  fontSize:   12,
                  fontWeight: 500,
                  color:      'var(--color-text-primary)',
                  margin:     '0 0 10px',
                }}>
                  {language === 'ES' ? 'Sermones recientes' : 'Recent sermons'}
                </p>
                {data?.recentSermons.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {language === 'ES' ? 'Aún no hay sermones archivados.' : 'No archived sermons yet.'}
                  </p>
                ) : (
                  data?.recentSermons.map((sermon) => (
                    <Link key={sermon.id} href={`/sermons/${sermon.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        display:        'flex',
                        justifyContent: 'space-between',
                        alignItems:     'center',
                        padding:        '7px 10px',
                        background:     'var(--color-bg-secondary)',
                        borderRadius:   'var(--radius-md)',
                        marginBottom:   6,
                        cursor:         'pointer',
                      }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                            {sermon.title}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '1px 0 0' }}>
                            {sermon.delivery_date ? formatDate(sermon.delivery_date) : sermon.passage_ref}
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
                <Link to="/archive" style={{ textDecoration: 'none' }}>
                  <button className="workman-btn" style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginTop: 4 }}>
                    {language === 'ES' ? 'Ver archivo completo' : 'View full archive'} ↗
                  </button>
                </Link>
              </div>

              {/* Quick actions */}
              <div className="workman-card">
                <p style={{
                  fontSize:   12,
                  fontWeight: 500,
                  color:      'var(--color-text-primary)',
                  margin:     '0 0 8px',
                }}>
                  {language === 'ES' ? 'Acciones rápidas' : 'Quick actions'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { href: '/sermons/new', icon: '✦', label: language === 'ES' ? 'Nuevo sermón' : 'New sermon' },
                    { href: '/archive/import', icon: '↑', label: language === 'ES' ? 'Importar sermones' : 'Import sermons' },
                    { href: '/illustrations', icon: '◈', label: language === 'ES' ? 'Ver ilustraciones' : 'Browse illustrations' },
                  ].map((action) => (
                    <Link key={action.href} href={action.href} style={{ textDecoration: 'none' }}>
                      <button className="workman-btn" style={{
                        width:   '100%',
                        fontSize: 12,
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        gap:     8,
                      }}>
                        <span style={{ color: 'var(--color-accent)', fontSize: 11 }}>{action.icon}</span>
                        {action.label}
                      </button>
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

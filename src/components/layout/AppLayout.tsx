

import { Link } from 'react-router-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/components/providers/AuthProvider'
import { useLanguage } from '@/hooks/useLanguage'
import { useEffect, useState } from 'react'

interface NavItem {
  to:  string
  label: string
  labelEs: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',     label: 'Dashboard',     labelEs: 'Inicio'        },
  { to: '/sermons',       label: 'Sermons',        labelEs: 'Sermones'      },
  { to: '/bible',         label: 'Bible',          labelEs: 'Biblia'        },
  { to: '/lexicon',       label: 'Lexicon',        labelEs: 'Léxico'        },
  { to: '/illustrations', label: 'Illustrations',  labelEs: 'Ilustraciones' },
  { to: '/archive',       label: 'Archive',        labelEs: 'Archivo'       },
]

function VersionIndicator({ language }: { language: string }) {
  const [status, setStatus] = useState<'checking' | 'latest' | 'update'>('checking')
  const currentVersion = '0.6.0'

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch('https://raw.githubusercontent.com/jonathanchristman759/workman/main/latest.json')
        const data = await res.json()
        if (data.version && data.version !== currentVersion) {
          setStatus('update')
        } else {
          setStatus('latest')
        }
      } catch {
        setStatus('latest')
      }
    }
    checkVersion()
  }, [])

  async function handleClick() {
    if (status !== 'update') return
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const { relaunch } = await import('@tauri-apps/plugin-process')
      const update = await check()
      if (update?.available) {
        const yes = window.confirm(
          `Workman ${update.version} is available.\n\nInstall now?`
        )
        if (yes) {
          await update.downloadAndInstall()
          await relaunch()
        }
      }
    } catch (err) {
      console.error('Update failed:', err)
    }
  }

  return (
    <div
      onClick={handleClick}
      style={{
        position:   'fixed',
        bottom:     8,
        left:       12,
        fontSize:   10,
        fontFamily: 'var(--font-sans)',
        color:      status === 'update' ? 'var(--color-accent)' : 'var(--color-text-hint)',
        display:    'flex',
        alignItems: 'center',
        gap:        4,
        cursor:     status === 'update' ? 'pointer' : 'default',
        zIndex:     50,
      }}
      title={status === 'update'
        ? (language === 'ES' ? 'Actualización disponible' : 'Update available')
        : (language === 'ES' ? 'Versión actual' : 'Up to date')}
    >
      <span style={{
        width:        6,
        height:       6,
        borderRadius: '50%',
        background:   status === 'checking' ? 'var(--color-text-hint)'
          : status === 'update' ? 'var(--color-accent)'
          : '#6a9a5a',
        display:      'inline-block',
      }} />
      v{currentVersion}
      {status === 'update' && (
        <span> · {language === 'ES' ? 'actualización disponible' : 'update available'}</span>
      )}
    </div>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const { language, toggleLanguage } = useLanguage()
  const { pathname } = useLocation()
  const router   = useNavigate()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router('/login')
    }
  }, [user, loading, router])

  // ── APP-WIDE KEYBOARD SHORTCUTS ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+N — new sermon
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        router('/sermons/new')
      }
      // Ctrl+/ — open lexicon
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        router('/lexicon')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg-page)',
      }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Loading…
        </p>
      </div>
    )
  }

  if (!user) return null

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div style={{
  height:     '100vh',
  display:    'flex',
  flexDirection: 'column',
      background: 'var(--color-bg-page)',
      color:      'var(--color-text-primary)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── TOP NAV ── */}
      <nav style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         '0 24px',
        height:          '52px',
        background:      'var(--color-bg-primary)',
        borderBottom:    '1px solid var(--color-border-subtle)',
        position:        'sticky',
        top:             0,
        zIndex:          100,
      }}>

        {/* Logo + nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/dashboard" style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            textDecoration: 'none',
          }}>
            <div style={{
              width:          22,
              height:         22,
              background:     'var(--color-text-primary)',
              borderRadius:   4,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="1" y="0.5" width="9" height="12" rx="1.5"
                  fill="var(--color-bg-primary)" opacity="0.15"/>
                <rect x="2" y="1" width="9" height="12" rx="1.5"
                  fill="var(--color-bg-primary)" opacity="0.2"/>
                <rect x="3" y="1.5" width="9" height="12" rx="1.5"
                  fill="var(--color-bg-primary)"/>
                <rect x="6" y="4.5" width="4" height="1" rx="0.5"
                  fill="var(--color-text-primary)"/>
                <rect x="6" y="6.5" width="3" height="1" rx="0.5"
                  fill="var(--color-text-primary)" opacity="0.6"/>
                <rect x="6" y="8.5" width="3.5" height="1" rx="0.5"
                  fill="var(--color-text-primary)" opacity="0.6"/>
              </svg>
            </div>
            <span style={{
              fontSize:   15,
              fontWeight: 500,
              color:      'var(--color-text-primary)',
            }}>
              Workman
            </span>
          </Link>

          <div style={{ display: 'flex', gap: 2 }}>
            {NAV_ITEMS.map((item) => {
  const isActive = pathname.startsWith(item.to)
  return (
    <Link
      key={item.to}
      to={item.to}
      onClick={() => {
  if (item.to === '/sermons' && pathname.startsWith('/sermons/')) {
    localStorage.removeItem('lastSermonId')
  }
}}
      style={{
        fontSize:      13,
        padding:       '5px 10px',
        borderRadius:  6,
        textDecoration:'none',
        color:         isActive
          ? 'var(--color-text-primary)'
          : 'var(--color-text-muted)',
        background:    isActive
          ? 'var(--color-bg-secondary)'
          : 'transparent',
        fontWeight:    isActive ? 500 : 400,
        transition:    'background 100ms ease, color 100ms ease',
      }}
    >
      {language === 'ES' ? item.labelEs : item.label}
    </Link>
  )
})}
          </div>
        </div>

        {/* Right side — language toggle + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            title={language === 'EN' ? 'Switch to Spanish' : 'Switch to English'}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          4,
              fontSize:     12,
              padding:      '4px 10px',
              borderRadius: 6,
              border:       '1px solid var(--color-border-default)',
              background:   'transparent',
              color:        'var(--color-text-muted)',
              cursor:       'pointer',
              fontFamily:   'var(--font-sans)',
            }}
          >
            <span style={{
              fontWeight: language === 'EN' ? 600 : 400,
              color: language === 'EN' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}>EN</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{
              fontWeight: language === 'ES' ? 600 : 400,
              color: language === 'ES' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}>ES</span>
          </button>

{/* Keyboard shortcuts button */}
          <button
            onClick={() => setShowShortcuts(true)}
            title={language === 'ES' ? 'Atajos de teclado' : 'Keyboard shortcuts'}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          28,
              height:         28,
              borderRadius:   6,
              border:         '1px solid var(--color-border-default)',
              background:     'transparent',
              color:          'var(--color-text-muted)',
              cursor:         'pointer',
              fontSize:       14,
            }}
          >
            ⌨
          </button>

          {/* Shortcuts modal */}
          {showShortcuts && (
            <div
              onClick={() => setShowShortcuts(false)}
              style={{
                position:       'fixed',
                inset:          0,
                background:     'rgba(0,0,0,0.4)',
                zIndex:         1000,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background:   'var(--color-bg-primary)',
                  border:       '1px solid var(--color-border-default)',
                  borderRadius: 12,
                  padding:      '24px 28px',
                  minWidth:     380,
                  maxWidth:     480,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-serif)' }}>
                    {language === 'ES' ? 'Atajos de teclado' : 'Keyboard shortcuts'}
                  </h2>
                  <button
                    onClick={() => setShowShortcuts(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-text-muted)' }}
                  >×</button>
                </div>
                {[
                  { key: 'Ctrl + S',         desc: language === 'ES' ? 'Guardar' : 'Save' },
                  { key: 'Ctrl + P',         desc: language === 'ES' ? 'Vista previa' : 'Toggle preview' },
                  { key: 'Ctrl + E',         desc: language === 'ES' ? 'Exportar PDF' : 'Export PDF' },
                  { key: 'Ctrl + Shift + P', desc: language === 'ES' ? 'Imprimir' : 'Print sermon' },
                  { key: 'Escape',           desc: language === 'ES' ? 'Cerrar vista previa' : 'Close preview' },
                  { key: 'Ctrl + N',         desc: language === 'ES' ? 'Nuevo sermón' : 'New sermon' },
                  { key: 'Ctrl + /',         desc: language === 'ES' ? 'Abrir léxico' : 'Open lexicon' },
                  { key: 'Enter',            desc: language === 'ES' ? 'Nuevo punto (esquema)' : 'New outline point' },
                  { key: 'Tab',              desc: language === 'ES' ? 'Nuevo sub-punto (esquema)' : 'New sub-point' },
                  { key: 'Ctrl + B',         desc: language === 'ES' ? 'Negrita' : 'Bold' },
                  { key: 'Ctrl + I',         desc: language === 'ES' ? 'Cursiva' : 'Italic' },
                  { key: 'Ctrl + U',         desc: language === 'ES' ? 'Subrayado' : 'Underline' },
                  { key: 'Ctrl + Z',         desc: language === 'ES' ? 'Deshacer' : 'Undo' },
                  { key: 'Ctrl + Y',         desc: language === 'ES' ? 'Rehacer' : 'Redo' },
                ].map(({ key, desc }) => (
                  <div key={key} style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'center',
                    padding:        '7px 0',
                    borderBottom:   '1px solid var(--color-border-subtle)',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{desc}</span>
                    <kbd style={{
                      fontSize:     11,
                      padding:      '3px 8px',
                      borderRadius: 4,
                      border:       '1px solid var(--color-border-default)',
                      background:   'var(--color-bg-secondary)',
                      color:        'var(--color-text-primary)',
                      fontFamily:   'var(--font-sans)',
                    }}>{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New sermon button */}
          <Link to="/sermons/new" style={{ textDecoration: 'none' }}>
            <button style={{
              display:      'flex',
              alignItems:   'center',
              gap:          5,
              fontSize:     12,
              padding:      '5px 12px',
              borderRadius: 6,
              border:       '1px solid var(--color-accent)',
              background:   'var(--color-accent)',
              color:        'var(--color-accent-text)',
              cursor:       'pointer',
              fontFamily:   'var(--font-sans)',
              fontWeight:   500,
            }}>
              + {language === 'ES' ? 'Nuevo sermón' : 'New sermon'}
            </button>
          </Link>

          {/* User avatar / menu */}
          <div style={{ position: 'relative' }}>
            <Link to="/settings" style={{ textDecoration: 'none' }}>
              <div
                title={`${user.name} · Settings`}
                style={{
                  width:          30,
                  height:         30,
                  borderRadius:   '50%',
                  background:     'var(--color-accent-muted)',
                  color:          'var(--color-accent-text)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       12,
                  fontWeight:     500,
                  cursor:         'pointer',
                  border:         '1px solid var(--color-border-default)',
                }}
              >
                {initials}
              </div>
            </Link>
          </div>

        </div>
      </nav>

      {/* ── PAGE CONTENT ── */}
      <main style={{
        flex:      1,
        overflowY: 'auto',
        padding:   '24px 24px',
        maxWidth:  1200,
        margin:    '0 auto',
        width:     '100%',
        boxSizing: 'border-box',
      }}>
        {children}
      </main>

{/* ── VERSION INDICATOR ── */}
      <VersionIndicator language={language} />
    </div>
  )
}

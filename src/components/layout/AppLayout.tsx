

import { Link } from 'react-router-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/components/providers/AuthProvider'
import { useLanguage } from '@/hooks/useLanguage'
import { useEffect } from 'react'

interface NavItem {
  to:  string
  label: string
  labelEs: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',    label: 'Dashboard',     labelEs: 'Inicio'        },
{ to: '/sermons',      label: 'Sermons',        labelEs: 'Sermones'      },
{ to: '/lexicon',      label: 'Lexicon',        labelEs: 'Léxico'        },
{ to: '/illustrations',label: 'Illustrations',  labelEs: 'Ilustraciones' },
{ to: '/archive',      label: 'Archive',        labelEs: 'Archivo'       },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
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
      minHeight:  '100vh',
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
        maxWidth: 1200,
        margin:   '0 auto',
        padding:  '24px 24px',
      }}>
        {children}
      </main>

    </div>
  )
}

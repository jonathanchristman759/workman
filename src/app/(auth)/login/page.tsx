

import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/components/providers/AuthProvider'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const { refreshUser } = useAuth()
  const router = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post('/auth/signin', { email, password })
      await refreshUser()
      router('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <h1 style={{
        fontSize:   22,
        fontWeight: 500,
        margin:     '0 0 6px',
        color:      'var(--color-text-primary)',
      }}>
        Welcome back
      </h1>
      <p style={{
        fontSize: 14,
        color:    'var(--color-text-muted)',
        margin:   '0 0 24px',
      }}>
        Sign in to your Workman account
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pastor@church.org"
            required
            autoComplete="email"
            className="workman-input"
            style={inputStyle}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <label style={labelStyle}>Password</label>
            <Link to="/reset-password" style={linkStyle}>Forgot password?</Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{
            fontSize:     13,
            color:        'var(--color-danger)',
            background:   'var(--color-danger-muted)',
            padding:      '8px 12px',
            borderRadius: 6,
            margin:       0,
          }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...accentBtnStyle,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', marginTop: 20 }}>
        No account?{' '}
        <Link to="/signup" style={linkStyle}>Create one free</Link>
      </p>
    </AuthShell>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight:       '100vh',
      background:      'var(--color-bg-page)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '24px',
      fontFamily:      'var(--font-sans)',
    }}>
      <div style={{
        width:         '100%',
        maxWidth:      420,
      }}>
        {/* Workman logo mark */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          justifyContent: 'center',
          marginBottom:   28,
        }}>
          <div style={{
            width:          28,
            height:         28,
            background:     'var(--color-text-primary)',
            borderRadius:   6,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="0.5" width="11" height="15" rx="2"
                fill="var(--color-bg-primary)" opacity="0.12"/>
              <rect x="2.5" y="1" width="11" height="15" rx="2"
                fill="var(--color-bg-primary)" opacity="0.18"/>
              <rect x="4" y="1.5" width="11" height="15" rx="2"
                fill="var(--color-bg-primary)"/>
              <rect x="7" y="5.5" width="5.5" height="1.5" rx="0.75"
                fill="var(--color-text-primary)"/>
              <rect x="7" y="8" width="4" height="1.5" rx="0.75"
                fill="var(--color-text-primary)" opacity="0.5"/>
              <rect x="7" y="10.5" width="5" height="1.5" rx="0.75"
                fill="var(--color-text-primary)" opacity="0.5"/>
            </svg>
          </div>
          <span style={{
            fontSize:      18,
            fontWeight:    500,
            color:         'var(--color-text-primary)',
            letterSpacing: '-0.2px',
          }}>
            Workman
          </span>
        </div>

        {/* Card */}
        <div style={{
          background:    'var(--color-bg-primary)',
          border:        '1px solid var(--color-border-default)',
          borderRadius:  'var(--radius-lg)',
          padding:       '28px 28px',
        }}>
          {children}
        </div>

        <p style={{
          textAlign:  'center',
          fontSize:   11,
          color:      'var(--color-text-hint)',
          marginTop:  16,
        }}>
          Study to be approved. — 2 Timothy 2:15
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display:      'block',
  fontSize:     12,
  fontWeight:   500,
  color:        'var(--color-text-secondary)',
  marginBottom: 5,
}

const inputStyle: React.CSSProperties = {
  width:         '100%',
  padding:       '9px 12px',
  border:        '1px solid var(--color-border-default)',
  borderRadius:  8,
  background:    'var(--color-bg-primary)',
  color:         'var(--color-text-primary)',
  fontSize:      14,
  fontFamily:    'var(--font-sans)',
  outline:       'none',
  boxSizing:     'border-box',
}

const accentBtnStyle: React.CSSProperties = {
  width:         '100%',
  padding:       '10px',
  borderRadius:  8,
  border:        '1px solid var(--color-accent)',
  background:    'var(--color-accent)',
  color:         'var(--color-accent-text)',
  fontSize:      14,
  fontWeight:    500,
  fontFamily:    'var(--font-sans)',
  cursor:        'pointer',
}

const linkStyle: React.CSSProperties = {
  color:          'var(--color-interactive)',
  textDecoration: 'none',
  fontWeight:     500,
}

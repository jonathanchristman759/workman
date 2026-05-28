import { useEffect, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'

export function WhatsNewModal() {
  const [notes, setNotes]     = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    async function check() {
      try {
        const current = await getVersion()
        const lastSeen = localStorage.getItem('lastSeenVersion')
        if (lastSeen === current) return // already seen this version

        const res  = await fetch('https://raw.githubusercontent.com/jonathanchristman759/workman/main/latest.json')
        const data = await res.json()

        setNotes(data.notes ?? null)
        setVisible(true)
        localStorage.setItem('lastSeenVersion', current)
      } catch {
        // silently fail — don't block the app
      }
    }
    check()
  }, [])

  if (!visible || !notes) return null

  return (
    <div
      onClick={() => setVisible(false)}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 12,
          padding: '28px 32px',
          minWidth: 380, maxWidth: 480,
        }}
      >
        <h2 style={{
          margin: '0 0 4px', fontSize: 16, fontWeight: 600,
          color: 'var(--color-text-primary)', fontFamily: 'var(--font-serif)',
        }}>
          ✦ What's new in Workman
        </h2>
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 16px' }}>
          Just updated to the latest version
        </p>
        <div style={{
          fontSize: 13, color: 'var(--color-text-secondary)',
          lineHeight: 1.7, whiteSpace: 'pre-line',
          borderTop: '1px solid var(--color-border-subtle)', paddingTop: 14,
        }}>
          {notes}
        </div>
        <button
          onClick={() => setVisible(false)}
          style={{
            marginTop: 20, width: '100%',
            padding: '8px', borderRadius: 6,
            border: '1px solid var(--color-accent)',
            background: 'var(--color-accent)',
            color: 'var(--color-accent-text)',
            fontSize: 13, fontFamily: 'var(--font-sans)',
            fontWeight: 500, cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
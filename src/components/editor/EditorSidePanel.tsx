import { useState as useSidePanelState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Link } from 'react-router-dom'
import { Sermon } from '@/app/(app)/sermons/[id]/page'

interface EditorSidePanelProps {
  sermon:      Sermon
  activeTab:   'lexicon' | 'illustrations'
  onTabChange: (tab: 'lexicon' | 'illustrations') => void
  language:    string
}

export function EditorSidePanel({
  sermon, activeTab, onTabChange, language,
}: EditorSidePanelProps) {

  const tabs = [
    { id: 'lexicon'       as const, label: language === 'ES' ? 'Léxico'        : 'Lexicon'       },
    { id: 'illustrations' as const, label: language === 'ES' ? 'Ilustraciones' : 'Illustrations' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Tab row */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-subtle)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex:         1,
              padding:      '10px 4px',
              fontSize:     11,
              fontWeight:   activeTab === tab.id ? 500 : 400,
              color:        activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              background:   'transparent',
              border:       'none',
              borderBottom: activeTab === tab.id
                ? '2px solid var(--color-accent)'
                : '2px solid transparent',
              cursor:       'pointer',
              fontFamily:   'var(--font-sans)',
              transition:   'color 100ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>

        {/* ── LEXICON TAB ── */}
        {activeTab === 'lexicon' && (
          <div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
              {language === 'ES'
                ? `Abre el léxico completo para explorar las palabras originales en ${sermon.passageRef}.`
                : `Open the full lexicon to explore the original language words in ${sermon.passageRef}.`}
            </p>
            <Link to={`/lexicon`} style={{ textDecoration: 'none' }}>
              <button className="workman-btn" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}>
                {language === 'ES' ? 'Abrir léxico ↗' : 'Open lexicon ↗'}
              </button>
            </Link>
          </div>
        )}

        {/* ── ILLUSTRATIONS TAB ── */}
        {activeTab === 'illustrations' && (
          <div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
              {language === 'ES'
                ? 'Busca ilustraciones para este sermón en la biblioteca.'
                : 'Browse the illustration library for this sermon.'}
            </p>
            <Link to="/illustrations" style={{ textDecoration: 'none' }}>
              <button className="workman-btn" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}>
                {language === 'ES' ? 'Ver ilustraciones ↗' : 'Browse illustrations ↗'}
              </button>
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}

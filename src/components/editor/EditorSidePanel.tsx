import { useState as useSidePanelState, useRef as useSidePanelRef } from 'react'
import { Sermon } from '@/app/(app)/sermons/[id]/page'

interface EditorSidePanelProps {
  sermon:       Sermon
  activeTab:    'lexicon' | 'illustrations' | 'assistant'
  onTabChange:  (tab: 'lexicon' | 'illustrations' | 'assistant') => void
  language:     string
}

interface AssistantMessage {
  role:    'user' | 'assistant'
  content: string
}

export function EditorSidePanel({
  sermon, activeTab, onTabChange, language,
}: EditorSidePanelProps) {
  const [query,       setQuery]       = useSidePanelState('')
  const [messages,    setMessages]    = useSidePanelState<AssistantMessage[]>([])
  const [aiLoading,   setAiLoading]   = useSidePanelState(false)
  const messagesEndRef = useSidePanelRef<HTMLDivElement>(null)

  async function handleAssistantQuery() {
    if (!query.trim() || aiLoading) return

    const userMsg: AssistantMessage = { role: 'user', content: query }
    setMessages((prev) => [...prev, userMsg])
    setQuery('')
    setAiLoading(true)

    try {
      const data = await api.post<{ response: string }>('/assistant/query', {
        message:    query,
        passageRef: sermon.passageRef,
        language:   language as 'EN' | 'ES',
        history:    messages.slice(-10), // send last 10 for context
      })

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response },
      ])

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role:    'assistant',
          content: language === 'ES'
            ? 'Hubo un error. Intenta de nuevo.'
            : 'Something went wrong. Please try again.',
        },
      ])
    } finally {
      setAiLoading(false)
    }
  }

  const tabs = [
    { id: 'lexicon'       as const, label: language === 'ES' ? 'Léxico'         : 'Lexicon'       },
    { id: 'illustrations' as const, label: language === 'ES' ? 'Ilustraciones'  : 'Illustrations' },
    { id: 'assistant'     as const, label: language === 'ES' ? 'Asistente'      : 'Assistant'     },
  ]

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      height:         '100%',
    }}>

      {/* Tab row */}
      <div style={{
        display:      'flex',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}>
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
        flex:     1,
        overflowY:'auto',
        padding:  '12px 14px',
        display:  'flex',
        flexDirection: 'column',
        gap:      10,
      }}>

        {/* ── LEXICON TAB ── */}
        {activeTab === 'lexicon' && (
          <div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
              {language === 'ES'
                ? `Palabras destacadas en ${sermon.passageRef}`
                : `Key words in ${sermon.passageRef}`}
            </p>

            {/* Sample word cards — in production, fetched from /lexicon/passage */}
            {[
              { greek: 'ποιμήν', translit: 'poimḗn', strongs: 'G4166', gloss: 'shepherd, pastor', count: '18×' },
              { greek: 'ψυχή',   translit: 'psychḗ', strongs: 'G5590', gloss: 'soul, life',       count: '105×' },
              { greek: 'καλός',  translit: 'kalós',  strongs: 'G2570', gloss: 'good, beautiful',  count: '101×' },
            ].map((word) => (
              <div key={word.strongs} style={{
                background:   'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                padding:      '9px 11px',
                marginBottom: 6,
              }}>
                <p style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize:   17,
                  margin:     '0 0 2px',
                  color:      'var(--color-text-primary)',
                }}>
                  {word.greek}
                </p>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-interactive)', margin: '0 0 2px' }}>
                  {word.translit} · {word.strongs}
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 2px' }}>
                  {word.gloss}
                </p>
                <p style={{ fontSize: 10, color: 'var(--color-text-hint)', margin: 0 }}>
                  {language === 'ES' ? 'Aparece' : 'Appears'} {word.count} {language === 'ES' ? 'en NT' : 'in NT'}
                </p>
              </div>
            ))}

            <a href={`/lexicon?ref=${encodeURIComponent(sermon.passageRef)}`}
              style={{ textDecoration: 'none' }}>
              <button className="workman-btn" style={{ width: '100%', justifyContent: 'center', fontSize: 11, marginTop: 4 }}>
                {language === 'ES' ? 'Abrir léxico completo ↗' : 'Open full lexicon ↗'}
              </button>
            </a>
          </div>
        )}

        {/* ── ILLUSTRATIONS TAB ── */}
        {activeTab === 'illustrations' && (
          <div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
              {language === 'ES'
                ? 'Temas sugeridos para este pasaje'
                : 'Suggested themes for this passage'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {['Sacrifice', 'Shepherd', 'Redemption', 'Voice', 'Protection'].map((tag) => (
                <span key={tag} className="workman-badge workman-badge-accent" style={{ fontSize: 10, cursor: 'pointer' }}>
                  {tag}
                </span>
              ))}
            </div>
            <a href={`/illustrations?tag=shepherd`} style={{ textDecoration: 'none' }}>
              <button className="workman-btn" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}>
                {language === 'ES' ? 'Ver ilustraciones ↗' : 'Browse illustrations ↗'}
              </button>
            </a>
          </div>
        )}

        {/* ── ASSISTANT TAB ── */}
        {activeTab === 'assistant' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Message history */}
            <div style={{
              flex:      1,
              overflowY: 'auto',
              marginBottom: 10,
              minHeight: 200,
            }}>
              {messages.length === 0 ? (
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  {language === 'ES'
                    ? `Pregunta sobre ${sermon.passageRef} — contexto histórico, palabras originales, referencias cruzadas…`
                    : `Ask about ${sermon.passageRef} — historical context, original words, cross-references…`}
                </p>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} style={{
                    marginBottom: 10,
                    padding:      '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    background:   msg.role === 'user'
                      ? 'var(--color-accent-muted)'
                      : 'var(--color-bg-secondary)',
                    alignSelf:    msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <p style={{
                      fontSize:   11,
                      color:      'var(--color-text-secondary)',
                      margin:     0,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </p>
                  </div>
                ))
              )}
              {aiLoading && (
                <p style={{ fontSize: 11, color: 'var(--color-text-hint)', fontStyle: 'italic' }}>
                  {language === 'ES' ? 'Buscando…' : 'Researching…'}
                </p>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAssistantQuery()
                  }
                }}
                placeholder={language === 'ES'
                  ? 'Pregunta sobre este pasaje…'
                  : 'Ask about this passage…'}
                rows={2}
                style={{
                  width:        '100%',
                  padding:      '8px 10px',
                  borderRadius: 6,
                  border:       '1px solid var(--color-border-default)',
                  background:   'var(--color-bg-primary)',
                  color:        'var(--color-text-primary)',
                  fontSize:     11,
                  fontFamily:   'var(--font-sans)',
                  resize:       'none',
                  outline:      'none',
                  boxSizing:    'border-box',
                }}
              />
              <button
                onClick={handleAssistantQuery}
                disabled={!query.trim() || aiLoading}
                style={{
                  padding:      '6px',
                  borderRadius: 6,
                  border:       '1px solid var(--color-accent)',
                  background:   'var(--color-accent)',
                  color:        'var(--color-accent-text)',
                  fontSize:     11,
                  fontWeight:   500,
                  fontFamily:   'var(--font-sans)',
                  cursor:       query.trim() && !aiLoading ? 'pointer' : 'not-allowed',
                  opacity:      query.trim() && !aiLoading ? 1 : 0.6,
                }}
              >
                {language === 'ES' ? 'Preguntar' : 'Ask'}
              </button>
              <p style={{ fontSize: 9, color: 'var(--color-text-hint)', margin: 0, fontStyle: 'italic', textAlign: 'center' }}>
                {language === 'ES'
                  ? 'Solo investigación. Workman no escribe sermones.'
                  : 'Research only. Workman does not write sermons.'}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

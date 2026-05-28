

import { useEffect, useState, useCallback, useMemo } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useLanguage } from '@/hooks/useLanguage'
import { invoke } from '@tauri-apps/api/core'

interface Illustration {
  id:          string
  title:       string
  body:        string
  source?:     string | null
  language:    string
  isCustom:    boolean
  isFavorited: boolean
  isOwn:       boolean
  tags:        { tag: string; category?: string | null }[]
}

interface IllustrationTag {
  tag:      string
  category?: string | null
}

export default function IllustrationsPage() {
  const { language } = useLanguage()
  const [illustrations, setIllustrations] = useState<Illustration[]>([])
  const [tags,          setTags]          = useState<IllustrationTag[]>([])
  const [search,        setSearch]        = useState('')
  const [activeTag,     setActiveTag]     = useState('')
  const [source,        setSource]        = useState('')
  const [loading,       setLoading]       = useState(true)
  const [expanded,      setExpanded]      = useState<string | null>(null)
  const [showAddForm,   setShowAddForm]   = useState(false)
  const [newTitle,      setNewTitle]      = useState('')
  const [newBody,       setNewBody]       = useState('')
  const [newSource,     setNewSource]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ language })
      if (search)    params.set('search', search)
      if (activeTag) params.set('tag', activeTag)
      if (source)    params.set('source', source)

      const [illRes, tagRes] = await Promise.all([
  invoke<Illustration[]>('get_illustrations', {
  language,
  search: search || undefined,
  tag: activeTag || undefined,
  source: source || undefined,
}),
  invoke<IllustrationTag[]>('get_tags'),
])
setIllustrations(illRes)
setTags(tagRes.slice(0, 50))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [language, search, activeTag, source])

  useEffect(() => { load() }, [load])

  async function handleFavorite(id: string) {
    try {
      await invoke('toggle_favorite', { id })
      setIllustrations((prev) =>
        prev.map((ill) => ill.id === id ? { ...ill, isFavorited: !ill.isFavorited } : ill)
      )
    } catch {}
  }

  async function handleAddIllustration() {
    if (!newTitle.trim() || !newBody.trim()) return
    try {
      await invoke('create_illustration', { input: {
        title:    newTitle,
        body:     newBody,
        source:   newSource || undefined,
        language: language as 'EN' | 'ES',
      }})
      setShowAddForm(false)
      setNewTitle('')
      setNewBody('')
      setNewSource('')
      load()
    } catch {}
  }

  const languageFilteredIllustrations = illustrations.filter(i => i.language === language)
const currentTags = languageFilteredIllustrations.flatMap(i => i.tags.map(t => t.tag))
const uniqueCurrentTags = [...new Set(currentTags)]
console.log('tags:', tags.length, 'illustrations:', illustrations.length, 'language:', language)
const themeTagsOnly = useMemo(() => 
  tags.filter((t) => {
    if (t.category !== 'theme') return false
    return illustrations.some(i => 
      i.language === language && i.tags.some(it => it.tag === t.tag)
    )
  }), [tags, illustrations, language])

  return (
    <AppLayout>
      <div style={{
        background:   'var(--color-bg-primary)',
        border:       '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow:     'hidden',
      }}>

        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '10px 16px',
          borderBottom:   '1px solid var(--color-border-subtle)',
        }}>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
            {language === 'ES' ? 'Ilustraciones' : 'Illustrations'}
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              fontSize:   12, padding: '5px 14px', borderRadius: 6,
              border:     '1px solid var(--color-accent)',
              background: 'var(--color-accent)', color: 'var(--color-accent-text)',
              cursor:     'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500,
            }}
          >
            + {language === 'ES' ? 'Añadir propia' : 'Add my own'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', minHeight: 520 }}>

          {/* Sidebar */}
          <div style={{ padding: '14px', borderRight: '1px solid var(--color-border-subtle)' }}>
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'ES' ? 'Buscar…' : 'Search…'}
              style={{ ...filterInputStyle, marginBottom: 14 }}
            />

            {[
              { label: language === 'ES' ? 'Fuente' : 'Source', items: [
                { value: '',       label: language === 'ES' ? 'Todas'     : 'All'     },
                { value: 'mine',   label: language === 'ES' ? 'Las mías'  : 'Mine'    },
                { value: 'curated',label: language === 'ES' ? 'Curadas'   : 'Curated' },
              ]},
            ].map((group) => (
              <div key={group.label} style={{ marginBottom: 14 }}>
                <p style={filterLabelStyle}>{group.label}</p>
                {group.items.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setSource(item.value)}
                    style={{
                      display:    'block', width: '100%', textAlign: 'left',
                      fontSize:   12, padding: '4px 8px', borderRadius: 6,
                      border:     'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      background: source === item.value ? 'var(--color-accent-muted)' : 'transparent',
                      color:      source === item.value ? 'var(--color-accent-text)'  : 'var(--color-text-secondary)',
                      fontWeight: source === item.value ? 500 : 400,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}

            <div>
              <p style={filterLabelStyle}>{language === 'ES' ? 'Tema' : 'Theme'}</p>
              <button
                onClick={() => setActiveTag('')}
                style={{
                  display:    'block', width: '100%', textAlign: 'left',
                  fontSize:   12, padding: '4px 8px', borderRadius: 6,
                  border:     'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  background: activeTag === '' ? 'var(--color-accent-muted)' : 'transparent',
                  color:      activeTag === '' ? 'var(--color-accent-text)'  : 'var(--color-text-secondary)',
                  fontWeight: activeTag === '' ? 500 : 400,
                  marginBottom: 2,
                }}
              >
                {language === 'ES' ? 'Todos' : 'All themes'}
              </button>
              {themeTagsOnly.map((t) => (
                <button
                  key={t.tag}
                  onClick={() => setActiveTag(activeTag === t.tag ? '' : t.tag)}
                  style={{
                    display:    'block', width: '100%', textAlign: 'left',
                    fontSize:   12, padding: '4px 8px', borderRadius: 6,
                    border:     'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    background: activeTag === t.tag ? 'var(--color-accent-muted)' : 'transparent',
                    color:      activeTag === t.tag ? 'var(--color-accent-text)'  : 'var(--color-text-secondary)',
                    fontWeight: activeTag === t.tag ? 500 : 400,
                    marginBottom: 2,
                    textTransform: 'capitalize',
                  }}
                >
                  {t.tag}
                </button>
              ))}
            </div>
          </div>

          {/* Main grid */}
          <div style={{ padding: '14px' }}>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
              {loading ? '…' : `${illustrations.length} ${language === 'ES' ? 'ilustraciones' : 'illustrations'}`}
              {activeTag ? ` · ${activeTag}` : ''}
            </p>

            {/* Add form */}
            {showAddForm && (
              <div style={{
                background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)',
                padding: '14px', marginBottom: 14,
                border: '1px solid var(--color-accent)',
              }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>
                  {language === 'ES' ? 'Nueva ilustración' : 'New illustration'}
                </p>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={language === 'ES' ? 'Título…' : 'Title…'}
                  style={{ ...filterInputStyle, marginBottom: 8 }} />
                <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)}
                  placeholder={language === 'ES' ? 'Escribe la ilustración aquí…' : 'Write the illustration here…'}
                  rows={4}
                  style={{ ...filterInputStyle, resize: 'vertical', marginBottom: 8 }} />
                <input type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)}
                  placeholder={language === 'ES' ? 'Fuente (opcional)' : 'Source (optional)'}
                  style={{ ...filterInputStyle, marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleAddIllustration} style={{
                    padding: '6px 16px', borderRadius: 6,
                    border: '1px solid var(--color-accent)', background: 'var(--color-accent)',
                    color: 'var(--color-accent-text)', fontSize: 12, fontFamily: 'var(--font-sans)',
                    cursor: 'pointer', fontWeight: 500,
                  }}>
                    {language === 'ES' ? 'Guardar' : 'Save'}
                  </button>
                  <button onClick={() => setShowAddForm(false)} className="workman-btn" style={{ fontSize: 12 }}>
                    {language === 'ES' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {language === 'ES' ? 'Cargando…' : 'Loading…'}
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {illustrations.map((ill) => (
                  <div
                    key={ill.id}
                    style={{
                      background:   'var(--color-bg-primary)',
                      border:       `1px solid var(--color-border-default)`,
                      borderLeft:   ill.isOwn ? `3px solid var(--color-accent)` : undefined,
                      borderRadius: 'var(--radius-lg)',
                      padding:      '12px 14px',
                      cursor:       'pointer',
                    }}
                    onClick={() => setExpanded(expanded === ill.id ? null : ill.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0, flex: 1 }}>
                        {ill.title}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFavorite(ill.id) }}
                        style={{
                          fontSize: 14, border: 'none', background: 'transparent',
                          color: ill.isFavorited ? 'var(--color-accent)' : 'var(--color-text-hint)',
                          cursor: 'pointer', padding: '0 0 0 6px',
                        }}
                      >
                        {ill.isFavorited ? '★' : '☆'}
                      </button>
                    </div>
                    <p style={{
                      fontSize:  11, color: 'var(--color-text-secondary)', margin: '0 0 8px',
                      lineHeight: 1.5,
                      overflow:  expanded === ill.id ? 'visible' : 'hidden',
                      display:   expanded === ill.id ? 'block' : '-webkit-box',
                      WebkitLineClamp: expanded === ill.id ? undefined : 3,
                      WebkitBoxOrient: 'vertical',
                    } as React.CSSProperties}>
                      {ill.body}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {ill.tags[0] && (
                        <span className="workman-badge workman-badge-accent" style={{ fontSize: 10 }}>
                          {ill.tags[0].tag}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--color-text-hint)' }}>
                        {ill.isOwn
                          ? (language === 'ES' ? 'Mía' : 'Mine')
                          : (language === 'ES' ? 'Curada' : 'Curated')}
                      </span>
                    </div>
                    {ill.source && expanded === ill.id && (
                      <p style={{ fontSize: 10, color: 'var(--color-text-hint)', margin: '6px 0 0', fontStyle: 'italic' }}>
                        {ill.source}
                      </p>
                    )}
                  </div>
                ))}
              </div>
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

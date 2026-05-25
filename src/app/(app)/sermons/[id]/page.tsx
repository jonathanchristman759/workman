// Workman — sermons/[id]/page.tsx
// apps/web/src/app/(app)/sermons/[id]/page.tsx
// Sermon editor — outline, manuscript, and notes modes with auto-save



import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useLanguage } from '@/hooks/useLanguage'
import { invoke } from '@tauri-apps/api/core'
import { OutlineEditor } from '@/components/editor/OutlineEditor'
import { ManuscriptEditor } from '@/components/editor/ManuscriptEditor'
import { NotesEditor } from '@/components/editor/NotesEditor'
import { EditorSidePanel } from '@/components/editor/EditorSidePanel'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type EditorMode = 'OUTLINE' | 'MANUSCRIPT' | 'NOTES'

export interface OutlinePoint {
  id:        string
  text:      string
  subpoints: string[]
  verseRef?: string
}

export interface Sermon {
  id:           string
  title:        string
  passageRef:   string
  book?:        string | null
  chapterStart?: number | null
  mode:         EditorMode
  outline_json?: string | null
  manuscript?:  string | null
  notes?:       string | null
  wordCount:    number
  status:       string
  deliveryDate?: string | null
  series?:      { id: string; title: string } | null
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function estimateMinutes(wordCount: number): number {
  return Math.round(wordCount / 130)
}

function formatDeliveryDate(dateStr: string, language: string): string {
  return new Date(dateStr).toLocaleDateString(
    language === 'ES' ? 'es-MX' : 'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' }
  )
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ─────────────────────────────────────────────
// SAVE STATUS INDICATOR
// ─────────────────────────────────────────────

type SaveStatus = 'saved' | 'saving' | 'unsaved'

function SaveIndicator({ status, language }: { status: SaveStatus; language: string }) {
  const labels: Record<SaveStatus, string> = {
    saved:   language === 'ES' ? 'Guardado'         : 'Saved',
    saving:  language === 'ES' ? 'Guardando…'       : 'Saving…',
    unsaved: language === 'ES' ? 'Cambios sin guardar' : 'Unsaved changes',
  }

  const colors: Record<SaveStatus, string> = {
    saved:   'var(--color-text-hint)',
    saving:  'var(--color-text-muted)',
    unsaved: 'var(--color-warning)',
  }

  return (
    <span style={{ fontSize: 11, color: colors[status] }}>
      {labels[status]}
    </span>
  )
}

// ─────────────────────────────────────────────
// MODE PILL
// ─────────────────────────────────────────────

function ModePill({
  mode, active, label, onClick,
}: {
  mode: EditorMode; active: boolean; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize:     11,
        padding:      '4px 12px',
        borderRadius: 'var(--radius-full)',
        border:       'none',
        background:   active ? 'var(--color-accent-muted)' : 'transparent',
        color:        active ? 'var(--color-accent-text)' : 'var(--color-text-muted)',
        fontWeight:   active ? 500 : 400,
        cursor:       'pointer',
        fontFamily:   'var(--font-sans)',
        transition:   'background 100ms ease',
      }}
    >
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────
// MAIN EDITOR PAGE
// ─────────────────────────────────────────────

export default function SermonEditorPage() {
  const params   = useParams()
  const router   = useNavigate()
  const { language } = useLanguage()
  const sermonId = params.id as string

  const [sermon,     setSermon]     = useState<Sermon | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [sidePanelTab, setSidePanelTab] = useState<'lexicon' | 'illustrations'>('lexicon')
const [previewMode, setPreviewMode] = useState(false)

  // Track unsaved content separately from the sermon object
  // to avoid unnecessary re-renders on every keystroke
  const pendingContent = useRef<Partial<Sermon>>({})
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── LOAD ──────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const data = await invoke<Sermon>('get_sermon', { id: sermonId })
setSermon(data)
      } catch {
        router('/sermons')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sermonId, router])

  // ── AUTO-SAVE ─────────────────────────────
  // Debounced — fires 3 seconds after the last edit

  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved')

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)

    autoSaveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        const updates = pendingContent.current
        if (Object.keys(updates).length === 0) {
          setSaveStatus('saved')
          return
        }

        // Recalculate word count from current content
        let wordCount = 0
        if (updates.manuscript) wordCount = countWords(updates.manuscript)
        else if (updates.notes)  wordCount = countWords(updates.notes)
        else if (updates.outline_json) {
          const pts = updates.outline_json ? JSON.parse(updates.outline_json).points ?? [] : []
          wordCount = pts.reduce((sum: number, p: OutlinePoint) => {
            return sum + countWords(p.text) +
              (p.subpoints ?? []).reduce((s: number, sp: string) => s + countWords(sp), 0)
          }, 0)
        }

        await invoke('update_sermon', {
  id: sermonId,
  input: {
    outline_json: updates.outline_json ? JSON.stringify(updates.outline_json) : undefined,
    manuscript:   updates.manuscript,
    notes:        updates.notes,
    word_count:   wordCount,
    autosave:     true,
  }
})

        // Sync word count back to the sermon state
        setSermon((prev) => prev ? { ...prev, ...updates, wordCount } : prev)
        pendingContent.current = {}
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    }, 5000)
  }, [sermonId])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [])

  // ── CONTENT CHANGE HANDLERS ───────────────

  function handleOutlineChange(points: OutlinePoint[]) {
    pendingContent.current = { ...pendingContent.current, outline_json: JSON.stringify({ points }) }
    scheduleSave()
  }

  function handleManuscriptChange(text: string) {
    pendingContent.current = { ...pendingContent.current, manuscript: text }
    scheduleSave()
  }

  function handleNotesChange(text: string) {
    pendingContent.current = { ...pendingContent.current, notes: text }
    scheduleSave()
  }

  // ── MODE SWITCH ───────────────────────────

  async function handleModeSwitch(mode: EditorMode) {
    if (!sermon || mode === sermon.mode) return
    try {
      await invoke('update_sermon', { id: sermonId, input: { mode } })
      setSermon((prev) => prev ? { ...prev, mode } : prev)
    } catch {
      // Silently ignore — mode change is low stakes
    }
  }

  // ── MARK DELIVERED ────────────────────────

  async function handleMarkDelivered() {
    try {
      await invoke('mark_delivered', { id: sermonId })
      setSermon((prev) => prev ? { ...prev, status: 'DELIVERED' } : prev)
    } catch (err) {
      console.error('Failed to mark delivered:', err)
    }
  }

  // ── EXPORT ────────────────────────────────

  async function handleExport() {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const outputPath = await save({
      title:       'Export sermon as PDF',
      defaultPath: `${(sermon?.title ?? 'sermon').replace(/[:\\/*?"<>|]/g, '-').replace(/–/g, '-')}.pdf`,
      filters:     [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!outputPath) return
    await invoke('export_sermon_pdf', { id: sermonId, outputPath })
    alert('PDF exported successfully.')
  } catch (err) {
    console.error('Export failed:', err)
    alert('Export failed. Check the console for details.')
  }
}

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading…</p>
      </AppLayout>
    )
  }

  if (!sermon) return null

  const modeLabels: Record<EditorMode, { en: string; es: string }> = {
    OUTLINE:    { en: 'Outline',    es: 'Esquema'   },
    MANUSCRIPT: { en: 'Manuscript', es: 'Manuscrito' },
    NOTES:      { en: 'Notes',      es: 'Notas'     },
  }

  return (
    <AppLayout>
      <div style={{
        background:   'var(--color-bg-primary)',
        border:       '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow:     'hidden',
      }}>

        {/* ── EDITOR NAV BAR ── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '10px 16px',
          borderBottom:   '1px solid var(--color-border-subtle)',
        }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Link to="/sermons" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
              {language === 'ES' ? 'Sermones' : 'Sermons'}
            </Link>
            <span style={{ color: 'var(--color-text-hint)' }}>›</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
              {sermon.title}
            </span>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SaveIndicator status={saveStatus} language={language} />

            <button className="workman-btn" onClick={handleExport} style={{ fontSize: 11, padding: '4px 10px' }}>
              {language === 'ES' ? 'Exportar' : 'Export'}
            </button>

            {sermon.status !== 'DELIVERED' && (
              <button
                onClick={handleMarkDelivered}
                style={{
                  fontSize:     11,
                  padding:      '4px 12px',
                  borderRadius: 6,
                  border:       '1px solid var(--color-accent)',
                  background:   'var(--color-accent)',
                  color:        'var(--color-accent-text)',
                  fontFamily:   'var(--font-sans)',
                  cursor:       'pointer',
                  fontWeight:   500,
                }}
              >
                {language === 'ES' ? '✓ Marcar predicado' : '✓ Mark delivered'}
              </button>
            )}

            {sermon.status === 'DELIVERED' && (
              <span className="workman-badge workman-badge-success">
                {language === 'ES' ? 'Predicado' : 'Delivered'}
              </span>
            )}
          </div>
        </div>

        {/* ── EDITOR BODY ── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 260px',
          minHeight:           580,
        }}>

          {/* ── MAIN WRITING AREA ── */}
          <div style={{
            padding:     '20px 24px',
            borderRight: '1px solid var(--color-border-subtle)',
            overflowY:   'auto',
            position:    'relative',
          }}>

            {/* Sermon header */}
            <div style={{ marginBottom: 16 }}>
              <h1 style={{
                fontSize:   20,
                fontWeight: 500,
                margin:     '0 0 4px',
                color:      'var(--color-text-primary)',
              }}>
                {sermon.title}
              </h1>
              <p style={{
                fontFamily: 'var(--font-serif)',
                fontStyle:  'italic',
                fontSize:   14,
                color:      'var(--color-text-secondary)',
                margin:     '0 0 8px',
              }}>
                {sermon.passageRef} · King James Version
              </p>

              {/* Meta row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="workman-badge workman-badge-success" style={{ fontSize: 10 }}>
                  {sermon.status === 'DELIVERED'
                    ? (language === 'ES' ? 'Predicado' : 'Delivered')
                    : (language === 'ES' ? 'En progreso' : 'In progress')}
                </span>

                {sermon.deliveryDate && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {language === 'ES' ? 'Predicación:' : 'Delivery:'}{' '}
                    {formatDeliveryDate(sermon.deliveryDate, language)}{' '}
                    · {daysUntil(sermon.deliveryDate)}{' '}
                    {language === 'ES' ? 'días' : 'days away'}
                  </span>
                )}

                {sermon.wordCount > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    ~{sermon.wordCount.toLocaleString()}{' '}
                    {language === 'ES' ? 'palabras' : 'words'}{' '}
                    · ~{estimateMinutes(sermon.wordCount)} min
                  </span>
                )}

                {sermon.series && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {language === 'ES' ? 'Serie:' : 'Series:'} {sermon.series.title}
                  </span>
                )}
              </div>
            </div>

            {/* Mode switcher */}
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          4,
              marginBottom: 12,
              padding:      '4px',
              background:   'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-full)',
              width:        'fit-content',
            }}>
              {(['OUTLINE', 'MANUSCRIPT', 'NOTES'] as EditorMode[]).map((mode) => (
                <ModePill
                  key={mode}
                  mode={mode}
                  active={sermon.mode === mode}
                  label={language === 'ES' ? modeLabels[mode].es : modeLabels[mode].en}
                  onClick={() => handleModeSwitch(mode)}
                />
              ))}
            </div>

{/* Preview toggle */}
            <button
              onClick={() => setPreviewMode(prev => !prev)}
              style={{
                position:   'absolute',
                top:        12,
                right:      12,
                padding:    '5px 12px',
                borderRadius: 6,
                border:     '1px solid var(--color-border-default)',
                background: previewMode ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                color:      previewMode ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
                fontSize:   12,
                fontFamily: 'var(--font-sans)',
                cursor:     'pointer',
              }}
            >
              {previewMode
                ? (language === 'ES' ? '✏ Editar' : '✏ Edit')
                : (language === 'ES' ? '👁 Vista previa' : '👁 Preview')}
            </button>

            {/* ── EDITOR CONTENT ── */}
            {previewMode ? (
              <div style={{
                padding:    '24px 32px',
                background: 'var(--color-bg-primary)',
                border:     '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                minHeight:  400,
                fontFamily: 'var(--font-serif)',
              }}>
                <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4, color: 'var(--color-text-primary)' }}>
                  {sermon.title}
                </h1>
                <p style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  {sermon.passageRef} · King James Version
                </p>
                <hr style={{ border: 'none', borderTop: '1px solid var(--color-accent)', marginBottom: 24 }} />
                {sermon.mode === 'OUTLINE' && sermon.outline_json && (
                  <div>
                    {JSON.parse(sermon.outline_json).points.map((point: any, i: number) => (
                      <div key={point.id} style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px', color: 'var(--color-text-primary)' }}>
                          {['I','II','III','IV','V','VI','VII','VIII','IX','X'][i]}. {point.text}
                          {point.verseRef && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>({point.verseRef})</span>}
                        </p>
                        {point.subpoints?.map((sub: string, j: number) => (
                          <p key={j} style={{ fontSize: 14, margin: '2px 0 2px 24px', color: 'var(--color-text-secondary)' }}>
                            {['a','b','c','d','e','f','g','h','i','j'][j]}. {sub}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {sermon.mode === 'MANUSCRIPT' && (
                  <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                    {sermon.manuscript}
                  </div>
                )}
                {sermon.mode === 'NOTES' && (
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                    {sermon.notes}
                  </div>
                )}
              </div>
            ) : (
              <>
                {sermon.mode === 'OUTLINE' && (
                  <OutlineEditor
                    points={sermon.outline_json ? JSON.parse(sermon.outline_json).points ?? [] : []}
                    onChange={handleOutlineChange}
                    language={language}
                  />
                )}
                {sermon.mode === 'MANUSCRIPT' && (
                  <ManuscriptEditor
                    content={sermon.manuscript ?? ''}
                    onChange={handleManuscriptChange}
                    language={language}
                    fontSize={16}
                  />
                )}
                {sermon.mode === 'NOTES' && (
                  <NotesEditor
                    content={sermon.notes ?? ''}
                    onChange={handleNotesChange}
                    language={language}
                  />
                )}
              </>
            )}
          </div>

          {/* ── SIDE PANEL ── */}
          <EditorSidePanel
            sermon={sermon}
            activeTab={sidePanelTab}
            onTabChange={setSidePanelTab}
            language={language}
          />

        </div>
      </div>
    </AppLayout>
  )
}

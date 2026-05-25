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
  outlineJson?: { points: OutlinePoint[] } | null
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

  // Track unsaved content separately from the sermon object
  // to avoid unnecessary re-renders on every keystroke
  const pendingContent = useRef<Partial<Sermon>>({})
  const autoSaveTimer  = useRef<NodeJS.Timeout | null>(null)

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
        else if (updates.outlineJson) {
          const pts = updates.outlineJson.points ?? []
          wordCount = pts.reduce((sum, p) => {
            return sum + countWords(p.text) +
              (p.subpoints ?? []).reduce((s: number, sp: string) => s + countWords(sp), 0)
          }, 0)
        }

        await invoke('update_sermon', {
  id: sermonId,
  input: {
    ...updates,
    wordCount,
    autosave: true,
  }
})

        // Sync word count back to the sermon state
        setSermon((prev) => prev ? { ...prev, ...updates, wordCount } : prev)
        pendingContent.current = {}
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    }, 3000)
  }, [sermonId])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [])

  // ── CONTENT CHANGE HANDLERS ───────────────

  function handleOutlineChange(points: OutlinePoint[]) {
    pendingContent.current = { ...pendingContent.current, outlineJson: { points } }
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

            {/* ── EDITOR CONTENT ── */}
            {sermon.mode === 'OUTLINE' && (
              <OutlineEditor
                points={sermon.outlineJson?.points ?? []}
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

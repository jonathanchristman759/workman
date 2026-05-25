import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { AppLayout } from '@/components/layout/AppLayout'
import { useLanguage } from '@/hooks/useLanguage'

interface ImportJob {
  id:              string
  status:          string
  total_files:     number
  completed_files: number
  started_at:      string
  completed_at?:   string | null
  items:           ImportItem[]
}

interface ImportItem {
  id:                string
  job_id:            string
  sermon_id?:        string | null
  original_filename: string
  file_format:       string
  extracted_text?:   string | null
  review_status:     'PENDING' | 'APPROVED' | 'SKIPPED'
  imported_at:       string
}

export default function ImportPage() {
  const { language } = useLanguage()
  const router       = useNavigate()

  const [job,         setJob]         = useState<ImportJob | null>(null)
  const [uploading,   setUploading]   = useState(false)
  const [activeItem,  setActiveItem]  = useState<ImportItem | null>(null)

  const [title,        setTitle]        = useState('')
  const [passageRef,   setPassageRef]   = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [saving,       setSaving]       = useState(false)

  async function handlePickFiles() {
    try {
      setUploading(true)
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Sermon files',
          extensions: ['docx', 'pdf', 'txt', 'rtf', 'zip'],
        }],
      })

      if (!selected) return
      const paths = Array.isArray(selected) ? selected : [selected]
      if (paths.length === 0) return

      const data = await invoke<ImportJob>('import_files', { filePaths: paths })
      setJob(data)

      const first = data.items.find((i) => i.review_status === 'PENDING')
      if (first) selectItem(first)
    } catch (err) {
      console.error('Import failed:', err)
    } finally {
      setUploading(false)
    }
  }

  function selectItem(item: ImportItem) {
    setActiveItem(item)
    setTitle('')
    setPassageRef('')
    setDeliveryDate('')
  }

  async function handleApprove() {
    if (!job || !activeItem || !passageRef.trim()) return
    setSaving(true)
    try {
      await invoke('approve_import_item', {
        jobId:  job.id,
        itemId: activeItem.id,
        input: {
          title:         title || passageRef,
          passage_ref:   passageRef,
          delivery_date: deliveryDate || undefined,
        },
      })

      const updated = job.items.map((i) =>
        i.id === activeItem.id ? { ...i, review_status: 'APPROVED' as const } : i
      )
      const updatedJob = { ...job, items: updated, completed_files: job.completed_files + 1 }
      setJob(updatedJob)

      const next = updated.find((i) => i.review_status === 'PENDING')
      if (next) selectItem(next)
      else setActiveItem(null)
    } catch (err) {
      console.error('Approve failed:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    if (!job || !activeItem) return
    try {
      await invoke('skip_import_item', {
        jobId:  job.id,
        itemId: activeItem.id,
      })
      const updated = job.items.map((i) =>
        i.id === activeItem.id ? { ...i, review_status: 'SKIPPED' as const } : i
      )
      const updatedJob = { ...job, items: updated, completed_files: job.completed_files + 1 }
      setJob(updatedJob)
      const next = updated.find((i) => i.review_status === 'PENDING')
      if (next) selectItem(next)
      else setActiveItem(null)
    } catch (err) {
      console.error('Skip failed:', err)
    }
  }

  const pending  = job?.items.filter((i) => i.review_status === 'PENDING').length  ?? 0
  const approved = job?.items.filter((i) => i.review_status === 'APPROVED').length ?? 0
  const skipped  = job?.items.filter((i) => i.review_status === 'SKIPPED').length  ?? 0

  const steps = [
    { n: 1, label: language === 'ES' ? 'Subir archivos' : 'Upload files',   done: !!job },
    { n: 2, label: language === 'ES' ? 'Revisar cola'   : 'Review queue',   done: !!job && pending === 0 },
    { n: 3, label: language === 'ES' ? 'Confirmar'      : 'Confirm import', done: false },
  ]

  return (
    <AppLayout>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
            {language === 'ES' ? 'Importar sermones' : 'Import sermons'}
          </h1>
          <button onClick={() => router('/archive')} className="workman-btn" style={{ fontSize: 12 }}>
            {language === 'ES' ? 'Cancelar' : 'Cancel'}
          </button>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          {steps.map((step, i) => (
            <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 500,
                  background: step.done ? 'var(--color-success-muted)' : 'var(--color-bg-secondary)',
                  color:      step.done ? 'var(--color-success)'       : 'var(--color-text-muted)',
                }}>
                  {step.done ? '✓' : step.n}
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 1, background: 'var(--color-border-default)' }} />
              )}
            </div>
          ))}
        </div>

        {!job ? (
          /* Upload zone */
          <div
            onClick={handlePickFiles}
            style={{
              border: '2px dashed var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
              background: 'var(--color-bg-primary)',
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
              {uploading
                ? (language === 'ES' ? 'Importando archivos…' : 'Importing files…')
                : (language === 'ES' ? 'Haz clic para seleccionar archivos' : 'Click to select files')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
              {language === 'ES'
                ? 'Se aceptan .docx, .pdf, .txt, .rtf y .zip'
                : 'Accepts .docx, .pdf, .txt, .rtf, and .zip'}
            </p>
          </div>
        ) : (
          /* Review queue */
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16 }}>

            {/* File list */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>
                {job.total_files} {language === 'ES' ? 'archivos' : 'files'} ·{' '}
                <span style={{ color: 'var(--color-warning)' }}>{pending} {language === 'ES' ? 'pendientes' : 'pending'}</span> ·{' '}
                <span style={{ color: 'var(--color-success)' }}>{approved} {language === 'ES' ? 'aprobados' : 'approved'}</span>
                {skipped > 0 && ` · ${skipped} ${language === 'ES' ? 'omitidos' : 'skipped'}`}
              </p>

              {job.items.map((item) => {
                const statusColors = {
                  PENDING:  { bg: 'var(--color-warning-muted)', text: 'var(--color-warning)' },
                  APPROVED: { bg: 'var(--color-success-muted)', text: 'var(--color-success)' },
                  SKIPPED:  { bg: 'var(--color-bg-secondary)',  text: 'var(--color-text-muted)' },
                }
                const sc = statusColors[item.review_status]
                return (
                  <div
                    key={item.id}
                    onClick={() => item.review_status === 'PENDING' && selectItem(item)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px',
                      background:   activeItem?.id === item.id ? 'var(--color-accent-muted)' : 'var(--color-bg-primary)',
                      border:       `1px solid ${activeItem?.id === item.id ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                      borderRadius: 'var(--radius-md)', marginBottom: 5,
                      cursor: item.review_status === 'PENDING' ? 'pointer' : 'default',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                        {item.original_filename}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '1px 0 0' }}>
                        .{item.file_format}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                      background: sc.bg, color: sc.text, fontWeight: 500,
                    }}>
                      {item.review_status === 'PENDING'  ? (language === 'ES' ? 'Pendiente' : 'Pending')  :
                       item.review_status === 'APPROVED' ? (language === 'ES' ? 'Aprobado'  : 'Approved') :
                                                           (language === 'ES' ? 'Omitido'   : 'Skipped'  )}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Metadata panel */}
            <div>
              {activeItem ? (
                <div className="workman-card">
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
                    {language === 'ES' ? 'Completar metadatos' : 'Fill in metadata'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
                    {activeItem.original_filename}
                  </p>

                  {[
                    { label: language === 'ES' ? 'Pasaje *' : 'Passage *', value: passageRef, setter: setPassageRef, placeholder: 'e.g. John 10:1–18' },
                    { label: language === 'ES' ? 'Título'   : 'Title',     value: title,      setter: setTitle,      placeholder: 'e.g. The Good Shepherd' },
                  ].map((field) => (
                    <div key={field.label} style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                        {field.label}
                      </label>
                      <input
                        type="text" value={field.value}
                        onChange={(e) => field.setter(e.target.value)}
                        placeholder={field.placeholder}
                        style={{
                          width: '100%', padding: '7px 10px',
                          border: '1px solid var(--color-border-default)',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--color-bg-primary)',
                          color: 'var(--color-text-primary)',
                          fontSize: 12, fontFamily: 'var(--font-sans)',
                          outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ))}

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
                      {language === 'ES' ? 'Fecha predicado' : 'Date preached'}
                    </label>
                    <input
                      type="date" value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      style={{
                        width: '100%', padding: '7px 10px',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        fontSize: 12, fontFamily: 'var(--font-sans)',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {activeItem.extracted_text && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 5px' }}>
                        {language === 'ES' ? 'Vista previa' : 'Text preview'}
                      </p>
                      <div style={{
                        background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
                        padding: '8px', fontSize: 11, color: 'var(--color-text-secondary)',
                        lineHeight: 1.5, maxHeight: 80, overflow: 'hidden',
                      }}>
                        {activeItem.extracted_text.substring(0, 200)}…
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={handleApprove}
                      disabled={!passageRef.trim() || saving}
                      style={{
                        flex: 1, padding: '7px', borderRadius: 6,
                        border: '1px solid var(--color-accent)', background: 'var(--color-accent)',
                        color: 'var(--color-accent-text)', fontSize: 12, fontFamily: 'var(--font-sans)',
                        cursor: passageRef.trim() && !saving ? 'pointer' : 'not-allowed',
                        opacity: passageRef.trim() && !saving ? 1 : 0.6, fontWeight: 500,
                      }}
                    >
                      {saving ? '…' : (language === 'ES' ? 'Aprobar' : 'Approve')}
                    </button>
                    <button onClick={handleSkip} className="workman-btn" style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}>
                      {language === 'ES' ? 'Omitir' : 'Skip'}
                    </button>
                  </div>
                </div>
              ) : pending === 0 ? (
                <div className="workman-card" style={{ textAlign: 'center', padding: '24px' }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-success)', margin: '0 0 8px' }}>
                    {language === 'ES' ? '✓ Revisión completa' : '✓ Review complete'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
                    {approved} {language === 'ES' ? 'sermones añadidos al archivo.' : 'sermons added to your archive.'}
                  </p>
                  <button
                    onClick={() => router('/archive')}
                    style={{
                      padding: '7px 20px', borderRadius: 6,
                      border: '1px solid var(--color-accent)', background: 'var(--color-accent)',
                      color: 'var(--color-accent-text)', fontSize: 13, fontFamily: 'var(--font-sans)',
                      cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    {language === 'ES' ? 'Ver archivo →' : 'View archive →'}
                  </button>
                </div>
              ) : null}

              <div style={{
                background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
                padding: '10px 12px', marginTop: 10,
              }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                  ℹ {language === 'ES' ? 'Nada se guarda aún' : 'Nothing is saved yet'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>
                  {language === 'ES'
                    ? 'Los sermones solo entran al archivo después de que los apruebes.'
                    : 'Sermons only enter your archive after you approve them.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

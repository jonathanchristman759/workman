import { useState, useEffect, useRef } from 'react'

interface NotesEditorProps {
  content:  string
  onChange: (text: string) => void
  language: string
}

export function NotesEditor({ content: initialContent, onChange, language }: NotesEditorProps) {
  const [content, setContent] = useState(initialContent)
  const onChangeRef = useRef(onChange)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Only sync from parent on first mount
  useEffect(() => {
    if (!initialized.current) {
      setContent(initialContent)
      initialized.current = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(value: string) {
    setContent(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChangeRef.current(value)
    }, 800)
  }

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: '0 0 8px' }}>
        {language === 'ES'
          ? 'Notas libres — sin estructura requerida'
          : 'Freeform notes — no structure required'}
      </p>
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={language === 'ES'
          ? 'Escribe tus notas aquí…'
          : 'Write your notes here…'}
        rows={20}
        style={{
          width:        '100%',
          padding:      '10px 12px',
          border:       '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
          background:   'var(--color-bg-primary)',
          color:        'var(--color-text-primary)',
          fontSize:     14,
          fontFamily:   'var(--font-sans)',
          lineHeight:   1.7,
          resize:       'vertical',
          outline:      'none',
          boxSizing:    'border-box',
        }}
      />
    </div>
  )
}

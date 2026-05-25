interface NotesEditorProps {
  content:  string
  onChange: (text: string) => void
  language: string
}

export function NotesEditor({ content, onChange, language }: NotesEditorProps) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: '0 0 8px' }}>
        {language === 'ES'
          ? 'Notas libres — sin estructura requerida'
          : 'Freeform notes — no structure required'}
      </p>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={language === 'ES'
          ? 'Escribe tus notas aquí…'
          : 'Write your notes here…'}
        style={{
          width:      '100%',
          minHeight:  440,
          border:     'none',
          background: 'transparent',
          fontSize:   14,
          lineHeight: 1.8,
          color:      'var(--color-text-primary)',
          fontFamily: 'var(--font-sans)',
          outline:    'none',
          resize:     'none',
          padding:    0,
          boxSizing:  'border-box',
        }}
      />
    </div>
  )
}

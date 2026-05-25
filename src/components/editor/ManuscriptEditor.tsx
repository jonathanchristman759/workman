import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect as useEffectManuscript } from 'react'

interface ManuscriptEditorProps {
  content:  string
  onChange: (text: string) => void
  language: string
  fontSize: number
}

export function ManuscriptEditor({
  content, onChange, language, fontSize
}: ManuscriptEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getText())
    },
    editorProps: {
      attributes: {
        style: [
          `font-size: ${fontSize}px`,
          'line-height: 1.8',
          'color: var(--color-text-primary)',
          'font-family: var(--font-sans)',
          'outline: none',
          'min-height: 400px',
        ].join(';'),
      },
    },
  })

  // Sync external content changes (e.g. version restore)
  useEffectManuscript(() => {
    if (editor && content !== editor.getText()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display:      'flex',
        gap:          2,
        padding:      '6px 0',
        borderBottom: '1px solid var(--color-border-subtle)',
        marginBottom: 14,
        flexWrap:     'wrap',
      }}>
        {[
          { label: 'B',  title: 'Bold',      cmd: () => editor?.chain().focus().toggleBold().run(),      active: () => editor?.isActive('bold')      },
          { label: 'I',  title: 'Italic',    cmd: () => editor?.chain().focus().toggleItalic().run(),    active: () => editor?.isActive('italic')    },
          { label: 'H2', title: 'Heading',   cmd: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: () => editor?.isActive('heading') },
          { label: '¶',  title: 'Paragraph', cmd: () => editor?.chain().focus().setParagraph().run(),   active: () => false },
        ].map(({ label, title, cmd, active }) => (
          <button
            key={label}
            title={title}
            onClick={cmd}
            style={{
              fontSize:     12,
              padding:      '3px 8px',
              borderRadius: 4,
              border:       'none',
              background:   active?.() ? 'var(--color-bg-secondary)' : 'transparent',
              color:        active?.() ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              cursor:       'pointer',
              fontFamily:   label === 'B' ? 'var(--font-sans)' : 'var(--font-sans)',
              fontWeight:   label === 'B' ? 700 : 400,
              fontStyle:    label === 'I' ? 'italic' : 'normal',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}

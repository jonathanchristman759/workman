import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import { useEffect, useRef, useState } from 'react'
import { OutlinePoint } from '@/app/(app)/sermons/[id]/page'
import Highlight from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { IndentExtension } from '@/components/editor/IndentExtension'

interface ToolbarButtonProps {
  onClick:   () => void
  active?:   boolean
  disabled?: boolean
  title:     string
  children:  React.ReactNode
  wide?:     boolean
}

function ToolbarButton({ onClick, active, disabled, title, children, wide }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding:        wide ? '4px 8px' : '4px 7px',
        borderRadius:   4,
        border:         active ? '1px solid var(--color-accent)' : '1px solid var(--color-border-default)',
        background:     active ? 'var(--color-accent-muted)' : 'var(--color-bg-secondary)',
        color:          active ? 'var(--color-accent)' : disabled ? 'var(--color-text-hint)' : 'var(--color-text-secondary)',
        fontSize:       12,
        fontFamily:     'var(--font-sans)',
        cursor:         disabled ? 'not-allowed' : 'pointer',
        opacity:        disabled ? 0.5 : 1,
        lineHeight:     1,
        minWidth:       wide ? undefined : 26,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <div style={{
      width: 1, height: 22,
      background: 'var(--color-border-default)',
      margin: '0 2px', alignSelf: 'center',
    }} />
  )
}

interface ManuscriptEditorProps {
  content:          string
  onChange:         (html: string) => void
  language:         string
  fontSize:         number
  onWordCount?:     (count: number) => void
  showEditorHints?: boolean
}

export function ManuscriptEditor({
  content, onChange, language, fontSize, onWordCount, showEditorHints = true,
}: ManuscriptEditorProps) {
  const onChangeRef = useRef(onChange)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)
  const [hintVisible, setHintVisible] = useState(showEditorHints)

useEffect(() => {
  setHintVisible(showEditorHints)
}, [showEditorHints])
  const [toast, setToast] = useState(false)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const editor = useEditor({
    extensions: [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, strike: {} }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Typography,
  Highlight.configure({ multicolor: true }),
  Color,
  TextStyle,
  IndentExtension,
],
    content,
    onUpdate: ({ editor }) => {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  const text = editor.getText()
  const count = text.trim().split(/\s+/).filter(Boolean).length
  onWordCount?.(count)
  debounceRef.current = setTimeout(() => {
    onChangeRef.current(editor.getHTML())
  }, 800)
},
    editorProps: {
  attributes: {
    style: `font-size: ${fontSize}px; line-height: 1.8; min-height: 400px; outline: none; padding: 4px 0;`,
    'data-placeholder': language === 'ES' ? 'Comienza a escribir tu manuscrito…' : 'Start writing your sermon manuscript…',
    spellcheck: 'true',
  },
},
  })

  useEffect(() => {
    if (!initialized.current && editor && content) {
      editor.commands.setContent(content)
      initialized.current = true
    }
  }, [editor])

  function dismissHint() {
    setHintVisible(false)
    setToast(true)
    setTimeout(() => setToast(false), 4000)
  }

  if (!editor) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Hint bar */}
      {hintVisible && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '7px 10px',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
          fontSize: 11, color: 'var(--color-text-muted)',
          marginBottom: -1,
        }}>
          <span>
            {language === 'ES'
              ? '💡 H2 = punto principal · H3 = sub-punto · las referencias de versículo se sincronizan con el esquema'
              : '💡 H2 = main point · H3 = subpoint · verse refs sync to outline'}
          </span>
          <button
            onClick={dismissHint}
            title={language === 'ES' ? 'Cerrar' : 'Dismiss'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: 'var(--color-text-hint)',
              padding: '0 4px', lineHeight: 1, marginLeft: 8,
            }}
          >×</button>
        </div>
      )}

      <EditorToolbar editor={editor} topRadius={!hintVisible} />

      {/* Editor area */}
      <div style={{
        border: '1px solid var(--color-border-subtle)',
        borderTop: 'none',
        borderRadius: '0 0 var(--radius-md) var(--radius-md)',
        background: 'var(--color-bg-primary)',
        padding: '16px 20px',
        minHeight: 400,
      }}>
        <style>{`
          .tiptap p { margin: 0 0 0.75em; }
          .tiptap h1 { font-size: 1.6em; font-weight: 600; margin: 1em 0 0.5em; font-family: var(--font-serif); }
          .tiptap h2 { font-size: 1.3em; font-weight: 600; margin: 1em 0 0.4em; font-family: var(--font-serif); }
          .tiptap h3 { font-size: 1.1em; font-weight: 600; margin: 0.8em 0 0.3em; }
          .tiptap ul { padding-left: 1.4em; margin: 0 0 0.75em; }
          .tiptap ol { padding-left: 1.4em; margin: 0 0 0.75em; }
          .tiptap li { margin-bottom: 0.25em; }
          .tiptap blockquote {
            border-left: 3px solid var(--color-accent);
            padding-left: 1em; margin: 0.75em 0;
            color: var(--color-text-secondary);
            font-style: italic; font-family: var(--font-serif);
          }
          .tiptap p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--color-text-hint);
            pointer-events: none;
            height: 0;
          }
          .tiptap hr { border: none; border-top: 1px solid var(--color-border-default); margin: 1em 0; }
        `}</style>
        <EditorContent editor={editor} />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 16px',
          fontSize: 12, color: 'var(--color-text-secondary)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 500,
          whiteSpace: 'nowrap',
        }}>
          {language === 'ES'
            ? 'Las sugerencias se pueden ocultar permanentemente en Configuración → Apariencia'
            : 'Hints can be permanently hidden in Settings → Appearance'}
        </div>
      )}
    </div>
  )
}
import { useState, useRef, useEffect } from 'react'
import { useEditor } from '@tiptap/react'

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

const HIGHLIGHT_COLORS = [
  { color: '#FFF176', label: 'Yellow' },
  { color: '#B9F6CA', label: 'Green' },
  { color: '#F8BBD0', label: 'Pink' },
  { color: '#BBDEFB', label: 'Blue' },
  { color: '#FFE0B2', label: 'Orange' },
  { color: '#E1BEE7', label: 'Purple' },
]

const TEXT_COLORS = [
  { color: 'inherit', label: 'Default' },
  { color: '#212121', label: 'Black' },
  { color: '#B71C1C', label: 'Red' },
  { color: '#E65100', label: 'Orange' },
  { color: '#1565C0', label: 'Blue' },
  { color: '#1B5E20', label: 'Green' },
  { color: '#4A148C', label: 'Purple' },
  { color: '#795548', label: 'Brown' },
]

const ALIGN_OPTIONS = [
  { value: 'left',    label: 'Align left',    icon: '≡' },
  { value: 'center',  label: 'Align center',  icon: '☰' },
  { value: 'right',   label: 'Align right',   icon: '≣' },
  { value: 'justify', label: 'Justify',       icon: '⊟' },
]

interface ColorPickerProps {
  colors: { color: string; label: string }[]
  onSelect: (color: string) => void
  onClose: () => void
  showNone?: boolean
  onNone?: () => void
}

function ColorPicker({ colors, onSelect, onClose, showNone, onNone }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 200, top: '100%', left: 0, marginTop: 4,
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-default)',
      borderRadius: 'var(--radius-md)',
      padding: 8,
      display: 'flex', flexWrap: 'wrap', gap: 4, width: 140,
    }}>
      {colors.map((c) => (
        <button
          key={c.color}
          title={c.label}
          onClick={() => { onSelect(c.color); onClose() }}
          style={{
            width: 22, height: 22, borderRadius: 4,
            background: c.color === 'inherit' ? 'var(--color-bg-secondary)' : c.color,
            border: '1px solid var(--color-border-default)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: 'var(--color-text-muted)',
          }}
        >
          {c.color === 'inherit' ? 'A' : ''}
        </button>
      ))}
      {showNone && (
        <button
          title="Remove highlight"
          onClick={() => { onNone?.(); onClose() }}
          style={{
            width: 22, height: 22, borderRadius: 4,
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-default)',
            cursor: 'pointer', fontSize: 9,
            color: 'var(--color-text-muted)',
          }}
        >✕</button>
      )}
    </div>
  )
}

interface AlignDropdownProps {
  editor: ReturnType<typeof useEditor>
  onClose: () => void
}

function AlignDropdown({ editor, onClose }: AlignDropdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!editor) return null

  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 200, top: '100%', left: 0, marginTop: 4,
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-default)',
      borderRadius: 'var(--radius-md)',
      padding: 4, minWidth: 140,
    }}>
      {ALIGN_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => {
            editor.chain().focus().setTextAlign(opt.value).run()
            onClose()
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '6px 10px',
            background: editor.isActive({ textAlign: opt.value }) ? 'var(--color-accent-muted)' : 'transparent',
            color: editor.isActive({ textAlign: opt.value }) ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            border: 'none', borderRadius: 4,
            fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 14 }}>{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

interface EditorToolbarProps {
  editor:  ReturnType<typeof useEditor>
  minimal?: boolean
  topRadius?: boolean
}

export function EditorToolbar({ editor, minimal, topRadius = true }: EditorToolbarProps) {
  const [showHighlight, setShowHighlight] = useState(false)
  const [showTextColor, setShowTextColor] = useState(false)
  const [showAlign,     setShowAlign]     = useState(false)

  if (!editor) return null

  const currentAlign = ALIGN_OPTIONS.find(a => editor.isActive({ textAlign: a.value }))

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 3,
      padding: '6px 8px',
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: topRadius ? 'var(--radius-md) var(--radius-md) 0 0' : '0',
      alignItems: 'center',
      position: 'relative',
    }}>

      {/* Undo / Redo */}
      {!minimal && (
        <>
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">↩</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">↪</ToolbarButton>
          <Divider />
        </>
      )}

      {/* Headings */}
      {!minimal && (
        <>
          <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Normal" wide>¶ Normal</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1" wide>H1</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2 — main point" wide>H2</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3 — subpoint" wide>H3</ToolbarButton>
          <Divider />
        </>
      )}

      {/* Text formatting */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><strong>B</strong></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><span style={{ textDecoration: 'underline' }}>U</span></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strike"><span style={{ textDecoration: 'line-through' }}>S</span></ToolbarButton>

      <Divider />

      {/* Highlight */}
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          onClick={() => { setShowHighlight(p => !p); setShowTextColor(false); setShowAlign(false) }}
          active={editor.isActive('highlight')}
          title="Highlight"
        >
          <span style={{ borderBottom: '3px solid #FFF176', lineHeight: 1 }}>H</span>
        </ToolbarButton>
        {showHighlight && (
          <ColorPicker
            colors={HIGHLIGHT_COLORS}
            onSelect={(color) => editor.chain().focus().setHighlight({ color }).run()}
            onClose={() => setShowHighlight(false)}
            showNone
            onNone={() => editor.chain().focus().unsetHighlight().run()}
          />
        )}
      </div>

      {/* Text color */}
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          onClick={() => { setShowTextColor(p => !p); setShowHighlight(false); setShowAlign(false) }}
          title="Text color"
        >
          <span style={{ borderBottom: '3px solid var(--color-accent)', lineHeight: 1 }}>A</span>
        </ToolbarButton>
        {showTextColor && (
          <ColorPicker
            colors={TEXT_COLORS}
            onSelect={(color) => {
              if (color === 'inherit') {
                editor.chain().focus().unsetColor().run()
              } else {
                editor.chain().focus().setColor(color).run()
              }
            }}
            onClose={() => setShowTextColor(false)}
          />
        )}
      </div>

      <Divider />

      {/* Alignment dropdown */}
      {!minimal && (
        <>
          <div style={{ position: 'relative' }}>
            <ToolbarButton
              onClick={() => { setShowAlign(p => !p); setShowHighlight(false); setShowTextColor(false) }}
              active={showAlign}
              title="Text alignment"
              wide
            >
              {currentAlign?.icon ?? '≡'} ▾
            </ToolbarButton>
            {showAlign && <AlignDropdown editor={editor} onClose={() => setShowAlign(false)} />}
          </div>
          <Divider />
        </>
      )}

      {/* Indent */}
      {!minimal && (
        <>
          <ToolbarButton
  onClick={() => {
  if (editor.isActive('listItem')) {
    editor.chain().focus().sinkListItem('listItem').run()
  } else {
    editor.commands.indent()
  }
}}
  title="Increase indent"
>⇥</ToolbarButton>
<ToolbarButton
  onClick={() => {
  if (editor.isActive('listItem')) {
    editor.chain().focus().liftListItem('listItem').run()
  } else {
    editor.commands.outdent()
  }
}}
  title="Decrease indent"
>⇤</ToolbarButton>
          <Divider />
        </>
      )}

      {/* Lists */}
      {!minimal && (
        <>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">•≡</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1≡</ToolbarButton>
          <Divider />
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">"</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Rule">—</ToolbarButton>
          <Divider />
        </>
      )}

      {/* Clear formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Clear formatting"
      >
        <span style={{ fontSize: 11 }}>✕</span>
      </ToolbarButton>

    </div>
  )
}
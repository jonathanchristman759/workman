import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent:  () => ReturnType
      outdent: () => ReturnType
    }
  }
}

const MAX_INDENT = 7
const INDENT_SIZE = 24

export const IndentExtension = Extension.create({
  name: 'indent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const ml = el.style.marginLeft
              if (!ml) return 0
              return Math.round(parseInt(ml) / INDENT_SIZE)
            },
            renderHTML: (attrs) => {
              if (!attrs.indent || attrs.indent === 0) return {}
              return { style: `margin-left: ${attrs.indent * INDENT_SIZE}px` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      indent: () => ({ tr, state, dispatch }) => {
        const { selection } = state
        const { from, to } = selection

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === 'paragraph' || node.type.name === 'heading') {
            const current = node.attrs.indent ?? 0
            if (current < MAX_INDENT) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: current + 1,
                })
              }
            }
          }
        })

        if (dispatch) dispatch(tr)
        return true
      },

      outdent: () => ({ tr, state, dispatch }) => {
        const { selection } = state
        const { from, to } = selection

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === 'paragraph' || node.type.name === 'heading') {
            const current = node.attrs.indent ?? 0
            if (current > 0) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: current - 1,
                })
              }
            }
          }
        })

        if (dispatch) dispatch(tr)
        return true
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Tab': () => {
        if (this.editor.isActive('listItem')) {
          return this.editor.chain().focus().sinkListItem('listItem').run()
        }
        return this.editor.commands.indent()
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('listItem')) {
          return this.editor.chain().focus().liftListItem('listItem').run()
        }
        return this.editor.commands.outdent()
      },
    }
  },
})
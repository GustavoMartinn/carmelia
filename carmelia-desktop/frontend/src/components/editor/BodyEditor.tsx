import { useEffect, useRef } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import { useAppStore } from '../../store/appStore'

export function BodyEditor() {
  const parsed = useAppStore((s) => s.parsed)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const body = parsed?.body || ''

    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const state = EditorState.create({
      doc: body,
      extensions: [
        basicSetup,
        json(),
        oneDark,
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { backgroundColor: '#111827' },
          '.cm-gutters': { backgroundColor: '#0a0f1a', borderRight: '1px solid #374151' },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newBody = update.state.doc.toString()
            rebuildContent(newBody)
          }
        }),
      ],
    })

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [parsed?.body])

  return (
    <div ref={containerRef} className="h-full overflow-hidden" />
  )
}

function rebuildContent(newBody: string) {
  const state = useAppStore.getState()
  const parsed = state.parsed
  if (!parsed) return

  const lines: string[] = []

  // Comments
  for (const comment of parsed.comments) {
    lines.push(`# ${comment}`)
  }

  // Blank line after comments
  if (parsed.comments.length > 0) {
    lines.push('')
  }

  // Request line
  lines.push(`${parsed.method} ${parsed.url}`)

  // Headers
  for (const [key, value] of Object.entries(parsed.headers)) {
    lines.push(`${key}: ${value}`)
  }

  // Body
  if (newBody) {
    lines.push('')
    lines.push(newBody)
  }

  state.setRawContent(lines.join('\n'))
}

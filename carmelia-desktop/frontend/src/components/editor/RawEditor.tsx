import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import { useAppStore } from '../../store/appStore'
import { ParseRequest } from '../../../wailsjs/go/main/App'

export function RawEditor() {
  const rawContent = useAppStore((s) => s.rawContent)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const state = EditorState.create({
      doc: rawContent,
      extensions: [
        basicSetup,
        oneDark,
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { backgroundColor: '#111827' },
          '.cm-gutters': { backgroundColor: '#0a0f1a', borderRight: '1px solid #374151' },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString()
            useAppStore.getState().setRawContent(newContent)
            // Re-parse on change
            ParseRequest(newContent).then((parsed) => {
              useAppStore.getState().setParsed(parsed)
            }).catch(() => {})
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
  }, [rawContent])

  return (
    <div ref={containerRef} className="h-full overflow-hidden" />
  )
}

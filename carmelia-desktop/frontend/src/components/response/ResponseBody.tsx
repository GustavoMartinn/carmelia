import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import { useAppStore } from '../../store/appStore'

export function ResponseBody() {
  const result = useAppStore((s) => s.response)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const body = result?.response?.body || ''

  // Try to format JSON
  let displayBody = body
  try {
    const parsed = JSON.parse(body)
    displayBody = JSON.stringify(parsed, null, 2)
  } catch {
    // not JSON, show as-is
  }

  useEffect(() => {
    if (!containerRef.current) return

    if (viewRef.current) {
      viewRef.current.destroy()
    }

    if (!displayBody) {
      viewRef.current = null
      return
    }

    const state = EditorState.create({
      doc: displayBody,
      extensions: [
        basicSetup,
        json(),
        oneDark,
        EditorView.lineWrapping,
        EditorState.readOnly.of(true),
        EditorView.theme({
          '&': { backgroundColor: '#111827' },
          '.cm-gutters': { backgroundColor: '#0a0f1a', borderRight: '1px solid #374151' },
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
  }, [displayBody])

  if (!body) {
    return (
      <div className="p-4 text-sm text-gray-500">No response body</div>
    )
  }

  return <div ref={containerRef} className="h-full overflow-hidden" />
}

import { useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { syntaxHighlighting } from '@codemirror/language'
import { basicSetup } from 'codemirror'
import { useAppStore } from '../../store/appStore'

export function ResponseBody() {
  const result = useAppStore((s) => s.response)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview')

  const body = result?.response?.body || ''
  const contentType = result?.response?.headers?.['Content-Type'] || ''
  const isHtml = contentType.includes('text/html')

  // Try to format JSON
  let displayBody = body
  if (!isHtml) {
    try {
      const parsed = JSON.parse(body)
      displayBody = JSON.stringify(parsed, null, 2)
    } catch {
      // not JSON, show as-is
    }
  }

  const showCodeMirror = !isHtml || viewMode === 'source'

  useEffect(() => {
    if (!showCodeMirror) {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
      return
    }

    if (!containerRef.current) return

    if (viewRef.current) {
      viewRef.current.destroy()
    }

    if (!displayBody) {
      viewRef.current = null
      return
    }

    const langExtension = isHtml ? html() : json()

    const state = EditorState.create({
      doc: displayBody,
      extensions: [
        basicSetup,
        langExtension,
        syntaxHighlighting(oneDarkHighlightStyle),
        EditorView.lineWrapping,
        EditorState.readOnly.of(true),
        EditorView.theme({
          '&': { backgroundColor: '#141414' },
          '.cm-gutters': { backgroundColor: '#0a0a0a', borderRight: '1px solid #2e2e2e' },
          '.cm-cursor': { borderLeftColor: '#ef4444' },
          '.cm-activeLine': { backgroundColor: '#1e1e1e' },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#ef444430' },
        }, { dark: true }),
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
  }, [displayBody, showCodeMirror])

  if (!body) {
    return (
      <div className="p-4 text-sm text-gray-500">No response body</div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {isHtml && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-neutral-800 bg-neutral-900/50 shrink-0">
          <button
            onClick={() => setViewMode('preview')}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              viewMode === 'preview'
                ? 'bg-red-500/20 text-red-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode('source')}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              viewMode === 'source'
                ? 'bg-red-500/20 text-red-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Source
          </button>
        </div>
      )}

      {isHtml && viewMode === 'preview' ? (
        <iframe
          srcDoc={body}
          sandbox=""
          className="flex-1 w-full bg-white"
          title="HTML Preview"
        />
      ) : (
        <div ref={containerRef} className="flex-1 overflow-hidden" />
      )}
    </div>
  )
}

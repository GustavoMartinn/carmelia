import { useEffect, useRef } from 'react'
import { MergeView } from '@codemirror/merge'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { syntaxHighlighting } from '@codemirror/language'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { useAppStore } from '../../store/appStore'
import { DiffSourcePicker } from './DiffSourcePicker'

const darkTheme = EditorView.theme({
  '&': { backgroundColor: '#141414' },
  '.cm-gutters': { backgroundColor: '#0a0a0a', borderRight: '1px solid #2e2e2e' },
  '.cm-mergeView .cm-changedLine': { backgroundColor: '#2a1a1a' },
  '.cm-mergeView .cm-changedText': { backgroundColor: '#4a2a2a' },
}, { dark: true })

function tryFormatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export function ResponseDiff() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mergeRef = useRef<MergeView | null>(null)
  const diffLeftBody = useAppStore((s) => s.diffLeftBody)
  const diffRightBody = useAppStore((s) => s.diffRightBody)

  useEffect(() => {
    if (!containerRef.current) return

    if (mergeRef.current) {
      mergeRef.current.destroy()
    }

    const leftFormatted = tryFormatJson(diffLeftBody)
    const rightFormatted = tryFormatJson(diffRightBody)

    const extensions = [
      json(),
      syntaxHighlighting(oneDarkHighlightStyle),
      EditorView.lineWrapping,
      darkTheme,
      EditorState.readOnly.of(true),
    ]

    mergeRef.current = new MergeView({
      a: {
        doc: leftFormatted,
        extensions,
      },
      b: {
        doc: rightFormatted,
        extensions,
      },
      parent: containerRef.current,
    })

    return () => {
      mergeRef.current?.destroy()
      mergeRef.current = null
    }
  }, [diffLeftBody, diffRightBody])

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-700 bg-gray-800/50 px-3 py-2 gap-4">
        <div className="flex-1">
          <DiffSourcePicker side="left" />
        </div>
        <div className="flex-1">
          <DiffSourcePicker side="right" />
        </div>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  )
}

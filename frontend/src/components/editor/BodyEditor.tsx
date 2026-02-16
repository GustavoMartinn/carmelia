import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { oneDarkHighlightStyle, } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, foldGutter, indentOnInput, bracketMatching, foldKeymap } from '@codemirror/language'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
import { useAppStore } from '../../store/appStore'
import { rebuildFromParsed } from '../../utils/httpRebuilder'

export function BodyEditor() {
  const parsed = useAppStore((s) => s.parsed)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const selfUpdate = useRef(false)

  // Create editor — skips recreation when the change came from the editor itself
  useEffect(() => {
    if (selfUpdate.current) {
      selfUpdate.current = false
      return
    }
    if (!containerRef.current) return

    const body = parsed?.body || ''

    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const state = EditorState.create({
      doc: body,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        // drawSelection() intentionally omitted — native ::selection works
        // better for wrapped lines in WebKit
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
        ]),
        json(),
        syntaxHighlighting(oneDarkHighlightStyle),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { backgroundColor: '#141414' },
          '.cm-gutters': { backgroundColor: '#0a0a0a', borderRight: '1px solid #2e2e2e' },
          '.cm-cursor': { borderLeftColor: '#ef4444' },
          '.cm-activeLine': { backgroundColor: '#1e1e1e' },
        }, { dark: true }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newBody = update.state.doc.toString()
            const s = useAppStore.getState()
            if (!s.parsed) return
            const rebuilt = rebuildFromParsed(s.parsed, { body: newBody })
            s.setRawContent(rebuilt)
            selfUpdate.current = true
            s.setParsed({ ...s.parsed, body: newBody })
          }
        }),
      ],
    })

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    })
  }, [parsed?.body])

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [])

  return (
    <div ref={containerRef} className="h-full overflow-hidden" />
  )
}

import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, foldGutter, indentOnInput, bracketMatching, foldKeymap } from '@codemirror/language'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
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

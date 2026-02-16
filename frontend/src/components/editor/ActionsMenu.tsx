import { useState, useRef, useEffect } from 'react'
import { useAppStore, getActiveProject } from '../../store/appStore'
import { generateCurl, generatePython, generateNodeFetch, generateGo } from '../../utils/codeGenerators'
import { ReadRequestFromProject, ParseRequest } from '../../../wailsjs/go/main/App'

export function ActionsMenu() {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const parsed = useAppStore((s) => s.parsed)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000)
      return () => clearTimeout(t)
    }
  }, [toast])

  if (!parsed) return null

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setToast(`Copied as ${label}!`)
    setOpen(false)
  }

  const handleResetToSaved = async () => {
    const s = useAppStore.getState()
    s.setRawContent(s.originalContent)
    const reParsed = await ParseRequest(s.originalContent)
    s.setParsed(reParsed)
    setOpen(false)
  }

  const handleResetToDefault = async () => {
    setOpen(false)
    const s = useAppStore.getState()
    const activeTab = s.openTabs[s.activeTabIndex]
    if (!activeTab) return

    let defaultContent = activeTab.defaultContent
    // Fallback for tabs created before defaultContent existed: read from disk
    if (!defaultContent) {
      const project = getActiveProject(s)
      if (!project || !s.activeFile) return
      try {
        defaultContent = await ReadRequestFromProject(project.path, s.activeFile)
      } catch {
        return
      }
    }

    s.setRawContent(defaultContent)
    s.setOriginalContent(defaultContent)
    const reParsed = await ParseRequest(defaultContent)
    s.setParsed(reParsed)
  }

  const handleClone = () => {
    const s = useAppStore.getState()
    s.cloneTab(s.activeTabIndex)
    setOpen(false)
  }

  const actions = [
    { label: 'Copy as cURL', action: () => copyToClipboard(generateCurl(parsed), 'cURL') },
    { label: 'Copy as Python', action: () => copyToClipboard(generatePython(parsed), 'Python') },
    { label: 'Copy as Node.js', action: () => copyToClipboard(generateNodeFetch(parsed), 'Node.js') },
    { label: 'Copy as Go', action: () => copyToClipboard(generateGo(parsed), 'Go') },
    null, // separator
    { label: 'Reset to saved', action: handleResetToSaved },
    { label: 'Reset to default', action: handleResetToDefault },
    { label: 'Duplicate tab', action: handleClone },
  ]

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="px-2 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded text-sm transition-colors"
        title="Actions"
      >
        &#8943;
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[180px] py-1">
          {actions.map((item, i) =>
            item === null ? (
              <div key={i} className="border-t border-gray-700 my-1" />
            ) : (
              <button
                key={i}
                onClick={item.action}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-xs text-green-400 shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

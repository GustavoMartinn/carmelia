import { useEffect, useRef } from 'react'
import { useAppStore, getActiveProject } from '../../store/appStore'
import { GetHistory } from '../../../wailsjs/go/main/App'
import { ResponseMeta } from './ResponseMeta'
import { ResponseBody } from './ResponseBody'
import { ResponseHeaders } from './ResponseHeaders'
import { RawResponseView } from './RawResponseView'
import { CookiesViewer } from './CookiesViewer'
import { HistoryPanel } from './HistoryPanel'
import { ResponseDiff } from './ResponseDiff'

const TABS = [
  { key: 'body' as const, label: 'Body' },
  { key: 'headers' as const, label: 'Headers' },
  { key: 'cookies' as const, label: 'Cookies' },
  { key: 'raw' as const, label: 'Raw' },
  { key: 'history' as const, label: 'History' },
]

function reloadHistory() {
  const s = useAppStore.getState()
  const project = getActiveProject(s)
  if (!project || !s.activeFile) return
  // Small delay to let the Go goroutine finish writing history
  setTimeout(async () => {
    try {
      const entries = await GetHistory(project.path, s.activeFile!)
      useAppStore.getState().setHistoryEntries(entries || [])
    } catch { /* ignore */ }
  }, 200)
}

export function ResponsePanel() {
  const responseTab = useAppStore((s) => s.responseTab)
  const setResponseTab = useAppStore((s) => s.setResponseTab)
  const result = useAppStore((s) => s.response)
  const loading = useAppStore((s) => s.loading)
  const error = useAppStore((s) => s.error)
  const diffEnabled = useAppStore((s) => s.diffEnabled)
  const setDiffEnabled = useAppStore((s) => s.setDiffEnabled)
  const setDiffLeftBody = useAppStore((s) => s.setDiffLeftBody)
  const setDiffRightBody = useAppStore((s) => s.setDiffRightBody)
  const prevResultRef = useRef(result)

  // Reload history when a new response arrives while diff is open
  useEffect(() => {
    if (result && result !== prevResultRef.current && diffEnabled) {
      reloadHistory()
    }
    prevResultRef.current = result
  }, [result, diffEnabled])

  const cookieCount = result?.response?.cookies?.length || 0

  if (!result && !loading && !error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-600 text-sm">
          Click Send to execute the request
        </div>
      </div>
    )
  }

  const handleToggleDiff = async () => {
    if (!diffEnabled && result) {
      const currentBody = result.error ? `Error: ${result.error}` : (result.response?.body || '')
      const s = useAppStore.getState()
      const project = getActiveProject(s)
      if (project && s.activeFile) {
        try {
          const entries = await GetHistory(project.path, s.activeFile)
          s.setHistoryEntries(entries || [])
          // entries[0] is the current response (just saved), so previous = entries[1]
          if (entries && entries.length > 1) {
            const prev = entries[1]
            setDiffLeftBody(prev.error ? `Error: ${prev.error}` : (prev.response?.body || ''))
          } else {
            setDiffLeftBody(currentBody)
          }
        } catch {
          setDiffLeftBody(currentBody)
        }
      } else {
        setDiffLeftBody(currentBody)
      }
      setDiffRightBody(currentBody)
    }
    setDiffEnabled(!diffEnabled)
  }

  if (diffEnabled) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50">
          <span className="text-xs text-gray-400 font-medium">Response Diff</span>
          <button
            onClick={handleToggleDiff}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Close diff
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <ResponseDiff />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ResponseMeta />
      {result?.response && (
        <>
          <div className="flex border-b border-gray-700 bg-gray-800/50">
            <div className="flex flex-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setResponseTab(tab.key)}
                  className={`px-4 py-2 text-xs font-medium transition-colors relative ${
                    responseTab === tab.key
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'cookies' && cookieCount > 0 && (
                    <span className="ml-1.5 bg-gray-600 text-gray-200 text-[10px] px-1.5 py-0.5 rounded-full">
                      {cookieCount}
                    </span>
                  )}
                  {responseTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={handleToggleDiff}
              className="px-3 py-2 text-xs text-gray-500 hover:text-gray-200 transition-colors"
              title="Compare responses"
            >
              Compare
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {responseTab === 'body' && <ResponseBody />}
            {responseTab === 'headers' && <ResponseHeaders />}
            {responseTab === 'cookies' && <CookiesViewer />}
            {responseTab === 'raw' && <RawResponseView />}
            {responseTab === 'history' && <HistoryPanel />}
          </div>
        </>
      )}
    </div>
  )
}

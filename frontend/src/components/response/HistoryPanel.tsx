import { useEffect, useState } from 'react'
import { useAppStore, getActiveProject, type HistoryEntry } from '../../store/appStore'

export function HistoryPanel() {
  const activeFile = useAppStore((s) => s.activeFile)
  const activeProject = useAppStore((s) => getActiveProject(s))
  const historyEntries = useAppStore((s) => s.historyEntries)
  const setHistoryEntries = useAppStore((s) => s.setHistoryEntries)
  const selectedHistoryEntry = useAppStore((s) => s.selectedHistoryEntry)
  const setSelectedHistoryEntry = useAppStore((s) => s.setSelectedHistoryEntry)
  const setResponse = useAppStore((s) => s.setResponse)
  const response = useAppStore((s) => s.response)
  const [currentResponse, setCurrentResponse] = useState(response)

  useEffect(() => {
    if (response && !selectedHistoryEntry) {
      setCurrentResponse(response)
    }
  }, [response])

  useEffect(() => {
    loadHistory()
  }, [activeFile])

  const loadHistory = async () => {
    if (!activeProject || !activeFile) return
    try {
      const { GetHistory } = await import('../../../wailsjs/go/main/App')
      const entries = await GetHistory(activeProject.path, activeFile)
      setHistoryEntries(entries || [])
    } catch {
      setHistoryEntries([])
    }
  }

  const handleSelectEntry = (entry: HistoryEntry) => {
    setSelectedHistoryEntry(entry)
    setResponse({
      request: entry.request,
      response: entry.response,
      error: entry.error,
    })
  }

  const handleBackToCurrent = () => {
    setSelectedHistoryEntry(null)
    if (currentResponse) {
      setResponse(currentResponse)
    }
  }

  const handleClear = async () => {
    if (!activeProject || !activeFile) return
    try {
      const { ClearHistory } = await import('../../../wailsjs/go/main/App')
      await ClearHistory(activeProject.path, activeFile)
      setHistoryEntries([])
      setSelectedHistoryEntry(null)
    } catch { /* ignore */ }
  }

  const STATUS_COLORS: Record<string, string> = {
    '2': 'text-green-400',
    '3': 'text-blue-400',
    '4': 'text-yellow-400',
    '5': 'text-red-400',
  }

  return (
    <div className="flex flex-col h-full">
      {selectedHistoryEntry && (
        <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
          <span className="text-xs text-yellow-400">
            Viewing historical response from {new Date(selectedHistoryEntry.timestamp).toLocaleString()}
          </span>
          <button
            onClick={handleBackToCurrent}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Back to current
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {historyEntries.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            No history yet. Send a request to start recording.
          </div>
        ) : (
          <div>
            {historyEntries.map((entry) => {
              const statusStr = String(entry.response?.status || 0)
              const statusColor = STATUS_COLORS[statusStr[0]] || 'text-gray-400'
              const isSelected = selectedHistoryEntry?.id === entry.id

              return (
                <div
                  key={entry.id}
                  onClick={() => handleSelectEntry(entry)}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                    isSelected ? 'bg-gray-800 border-l-2 border-l-red-500' : ''
                  }`}
                >
                  <span className={`${statusColor} font-mono text-xs font-bold w-8`}>
                    {entry.response?.status || 'ERR'}
                  </span>
                  <span className="text-xs text-gray-400 flex-1">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-600">
                    {entry.response?.time ? `${entry.response.time}ms` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {historyEntries.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-700 flex justify-between items-center">
          <span className="text-xs text-gray-600">{historyEntries.length} entries</span>
          <button
            onClick={handleClear}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Clear history
          </button>
        </div>
      )}
    </div>
  )
}

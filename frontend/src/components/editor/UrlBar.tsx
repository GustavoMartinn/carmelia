import { useAppStore, getActiveProject } from '../../store/appStore'
import { ExecuteRequest, SaveRequestToProject } from '../../../wailsjs/go/main/App'
import { ActionsMenu } from './ActionsMenu'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-gray-400',
}

export function UrlBar() {
  const parsed = useAppStore((s) => s.parsed)
  const rawContent = useAppStore((s) => s.rawContent)
  const originalContent = useAppStore((s) => s.originalContent)
  const activeFile = useAppStore((s) => s.activeFile)
  const loading = useAppStore((s) => s.loading)
  const setLoading = useAppStore((s) => s.setLoading)
  const setResponse = useAppStore((s) => s.setResponse)
  const setError = useAppStore((s) => s.setError)

  const activeProject = useAppStore((s) => getActiveProject(s))

  const activeTab = useAppStore((s) => s.openTabs[s.activeTabIndex])

  if (!parsed) return null

  const isDirty = rawContent !== originalContent

  const handleSend = async () => {
    if (!activeProject || !activeTab) return
    const targetInstanceId = activeTab.instanceId
    setLoading(true)
    setResponse(null)
    setError(null)
    try {
      const requestVars = useAppStore.getState().requestVars
      const result = await ExecuteRequest(rawContent, activeProject.activeEnv, activeProject.path, requestVars, activeFile || '')
      useAppStore.getState().updateTabByInstanceId(targetInstanceId, { response: result, loading: false })
      if (result.error) {
        setError(result.error)
      }
    } catch (err: any) {
      setError(err?.message || 'Request failed')
      useAppStore.getState().updateTabByInstanceId(targetInstanceId, { loading: false })
    }
  }

  const handleSave = async () => {
    if (!activeFile || !isDirty || !activeProject || !activeTab) return
    const targetInstanceId = activeTab.instanceId
    const contentToSave = rawContent
    try {
      await SaveRequestToProject(activeProject.path, activeFile, contentToSave)
      useAppStore.getState().updateTabByInstanceId(targetInstanceId, { originalContent: contentToSave })
    } catch (err: any) {
      setError(err?.message || 'Save failed')
    }
  }

  const methodColor = METHOD_COLORS[parsed.method] || 'text-gray-400'

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800">
      <span className={`${methodColor} font-bold text-sm w-16 text-center flex-shrink-0`}>
        {parsed.method}
      </span>

      <div className="flex-1 bg-gray-900 rounded px-3 py-1.5 text-sm text-gray-200 font-mono truncate border border-gray-700">
        {parsed.url || 'No URL'}
      </div>

      <ActionsMenu />

      {isDirty && (
        <button
          onClick={handleSave}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 font-medium transition-colors"
        >
          Save
        </button>
      )}

      <button
        onClick={handleSend}
        disabled={loading || !parsed.url}
        className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors flex items-center gap-1.5"
      >
        {loading ? (
          <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
        ) : (
          <span>&#9654;</span>
        )}
        Send
      </button>
    </div>
  )
}

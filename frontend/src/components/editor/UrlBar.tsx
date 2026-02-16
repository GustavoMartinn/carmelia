import { useState, useEffect, useRef } from 'react'
import { useAppStore, getActiveProject } from '../../store/appStore'
import { ExecuteRequest, SaveRequestToProject } from '../../../wailsjs/go/main/App'
import { rebuildFromParsed } from '../../utils/httpRebuilder'
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

  const [localUrl, setLocalUrl] = useState(parsed?.url ?? '')
  const selfUpdate = useRef(false)

  useEffect(() => {
    if (selfUpdate.current) {
      selfUpdate.current = false
      return
    }
    setLocalUrl(parsed?.url ?? '')
  }, [parsed?.url])

  if (!parsed) return null

  const handleUrlChange = (newUrl: string) => {
    setLocalUrl(newUrl)
    const s = useAppStore.getState()
    const currentParsed = s.parsed
    if (!currentParsed) return
    const rebuilt = rebuildFromParsed(currentParsed, { url: newUrl })
    s.setRawContent(rebuilt)
    selfUpdate.current = true
    s.setParsed({ ...currentParsed, url: newUrl })
  }

  const handleMethodChange = (newMethod: string) => {
    const s = useAppStore.getState()
    const currentParsed = s.parsed
    if (!currentParsed) return
    const rebuilt = rebuildFromParsed(currentParsed, { method: newMethod })
    s.setRawContent(rebuilt)
    s.setParsed({ ...currentParsed, method: newMethod })
  }

  const isDirty = rawContent !== originalContent

  const handleSend = async () => {
    if (!activeProject || !activeTab) return
    const targetInstanceId = activeTab.instanceId
    setLoading(true)
    setResponse(null)
    setError(null)
    try {
      const currentState = useAppStore.getState()
      const currentRaw = currentState.rawContent
      const requestVars = currentState.requestVars
      const result = await ExecuteRequest(currentRaw, activeProject.activeEnv, activeProject.path, requestVars, activeFile || '')
      useAppStore.getState().updateTabByInstanceId(targetInstanceId, { response: result, loading: false })
      if (result.error) {
        setError(result.error)
      }
    } catch (err: any) {
      setError(err?.message || 'Request failed')
    } finally {
      useAppStore.getState().updateTabByInstanceId(targetInstanceId, { loading: false })
      setLoading(false)
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
      <select
        value={parsed.method}
        onChange={(e) => handleMethodChange(e.target.value)}
        className={`${methodColor} font-bold text-sm bg-gray-900 border border-gray-700 rounded px-2 py-1.5 outline-none focus:border-red-500 transition-colors cursor-pointer appearance-none text-center w-[5.5rem] flex-shrink-0`}
      >
        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
          <option key={m} value={m} className={METHOD_COLORS[m] || 'text-gray-400'}>
            {m}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={localUrl}
        onChange={(e) => handleUrlChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
        placeholder="https://example.com/api"
        className="flex-1 bg-gray-900 rounded px-3 py-1.5 text-sm text-gray-200 font-mono border border-gray-700 outline-none focus:border-red-500 transition-colors"
      />

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

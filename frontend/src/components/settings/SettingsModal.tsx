import { useState, useEffect } from 'react'
import { useAppStore, getActiveProject } from '../../store/appStore'
import { GetConfigForProject, SaveConfigForProject } from '../../../wailsjs/go/main/App'

export function SettingsModal() {
  const showSettings = useAppStore((s) => s.showSettings)
  const setShowSettings = useAppStore((s) => s.setShowSettings)
  const activeProject = useAppStore((s) => getActiveProject(s))
  const setError = useAppStore((s) => s.setError)

  const [timeout, setTimeout_] = useState(30000)
  const [maxHistory, setMaxHistory] = useState(10)
  const [followRedirects, setFollowRedirects] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!showSettings || !activeProject) return
    setLoading(true)
    GetConfigForProject(activeProject.path)
      .then((config) => {
        setTimeout_(config.runner?.timeout || 30000)
        setMaxHistory(config.runner?.maxHistory || 10)
        setFollowRedirects(config.runner?.followRedirects ?? true)
      })
      .catch(() => {
        setTimeout_(30000)
        setMaxHistory(10)
        setFollowRedirects(true)
      })
      .finally(() => setLoading(false))
  }, [showSettings, activeProject?.path])

  if (!showSettings || !activeProject) return null

  const handleSave = async () => {
    try {
      const config = await GetConfigForProject(activeProject.path)
      config.runner = {
        ...config.runner,
        timeout: timeout,
        maxHistory: maxHistory,
        followRedirects: followRedirects,
      }
      await SaveConfigForProject(activeProject.path, config)
      setShowSettings(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-2xl w-[420px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-medium">
            Settings: <span className="text-red-400">{activeProject.name}</span>
          </h2>
          <button
            onClick={() => setShowSettings(false)}
            className="text-gray-500 hover:text-gray-300"
          >
            &#10005;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-xs text-gray-500 text-center py-4">Loading...</div>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-500 uppercase font-medium block mb-1">
                  Request Timeout (ms)
                </label>
                <input
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeout_(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 font-mono outline-none focus:border-red-500"
                  min={0}
                  step={1000}
                />
                <span className="text-[10px] text-gray-600 mt-0.5 block">
                  {timeout >= 1000 ? `${(timeout / 1000).toFixed(1)}s` : `${timeout}ms`}
                </span>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-medium block mb-1">
                  Max History Entries
                </label>
                <input
                  type="number"
                  value={maxHistory}
                  onChange={(e) => setMaxHistory(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 font-mono outline-none focus:border-red-500"
                  min={1}
                  max={100}
                />
                <span className="text-[10px] text-gray-600 mt-0.5 block">
                  Per request, oldest entries are pruned automatically
                </span>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500 uppercase font-medium">
                  Follow Redirects
                </label>
                <button
                  onClick={() => setFollowRedirects(!followRedirects)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    followRedirects ? 'bg-red-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                      followRedirects ? 'left-4' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            onClick={() => setShowSettings(false)}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded text-xs font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

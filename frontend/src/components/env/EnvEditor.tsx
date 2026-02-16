import { useState, useEffect } from 'react'
import { useAppStore, getActiveProject } from '../../store/appStore'
import { SaveEnvForProject } from '../../../wailsjs/go/main/App'

export function EnvEditor() {
  const showEnvEditor = useAppStore((s) => s.showEnvEditor)
  const setShowEnvEditor = useAppStore((s) => s.setShowEnvEditor)
  const activeProject = useAppStore((s) => getActiveProject(s))
  const activeProjectIndex = useAppStore((s) => s.activeProjectIndex)
  const updateProject = useAppStore((s) => s.updateProject)
  const setError = useAppStore((s) => s.setError)

  const [entries, setEntries] = useState<[string, string][]>([])

  useEffect(() => {
    if (showEnvEditor && activeProject) {
      setEntries(Object.entries(activeProject.envVariables))
    }
  }, [showEnvEditor, activeProject])

  if (!showEnvEditor || !activeProject) return null

  const handleSave = async () => {
    const vars: Record<string, string> = {}
    for (const [key, value] of entries) {
      if (key.trim()) {
        vars[key.trim()] = value
      }
    }
    try {
      await SaveEnvForProject(activeProject.path, activeProject.activeEnv, vars)
      updateProject(activeProjectIndex, { envVariables: vars })
      setShowEnvEditor(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to save environment')
    }
  }

  const updateEntry = (index: number, field: 0 | 1, value: string) => {
    const newEntries = [...entries]
    newEntries[index] = [...newEntries[index]] as [string, string]
    newEntries[index][field] = value
    setEntries(newEntries)
  }

  const addEntry = () => {
    setEntries([...entries, ['', '']])
  }

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-2xl w-[520px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-medium">
            Environment: <span className="text-red-400">{activeProject.activeEnv}</span>
          </h2>
          <button
            onClick={() => setShowEnvEditor(false)}
            className="text-gray-500 hover:text-gray-300"
          >
            &#10005;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase">
                <th className="pb-2 font-medium">Variable</th>
                <th className="pb-2 font-medium">Value</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, value], i) => (
                <tr key={i} className="group">
                  <td className="pr-2 py-1">
                    <input
                      value={key}
                      onChange={(e) => updateEntry(i, 0, e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono outline-none focus:border-red-500"
                      placeholder="key"
                    />
                  </td>
                  <td className="pr-2 py-1">
                    <input
                      value={value}
                      onChange={(e) => updateEntry(i, 1, e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono outline-none focus:border-red-500"
                      placeholder="value"
                    />
                  </td>
                  <td className="py-1">
                    <button
                      onClick={() => removeEntry(i)}
                      className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &#10005;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={addEntry}
            className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            + Add variable
          </button>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            onClick={() => setShowEnvEditor(false)}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

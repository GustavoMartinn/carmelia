import { useAppStore, getActiveProject } from '../../store/appStore'

function extractVariables(content: string): string[] {
  const matches = content.matchAll(/\{\{(\w+)\}\}/g)
  return [...new Set([...matches].map((m) => m[1]))]
}

export function VariablesEditor() {
  const rawContent = useAppStore((s) => s.rawContent)
  const requestVars = useAppStore((s) => s.requestVars)
  const setRequestVar = useAppStore((s) => s.setRequestVar)
  const setRequestVars = useAppStore((s) => s.setRequestVars)
  const activeProject = useAppStore((s) => getActiveProject(s))

  const envVars = activeProject?.envVariables ?? {}
  const variables = extractVariables(rawContent)

  // Sort: unresolved first, then env-resolved
  const sorted = [...variables].sort((a, b) => {
    const aResolved = !!(envVars[a] || requestVars[a])
    const bResolved = !!(envVars[b] || requestVars[b])
    if (aResolved === bResolved) return 0
    return aResolved ? 1 : -1
  })

  const hasOverrides = Object.values(requestVars).some((v) => v !== '')

  if (variables.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No variables found in this request
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-xs text-gray-400">
          {variables.length} variable{variables.length !== 1 ? 's' : ''}
        </span>
        {hasOverrides && (
          <button
            onClick={() => setRequestVars({})}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-700/50">
              <th className="text-left px-3 py-1.5 font-medium w-1/4">Variable</th>
              <th className="text-left px-3 py-1.5 font-medium w-1/2">Value</th>
              <th className="text-left px-3 py-1.5 font-medium w-1/4">Source</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((varName) => {
              const envValue = envVars[varName]
              const localValue = requestVars[varName] ?? ''
              const isResolved = !!(envValue || localValue)

              return (
                <tr key={varName} className="border-b border-gray-700/30 hover:bg-gray-800/50">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isResolved ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                      />
                      <span className="font-mono text-gray-200">{varName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={localValue}
                      onChange={(e) => setRequestVar(varName, e.target.value)}
                      placeholder={envValue || 'not set'}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-red-500/50 transition-colors"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    {localValue ? (
                      <span className="text-red-400">local</span>
                    ) : envValue ? (
                      <span className="text-green-400">env</span>
                    ) : (
                      <span className="text-yellow-500">unset</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

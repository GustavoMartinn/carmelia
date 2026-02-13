import { useAppStore, getActiveProject } from '../../store/appStore'
import { GetEnvForProject } from '../../../wailsjs/go/main/App'

export function EnvSelector() {
  const activeProject = useAppStore((s) => getActiveProject(s))
  const activeProjectIndex = useAppStore((s) => s.activeProjectIndex)
  const updateProject = useAppStore((s) => s.updateProject)
  const setShowEnvEditor = useAppStore((s) => s.setShowEnvEditor)

  if (!activeProject || activeProject.envs.length === 0) return null

  const handleChange = async (envName: string) => {
    updateProject(activeProjectIndex, { activeEnv: envName })
    if (envName && activeProject) {
      try {
        const vars = await GetEnvForProject(activeProject.path, envName)
        updateProject(activeProjectIndex, { envVariables: vars || {} })
      } catch {
        updateProject(activeProjectIndex, { envVariables: {} })
      }
    } else {
      updateProject(activeProjectIndex, { envVariables: {} })
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">env:</span>
      <select
        value={activeProject.activeEnv}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500"
      >
        <option value="">none</option>
        {activeProject.envs.map((env) => (
          <option key={env} value={env}>{env}</option>
        ))}
      </select>
      {activeProject.activeEnv && (
        <button
          onClick={() => setShowEnvEditor(true)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          title="Edit environment"
        >
          &#9998;
        </button>
      )}
    </div>
  )
}

import { useAppStore } from '../../store/appStore'

export function ProjectTabs() {
  const projects = useAppStore((s) => s.projects)
  const activeProjectIndex = useAppStore((s) => s.activeProjectIndex)
  const setActiveProjectIndex = useAppStore((s) => s.setActiveProjectIndex)
  const removeProject = useAppStore((s) => s.removeProject)
  const playgroundPath = useAppStore((s) => s.playgroundPath)

  if (projects.length <= 1) return null

  return (
    <div className="flex border-b border-gray-700 bg-gray-800/50 flex-shrink-0 overflow-x-auto">
      {projects.map((project, index) => {
        const isPlayground = playgroundPath != null && project.path === playgroundPath
        return (
          <div
            key={project.path}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-gray-700 transition-colors relative ${
              index === activeProjectIndex
                ? 'bg-gray-900 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            onClick={() => setActiveProjectIndex(index)}
          >
            <span className="truncate max-w-[140px]" title={project.path}>
              {project.name}
            </span>
            {!isPlayground && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeProject(index)
                }}
                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0"
              >
                &#10005;
              </button>
            )}
            {index === activeProjectIndex && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
            )}
          </div>
        )
      })}
    </div>
  )
}

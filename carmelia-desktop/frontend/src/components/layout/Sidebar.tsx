import { useAppStore, getActiveProject } from '../../store/appStore'
import { FileTree } from '../filetree/FileTree'

export function Sidebar() {
  const activeProject = useAppStore((s) => getActiveProject(s))
  const syncing = useAppStore((s) => s.syncing)

  const fileTree = activeProject?.fileTree ?? []

  return (
    <div className="h-full flex flex-col bg-gray-950 border-r border-gray-700">
      <div className="px-3 py-2 border-b border-gray-700">
        <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
          Requests
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {syncing ? (
          <div className="px-3 py-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
            <span className="animate-spin inline-block w-5 h-5 border-2 border-gray-600 border-t-gray-400 rounded-full" />
            <span>Scanning project...</span>
          </div>
        ) : !activeProject ? (
          <div className="px-3 py-8 text-center text-gray-500 text-sm">
            Open a project to see requests
          </div>
        ) : fileTree.length === 0 ? (
          <div className="px-3 py-8 text-center text-gray-500 text-sm">
            No .http files found
          </div>
        ) : (
          <FileTree nodes={fileTree} />
        )}
      </div>
    </div>
  )
}

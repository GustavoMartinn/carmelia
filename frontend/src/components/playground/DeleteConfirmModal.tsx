import { useAppStore, getActiveProject } from '../../store/appStore'
import { DeleteRequest, DeleteFolder, GetFileTreeForProject } from '../../../wailsjs/go/main/App'

export function DeleteConfirmModal() {
  const show = useAppStore((s) => s.showDeleteConfirm)
  const setShow = useAppStore((s) => s.setShowDeleteConfirm)
  const target = useAppStore((s) => s.deleteTarget)
  const activeProject = useAppStore((s) => getActiveProject(s))
  const activeProjectIndex = useAppStore((s) => s.activeProjectIndex)
  const updateProject = useAppStore((s) => s.updateProject)
  const setError = useAppStore((s) => s.setError)

  if (!show || !target || !activeProject) return null

  const handleDelete = async () => {
    try {
      if (target.type === 'file') {
        await DeleteRequest(activeProject.path, target.relPath)

        // Close any open tabs for this file
        const state = useAppStore.getState()
        const tabIndex = state.openTabs.findIndex((t) => t.filePath === target.relPath)
        if (tabIndex >= 0) {
          state.closeTab(tabIndex)
        }
      } else {
        await DeleteFolder(activeProject.path, target.relPath)

        // Close any open tabs under this folder
        const state = useAppStore.getState()
        const prefix = target.relPath + '/'
        const toClose = state.openTabs
          .map((t, i) => ({ index: i, path: t.filePath }))
          .filter((t) => t.path === target.relPath || t.path.startsWith(prefix))
          .reverse() // Close from end to maintain indices
        for (const t of toClose) {
          useAppStore.getState().closeTab(t.index)
        }
      }

      const tree = await GetFileTreeForProject(activeProject.path)
      updateProject(activeProjectIndex, { fileTree: tree || [] })
      setShow(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to delete')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-2xl w-[400px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-medium">Delete {target.type === 'folder' ? 'Folder' : 'Request'}</h2>
          <button onClick={() => setShow(false)} className="text-gray-500 hover:text-gray-300">
            &#10005;
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-300">
            Are you sure you want to delete{' '}
            <span className="text-red-400 font-medium">{target.name}</span>?
          </p>
          {target.type === 'folder' && (
            <p className="mt-1.5 text-xs text-gray-500">
              This will remove the folder and all its contents.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            onClick={() => setShow(false)}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

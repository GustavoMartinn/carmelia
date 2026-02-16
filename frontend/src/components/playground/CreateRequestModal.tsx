import { useState, useEffect, useRef } from 'react'
import { useAppStore, getActiveProject } from '../../store/appStore'
import { CreateRequest, GetFileTreeForProject, ReadRequestFromProject, ParseRequest } from '../../../wailsjs/go/main/App'

export function CreateRequestModal() {
  const show = useAppStore((s) => s.showCreateRequest)
  const setShow = useAppStore((s) => s.setShowCreateRequest)
  const parentDir = useAppStore((s) => s.createRequestParentDir)
  const activeProject = useAppStore((s) => getActiveProject(s))
  const activeProjectIndex = useAppStore((s) => s.activeProjectIndex)
  const updateProject = useAppStore((s) => s.updateProject)
  const setError = useAppStore((s) => s.setError)

  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (show) {
      setFileName('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [show])

  if (!show || !activeProject) return null

  const handleCreate = async () => {
    const name = fileName.trim()
    if (!name) return

    try {
      const relPath = await CreateRequest(activeProject.path, parentDir, name)
      const tree = await GetFileTreeForProject(activeProject.path)
      updateProject(activeProjectIndex, { fileTree: tree || [] })
      setShow(false)

      // Auto-open the new request in a tab
      const content = await ReadRequestFromProject(activeProject.path, relPath)
      const parsed = await ParseRequest(content)
      const displayName = relPath.replace(/\.http$/, '').split('/').pop() || relPath
      useAppStore.getState().openTab(relPath, displayName, parsed?.method || 'GET', content, content, parsed)
    } catch (err: any) {
      setError(err?.message || 'Failed to create request')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-2xl w-[400px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-medium">New Request</h2>
          <button onClick={() => setShow(false)} className="text-gray-500 hover:text-gray-300">
            &#10005;
          </button>
        </div>

        <div className="p-4">
          <label className="block text-xs text-gray-400 mb-1.5">File name</label>
          <input
            ref={inputRef}
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="my-request"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm outline-none focus:border-red-500"
          />
          {parentDir && (
            <p className="mt-1.5 text-xs text-gray-500">
              in <span className="text-gray-400">{parentDir}/</span>
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
            onClick={handleCreate}
            disabled={!fileName.trim()}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded text-xs font-medium transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

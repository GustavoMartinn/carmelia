import { useMemo } from 'react'
import { useAppStore, getActiveProject, type FileTreeNode } from '../../store/appStore'
import { FileTree } from '../filetree/FileTree'

function filterTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  const q = query.toLowerCase()
  const result: FileTreeNode[] = []

  for (const node of nodes) {
    if (node.isDir) {
      const filteredChildren = filterTree(node.children ?? [], query)
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren })
      }
    } else {
      const nameMatch = node.name.toLowerCase().includes(q)
      const methodMatch = node.method?.toLowerCase().includes(q)
      if (nameMatch || methodMatch) {
        result.push(node)
      }
    }
  }

  return result
}

export function Sidebar() {
  const activeProject = useAppStore((s) => getActiveProject(s))
  const syncing = useAppStore((s) => s.syncing)
  const sidebarSearch = useAppStore((s) => s.sidebarSearch)
  const setSidebarSearch = useAppStore((s) => s.setSidebarSearch)
  const setShowCreateRequest = useAppStore((s) => s.setShowCreateRequest)
  const setCreateRequestParentDir = useAppStore((s) => s.setCreateRequestParentDir)
  const setShowCreateFolder = useAppStore((s) => s.setShowCreateFolder)
  const setCreateFolderParentDir = useAppStore((s) => s.setCreateFolderParentDir)
  const setShowImportCurl = useAppStore((s) => s.setShowImportCurl)
  const setImportCurlParentDir = useAppStore((s) => s.setImportCurlParentDir)

  const fileTree = activeProject?.fileTree ?? []

  const filteredTree = useMemo(() => {
    if (!sidebarSearch.trim()) return fileTree
    return filterTree(fileTree, sidebarSearch.trim())
  }, [fileTree, sidebarSearch])

  const forceExpand = sidebarSearch.trim().length > 0

  return (
    <div className="h-full flex flex-col bg-gray-950 border-r border-gray-700">
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
          Requests
        </span>
        {activeProject && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setCreateRequestParentDir('')
                setShowCreateRequest(true)
              }}
              className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
              title="New Request"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => {
                setCreateFolderParentDir('')
                setShowCreateFolder(true)
              }}
              className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
              title="New Folder"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m3-3H9m-4 7h14a2 2 0 002-2V7a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => {
                setImportCurlParentDir('')
                setShowImportCurl(true)
              }}
              className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors text-[10px] font-bold"
              title="Import cURL"
            >
              cURL
            </button>
          </div>
        )}
      </div>

      {activeProject && fileTree.length > 0 && (
        <div className="px-2 py-1.5 border-b border-gray-700">
          <input
            type="text"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder="Search requests..."
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-red-500 placeholder-gray-600"
          />
        </div>
      )}

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
            No .http files found.{' '}
            <button
              onClick={() => {
                setCreateRequestParentDir('')
                setShowCreateRequest(true)
              }}
              className="text-red-400 hover:text-red-300 underline"
            >
              Create one
            </button>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="px-3 py-8 text-center text-gray-500 text-sm">
            No matching requests
          </div>
        ) : (
          <FileTree nodes={filteredTree} forceExpand={forceExpand} />
        )}
      </div>
    </div>
  )
}

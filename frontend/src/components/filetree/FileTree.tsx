import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore, getActiveProject, type FileTreeNode as FTNode } from '../../store/appStore'
import { MethodBadge } from './MethodBadge'
import { ReadRequestFromProject, ParseRequest } from '../../../wailsjs/go/main/App'

interface ContextMenuState {
  x: number
  y: number
  node: FTNode
}

function FileTreeItem({ node, depth = 0, forceExpand = false, onContextMenu }: {
  node: FTNode
  depth?: number
  forceExpand?: boolean
  onContextMenu: (e: React.MouseEvent, node: FTNode) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const activeFile = useAppStore((s) => s.activeFile)

  const handleClick = async () => {
    if (node.isDir) {
      setExpanded(!expanded)
      return
    }

    // If already open as a tab, just switch to it
    const { openTabs, setActiveTabIndex } = useAppStore.getState()
    const existing = openTabs.findIndex((t) => t.filePath === node.path)
    if (existing >= 0) {
      setActiveTabIndex(existing)
      return
    }

    // Otherwise, read and open a new tab
    const project = getActiveProject(useAppStore.getState())
    if (!project) return

    try {
      const content = await ReadRequestFromProject(project.path, node.path)
      const parsed = await ParseRequest(content)
      useAppStore.getState().openTab(node.path, node.name, parsed?.method || 'GET', content, content, parsed)
    } catch (err) {
      console.error('Failed to read request:', err)
    }
  }

  const isActive = !node.isDir && node.path === activeFile
  const paddingLeft = depth * 12 + 8
  const isExpanded = forceExpand || expanded

  return (
    <>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm hover:bg-gray-800 transition-colors ${isActive ? 'bg-gray-800 text-white' : 'text-gray-300'}`}
        style={{ paddingLeft }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {node.isDir ? (
          <>
            <span className="text-gray-500 text-xs w-4 text-center flex-shrink-0">
              {isExpanded ? '▾' : '▸'}
            </span>
            <span className="truncate font-medium text-gray-400">{node.name}/</span>
          </>
        ) : (
          <>
            <span className="w-4 flex-shrink-0" />
            <span className="truncate flex-1">{node.name}</span>
            {node.method && <MethodBadge method={node.method} />}
          </>
        )}
      </div>

      {node.isDir && isExpanded && node.children?.map((child) => (
        <FileTreeItem key={child.path} node={child} depth={depth + 1} forceExpand={forceExpand} onContextMenu={onContextMenu} />
      ))}
    </>
  )
}

function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const setShowCreateRequest = useAppStore((s) => s.setShowCreateRequest)
  const setCreateRequestParentDir = useAppStore((s) => s.setCreateRequestParentDir)
  const setShowCreateFolder = useAppStore((s) => s.setShowCreateFolder)
  const setCreateFolderParentDir = useAppStore((s) => s.setCreateFolderParentDir)
  const setShowImportCurl = useAppStore((s) => s.setShowImportCurl)
  const setImportCurlParentDir = useAppStore((s) => s.setImportCurlParentDir)
  const setShowDeleteConfirm = useAppStore((s) => s.setShowDeleteConfirm)
  const setDeleteTarget = useAppStore((s) => s.setDeleteTarget)

  useEffect(() => {
    const handleClick = () => onClose()
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const isDir = menu.node.isDir
  // For files, parentDir is the directory containing the file
  const parentDir = isDir ? menu.node.path : menu.node.path.split('/').slice(0, -1).join('/')
  const displayName = isDir ? menu.node.name + '/' : menu.node.name

  const itemClass = 'w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer transition-colors'

  return createPortal(
    <div
      className="fixed z-[100] bg-gray-800 border border-gray-700 rounded shadow-2xl py-1 min-w-[160px]"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {isDir && (
        <>
          <button
            className={itemClass}
            onClick={() => {
              setCreateRequestParentDir(parentDir)
              setShowCreateRequest(true)
              onClose()
            }}
          >
            New Request
          </button>
          <button
            className={itemClass}
            onClick={() => {
              setCreateFolderParentDir(parentDir)
              setShowCreateFolder(true)
              onClose()
            }}
          >
            New Folder
          </button>
          <button
            className={itemClass}
            onClick={() => {
              setImportCurlParentDir(parentDir)
              setShowImportCurl(true)
              onClose()
            }}
          >
            Import cURL
          </button>
          <div className="border-t border-gray-700 my-1" />
        </>
      )}
      <button
        className={`${itemClass} text-red-400 hover:text-red-300`}
        onClick={() => {
          setDeleteTarget({
            type: isDir ? 'folder' : 'file',
            relPath: menu.node.path,
            name: displayName,
          })
          setShowDeleteConfirm(true)
          onClose()
        }}
      >
        Delete
      </button>
    </div>,
    document.body
  )
}

export function FileTree({ nodes, forceExpand = false }: { nodes: FTNode[]; forceExpand?: boolean }) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FTNode) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  return (
    <div className="select-none">
      {nodes.map((node) => (
        <FileTreeItem key={node.path} node={node} forceExpand={forceExpand} onContextMenu={handleContextMenu} />
      ))}
      {contextMenu && (
        <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}

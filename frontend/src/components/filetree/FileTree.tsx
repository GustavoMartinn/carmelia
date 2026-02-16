import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore, getActiveProject, type FileTreeNode as FTNode } from '../../store/appStore'
import { MethodBadge } from './MethodBadge'
import { ReadRequestFromProject, ParseRequest, MoveItem, GetFileTreeForProject } from '../../../wailsjs/go/main/App'

interface ContextMenuState {
  x: number
  y: number
  node: FTNode
}

type DropIndicator = 'above' | 'below' | 'inside' | null

function getParentPath(relPath: string): string {
  const parts = relPath.split('/')
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

function FileTreeItem({ node, depth = 0, forceExpand = false, onContextMenu, siblings }: {
  node: FTNode
  depth?: number
  forceExpand?: boolean
  onContextMenu: (e: React.MouseEvent, node: FTNode) => void
  siblings: FTNode[]
}) {
  const [expanded, setExpanded] = useState(true)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null)
  const activeFile = useAppStore((s) => s.activeFile)
  const draggedNode = useAppStore((s) => s.draggedNode)
  const rowRef = useRef<HTMLDivElement>(null)

  const handleClick = async () => {
    if (node.isDir) {
      setExpanded(!expanded)
      return
    }

    const { openTabs, setActiveTabIndex } = useAppStore.getState()
    const existing = openTabs.findIndex((t) => t.filePath === node.path)
    if (existing >= 0) {
      setActiveTabIndex(existing)
      return
    }

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

  const handleDragStart = (e: React.DragEvent) => {
    if (forceExpand) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.path)
    useAppStore.getState().setDraggedNode(node)
  }

  const handleDragEnd = () => {
    useAppStore.getState().setDraggedNode(null)
    setDropIndicator(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedNode || draggedNode.path === node.path) {
      setDropIndicator(null)
      return
    }

    // Prevent dropping a folder into itself
    if (draggedNode.isDir && node.path.startsWith(draggedNode.path + '/')) {
      setDropIndicator(null)
      return
    }

    const rect = rowRef.current?.getBoundingClientRect()
    if (!rect) return

    const y = e.clientY - rect.top
    const height = rect.height

    if (node.isDir) {
      if (y < height * 0.25) {
        setDropIndicator('above')
      } else if (y > height * 0.75) {
        setDropIndicator('below')
      } else {
        setDropIndicator('inside')
      }
    } else {
      if (y < height * 0.5) {
        setDropIndicator('above')
      } else {
        setDropIndicator('below')
      }
    }

    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation()
    setDropIndicator(null)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const indicator = dropIndicator
    setDropIndicator(null)

    const dragged = useAppStore.getState().draggedNode
    if (!dragged || dragged.path === node.path || !indicator) return

    const project = getActiveProject(useAppStore.getState())
    if (!project) return

    // Determine destination parent and index
    let destParent: string
    let destIndex: number

    if (indicator === 'inside' && node.isDir) {
      // Drop inside a folder → append at end
      destParent = node.path
      destIndex = node.children?.length ?? 0
    } else {
      // Drop above/below a sibling
      destParent = getParentPath(node.path)
      const siblingIndex = siblings.findIndex((s) => s.path === node.path)
      if (siblingIndex < 0) return

      if (indicator === 'above') {
        destIndex = siblingIndex
      } else {
        destIndex = siblingIndex + 1
      }

      // If dragging within the same parent, and source is before target, adjust index
      const srcParent = getParentPath(dragged.path)
      if (srcParent === destParent) {
        const srcIndex = siblings.findIndex((s) => s.path === dragged.path)
        if (srcIndex >= 0 && srcIndex < destIndex) {
          destIndex--
        }
      }
    }

    // The backend MoveItem expects disk paths (with .http for files).
    // FileTreeNode.path for files already includes .http (e.g. "auth/login.http").
    const srcDiskPath = dragged.path

    try {
      const newRelPath = await MoveItem(project.path, srcDiskPath, destParent, destIndex)
      useAppStore.getState().setDraggedNode(null)

      // Update open tab if the file was moved to a different folder
      if (!dragged.isDir && dragged.path !== newRelPath) {
        useAppStore.getState().updateTabByPath(dragged.path, {
          filePath: newRelPath,
        })
      }

      // Refresh file tree
      const tree = await GetFileTreeForProject(project.path)
      const { activeProjectIndex, updateProject } = useAppStore.getState()
      updateProject(activeProjectIndex, { fileTree: tree })
    } catch (err) {
      console.error('Failed to move item:', err)
    }
  }

  const isActive = !node.isDir && node.path === activeFile
  const paddingLeft = depth * 12 + 8
  const isExpanded = forceExpand || expanded

  const isDragging = draggedNode?.path === node.path

  return (
    <>
      <div
        ref={rowRef}
        className={`relative flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm transition-colors ${
          isActive ? 'bg-gray-800 text-white' : 'text-gray-300'
        } ${isDragging ? 'opacity-40' : ''} ${
          dropIndicator === 'inside' ? 'bg-gray-700/50' : 'hover:bg-gray-800'
        }`}
        style={{ paddingLeft }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable={!forceExpand}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop indicator lines */}
        {dropIndicator === 'above' && (
          <div className="absolute left-0 right-0 top-0 h-0.5 bg-red-500 pointer-events-none z-10" />
        )}
        {dropIndicator === 'below' && (
          <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-red-500 pointer-events-none z-10" />
        )}

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
        <FileTreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          forceExpand={forceExpand}
          onContextMenu={onContextMenu}
          siblings={node.children ?? []}
        />
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
        <FileTreeItem
          key={node.path}
          node={node}
          forceExpand={forceExpand}
          onContextMenu={handleContextMenu}
          siblings={nodes}
        />
      ))}
      {contextMenu && (
        <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}

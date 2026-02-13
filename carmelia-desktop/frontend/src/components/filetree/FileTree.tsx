import { useState } from 'react'
import { useAppStore, getActiveProject, type FileTreeNode as FTNode } from '../../store/appStore'
import { MethodBadge } from './MethodBadge'
import { ReadRequestFromProject, ParseRequest } from '../../../wailsjs/go/main/App'

function FileTreeItem({ node, depth = 0 }: { node: FTNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true)
  const activeFile = useAppStore((s) => s.activeFile)
  const setActiveFile = useAppStore((s) => s.setActiveFile)
  const setRawContent = useAppStore((s) => s.setRawContent)
  const setOriginalContent = useAppStore((s) => s.setOriginalContent)
  const setParsed = useAppStore((s) => s.setParsed)
  const setResponse = useAppStore((s) => s.setResponse)

  const handleClick = async () => {
    if (node.isDir) {
      setExpanded(!expanded)
      return
    }

    const project = getActiveProject(useAppStore.getState())
    if (!project) return

    try {
      const content = await ReadRequestFromProject(project.path, node.path)
      const parsed = await ParseRequest(content)
      setActiveFile(node.path)
      setRawContent(content)
      setOriginalContent(content)
      setParsed(parsed)
      setResponse(null)
    } catch (err) {
      console.error('Failed to read request:', err)
    }
  }

  const isActive = !node.isDir && node.path === activeFile
  const paddingLeft = depth * 12 + 8

  return (
    <>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm hover:bg-gray-800 transition-colors ${isActive ? 'bg-gray-800 text-white' : 'text-gray-300'}`}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {node.isDir ? (
          <>
            <span className="text-gray-500 text-xs w-4 text-center flex-shrink-0">
              {expanded ? '▾' : '▸'}
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

      {node.isDir && expanded && node.children?.map((child) => (
        <FileTreeItem key={child.path} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

export function FileTree({ nodes }: { nodes: FTNode[] }) {
  return (
    <div className="select-none">
      {nodes.map((node) => (
        <FileTreeItem key={node.path} node={node} />
      ))}
    </div>
  )
}

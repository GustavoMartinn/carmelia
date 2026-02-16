import { useAppStore } from '../../store/appStore'
import { MethodBadge } from '../filetree/MethodBadge'

export function RequestTabs() {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeTabIndex = useAppStore((s) => s.activeTabIndex)
  const setActiveTabIndex = useAppStore((s) => s.setActiveTabIndex)
  const closeTab = useAppStore((s) => s.closeTab)

  if (openTabs.length === 0) return null

  // Count instances per filePath for suffix numbering
  const instanceCounts = new Map<string, number>()
  for (const tab of openTabs) {
    instanceCounts.set(tab.filePath, (instanceCounts.get(tab.filePath) || 0) + 1)
  }

  // Track seen filePaths for suffix numbering
  const seenPaths = new Map<string, number>()

  return (
    <div className="flex border-b border-gray-700 bg-gray-800/50 flex-shrink-0 overflow-x-auto">
      {openTabs.map((tab, index) => {
        const isDirty = tab.rawContent !== tab.originalContent
        const method = tab.parsed?.method ?? tab.method
        const totalInstances = instanceCounts.get(tab.filePath) || 1

        // Calculate instance number for display
        const instanceNum = (seenPaths.get(tab.filePath) || 0) + 1
        seenPaths.set(tab.filePath, instanceNum)
        const showSuffix = totalInstances > 1

        return (
          <div
            key={tab.instanceId}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-gray-700 transition-colors relative ${
              index === activeTabIndex
                ? 'bg-gray-900 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            onClick={() => setActiveTabIndex(index)}
          >
            <MethodBadge method={method} />
            <span className="truncate max-w-[140px]" title={tab.filePath}>
              {tab.fileName}
              {showSuffix && (
                <span className="text-gray-500 ml-0.5">({instanceNum})</span>
              )}
            </span>
            {tab.isClone && (
              <span className="text-[9px] text-gray-600 italic">clone</span>
            )}
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
            )}
            {tab.loading && (
              <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-400/30 border-t-gray-400 rounded-full flex-shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeTab(index)
              }}
              className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0"
            >
              &#10005;
            </button>
            {index === activeTabIndex && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
            )}
          </div>
        )
      })}
    </div>
  )
}

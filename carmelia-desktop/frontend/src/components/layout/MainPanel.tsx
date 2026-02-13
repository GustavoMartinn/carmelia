import { useAppStore } from '../../store/appStore'
import { UrlBar } from '../editor/UrlBar'
import { EditorTabs } from '../editor/EditorTabs'
import { ResponsePanel } from '../response/ResponsePanel'

export function MainPanel() {
  const activeFile = useAppStore((s) => s.activeFile)
  const parsed = useAppStore((s) => s.parsed)

  if (!activeFile || !parsed) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-3 opacity-30">&#123;&#123;&gt;&#125;&#125;</div>
          <div className="text-sm">Select a request from the sidebar</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <UrlBar />
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 border-b border-gray-700">
          <EditorTabs />
        </div>
        <div className="flex-1 min-h-0">
          <ResponsePanel />
        </div>
      </div>
    </div>
  )
}

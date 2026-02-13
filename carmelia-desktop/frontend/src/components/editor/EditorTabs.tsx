import { useAppStore } from '../../store/appStore'
import { HeadersEditor } from './HeadersEditor'
import { BodyEditor } from './BodyEditor'
import { RawEditor } from './RawEditor'

const TABS = [
  { key: 'headers' as const, label: 'Headers' },
  { key: 'body' as const, label: 'Body' },
  { key: 'raw' as const, label: 'Raw' },
]

export function EditorTabs() {
  const editorTab = useAppStore((s) => s.editorTab)
  const setEditorTab = useAppStore((s) => s.setEditorTab)
  const parsed = useAppStore((s) => s.parsed)

  const headerCount = parsed ? Object.keys(parsed.headers).length : 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-700 bg-gray-800/50">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setEditorTab(tab.key)}
            className={`px-4 py-2 text-xs font-medium transition-colors relative ${
              editorTab === tab.key
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
            {tab.key === 'headers' && headerCount > 0 && (
              <span className="ml-1.5 bg-gray-600 text-gray-200 text-[10px] px-1.5 py-0.5 rounded-full">
                {headerCount}
              </span>
            )}
            {editorTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {editorTab === 'headers' && <HeadersEditor />}
        {editorTab === 'body' && <BodyEditor />}
        {editorTab === 'raw' && <RawEditor />}
      </div>
    </div>
  )
}

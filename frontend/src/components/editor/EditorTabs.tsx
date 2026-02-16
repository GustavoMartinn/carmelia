import { useAppStore, getActiveProject } from '../../store/appStore'
import { QueryParamsEditor } from './QueryParamsEditor'
import { HeadersEditor } from './HeadersEditor'
import { BodyEditor } from './BodyEditor'
import { RawEditor } from './RawEditor'
import { VariablesEditor } from './VariablesEditor'
import { AuthEditor } from './AuthEditor'
import { DocsEditor } from './DocsEditor'

const TABS = [
  { key: 'params' as const, label: 'Params' },
  { key: 'headers' as const, label: 'Headers' },
  { key: 'auth' as const, label: 'Auth' },
  { key: 'body' as const, label: 'Body' },
  { key: 'docs' as const, label: 'Docs' },
  { key: 'raw' as const, label: 'Raw' },
  { key: 'variables' as const, label: 'Variables' },
]

export function EditorTabs() {
  const editorTab = useAppStore((s) => s.editorTab)
  const setEditorTab = useAppStore((s) => s.setEditorTab)
  const parsed = useAppStore((s) => s.parsed)
  const rawContent = useAppStore((s) => s.rawContent)
  const requestVars = useAppStore((s) => s.requestVars)
  const activeProject = useAppStore((s) => getActiveProject(s))
  const activeInstanceId = useAppStore((s) => s.openTabs[s.activeTabIndex]?.instanceId)

  const headerCount = parsed ? Object.keys(parsed.headers).length : 0

  // Count query params
  const paramCount = parsed?.url ? (parsed.url.split('?')[1] || '').split('&').filter((p) => p).length : 0

  // Count unresolved variables for badge
  const envVars = activeProject?.envVariables ?? {}
  const varMatches = rawContent.matchAll(/\{\{(\w+)\}\}/g)
  const allVars = [...new Set([...varMatches].map((m) => m[1]))]
  const unresolvedCount = allVars.filter(
    (v) => !envVars[v] && !requestVars[v]
  ).length

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
            {tab.key === 'params' && paramCount > 0 && (
              <span className="ml-1.5 bg-gray-600 text-gray-200 text-[10px] px-1.5 py-0.5 rounded-full">
                {paramCount}
              </span>
            )}
            {tab.key === 'headers' && headerCount > 0 && (
              <span className="ml-1.5 bg-gray-600 text-gray-200 text-[10px] px-1.5 py-0.5 rounded-full">
                {headerCount}
              </span>
            )}
            {tab.key === 'variables' && unresolvedCount > 0 && (
              <span className="ml-1.5 bg-yellow-600 text-yellow-100 text-[10px] px-1.5 py-0.5 rounded-full">
                {unresolvedCount}
              </span>
            )}
            {editorTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
            )}
          </button>
        ))}
      </div>

      <div key={activeInstanceId} className="flex-1 min-h-0 overflow-hidden">
        {editorTab === 'params' && <QueryParamsEditor />}
        {editorTab === 'headers' && <HeadersEditor />}
        {editorTab === 'auth' && <AuthEditor />}
        {editorTab === 'body' && <BodyEditor />}
        {editorTab === 'docs' && <DocsEditor />}
        {editorTab === 'raw' && <RawEditor />}
        {editorTab === 'variables' && <VariablesEditor />}
      </div>
    </div>
  )
}

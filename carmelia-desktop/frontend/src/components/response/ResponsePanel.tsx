import { useAppStore } from '../../store/appStore'
import { ResponseMeta } from './ResponseMeta'
import { ResponseBody } from './ResponseBody'
import { ResponseHeaders } from './ResponseHeaders'
import { RawResponseView } from './RawResponseView'

const TABS = [
  { key: 'body' as const, label: 'Body' },
  { key: 'headers' as const, label: 'Headers' },
  { key: 'raw' as const, label: 'Raw' },
]

export function ResponsePanel() {
  const responseTab = useAppStore((s) => s.responseTab)
  const setResponseTab = useAppStore((s) => s.setResponseTab)
  const result = useAppStore((s) => s.response)
  const loading = useAppStore((s) => s.loading)
  const error = useAppStore((s) => s.error)

  if (!result && !loading && !error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-600 text-sm">
          Click Send to execute the request
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ResponseMeta />
      {result?.response && (
        <>
          <div className="flex border-b border-gray-700 bg-gray-800/50">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setResponseTab(tab.key)}
                className={`px-4 py-2 text-xs font-medium transition-colors relative ${
                  responseTab === tab.key
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
                {responseTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {responseTab === 'body' && <ResponseBody />}
            {responseTab === 'headers' && <ResponseHeaders />}
            {responseTab === 'raw' && <RawResponseView />}
          </div>
        </>
      )}
    </div>
  )
}

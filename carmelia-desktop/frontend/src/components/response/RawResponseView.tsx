import { useAppStore } from '../../store/appStore'

export function RawResponseView() {
  const result = useAppStore((s) => s.response)

  if (!result?.response) {
    return <div className="p-4 text-sm text-gray-500">No response</div>
  }

  const { status, statusText, headers, body } = result.response

  const raw = [
    statusText,
    ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
    '',
    body,
  ].join('\n')

  return (
    <div className="h-full overflow-auto p-3">
      <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{raw}</pre>
    </div>
  )
}

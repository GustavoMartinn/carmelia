import { useAppStore } from '../../store/appStore'

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-green-500/20 text-green-400 border-green-500/30'
  if (status >= 300 && status < 400) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  if (status >= 400 && status < 500) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  return 'bg-red-500/20 text-red-400 border-red-500/30'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ResponseMeta() {
  const result = useAppStore((s) => s.response)
  const loading = useAppStore((s) => s.loading)
  const error = useAppStore((s) => s.error)

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800/50">
        <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full" />
        <span className="text-sm text-gray-400">Sending request...</span>
      </div>
    )
  }

  if (error && !result?.response?.status) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-red-500/5">
        <span className="text-sm text-red-400">{error}</span>
      </div>
    )
  }

  if (!result?.response) return null

  const { status, statusText, time, size } = result.response

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-700 bg-gray-800/50">
      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${statusColor(status)}`}>
        {statusText}
      </span>
      <span className="text-xs text-gray-400">
        {time}ms
      </span>
      <span className="text-xs text-gray-500">
        {formatSize(size)}
      </span>
    </div>
  )
}

import { useAppStore } from '../../store/appStore'

export function ResponseHeaders() {
  const result = useAppStore((s) => s.response)

  if (!result?.response?.headers) {
    return (
      <div className="p-4 text-sm text-gray-500">No response headers</div>
    )
  }

  const headers = Object.entries(result.response.headers)

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-700">
            <th className="px-3 py-2 font-medium">Header</th>
            <th className="px-3 py-2 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {headers.map(([key, value]) => (
            <tr key={key} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="px-3 py-2 text-gray-300 font-mono">{key}</td>
              <td className="px-3 py-2 text-gray-400 font-mono break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

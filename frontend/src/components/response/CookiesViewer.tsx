import { useAppStore } from '../../store/appStore'

export function CookiesViewer() {
  const result = useAppStore((s) => s.response)
  const cookies = result?.response?.cookies || []

  if (cookies.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No cookies in this response
      </div>
    )
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-700">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Value</th>
            <th className="px-3 py-2 font-medium">Domain</th>
            <th className="px-3 py-2 font-medium">Path</th>
            <th className="px-3 py-2 font-medium">Expires</th>
            <th className="px-3 py-2 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {cookies.map((cookie, i) => {
            const flags: string[] = []
            if (cookie.secure) flags.push('Secure')
            if (cookie.httpOnly) flags.push('HttpOnly')
            if (cookie.sameSite) flags.push(`SameSite=${cookie.sameSite}`)

            return (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-3 py-2 text-gray-300 font-mono">{cookie.name}</td>
                <td className="px-3 py-2 text-gray-400 font-mono max-w-[200px] truncate" title={cookie.value}>
                  {cookie.value}
                </td>
                <td className="px-3 py-2 text-gray-400">{cookie.domain || '-'}</td>
                <td className="px-3 py-2 text-gray-400">{cookie.path || '/'}</td>
                <td className="px-3 py-2 text-gray-400 text-xs">
                  {cookie.expires ? new Date(cookie.expires).toLocaleString() : cookie.maxAge ? `${cookie.maxAge}s` : '-'}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">
                  {flags.length > 0 ? flags.join(', ') : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

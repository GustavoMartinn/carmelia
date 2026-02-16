import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { rebuildFromParsed } from '../../utils/httpRebuilder'

export function HeadersEditor() {
  const parsed = useAppStore((s) => s.parsed)
  const [entries, setEntries] = useState<[string, string][]>([])
  const selfUpdate = useRef(false)

  useEffect(() => {
    if (selfUpdate.current) {
      selfUpdate.current = false
      return
    }
    if (parsed) {
      setEntries(Object.entries(parsed.headers))
    }
  }, [parsed?.headers])

  if (!parsed) return null

  const applyChanges = (newEntries: [string, string][]) => {
    const headers: Record<string, string> = {}
    for (const [key, value] of newEntries) {
      if (key.trim()) {
        headers[key.trim()] = value
      }
    }
    const s = useAppStore.getState()
    const currentParsed = s.parsed
    if (!currentParsed) return
    const rebuilt = rebuildFromParsed(currentParsed, { headers })
    s.setRawContent(rebuilt)
    selfUpdate.current = true
    s.setParsed({ ...currentParsed, headers })
  }

  const updateEntry = (index: number, field: 0 | 1, value: string) => {
    const newEntries = [...entries]
    newEntries[index] = [...newEntries[index]] as [string, string]
    newEntries[index][field] = value
    setEntries(newEntries)
    applyChanges(newEntries)
  }

  const addEntry = () => {
    const newEntries: [string, string][] = [...entries, ['', '']]
    setEntries(newEntries)
  }

  const removeEntry = (index: number) => {
    const newEntries = entries.filter((_, i) => i !== index)
    setEntries(newEntries)
    applyChanges(newEntries)
  }

  return (
    <div className="overflow-auto h-full p-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-700">
            <th className="px-2 py-2 font-medium">Header</th>
            <th className="px-2 py-2 font-medium">Value</th>
            <th className="py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value], i) => (
            <tr key={i} className="group">
              <td className="pr-2 py-1">
                <input
                  value={key}
                  onChange={(e) => updateEntry(i, 0, e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-gray-200 outline-none focus:border-red-500"
                  placeholder="Header-Name"
                />
              </td>
              <td className="pr-2 py-1">
                <input
                  value={value}
                  onChange={(e) => updateEntry(i, 1, e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-gray-200 outline-none focus:border-red-500"
                  placeholder="value"
                />
              </td>
              <td className="py-1">
                <button
                  onClick={() => removeEntry(i)}
                  className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  &#10005;
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={addEntry}
        className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        + Add header
      </button>
    </div>
  )
}

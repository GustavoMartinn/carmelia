import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { rebuildFromParsed } from '../../utils/httpRebuilder'

interface ParamEntry {
  enabled: boolean
  key: string
  value: string
}

function parseQueryParams(url: string): { baseUrl: string; params: ParamEntry[] } {
  const qIndex = url.indexOf('?')
  if (qIndex < 0) return { baseUrl: url, params: [] }

  const baseUrl = url.substring(0, qIndex)
  const queryString = url.substring(qIndex + 1)
  if (!queryString) return { baseUrl, params: [] }

  const params: ParamEntry[] = queryString.split('&').map((pair) => {
    const eqIndex = pair.indexOf('=')
    if (eqIndex < 0) return { enabled: true, key: decodeParam(pair), value: '' }
    return {
      enabled: true,
      key: decodeParam(pair.substring(0, eqIndex)),
      value: decodeParam(pair.substring(eqIndex + 1)),
    }
  })

  return { baseUrl, params }
}

function decodeParam(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function buildQueryString(params: ParamEntry[]): string {
  const enabled = params.filter((p) => p.enabled && p.key.trim())
  if (enabled.length === 0) return ''
  return enabled
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&')
}

export function QueryParamsEditor() {
  const parsed = useAppStore((s) => s.parsed)
  const [params, setParams] = useState<ParamEntry[]>([])
  const [baseUrl, setBaseUrl] = useState('')
  const selfUpdate = useRef(false)

  useEffect(() => {
    if (selfUpdate.current) {
      selfUpdate.current = false
      return
    }
    if (parsed) {
      const { baseUrl: bu, params: ps } = parseQueryParams(parsed.url)
      setBaseUrl(bu)
      setParams(ps)
    }
  }, [parsed?.url])

  if (!parsed) return null

  const applyChanges = (newParams: ParamEntry[], newBaseUrl?: string) => {
    const base = newBaseUrl ?? baseUrl
    const qs = buildQueryString(newParams)
    const newUrl = qs ? `${base}?${qs}` : base
    const s = useAppStore.getState()
    const currentParsed = s.parsed
    if (!currentParsed) return
    const rebuilt = rebuildFromParsed(currentParsed, { url: newUrl })
    s.setRawContent(rebuilt)
    selfUpdate.current = true
    s.setParsed({ ...currentParsed, url: newUrl })
  }

  const updateParam = (index: number, field: keyof ParamEntry, value: string | boolean) => {
    const newParams = [...params]
    newParams[index] = { ...newParams[index], [field]: value }
    setParams(newParams)
    applyChanges(newParams)
  }

  const addParam = () => {
    setParams([...params, { enabled: true, key: '', value: '' }])
  }

  const removeParam = (index: number) => {
    const newParams = params.filter((_, i) => i !== index)
    setParams(newParams)
    applyChanges(newParams)
  }

  return (
    <div className="overflow-auto h-full p-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-700">
            <th className="py-2 w-8"></th>
            <th className="px-2 py-2 font-medium">Key</th>
            <th className="px-2 py-2 font-medium">Value</th>
            <th className="py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {params.map((param, i) => (
            <tr key={i} className="group">
              <td className="py-1 text-center">
                <input
                  type="checkbox"
                  checked={param.enabled}
                  onChange={(e) => updateParam(i, 'enabled', e.target.checked)}
                  className="accent-red-500"
                />
              </td>
              <td className="pr-2 py-1">
                <input
                  value={param.key}
                  onChange={(e) => updateParam(i, 'key', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-gray-200 outline-none focus:border-red-500"
                  placeholder="key"
                />
              </td>
              <td className="pr-2 py-1">
                <input
                  value={param.value}
                  onChange={(e) => updateParam(i, 'value', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-gray-200 outline-none focus:border-red-500"
                  placeholder="value"
                />
              </td>
              <td className="py-1">
                <button
                  onClick={() => removeParam(i)}
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
        onClick={addParam}
        className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        + Add parameter
      </button>
    </div>
  )
}

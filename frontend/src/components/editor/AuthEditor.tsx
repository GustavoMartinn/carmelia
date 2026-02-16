import { useEffect, useState, useRef } from 'react'
import { useAppStore, type AuthConfig, type AuthType } from '../../store/appStore'
import { rebuildFromParsed } from '../../utils/httpRebuilder'
import { ParseRequest } from '../../../wailsjs/go/main/App'

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'apikey', label: 'API Key' },
]

const ADD_TO_OPTIONS: { value: 'header' | 'query'; label: string }[] = [
  { value: 'header', label: 'Header' },
  { value: 'query', label: 'Query Parameter' },
]

function Dropdown<T extends string>({
  value,
  options,
  onChange,
  width = 'w-48',
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (val: T) => void
  width?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const activeLabel = options.find((o) => o.value === value)?.label ?? value

  return (
    <div className={`relative ${width}`} ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none hover:border-gray-600 focus:border-red-500 flex items-center justify-between"
      >
        <span>{activeLabel}</span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <ul className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-full py-1">
          {options.map((opt) => (
            <li
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className={`px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                value === opt.value
                  ? 'bg-gray-700/50 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function detectAuthFromHeaders(headers: Record<string, string>): AuthConfig | null {
  const auth = headers['Authorization'] || headers['authorization']
  if (!auth) return null

  if (auth.startsWith('Bearer ')) {
    return { type: 'bearer', bearer: { token: auth.substring(7) } }
  }
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.substring(6))
      const colonIdx = decoded.indexOf(':')
      if (colonIdx >= 0) {
        return {
          type: 'basic',
          basic: {
            username: decoded.substring(0, colonIdx),
            password: decoded.substring(colonIdx + 1),
          },
        }
      }
    } catch { /* invalid base64 */ }
  }
  return null
}

export function AuthEditor() {
  const parsed = useAppStore((s) => s.parsed)
  const authConfig = useAppStore((s) => s.authConfig)
  const setAuthConfig = useAppStore((s) => s.setAuthConfig)

  // Auto-detect auth from headers on first load
  useEffect(() => {
    if (parsed && authConfig.type === 'none') {
      const detected = detectAuthFromHeaders(parsed.headers)
      if (detected) setAuthConfig(detected)
    }
  }, [parsed?.headers])

  if (!parsed) return null

  const applyAuth = async (config: AuthConfig) => {
    setAuthConfig(config)
    const s = useAppStore.getState()
    const currentParsed = s.parsed
    if (!currentParsed) return

    const newHeaders = { ...currentParsed.headers }

    // Remove existing auth headers
    delete newHeaders['Authorization']
    delete newHeaders['authorization']

    if (config.type === 'bearer' && config.bearer?.token) {
      newHeaders['Authorization'] = `Bearer ${config.bearer.token}`
    } else if (config.type === 'basic' && config.basic) {
      const encoded = btoa(`${config.basic.username}:${config.basic.password}`)
      newHeaders['Authorization'] = `Basic ${encoded}`
    } else if (config.type === 'apikey' && config.apikey?.addTo === 'header' && config.apikey.key) {
      newHeaders[config.apikey.key] = config.apikey.value
    }

    // For API Key added to query, we handle it in the URL
    let newUrl = currentParsed.url
    if (config.type === 'apikey' && config.apikey?.addTo === 'query' && config.apikey.key) {
      const base = currentParsed.url.split('?')[0]
      const existingQs = currentParsed.url.split('?')[1] || ''
      const existingParams = existingQs ? existingQs.split('&').filter((p) => !p.startsWith(config.apikey!.key + '=')) : []
      existingParams.push(`${encodeURIComponent(config.apikey.key)}=${encodeURIComponent(config.apikey.value)}`)
      newUrl = `${base}?${existingParams.join('&')}`
    }

    const rebuilt = rebuildFromParsed(currentParsed, { headers: newHeaders, url: newUrl })
    s.setRawContent(rebuilt)
    const reParsed = await ParseRequest(rebuilt)
    s.setParsed(reParsed)
  }

  const handleTypeChange = (type: AuthType) => {
    const newConfig: AuthConfig = { type }
    if (type === 'bearer') newConfig.bearer = { token: authConfig.bearer?.token || '' }
    if (type === 'basic') newConfig.basic = { username: authConfig.basic?.username || '', password: authConfig.basic?.password || '' }
    if (type === 'apikey') newConfig.apikey = { key: authConfig.apikey?.key || '', value: authConfig.apikey?.value || '', addTo: authConfig.apikey?.addTo || 'header' }
    applyAuth(newConfig)
  }

  return (
    <div className="overflow-auto h-full p-4">
      <div className="mb-4">
        <label className="text-xs text-gray-500 uppercase font-medium block mb-1">Type</label>
        <Dropdown
          value={authConfig.type}
          options={AUTH_TYPES}
          onChange={handleTypeChange}
        />
      </div>

      {authConfig.type === 'bearer' && (
        <div>
          <label className="text-xs text-gray-500 uppercase font-medium block mb-1">Token</label>
          <input
            value={authConfig.bearer?.token || ''}
            onChange={(e) => applyAuth({ ...authConfig, bearer: { token: e.target.value } })}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono text-gray-200 outline-none focus:border-red-500"
            placeholder="{{token}} or paste token"
          />
          <p className="mt-1 text-[10px] text-gray-600">Supports {'{{variables}}'}</p>
        </div>
      )}

      {authConfig.type === 'basic' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 uppercase font-medium block mb-1">Username</label>
            <input
              value={authConfig.basic?.username || ''}
              onChange={(e) =>
                applyAuth({ ...authConfig, basic: { username: e.target.value, password: authConfig.basic?.password || '' } })
              }
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono text-gray-200 outline-none focus:border-red-500"
              placeholder="username"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase font-medium block mb-1">Password</label>
            <input
              type="password"
              value={authConfig.basic?.password || ''}
              onChange={(e) =>
                applyAuth({ ...authConfig, basic: { username: authConfig.basic?.username || '', password: e.target.value } })
              }
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono text-gray-200 outline-none focus:border-red-500"
              placeholder="password"
            />
          </div>
        </div>
      )}

      {authConfig.type === 'apikey' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 uppercase font-medium block mb-1">Key</label>
            <input
              value={authConfig.apikey?.key || ''}
              onChange={(e) =>
                applyAuth({
                  ...authConfig,
                  apikey: { key: e.target.value, value: authConfig.apikey?.value || '', addTo: authConfig.apikey?.addTo || 'header' },
                })
              }
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono text-gray-200 outline-none focus:border-red-500"
              placeholder="X-API-Key"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase font-medium block mb-1">Value</label>
            <input
              value={authConfig.apikey?.value || ''}
              onChange={(e) =>
                applyAuth({
                  ...authConfig,
                  apikey: { key: authConfig.apikey?.key || '', value: e.target.value, addTo: authConfig.apikey?.addTo || 'header' },
                })
              }
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono text-gray-200 outline-none focus:border-red-500"
              placeholder="{{api_key}}"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase font-medium block mb-1">Add to</label>
            <Dropdown
              value={authConfig.apikey?.addTo || 'header'}
              options={ADD_TO_OPTIONS}
              onChange={(val) =>
                applyAuth({
                  ...authConfig,
                  apikey: { key: authConfig.apikey?.key || '', value: authConfig.apikey?.value || '', addTo: val },
                })
              }
            />
          </div>
        </div>
      )}

      {authConfig.type === 'none' && (
        <p className="text-xs text-gray-600">No authentication configured for this request.</p>
      )}
    </div>
  )
}

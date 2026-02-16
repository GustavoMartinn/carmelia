import { useState, useEffect, useRef } from 'react'
import { useAppStore, type ParamDoc } from '../../store/appStore'
import { ParseRequest } from '../../../wailsjs/go/main/App'

const LOCATION_OPTIONS = [
  { value: 'query', label: 'query' },
  { value: 'header', label: 'header' },
  { value: 'path', label: 'path' },
  { value: 'body', label: 'body' },
]

function LocationDropdown({ value, onChange }: { value: string; onChange: (val: string) => void }) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none hover:border-gray-600 focus:border-red-500 flex items-center justify-between"
      >
        <span>{value}</span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ml-1 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <ul className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-full py-1">
          {LOCATION_OPTIONS.map((opt) => (
            <li
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false) }}
              className={`px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                value === opt.value ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700'
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

export function DocsEditor() {
  const parsed = useAppStore((s) => s.parsed)
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [params, setParams] = useState<ParamDoc[]>([])

  useEffect(() => {
    if (parsed?.docs) {
      setSummary(parsed.docs.summary || '')
      setDescription(parsed.docs.description || '')
      setParams(parsed.docs.params || [])
    }
  }, [parsed?.docs])

  if (!parsed) return null

  const applyChanges = async (newSummary: string, newDescription: string, newParams: ParamDoc[]) => {
    const s = useAppStore.getState()
    const currentParsed = s.parsed
    if (!currentParsed) return

    // Rebuild comments: remove old doc annotations, add new ones
    const nonDocComments = currentParsed.comments.filter(
      (c) => !c.startsWith('@summary ') && !c.startsWith('@description ') && !c.startsWith('@param ')
    )

    const docComments: string[] = []
    if (newSummary.trim()) docComments.push(`@summary ${newSummary.trim()}`)
    if (newDescription.trim()) docComments.push(`@description ${newDescription.trim()}`)
    for (const p of newParams) {
      if (p.name.trim()) {
        docComments.push(`@param ${p.name.trim()} ${p.location} ${p.description}`.trimEnd())
      }
    }

    const allComments = [...docComments, ...nonDocComments]

    // Rebuild the raw content
    const lines: string[] = []
    for (const comment of allComments) {
      lines.push(`# ${comment}`)
    }
    if (allComments.length > 0) lines.push('')
    lines.push(`${currentParsed.method} ${currentParsed.url}`)
    for (const [key, value] of Object.entries(currentParsed.headers)) {
      lines.push(`${key}: ${value}`)
    }
    if (currentParsed.body) {
      lines.push('')
      lines.push(currentParsed.body)
    }

    const rebuilt = lines.join('\n')
    s.setRawContent(rebuilt)
    const reParsed = await ParseRequest(rebuilt)
    s.setParsed(reParsed)
  }

  const updateSummary = (value: string) => {
    setSummary(value)
    applyChanges(value, description, params)
  }

  const updateDescription = (value: string) => {
    setDescription(value)
    applyChanges(summary, value, params)
  }

  const updateParam = (index: number, field: keyof ParamDoc, value: string) => {
    const newParams = [...params]
    newParams[index] = { ...newParams[index], [field]: value }
    setParams(newParams)
    applyChanges(summary, description, newParams)
  }

  const addParam = () => {
    setParams([...params, { name: '', location: 'query', description: '' }])
  }

  const removeParam = (index: number) => {
    const newParams = params.filter((_, i) => i !== index)
    setParams(newParams)
    applyChanges(summary, description, newParams)
  }

  return (
    <div className="overflow-auto h-full p-4 space-y-4">
      <div>
        <label className="text-xs text-gray-500 uppercase font-medium block mb-1">Summary</label>
        <input
          value={summary}
          onChange={(e) => updateSummary(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-red-500"
          placeholder="Brief summary of the endpoint"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase font-medium block mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => updateDescription(e.target.value)}
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-red-500 resize-y"
          placeholder="Detailed description of what this endpoint does"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase font-medium block mb-2">Parameters</label>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-700">
              <th className="px-2 py-1 font-medium">Name</th>
              <th className="px-2 py-1 font-medium">Location</th>
              <th className="px-2 py-1 font-medium">Description</th>
              <th className="py-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {params.map((param, i) => (
              <tr key={i} className="group">
                <td className="pr-2 py-1">
                  <input
                    value={param.name}
                    onChange={(e) => updateParam(i, 'name', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-gray-200 outline-none focus:border-red-500"
                    placeholder="name"
                  />
                </td>
                <td className="pr-2 py-1">
                  <LocationDropdown
                    value={param.location}
                    onChange={(val) => updateParam(i, 'location', val)}
                  />
                </td>
                <td className="pr-2 py-1">
                  <input
                    value={param.description}
                    onChange={(e) => updateParam(i, 'description', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-red-500"
                    placeholder="Description"
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
    </div>
  )
}

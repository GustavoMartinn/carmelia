import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'

interface Props {
  side: 'left' | 'right'
}

export function DiffSourcePicker({ side }: Props) {
  const response = useAppStore((s) => s.response)
  const historyEntries = useAppStore((s) => s.historyEntries)
  const setDiffLeftBody = useAppStore((s) => s.setDiffLeftBody)
  const setDiffRightBody = useAppStore((s) => s.setDiffRightBody)

  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState('current')
  const ref = useRef<HTMLDivElement>(null)

  const setBody = side === 'left' ? setDiffLeftBody : setDiffRightBody

  // entries[0] is the current response (just saved by the goroutine),
  // so "previous" = entries[1] and the history list starts at entries[1].
  const previousEntries = historyEntries.slice(1)

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Auto-update diff body when response changes and "current" is selected
  useEffect(() => {
    if (selected === 'current' && response) {
      setBody(entryBody(response))
    }
  }, [response])

  // Auto-update when "previous" is selected and history changes
  useEffect(() => {
    if (selected === 'previous' && previousEntries.length > 0) {
      setBody(entryBody(previousEntries[0]))
    }
  }, [historyEntries])

  const entryBody = (entry: { response?: { body?: string }; error?: string } | null) => {
    if (!entry) return ''
    if (entry.error) return `Error: ${entry.error}`
    return entry.response?.body || ''
  }

  const resolveBody = (value: string) => {
    if (value === 'current') return entryBody(response)
    if (value === 'previous') return previousEntries.length > 0 ? entryBody(previousEntries[0]) : ''
    const entry = previousEntries.find((e) => e.id === value)
    return entryBody(entry || null)
  }

  const handleSelect = (value: string) => {
    setSelected(value)
    setIsOpen(false)
    setBody(resolveBody(value))
  }

  const formatEntry = (index: number, timestamp: number, status: number | undefined, err?: string) => {
    const statusText = err ? 'ERR' : (status || 'ERR')
    return `(${index}) ${new Date(timestamp).toLocaleString()} - ${statusText}`
  }

  const getLabel = () => {
    if (selected === 'current') return '(0) Current response'
    if (selected === 'previous') {
      if (previousEntries.length === 0) return '(1) Previous response'
      const e = previousEntries[0]
      return formatEntry(1, e.timestamp, e.response?.status, e.error)
    }
    const idx = previousEntries.findIndex((e) => e.id === selected)
    if (idx < 0) return '(0) Current response'
    const e = previousEntries[idx]
    return formatEntry(idx + 2, e.timestamp, e.response?.status, e.error)
  }

  const hasPrevious = previousEntries.length > 0

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 uppercase">{side}</span>
      <div className="relative flex-1" ref={ref}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none hover:border-gray-600 focus:border-red-500 flex items-center justify-between"
        >
          <span className="truncate">{getLabel()}</span>
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && (
          <ul className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-full py-1 max-h-48 overflow-auto">
            <li
              onClick={() => handleSelect('current')}
              className={`px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                selected === 'current' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              (0) Current response
            </li>
            {hasPrevious && (
              <li
                onClick={() => handleSelect('previous')}
                className={`px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  selected === 'previous' ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                (1) Previous response
              </li>
            )}
            {previousEntries.length > 0 && (
              <li className="border-t border-gray-700 my-1" />
            )}
            {previousEntries.map((entry, i) => (
              <li
                key={entry.id}
                onClick={() => handleSelect(entry.id)}
                className={`px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  selected === entry.id ? 'bg-gray-700/50 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {formatEntry(i + 2, entry.timestamp, entry.response?.status, entry.error)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

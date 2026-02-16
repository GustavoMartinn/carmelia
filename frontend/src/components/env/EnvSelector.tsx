import { useState, useRef, useEffect } from 'react'
import { useAppStore, getActiveProject } from '../../store/appStore'
import { GetEnvForProject, SaveEnvForProject, ListEnvsForProject, RenameEnvForProject } from '../../../wailsjs/go/main/App'

type InputMode = null | 'create' | 'rename'

export function EnvSelector() {
  const activeProject = useAppStore((s) => getActiveProject(s))
  const activeProjectIndex = useAppStore((s) => s.activeProjectIndex)
  const updateProject = useAppStore((s) => s.updateProject)
  const setShowEnvEditor = useAppStore((s) => s.setShowEnvEditor)

  const [isOpen, setIsOpen] = useState(false)
  const [inputMode, setInputMode] = useState<InputMode>(null)
  const [inputValue, setInputValue] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        resetInput()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (inputMode && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [inputMode])

  const resetInput = () => {
    setInputMode(null)
    setInputValue('')
  }

  if (!activeProject) return null

  const handleChange = async (envName: string) => {
    setIsOpen(false)
    resetInput()
    updateProject(activeProjectIndex, { activeEnv: envName })
    if (envName && activeProject) {
      try {
        const vars = await GetEnvForProject(activeProject.path, envName)
        updateProject(activeProjectIndex, { envVariables: vars || {} })
      } catch {
        updateProject(activeProjectIndex, { envVariables: {} })
      }
    } else {
      updateProject(activeProjectIndex, { envVariables: {} })
    }
  }

  const refreshEnvs = async () => {
    if (!activeProject) return
    const envs = await ListEnvsForProject(activeProject.path)
    updateProject(activeProjectIndex, { envs: envs || [] })
  }

  const handleCreate = async () => {
    const name = inputValue.trim()
    if (!name || !activeProject) return
    try {
      await SaveEnvForProject(activeProject.path, name, {})
      await refreshEnvs()
      handleChange(name)
    } catch { /* ignore */ }
  }

  const handleRename = async () => {
    const newName = inputValue.trim()
    if (!newName || !activeProject || !activeProject.activeEnv || newName === activeProject.activeEnv) return
    try {
      await RenameEnvForProject(activeProject.path, activeProject.activeEnv, newName)
      await refreshEnvs()
      handleChange(newName)
    } catch { /* ignore */ }
  }

  const handleInputConfirm = () => {
    if (inputMode === 'create') handleCreate()
    else if (inputMode === 'rename') handleRename()
  }

  const handleDuplicate = async () => {
    if (!activeProject || !activeProject.activeEnv) return
    const baseName = activeProject.activeEnv
    let dupName = `${baseName}-copy`
    let i = 2
    while (activeProject.envs.includes(dupName)) {
      dupName = `${baseName}-copy-${i++}`
    }
    try {
      const vars = await GetEnvForProject(activeProject.path, baseName)
      await SaveEnvForProject(activeProject.path, dupName, vars || {})
      await refreshEnvs()
      handleChange(dupName)
    } catch { /* ignore */ }
  }

  const startRename = () => {
    setInputMode('rename')
    setInputValue(activeProject.activeEnv || '')
  }

  const options = [{ value: '', label: 'none' }, ...activeProject.envs.map((env) => ({ value: env, label: env }))]
  const activeLabel = activeProject.activeEnv || 'none'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">env:</span>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 outline-none hover:border-gray-600 focus:border-red-500 flex items-center gap-1.5 min-w-[80px] justify-between"
        >
          <span>{activeLabel}</span>
          <svg className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && (
          <ul className="absolute top-full right-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-[180px] py-1 max-h-64 overflow-auto">
            {options.map((opt) => (
              <li
                key={opt.value}
                onClick={() => handleChange(opt.value)}
                className={`px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  activeProject.activeEnv === opt.value
                    ? 'bg-gray-700/50 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </li>
            ))}
            <li className="border-t border-gray-700 my-1" />
            {inputMode ? (
              <li className="px-3 py-1 flex items-center gap-1">
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInputConfirm()
                    if (e.key === 'Escape') resetInput()
                  }}
                  placeholder={inputMode === 'rename' ? 'new name' : 'env name'}
                  className="flex-1 bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-200 outline-none focus:border-red-500 min-w-0"
                />
                <button
                  onClick={handleInputConfirm}
                  className="text-xs text-green-400 hover:text-green-300 px-1"
                >
                  &#10003;
                </button>
              </li>
            ) : (
              <li
                onClick={() => { setInputMode('create'); setInputValue('') }}
                className="px-3 py-1.5 text-xs cursor-pointer text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
              >
                + New environment
              </li>
            )}
            {activeProject.activeEnv && !inputMode && (
              <>
                <li
                  onClick={startRename}
                  className="px-3 py-1.5 text-xs cursor-pointer text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Rename "{activeProject.activeEnv}"
                </li>
                <li
                  onClick={handleDuplicate}
                  className="px-3 py-1.5 text-xs cursor-pointer text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Duplicate "{activeProject.activeEnv}"
                </li>
              </>
            )}
          </ul>
        )}
      </div>
      {activeProject.activeEnv && (
        <button
          onClick={() => setShowEnvEditor(true)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          title="Edit environment"
        >
          &#9998;
        </button>
      )}
    </div>
  )
}

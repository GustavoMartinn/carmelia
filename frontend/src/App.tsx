import { useEffect, useCallback, useRef, useState } from 'react'
import './App.css'
import { useAppStore, getActiveProject, type RequestTab } from './store/appStore'
import { AppLayout } from './components/layout/AppLayout'
import { EnvSelector } from './components/env/EnvSelector'
import { EnvEditor } from './components/env/EnvEditor'
import { ProjectTabs } from './components/layout/ProjectTabs'
import {
  OpenProject,
  GetFileTreeForProject,
  ListEnvsForProject,
  GetEnvForProject,
  ExecuteRequest,
  SaveRequestToProject,
  SyncProject,
  LoadOpenProjects,
  SaveOpenProjects,
  ExportCollection,
  GetPlaygroundPath,
  ReadRequestFromProject,
  ParseRequest,
} from '../wailsjs/go/main/App'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'
import { CreateRequestModal } from './components/playground/CreateRequestModal'
import { CreateFolderModal } from './components/playground/CreateFolderModal'
import { ImportCurlModal } from './components/playground/ImportCurlModal'
import { DeleteConfirmModal } from './components/playground/DeleteConfirmModal'
import { SettingsModal } from './components/settings/SettingsModal'

function App() {
  const projects = useAppStore((s) => s.projects)
  const activeProjectIndex = useAppStore((s) => s.activeProjectIndex)
  const addProject = useAppStore((s) => s.addProject)
  const updateProject = useAppStore((s) => s.updateProject)
  const setError = useAppStore((s) => s.setError)
  const error = useAppStore((s) => s.error)
  const syncing = useAppStore((s) => s.syncing)
  const setSyncing = useAppStore((s) => s.setSyncing)
  const syncOutput = useAppStore((s) => s.syncOutput)
  const setSyncOutput = useAppStore((s) => s.setSyncOutput)

  const activeProject = useAppStore((s) => getActiveProject(s))

  // Guard to avoid saving empty state before restore completes
  const restoredRef = useRef(false)

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  const loadProjectData = useCallback(async (path: string, projectIndex: number, savedEnv?: string) => {
    try {
      const tree = await GetFileTreeForProject(path)
      updateProject(projectIndex, { fileTree: tree || [] })

      const envList = await ListEnvsForProject(path)
      updateProject(projectIndex, { envs: envList || [] })

      // Use saved env if it still exists, otherwise fall back to first env
      const envToUse = savedEnv && envList?.includes(savedEnv) ? savedEnv : (envList?.[0] || '')
      if (envToUse) {
        updateProject(projectIndex, { activeEnv: envToUse })
        try {
          const vars = await GetEnvForProject(path, envToUse)
          updateProject(projectIndex, { envVariables: vars || {} })
        } catch {}
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load project data')
    }
  }, [updateProject, setError])

  // Restore session on mount + init playground
  useEffect(() => {
    (async () => {
      try {
        // Ensure playground exists and get its path
        let pgPath: string | null = null
        try {
          pgPath = await GetPlaygroundPath()
          useAppStore.getState().setPlaygroundPath(pgPath)
        } catch {
          // playground init failed — not critical
        }

        const state = await LoadOpenProjects()
        const savedPaths = state.projectPaths && state.projectPaths.length > 0 ? state.projectPaths : []
        const sessions = state.projectSessions || {}

        // Build final list: playground first, then saved projects (deduped)
        const allPaths: string[] = []
        const seenPaths = new Set<string>()
        if (pgPath) {
          allPaths.push(pgPath)
          seenPaths.add(pgPath)
        }
        for (const p of savedPaths) {
          if (!seenPaths.has(p)) {
            seenPaths.add(p)
            allPaths.push(p)
          }
        }

        for (let i = 0; i < allPaths.length; i++) {
          const path = allPaths[i]
          const name = path === pgPath ? 'Playground' : (path.split('/').pop() || path)
          addProject({
            path,
            name,
            fileTree: [],
            envs: [],
            activeEnv: '',
            envVariables: {},
          })
        }

        // Load data for each project (with saved env)
        for (let i = 0; i < allPaths.length; i++) {
          const ps = sessions[allPaths[i]]
          await loadProjectData(allPaths[i], i, ps?.activeEnv)
        }

        // Restore active index (offset by playground if it wasn't in the saved list)
        let savedIndex = state.activeProjectIndex || 0
        if (pgPath && !savedPaths.includes(pgPath)) {
          savedIndex = savedIndex + 1
        }
        if (savedIndex >= allPaths.length) savedIndex = 0

        // Build tabs for each project directly (avoid setActiveProjectIndex which triggers tab snapshot save/restore)
        const newTabsMap: Record<string, { openTabs: RequestTab[], activeTabIndex: number }> = {}
        for (let i = 0; i < allPaths.length; i++) {
          const ps = sessions[allPaths[i]]
          const savedTabs = ps?.openTabs as { filePath: string; isClone?: boolean; rawContent?: string; requestVars?: Record<string, string> }[] | undefined
          if (!savedTabs?.length) continue
          const projectPath = allPaths[i]
          const tabs: RequestTab[] = []

          for (const savedTab of savedTabs) {
            try {
              let content: string
              let originalContent: string

              if (savedTab.isClone && savedTab.rawContent) {
                // Clone: use saved content (file on disk is the original)
                content = savedTab.rawContent
                // Read disk version for originalContent reference
                try {
                  originalContent = await ReadRequestFromProject(projectPath, savedTab.filePath)
                } catch {
                  originalContent = content
                }
              } else {
                // Normal tab: read from disk
                content = await ReadRequestFromProject(projectPath, savedTab.filePath)
                originalContent = content
              }

              const parsed = await ParseRequest(content)
              const fileName = savedTab.filePath.split('/').pop() || savedTab.filePath
              tabs.push({
                filePath: savedTab.filePath,
                fileName,
                method: parsed?.method || 'GET',
                rawContent: content,
                originalContent,
                defaultContent: originalContent,
                parsed,
                response: null,
                loading: false,
                requestVars: savedTab.requestVars || {},
                editorTab: 'body',
                responseTab: 'body',
                authConfig: { type: 'none' },
                historyEntries: [],
                selectedHistoryEntry: null,
                instanceId: crypto.randomUUID(),
                isClone: savedTab.isClone || false,
              })
            } catch { /* file may have been deleted */ }
          }

          if (tabs.length > 0) {
            const tabIdx = (ps.activeTabIndex >= 0 && ps.activeTabIndex < tabs.length) ? ps.activeTabIndex : 0
            newTabsMap[projectPath] = { openTabs: tabs, activeTabIndex: tabIdx }
          }
        }

        // Inject tabs and set active project in one atomic update
        const activeProjectPath = allPaths[savedIndex]
        const activeTabs = activeProjectPath ? newTabsMap[activeProjectPath] : undefined
        const restoredTabs = activeTabs?.openTabs ?? []
        const restoredTabIdx = activeTabs?.activeTabIndex ?? 0
        const activeTab = restoredTabs[restoredTabIdx]

        useAppStore.setState({
          projectTabsMap: { ...useAppStore.getState().projectTabsMap, ...newTabsMap },
          activeProjectIndex: savedIndex,
          openTabs: restoredTabs,
          activeTabIndex: restoredTabIdx,
          activeFile: activeTab?.filePath ?? null,
          rawContent: activeTab?.rawContent ?? '',
          originalContent: activeTab?.originalContent ?? '',
          parsed: activeTab?.parsed ?? null,
          response: null,
          loading: false,
          requestVars: activeTab?.requestVars ?? {},
          editorTab: activeTab?.editorTab ?? 'body',
          responseTab: activeTab?.responseTab ?? 'body',
          authConfig: activeTab?.authConfig ?? { type: 'none' },
          historyEntries: [],
          selectedHistoryEntry: null,
        })
      } catch {
        // No saved state — that's fine, still try playground
        try {
          const pgPath = await GetPlaygroundPath()
          useAppStore.getState().setPlaygroundPath(pgPath)
          addProject({
            path: pgPath,
            name: 'Playground',
            fileTree: [],
            envs: [],
            activeEnv: '',
            envVariables: {},
          })
          await loadProjectData(pgPath, 0)
        } catch {
          // Nothing to do
        }
      } finally {
        restoredRef.current = true
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist session when projects, active index, envs, or tabs change
  const openTabs = useAppStore((s) => s.openTabs)
  const activeTabIndex = useAppStore((s) => s.activeTabIndex)
  const projectTabsMap = useAppStore((s) => s.projectTabsMap)

  useEffect(() => {
    if (!restoredRef.current) return

    const timer = setTimeout(() => {
      // Use getState() for everything to avoid stale closures
      const s = useAppStore.getState()
      const seen = new Set<string>()
      const paths = s.projects.map((p) => p.path).filter((p) => {
        if (seen.has(p)) return false
        seen.add(p)
        return true
      })

      // Build per-project session data (including clones with their content)
      const projectSessions: Record<string, { activeEnv: string; openTabs: { filePath: string; isClone?: boolean; rawContent?: string; requestVars?: Record<string, string> }[]; activeTabIndex: number }> = {}
      for (const project of s.projects) {
        const isActive = project.path === s.projects[s.activeProjectIndex]?.path
        const tabs = isActive ? s.openTabs : (s.projectTabsMap[project.path]?.openTabs || [])
        const tabIdx = isActive ? s.activeTabIndex : (s.projectTabsMap[project.path]?.activeTabIndex || 0)

        projectSessions[project.path] = {
          activeEnv: project.activeEnv || '',
          openTabs: tabs.map(t => ({
            filePath: t.filePath,
            ...(t.isClone ? { isClone: true, rawContent: t.rawContent } : {}),
            ...(Object.keys(t.requestVars).length > 0 ? { requestVars: t.requestVars } : {}),
          })),
          activeTabIndex: tabIdx,
        }
      }

      SaveOpenProjects({
        projectPaths: paths,
        activeProjectIndex: s.activeProjectIndex,
        projectSessions,
      } as any).catch(() => {})
    }, 300)

    return () => clearTimeout(timer)
  }, [projects, activeProjectIndex, openTabs, activeTabIndex, projectTabsMap])

  const handleOpenProject = useCallback(async () => {
    try {
      const path = await OpenProject()
      if (!path) return

      // Check if already open
      const existing = useAppStore.getState().projects.findIndex((p) => p.path === path)
      if (existing >= 0) {
        useAppStore.getState().setActiveProjectIndex(existing)
        return
      }

      const name = path.split('/').pop() || path

      addProject({
        path,
        name,
        fileTree: [],
        envs: [],
        activeEnv: '',
        envVariables: {},
      })

      // Sync first, then load
      const newIndex = useAppStore.getState().projects.length - 1
      setSyncing(true)
      setSyncOutput('')

      EventsOn('sync:line', (line: string) => {
        const current = useAppStore.getState().syncOutput
        setSyncOutput(current ? current + '\n' + line : line)
      })

      try {
        const output = await SyncProject(path)
        setSyncOutput(output)
      } catch (err: any) {
        // Sync failed — maybe no framework detected, still try to load tree
        setSyncOutput(err?.message || 'Sync failed')
      } finally {
        EventsOff('sync:line')
        setSyncing(false)
      }

      await loadProjectData(path, newIndex)
    } catch (err: any) {
      setError(err?.message || 'Failed to open project')
    }
  }, [addProject, setError, loadProjectData, setSyncing, setSyncOutput])

  const handleSync = useCallback(async () => {
    if (!activeProject || syncing) return
    setSyncing(true)
    setSyncOutput('')
    setError(null)

    EventsOn('sync:line', (line: string) => {
      const current = useAppStore.getState().syncOutput
      setSyncOutput(current ? current + '\n' + line : line)
    })

    try {
      const output = await SyncProject(activeProject.path)
      setSyncOutput(output)
      // Reload file tree after sync
      await loadProjectData(activeProject.path, activeProjectIndex)
    } catch (err: any) {
      setError(err?.message || 'Sync failed')
    } finally {
      EventsOff('sync:line')
      setSyncing(false)
    }
  }, [activeProject, activeProjectIndex, syncing, setSyncing, setSyncOutput, setError, loadProjectData])

  const handleExport = useCallback(async (format: string) => {
    setShowExportMenu(false)
    if (!activeProject) return
    try {
      const savedPath = await ExportCollection(activeProject.path, format)
      if (savedPath) {
        setSyncOutput(`Exported to ${savedPath}`)
      }
    } catch (err: any) {
      setError(err?.message || 'Export failed')
    }
  }, [activeProject, setError, setSyncOutput])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useAppStore.getState()
      const project = getActiveProject(state)

      // Ctrl+Enter: Send request
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        const activeTab = state.openTabs[state.activeTabIndex]
        if (state.rawContent && !state.loading && project && activeTab) {
          const targetInstanceId = activeTab.instanceId
          state.setLoading(true)
          state.setResponse(null)
          state.setError(null)
          ExecuteRequest(state.rawContent, project.activeEnv, project.path, state.requestVars, state.activeFile || '')
            .then((result) => {
              useAppStore.getState().updateTabByInstanceId(targetInstanceId, { response: result, loading: false })
              if (result.error) state.setError(result.error)
            })
            .catch((err) => {
              state.setError(err?.message || 'Request failed')
              useAppStore.getState().updateTabByInstanceId(targetInstanceId, { loading: false })
            })
        }
      }

      // Ctrl+S: Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        const activeTab = state.openTabs[state.activeTabIndex]
        if (state.activeFile && state.rawContent !== state.originalContent && project && activeTab) {
          const targetInstanceId = activeTab.instanceId
          const contentToSave = state.rawContent
          SaveRequestToProject(project.path, state.activeFile, contentToSave)
            .then(() => useAppStore.getState().updateTabByInstanceId(targetInstanceId, { originalContent: contentToSave }))
            .catch((err) => state.setError(err?.message || 'Save failed'))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenProject}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
          >
            Open Project
          </button>
          {activeProject && (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                title="Scan source code and update .http files"
              >
                {syncing ? (
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-400/30 border-t-gray-400 rounded-full" />
                ) : (
                  <span>&#8635;</span>
                )}
                Sync
              </button>
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                  title="Export collection"
                >
                  Export
                  <svg className={`w-3 h-3 text-gray-400 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showExportMenu && (
                  <ul className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-[160px] py-1">
                    <li
                      onClick={() => handleExport('postman')}
                      className="px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      Postman (v2.1)
                    </li>
                    <li
                      onClick={() => handleExport('insomnia')}
                      className="px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      Insomnia (v4)
                    </li>
                    <li
                      onClick={() => handleExport('openapi')}
                      className="px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      OpenAPI (3.0)
                    </li>
                  </ul>
                )}
              </div>
              <button
                onClick={() => useAppStore.getState().setShowSettings(true)}
                className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
                title="Project settings"
              >
                <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <EnvSelector />
          <span className="text-xs text-gray-600 font-medium tracking-wide">
            Carmelia
          </span>
        </div>
      </div>

      {/* Project tabs */}
      {projects.length > 0 && <ProjectTabs />}

      {/* Sync output toast */}
      {(syncOutput || syncing) && (
        <div className="mx-3 mt-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300 flex items-center justify-between flex-shrink-0">
          <pre className="truncate whitespace-pre-wrap max-h-16 overflow-auto flex-1 font-mono">{syncOutput || 'Starting sync...'}</pre>
          {!syncing && (
            <button
              onClick={() => setSyncOutput(null)}
              className="ml-2 text-blue-400 hover:text-blue-200 flex-shrink-0"
            >
              &#10005;
            </button>
          )}
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 flex items-center justify-between flex-shrink-0">
          <span className="truncate">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-300 flex-shrink-0"
          >
            &#10005;
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0">
        <AppLayout />
      </div>

      {/* Modals */}
      <EnvEditor />
      <CreateRequestModal />
      <CreateFolderModal />
      <ImportCurlModal />
      <DeleteConfirmModal />
      <SettingsModal />
    </div>
  )
}

export default App

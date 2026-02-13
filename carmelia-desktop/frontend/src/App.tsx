import { useEffect, useCallback } from 'react'
import './App.css'
import { useAppStore, getActiveProject } from './store/appStore'
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
} from '../wailsjs/go/main/App'

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

  const loadProjectData = useCallback(async (path: string, projectIndex: number) => {
    try {
      const tree = await GetFileTreeForProject(path)
      updateProject(projectIndex, { fileTree: tree || [] })

      const envList = await ListEnvsForProject(path)
      updateProject(projectIndex, { envs: envList || [] })

      if (envList && envList.length > 0) {
        updateProject(projectIndex, { activeEnv: envList[0] })
        try {
          const vars = await GetEnvForProject(path, envList[0])
          updateProject(projectIndex, { envVariables: vars || {} })
        } catch {}
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load project data')
    }
  }, [updateProject, setError])

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
      setSyncOutput(null)
      try {
        const output = await SyncProject(path)
        setSyncOutput(output)
      } catch (err: any) {
        // Sync failed — maybe no framework detected, still try to load tree
        setSyncOutput(err?.message || 'Sync failed')
      } finally {
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
    setSyncOutput(null)
    setError(null)
    try {
      const output = await SyncProject(activeProject.path)
      setSyncOutput(output)
      // Reload file tree after sync
      await loadProjectData(activeProject.path, activeProjectIndex)
    } catch (err: any) {
      setError(err?.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }, [activeProject, activeProjectIndex, syncing, setSyncing, setSyncOutput, setError, loadProjectData])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useAppStore.getState()
      const project = getActiveProject(state)

      // Ctrl+Enter: Send request
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (state.rawContent && !state.loading && project) {
          state.setLoading(true)
          state.setResponse(null)
          state.setError(null)
          ExecuteRequest(state.rawContent, project.activeEnv, project.path, {})
            .then((result) => {
              state.setResponse(result)
              if (result.error) state.setError(result.error)
            })
            .catch((err) => state.setError(err?.message || 'Request failed'))
            .finally(() => state.setLoading(false))
        }
      }

      // Ctrl+S: Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (state.activeFile && state.rawContent !== state.originalContent && project) {
          SaveRequestToProject(project.path, state.activeFile, state.rawContent)
            .then(() => state.setOriginalContent(state.rawContent))
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
          )}
        </div>

        <div className="flex items-center gap-4">
          <EnvSelector />
          <span className="text-xs text-gray-600 font-medium tracking-wide">
            carmelia
          </span>
        </div>
      </div>

      {/* Project tabs */}
      {projects.length > 0 && <ProjectTabs />}

      {/* Sync output toast */}
      {syncOutput && (
        <div className="mx-3 mt-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300 flex items-center justify-between flex-shrink-0">
          <pre className="truncate whitespace-pre-wrap max-h-16 overflow-auto flex-1 font-mono">{syncOutput}</pre>
          <button
            onClick={() => setSyncOutput(null)}
            className="ml-2 text-blue-500 hover:text-blue-300 flex-shrink-0"
          >
            &#10005;
          </button>
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

      {/* Env editor modal */}
      <EnvEditor />
    </div>
  )
}

export default App

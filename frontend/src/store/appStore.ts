import { create } from 'zustand'

export interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  method?: string
  children?: FileTreeNode[]
}

export interface ParamDoc {
  name: string
  location: string
  description: string
}

export interface RequestDocs {
  summary?: string
  description?: string
  params?: ParamDoc[]
}

export interface ParsedHttpRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  comments: string[]
  docs?: RequestDocs
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
  cookies?: CookieInfo[]
}

export interface RunResult {
  request: ParsedHttpRequest
  response: HttpResponse
  error?: string
}

export interface Project {
  path: string
  name: string
  fileTree: FileTreeNode[]
  envs: string[]
  activeEnv: string
  envVariables: Record<string, string>
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey'

export interface AuthConfig {
  type: AuthType
  bearer?: { token: string }
  basic?: { username: string; password: string }
  apikey?: { key: string; value: string; addTo: 'header' | 'query' }
}

export interface HistoryEntry {
  id: string
  timestamp: number
  request: ParsedHttpRequest
  response: HttpResponse
  error?: string
}

export interface CookieInfo {
  name: string
  value: string
  domain: string
  path: string
  expires: string
  sameSite: string
  maxAge: number
  secure: boolean
  httpOnly: boolean
}

export interface RequestTab {
  filePath: string
  fileName: string
  method: string
  rawContent: string
  originalContent: string
  defaultContent: string
  parsed: ParsedHttpRequest | null
  response: RunResult | null
  loading: boolean
  requestVars: Record<string, string>
  editorTab: 'params' | 'headers' | 'body' | 'raw' | 'variables' | 'auth' | 'docs'
  responseTab: 'body' | 'headers' | 'raw' | 'cookies' | 'history'
  authConfig: AuthConfig
  historyEntries: HistoryEntry[]
  selectedHistoryEntry: HistoryEntry | null
  instanceId: string
  isClone: boolean
}

interface ProjectTabsSnapshot {
  openTabs: RequestTab[]
  activeTabIndex: number
}

export interface DeleteTarget {
  type: 'file' | 'folder'
  relPath: string
  name: string
}

interface AppState {
  // Playground
  playgroundPath: string | null
  setPlaygroundPath: (path: string | null) => void

  // Multi-project
  projects: Project[]
  activeProjectIndex: number
  addProject: (project: Project) => void
  removeProject: (index: number) => void
  setActiveProjectIndex: (index: number) => void
  updateProject: (index: number, partial: Partial<Project>) => void

  // Per-project tab snapshots (keyed by project path)
  projectTabsMap: Record<string, ProjectTabsSnapshot>

  // Request tabs
  openTabs: RequestTab[]
  activeTabIndex: number
  openTab: (filePath: string, fileName: string, method: string, rawContent: string, originalContent: string, parsed: ParsedHttpRequest | null) => void
  closeTab: (index: number) => void
  setActiveTabIndex: (index: number) => void
  updateTabByPath: (filePath: string, partial: Partial<RequestTab>) => void
  updateTabByInstanceId: (instanceId: string, partial: Partial<RequestTab>) => void

  // Active request
  activeFile: string | null
  setActiveFile: (path: string | null) => void

  rawContent: string
  setRawContent: (content: string) => void

  originalContent: string
  setOriginalContent: (content: string) => void

  parsed: ParsedHttpRequest | null
  setParsed: (parsed: ParsedHttpRequest | null) => void

  // Response
  response: RunResult | null
  setResponse: (response: RunResult | null) => void
  loading: boolean
  setLoading: (loading: boolean) => void

  // Sync
  syncing: boolean
  setSyncing: (syncing: boolean) => void
  syncOutput: string | null
  setSyncOutput: (output: string | null) => void

  // UI
  editorTab: 'params' | 'headers' | 'body' | 'raw' | 'variables' | 'auth' | 'docs'
  setEditorTab: (tab: 'params' | 'headers' | 'body' | 'raw' | 'variables' | 'auth' | 'docs') => void
  responseTab: 'body' | 'headers' | 'raw' | 'cookies' | 'history'
  setResponseTab: (tab: 'body' | 'headers' | 'raw' | 'cookies' | 'history') => void
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  showEnvEditor: boolean
  setShowEnvEditor: (show: boolean) => void
  sidebarSearch: string
  setSidebarSearch: (search: string) => void
  error: string | null
  setError: (error: string | null) => void

  // File management modals
  showCreateRequest: boolean
  setShowCreateRequest: (show: boolean) => void
  createRequestParentDir: string
  setCreateRequestParentDir: (dir: string) => void
  showCreateFolder: boolean
  setShowCreateFolder: (show: boolean) => void
  createFolderParentDir: string
  setCreateFolderParentDir: (dir: string) => void
  showImportCurl: boolean
  setShowImportCurl: (show: boolean) => void
  importCurlParentDir: string
  setImportCurlParentDir: (dir: string) => void
  showDeleteConfirm: boolean
  setShowDeleteConfirm: (show: boolean) => void
  deleteTarget: DeleteTarget | null
  setDeleteTarget: (target: DeleteTarget | null) => void

  // Settings
  showSettings: boolean
  setShowSettings: (show: boolean) => void

  // Local request variables
  requestVars: Record<string, string>
  setRequestVars: (vars: Record<string, string>) => void
  setRequestVar: (key: string, value: string) => void

  // Auth
  authConfig: AuthConfig
  setAuthConfig: (config: AuthConfig) => void

  // History
  historyEntries: HistoryEntry[]
  setHistoryEntries: (entries: HistoryEntry[]) => void
  selectedHistoryEntry: HistoryEntry | null
  setSelectedHistoryEntry: (entry: HistoryEntry | null) => void

  // Clone tabs
  cloneTab: (sourceIndex: number) => void

  // Drag & Drop
  draggedNode: FileTreeNode | null
  setDraggedNode: (node: FileTreeNode | null) => void

  // Diff
  diffEnabled: boolean
  setDiffEnabled: (enabled: boolean) => void
  diffLeftBody: string
  setDiffLeftBody: (body: string) => void
  diffRightBody: string
  setDiffRightBody: (body: string) => void
}

// Helper to get the active project
export function getActiveProject(state: AppState): Project | null {
  return state.projects[state.activeProjectIndex] ?? null
}

// Extract top-level fields from the active tab
function syncActiveTabToTopLevel(tabs: RequestTab[], index: number) {
  const tab = tabs[index]
  if (!tab) {
    return {
      activeFile: null,
      rawContent: '',
      originalContent: '',
      parsed: null,
      response: null,
      loading: false,
      requestVars: {},
      editorTab: 'body' as const,
      responseTab: 'body' as const,
      authConfig: { type: 'none' as const },
      historyEntries: [] as HistoryEntry[],
      selectedHistoryEntry: null,
    }
  }
  return {
    activeFile: tab.filePath,
    rawContent: tab.rawContent,
    originalContent: tab.originalContent,
    parsed: tab.parsed,
    response: tab.response,
    loading: tab.loading,
    requestVars: tab.requestVars,
    editorTab: tab.editorTab,
    responseTab: tab.responseTab,
    authConfig: tab.authConfig,
    historyEntries: tab.historyEntries,
    selectedHistoryEntry: tab.selectedHistoryEntry,
  }
}

// Helper to update a field in the active tab and top-level
function writeThrough<K extends keyof RequestTab>(
  s: AppState,
  field: K,
  value: RequestTab[K]
): Partial<AppState> {
  const tabs = [...s.openTabs]
  const tab = tabs[s.activeTabIndex]
  if (tab) {
    tabs[s.activeTabIndex] = { ...tab, [field]: value }
  }
  return { [field]: value, openTabs: tabs } as Partial<AppState>
}

export const useAppStore = create<AppState>((set) => ({
  // Playground
  playgroundPath: null,
  setPlaygroundPath: (path) => set({ playgroundPath: path }),

  // Multi-project
  projects: [],
  activeProjectIndex: 0,
  addProject: (project) =>
    set((s) => {
      // Save current project's tabs before switching
      const currentProject = s.projects[s.activeProjectIndex]
      const newMap = { ...s.projectTabsMap }
      if (currentProject) {
        newMap[currentProject.path] = { openTabs: s.openTabs, activeTabIndex: s.activeTabIndex }
      }
      return {
        projects: [...s.projects, project],
        activeProjectIndex: s.projects.length,
        projectTabsMap: newMap,
        activeFile: null,
        rawContent: '',
        originalContent: '',
        parsed: null,
        response: null,
        requestVars: {},
        openTabs: [],
        activeTabIndex: 0,
      }
    }),
  removeProject: (index) =>
    set((s) => {
      const removedProject = s.projects[index]
      // Block removing the playground project
      if (removedProject && s.playgroundPath && removedProject.path === s.playgroundPath) {
        return {}
      }

      // Save current project's tabs before any removal
      const currentProject = s.projects[s.activeProjectIndex]
      const newMap = { ...s.projectTabsMap }
      if (currentProject) {
        newMap[currentProject.path] = { openTabs: s.openTabs, activeTabIndex: s.activeTabIndex }
      }

      const newProjects = s.projects.filter((_, i) => i !== index)
      if (newProjects.length === 0) return {}

      // Clean up removed project from map
      if (removedProject) delete newMap[removedProject.path]

      if (index === s.activeProjectIndex) {
        // Closing active project — restore tabs from the new active project
        let newIndex = s.activeProjectIndex
        if (newIndex >= newProjects.length) newIndex = newProjects.length - 1
        const newActiveProject = newProjects[newIndex]
        const restored = newActiveProject ? newMap[newActiveProject.path] : undefined
        const restoredTabs = restored?.openTabs ?? []
        const restoredIndex = restored?.activeTabIndex ?? 0
        return {
          projects: newProjects,
          activeProjectIndex: newIndex,
          projectTabsMap: newMap,
          openTabs: restoredTabs,
          activeTabIndex: restoredIndex,
          ...syncActiveTabToTopLevel(restoredTabs, restoredIndex),
        }
      }

      // Closing a non-active project — adjust index if needed
      let newIndex = s.activeProjectIndex
      if (index < s.activeProjectIndex) newIndex = s.activeProjectIndex - 1
      return { projects: newProjects, activeProjectIndex: newIndex, projectTabsMap: newMap }
    }),
  setActiveProjectIndex: (index) =>
    set((s) => {
      // Save current project's tabs
      const currentProject = s.projects[s.activeProjectIndex]
      const newMap = { ...s.projectTabsMap }
      if (currentProject) {
        newMap[currentProject.path] = { openTabs: s.openTabs, activeTabIndex: s.activeTabIndex }
      }

      // Restore target project's tabs
      const targetProject = s.projects[index]
      const restored = targetProject ? newMap[targetProject.path] : undefined
      const restoredTabs = restored?.openTabs ?? []
      const restoredIndex = restored?.activeTabIndex ?? 0

      return {
        activeProjectIndex: index,
        projectTabsMap: newMap,
        openTabs: restoredTabs,
        activeTabIndex: restoredIndex,
        ...syncActiveTabToTopLevel(restoredTabs, restoredIndex),
      }
    }),
  updateProject: (index, partial) =>
    set((s) => ({
      projects: s.projects.map((p, i) => (i === index ? { ...p, ...partial } : p)),
    })),

  // Per-project tab snapshots
  projectTabsMap: {},

  // Request tabs
  openTabs: [],
  activeTabIndex: 0,
  openTab: (filePath, fileName, method, rawContent, originalContent, parsed) =>
    set((s) => {
      const existing = s.openTabs.findIndex((t) => t.filePath === filePath)
      if (existing >= 0) {
        // Already open — just switch
        return {
          activeTabIndex: existing,
          ...syncActiveTabToTopLevel(s.openTabs, existing),
        }
      }
      const newTab: RequestTab = {
        filePath,
        fileName,
        method,
        rawContent,
        originalContent,
        defaultContent: originalContent,
        parsed,
        response: null,
        loading: false,
        requestVars: {},
        editorTab: 'body',
        responseTab: 'body',
        authConfig: { type: 'none' },
        historyEntries: [],
        selectedHistoryEntry: null,
        instanceId: crypto.randomUUID(),
        isClone: false,
      }
      const newTabs = [...s.openTabs, newTab]
      const newIndex = newTabs.length - 1
      return {
        openTabs: newTabs,
        activeTabIndex: newIndex,
        ...syncActiveTabToTopLevel(newTabs, newIndex),
      }
    }),
  closeTab: (index) =>
    set((s) => {
      const closedTab = s.openTabs[index]
      let newTabs = s.openTabs.filter((_, i) => i !== index)

      // If closing a primary (non-clone) tab, promote the oldest clone
      if (closedTab && !closedTab.isClone) {
        const cloneIndex = newTabs.findIndex((t) => t.filePath === closedTab.filePath && t.isClone)
        if (cloneIndex >= 0) {
          newTabs = [...newTabs]
          newTabs[cloneIndex] = { ...newTabs[cloneIndex], isClone: false }
        }
      }

      if (newTabs.length === 0) {
        return {
          openTabs: [],
          activeTabIndex: 0,
          activeFile: null,
          rawContent: '',
          originalContent: '',
          parsed: null,
          response: null,
          loading: false,
          requestVars: {},
          editorTab: 'body' as const,
          responseTab: 'body' as const,
          authConfig: { type: 'none' as const },
          historyEntries: [] as HistoryEntry[],
          selectedHistoryEntry: null,
        }
      }
      let newIndex = s.activeTabIndex
      if (index === s.activeTabIndex) {
        // Closing active tab — pick adjacent
        newIndex = index >= newTabs.length ? newTabs.length - 1 : index
      } else if (index < s.activeTabIndex) {
        newIndex = s.activeTabIndex - 1
      }
      return {
        openTabs: newTabs,
        activeTabIndex: newIndex,
        ...syncActiveTabToTopLevel(newTabs, newIndex),
      }
    }),
  setActiveTabIndex: (index) =>
    set((s) => ({
      activeTabIndex: index,
      ...syncActiveTabToTopLevel(s.openTabs, index),
    })),
  updateTabByPath: (filePath, partial) =>
    set((s) => {
      const tabIndex = s.openTabs.findIndex((t) => t.filePath === filePath)
      if (tabIndex < 0) return {}
      const tabs = [...s.openTabs]
      tabs[tabIndex] = { ...tabs[tabIndex], ...partial }
      if (tabIndex === s.activeTabIndex) {
        return {
          openTabs: tabs,
          ...syncActiveTabToTopLevel(tabs, tabIndex),
        }
      }
      return { openTabs: tabs }
    }),
  updateTabByInstanceId: (instanceId, partial) =>
    set((s) => {
      const tabIndex = s.openTabs.findIndex((t) => t.instanceId === instanceId)
      if (tabIndex < 0) return {}
      const tabs = [...s.openTabs]
      tabs[tabIndex] = { ...tabs[tabIndex], ...partial }
      if (tabIndex === s.activeTabIndex) {
        return {
          openTabs: tabs,
          ...syncActiveTabToTopLevel(tabs, tabIndex),
        }
      }
      return { openTabs: tabs }
    }),

  // Active request
  activeFile: null,
  setActiveFile: (path) => set({ activeFile: path, requestVars: {} }),

  rawContent: '',
  setRawContent: (content) => set((s) => writeThrough(s, 'rawContent', content)),

  originalContent: '',
  setOriginalContent: (content) => set((s) => writeThrough(s, 'originalContent', content)),

  parsed: null,
  setParsed: (parsed) => set((s) => writeThrough(s, 'parsed', parsed)),

  // Response
  response: null,
  setResponse: (response) => set((s) => writeThrough(s, 'response', response)),
  loading: false,
  setLoading: (loading) => set((s) => writeThrough(s, 'loading', loading)),

  // Sync
  syncing: false,
  setSyncing: (syncing) => set({ syncing }),
  syncOutput: null,
  setSyncOutput: (output) => set({ syncOutput: output }),

  // UI
  editorTab: 'body',
  setEditorTab: (tab) => set((s) => writeThrough(s, 'editorTab', tab)),
  responseTab: 'body',
  setResponseTab: (tab) => set((s) => writeThrough(s, 'responseTab', tab)),
  sidebarWidth: 240,
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  showEnvEditor: false,
  setShowEnvEditor: (show) => set({ showEnvEditor: show }),
  sidebarSearch: '',
  setSidebarSearch: (search) => set({ sidebarSearch: search }),
  error: null,
  setError: (error) => set({ error }),

  // File management modals
  showCreateRequest: false,
  setShowCreateRequest: (show) => set({ showCreateRequest: show }),
  createRequestParentDir: '',
  setCreateRequestParentDir: (dir) => set({ createRequestParentDir: dir }),
  showCreateFolder: false,
  setShowCreateFolder: (show) => set({ showCreateFolder: show }),
  createFolderParentDir: '',
  setCreateFolderParentDir: (dir) => set({ createFolderParentDir: dir }),
  showImportCurl: false,
  setShowImportCurl: (show) => set({ showImportCurl: show }),
  importCurlParentDir: '',
  setImportCurlParentDir: (dir) => set({ importCurlParentDir: dir }),
  showDeleteConfirm: false,
  setShowDeleteConfirm: (show) => set({ showDeleteConfirm: show }),
  deleteTarget: null,
  setDeleteTarget: (target) => set({ deleteTarget: target }),

  // Settings
  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),

  // Local request variables
  requestVars: {},
  setRequestVars: (vars) => set((s) => writeThrough(s, 'requestVars', vars)),
  setRequestVar: (key, value) =>
    set((s) => {
      const newVars = { ...s.requestVars, [key]: value }
      return writeThrough(s, 'requestVars', newVars)
    }),

  // Auth
  authConfig: { type: 'none' },
  setAuthConfig: (config) => set((s) => writeThrough(s, 'authConfig', config)),

  // History
  historyEntries: [],
  setHistoryEntries: (entries) => set((s) => writeThrough(s, 'historyEntries', entries)),
  selectedHistoryEntry: null,
  setSelectedHistoryEntry: (entry) => set((s) => writeThrough(s, 'selectedHistoryEntry', entry)),

  // Clone tabs
  cloneTab: (sourceIndex) =>
    set((s) => {
      const source = s.openTabs[sourceIndex]
      if (!source) return {}
      const cloned: RequestTab = {
        ...source,
        instanceId: crypto.randomUUID(),
        isClone: true,
        response: null,
        loading: false,
      }
      const newTabs = [...s.openTabs, cloned]
      const newIndex = newTabs.length - 1
      return {
        openTabs: newTabs,
        activeTabIndex: newIndex,
        ...syncActiveTabToTopLevel(newTabs, newIndex),
      }
    }),

  // Drag & Drop
  draggedNode: null,
  setDraggedNode: (node) => set({ draggedNode: node }),

  // Diff
  diffEnabled: false,
  setDiffEnabled: (enabled) => set({ diffEnabled: enabled }),
  diffLeftBody: '',
  setDiffLeftBody: (body) => set({ diffLeftBody: body }),
  diffRightBody: '',
  setDiffRightBody: (body) => set({ diffRightBody: body }),
}))

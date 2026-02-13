import { create } from 'zustand'

export interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  method?: string
  children?: FileTreeNode[]
}

export interface ParsedHttpRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  comments: string[]
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
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

interface AppState {
  // Multi-project
  projects: Project[]
  activeProjectIndex: number
  addProject: (project: Project) => void
  removeProject: (index: number) => void
  setActiveProjectIndex: (index: number) => void
  updateProject: (index: number, partial: Partial<Project>) => void

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
  editorTab: 'headers' | 'body' | 'raw'
  setEditorTab: (tab: 'headers' | 'body' | 'raw') => void
  responseTab: 'body' | 'headers' | 'raw'
  setResponseTab: (tab: 'body' | 'headers' | 'raw') => void
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  showEnvEditor: boolean
  setShowEnvEditor: (show: boolean) => void
  error: string | null
  setError: (error: string | null) => void
}

// Helper to get the active project
export function getActiveProject(state: AppState): Project | null {
  return state.projects[state.activeProjectIndex] ?? null
}

export const useAppStore = create<AppState>((set) => ({
  // Multi-project
  projects: [],
  activeProjectIndex: 0,
  addProject: (project) =>
    set((s) => ({
      projects: [...s.projects, project],
      activeProjectIndex: s.projects.length,
      // Reset request state when adding new project
      activeFile: null,
      rawContent: '',
      originalContent: '',
      parsed: null,
      response: null,
    })),
  removeProject: (index) =>
    set((s) => {
      const newProjects = s.projects.filter((_, i) => i !== index)
      let newIndex = s.activeProjectIndex
      if (newIndex >= newProjects.length) newIndex = Math.max(0, newProjects.length - 1)
      if (index === s.activeProjectIndex) {
        // Closing active project — reset request state
        return {
          projects: newProjects,
          activeProjectIndex: newIndex,
          activeFile: null,
          rawContent: '',
          originalContent: '',
          parsed: null,
          response: null,
        }
      }
      if (index < s.activeProjectIndex) newIndex = s.activeProjectIndex - 1
      return { projects: newProjects, activeProjectIndex: newIndex }
    }),
  setActiveProjectIndex: (index) =>
    set({
      activeProjectIndex: index,
      // Reset request state when switching projects
      activeFile: null,
      rawContent: '',
      originalContent: '',
      parsed: null,
      response: null,
    }),
  updateProject: (index, partial) =>
    set((s) => ({
      projects: s.projects.map((p, i) => (i === index ? { ...p, ...partial } : p)),
    })),

  // Active request
  activeFile: null,
  setActiveFile: (path) => set({ activeFile: path }),

  rawContent: '',
  setRawContent: (content) => set({ rawContent: content }),

  originalContent: '',
  setOriginalContent: (content) => set({ originalContent: content }),

  parsed: null,
  setParsed: (parsed) => set({ parsed }),

  // Response
  response: null,
  setResponse: (response) => set({ response }),
  loading: false,
  setLoading: (loading) => set({ loading }),

  // Sync
  syncing: false,
  setSyncing: (syncing) => set({ syncing }),
  syncOutput: null,
  setSyncOutput: (output) => set({ syncOutput: output }),

  // UI
  editorTab: 'body',
  setEditorTab: (tab) => set({ editorTab: tab }),
  responseTab: 'body',
  setResponseTab: (tab) => set({ responseTab: tab }),
  sidebarWidth: 240,
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  showEnvEditor: false,
  setShowEnvEditor: (show) => set({ showEnvEditor: show }),
  error: null,
  setError: (error) => set({ error }),
}))

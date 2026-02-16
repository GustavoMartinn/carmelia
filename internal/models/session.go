package models

type TabState struct {
	FilePath    string            `json:"filePath"`
	IsClone     bool              `json:"isClone,omitempty"`
	RawContent  string            `json:"rawContent,omitempty"`
	RequestVars map[string]string `json:"requestVars,omitempty"`
}

type ProjectSession struct {
	ActiveEnv      string     `json:"activeEnv,omitempty"`
	OpenTabs       []TabState `json:"openTabs,omitempty"`
	ActiveTabIndex int        `json:"activeTabIndex"`
}

type SessionState struct {
	ProjectPaths       []string                  `json:"projectPaths"`
	ActiveProjectIndex int                       `json:"activeProjectIndex"`
	ProjectSessions    map[string]ProjectSession `json:"projectSessions,omitempty"`
}

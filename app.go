package main

import (
	"bufio"
	"context"
	"fmt"
	"carmelia-desktop/internal/models"
	"carmelia-desktop/internal/services"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx         context.Context
	projectPath string
	cliPath     string // path to carmelia CLI source
	projectRoot string // root of the carmelia project (where package.json lives)
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Resolve the executable's real location (follows symlinks)
	exePath, err := os.Executable()
	if err != nil {
		exePath, _ = filepath.Abs(".")
	} else {
		exePath, err = filepath.EvalSymlinks(exePath)
		if err != nil {
			exePath, _ = filepath.Abs(".")
		}
	}
	exeDir := filepath.Dir(exePath)

	// Find the project root (where package.json + src/cli/index.ts live)
	root := findProjectRoot(exeDir)
	if root != "" {
		a.projectRoot = root
		a.cliPath = filepath.Join(root, "src", "cli", "index.ts")
	} else {
		// Fallback: assume we're inside carmelia-desktop/ and parent is root
		a.projectRoot = filepath.Dir(exeDir)
		a.cliPath = filepath.Join(a.projectRoot, "src", "cli", "index.ts")
	}

	// Ensure playground project exists
	services.EnsurePlayground()
}

// findProjectRoot walks up from startDir (up to 5 levels) looking for
// a directory that contains both package.json and src/cli/index.ts.
func findProjectRoot(startDir string) string {
	dir := startDir
	for i := 0; i < 5; i++ {
		if fileExists(filepath.Join(dir, "package.json")) &&
			fileExists(filepath.Join(dir, "src", "cli", "index.ts")) {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}

// fileExists reports whether a file exists at the given path.
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// augmentedEnv returns the current environment with common Node.js paths
// added to PATH (NVM, Homebrew, /usr/local/bin, etc.)
func augmentedEnv() []string {
	env := os.Environ()
	home, _ := os.UserHomeDir()

	extraPaths := []string{
		"/usr/local/bin",
		"/usr/bin",
	}
	if home != "" {
		extraPaths = append(extraPaths,
			filepath.Join(home, ".nvm", "versions", "node"),
			filepath.Join(home, ".local", "bin"),
			filepath.Join(home, ".volta", "bin"),
			filepath.Join(home, ".fnm", "aliases", "default", "bin"),
		)
		// Try to find actual NVM node version
		nvmDir := filepath.Join(home, ".nvm", "versions", "node")
		if entries, err := os.ReadDir(nvmDir); err == nil {
			for _, e := range entries {
				if e.IsDir() {
					extraPaths = append(extraPaths, filepath.Join(nvmDir, e.Name(), "bin"))
				}
			}
		}
	}

	// Append extra paths to existing PATH
	for i, e := range env {
		if strings.HasPrefix(e, "PATH=") {
			existing := e[5:]
			env[i] = "PATH=" + existing + ":" + strings.Join(extraPaths, ":")
			return env
		}
	}
	// No PATH found — set one
	env = append(env, "PATH="+strings.Join(extraPaths, ":"))
	return env
}

// SetProjectPath switches the active project (used by multi-project tabs)
func (a *App) SetProjectPath(path string) {
	a.projectPath = path
}

// OpenProject opens a native directory picker and sets the project path
func (a *App) OpenProject() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select project directory",
	})
	if err != nil {
		return "", err
	}
	if dir == "" {
		return "", nil
	}
	a.projectPath = dir
	return dir, nil
}

// SyncProject runs `carmelia scan` on the active project to generate/update .http files.
// It streams each output line to the frontend via "sync:line" events in real time.
func (a *App) SyncProject(projectPath string) (string, error) {
	if projectPath == "" {
		projectPath = a.projectPath
	}
	if projectPath == "" {
		return "", fmt.Errorf("no project selected")
	}

	// Build the scan command — prefer dev source, fallback to bundled CLI
	var cmd *exec.Cmd
	bundlePath := "/usr/share/carmelia/cli-bundle.cjs"

	if fileExists(a.cliPath) {
		// Dev mode: use tsx to run the TypeScript source
		tsxPath := filepath.Join(a.projectRoot, "node_modules", ".bin", "tsx")
		if fileExists(tsxPath) {
			cmd = exec.Command(tsxPath, a.cliPath, "scan", projectPath)
		} else {
			cmd = exec.Command("npx", "tsx", a.cliPath, "scan", projectPath)
		}
		cmd.Dir = a.projectRoot
	} else if fileExists(bundlePath) {
		// Installed mode: use absolute path to node (exec.Command resolves
		// against the process PATH, not cmd.Env, so "node" fails when
		// launched from a .desktop file with a minimal PATH)
		nodePath := findNode()
		if nodePath == "" {
			return "", fmt.Errorf("node not found — install Node.js")
		}
		cmd = exec.Command(nodePath, bundlePath, "scan", projectPath)
	} else {
		return "", fmt.Errorf("CLI not found — make sure carmelia is properly installed")
	}
	cmd.Env = augmentedEnv()

	// Single pipe for both stdout and stderr to stream lines in real time
	pr, pw, err := os.Pipe()
	if err != nil {
		return "", fmt.Errorf("failed to create pipe: %w", err)
	}
	cmd.Stdout = pw
	cmd.Stderr = pw

	if err := cmd.Start(); err != nil {
		pw.Close()
		pr.Close()
		return "", fmt.Errorf("failed to start scan: %w", err)
	}
	pw.Close()

	scanner := bufio.NewScanner(pr)
	var output strings.Builder
	for scanner.Scan() {
		line := stripAnsi(scanner.Text())
		output.WriteString(line)
		output.WriteString("\n")
		runtime.EventsEmit(a.ctx, "sync:line", line)
	}
	pr.Close()

	err = cmd.Wait()
	outStr := strings.TrimRight(output.String(), "\n")

	if err != nil {
		if strings.Contains(outStr, "not found") || strings.Contains(outStr, "ENOENT") {
			return outStr, fmt.Errorf("tsx/node not found in PATH — install Node.js and run 'npm install' in %s\n%s", a.projectRoot, outStr)
		}
		return outStr, fmt.Errorf("scan failed: %s\n%s", err, outStr)
	}

	return outStr, nil
}

// GetProjectPath returns the currently open project path
func (a *App) GetProjectPath() string {
	return a.projectPath
}

// GetFileTree returns the file tree of .carmelia/requests/
func (a *App) GetFileTree() ([]models.FileTreeNode, error) {
	if a.projectPath == "" {
		return []models.FileTreeNode{}, nil
	}
	return services.BuildFileTree(a.projectPath)
}

// GetFileTreeForProject returns the file tree for a specific project path
func (a *App) GetFileTreeForProject(projectPath string) ([]models.FileTreeNode, error) {
	if projectPath == "" {
		return []models.FileTreeNode{}, nil
	}
	return services.BuildFileTree(projectPath)
}

// ReadRequestFromProject reads a .http file from a specific project
func (a *App) ReadRequestFromProject(projectPath string, relPath string) (string, error) {
	return services.ReadRequest(projectPath, relPath)
}

// ReadRequest reads a .http file content by relative path
func (a *App) ReadRequest(relPath string) (string, error) {
	return services.ReadRequest(a.projectPath, relPath)
}

// SaveRequest saves content to a .http file
func (a *App) SaveRequest(relPath string, content string) error {
	return services.SaveRequest(a.projectPath, relPath, content)
}

// SaveRequestToProject saves content to a .http file in a specific project
func (a *App) SaveRequestToProject(projectPath string, relPath string, content string) error {
	return services.SaveRequest(projectPath, relPath, content)
}

// ParseRequest parses .http content into structured request
func (a *App) ParseRequest(content string) models.ParsedHttpRequest {
	return services.ParseHttpFile(content)
}

// ExecuteRequest parses, resolves variables, and executes an HTTP request.
// historyKey is used to group history entries (typically the file's relative path).
func (a *App) ExecuteRequest(content string, envName string, projectPath string, sets map[string]string, historyKey string) (models.RunResult, error) {
	parsed := services.ParseHttpFile(content)

	effectivePath := projectPath
	if effectivePath == "" {
		effectivePath = a.projectPath
	}

	// Load env variables
	env := models.EnvVariables{}
	if envName != "" && effectivePath != "" {
		var err error
		env, err = services.LoadEnv(effectivePath, envName)
		if err != nil {
			env = models.EnvVariables{}
		}
	}

	if sets == nil {
		sets = map[string]string{}
	}

	// Resolve variables
	resolved := services.ResolveRequest(parsed, services.ResolveOptions{
		Env:  env,
		Sets: sets,
	})

	// Load config for timeout/redirect settings
	config, _ := services.LoadConfig(effectivePath)

	// Execute request
	resp, err := services.ExecuteRequest(services.ExecuteOptions{
		Method:          resolved.Method,
		URL:             resolved.URL,
		Headers:         resolved.Headers,
		Body:            resolved.Body,
		Timeout:         config.Runner.Timeout,
		FollowRedirects: config.Runner.FollowRedirects,
	})

	// Use historyKey for grouping history; fall back to content hash if empty
	hKey := historyKey
	if hKey == "" {
		hKey = content
	}

	if err != nil {
		result := models.RunResult{
			Request: resolved,
			Error:   err.Error(),
		}
		// Save to history even on error
		go services.SaveHistoryEntry(effectivePath, hKey, config.Runner.MaxHistory, result)
		return result, nil
	}

	result := models.RunResult{
		Request:  resolved,
		Response: resp,
	}
	// Auto-save to history
	go services.SaveHistoryEntry(effectivePath, hKey, config.Runner.MaxHistory, result)
	return result, nil
}

// GetHistory returns the history entries for a request
func (a *App) GetHistory(projectPath string, requestContent string) ([]models.HistoryEntry, error) {
	if projectPath == "" {
		projectPath = a.projectPath
	}
	return services.LoadHistory(projectPath, requestContent)
}

// ClearHistory clears the history for a request
func (a *App) ClearHistory(projectPath string, requestContent string) error {
	if projectPath == "" {
		projectPath = a.projectPath
	}
	return services.ClearHistory(projectPath, requestContent)
}

// ListEnvsForProject returns available environment names for a specific project
func (a *App) ListEnvsForProject(projectPath string) ([]string, error) {
	if projectPath == "" {
		return []string{}, nil
	}
	return services.ListEnvs(projectPath)
}

// ListEnvs returns available environment names
func (a *App) ListEnvs() ([]string, error) {
	if a.projectPath == "" {
		return []string{}, nil
	}
	return services.ListEnvs(a.projectPath)
}

// GetEnv loads variables from a named environment
func (a *App) GetEnv(name string) (models.EnvVariables, error) {
	return services.LoadEnv(a.projectPath, name)
}

// GetEnvForProject loads variables from a named environment in a specific project
func (a *App) GetEnvForProject(projectPath string, name string) (models.EnvVariables, error) {
	return services.LoadEnv(projectPath, name)
}

// SaveEnv saves variables to a named environment
func (a *App) SaveEnv(name string, vars models.EnvVariables) error {
	return services.SaveEnv(a.projectPath, name, vars)
}

// SaveEnvForProject saves variables to a named environment in a specific project
func (a *App) SaveEnvForProject(projectPath string, name string, vars models.EnvVariables) error {
	return services.SaveEnv(projectPath, name, vars)
}

// SaveOpenProjects persists the current session state (open project paths + active index)
func (a *App) SaveOpenProjects(state models.SessionState) error {
	return services.SaveSessionState(state)
}

// LoadOpenProjects restores the saved session state
func (a *App) LoadOpenProjects() (models.SessionState, error) {
	return services.LoadSessionState()
}

// ExportCollection exports all requests from a project in the given format (postman, insomnia, openapi)
func (a *App) ExportCollection(projectPath string, format string) (string, error) {
	if projectPath == "" {
		projectPath = a.projectPath
	}
	if projectPath == "" {
		return "", fmt.Errorf("no project selected")
	}

	requests, err := services.CollectAllRequests(projectPath)
	if err != nil {
		return "", fmt.Errorf("failed to collect requests: %w", err)
	}
	if len(requests) == 0 {
		return "", fmt.Errorf("no requests found in project")
	}

	projectName := filepath.Base(projectPath)
	content, err := services.GenerateExport(projectName, requests, format)
	if err != nil {
		return "", err
	}

	displayName, pattern := services.ExportFileFilter(format)
	defaultFilename := services.ExportFilename(projectName, format)

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export Collection",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: displayName, Pattern: pattern},
		},
	})
	if err != nil {
		return "", err
	}
	if savePath == "" {
		return "", nil // user cancelled
	}

	if err := os.WriteFile(savePath, []byte(content), 0o644); err != nil {
		return "", fmt.Errorf("failed to write export file: %w", err)
	}

	return savePath, nil
}

// GetPlaygroundPath returns the playground project path, ensuring it exists.
func (a *App) GetPlaygroundPath() (string, error) {
	return services.EnsurePlayground()
}

// CreateRequest creates a new .http file with a template in a project.
func (a *App) CreateRequest(projectPath, parentDir, fileName string) (string, error) {
	return services.CreateRequest(projectPath, parentDir, fileName)
}

// CreateFolder creates a new folder in a project's requests directory.
func (a *App) CreateFolder(projectPath, parentDir, folderName string) (string, error) {
	return services.CreateFolder(projectPath, parentDir, folderName)
}

// DeleteRequest deletes a .http file from a project.
func (a *App) DeleteRequest(projectPath, relPath string) error {
	return services.DeleteRequest(projectPath, relPath)
}

// DeleteFolder deletes a folder from a project's requests directory.
func (a *App) DeleteFolder(projectPath, relPath string) error {
	return services.DeleteFolder(projectPath, relPath)
}

// ImportCurl parses a curl command and creates a .http file from it.
func (a *App) ImportCurl(projectPath, parentDir, fileName, curlCmd string) (string, error) {
	content, err := services.ParseCurl(curlCmd)
	if err != nil {
		return "", err
	}

	relPath, err := services.CreateRequest(projectPath, parentDir, fileName)
	if err != nil {
		return "", err
	}

	if err := services.SaveRequest(projectPath, relPath, content); err != nil {
		return "", err
	}

	return relPath, nil
}

// MoveItem moves a file or folder to a new parent at a specific index.
// srcRelPath and destParentRelPath are relative to .carmelia/requests/.
func (a *App) MoveItem(projectPath, srcRelPath, destParentRelPath string, destIndex int) (string, error) {
	if projectPath == "" {
		projectPath = a.projectPath
	}
	return services.MoveItem(projectPath, srcRelPath, destParentRelPath, destIndex)
}

// SaveTreeOrder saves a custom ordering for the file tree.
func (a *App) SaveTreeOrder(projectPath string, order map[string][]string) error {
	if projectPath == "" {
		projectPath = a.projectPath
	}
	return services.SaveOrder(projectPath, order)
}

// GetConfig loads the project config
func (a *App) GetConfig() (models.HttxConfig, error) {
	if a.projectPath == "" {
		return models.DefaultConfig, nil
	}
	return services.LoadConfig(a.projectPath)
}

// RenameEnvForProject renames an environment file in a specific project
func (a *App) RenameEnvForProject(projectPath, oldName, newName string) error {
	return services.RenameEnv(projectPath, oldName, newName)
}

// GetConfigForProject loads the config for a specific project
func (a *App) GetConfigForProject(projectPath string) (models.HttxConfig, error) {
	if projectPath == "" {
		return models.DefaultConfig, nil
	}
	return services.LoadConfig(projectPath)
}

// SaveConfigForProject saves the config for a specific project
func (a *App) SaveConfigForProject(projectPath string, config models.HttxConfig) error {
	if projectPath == "" {
		return fmt.Errorf("no project selected")
	}
	return services.SaveConfig(projectPath, config)
}

// findNode searches for the node binary in standard locations.
func findNode() string {
	// First try the process PATH
	if p, err := exec.LookPath("node"); err == nil {
		return p
	}

	home, _ := os.UserHomeDir()
	candidates := []string{
		"/usr/local/bin/node",
		"/usr/bin/node",
	}

	if home != "" {
		// Check NVM versions
		nvmDir := filepath.Join(home, ".nvm", "versions", "node")
		if entries, err := os.ReadDir(nvmDir); err == nil {
			for _, e := range entries {
				if e.IsDir() {
					candidates = append(candidates, filepath.Join(nvmDir, e.Name(), "bin", "node"))
				}
			}
		}
		candidates = append(candidates,
			filepath.Join(home, ".volta", "bin", "node"),
			filepath.Join(home, ".fnm", "aliases", "default", "bin", "node"),
			filepath.Join(home, ".local", "bin", "node"),
		)
	}

	for _, c := range candidates {
		if fileExists(c) {
			return c
		}
	}
	return ""
}

func stripAnsi(s string) string {
	// Simple ANSI strip — remove escape sequences
	result := strings.Builder{}
	i := 0
	for i < len(s) {
		if s[i] == '\033' && i+1 < len(s) && s[i+1] == '[' {
			// Skip until we hit a letter
			j := i + 2
			for j < len(s) && !((s[j] >= 'A' && s[j] <= 'Z') || (s[j] >= 'a' && s[j] <= 'z')) {
				j++
			}
			i = j + 1
			continue
		}
		result.WriteByte(s[i])
		i++
	}
	return result.String()
}

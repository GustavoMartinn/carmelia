package main

import (
	"context"
	"fmt"
	"carmelia-desktop/internal/models"
	"carmelia-desktop/internal/services"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx         context.Context
	projectPath string
	cliPath     string // path to carmelia CLI source
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// CLI source lives alongside the desktop app's parent
	// carmelia-desktop is inside http-client/, so CLI is at ../src/cli/index.ts
	exePath, _ := filepath.Abs(".")
	a.cliPath = filepath.Join(exePath, "..", "src", "cli", "index.ts")
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

// SyncProject runs `carmelia scan` on the active project to generate/update .http files
func (a *App) SyncProject(projectPath string) (string, error) {
	if projectPath == "" {
		projectPath = a.projectPath
	}
	if projectPath == "" {
		return "", fmt.Errorf("no project selected")
	}

	// Use npx tsx to run the CLI
	cmd := exec.Command("npx", "tsx", a.cliPath, "scan", projectPath)
	cmd.Dir = filepath.Dir(a.cliPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("scan failed: %s\n%s", err, string(output))
	}

	// Strip ANSI escape codes for clean output
	cleaned := stripAnsi(string(output))
	return cleaned, nil
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

// ExecuteRequest parses, resolves variables, and executes an HTTP request
func (a *App) ExecuteRequest(content string, envName string, projectPath string, sets map[string]string) (models.RunResult, error) {
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

	if err != nil {
		return models.RunResult{
			Request: resolved,
			Error:   err.Error(),
		}, nil
	}

	return models.RunResult{
		Request:  resolved,
		Response: resp,
	}, nil
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

// GetConfig loads the project config
func (a *App) GetConfig() (models.HttxConfig, error) {
	if a.projectPath == "" {
		return models.DefaultConfig, nil
	}
	return services.LoadConfig(a.projectPath)
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

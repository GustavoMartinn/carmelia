package services

import (
	"fmt"
	"carmelia-desktop/internal/models"
	"os"
	"path/filepath"
	"strings"
)

func BuildFileTree(projectPath string) ([]models.FileTreeNode, error) {
	requestsDir := filepath.Join(projectPath, ".carmelia", "requests")

	if _, err := os.Stat(requestsDir); os.IsNotExist(err) {
		return []models.FileTreeNode{}, nil
	}

	return buildTree(requestsDir, requestsDir)
}

func buildTree(basePath, currentPath string) ([]models.FileTreeNode, error) {
	entries, err := os.ReadDir(currentPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	nodes := []models.FileTreeNode{}

	for _, entry := range entries {
		fullPath := filepath.Join(currentPath, entry.Name())
		relPath, _ := filepath.Rel(basePath, fullPath)

		if entry.IsDir() {
			children, err := buildTree(basePath, fullPath)
			if err != nil {
				return nil, err
			}
			nodes = append(nodes, models.FileTreeNode{
				Name:     entry.Name(),
				Path:     relPath,
				IsDir:    true,
				Children: children,
			})
		} else if strings.HasSuffix(entry.Name(), ".http") {
			method := detectMethod(fullPath)
			nodes = append(nodes, models.FileTreeNode{
				Name:   strings.TrimSuffix(entry.Name(), ".http"),
				Path:   relPath,
				IsDir:  false,
				Method: method,
			})
		}
	}

	return nodes, nil
}

func detectMethod(filePath string) string {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return ""
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		parts := strings.Fields(trimmed)
		if len(parts) >= 2 {
			method := strings.ToUpper(parts[0])
			switch method {
			case "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS":
				return method
			}
		}
		break
	}
	return ""
}

func ReadRequest(projectPath, relPath string) (string, error) {
	fullPath := filepath.Join(projectPath, ".carmelia", "requests", relPath)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to read request file: %w", err)
	}
	return string(data), nil
}

func SaveRequest(projectPath, relPath, content string) error {
	fullPath := filepath.Join(projectPath, ".carmelia", "requests", relPath)
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	return os.WriteFile(fullPath, []byte(content), 0o644)
}

// CreateRequest creates a new .http file with a template inside .carmelia/requests/.
// parentDir is relative to .carmelia/requests/ (empty string for root).
// Returns the relative path from .carmelia/requests/.
func CreateRequest(projectPath, parentDir, fileName string) (string, error) {
	if !strings.HasSuffix(fileName, ".http") {
		fileName += ".http"
	}

	requestsDir := filepath.Join(projectPath, ".carmelia", "requests")
	targetDir := requestsDir
	if parentDir != "" {
		targetDir = filepath.Join(requestsDir, parentDir)
	}

	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	fullPath := filepath.Join(targetDir, fileName)

	// Don't overwrite existing files
	if _, err := os.Stat(fullPath); err == nil {
		return "", fmt.Errorf("file already exists: %s", fileName)
	}

	template := "GET https://example.com\n"
	if err := os.WriteFile(fullPath, []byte(template), 0o644); err != nil {
		return "", fmt.Errorf("failed to create request file: %w", err)
	}

	relPath, _ := filepath.Rel(requestsDir, fullPath)
	return relPath, nil
}

// CreateFolder creates a new directory inside .carmelia/requests/.
// parentDir is relative to .carmelia/requests/ (empty string for root).
// Returns the relative path from .carmelia/requests/.
func CreateFolder(projectPath, parentDir, folderName string) (string, error) {
	requestsDir := filepath.Join(projectPath, ".carmelia", "requests")
	targetDir := requestsDir
	if parentDir != "" {
		targetDir = filepath.Join(requestsDir, parentDir)
	}

	fullPath := filepath.Join(targetDir, folderName)

	// Don't overwrite existing
	if _, err := os.Stat(fullPath); err == nil {
		return "", fmt.Errorf("folder already exists: %s", folderName)
	}

	if err := os.MkdirAll(fullPath, 0o755); err != nil {
		return "", fmt.Errorf("failed to create folder: %w", err)
	}

	relPath, _ := filepath.Rel(requestsDir, fullPath)
	return relPath, nil
}

// DeleteRequest deletes a .http file from .carmelia/requests/.
// relPath is relative to .carmelia/requests/.
func DeleteRequest(projectPath, relPath string) error {
	requestsDir := filepath.Join(projectPath, ".carmelia", "requests")
	fullPath := filepath.Join(requestsDir, relPath)

	// Validate path is inside requests dir
	absReq, _ := filepath.Abs(requestsDir)
	absFull, _ := filepath.Abs(fullPath)
	if !strings.HasPrefix(absFull, absReq) {
		return fmt.Errorf("path is outside requests directory")
	}

	if !strings.HasSuffix(fullPath, ".http") {
		return fmt.Errorf("can only delete .http files")
	}

	return os.Remove(fullPath)
}

// DeleteFolder deletes a directory (and its contents) from .carmelia/requests/.
// relPath is relative to .carmelia/requests/.
func DeleteFolder(projectPath, relPath string) error {
	requestsDir := filepath.Join(projectPath, ".carmelia", "requests")
	fullPath := filepath.Join(requestsDir, relPath)

	// Validate path is inside requests dir
	absReq, _ := filepath.Abs(requestsDir)
	absFull, _ := filepath.Abs(fullPath)
	if !strings.HasPrefix(absFull, absReq+string(os.PathSeparator)) {
		return fmt.Errorf("path is outside requests directory")
	}

	info, err := os.Stat(fullPath)
	if err != nil {
		return fmt.Errorf("path does not exist: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("path is not a directory")
	}

	return os.RemoveAll(fullPath)
}

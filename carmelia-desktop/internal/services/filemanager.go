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

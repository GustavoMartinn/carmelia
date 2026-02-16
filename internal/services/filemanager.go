package services

import (
	"fmt"
	"carmelia-desktop/internal/models"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func BuildFileTree(projectPath string) ([]models.FileTreeNode, error) {
	requestsDir := filepath.Join(projectPath, ".carmelia", "requests")

	if _, err := os.Stat(requestsDir); os.IsNotExist(err) {
		return []models.FileTreeNode{}, nil
	}

	order, _ := LoadOrder(projectPath)
	return buildTree(requestsDir, requestsDir, order)
}

func buildTree(basePath, currentPath string, order OrderMap) ([]models.FileTreeNode, error) {
	entries, err := os.ReadDir(currentPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	nodes := []models.FileTreeNode{}

	for _, entry := range entries {
		fullPath := filepath.Join(currentPath, entry.Name())
		relPath, _ := filepath.Rel(basePath, fullPath)

		if entry.IsDir() {
			children, err := buildTree(basePath, fullPath, order)
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

	// Sort nodes according to order.json
	dirRelPath, _ := filepath.Rel(basePath, currentPath)
	if dirRelPath == "." {
		dirRelPath = ""
	}
	sortNodes(nodes, order[dirRelPath])

	return nodes, nil
}

// sortNodes reorders nodes according to the ordered list.
// Items in the ordered list come first (in that order), remaining items follow alphabetically.
func sortNodes(nodes []models.FileTreeNode, ordered []string) {
	if len(ordered) == 0 {
		return
	}

	// Build a position map from the ordered list.
	// For files, order.json stores "name.http" but node.Name has the suffix stripped.
	pos := make(map[string]int, len(ordered))
	for i, name := range ordered {
		pos[name] = i
	}

	sort.SliceStable(nodes, func(i, j int) bool {
		nameI := diskName(nodes[i])
		nameJ := diskName(nodes[j])
		posI, okI := pos[nameI]
		posJ, okJ := pos[nameJ]

		if okI && okJ {
			return posI < posJ
		}
		if okI {
			return true
		}
		if okJ {
			return false
		}
		// Both missing from order — alphabetical
		return nameI < nameJ
	})
}

// diskName returns the filesystem name for a node (adds .http suffix for files).
func diskName(node models.FileTreeNode) string {
	if node.IsDir {
		return node.Name
	}
	return node.Name + ".http"
}

// MoveItem moves a file or folder to a new parent directory at a specific index.
// srcRelPath is relative to .carmelia/requests/.
// destParentRelPath is the destination parent dir relative to .carmelia/requests/ (empty = root).
// destIndex is the position among siblings in the destination.
// Returns the new relative path.
func MoveItem(projectPath, srcRelPath, destParentRelPath string, destIndex int) (string, error) {
	requestsDir := filepath.Join(projectPath, ".carmelia", "requests")

	srcFull := filepath.Join(requestsDir, srcRelPath)
	srcName := filepath.Base(srcFull)

	// Determine if the source is a file node (name without .http) or a dir
	srcInfo, err := os.Stat(srcFull)
	if err != nil {
		// Source might be a file without .http suffix (the relPath from frontend uses stripped name)
		srcFull = srcFull + ".http"
		srcInfo, err = os.Stat(srcFull)
		if err != nil {
			return "", fmt.Errorf("source not found: %s", srcRelPath)
		}
		srcName = filepath.Base(srcFull)
	}

	destParentFull := requestsDir
	if destParentRelPath != "" {
		destParentFull = filepath.Join(requestsDir, destParentRelPath)
	}

	// Prevent moving a directory into itself or a descendant
	if srcInfo.IsDir() {
		absSrc, _ := filepath.Abs(srcFull)
		absDest, _ := filepath.Abs(destParentFull)
		if strings.HasPrefix(absDest, absSrc+string(os.PathSeparator)) || absDest == absSrc {
			return "", fmt.Errorf("cannot move folder into itself")
		}
	}

	destFull := filepath.Join(destParentFull, srcName)

	// Determine old parent relative path
	srcParentFull := filepath.Dir(srcFull)
	oldParentRel, _ := filepath.Rel(requestsDir, srcParentFull)
	if oldParentRel == "." {
		oldParentRel = ""
	}

	// Only do filesystem move if changing parent
	if srcParentFull != destParentFull {
		if err := os.MkdirAll(destParentFull, 0o755); err != nil {
			return "", fmt.Errorf("failed to create destination directory: %w", err)
		}

		// Check if destination already has an item with the same name
		if _, err := os.Stat(destFull); err == nil {
			return "", fmt.Errorf("item already exists at destination: %s", srcName)
		}

		if err := os.Rename(srcFull, destFull); err != nil {
			return "", fmt.Errorf("failed to move item: %w", err)
		}
	}

	// Update order.json
	order, _ := LoadOrder(projectPath)

	// Remove from old parent's order
	if oldList, ok := order[oldParentRel]; ok {
		newList := make([]string, 0, len(oldList))
		for _, name := range oldList {
			if name != srcName {
				newList = append(newList, name)
			}
		}
		if len(newList) > 0 {
			order[oldParentRel] = newList
		} else {
			delete(order, oldParentRel)
		}
	}

	// Build the destination parent's order list if it doesn't exist
	destParentRel := destParentRelPath
	if _, ok := order[destParentRel]; !ok {
		// Initialize from current filesystem state
		destEntries, _ := os.ReadDir(destParentFull)
		names := make([]string, 0, len(destEntries))
		for _, e := range destEntries {
			if e.IsDir() || strings.HasSuffix(e.Name(), ".http") {
				names = append(names, e.Name())
			}
		}
		order[destParentRel] = names
	}

	// Insert srcName at destIndex in the destination order
	destList := order[destParentRel]
	// Remove srcName if already present (same-folder reorder)
	filtered := make([]string, 0, len(destList))
	for _, name := range destList {
		if name != srcName {
			filtered = append(filtered, name)
		}
	}
	// Clamp index
	if destIndex < 0 {
		destIndex = 0
	}
	if destIndex > len(filtered) {
		destIndex = len(filtered)
	}
	// Insert at position
	result := make([]string, 0, len(filtered)+1)
	result = append(result, filtered[:destIndex]...)
	result = append(result, srcName)
	result = append(result, filtered[destIndex:]...)
	order[destParentRel] = result

	if err := SaveOrder(projectPath, order); err != nil {
		return "", fmt.Errorf("failed to save order: %w", err)
	}

	newRelPath, _ := filepath.Rel(requestsDir, destFull)
	return newRelPath, nil
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

	template := "GET https://example.com\nContent-Type: application/json\n"
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

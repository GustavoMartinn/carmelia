package services

import (
	"carmelia-desktop/internal/models"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

func historyDir(projectPath, requestPath string) string {
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(requestPath)))[:12]
	return filepath.Join(projectPath, ".carmelia", "history", hash)
}

func SaveHistoryEntry(projectPath, requestPath string, maxEntries int, result models.RunResult) error {
	dir := historyDir(projectPath, requestPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create history dir: %w", err)
	}

	entry := models.HistoryEntry{
		ID:        fmt.Sprintf("%d", time.Now().UnixMilli()),
		Timestamp: time.Now().UnixMilli(),
		Request:   result.Request,
		Response:  result.Response,
		Error:     result.Error,
	}

	data, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal history entry: %w", err)
	}

	filename := fmt.Sprintf("%d.json", entry.Timestamp)
	if err := os.WriteFile(filepath.Join(dir, filename), data, 0o644); err != nil {
		return fmt.Errorf("failed to write history entry: %w", err)
	}

	// Enforce max entries
	if maxEntries <= 0 {
		maxEntries = 10
	}
	enforceHistoryLimit(dir, maxEntries)

	return nil
}

func LoadHistory(projectPath, requestPath string) ([]models.HistoryEntry, error) {
	dir := historyDir(projectPath, requestPath)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []models.HistoryEntry{}, nil
		}
		return nil, fmt.Errorf("failed to read history dir: %w", err)
	}

	var history []models.HistoryEntry
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}

		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}

		var entry models.HistoryEntry
		if err := json.Unmarshal(data, &entry); err != nil {
			continue
		}

		history = append(history, entry)
	}

	// Sort by timestamp descending (newest first)
	sort.Slice(history, func(i, j int) bool {
		return history[i].Timestamp > history[j].Timestamp
	})

	return history, nil
}

func ClearHistory(projectPath, requestPath string) error {
	dir := historyDir(projectPath, requestPath)
	return os.RemoveAll(dir)
}

func enforceHistoryLimit(dir string, maxEntries int) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	var jsonFiles []os.DirEntry
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".json" {
			jsonFiles = append(jsonFiles, e)
		}
	}

	if len(jsonFiles) <= maxEntries {
		return
	}

	// Sort by name (timestamp) ascending — oldest first
	sort.Slice(jsonFiles, func(i, j int) bool {
		return jsonFiles[i].Name() < jsonFiles[j].Name()
	})

	// Remove oldest entries
	toRemove := len(jsonFiles) - maxEntries
	for i := 0; i < toRemove; i++ {
		os.Remove(filepath.Join(dir, jsonFiles[i].Name()))
	}
}

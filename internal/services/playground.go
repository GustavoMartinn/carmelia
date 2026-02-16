package services

import (
	"os"
	"path/filepath"
)

// PlaygroundPath returns the default playground directory path.
func PlaygroundPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".carmelia", "playground")
}

// EnsurePlayground creates the playground project directory structure if it doesn't exist.
// Returns the playground path.
func EnsurePlayground() (string, error) {
	pgPath := PlaygroundPath()
	if pgPath == "" {
		return "", os.ErrNotExist
	}

	requestsDir := filepath.Join(pgPath, ".carmelia", "requests")
	if err := os.MkdirAll(requestsDir, 0o755); err != nil {
		return "", err
	}

	return pgPath, nil
}

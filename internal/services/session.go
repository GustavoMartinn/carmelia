package services

import (
	"carmelia-desktop/internal/models"
	"encoding/json"
	"os"
	"path/filepath"
)

func stateFilePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "carmelia", "state.json"), nil
}

func SaveSessionState(state models.SessionState) error {
	path, err := stateFilePath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o644)
}

func LoadSessionState() (models.SessionState, error) {
	path, err := stateFilePath()
	if err != nil {
		return models.SessionState{}, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return models.SessionState{}, nil
		}
		return models.SessionState{}, err
	}

	var state models.SessionState
	if err := json.Unmarshal(data, &state); err != nil {
		return models.SessionState{}, nil
	}

	// Filter out paths that no longer exist and deduplicate
	seen := map[string]bool{}
	validPaths := []string{}
	for _, p := range state.ProjectPaths {
		if seen[p] {
			continue
		}
		seen[p] = true
		if info, err := os.Stat(p); err == nil && info.IsDir() {
			validPaths = append(validPaths, p)
		}
	}
	state.ProjectPaths = validPaths

	// Clamp active index
	if state.ActiveProjectIndex >= len(state.ProjectPaths) {
		if len(state.ProjectPaths) > 0 {
			state.ActiveProjectIndex = len(state.ProjectPaths) - 1
		} else {
			state.ActiveProjectIndex = 0
		}
	}
	if state.ActiveProjectIndex < 0 {
		state.ActiveProjectIndex = 0
	}

	return state, nil
}

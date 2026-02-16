package services

import (
	"fmt"
	"carmelia-desktop/internal/models"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

const configFile = ".carmelia/config.yaml"

func LoadConfig(projectPath string) (models.HttxConfig, error) {
	configPath := filepath.Join(projectPath, configFile)

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return models.DefaultConfig, nil
		}
		return models.HttxConfig{}, fmt.Errorf("failed to read config: %w", err)
	}

	var config models.HttxConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return models.HttxConfig{}, fmt.Errorf("failed to parse config: %w", err)
	}

	// Fill defaults for zero values
	if config.Runner.Timeout == 0 {
		config.Runner.Timeout = models.DefaultConfig.Runner.Timeout
	}
	if config.Runner.MaxHistory == 0 {
		config.Runner.MaxHistory = models.DefaultConfig.Runner.MaxHistory
	}
	if config.Output == "" {
		config.Output = models.DefaultConfig.Output
	}

	return config, nil
}

func SaveConfig(projectPath string, config models.HttxConfig) error {
	configPath := filepath.Join(projectPath, configFile)
	if err := os.MkdirAll(filepath.Dir(configPath), 0o755); err != nil {
		return fmt.Errorf("failed to create config dir: %w", err)
	}

	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, data, 0o644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}

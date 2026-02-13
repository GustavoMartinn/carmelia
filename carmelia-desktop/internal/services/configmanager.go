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
	if config.Output == "" {
		config.Output = models.DefaultConfig.Output
	}

	return config, nil
}

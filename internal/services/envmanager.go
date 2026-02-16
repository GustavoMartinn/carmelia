package services

import (
	"fmt"
	"carmelia-desktop/internal/models"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

const envsDir = ".carmelia/envs"

var sysEnvRegex = regexp.MustCompile(`\$\{([^}]+)\}`)

func GetEnvsDir(projectPath string) string {
	return filepath.Join(projectPath, envsDir)
}

func ListEnvs(projectPath string) ([]string, error) {
	dir := GetEnvsDir(projectPath)

	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("failed to read envs dir: %w", err)
	}

	envs := []string{}
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasSuffix(name, ".yaml") || strings.HasSuffix(name, ".yml") {
			envName := strings.TrimSuffix(strings.TrimSuffix(name, ".yaml"), ".yml")
			envs = append(envs, envName)
		}
	}

	return envs, nil
}

func LoadEnv(projectPath, envName string) (models.EnvVariables, error) {
	envPath := filepath.Join(GetEnvsDir(projectPath), envName+".yaml")

	data, err := os.ReadFile(envPath)
	if err != nil {
		// Try .yml extension
		envPath = filepath.Join(GetEnvsDir(projectPath), envName+".yml")
		data, err = os.ReadFile(envPath)
		if err != nil {
			return nil, fmt.Errorf("environment %q not found", envName)
		}
	}

	var raw map[string]interface{}
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse env file: %w", err)
	}

	variables := models.EnvVariables{}
	for key, value := range raw {
		strVal := fmt.Sprintf("%v", value)
		variables[key] = resolveSystemEnvVars(strVal)
	}

	return variables, nil
}

func SaveEnv(projectPath, envName string, variables models.EnvVariables) error {
	dir := GetEnvsDir(projectPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create envs dir: %w", err)
	}

	envPath := filepath.Join(dir, envName+".yaml")

	data, err := yaml.Marshal(variables)
	if err != nil {
		return fmt.Errorf("failed to marshal env: %w", err)
	}

	return os.WriteFile(envPath, data, 0o644)
}

func RenameEnv(projectPath, oldName, newName string) error {
	dir := GetEnvsDir(projectPath)
	oldPath := filepath.Join(dir, oldName+".yaml")
	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		oldPath = filepath.Join(dir, oldName+".yml")
		if _, err := os.Stat(oldPath); os.IsNotExist(err) {
			return fmt.Errorf("environment %q not found", oldName)
		}
	}
	newPath := filepath.Join(dir, newName+".yaml")
	return os.Rename(oldPath, newPath)
}

func resolveSystemEnvVars(value string) string {
	return sysEnvRegex.ReplaceAllStringFunc(value, func(match string) string {
		varName := sysEnvRegex.FindStringSubmatch(match)[1]
		if envVal := os.Getenv(varName); envVal != "" {
			return envVal
		}
		return match
	})
}

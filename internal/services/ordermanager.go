package services

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// OrderMap maps a directory relative path (empty string = root) to an ordered list of child names.
type OrderMap map[string][]string

func orderFilePath(projectPath string) string {
	return filepath.Join(projectPath, ".carmelia", "order.json")
}

// LoadOrder reads .carmelia/order.json and returns the ordering map.
// Returns an empty map if the file doesn't exist.
func LoadOrder(projectPath string) (OrderMap, error) {
	data, err := os.ReadFile(orderFilePath(projectPath))
	if err != nil {
		if os.IsNotExist(err) {
			return OrderMap{}, nil
		}
		return nil, err
	}

	var order OrderMap
	if err := json.Unmarshal(data, &order); err != nil {
		return OrderMap{}, nil
	}
	return order, nil
}

// SaveOrder writes the ordering map to .carmelia/order.json.
func SaveOrder(projectPath string, order OrderMap) error {
	dir := filepath.Join(projectPath, ".carmelia")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(order, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(orderFilePath(projectPath), data, 0o644)
}

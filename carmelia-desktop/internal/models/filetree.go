package models

type FileTreeNode struct {
	Name     string         `json:"name"`
	Path     string         `json:"path"`
	IsDir    bool           `json:"isDir"`
	Method   string         `json:"method,omitempty"`
	Children []FileTreeNode `json:"children,omitempty"`
}

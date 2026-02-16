package services

import (
	"carmelia-desktop/internal/models"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"
)

// CollectAllRequests walks the .carmelia/requests/ tree and parses every .http file
func CollectAllRequests(projectPath string) ([]exportedRequest, error) {
	tree, err := BuildFileTree(projectPath)
	if err != nil {
		return nil, err
	}

	var requests []exportedRequest
	collectFromTree(projectPath, tree, "", &requests)
	return requests, nil
}

type exportedRequest struct {
	Folder string
	Name   string
	Parsed models.ParsedHttpRequest
}

func collectFromTree(projectPath string, nodes []models.FileTreeNode, folder string, out *[]exportedRequest) {
	for _, node := range nodes {
		if node.IsDir {
			sub := folder
			if sub != "" {
				sub += "/" + node.Name
			} else {
				sub = node.Name
			}
			collectFromTree(projectPath, node.Children, sub, out)
		} else {
			content, err := ReadRequest(projectPath, node.Path)
			if err != nil {
				continue
			}
			parsed := ParseHttpFile(content)
			name := node.Name
			if strings.HasSuffix(name, ".http") {
				name = strings.TrimSuffix(name, ".http")
			}
			*out = append(*out, exportedRequest{
				Folder: folder,
				Name:   name,
				Parsed: parsed,
			})
		}
	}
}

// ExportPostmanV21 generates a Postman Collection v2.1 JSON string
func ExportPostmanV21(name string, requests []exportedRequest) (string, error) {
	items := []map[string]any{}

	// Group by folder
	folders := map[string][]map[string]any{}
	var rootItems []map[string]any

	for _, req := range requests {
		item := postmanItem(req)
		if req.Folder == "" {
			rootItems = append(rootItems, item)
		} else {
			folders[req.Folder] = append(folders[req.Folder], item)
		}
	}

	// Add folder items
	folderNames := sortedKeys(folders)
	for _, fname := range folderNames {
		items = append(items, map[string]any{
			"name": fname,
			"item": folders[fname],
		})
	}
	items = append(items, rootItems...)

	collection := map[string]any{
		"info": map[string]any{
			"name":   name,
			"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		},
		"item": items,
	}

	data, err := json.MarshalIndent(collection, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func postmanItem(req exportedRequest) map[string]any {
	headers := []map[string]string{}
	for k, v := range req.Parsed.Headers {
		headers = append(headers, map[string]string{"key": k, "value": v})
	}

	item := map[string]any{
		"name": req.Name,
		"request": map[string]any{
			"method": req.Parsed.Method,
			"header": headers,
			"url": map[string]any{
				"raw": req.Parsed.URL,
			},
		},
	}

	if req.Parsed.Body != "" {
		item["request"].(map[string]any)["body"] = map[string]any{
			"mode": "raw",
			"raw":  req.Parsed.Body,
		}
	}

	return item
}

// ExportInsomniaV4 generates an Insomnia v4 export JSON string
func ExportInsomniaV4(name string, requests []exportedRequest) (string, error) {
	resources := []map[string]any{}

	// Workspace
	wsID := "wrk_carmelia"
	resources = append(resources, map[string]any{
		"_id":       wsID,
		"_type":     "workspace",
		"name":      name,
		"parentId":  nil,
		"scope":     "collection",
	})

	// Folders
	folderIDs := map[string]string{}
	for _, req := range requests {
		if req.Folder != "" {
			if _, exists := folderIDs[req.Folder]; !exists {
				fID := fmt.Sprintf("fld_%s", strings.ReplaceAll(req.Folder, "/", "_"))
				folderIDs[req.Folder] = fID
				resources = append(resources, map[string]any{
					"_id":      fID,
					"_type":    "request_group",
					"name":     req.Folder,
					"parentId": wsID,
				})
			}
		}
	}

	// Requests
	for i, req := range requests {
		parentID := wsID
		if req.Folder != "" {
			parentID = folderIDs[req.Folder]
		}

		headers := []map[string]string{}
		for k, v := range req.Parsed.Headers {
			headers = append(headers, map[string]string{"name": k, "value": v})
		}

		r := map[string]any{
			"_id":      fmt.Sprintf("req_%d", i),
			"_type":    "request",
			"name":     req.Name,
			"method":   req.Parsed.Method,
			"url":      req.Parsed.URL,
			"headers":  headers,
			"parentId": parentID,
		}

		if req.Parsed.Body != "" {
			r["body"] = map[string]any{
				"mimeType": "application/json",
				"text":     req.Parsed.Body,
			}
		}

		resources = append(resources, r)
	}

	export := map[string]any{
		"_type":     "export",
		"__export_format": 4,
		"resources": resources,
	}

	data, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ExportOpenAPI30 generates an OpenAPI 3.0 YAML string
func ExportOpenAPI30(name string, requests []exportedRequest) (string, error) {
	// Build paths grouped by URL path
	type pathOp struct {
		Method  string
		Request exportedRequest
	}
	pathMap := map[string][]pathOp{}

	for _, req := range requests {
		urlPath := extractPath(req.Parsed.URL)
		pathMap[urlPath] = append(pathMap[urlPath], pathOp{
			Method:  strings.ToLower(req.Parsed.Method),
			Request: req,
		})
	}

	var sb strings.Builder
	sb.WriteString("openapi: '3.0.0'\n")
	sb.WriteString("info:\n")
	sb.WriteString(fmt.Sprintf("  title: '%s'\n", escapeYaml(name)))
	sb.WriteString("  version: '1.0.0'\n")
	sb.WriteString("paths:\n")

	paths := sortedKeys(pathMap)
	for _, p := range paths {
		sb.WriteString(fmt.Sprintf("  '%s':\n", escapeYaml(p)))
		for _, op := range pathMap[p] {
			sb.WriteString(fmt.Sprintf("    %s:\n", op.Method))

			// Use docs summary if available, fallback to request name
			summary := op.Request.Name
			if op.Request.Parsed.Docs.Summary != "" {
				summary = op.Request.Parsed.Docs.Summary
			}
			sb.WriteString(fmt.Sprintf("      summary: '%s'\n", escapeYaml(summary)))

			if op.Request.Parsed.Docs.Description != "" {
				sb.WriteString(fmt.Sprintf("      description: '%s'\n", escapeYaml(op.Request.Parsed.Docs.Description)))
			}

			if op.Request.Folder != "" {
				sb.WriteString(fmt.Sprintf("      tags:\n        - '%s'\n", escapeYaml(op.Request.Folder)))
			}

			// Add parameters from docs
			if len(op.Request.Parsed.Docs.Params) > 0 {
				sb.WriteString("      parameters:\n")
				for _, param := range op.Request.Parsed.Docs.Params {
					sb.WriteString(fmt.Sprintf("        - name: '%s'\n", escapeYaml(param.Name)))
					sb.WriteString(fmt.Sprintf("          in: '%s'\n", escapeYaml(param.Location)))
					if param.Description != "" {
						sb.WriteString(fmt.Sprintf("          description: '%s'\n", escapeYaml(param.Description)))
					}
					sb.WriteString("          schema:\n")
					sb.WriteString("            type: string\n")
				}
			}

			if op.Request.Parsed.Body != "" {
				contentType := op.Request.Parsed.Headers["Content-Type"]
				if contentType == "" {
					contentType = "application/json"
				}
				sb.WriteString("      requestBody:\n")
				sb.WriteString("        content:\n")
				sb.WriteString(fmt.Sprintf("          '%s':\n", escapeYaml(contentType)))
				sb.WriteString("            schema:\n")
				sb.WriteString("              type: object\n")
			}

			sb.WriteString("      responses:\n")
			sb.WriteString("        '200':\n")
			sb.WriteString("          description: Successful response\n")
		}
	}

	return sb.String(), nil
}

func extractPath(rawURL string) string {
	// Try to parse as URL, fall back to raw string
	u, err := url.Parse(rawURL)
	if err != nil || u.Path == "" {
		// Try stripping template variables like {{base_url}}/path
		idx := strings.Index(rawURL, "/")
		if idx >= 0 {
			// Find the path part after host/template
			parts := strings.SplitN(rawURL, "//", 2)
			if len(parts) == 2 {
				slashIdx := strings.Index(parts[1], "/")
				if slashIdx >= 0 {
					return parts[1][slashIdx:]
				}
			}
			return rawURL[idx:]
		}
		return "/"
	}
	if u.Path == "" {
		return "/"
	}
	return u.Path
}

func escapeYaml(s string) string {
	s = strings.ReplaceAll(s, "'", "''")
	return s
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// ExportFilename returns an appropriate filename for the given format
func ExportFilename(name, format string) string {
	safe := strings.ReplaceAll(strings.ToLower(name), " ", "-")
	switch format {
	case "postman":
		return safe + ".postman_collection.json"
	case "insomnia":
		return safe + ".insomnia.json"
	case "openapi":
		return safe + ".openapi.yaml"
	default:
		return safe + ".json"
	}
}

// ExportFileFilter returns a Wails file filter for the given format
func ExportFileFilter(format string) (string, string) {
	switch format {
	case "postman":
		return "JSON Files (*.json)", "*.json"
	case "insomnia":
		return "JSON Files (*.json)", "*.json"
	case "openapi":
		return "YAML Files (*.yaml)", "*.yaml"
	default:
		return "All Files", "*.*"
	}
}

// GenerateExport dispatches to the correct exporter
func GenerateExport(name string, requests []exportedRequest, format string) (string, error) {
	switch format {
	case "postman":
		return ExportPostmanV21(name, requests)
	case "insomnia":
		return ExportInsomniaV4(name, requests)
	case "openapi":
		return ExportOpenAPI30(name, requests)
	default:
		return "", fmt.Errorf("unsupported export format: %s", format)
	}
}

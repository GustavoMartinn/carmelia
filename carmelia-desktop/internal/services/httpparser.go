package services

import (
	"carmelia-desktop/internal/models"
	"regexp"
	"strings"
)

var methodRegex = regexp.MustCompile(`(?i)^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.+)$`)
var headerRegex = regexp.MustCompile(`^([\w-]+)\s*:\s*(.+)$`)

func ParseHttpFile(content string) models.ParsedHttpRequest {
	lines := strings.Split(content, "\n")
	comments := []string{}
	method := ""
	url := ""
	headers := map[string]string{}
	bodyLines := []string{}
	phase := "comments" // comments | request-line | headers | body

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if phase == "comments" {
			if trimmed == "" {
				continue
			}
			if strings.HasPrefix(trimmed, "#") {
				comments = append(comments, strings.TrimSpace(trimmed[1:]))
				continue
			}
			phase = "request-line"
		}

		if phase == "request-line" {
			match := methodRegex.FindStringSubmatch(trimmed)
			if match != nil {
				method = strings.ToUpper(match[1])
				url = strings.TrimSpace(match[2])
				phase = "headers"
				continue
			}
			continue
		}

		if phase == "headers" {
			if trimmed == "" {
				phase = "body"
				continue
			}

			headerMatch := headerRegex.FindStringSubmatch(trimmed)
			if headerMatch != nil {
				headers[headerMatch[1]] = strings.TrimSpace(headerMatch[2])
				continue
			}

			// Not a header — start of body
			phase = "body"
			bodyLines = append(bodyLines, line)
			continue
		}

		if phase == "body" {
			bodyLines = append(bodyLines, line)
		}
	}

	// Trim trailing empty lines from body
	for len(bodyLines) > 0 && strings.TrimSpace(bodyLines[len(bodyLines)-1]) == "" {
		bodyLines = bodyLines[:len(bodyLines)-1]
	}

	body := ""
	if len(bodyLines) > 0 {
		body = strings.Join(bodyLines, "\n")
	}

	return models.ParsedHttpRequest{
		Method:   method,
		URL:      url,
		Headers:  headers,
		Body:     body,
		Comments: comments,
	}
}

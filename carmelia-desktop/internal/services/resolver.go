package services

import (
	"encoding/json"
	"carmelia-desktop/internal/models"
	"os"
	"regexp"
	"strconv"
)

var varRegex = regexp.MustCompile(`\{\{(\w+)\}\}`)
var envVarRegex = regexp.MustCompile(`\$\{([^}]+)\}`)

type ResolveOptions struct {
	Env  models.EnvVariables   `json:"env"`
	Sets map[string]string     `json:"sets"`
}

func ResolveVariables(text string, opts ResolveOptions) string {
	result := text

	// 1. Resolve {{var}} — sets override env
	result = varRegex.ReplaceAllStringFunc(result, func(match string) string {
		varName := varRegex.FindStringSubmatch(match)[1]
		if val, ok := opts.Sets[varName]; ok {
			return val
		}
		if val, ok := opts.Env[varName]; ok {
			return val
		}
		return match
	})

	// 2. Resolve ${ENV_VAR} — system environment
	result = envVarRegex.ReplaceAllStringFunc(result, func(match string) string {
		varName := envVarRegex.FindStringSubmatch(match)[1]
		if val := os.Getenv(varName); val != "" {
			return val
		}
		return match
	})

	return result
}

func ResolveRequest(req models.ParsedHttpRequest, opts ResolveOptions) models.ParsedHttpRequest {
	resolved := models.ParsedHttpRequest{
		Method:   req.Method,
		URL:      ResolveVariables(req.URL, opts),
		Headers:  map[string]string{},
		Comments: req.Comments,
	}

	for k, v := range req.Headers {
		resolved.Headers[k] = ResolveVariables(v, opts)
	}

	if req.Body != "" {
		resolved.Body = ResolveVariables(req.Body, opts)

		// Apply --set overrides to JSON body fields
		if len(opts.Sets) > 0 {
			trimmed := []byte(resolved.Body)
			var parsed map[string]interface{}
			if err := json.Unmarshal(trimmed, &parsed); err == nil {
				for key, value := range opts.Sets {
					if _, exists := parsed[key]; exists {
						parsed[key] = parseValue(value)
					}
				}
				if out, err := json.MarshalIndent(parsed, "", "  "); err == nil {
					resolved.Body = string(out)
				}
			}
		}
	}

	return resolved
}

func parseValue(value string) interface{} {
	if value == "true" {
		return true
	}
	if value == "false" {
		return false
	}
	if value == "null" {
		return nil
	}
	if num, err := strconv.ParseFloat(value, 64); err == nil {
		return num
	}
	return value
}

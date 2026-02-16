package services

import (
	"fmt"
	"strings"
)

// booleanFlags lists curl flags that do NOT take an argument.
var booleanFlags = map[string]bool{
	"-L": true, "--location": true,
	"-s": true, "--silent": true,
	"-S": true, "--show-error": true,
	"-v": true, "--verbose": true,
	"-i": true, "--include": true,
	"-k": true, "--insecure": true,
	"-I": true, "--head": true,
	"-N": true, "--no-buffer": true,
	"-f": true, "--fail": true,
	"-g": true, "--globoff": true,
	"--compressed": true,
	"--location-trusted": true,
	"--tr-encoding": true,
	"--raw": true,
	"--ssl": true,
	"--ssl-reqd": true,
	"--tcp-nodelay": true,
	"--no-keepalive": true,
	"--no-sessionid": true,
	"--http1.0": true,
	"--http1.1": true,
	"--http2": true,
}

// ParseCurl converts a curl command string into .http file content.
func ParseCurl(curlCmd string) (string, error) {
	tokens, err := tokenize(curlCmd)
	if err != nil {
		return "", fmt.Errorf("failed to parse curl command: %w", err)
	}

	if len(tokens) == 0 {
		return "", fmt.Errorf("empty curl command")
	}

	// Strip leading "curl" if present
	if strings.ToLower(tokens[0]) == "curl" {
		tokens = tokens[1:]
	}

	method := ""
	url := ""
	headers := [][2]string{}
	body := ""

	i := 0
	for i < len(tokens) {
		tok := tokens[i]

		switch {
		case tok == "-X" || tok == "--request":
			i++
			if i < len(tokens) {
				method = strings.ToUpper(tokens[i])
			}

		case tok == "-H" || tok == "--header":
			i++
			if i < len(tokens) {
				parts := strings.SplitN(tokens[i], ":", 2)
				if len(parts) == 2 {
					headers = append(headers, [2]string{strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])})
				}
			}

		case tok == "-d" || tok == "--data" || tok == "--data-raw" || tok == "--data-binary":
			i++
			if i < len(tokens) {
				body = tokens[i]
			}

		case tok == "-u" || tok == "--user":
			i++
			if i < len(tokens) {
				// Basic auth: encode as Authorization header
				headers = append(headers, [2]string{"Authorization", "Basic " + tokens[i]})
			}

		case tok == "--url":
			i++
			if i < len(tokens) {
				url = tokens[i]
			}

		case booleanFlags[tok]:
			// Known boolean flag — no argument to skip

		case !strings.HasPrefix(tok, "-"):
			// Positional argument — treat as URL
			if url == "" {
				url = tok
			}

		default:
			// Unknown flag with a possible argument — only skip next if it looks like a value
			if i+1 < len(tokens) && !strings.HasPrefix(tokens[i+1], "-") {
				i++
			}
		}

		i++
	}

	if url == "" {
		return "", fmt.Errorf("no URL found in curl command")
	}

	// Default method
	if method == "" {
		if body != "" {
			method = "POST"
		} else {
			method = "GET"
		}
	}

	// Build .http content
	var b strings.Builder
	b.WriteString(method)
	b.WriteString(" ")
	b.WriteString(url)
	b.WriteString("\n")

	for _, h := range headers {
		b.WriteString(h[0])
		b.WriteString(": ")
		b.WriteString(h[1])
		b.WriteString("\n")
	}

	if body != "" {
		b.WriteString("\n")
		b.WriteString(body)
		b.WriteString("\n")
	}

	return b.String(), nil
}

// tokenize splits a shell-like command string into tokens, respecting single and double quotes
// and handling backslash line continuations.
func tokenize(input string) ([]string, error) {
	// Normalize line continuations: backslash followed by newline
	input = strings.ReplaceAll(input, "\\\n", " ")
	input = strings.ReplaceAll(input, "\\\r\n", " ")

	var tokens []string
	var current strings.Builder
	inSingle := false
	inDouble := false
	escaped := false

	for i := 0; i < len(input); i++ {
		ch := input[i]

		if escaped {
			current.WriteByte(ch)
			escaped = false
			continue
		}

		if ch == '\\' && !inSingle {
			escaped = true
			continue
		}

		if ch == '\'' && !inDouble {
			inSingle = !inSingle
			continue
		}

		if ch == '"' && !inSingle {
			inDouble = !inDouble
			continue
		}

		if (ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r') && !inSingle && !inDouble {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			continue
		}

		current.WriteByte(ch)
	}

	if inSingle || inDouble {
		return nil, fmt.Errorf("unterminated quote in command")
	}

	if current.Len() > 0 {
		tokens = append(tokens, current.String())
	}

	return tokens, nil
}

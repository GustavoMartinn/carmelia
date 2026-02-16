package services

import (
	"context"
	"fmt"
	"carmelia-desktop/internal/models"
	"io"
	"net/http"
	"strings"
	"time"
)

type ExecuteOptions struct {
	Method          string            `json:"method"`
	URL             string            `json:"url"`
	Headers         map[string]string `json:"headers"`
	Body            string            `json:"body,omitempty"`
	Timeout         int               `json:"timeout"`
	FollowRedirects bool             `json:"followRedirects"`
}

func ExecuteRequest(opts ExecuteOptions) (models.HttpResponse, error) {
	timeout := time.Duration(opts.Timeout) * time.Millisecond
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var bodyReader io.Reader
	if opts.Body != "" {
		bodyReader = strings.NewReader(opts.Body)
	}

	req, err := http.NewRequestWithContext(ctx, opts.Method, opts.URL, bodyReader)
	if err != nil {
		return models.HttpResponse{}, fmt.Errorf("failed to create request: %w", err)
	}

	for key, value := range opts.Headers {
		req.Header.Set(key, value)
	}

	client := &http.Client{
		Timeout: timeout,
	}

	if !opts.FollowRedirects {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	start := time.Now()
	resp, err := client.Do(req)
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return models.HttpResponse{}, fmt.Errorf("request timed out after %dms — %s %s", opts.Timeout, opts.Method, opts.URL)
		}
		if strings.Contains(err.Error(), "connection refused") {
			return models.HttpResponse{}, fmt.Errorf("connection refused — is the server running at %s?", opts.URL)
		}
		return models.HttpResponse{}, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return models.HttpResponse{}, fmt.Errorf("failed to read response body: %w", err)
	}

	responseHeaders := map[string]string{}
	for key := range resp.Header {
		responseHeaders[key] = resp.Header.Get(key)
	}

	// Extract cookies
	var cookies []models.CookieInfo
	for _, c := range resp.Cookies() {
		sameSite := ""
		switch c.SameSite {
		case http.SameSiteLaxMode:
			sameSite = "Lax"
		case http.SameSiteStrictMode:
			sameSite = "Strict"
		case http.SameSiteNoneMode:
			sameSite = "None"
		}

		expires := ""
		if !c.Expires.IsZero() {
			expires = c.Expires.Format(time.RFC3339)
		}

		cookies = append(cookies, models.CookieInfo{
			Name:     c.Name,
			Value:    c.Value,
			Domain:   c.Domain,
			Path:     c.Path,
			Expires:  expires,
			SameSite: sameSite,
			MaxAge:   c.MaxAge,
			Secure:   c.Secure,
			HttpOnly: c.HttpOnly,
		})
	}

	return models.HttpResponse{
		Status:     resp.StatusCode,
		StatusText: resp.Status,
		Headers:    responseHeaders,
		Body:       string(bodyBytes),
		Time:       elapsed,
		Size:       len(bodyBytes),
		Cookies:    cookies,
	}, nil
}

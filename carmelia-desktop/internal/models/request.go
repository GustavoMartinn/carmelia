package models

type ParsedHttpRequest struct {
	Method   string            `json:"method"`
	URL      string            `json:"url"`
	Headers  map[string]string `json:"headers"`
	Body     string            `json:"body,omitempty"`
	Comments []string          `json:"comments"`
}

type HttpResponse struct {
	Status     int               `json:"status"`
	StatusText string            `json:"statusText"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Time       int64             `json:"time"`
	Size       int               `json:"size"`
}

type RunResult struct {
	Request  ParsedHttpRequest `json:"request"`
	Response HttpResponse      `json:"response"`
	Error    string            `json:"error,omitempty"`
}

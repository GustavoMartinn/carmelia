package models

type HistoryEntry struct {
	ID        string            `json:"id"`
	Timestamp int64             `json:"timestamp"`
	Request   ParsedHttpRequest `json:"request"`
	Response  HttpResponse      `json:"response"`
	Error     string            `json:"error,omitempty"`
}

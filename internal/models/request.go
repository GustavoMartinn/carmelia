package models

type ParamDoc struct {
	Name        string `json:"name"`
	Location    string `json:"location"`
	Description string `json:"description"`
}

type RequestDocs struct {
	Summary     string     `json:"summary,omitempty"`
	Description string     `json:"description,omitempty"`
	Params      []ParamDoc `json:"params,omitempty"`
}

type ParsedHttpRequest struct {
	Method   string            `json:"method"`
	URL      string            `json:"url"`
	Headers  map[string]string `json:"headers"`
	Body     string            `json:"body,omitempty"`
	Comments []string          `json:"comments"`
	Docs     RequestDocs       `json:"docs"`
}

type CookieInfo struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Domain   string `json:"domain"`
	Path     string `json:"path"`
	Expires  string `json:"expires"`
	SameSite string `json:"sameSite"`
	MaxAge   int    `json:"maxAge"`
	Secure   bool   `json:"secure"`
	HttpOnly bool   `json:"httpOnly"`
}

type HttpResponse struct {
	Status     int               `json:"status"`
	StatusText string            `json:"statusText"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Time       int64             `json:"time"`
	Size       int               `json:"size"`
	Cookies    []CookieInfo      `json:"cookies,omitempty"`
}

type RunResult struct {
	Request  ParsedHttpRequest `json:"request"`
	Response HttpResponse      `json:"response"`
	Error    string            `json:"error,omitempty"`
}

package models

type HttxConfig struct {
	Version    int              `json:"version" yaml:"version"`
	Frameworks []FrameworkSource `json:"frameworks" yaml:"frameworks"`
	Output     string           `json:"output" yaml:"output"`
	Generator  GeneratorConfig  `json:"generator" yaml:"generator"`
	Runner     RunnerConfig     `json:"runner" yaml:"runner"`
	Defaults   DefaultsConfig   `json:"defaults" yaml:"defaults"`
}

type FrameworkSource struct {
	Type    string   `json:"type" yaml:"type"`
	Source  string   `json:"source" yaml:"source"`
	Include []string `json:"include,omitempty" yaml:"include,omitempty"`
	Exclude []string `json:"exclude,omitempty" yaml:"exclude,omitempty"`
}

type GeneratorConfig struct {
	BodyStyle         string `json:"bodyStyle" yaml:"bodyStyle"`
	IncludeComments   bool   `json:"includeComments" yaml:"includeComments"`
	IncludeValidation bool   `json:"includeValidation" yaml:"includeValidation"`
}

type RunnerConfig struct {
	Timeout         int    `json:"timeout" yaml:"timeout"`
	FollowRedirects bool   `json:"followRedirects" yaml:"followRedirects"`
	SaveResponses   bool   `json:"saveResponses" yaml:"saveResponses"`
	ResponsesDir    string `json:"responsesDir" yaml:"responsesDir"`
	MaxHistory      int    `json:"maxHistory" yaml:"maxHistory"`
}

type DefaultsConfig struct {
	Headers map[string]string `json:"headers" yaml:"headers"`
}

var DefaultConfig = HttxConfig{
	Version:    1,
	Frameworks: []FrameworkSource{},
	Output:     "./.carmelia/requests",
	Generator: GeneratorConfig{
		BodyStyle:         "typed",
		IncludeComments:   true,
		IncludeValidation: true,
	},
	Runner: RunnerConfig{
		Timeout:         30000,
		FollowRedirects: true,
		SaveResponses:   true,
		ResponsesDir:    "./.carmelia/responses",
		MaxHistory:      10,
	},
	Defaults: DefaultsConfig{
		Headers: map[string]string{
			"Content-Type": "application/json",
			"Accept":       "application/json",
		},
	},
}

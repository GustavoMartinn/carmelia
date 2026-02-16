package models

type EnvVariables map[string]string

type EnvFile struct {
	Name      string       `json:"name"`
	Variables EnvVariables `json:"variables"`
}

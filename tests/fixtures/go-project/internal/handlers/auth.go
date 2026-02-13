package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/example/api/internal/models"
)

func Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	json.NewDecoder(r.Body).Decode(&req)
	json.NewEncoder(w).Encode(map[string]string{"token": "jwt-token"})
}

func GetProfile(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{})
}

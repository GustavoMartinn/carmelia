package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/example/api/internal/models"
)

func ListUsers(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode([]string{})
}

func GetUser(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{})
}

func CreateUser(w http.ResponseWriter, r *http.Request) {
	var req models.CreateUserRequest
	json.NewDecoder(r.Body).Decode(&req)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

func UpdateUser(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateUserRequest
	json.NewDecoder(r.Body).Decode(&req)
	json.NewEncoder(w).Encode(req)
}

func DeleteUser(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/example/api/internal/handlers"
	"github.com/example/api/internal/middleware"
)

func main() {
	r := chi.NewRouter()

	r.Get("/health", HealthCheck)

	r.Route("/users", func(r chi.Router) {
		r.Get("/", handlers.ListUsers)
		r.Get("/{id}", handlers.GetUser)
		r.Post("/", handlers.CreateUser)
		r.Put("/{id}", handlers.UpdateUser)
		r.Delete("/{id}", handlers.DeleteUser)
	})

	r.Route("/auth", func(r chi.Router) {
		r.Post("/login", handlers.Login)
	})

	r.Route("/profile", func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Get("/", handlers.GetProfile)
	})

	http.ListenAndServe(":3000", r)
}

func HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte(`{"status":"ok"}`))
}

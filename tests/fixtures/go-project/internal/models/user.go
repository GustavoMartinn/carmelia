package models

type Address struct {
	Street  string `json:"street" validate:"required"`
	City    string `json:"city" validate:"required"`
	ZipCode string `json:"zip_code" validate:"required"`
}

type CreateUserRequest struct {
	Name    string   `json:"name" validate:"required,min=2"`
	Email   string   `json:"email" validate:"required,email"`
	Age     int      `json:"age,omitempty"`
	Role    string   `json:"role" validate:"required,oneof=admin user"`
	Address *Address `json:"address" validate:"required"`
}

type UpdateUserRequest struct {
	Name  *string `json:"name,omitempty" validate:"omitempty,min=2"`
	Email *string `json:"email,omitempty" validate:"omitempty,email"`
	Age   *int    `json:"age,omitempty"`
	Role  *string `json:"role,omitempty" validate:"omitempty,oneof=admin user"`
}

package response

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/puppet/getoken/server/internal/pkg/errkit"
)

// Envelope is what the frontend `apiFetch` unwraps via `.data`.
type Envelope struct {
	Data    any    `json:"data,omitempty"`
	Message string `json:"message,omitempty"`
	Code    string `json:"code,omitempty"`
}

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Envelope{Data: data})
}

func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, Envelope{Data: data})
}

func NoContent(c *gin.Context) {
	c.JSON(http.StatusOK, Envelope{Data: struct{}{}})
}

func Fail(c *gin.Context, err error) {
	var appErr *errkit.AppError
	if errors.As(err, &appErr) {
		c.AbortWithStatusJSON(appErr.HTTP, Envelope{Message: appErr.Message, Code: appErr.Code})
		return
	}
	c.AbortWithStatusJSON(http.StatusInternalServerError, Envelope{
		Message: "internal server error",
		Code:    "internal",
	})
}

// Page is the standard pagination payload used by list endpoints.
type Page[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
}

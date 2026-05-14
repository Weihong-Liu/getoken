package errkit

import "fmt"

// AppError is a typed error that maps to an HTTP status + business code.
type AppError struct {
	HTTP    int
	Code    string
	Message string
}

func (e *AppError) Error() string { return fmt.Sprintf("[%s] %s", e.Code, e.Message) }

func New(http int, code, message string) *AppError {
	return &AppError{HTTP: http, Code: code, Message: message}
}

var (
	ErrUnauthorized = New(401, "unauthorized", "未登录或登录已过期")
	ErrForbidden    = New(403, "forbidden", "无权访问")
	ErrNotFound     = New(404, "not_found", "资源不存在")
	ErrBadRequest   = New(400, "bad_request", "请求参数有误")
	ErrConflict     = New(409, "conflict", "资源冲突")
	ErrInternal     = New(500, "internal", "服务器内部错误")
)

func BadRequest(msg string) *AppError { return New(400, "bad_request", msg) }
func Conflict(msg string) *AppError   { return New(409, "conflict", msg) }
func NotFound(msg string) *AppError   { return New(404, "not_found", msg) }
func Unauthorized(msg string) *AppError {
	return New(401, "unauthorized", msg)
}

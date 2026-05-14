.PHONY: tidy run build test migrate fmt

tidy:
	go mod tidy

run:
	go run ./cmd/getoken

build:
	CGO_ENABLED=0 go build -o bin/getoken ./cmd/getoken

test:
	go test ./...

fmt:
	gofmt -s -w .

migrate-up:
	go run ./cmd/getoken migrate up

migrate-down:
	go run ./cmd/getoken migrate down

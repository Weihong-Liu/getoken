FROM golang:1.25 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/getoken ./cmd/getoken

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/getoken /app/getoken
USER nonroot:nonroot
EXPOSE 3000
ENTRYPOINT ["/app/getoken"]

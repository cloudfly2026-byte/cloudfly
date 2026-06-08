FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY . .

RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o storefront ./cmd/server

FROM alpine:latest

WORKDIR /app
COPY --from=builder /app/storefront .

EXPOSE 8080

CMD ["./storefront"]

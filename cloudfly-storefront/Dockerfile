FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY . .

RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o storefront ./cmd/server

FROM alpine:latest

WORKDIR /app
COPY --from=builder /app/storefront .
# Create the uploads directory for shared media files
RUN mkdir -p /uploads

EXPOSE 8080

CMD ["./storefront"]

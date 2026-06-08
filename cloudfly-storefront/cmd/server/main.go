package main

import (
	"log"

	"cloudfly-storefront/internal/database"
	"cloudfly-storefront/internal/handlers"
	"github.com/gofiber/fiber/v2"
)

func main() {
	// Initialize Redis Connection
	database.InitRedis()

	app := fiber.New()

	app.Get("/health", handlers.Health)
	app.Get("/", handlers.Home)

	log.Println("CloudFly StoreFront listening on :8080")
	log.Fatal(app.Listen(":8080"))
}

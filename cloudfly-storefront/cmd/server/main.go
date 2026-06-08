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
	// Initialize MySQL Connection
	database.InitMySQL()

	app := fiber.New()

	app.Get("/health", handlers.Health)
	// Serve uploaded media files from the shared /uploads volume — PUBLIC, no auth required.
	// Files are stored as /uploads/{tenantId}/{companyId}/{filename}
	// and served at /media/{tenantId}/{companyId}/{filename}
	app.Static("/media", "/uploads", fiber.Static{
		Compress:  true,
		ByteRange: true,
		Browse:    false,
	})
	app.Get("/", handlers.Home)

	log.Println("CloudFly StoreFront listening on :8080")
	log.Fatal(app.Listen(":8080"))
}

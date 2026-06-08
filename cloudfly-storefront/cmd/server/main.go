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
	// Serve uploaded media files
	app.Static("/media", "/uploads", fiber.Static{
		Compress:  true,
		ByteRange: true,
		Browse:    false,
	})
	app.Get("/", handlers.Home)
	// Static pages
	app.Get("/catalogo", handlers.CatalogoPage)
	app.Get("/carrito", handlers.CarritoPage)
	app.Get("/nosotros", handlers.NosotrosPage)
	app.Get("/contacto", handlers.ContactoPage)
	// SEO-friendly routes: /categoria  and  /categoria/producto
	app.Get("/:categorySlug", handlers.CategoryPage)
	app.Get("/:categorySlug/:productSlug", handlers.ProductPage)

	log.Println("CloudFly StoreFront listening on :8080")
	log.Fatal(app.Listen(":8080"))
}

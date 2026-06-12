package main

import (
	"log"

	"cloudfly-storefront/internal/database"
	"cloudfly-storefront/internal/domainresolver"
	"cloudfly-storefront/internal/handlers"
	"cloudfly-storefront/internal/layout"
	"cloudfly-storefront/internal/render"
	"cloudfly-storefront/internal/theme"

	"github.com/gofiber/fiber/v2"
)

func main() {
	// Initialize Redis Connection
	database.InitRedis()
	// Initialize MySQL Connection
	database.InitMySQL()

	// Initialize Multi-Tenant Services & Repositories
	themeRepo := theme.NewRepository(database.DB)
	handlers.ThemeService = theme.NewService(themeRepo)

	layoutRepo := layout.NewRepository(database.DB)
	handlers.LayoutService = layout.NewService(layoutRepo)

	templatesDir := render.FindTemplatesDir()
	var err error
	handlers.Renderer, err = render.NewRenderer(templatesDir)
	if err != nil {
		log.Fatalf("❌ [Renderer Load Error]: %v", err)
	}

	app := fiber.New()

	app.Get("/health", handlers.Health)

	// Register multi-tenant domain resolver middleware
	app.Use(domainresolver.WebsiteResolver())

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


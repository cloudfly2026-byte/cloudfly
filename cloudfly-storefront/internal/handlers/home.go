package handlers

import (
	"bytes"
	"encoding/json"
	"html/template"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloudfly-storefront/internal/database"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

type Tenant struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Subdomain string `json:"subdomain"`
	Theme     string `json:"theme"`
}

type Product struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
}

func Home(c *fiber.Ctx) error {
	host := c.Hostname()

	// 1. Extraer subdominio (ej: "tienda1" de "tienda1.cloudfly.com.co")
	subdomain := "default"
	parts := strings.Split(host, ".")
	if len(parts) >= 3 {
		subdomain = parts[0]
	}

	// 2. Intentar obtener el tenant de Redis
	var tenant Tenant
	var cacheKey = "tenant:domain:" + subdomain
	var fromCache = false

	if database.RedisClient != nil {
		val, err := database.RedisClient.Get(database.Ctx, cacheKey).Result()
		if err == nil {
			err = json.Unmarshal([]byte(val), &tenant)
			if err == nil {
				fromCache = true
			}
		}
	}

	// 3. Fallback / Mock de Tenant si no está en caché
	if !fromCache {
		// Crear tenant de prueba dinámico basado en el subdominio
		tenant = Tenant{
			ID:        100,
			Name:      strings.Title(subdomain) + " Shop",
			Subdomain: subdomain,
			Theme:     "dark", // Opcional: "light" o "dark"
		}

		// Si es el subdominio "default" o no reconocido, personalizar un poco
		if subdomain == "localhost" || subdomain == "default" || subdomain == "127" {
			tenant.Name = "CloudFly StoreFront"
			tenant.Theme = "dark"
		} else if strings.HasSuffix(subdomain, "light") {
			tenant.Theme = "light"
		}

		// Almacenar en Redis por 10 minutos
		if database.RedisClient != nil {
			tenantJson, err := json.Marshal(tenant)
			if err == nil {
				database.RedisClient.Set(database.Ctx, cacheKey, string(tenantJson), 10*time.Minute)
				log.Printf("📥 [Redis Cache]: Tenant cacheado para subdominio '%s'", subdomain)
			}
		}
	} else {
		log.Printf("🚀 [Redis Cache Hit]: Tenant obtenido desde caché para subdominio '%s'", subdomain)
	}

	// 4. Cargar lista de productos de prueba
	products := []Product{
		{
			Name:        "Auriculares Inalámbricos Pro",
			Description: "Cancelación activa de ruido, batería de 40 horas y sonido de alta fidelidad.",
			Price:       129.99,
		},
		{
			Name:        "Teclado Mecánico RGB",
			Description: "Switches mecánicos silenciosos, retroiluminación RGB personalizable y diseño ergonómico.",
			Price:       89.50,
		},
		{
			Name:        "Mouse Gamer Ultra-Ligero",
			Description: "Sensor óptico de 26,000 DPI, diseño ultraligero y conectividad inalámbrica libre de retraso.",
			Price:       59.99,
		},
	}

	// 5. Intentar resolver la ruta de la plantilla HTML
	tmplPaths := []string{
		filepath.Join("/webTemplates", "default", "index.html"),
		filepath.Join("webTemplates", "default", "index.html"),
		filepath.Join("../webTemplates", "default", "index.html"),
		filepath.Join("../../webTemplates", "default", "index.html"),
		filepath.Join("..", "..", "webTemplates", "default", "index.html"),
	}

	var indexTemplatePath string
	for _, p := range tmplPaths {
		if _, err := os.Stat(p); err == nil {
			indexTemplatePath = p
			break
		}
	}

	if indexTemplatePath == "" {
		// Fallback: Si no se encuentra la plantilla en ninguna ruta, renderizar JSON
		return c.JSON(fiber.Map{
			"message":   "Plantilla HTML no encontrada",
			"tenant":    tenant,
			"products":  products,
			"fromCache": fromCache,
		})
	}

	// 6. Parsear y renderizar plantilla HTML
	tmpl, err := template.ParseFiles(indexTemplatePath)
	if err != nil {
		return c.Status(500).SendString("Error al procesar la plantilla: " + err.Error())
	}

	var buf bytes.Buffer
	err = tmpl.Execute(&buf, fiber.Map{
		"Tenant":   tenant,
		"Products": products,
	})
	if err != nil {
		return c.Status(500).SendString("Error al renderizar los datos: " + err.Error())
	}

	c.Set("Content-Type", "text/html")
	return c.Send(buf.Bytes())
}

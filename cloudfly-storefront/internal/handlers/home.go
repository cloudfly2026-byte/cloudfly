package handlers

import (
	"bytes"
	"database/sql"
	"html/template"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloudfly-storefront/internal/database"
	"github.com/gofiber/fiber/v2"
)

type Company struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Logo        string `json:"logo"`
	Description string `json:"description"`
}

type Theme struct {
	PrimaryColor   string `json:"primary_color"`
	SecondaryColor string `json:"secondary_color"`
}

type Category struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
	Icon string `json:"icon"`
}

type Product struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Category    string  `json:"category"`
	Brand       string  `json:"brand"`
	Image       string  `json:"image"`
	Rating      float64 `json:"rating"`
	Available   bool    `json:"available"`
}

type StorefrontData struct {
	Company    Company
	Theme      Theme
	Categories []Category
	Products   []Product
}

func slugify(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "-")
	var res []rune
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			res = append(res, r)
		}
	}
	return string(res)
}

func getCategoryIcon(name string) string {
	nameLower := strings.ToLower(name)
	if strings.Contains(nameLower, "comput") || strings.Contains(nameLower, "electr") || strings.Contains(nameLower, "tecnol") {
		return "fa-solid fa-laptop"
	}
	if strings.Contains(nameLower, "reloj") || strings.Contains(nameLower, "accesor") {
		return "fa-solid fa-clock"
	}
	if strings.Contains(nameLower, "ropa") || strings.Contains(nameLower, "vestir") || strings.Contains(nameLower, "moda") || strings.Contains(nameLower, "estilo") {
		return "fa-solid fa-shirt"
	}
	if strings.Contains(nameLower, "deport") || strings.Contains(nameLower, "fit") {
		return "fa-solid fa-dumbbell"
	}
	return "fa-solid fa-tag"
}

func Home(c *fiber.Ctx) error {
	host := c.Hostname()

	// Handle local development hostname fallback
	isLocal := host == "localhost" || host == "127.0.0.1" || strings.HasPrefix(host, "192.168.") || strings.HasPrefix(host, "10.")
	domainName := host
	if isLocal {
		domainName = "cloudflyshop.cloudfly.com.co" // Fallback seed domain for local testing
	}

	// 1. Resolve host in company_domains table
	var tenantID int64
	var companyID int64
	var estado string
	var fechaCaduca sql.NullTime

	var resolved = false
	if database.DB != nil {
		err := database.DB.QueryRow("SELECT tenant_id, company_id, estado, fecha_caduca FROM company_domains WHERE domain_name = ? LIMIT 1", domainName).Scan(&tenantID, &companyID, &estado, &fechaCaduca)
		if err == nil {
			resolved = true
		} else if err != sql.ErrNoRows {
			log.Printf("⚠️  [MySQL Query Error]: %v", err)
		}
	}

	// If the domain is not registered, redirect to CloudFly landing page
	if !resolved && !isLocal {
		return c.Redirect("https://www.cloudfly.com.co", 302)
	}

	// If resolved, verify subscription is active
	if resolved {
		isActive := strings.ToLower(estado) == "activo"
		if fechaCaduca.Valid && fechaCaduca.Time.Before(time.Now()) {
			isActive = false
		}
		if !isActive {
			return c.Status(403).SendString("<h1>403 Acceso Denegado</h1><p>La suscripción de este comercio no se encuentra activa o ha caducado. Por favor contacte al administrador de CloudFly.</p>")
		}

		// 1.5 Verify active subscription in subscriptions table (customer_id = tenantID)
		if database.DB != nil {
			var subStatus string
			var subEndDate time.Time
			err := database.DB.QueryRow("SELECT status, end_date FROM subscriptions WHERE customer_id = ? AND status = 'ACTIVE' AND end_date > ? LIMIT 1", tenantID, time.Now()).Scan(&subStatus, &subEndDate)
			if err != nil {
				if err == sql.ErrNoRows {
					return c.Status(403).SendString("<h1>403 Acceso Denegado</h1><p>El comercio no tiene una suscripción de plan activa o vigente. Por favor contacte al administrador de CloudFly.</p>")
				}
				log.Printf("⚠️  [Subscription Check Error]: %v", err)
			}
		}
	}

	// Default/Mock metadata fallbacks
	company := Company{
		ID:          companyID,
		Name:        "CloudFly Storefront",
		Logo:        "",
		Description: "Plataforma de ecommerce premium de alta velocidad. Productos de alta calidad y envíos inmediatos.",
	}
	theme := Theme{
		PrimaryColor:   "#6366f1",
		SecondaryColor: "#10b981",
	}
	categories := []Category{
		{Name: "Electrónica", Slug: "electronica", Icon: "fa-solid fa-laptop"},
		{Name: "Accesorios", Slug: "accesorios", Icon: "fa-solid fa-clock"},
		{Name: "Estilo & Moda", Slug: "estilo", Icon: "fa-solid fa-shirt"},
		{Name: "Deportes", Slug: "deportes", Icon: "fa-solid fa-dumbbell"},
	}
	products := []Product{
		{
			Name:        "Auriculares Cancelación Ruido Pro",
			Description: "Auriculares inalámbricos premium con cancelación activa de ruido premium y 40h de autonomía.",
			Price:       129.99,
			Category:    "electronica",
			Brand:       "SonyPlus",
			Image:       "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80",
			Rating:      4.9,
			Available:   true,
		},
		{
			Name:        "Reloj Inteligente Fit Sport v2",
			Description: "Monitor de salud avanzado, GPS incorporado y resistente al agua hasta 50 metros.",
			Price:       189.50,
			Category:    "accesorios",
			Brand:       "FitMax",
			Image:       "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80",
			Rating:      4.7,
			Available:   true,
		},
		{
			Name:        "Cargador Rápido GaN 100W",
			Description: "Carga hasta 3 dispositivos simultáneamente a máxima velocidad.",
			Price:       45.00,
			Category:    "electronica",
			Brand:       "AnkerTech",
			Image:       "https://images.unsplash.com/photo-1622445262465-2481c8573296?w=500&q=80",
			Rating:      4.5,
			Available:   true,
		},
		{
			Name:        "Mochila Impermeable Urban Tech",
			Description: "Diseño ergonómico con puerto USB de carga externa y compartimiento para laptop de 16 pulgadas.",
			Price:       75.00,
			Category:    "estilo",
			Brand:       "Urbanite",
			Image:       "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80",
			Rating:      4.6,
			Available:   true,
		},
	}

	// 2. Fetch Company metadata from companies table if available
	if resolved && database.DB != nil {
		var logoURL sql.NullString
		var compDesc sql.NullString
		err := database.DB.QueryRow("SELECT name, logo_url, company_description FROM companies WHERE id = ? LIMIT 1", companyID).Scan(
			&company.Name, &logoURL, &compDesc)
		if err == nil {
			if logoURL.Valid {
				company.Logo = logoURL.String
			}
			if compDesc.Valid {
				company.Description = compDesc.String
			}
		} else {
			log.Printf("ℹ️  [Database Notice]: companies query failed: %v.", err)
		}
		
		// Load actual categories from `categorias` table
		rows, err := database.DB.Query("SELECT name FROM categorias WHERE company_id = ? AND status = 1", companyID)
		if err == nil {
			var dbCats []Category
			for rows.Next() {
				var catName string
				if err := rows.Scan(&catName); err == nil {
					dbCats = append(dbCats, Category{
						Name: catName,
						Slug: slugify(catName),
						Icon: getCategoryIcon(catName),
					})
				}
			}
			rows.Close()
			if len(dbCats) > 0 {
				categories = dbCats
			}
		}

		// Load actual products from `productos` table
		pRows, err := database.DB.Query("SELECT id, product_name, description, price, brand, inventory_status FROM productos WHERE company_id = ? AND status = 'ACTIVE'", companyID)
		if err == nil {
			var dbProds []Product
			for pRows.Next() {
				var prodID int64
				var pName string
				var pDesc sql.NullString
				var pPrice float64
				var pBrand sql.NullString
				var pInvStatus sql.NullString

				if err := pRows.Scan(&prodID, &pName, &pDesc, &pPrice, &pBrand, &pInvStatus); err == nil {
					var brandStr = "Generico"
					if pBrand.Valid {
						brandStr = pBrand.String
					}

					var descStr = ""
					if pDesc.Valid {
						descStr = pDesc.String
					}

					var isAvailable = true
					if pInvStatus.Valid && strings.ToUpper(pInvStatus.String) != "IN_STOCK" {
						isAvailable = false
					}

					// Query media image URL
					var imgURL = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80"
					var mediaURL sql.NullString
					err := database.DB.QueryRow("SELECT m.url FROM product_images pi JOIN media m ON pi.media_id = m.id WHERE pi.product_id = ? LIMIT 1", prodID).Scan(&mediaURL)
					if err == nil && mediaURL.Valid {
						imgURL = mediaURL.String
					}

					dbProds = append(dbProds, Product{
						Name:        pName,
						Description: descStr,
						Price:       pPrice,
						Category:    "general",
						Brand:       brandStr,
						Image:       imgURL,
						Rating:      4.8,
						Available:   isAvailable,
					})
				}
			}
			pRows.Close()
			if len(dbProds) > 0 {
				products = dbProds
			}
		}
	}

	// Try resolving template index.html path
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
		return c.JSON(fiber.Map{
			"message":    "Storefront template HTML not found",
			"company":    company,
			"theme":      theme,
			"categories": categories,
			"products":   products,
		})
	}

	tmpl, err := template.ParseFiles(indexTemplatePath)
	if err != nil {
		return c.Status(500).SendString("Error parsing template: " + err.Error())
	}

	var buf bytes.Buffer
	err = tmpl.Execute(&buf, StorefrontData{
		Company:    company,
		Theme:      theme,
		Categories: categories,
		Products:   products,
	})
	if err != nil {
		return c.Status(500).SendString("Error rendering storefront template: " + err.Error())
	}

	c.Set("Content-Type", "text/html")
	return c.Send(buf.Bytes())
}

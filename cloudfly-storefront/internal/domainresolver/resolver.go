package domainresolver

import (
	"database/sql"
	"log"
	"strings"
	"time"

	"cloudfly-storefront/internal/database"
	"github.com/gofiber/fiber/v2"
)

// WebsiteResolver resuelve dinámicamente el Host del request contra las tablas
// company_domains, subscriptions y company_website, guardando el WebsiteContext en Locals.
func WebsiteResolver() fiber.Handler {
	return func(c *fiber.Ctx) error {
		host := c.Hostname()
		// Determinar si estamos en desarrollo local
		isLocal := host == "localhost" || host == "127.0.0.1" || strings.HasPrefix(host, "192.168.") || strings.HasPrefix(host, "10.")
		domainName := host
		if isLocal {
			domainName = "cloudflyshop.cloudfly.com.co" // Fallback local de pruebas
		}

		if database.DB == nil {
			// Si no hay BD, inyectar fallback básico
			c.Locals("website", &WebsiteContext{
				WebsiteID:   1,
				CompanyID:   1,
				ThemeID:     1,
				DomainName:  domainName,
				CompanyName: "CloudFly Demo (No DB)",
				Template:    "default",
			})
			return c.Next()
		}

		// 1. Buscar en la tabla company_domains
		var tenantID, companyID int64
		var estado string
		var fechaCaduca sql.NullTime

		err := database.DB.QueryRow(
			"SELECT tenant_id, company_id, estado, fecha_caduca FROM company_domains WHERE domain_name = ? LIMIT 1",
			domainName,
		).Scan(&tenantID, &companyID, &estado, &fechaCaduca)

		if err != nil {
			if err == sql.ErrNoRows {
				if isLocal {
					// En local inyectamos defaults si la BD está vacía o no tiene este dominio
					c.Locals("website", &WebsiteContext{
						WebsiteID:   1,
						CompanyID:   1,
						ThemeID:     1,
						DomainName:  domainName,
						CompanyName: "CloudFly Local (Fallback)",
						Template:    "default",
					})
					return c.Next()
				}
				// Redirigir al portal principal de CloudFly
				return c.Redirect("https://www.cloudfly.com.co", 302)
			}
			log.Printf("⚠️  [DomainResolver Error]: %v", err)
			return c.Status(500).SendString("Error interno al resolver el dominio.")
		}

		// Validar si el dominio está activo y vigente
		isActive := strings.ToLower(estado) == "activo"
		if fechaCaduca.Valid && fechaCaduca.Time.Before(time.Now()) {
			isActive = false
		}
		if !isActive {
			return c.Status(403).SendString("<h1>403 Acceso Denegado</h1><p>La suscripción de este comercio no se encuentra activa o ha caducado. Por favor contacte al administrador de CloudFly.</p>")
		}

		// 2. Verificar suscripción activa del tenant en la tabla subscriptions
		var subStatus string
		var subEndDate time.Time
		err = database.DB.QueryRow(
			"SELECT status, end_date FROM subscriptions WHERE customer_id = ? AND status = 'ACTIVE' AND end_date > ? LIMIT 1",
			tenantID, time.Now(),
		).Scan(&subStatus, &subEndDate)
		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(403).SendString("<h1>403 Acceso Denegado</h1><p>El comercio no tiene una suscripción de plan activa o vigente. Por favor contacte al administrador de CloudFly.</p>")
			}
			log.Printf("⚠️  [DomainResolver Subscription Error]: %v", err)
			return c.Status(500).SendString("Error interno al verificar la suscripción.")
		}

		// 3. Consultar datos en company_website para armar el WebsiteContext
		var websiteID, themeID int64
		var siteName, templateStr string
		err = database.DB.QueryRow(
			"SELECT id, theme, site_name, template FROM company_website WHERE company_id = ? LIMIT 1",
			companyID,
		).Scan(&websiteID, &themeID, &siteName, &templateStr)
		if err != nil {
			if err == sql.ErrNoRows {
				// Valores por defecto si la tienda no tiene registro en company_website
				websiteID = 1
				themeID = 1
				siteName = "Tienda CloudFly"
				templateStr = "default"
			} else {
				log.Printf("⚠️  [DomainResolver Website Error]: %v", err)
				return c.Status(500).SendString("Error interno al recuperar datos de la tienda.")
			}
		}

		// Inyectar el contexto del website
		ctxVal := &WebsiteContext{
			WebsiteID:   websiteID,
			CompanyID:   companyID,
			ThemeID:     themeID,
			DomainName:  domainName,
			CompanyName: siteName,
			Template:    templateStr,
		}
		c.Locals("website", ctxVal)
		return c.Next()
	}
}

package handlers

import (
	"database/sql"
	"log"
	"strconv"
	"strings"
	"time"

	"cloudfly-storefront/internal/database"
	"github.com/gofiber/fiber/v2"
)

// resolveTenant resolves tenant/company IDs from the request hostname.
// Returns (tenantID, companyID, company, theme, categories, products, ok).
// If ok=false the caller should redirect or 403.
func resolveTenant(c *fiber.Ctx) (int64, int64, Company, Theme, []Category, []Product, bool) {
	host := c.Hostname()
	isLocal := host == "localhost" || host == "127.0.0.1" ||
		strings.HasPrefix(host, "192.168.") || strings.HasPrefix(host, "10.")
	domainName := host
	if isLocal {
		domainName = "cloudflyshop.cloudfly.com.co"
	}

	var tenantID, companyID int64
	var estado string
	var fechaCaduca sql.NullTime
	resolved := false

	if database.DB != nil {
		err := database.DB.QueryRow(
			"SELECT tenant_id, company_id, estado, fecha_caduca FROM company_domains WHERE domain_name = ? LIMIT 1",
			domainName,
		).Scan(&tenantID, &companyID, &estado, &fechaCaduca)
		if err == nil {
			resolved = true
		}
	}

	if !resolved && !isLocal {
		_ = c.Redirect("https://www.cloudfly.com.co", 302)
		return 0, 0, Company{}, Theme{}, nil, nil, false
	}

	if resolved {
		isActive := strings.ToLower(estado) == "activo"
		if fechaCaduca.Valid && fechaCaduca.Time.Before(time.Now()) {
			isActive = false
		}
		if !isActive {
			_ = c.Status(403).SendString("<h1>403</h1><p>Suscripción inactiva.</p>")
			return 0, 0, Company{}, Theme{}, nil, nil, false
		}
		if database.DB != nil {
			var subStatus string
			var subEnd time.Time
			err := database.DB.QueryRow(
				"SELECT status, end_date FROM subscriptions WHERE customer_id = ? AND status = 'ACTIVE' AND end_date > ? LIMIT 1",
				tenantID, time.Now(),
			).Scan(&subStatus, &subEnd)
			if err != nil {
				_ = c.Status(403).SendString("<h1>403</h1><p>Sin suscripción activa.</p>")
				return 0, 0, Company{}, Theme{}, nil, nil, false
			}
		}
	}

	company := Company{ID: companyID}
	theme := Theme{PrimaryColor: "#6366f1", SecondaryColor: "#10b981"}
	var categories []Category
	var products []Product

	if database.DB != nil {
		var logoURL, compDesc, compPhone, compEmail, compAddress sql.NullString
		err := database.DB.QueryRow(
			"SELECT name, logo_url, company_description, phone, email, address FROM companies WHERE id = ? LIMIT 1",
			companyID,
		).Scan(&company.Name, &logoURL, &compDesc, &compPhone, &compEmail, &compAddress)
		if err == nil {
			if logoURL.Valid {
				company.Logo = normalizeImageURL(logoURL.String)
			}
			if compDesc.Valid {
				company.Description = stripMarkdown(compDesc.String)
			}
			if compPhone.Valid {
				company.Phone = compPhone.String
			}
			if compEmail.Valid {
				company.Email = compEmail.String
			}
			if compAddress.Valid {
				company.Address = compAddress.String
			}
		}

		rows, err := database.DB.Query(
			"SELECT name FROM categorias WHERE company_id = ? AND status = 1", companyID,
		)
		if err == nil {
			for rows.Next() {
				var catName string
				if err := rows.Scan(&catName); err == nil {
					categories = append(categories, Category{
						Name: catName,
						Slug: slugify(catName),
						Icon: getCategoryIcon(catName),
					})
				}
			}
			rows.Close()
		}

		pRows, err := database.DB.Query(
			"SELECT id, product_name, description, price, brand, sku, inventory_status FROM productos WHERE company_id = ? AND status IN ('ACTIVE','PUBLISHED')",
			companyID,
		)
		if err == nil {
			for pRows.Next() {
				var prodID int64
				var pName string
				var pDesc, pBrand, pSku, pInvStatus sql.NullString
				var pPrice float64
				if err := pRows.Scan(&prodID, &pName, &pDesc, &pPrice, &pBrand, &pSku, &pInvStatus); err != nil {
					continue
				}
				brandStr := "Generico"
				if pBrand.Valid {
					brandStr = pBrand.String
				}
				descStr := ""
				if pDesc.Valid {
					descStr = pDesc.String
				}
				skuStr := ""
				if pSku.Valid {
					skuStr = pSku.String
				}
				isAvailable := true
				if pInvStatus.Valid && pInvStatus.String != "" && strings.ToUpper(pInvStatus.String) != "IN_STOCK" {
					isAvailable = false
				}
				catName := "general"
				var cName sql.NullString
				if err := database.DB.QueryRow(
					"SELECT c.name FROM product_categories pc JOIN categorias c ON pc.category_id = c.id WHERE pc.product_id = ? LIMIT 1",
					prodID,
				).Scan(&cName); err == nil && cName.Valid {
					catName = cName.String
				}
				imgURL := ""
				var mediaURL sql.NullString
				if err := database.DB.QueryRow(
					"SELECT m.url FROM product_images pi JOIN media m ON pi.media_id = m.id WHERE pi.product_id = ? LIMIT 1",
					prodID,
				).Scan(&mediaURL); err == nil && mediaURL.Valid {
					imgURL = normalizeImageURL(mediaURL.String)
				}
				products = append(products, Product{
					ID:           prodID,
					Name:         pName,
					Slug:         slugify(pName),
					Description:  descStr,
					Price:        pPrice,
					Category:     catName,
					CategorySlug: slugify(catName),
					Brand:        brandStr,
					SKU:          skuStr,
					Image:        imgURL,
					Rating:       4.8,
					Available:    isAvailable,
				})
			}
			pRows.Close()
		}
	}

	log.Printf("ℹ️  [StorePage] host=%s tenantID=%d companyID=%d cats=%d prods=%d",
		domainName, tenantID, companyID, len(categories), len(products))

	return tenantID, companyID, company, theme, categories, products, true
}

// CategoryPage handles GET /:categorySlug
// URL: /chatbots
func CategoryPage(c *fiber.Ctx) error {
	catSlug := c.Params("categorySlug")
	tenantID, companyID, company, theme, categories, products, ok := resolveTenant(c)
	if !ok {
		return nil
	}

	// Filter products by category slug
	var filtered []Product
	for _, p := range products {
		if p.CategorySlug == catSlug {
			filtered = append(filtered, p)
		}
	}

	// Cache key per category
	cacheKey := ""
	if database.RedisClient != nil {
		cacheKey = "storefront:html:" + strconv.FormatInt(tenantID, 10) + ":" +
			strconv.FormatInt(companyID, 10) + ":cat:" + catSlug
		if html, err := database.RedisClient.Get(database.Ctx, cacheKey).Result(); err == nil && html != "" {
			c.Set("Content-Type", "text/html")
			c.Set("X-Cache", "HIT")
			return c.SendString(html)
		}
	}

	html, err := renderStorefront(StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		Products:    filtered,
		CurrentPath: "/" + catSlug,
		ActiveCat:   catSlug,
	})
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}
	if cacheKey != "" && database.RedisClient != nil {
		_ = database.RedisClient.Set(database.Ctx, cacheKey, html, 10*time.Minute).Err()
	}
	c.Set("Content-Type", "text/html")
	c.Set("X-Cache", "MISS")
	return c.SendString(html)
}

// ProductPage handles GET /:categorySlug/:productSlug
// URL: /chatbots/mi-producto-chatbot
func ProductPage(c *fiber.Ctx) error {
	catSlug := c.Params("categorySlug")
	prodSlug := c.Params("productSlug")

	_, _, company, theme, categories, products, ok := resolveTenant(c)
	if !ok {
		return nil
	}

	// Find the product
	var activeProduct *Product
	for i, p := range products {
		if p.CategorySlug == catSlug && p.Slug == prodSlug {
			activeProduct = &products[i]
			break
		}
	}
	if activeProduct == nil {
		for i, p := range products {
			if p.Slug == prodSlug {
				activeProduct = &products[i]
				break
			}
		}
	}

	html, err := renderStorefront(StorefrontData{
		Company:       company,
		Theme:         theme,
		Categories:    categories,
		Products:      products,
		CurrentPath:   "/" + catSlug + "/" + prodSlug,
		ActiveCat:     catSlug,
		ActiveProduct: activeProduct,
	})
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}
	c.Set("Content-Type", "text/html")
	return c.SendString(html)
}

// CatalogoPage handles GET /catalogo — full catalog (all products)
func CatalogoPage(c *fiber.Ctx) error {
	_, _, company, theme, categories, products, ok := resolveTenant(c)
	if !ok {
		return nil
	}
	html, err := renderStorefront(StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		Products:    products,
		CurrentPath: "/catalogo",
	})
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}
	c.Set("Content-Type", "text/html")
	return c.SendString(html)
}

// CarritoPage handles GET /carrito
func CarritoPage(c *fiber.Ctx) error {
	_, _, company, theme, categories, _, ok := resolveTenant(c)
	if !ok {
		return nil
	}
	html, err := renderStorefront(StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		CurrentPath: "/carrito",
	})
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}
	c.Set("Content-Type", "text/html")
	return c.SendString(html)
}

// NosotrosPage handles GET /nosotros
func NosotrosPage(c *fiber.Ctx) error {
	_, _, company, theme, categories, _, ok := resolveTenant(c)
	if !ok {
		return nil
	}
	html, err := renderStorefront(StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		CurrentPath: "/nosotros",
	})
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}
	c.Set("Content-Type", "text/html")
	return c.SendString(html)
}

// ContactoPage handles GET /contacto
func ContactoPage(c *fiber.Ctx) error {
	_, _, company, theme, categories, _, ok := resolveTenant(c)
	if !ok {
		return nil
	}
	html, err := renderStorefront(StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		CurrentPath: "/contacto",
	})
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}
	c.Set("Content-Type", "text/html")
	return c.SendString(html)
}

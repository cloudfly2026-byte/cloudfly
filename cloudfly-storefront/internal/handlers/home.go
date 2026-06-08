package handlers

import (
	"bytes"
	"database/sql"
	"fmt"
	"html/template"
	"log"
	"os"
	"path/filepath"
	"strconv"
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
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	Address     string `json:"address"`
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
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Category    string  `json:"category"`
	CategorySlug string `json:"category_slug"`
	Brand       string  `json:"brand"`
	SKU         string  `json:"sku"`
	Image       string  `json:"image"`
	Rating      float64 `json:"rating"`
	Available   bool    `json:"available"`
}

type Page struct {
	ID              int64     `json:"id"`
	CompanyID       int64     `json:"company_id"`
	Type            string    `json:"type"`
	Title           string    `json:"title"`
	Slug            string    `json:"slug"`
	Content         string    `json:"content"`
	Excerpt         string    `json:"excerpt"`
	FeaturedImage   string    `json:"featured_image"`
	Status          string    `json:"status"`
	MetaTitle       string    `json:"meta_title"`
	MetaDescription string    `json:"meta_description"`
	AuthorID        int64     `json:"author_id"`
	IaUpdate        bool      `json:"ia_update"`
	PublishedAt     time.Time `json:"published_at"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type StorefrontData struct {
	Company       Company
	Theme         Theme
	Categories    []Category
	Products      []Product
	Pages         []Page
	CurrentPath   string    // e.g. "/" "/chatbots" "/chatbots/producto-name"
	ActiveCat     string    // active category slug
	ActiveProduct *Product  // set when viewing a single product
	ActivePage    *Page     // set when viewing a single page or post
}

// stripMarkdown removes common markdown syntax for plain-text rendering
func stripMarkdown(s string) string {
	// Remove headings (## Title -> Title)
	var lines []string
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimLeft(line, "# ")
		// Remove list markers
		if strings.HasPrefix(line, "* ") {
			line = line[2:]
		}
		if strings.HasPrefix(line, "- ") {
			line = line[2:]
		}
		// Remove inline links [text](url) -> text
		for strings.Contains(line, "](") {
			start := strings.Index(line, "[")
			end := strings.Index(line, "]")
			if start >= 0 && end > start {
				paren := strings.Index(line[end:], ")")
				if paren >= 0 {
					line = line[:start] + line[start+1:end] + line[end+1+paren+1:]
					continue
				}
			}
			break
		}
		line = strings.TrimSpace(line)
		if line != "" {
			lines = append(lines, line)
		}
	}
	// Return first 3 sentences/lines as short description
	if len(lines) > 3 {
		lines = lines[:3]
	}
	return strings.Join(lines, " ")
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

// normalizeImageURL ensures the image URL is absolute.
// If the URL is empty or whitespace-only, it returns "" so the JS placeholder kicks in.
// URLs starting with / are kept as-is (relative) so the browser resolves them against
// the current domain (e.g. cloudflyshop.cloudfly.com.co/media/...).
func normalizeImageURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	// Already absolute (http:// or https://)
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw
	}
	// Relative path — keep as-is so browser resolves against current domain
	// The storefront serves /media/** from the shared /uploads volume
	if !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}
	return raw
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

	log.Printf("ℹ️  [Domain Resolved]: host=%s resolved=%v tenantID=%d companyID=%d", domainName, resolved, tenantID, companyID)

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
		Name:        "",
		Logo:        "",
		Description: "",
		Phone:       "",
		Email:       "",
		Address:     "",
	}
	theme := Theme{
		PrimaryColor:   "#6366f1",
		SecondaryColor: "#10b981",
	}
	var categories []Category
	var products []Product

	// 2. Fetch Company metadata from companies table if available
	if resolved && database.DB != nil {
		var logoURL sql.NullString
		var compDesc sql.NullString
		var compPhone sql.NullString
		var compEmail sql.NullString
		var compAddress sql.NullString
		err := database.DB.QueryRow("SELECT name, logo_url, company_description, phone, email, address FROM companies WHERE id = ? LIMIT 1", companyID).Scan(
			&company.Name, &logoURL, &compDesc, &compPhone, &compEmail, &compAddress)
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
		pRows, err := database.DB.Query("SELECT id, product_name, description, price, brand, sku, inventory_status FROM productos WHERE company_id = ? AND status IN ('ACTIVE', 'PUBLISHED')", companyID)
		if err == nil {
			var dbProds []Product
			for pRows.Next() {
				var prodID int64
				var pName string
				var pDesc sql.NullString
				var pPrice float64
				var pBrand sql.NullString
				var pSku sql.NullString
				var pInvStatus sql.NullString

				if err := pRows.Scan(&prodID, &pName, &pDesc, &pPrice, &pBrand, &pSku, &pInvStatus); err == nil {
					var brandStr = "Generico"
					if pBrand.Valid {
						brandStr = pBrand.String
					}

					var descStr = ""
					if pDesc.Valid {
						descStr = pDesc.String
					}

					var skuStr = ""
					if pSku.Valid {
						skuStr = pSku.String
					}

					var isAvailable = true
					if pInvStatus.Valid && pInvStatus.String != "" && strings.ToUpper(pInvStatus.String) != "IN_STOCK" {
						isAvailable = false
					}

					// Query actual category name from database
					var catName = "general"
					var cName sql.NullString
					err := database.DB.QueryRow("SELECT c.name FROM product_categories pc JOIN categorias c ON pc.category_id = c.id WHERE pc.product_id = ? LIMIT 1", prodID).Scan(&cName)
					if err == nil && cName.Valid {
						catName = cName.String
					}

					// Query media image URL — normalize to absolute URL so the browser
					// can load it regardless of which domain the storefront is served from.
					// An empty string signals the JS template to show the placeholder image.
					var imgURL = ""
					var mediaURL sql.NullString
					err = database.DB.QueryRow("SELECT m.url FROM product_images pi JOIN media m ON pi.media_id = m.id WHERE pi.product_id = ? LIMIT 1", prodID).Scan(&mediaURL)
					if err == nil && mediaURL.Valid {
						imgURL = normalizeImageURL(mediaURL.String)
					}

					dbProds = append(dbProds, Product{
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
			}
			pRows.Close()
			if len(dbProds) > 0 {
				products = dbProds
			}
		}
	}

	// 3. Redis Caching: Index by Tenant and Company ID
	var cacheKey string
	if resolved && database.RedisClient != nil {
		cacheKey = "storefront:html:" + strconv.FormatInt(tenantID, 10) + ":" + strconv.FormatInt(companyID, 10) + ":home"
		cachedHTML, err := database.RedisClient.Get(database.Ctx, cacheKey).Result()
		if err == nil && cachedHTML != "" {
			c.Set("Content-Type", "text/html")
			c.Set("X-Cache", "HIT")
			return c.SendString(cachedHTML)
		}
	}

	renderedHTML, err := renderStorefront(StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		Products:    products,
		CurrentPath: "/",
	})
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}

	if cacheKey != "" && database.RedisClient != nil {
		_ = database.RedisClient.Set(database.Ctx, cacheKey, renderedHTML, 10*time.Minute).Err()
	}
	c.Set("Content-Type", "text/html")
	c.Set("X-Cache", "MISS")
	return c.SendString(renderedHTML)
}

// renderStorefront parses and executes the index.html template with the given data.
func renderStorefront(data StorefrontData) (string, error) {
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
		return "", fmt.Errorf("storefront template not found")
	}
	tmpl, err := template.ParseFiles(indexTemplatePath)
	if err != nil {
		return "", fmt.Errorf("error parsing template: %w", err)
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("error rendering template: %w", err)
	}
	return buf.String(), nil
}

package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"cloudfly-storefront/internal/database"
	"cloudfly-storefront/internal/domainresolver"
	"cloudfly-storefront/internal/layout"
	"cloudfly-storefront/internal/render"
	"cloudfly-storefront/internal/theme"

	"github.com/gofiber/fiber/v2"
)

// Global services instantiated at startup
var (
	ThemeService  *theme.Service
	LayoutService *layout.Service
	Renderer      *render.Renderer
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
	Theme         *theme.Theme
	Categories    []Category
	Products      []Product
	Pages         []Page
	CurrentPath   string    // e.g. "/" "/chatbots" "/chatbots/producto-name"
	ActiveCat     string    // active category slug
	ActiveProduct *Product  // set when viewing a single product
	ActivePage    *Page     // set when viewing a single page or post
	Blocks        []layout.Block
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
	// 1. Obtener WebsiteContext inyectado por el middleware WebsiteResolver
	websiteVal := c.Locals("website")
	if websiteVal == nil {
		return c.Status(500).SendString("Website context not resolved")
	}
	website := websiteVal.(*domainresolver.WebsiteContext)

	companyID := website.CompanyID

	// 2. Obtener Tema y Layout usando los servicios multi-tenant
	themeData, err := ThemeService.GetTheme(website.ThemeID)
	if err != nil {
		log.Printf("⚠️  [Home Handler Theme Warning]: %v", err)
	}

	layoutData, err := LayoutService.GetLayout(companyID, "home")
	if err != nil {
		log.Printf("⚠️  [Home Handler Layout Warning]: %v", err)
	}

	// 3. Caching Redis usando claves únicas por tenant/company
	var cacheKey string
	if database.RedisClient != nil {
		cacheKey = "storefront:html:" + strconv.FormatInt(companyID, 10) + ":home"
		cachedHTML, err := database.RedisClient.Get(database.Ctx, cacheKey).Result()
		if err == nil && cachedHTML != "" {
			c.Set("Content-Type", "text/html")
			c.Set("X-Cache", "HIT")
			return c.SendString(cachedHTML)
		}
	}

	// Estructurar el ViewModel base
	company := Company{
		ID: companyID,
		Name: website.CompanyName,
	}
	var categories []Category
	var products []Product

	if database.DB != nil {
		// Cargar metadatos detallados de la compañía
		var logoURL, compDesc, compPhone, compEmail, compAddress sql.NullString
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
		}

		// Cargar categorías
		rows, err := database.DB.Query("SELECT name, COALESCE(slug,'') FROM categorias WHERE company_id = ? AND status = 1", companyID)
		if err == nil {
			for rows.Next() {
				var catName, catSlugDB string
				if err := rows.Scan(&catName, &catSlugDB); err == nil {
					if catSlugDB == "" {
						catSlugDB = slugify(catName)
					}
					categories = append(categories, Category{
						Name: catName,
						Slug: catSlugDB,
						Icon: getCategoryIcon(catName),
					})
				}
			}
			rows.Close()
		}

		// Cargar productos
		pRows, err := database.DB.Query("SELECT id, product_name, COALESCE(slug,''), description, price, brand, sku, inventory_status FROM productos WHERE company_id = ? AND status IN ('ACTIVE', 'PUBLISHED')", companyID)
		if err == nil {
			for pRows.Next() {
				var prodID int64
				var pName, pSlugDB string
				var pDesc, pBrand, pSku, pInvStatus sql.NullString
				var pPrice float64

				if err := pRows.Scan(&prodID, &pName, &pSlugDB, &pDesc, &pPrice, &pBrand, &pSku, &pInvStatus); err == nil {
					if pSlugDB == "" {
						pSlugDB = slugify(pName)
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

					var catName = "general"
					var catSlugForProd = "general"
					var cName, cSlug sql.NullString
					err := database.DB.QueryRow("SELECT c.name, COALESCE(c.slug,'') FROM product_categories pc JOIN categorias c ON pc.category_id = c.id WHERE pc.product_id = ? LIMIT 1", prodID).Scan(&cName, &cSlug)
					if err == nil && cName.Valid {
						catName = cName.String
						if cSlug.Valid && cSlug.String != "" {
							catSlugForProd = cSlug.String
						} else {
							catSlugForProd = slugify(catName)
						}
					}

					var imgURL = ""
					var mediaURL sql.NullString
					err = database.DB.QueryRow("SELECT m.url FROM product_images pi JOIN media m ON pi.media_id = m.id WHERE pi.product_id = ? LIMIT 1", prodID).Scan(&mediaURL)
					if err == nil && mediaURL.Valid {
						imgURL = normalizeImageURL(mediaURL.String)
					}

					products = append(products, Product{
						ID:           prodID,
						Name:         pName,
						Slug:         pSlugDB,
						Description:  descStr,
						Price:        pPrice,
						Category:     catName,
						CategorySlug: catSlugForProd,
						Brand:        brandStr,
						SKU:          skuStr,
						Image:        imgURL,
						Rating:       4.8,
						Available:    isAvailable,
					})
				}
			}
			pRows.Close()
		}
	}

	// 4. Renderizar usando Render Engine (Fase 4/5)
	viewData := StorefrontData{
		Company:     company,
		Theme:       themeData,
		Categories:  categories,
		Products:    products,
		CurrentPath: "/",
		Blocks:      layoutData.Blocks,
	}

	renderedHTML, err := Renderer.RenderToString("home", viewData)
	if err != nil {
		return c.Status(500).SendString(fmt.Sprintf("Error de renderizado: %v", err))
	}

	if cacheKey != "" && database.RedisClient != nil {
		_ = database.RedisClient.Set(database.Ctx, cacheKey, renderedHTML, 10*time.Minute).Err()
	}

	c.Set("Content-Type", "text/html")
	c.Set("X-Cache", "MISS")
	return c.SendString(renderedHTML)
}


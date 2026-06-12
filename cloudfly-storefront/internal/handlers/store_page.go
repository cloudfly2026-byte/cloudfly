package handlers

import (
	"database/sql"
	"log"
	"strconv"
	"strings"
	"time"

	"cloudfly-storefront/internal/database"
	"cloudfly-storefront/internal/domainresolver"
	"cloudfly-storefront/internal/theme"
	"github.com/gofiber/fiber/v2"
)

// resolveTenant resolves tenant/company IDs from the request hostname.
// Returns (tenantID, companyID, company, theme, categories, products, pages, ok).
// If ok=false the caller should redirect or 403.
func resolveTenant(c *fiber.Ctx) (int64, int64, Company, *theme.Theme, []Category, []Product, []Page, bool) {
	websiteVal := c.Locals("website")
	if websiteVal == nil {
		_ = c.Status(500).SendString("<h1>500 Error</h1><p>Website context not resolved</p>")
		return 0, 0, Company{}, nil, nil, nil, nil, false
	}
	website := websiteVal.(*domainresolver.WebsiteContext)
	companyID := website.CompanyID

	themeData, err := ThemeService.GetTheme(website.ThemeID)
	if err != nil {
		log.Printf("⚠️  [StorePage Theme Warning]: %v", err)
	}

	company := Company{ID: companyID, Name: website.CompanyName}
	var categories []Category
	var products []Product
	var pages []Page

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
			"SELECT name, COALESCE(slug,'') FROM categorias WHERE company_id = ? AND status = 1", companyID,
		)
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

		pRows, err := database.DB.Query(
			"SELECT id, product_name, COALESCE(slug,''), description, price, brand, sku, inventory_status FROM productos WHERE company_id = ? AND status IN ('ACTIVE','PUBLISHED')",
			companyID,
		)
		if err == nil {
			for pRows.Next() {
				var prodID int64
				var pName, pSlugDB string
				var pDesc, pBrand, pSku, pInvStatus sql.NullString
				var pPrice float64
				if err := pRows.Scan(&prodID, &pName, &pSlugDB, &pDesc, &pPrice, &pBrand, &pSku, &pInvStatus); err != nil {
					continue
				}
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
				catName := "general"
				catSlug := "general"
				var cName, cSlug sql.NullString
				if err := database.DB.QueryRow(
					"SELECT c.name, COALESCE(c.slug,'') FROM product_categories pc JOIN categorias c ON pc.category_id = c.id WHERE pc.product_id = ? LIMIT 1",
					prodID,
				).Scan(&cName, &cSlug); err == nil && cName.Valid {
					catName = cName.String
					if cSlug.Valid && cSlug.String != "" {
						catSlug = cSlug.String
					} else {
						catSlug = slugify(catName)
					}
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
					Slug:         pSlugDB,
					Description:  descStr,
					Price:        pPrice,
					Category:     catName,
					CategorySlug: catSlug,
					Brand:        brandStr,
					SKU:          skuStr,
					Image:        imgURL,
					Rating:       4.8,
					Available:    isAvailable,
				})
			}
			pRows.Close()
		}

		// Load published pages and posts
		pageRows, err := database.DB.Query(
			"SELECT id, type, title, slug, content, excerpt, featured_image, status, meta_title, meta_description, author_id, ia_update, published_at, created_at, updated_at FROM pages WHERE company_id = ? AND status = 'published' ORDER BY created_at DESC",
			companyID,
		)
		if err == nil {
			for pageRows.Next() {
				var page Page
				var publishedAt sql.NullTime
				if err := pageRows.Scan(
					&page.ID, &page.Type, &page.Title, &page.Slug,
					&page.Content, &page.Excerpt, &page.FeaturedImage,
					&page.Status, &page.MetaTitle, &page.MetaDescription,
					&page.AuthorID, &page.IaUpdate, &publishedAt, &page.CreatedAt, &page.UpdatedAt,
				); err == nil {
					if publishedAt.Valid {
						page.PublishedAt = publishedAt.Time
					}
					page.CompanyID = companyID
					pages = append(pages, page)
				}
			}
			pageRows.Close()
		}
	}

	log.Printf("ℹ️  [StorePage] Resolved via Context companyID=%d cats=%d prods=%d pages=%d",
		companyID, len(categories), len(products), len(pages))

	return 1, companyID, company, themeData, categories, products, pages, true
}

// CategoryPage handles GET /:categorySlug
// URL: /chatbots
func CategoryPage(c *fiber.Ctx) error {
	catSlug := c.Params("categorySlug")
	_, companyID, company, theme, categories, products, pages, ok := resolveTenant(c)
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
		cacheKey = "storefront:html:" + strconv.FormatInt(companyID, 10) + ":cat:" + catSlug
		if html, err := database.RedisClient.Get(database.Ctx, cacheKey).Result(); err == nil && html != "" {
			c.Set("Content-Type", "text/html")
			c.Set("X-Cache", "HIT")
			return c.SendString(html)
		}
	}

	html, err := Renderer.RenderToString("category", StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		Products:    filtered,
		Pages:       pages,
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

	_, _, company, theme, categories, products, pages, ok := resolveTenant(c)
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

	html, err := Renderer.RenderToString("product", StorefrontData{
		Company:       company,
		Theme:         theme,
		Categories:    categories,
		Products:      products,
		Pages:         pages,
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
	_, _, company, theme, categories, products, pages, ok := resolveTenant(c)
	if !ok {
		return nil
	}
	html, err := Renderer.RenderToString("home", StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		Products:    products,
		Pages:       pages,
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
	_, _, company, theme, categories, _, pages, ok := resolveTenant(c)
	if !ok {
		return nil
	}
	html, err := Renderer.RenderToString("home", StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		Pages:       pages,
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
	_, _, company, theme, categories, _, pages, ok := resolveTenant(c)
	if !ok {
		return nil
	}
	html, err := Renderer.RenderToString("home", StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		Pages:       pages,
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
	_, _, company, theme, categories, _, pages, ok := resolveTenant(c)
	if !ok {
		return nil
	}
	html, err := Renderer.RenderToString("home", StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		Pages:       pages,
		CurrentPath: "/contacto",
	})
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}
	c.Set("Content-Type", "text/html")
	return c.SendString(html)
}

// BlogPage handles GET /blog — list all blog posts
func BlogPage(c *fiber.Ctx) error {
	_, _, company, theme, categories, _, pages, ok := resolveTenant(c)
	if !ok {
		return nil
	}

	// Filter only posts
	var posts []Page
	for _, p := range pages {
		if p.Type == "post" {
			posts = append(posts, p)
		}
	}

	html, err := Renderer.RenderToString("home", StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		Pages:       posts,
		CurrentPath: "/blog",
	})
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}
	c.Set("Content-Type", "text/html")
	return c.SendString(html)
}

// PageBySlug handles GET /p/:slug — dynamic page/post by slug
// This allows rendering any page or post created in the CMS
func PageBySlug(c *fiber.Ctx) error {
	slug := c.Params("slug")
	_, _, company, theme, categories, _, pages, ok := resolveTenant(c)
	if !ok {
		return nil
	}

	// Find the page by slug
	var activePage *Page
	for i, p := range pages {
		if p.Slug == slug {
			activePage = &pages[i]
			break
		}
	}

	if activePage == nil {
		return c.Status(404).SendString("<h1>404</h1><p>Página no encontrada.</p>")
	}

	html, err := Renderer.RenderToString("home", StorefrontData{
		Company:     company,
		Theme:       theme,
		Categories:  categories,
		Pages:       pages,
		CurrentPath: "/p/" + slug,
		ActivePage:  activePage,
	})
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}
	c.Set("Content-Type", "text/html")
	return c.SendString(html)
}

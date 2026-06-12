package render

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"path/filepath"

	"cloudfly-storefront/internal/layout"
	"github.com/gofiber/fiber/v2"
)

type Renderer struct {
	templatesDir string
	tmpl         *template.Template
}

func NewRenderer(dir string) (*Renderer, error) {
	r := &Renderer{templatesDir: dir}
	err := r.Load()
	return r, err
}

func (r *Renderer) Load() error {
	// Buscar archivos de layout y bloques
	layoutFiles, err := filepath.Glob(filepath.Join(r.templatesDir, "layouts", "*.html"))
	if err != nil {
		return err
	}

	blockFiles, err := filepath.Glob(filepath.Join(r.templatesDir, "blocks", "*.html"))
	if err != nil {
		return err
	}

	allFiles := append(layoutFiles, blockFiles...)
	if len(allFiles) == 0 {
		return fmt.Errorf("no templates found in %s", r.templatesDir)
	}

	tmpl := template.New("storefront").Funcs(template.FuncMap{
		"themeConfigVal": func(themeVal *theme.Theme, key string, fallback string) string {
			if themeVal == nil || themeVal.Config == nil {
				return fallback
			}
			if val, ok := themeVal.Config[key]; ok {
				if strVal, ok := val.(string); ok && strVal != "" {
					return strVal
				}
			}
			return fallback
		},
		"isLightColor": func(hexStr string) bool {
			hexStr = strings.TrimPrefix(hexStr, "#")
			if len(hexStr) != 6 {
				return false
			}
			rVal, _ := strconv.ParseInt(hexStr[0:2], 16, 64)
			gVal, _ := strconv.ParseInt(hexStr[2:4], 16, 64)
			bVal, _ := strconv.ParseInt(hexStr[4:6], 16, 64)
			y := 0.299*float64(rVal) + 0.587*float64(gVal) + 0.114*float64(bVal)
			return y > 150
		},
		"renderBlock": func(b layout.Block, pageData any) template.HTML {
			var buf bytes.Buffer
			tmplName := b.Type + ".html"
			err := r.tmpl.ExecuteTemplate(&buf, tmplName, pageData)
			if err != nil {
				return template.HTML(fmt.Sprintf("<!-- Error rendering block %s: %v -->", b.Type, err))
			}
			return template.HTML(buf.String())
		},
	})

	tmpl, err = tmpl.ParseFiles(allFiles...)
	if err != nil {
		return err
	}
	r.tmpl = tmpl
	return nil
}

func (r *Renderer) Render(c *fiber.Ctx, pageName string, data any) error {
	c.Set("Content-Type", "text/html")
	var buf bytes.Buffer
	layoutTmpl := pageName + ".html"
	err := r.tmpl.ExecuteTemplate(&buf, layoutTmpl, data)
	if err != nil {
		return c.Status(500).SendString(fmt.Sprintf("Render error: %v", err))
	}
	return c.Send(buf.Bytes())
}

func (r *Renderer) RenderToString(pageName string, data any) (string, error) {
	var buf bytes.Buffer
	layoutTmpl := pageName + ".html"
	err := r.tmpl.ExecuteTemplate(&buf, layoutTmpl, data)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}


// FindTemplatesDir busca el directorio templates relativo al directorio actual de ejecución.
func FindTemplatesDir() string {
	dirs := []string{
		"templates",
		"../templates",
		"../../templates",
		filepath.Join("cloudfly-storefront", "templates"),
	}
	for _, dir := range dirs {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			return dir
		}
	}
	return "templates" // Default fallback
}

package theme

// Theme representa el diseño y estilos aplicados a una tienda.
type Theme struct {
	ID             int64          `json:"id"`
	CompanyID      int64          `json:"company_id"`
	TemplateName   string         `json:"template_name"`
	PrimaryColor   string         `json:"primary_color"`
	SecondaryColor string         `json:"secondary_color"`
	AccentColor    string         `json:"accent_color"`
	HeadingFont    string         `json:"heading_font"`
	BodyFont       string         `json:"body_font"`
	LogoURL        string         `json:"logo_url"`
	Config         map[string]any `json:"config"`
}

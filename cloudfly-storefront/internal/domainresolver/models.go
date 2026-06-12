package domainresolver

// WebsiteContext almacena la información del tenant/website resuelto a nivel de request.
type WebsiteContext struct {
	WebsiteID   int64  `json:"website_id"`
	CompanyID   int64  `json:"company_id"`
	ThemeID     int64  `json:"theme_id"`
	DomainName  string `json:"domain_name"`
	CompanyName string `json:"company_name"`
	Template    string `json:"template"`
	Description string `json:"description"`
	Keywords    string `json:"keywords"`
	FooterText  string `json:"footer_text"`
}

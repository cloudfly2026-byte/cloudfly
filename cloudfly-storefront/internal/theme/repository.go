package theme

import (
	"database/sql"
	"encoding/json"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) FindByID(themeID int64) (*Theme, error) {
	var t Theme
	var templateName, primaryColor, secondaryColor, accentColor, headingFont, bodyFont, logoURL sql.NullString
	var configJSON []byte

	query := `
		SELECT id, company_id, template_name, primary_color, secondary_color, accent_color, 
		       heading_font, body_font, logo_url, config_json 
		FROM company_themes 
		WHERE id = ? LIMIT 1
	`
	err := r.db.QueryRow(query, themeID).Scan(
		&t.ID, &t.CompanyID, &templateName, &primaryColor, &secondaryColor, &accentColor,
		&headingFont, &bodyFont, &logoURL, &configJSON,
	)
	if err != nil {
		return nil, err
	}

	if templateName.Valid {
		t.TemplateName = templateName.String
	}
	if primaryColor.Valid {
		t.PrimaryColor = primaryColor.String
	}
	if secondaryColor.Valid {
		t.SecondaryColor = secondaryColor.String
	}
	if accentColor.Valid {
		t.AccentColor = accentColor.String
	}
	if headingFont.Valid {
		t.HeadingFont = headingFont.String
	}
	if bodyFont.Valid {
		t.BodyFont = bodyFont.String
	}
	if logoURL.Valid {
		t.LogoURL = logoURL.String
	}

	if len(configJSON) > 0 {
		var configMap map[string]any
		if err := json.Unmarshal(configJSON, &configMap); err == nil {
			t.Config = configMap
		}
	}

	return &t, nil
}

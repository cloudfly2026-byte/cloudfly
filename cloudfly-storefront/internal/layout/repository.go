package layout

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

// FindByCompanyAndPage busca el layout de una página específica para una compañía.
func (r *Repository) FindByCompanyAndPage(companyID int64, pageName string) (*Layout, error) {
	var layoutJSON []byte
	query := "SELECT layout_json FROM company_layouts WHERE company_id = ? AND page_name = ? LIMIT 1"
	err := r.db.QueryRow(query, companyID, pageName).Scan(&layoutJSON)
	if err != nil {
		return nil, err
	}

	// Deserializar soportando múltiples formatos de JSON estructurado
	var wrapper struct {
		Blocks []any `json:"blocks"`
	}

	var blocks []Block
	if err := json.Unmarshal(layoutJSON, &wrapper); err == nil && len(wrapper.Blocks) > 0 {
		for _, b := range wrapper.Blocks {
			blocks = append(blocks, parseBlock(b))
		}
	} else {
		var list []any
		if err := json.Unmarshal(layoutJSON, &list); err == nil {
			for _, b := range list {
				blocks = append(blocks, parseBlock(b))
			}
		}
	}

	return &Layout{
		Page:   pageName,
		Blocks: blocks,
	}, nil
}

func parseBlock(val any) Block {
	switch v := val.(type) {
	case string:
		return Block{Type: v, Data: make(map[string]any)}
	case map[string]any:
		t, _ := v["type"].(string)
		var d map[string]any
		if rawData, ok := v["data"].(map[string]any); ok {
			d = rawData
		} else {
			d = make(map[string]any)
		}
		return Block{Type: t, Data: d}
	}
	return Block{}
}

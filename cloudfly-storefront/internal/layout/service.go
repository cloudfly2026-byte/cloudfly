package layout

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// GetLayout obtiene la configuración de bloques de la página, o un listado por defecto si no existe en BD.
func (s *Service) GetLayout(companyID int64, page string) (*Layout, error) {
	lay, err := s.repo.FindByCompanyAndPage(companyID, page)
	if err != nil || lay == nil || len(lay.Blocks) == 0 {
		// Retornar estructura por defecto (Fase 3/4 especificaciones)
		return &Layout{
			Page: page,
			Blocks: []Block{
				{Type: "hero", Data: make(map[string]any)},
				{Type: "categories", Data: make(map[string]any)},
				{Type: "featured_products", Data: make(map[string]any)},
				{Type: "benefits", Data: make(map[string]any)},
				{Type: "newsletter", Data: make(map[string]any)},
			},
		}, nil
	}
	return lay, nil
}

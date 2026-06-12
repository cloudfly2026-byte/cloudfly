package theme

import (
	"sync"
)

type Service struct {
	repo  *Repository
	cache sync.Map
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// GetTheme recupera un Theme por ID usando caché local en memoria sync.Map.
func (s *Service) GetTheme(themeID int64) (*Theme, error) {
	if val, ok := s.cache.Load(themeID); ok {
		return val.(*Theme), nil
	}

	t, err := s.repo.FindByID(themeID)
	if err != nil {
		// Retornamos un tema fallback para no romper la experiencia en caso de ausencia de registro
		return &Theme{
			ID:             themeID,
			TemplateName:   "default",
			PrimaryColor:   "#6366f1",
			SecondaryColor: "#10b981",
			AccentColor:    "#f59e0b",
			HeadingFont:    "Outfit",
			BodyFont:       "Inter",
		}, nil
	}

	s.cache.Store(themeID, t)
	return t, nil
}

func (s *Service) ClearCache() {
	s.cache = sync.Map{}
}

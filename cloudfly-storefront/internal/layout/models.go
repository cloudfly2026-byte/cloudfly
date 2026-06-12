package layout

type Block struct {
	Type string         `json:"type"`
	Data map[string]any `json:"data"`
}

type Layout struct {
	Page   string  `json:"page"`
	Blocks []Block `json:"blocks"`
}

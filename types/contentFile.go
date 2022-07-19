package types

import "html/template"

type ContentFile struct {
	Content     template.HTML
	Url         string
	Path        string
	FileName    string
	MetaData    map[string]string
	Collections map[string][]ContentFile
}

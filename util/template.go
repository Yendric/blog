package util

import (
	"html/template"
	"sort"
	"strings"
	"time"

	"github.com/Yendric/blog/types"
	"golang.org/x/net/html"
)

func Mkslice(a []types.ContentFile, start int, end int) []types.ContentFile {
	if end > len(a) {
		end = len(a)
	}
	return a[start:end]
}

func Truncate(s string) string {
	if len(s) > 150 {
		return s[:150] + "..."
	}
	return s[:150]
}

func StripTags(htmlText template.HTML) string {
	htmlin := strings.NewReader(string(htmlText))
	doc, err := html.Parse(htmlin)
	if err != nil {
		return ""
	}
	skip := map[string]bool{
		"script":   true,
		"style":    true,
		"textarea": true,
		"title":    true,
	}
	var sb strings.Builder
	var f func(*html.Node)
	f = func(n *html.Node) {
		if n.Type == html.TextNode {
			if n.Parent.Type == html.ElementNode && !skip[strings.ToLower(n.Parent.Data)] {
				sb.WriteString(n.Data)
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			f(c)
		}
	}
	f(doc)
	return sb.String()
}

func GetCurrentYear() int {
	return time.Now().Year()
}

func SortByDate(content []types.ContentFile) []types.ContentFile {
	sort.Slice(content, func(i, j int) bool {
		date1, err := time.Parse("2006-01-02", content[i].MetaData["date"])
		date2, err := time.Parse("2006-01-02", content[j].MetaData["date"])
		if err != nil {
			return false
		}
		return date1.After(date2)
	})

	return content
}

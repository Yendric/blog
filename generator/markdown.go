package generator

import (
	"html/template"
	"regexp"
	"strings"

	"github.com/gomarkdown/markdown"
)

func GetMetaData(mdfile []byte) map[string]string {
	metaData := map[string]string{}

	regex, _ := regexp.Compile(`(?s)^(?:\-\-\-)(.*?)(?:\-\-\-|\.\.\.)`)
	regexMatches := regex.FindStringSubmatch(string(mdfile))

	if len(regexMatches) > 0 {
		yamlBlock := regexMatches[1]
		yamlLines := strings.Split(yamlBlock, "\n")
		for _, line := range yamlLines {
			if strings.Contains(line, ":") {
				split := strings.Split(line, ":")
				metaData[split[0]] = strings.TrimSpace(split[1])
			}
		}
	}

	return metaData
}

func GetContent(mdfile []byte) template.HTML {
	regex, _ := regexp.Compile(`(?s)^(?:\-\-\-)(.*?)(?:\-\-\-|\.\.\.)`)

	content := strings.ReplaceAll(string(mdfile), regex.FindString(string(mdfile)), "")
	normalizedContent := markdown.NormalizeNewlines([]byte(content))

	return template.HTML(markdown.ToHTML(normalizedContent, nil, nil))
}

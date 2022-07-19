package generator

import (
	"io/fs"
	"io/ioutil"
	"log"
	"strings"

	"github.com/Yendric/blog/types"
	"github.com/Yendric/blog/util"
)

var Templates []fs.FileInfo
var TemplatesContent map[string][]types.ContentFile = map[string][]types.ContentFile{}

func GenerateTemplateData() {
	for _, template := range Templates {
		generateTemplateForDirectory("./content/" + template.Name())
	}
}

func generateTemplateForDirectory(directory string) {
	templateName := strings.Split(directory, "/")[2]

	content, err := ioutil.ReadDir(directory)
	if err != nil {
		log.Fatal(err)
	}

	contentFiles := []types.ContentFile{}

	for _, file := range content {
		if file.IsDir() {
			generateTemplateForDirectory(directory + "/" + file.Name())
			continue
		}

		fileContent, err := ioutil.ReadFile(directory + "/" + file.Name())
		if err != nil {
			log.Fatal(err)
		}

		data := types.ContentFile{}
		data.MetaData = GetMetaData(fileContent)
		data.Content = GetContent(fileContent)
		data.FileName = file.Name()
		data.Url = util.GenerateUrl(strings.Join(strings.Split(directory, "/")[3:], "/"), strings.ReplaceAll(file.Name(), ".md", ""))
		data.Path = data.Url[:len(data.Url)-1]
		contentFiles = append(contentFiles, data)
	}

	TemplatesContent[templateName] = append(TemplatesContent[templateName], contentFiles...)
}

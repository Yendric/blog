package generator

import (
	"html/template"
	"io/ioutil"
	"log"
	"os"
	"strings"

	"github.com/Yendric/blog/types"
	"github.com/Yendric/blog/util"
)

func GenerateFilesForDirectory(directory string) {
	paths, err := ioutil.ReadDir(directory)
	if err != nil {
		log.Fatal(err)
	}

	for _, path := range paths {
		if path.IsDir() {
			GenerateFilesForDirectory(directory + "/" + path.Name())
		} else {
			generateFile(path.Name(), strings.Split(directory, "/")[2])
		}
	}
}

func generateFile(mdFileName string, templateName string) {
	contentFiles := TemplatesContent[templateName]
	var contentFile types.ContentFile
	for _, file := range contentFiles {
		if file.FileName == mdFileName {
			contentFile = file
		}
	}
	contentFile.Collections = TemplatesContent

	funcMap := template.FuncMap{
		"mkslice":        util.Mkslice,
		"stripTags":      util.StripTags,
		"truncate":       util.Truncate,
		"getCurrentYear": util.GetCurrentYear,
	}

	template, err := template.New(templateName + ".html").Funcs(funcMap).ParseGlob("./templates/*.html")
	template, err = template.ParseGlob("./templates/**/*.html")
	if err != nil {
		log.Fatal(err)
	}

	var buildFile *os.File

	if mdFileName == "index.md" || mdFileName == "404.md" {

		buildFile, err = os.Create("./build" + contentFile.Url + ".html")
		if err != nil {
			log.Fatal(err)
		}
	} else {
		err = os.MkdirAll("./build"+contentFile.Url, os.ModePerm)
		if err != nil {
			log.Fatal(err)
		}
		buildFile, err = os.Create("./build" + contentFile.Url + "/index.html")
		if err != nil {
			log.Fatal(err)
		}
	}

	template.Execute(buildFile, contentFile)
	buildFile.Close()
}

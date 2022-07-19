package generator

import (
	"io/ioutil"
	"log"
)

func Generate() {
	paths, err := ioutil.ReadDir("./content")
	if err != nil {
		log.Fatal(err)
	}

	// Deze content directories komen overeen met de namen van de templates, die we opslaan in de templates slice.
	Templates = paths
	GenerateTemplateData()

	for _, path := range paths {
		if path.IsDir() {
			GenerateFilesForDirectory("./content/" + path.Name())
		}
	}
}

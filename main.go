package main

import (
	"flag"
	"log"
	"os"
	"os/exec"

	"github.com/Yendric/blog/generator"
	"github.com/fatih/color"
	"github.com/otiai10/copy"
)

func main() {
	withoutCss := flag.Bool("withoutCss", false, "Schakel CSS generatie uit.")
	flag.Parse()

	color.Yellow("Oude builds verwijderen...              [Bezig]")
	err := os.RemoveAll("./build")
	if err != nil {
		log.Fatal(err)
	}

	err = os.Mkdir("./build", os.ModePerm)
	if err != nil {
		log.Fatal(err)
	}
	color.Green("Oude builds verwijderen...              [OK]")

	color.Yellow("Assets kopiëren...                      [Bezig]")
	err = copy.Copy("./assets", "./build/assets")
	if err != nil {
		log.Fatal(err)
	}
	color.Green("Assets kopiëren...                      [OK]")

	if !*withoutCss {
		color.Yellow("CSS build...                            [Bezig]")
		err = exec.Command("yarn", "build").Run()
		if err != nil {
			log.Fatal(err)
		}
		color.Green("CSS build...                            [OK]")
	}

	color.Yellow("HTML genereren...                       [Bezig]")
	generator.Generate()
	color.Green("HTML genereren...                       [OK]")

	color.New(color.BgGreen).Print("Je website is gegenereerd!")
}

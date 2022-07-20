package main

import (
	"log"
	"os"
	"os/exec"

	"github.com/Yendric/blog/generator"
	"github.com/Yendric/blog/util"
	"github.com/fatih/color"
	"github.com/otiai10/copy"
)

func main() {
	color.Yellow("Oude builds verwijderen...              [Bezig]")
	err := os.RemoveAll("./build")
	if err != nil {
		log.Fatal(err)
	}
	color.Green("Oude builds verwijderen...              [OK]")

	color.Yellow("Assets kopiëren...                      [Bezig]")
	err = copy.Copy("./public", "./build")
	if err != nil {
		log.Fatal(err)
	}
	err = os.Remove("./build/assets/style.css")
	if err != nil {
		log.Fatal(err)
	}
	color.Green("Assets kopiëren...                      [OK]")

	color.Yellow("CSS build...                            [Bezig]")
	err = exec.Command("npx", "tailwindcss", "-i", "./public/assets/style.css", "-o", "./build"+util.GetCssLocation(), "--minify").Run()
	if err != nil {
		log.Fatal(err)
	}
	color.Green("CSS build...                            [OK]")

	color.Yellow("HTML genereren...                       [Bezig]")
	generator.Generate()
	color.Green("HTML genereren...                       [OK]")

	color.New(color.BgGreen).Print("Je website is gegenereerd!")
}

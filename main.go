package main

import (
	"embed"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	os.Setenv("GODEBUG", "asyncpreemptoff=1")
	err := wails.Run(&options.App{
		Title:     "Dino Desktop",
		Width:     1280,
		Height:    800,
		MinWidth:  600,
		MinHeight: 500,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 27, B: 29, A: 255},
		OnStartup:        NewApp().startup,
		Linux: &linux.Options{
			WebviewGpuPolicy: linux.WebviewGpuPolicyAlways,
		},
		Bind: []interface{}{
			NewApp(),
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

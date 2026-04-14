package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"

	// "syscall"
	"time"

	discordrpc "github.com/axrona/go-discordrpc/client"
	"github.com/darkhz/mpvipc"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx             context.Context
	cmd             *exec.Cmd
	sockPath        string
	conn            *mpvipc.Connection
	events          chan *mpvipc.Event
	stop            chan struct{}
	mu              sync.Mutex
	started         bool
	discord         *discordrpc.Client
	discordClientID string
	discordMu       sync.Mutex
}

func NewApp() *App {
	return &App{
		sockPath: filepath.Join(os.TempDir(), "dino-mpv.sock"),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// func (a *App) startMPV() error {
// 	a.mu.Lock()
// 	defer a.mu.Unlock()
// 	if a.started {
// 		return nil
// 	}

// 	os.Remove(a.sockPath)

// 	a.cmd = exec.Command("mpv",
// 		"--idle=yes",
// 		"--no-video",
// 		"--ao=pulse",
// 		"--gapless-audio=yes",
// 		"--audio-display=no",
// 		"--no-terminal",
// 		"--no-input-default-bindings",
// 		"--volume=100",
// 		fmt.Sprintf("--input-ipc-server=%s", a.sockPath),
// 	)
// 	a.cmd.Stdout = nil
// 	a.cmd.Stderr = nil
// 	a.cmd.SysProcAttr = &syscall.SysProcAttr{
// 		Setpgid: true,
// 	}

// 	if err := a.cmd.Start(); err != nil {
// 		return fmt.Errorf("mpv: start failed: %w", err)
// 	}

// 	a.conn = mpvipc.NewConnection(a.sockPath)

// 	var err error
// 	for i := 0; i < 100; i++ {
// 		err = a.conn.Open()
// 		if err == nil {
// 			break
// 		}
// 		select {
// 		case <-a.ctx.Done():
// 			return a.ctx.Err()
// 		default:
// 		}
// 	}

// 	if err != nil {
// 		return fmt.Errorf("mpv: socket connect failed: %w", err)
// 	}

// 	a.events, a.stop = a.conn.NewEventListener()
// 	a.started = true

// 	a.conn.Call("observe_property", 1, "time-pos")
// 	a.conn.Call("observe_property", 2, "duration")
// 	a.conn.Call("observe_property", 3, "pause")

// 	go a.readEvents()
// 	return nil
// }

func (a *App) readEvents() {
	for {
		select {
		case event, ok := <-a.events:
			if !ok {
				return
			}
			switch event.Name {
			case "end-file":
				switch event.Reason {
				case "eof":
					runtime.EventsEmit(a.ctx, "trackEnd")
				case "error":
					errMsg, _ := event.ExtraData["file-error"].(string)
					if errMsg == "" {
						errMsg = "playback error"
					}
					runtime.EventsEmit(a.ctx, "trackError", errMsg)
				}
			case "property-change":
				switch event.ID {
				case 1:
					if v, ok := event.Data.(float64); ok {
						runtime.EventsEmit(a.ctx, "position", v)
					}
				case 2:
					if v, ok := event.Data.(float64); ok {
						runtime.EventsEmit(a.ctx, "duration", v)
					}
				case 3:
					paused, _ := event.Data.(bool)
					runtime.EventsEmit(a.ctx, "playState", !paused)
				}
			}
		case <-a.stop:
			return
		}
	}
}

func (a *App) Play(url string, trackJson string) {
	// if err := a.startMPV(); err != nil {
	// 	fmt.Println("mpv play error:", err)
	// 	runtime.EventsEmit(a.ctx, "trackError", err.Error())
	// 	return
	// }
	_, err := a.conn.Call("loadfile", url, "replace")
	if err != nil {
		fmt.Println("mpv loadfile error:", err)
		runtime.EventsEmit(a.ctx, "trackError", err.Error())
	}
	_ = trackJson
}

func (a *App) Pause() {
	if a.started {
		a.conn.Set("pause", true)
	}
}

func (a *App) Resume() {
	if a.started {
		a.conn.Set("pause", false)
	}
}

func (a *App) Stop() {
	if a.started {
		a.conn.Call("stop")
	}
}

func (a *App) Seek(position int) {
	if a.started {
		a.conn.Set("time-pos", position)
	}
}

func (a *App) SetVolume(volume int) {
	if a.started {
		a.conn.Set("volume", volume)
	}
}

func (a *App) GetPosition() int {
	if !a.started {
		return 0
	}
	v, err := a.conn.Get("time-pos")
	if err != nil {
		return 0
	}
	f, ok := v.(float64)
	if !ok {
		return 0
	}
	return int(f)
}

func (a *App) GetDuration() int {
	if !a.started {
		return 0
	}
	v, err := a.conn.Get("duration")
	if err != nil {
		return 0
	}
	f, ok := v.(float64)
	if !ok {
		return 0
	}
	return int(f)
}

func (a *App) SetMediaMetadata(title string, artist string, album string, artworkUrl string) {
	if a.started && title != "" {
		a.conn.Set("title", title+" - "+artist)
	}
	_ = album
	_ = artworkUrl
}

func configDir() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.TempDir()
	}
	d := filepath.Join(dir, "dino-desktop")
	os.MkdirAll(d, 0755)
	return d
}

func (a *App) GetServers() string {
	data, err := os.ReadFile(filepath.Join(configDir(), "servers.json"))
	if err != nil {
		return "[]"
	}
	return string(data)
}

func (a *App) SaveServers(serversJson string) {
	os.WriteFile(filepath.Join(configDir(), "servers.json"), []byte(serversJson), 0644)
}

func (a *App) GetLastServerId() string {
	data, err := os.ReadFile(filepath.Join(configDir(), "last_server.txt"))
	if err != nil {
		return ""
	}
	return string(data)
}

func (a *App) SetLastServerId(id string) {
	os.WriteFile(filepath.Join(configDir(), "last_server.txt"), []byte(id), 0644)
}

func (a *App) SaveQueue(queueJson string) {
	os.WriteFile(filepath.Join(configDir(), "queue.json"), []byte(queueJson), 0644)
}

func (a *App) LoadQueue() string {
	data, err := os.ReadFile(filepath.Join(configDir(), "queue.json"))
	if err != nil {
		return ""
	}
	return string(data)
}

func (a *App) ShowOpenDialog(title string, defaultPath string, filtersJson string) string {
	result, _ := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            title,
		DefaultDirectory: defaultPath,
	})
	return result
}

func (a *App) ShowSaveDialog(title string, defaultPath string, filtersJson string) string {
	result, _ := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           title,
		DefaultFilename: defaultPath,
	})
	return result
}

func (a *App) OpenExternal(url string) {
	runtime.BrowserOpenURL(a.ctx, url)
}

func (a *App) MinimizeWindow() {
	runtime.WindowMinimise(a.ctx)
}

func (a *App) MaximizeWindow() {
	runtime.WindowToggleMaximise(a.ctx)
}

func (a *App) CloseWindow() {
	if a.started {
		a.conn.Call("quit")
		a.conn.Close()
		a.started = false
	}
	if a.cmd != nil && a.cmd.Process != nil {
		a.cmd.Process.Kill()
		a.cmd.Wait()
	}
	os.Remove(a.sockPath)
	runtime.Quit(a.ctx)
}

func (a *App) IsWindowMaximized() bool {
	return runtime.WindowIsMaximised(a.ctx)
}

func (a *App) UpdateDiscordPresence(jsonArgs string) {
	go func() {
		a.discordMu.Lock()

		type rpcArgs struct {
			Enabled           bool    `json:"enabled"`
			ClientID          string  `json:"clientId"`
			ActivityType      int     `json:"activityType"`
			Details           string  `json:"details"`
			State             string  `json:"state"`
			LargeImage        string  `json:"largeImage"`
			LargeText         string  `json:"largeText"`
			SmallImage        string  `json:"smallImage"`
			SmallText         string  `json:"smallText"`
			ShowTimestamps    bool    `json:"showTimestamps"`
			StartMs           float64 `json:"startMs"`
			EndMs             float64 `json:"endMs"`
			ShowButtons       bool    `json:"showButtons"`
			ButtonLabel       string  `json:"buttonLabel"`
			ButtonUrl         string  `json:"buttonUrl"`
			StatusDisplayType int     `json:"statusDisplayType"`
		}

		var args rpcArgs
		if err := json.Unmarshal([]byte(jsonArgs), &args); err != nil {
			a.discordMu.Unlock()
			return
		}

		clientID := args.ClientID
		if clientID == "" {
			clientID = "797506661857099858"
		}

		if !args.Enabled {
			d := a.discord
			a.discord = nil
			a.discordClientID = ""
			a.discordMu.Unlock()
			if d != nil {
				d.Logout()
			}
			return
		}

		activity := discordrpc.Activity{
			Type:              args.ActivityType,
			Details:           args.Details,
			State:             args.State,
			LargeImage:        args.LargeImage,
			LargeText:         args.LargeText,
			SmallImage:        args.SmallImage,
			SmallText:         args.SmallText,
			StatusDisplayType: args.StatusDisplayType,
		}

		if args.ShowTimestamps && args.StartMs > 0 {
			start := time.UnixMilli(int64(args.StartMs))
			activity.Timestamps = &discordrpc.Timestamps{Start: &start}
			if args.EndMs > 0 {
				end := time.UnixMilli(int64(args.EndMs))
				activity.Timestamps.End = &end
			}
		}

		if args.ShowButtons && args.ButtonLabel != "" && args.ButtonUrl != "" {
			activity.Buttons = []*discordrpc.Button{
				{Label: args.ButtonLabel, Url: args.ButtonUrl},
			}
		}

		a.ensureDiscordConnected(clientID)
		if a.discord == nil {
			a.discordMu.Unlock()
			return
		}

		if err := a.discord.SetActivity(activity); err != nil {
			a.discord = nil
			a.discordClientID = ""
		}
		a.discordMu.Unlock()
	}()
}

func (a *App) ensureDiscordConnected(clientID string) {
	if a.discord != nil && a.discordClientID == clientID {
		return
	}
	if a.discord != nil {
		a.discord.Logout()
		a.discord = nil
	}
	c := discordrpc.NewClient(clientID)
	if err := c.Login(); err != nil {
		return
	}
	a.discord = c
	a.discordClientID = clientID
}

func (a *App) ConnectDiscord(clientID string) {
	a.discordMu.Lock()
	defer a.discordMu.Unlock()
	if clientID == "" {
		clientID = "797506661857099858"
	}
	a.ensureDiscordConnected(clientID)
}

func (a *App) ClearDiscordPresence() {
	go func() {
		a.discordMu.Lock()
		d := a.discord
		a.discord = nil
		a.discordClientID = ""
		a.discordMu.Unlock()
		if d != nil {
			d.Logout()
		}
	}()
}

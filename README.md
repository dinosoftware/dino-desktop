# Dino Desktop

A modern, multi-platform [OpenSubsonic](https://opensubsonic.netlify.app/) music player built with React, Tailwind CSS, and Electron.

Two build targets share one React frontend:
- **Web** — Static SPA served behind any web server (includes Docker config)
- **Desktop** — Native desktop app via [Electron](https://www.electronjs.org/) (Linux, macOS, Windows)

## Features

- Browse libraries, albums, artists, playlists, and favorites
- Full playback controls with shuffle, repeat (off/all/one), and queue management
- Real-time audio visualizer (frequency spectrum bars)
- Synchronized and unsynchronized lyrics with auto-scroll
- Discord Rich Presence integration
- Streaming quality and format selection (MP3, Opus, AAC, FLAC, raw)
- Scrobble now-playing and submission to server
- Wake lock to prevent sleep during playback
- Dark/light/system theme support
- MediaSession API for OS-level media key controls
- Save/load play queue to server

## Development

### Prerequisites

- Node.js 22+

### Web (local dev server)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`. API requests to `music.fuge.dev` are proxied through `/api` to avoid CORS during development.

### Desktop (Electron)

```bash
npm install
npm run dev
```

This starts the Vite dev server and then launches Electron with hot reload.

## Building for Production

### Web (Docker)

```bash
docker build -f web/Dockerfile -t dino-web .
docker run -p 8080:80 dino-web
```

### Desktop

```bash
npm run build
```

The output goes to `dist-electron/`.

## Project Structure

```
├── main.js              # Electron main process (IPC, storage, Discord RPC, window)
├── preload.js           # Electron preload (contextBridge for safe IPC)
├── dev.js               # Dev script (spawns Vite + Electron)
├── package.json         # Root package with Electron deps
├── frontend/
│   ├── src/
│   │   ├── api/         # OpenSubsonic API client and types
│   │   ├── components/  # React components (player, context menus, visualizer)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utilities
│   │   ├── platform/    # Platform abstraction (Web, Electron, Wails)
│   │   ├── screens/     # Page components (Home, Album, Artist, Search, etc.)
│   │   └── stores/      # Zustand state (auth, player, cache)
│   └── vite.config.ts   # Vite config with @ alias and API proxy
├── web/
│   ├── Dockerfile       # Multi-stage Docker build for web deployment
│   └── nginx.conf       # Nginx config for SPA routing
├── .github/workflows/   # CI: build Electron binaries + Docker for Linux/Win/Mac
└── AGENTS.md            # Architecture notes for AI assistants
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Zustand |
| Desktop | Electron, Node.js |
| Audio | HTMLAudioElement, Web Audio API (AnalyserNode) |
| Icons | Lucide React |
| Web Server | Nginx (Docker) |

## AI Disclosure

This project was developed with AI assistance. The entirety of the application's source code was generated or co-written using large language models, then reviewed and tested.

## License

[GNU General Public License v3.0](LICENSE)

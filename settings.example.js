// Dino Web Settings
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW TO USE:
//
//   1. Copy this file to settings.js in the SAME directory as index.html.
//   2. Edit the values below to match your deployment.
//
// WHERE TO PUT settings.js:
//
//   Docker / nginx / static hosting:
//     Place settings.js next to index.html in your web root.
//     Example: /usr/share/nginx/html/settings.js
//     Example: /var/www/html/settings.js
//
//   After a production build (frontend/dist/):
//     cp settings.js.example frontend/dist/settings.js
//     Then edit frontend/dist/settings.js
//
//   During development (Vite serves from frontend/public/):
//     cp settings.js.example frontend/public/settings.js
//     Then edit frontend/public/settings.js
//
//   Desktop (Wails) builds:
//     settings.js is NOT loaded in desktop builds. The desktop app uses
//     its own server configuration stored in the app's config directory.
//     You can safely ignore this file for desktop builds.
//
// ─────────────────────────────────────────────────────────────────────────────

window.__DINO_SETTINGS__ = {
  // Lock the server URL so users cannot change it.
  // When true, the login page only shows username and password fields
  // (no server URL or name inputs).
  // The serverUrl below MUST be set when serverLock is true.
  serverLock: false,

  // Pre-configured server URL.
  //
  // '/'               — App is hosted alongside the OpenSubsonic server.
  //                     API requests go to /rest/{endpoint} on the same origin.
  //                     This is the recommended setup for reverse proxy deployments.
  //
  // 'https://...'     — Full URL to a remote OpenSubsonic server.
  //                     CORS must be enabled on the server, or use a proxy.
  //
  // null / undefined  — Users configure the server URL themselves via the login page.
  serverUrl: null,

  // Pre-configured credentials (optional, for trusted/reverse-proxy environments).
  // If both are set, the app will attempt to auto-login on first load.
  // WARNING: Credentials stored here are visible to anyone with access to this file.
  // username: null,
  // password: null,
};

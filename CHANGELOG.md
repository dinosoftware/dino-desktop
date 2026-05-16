# v1.11.0

## New Features
- OpenSubsonic extension support
  - Queries `getOpenSubsonicExtensions` on login and caches available extensions
  - `formPost` extension: switches all API calls from GET to POST with `application/x-www-form-urlencoded` body
  - `sonicSimilarity` extension: prefers `getSonicSimilarTracks` (audio-analysis-based) over `getSimilarSongs2` (metadata-based) for Instant Mix and auto-extend queue
  - Gracefully falls back to legacy behavior when extensions are unavailable

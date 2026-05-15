# v1.10.0

## New Features
- Replay Gain support for desktop (Off / Track / Album modes)
  - MPV mode: reads RG tags directly from audio stream via `--replaygain`
  - HTML audio mode: applies gain via dedicated GainNode with peak-based clipping prevention
  - Falls back to `getSong` API for RG data when not included in list responses
- Replay Gain setting in Settings > Playback (Off / Track / Album)
- Discord RPC reconnect button in Settings
- Quality indicator detail mode persisted across sessions

## Bug Fixes
- MPV: new song while paused now properly starts playing instead of staying paused
- MPV: added pause-before-load to prevent audio blip on track transitions
- MPV: `mpvManualLoad` flag prevents false track-end triggers from replaced files
- Play Next with no queue now creates a new queue and starts playing
- Clear Queue now stops playback instead of leaving audio running
- Clear Queue on fullscreen player no longer causes black screen (exits to mini mode)
- Sidebar expand button in compact mode now uses blurred backdrop for visibility over icon
- Sidebar icon no longer compressed in compact mode
- Quality badge toggle state saved to localStorage

## Improvements
- Compact mini player volume button now shows a slider popup instead of just toggling mute
- GitHub Actions: finalize job generates CHANGELOG.md and uses it as release body
- Added `getSong` API method for fetching per-track metadata

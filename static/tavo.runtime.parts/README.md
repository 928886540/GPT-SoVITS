# Tavo Runtime Parts

`static/tavo.runtime.js` is now a small lazy loader. It fetches these fragments, concatenates them in order, and executes them as the original runtime closure.

The fragments are intentionally behavior-equivalent slices of the previous monolithic runtime. They are not standalone scripts yet.

Order:

1. `00_base_config_storage.js` - bootstrap, debug logging, storage primitives, shared base helpers.
2. `05_message_text_config.js` - message text cleaning, message context, config loading, icon helpers, style presets.
3. `10_tts_jobs_audio_stream.js` - TTS request builders and Web Audio streaming.
4. `20_llm_segmentation.js` - LLM parsing, dialogue normalization, synthesis splitting.
5. `25_ui_templates.js` - behavior-equivalent HTML template helpers for shell, subtitles, role rows, and voice picker.
6. `30_player_shell.js` - player DOM shell, track state, subtitles, history UI.
7. `32_llm_reuse_helpers.js` - LLM parse reuse keys and reuse storage helpers.
8. `34_element_audio_controls.js` - element-audio labels, seek helpers, and audio fallback controls.
9. `36_track_state_offline.js` - track state machine helpers and offline audio hydration/storage.
10. `38_saved_prompt_stream_helpers.js` - saved-audio prompt switching and stream error helpers.
11. `40_playback_cache.js` - live Web Audio playback path.
12. `42_saved_playback_cache.js` - saved-track status, decoded-buffer playback, saved audio availability.
13. `44_track_history_cache.js` - track selection, cache upgrade polling, history restore, delete flow.
14. `48_settings_fields.js` - settings field helpers and `readFields`.
15. `50_settings_voice_picker.js` - settings validation/sync and mode UI state.
16. `52_voice_subtitle_media.js` - voice list loading, subtitles, MediaSession updates.
17. `54_voice_picker_panel.js` - role rows, voice picker state, preview, paging, picker guards.
18. `58_live_pause_helper.js` - live-track pause helper.
19. `60_generate_mount_boot.js` - generate flow.
20. `62_dialog_audio_events.js` - settings dialog layer controls and player/audio event bindings.
21. `68_mount_boot.js` - lazy full-player mount and runtime bootstrap.

`static/tavo.ui.skin.default.css` contains the default skin and is loaded lazily by `ensureStyle()` after the runtime starts.

Next refactor target: turn the behavior-equivalent template helpers into a real UI module API and allow alternate UI/skin JS to be selected without changing the Tavo regex entry.

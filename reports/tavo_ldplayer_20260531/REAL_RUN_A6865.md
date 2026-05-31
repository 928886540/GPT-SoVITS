# Tavo LDPlayer Real Test 2026-05-31

## Environment

- Emulator: LDPlayer / Tavo real app
- Adapter: `http://192.168.8.100:9880`
- Loader tested: `static/tavo.js?v=2028881900`
- Runtime tested: `20260531-lan-webview-layer-v10`
- LLM endpoint: `http://192.168.8.100:8317/v1`
- LLM model: `渡鸦/grok-4.20-fast`

## Completed Real Run

- Cache key: `a6865f6c52254c29d6ba24c050bc1af863aaf218`
- WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\outputs\cache\a6865f6c52254c29d6ba24c050bc1af863aaf218.wav`
- Metadata: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\outputs\cache\a6865f6c52254c29d6ba24c050bc1af863aaf218.json`
- ASR output: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\outputs\asr\ldplayer_a6865f6c52254c29d6ba24c050bc1af863aaf218_new_mapping_20260531`

## Parameters / Metrics

- Mode: multi-voice / expressive
- `sample_steps`: 16
- `batch_size`: 4
- Segments: 31
- Total generation time: 67.062173s
- Audio duration: 114.1980625s
- RTF: 0.587244402679888

## Voice Mapping Observed

- `旁白` -> `400个火爆音色/AD学姐`
- `用户` -> `男声/霸道青年`
- `安宁` -> `女声/成熟姐姐`
- `贾静雯` -> `女声/魅力女友`
- `default` -> `女声/风韵少妇`

## Findings

- Whisper CLI was used on the generated WAV. The ASR output follows the target scene and did not show the earlier AD学姐 prompt leak like `慢慢说，我陪着你`.
- `贾静雯` appeared in the generated mapping and used `女声/魅力女友`.
- A real bug was found: `白夜雨` appeared as a role but was not normalized to `用户`, so it fell to `default`. This was caused by the Tavo persona name changing from the previous alias to `白夜雨`.
- Another real UI bug was found: the visible previous/next history-track buttons were removed by mistake when the intended removal was only the 10-second seek buttons. The history-track buttons must remain.
- Lazy card history count showed `历史音频 0 条` even when history existed. The loader only had synchronous/local data at first paint; it now refreshes from async Tavo chat/global storage and updates the lazy card.

## Code Follow-up In This Commit

- Frontend now collects persona aliases from Tavo persona data and normalizes matching LLM roles to `用户`.
- Backend no longer silently falls back unknown dialogue roles to `default`, except for explicit default/current-character placeholder roles.
- Previous/next history-track buttons are restored.
- 10-second seek remains available through MediaSession `seekbackward` / `seekforward`, not visible player buttons.

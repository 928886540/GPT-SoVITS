# Adapter Stream Smoke Test 20260531

API status:

- Adapter: `http://127.0.0.1:9880/health`
- Official GPT-SoVITS: `http://127.0.0.1:9881/docs`

Test voice:

- Profile: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\成熟姐姐.json`

Endpoints tested:

- `POST http://127.0.0.1:9880/tts_dialogue_stream_job`
- `GET http://127.0.0.1:9880/tts_dialogue_stream_job/{cache_key}`
- `GET http://127.0.0.1:9880/tts_dialogue_job_status/{cache_key}`
- `GET http://127.0.0.1:9880/cache_audio/{cache_key}`

Result:

- Cache key: `edd0aa88158668e4d24cd21c525d3c8c15e75e84`
- Live stream output: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\adapter_stream_smoke_20260531\mature_sister_live_stream.wav`
- Live first byte: `2.960s`
- Live total download: `7.274s`
- Live bytes: `771884`
- Live WAV header frames: `0`
- Cached WAV output: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\adapter_stream_smoke_20260531\mature_sister_cached_after_stream.wav`
- Cached WAV duration: `8.114s`
- Cached sample rate: `48000 Hz`
- Cached RTF: `1.023`

Interpretation:

- The adapter API exists and can return live audio bytes.
- The live stream file is not a normal seekable WAV for desktop players because the streamed WAV header reports `0` frames.
- The cache job produces a normal WAV after generation.
- Current V4 live test used the profile default `sample_steps=32`, so it is not optimized for streaming latency.
- Next adapter work should expose model/runtime params such as `sample_steps`, `batch_size`, and `parallel_infer` through the request schema, then retest V4 `steps=8/16`.

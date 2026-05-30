# P2 Sentence Style Smoke - 2026-05-31

Goal: verify GPT-SoVITS adapter keeps the original Tavo/IndexTTS play style: LLM or frontend sends per-segment `role` and `style`; adapter maps role to main voice profile and style to per-sentence `aux_ref_audio_paths`.

Adapter:

- URL: `http://127.0.0.1:9880`
- LAN URL: `http://192.168.8.100:9880`
- Test page: `http://192.168.8.100:9880/p2_test`

Smoke request:

- API: `POST http://127.0.0.1:9880/tts_dialogue_stream_job`
- Cache key: `d39d3b6cc28e60d6733042e9adf384f5b771ce5b`
- Cached WAV: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\outputs\cache\d39d3b6cc28e60d6733042e9adf384f5b771ce5b.wav`
- Metadata: `D:\apiWorkSpace\GPT-SoVITS\Leon_api\outputs\cache\d39d3b6cc28e60d6733042e9adf384f5b771ce5b.json`

Segments verified:

| Segment | Role | Text | Style | Aux ref |
| ---: | --- | --- | --- | --- |
| 0 | 旁白 | 她靠近了一点。 | neutral | none |
| 1 | 她 | 你听得到我说话吗？ | whisper_soft | `D:/apiWorkSpace/GPT-SoVITS/Leon_api/prompts/library/声腔/whisper_soft.wav` |
| 2 | 她 | 嗯，我有点紧张。 | 喘息-AD学姐 | `D:/apiWorkSpace/GPT-SoVITS/Leon_api/prompts/library/声腔/喘息-AD学姐.mp3` |

Metrics:

- Output sample rate: `48000`
- Audio duration: `4.88s`
- Total generation time: `3.328s`
- RTF: `0.682`

Current implementation note:

- P2 prioritizes correctness: multi-role and sentence-level style are preserved in cached WAV generation.
- `GET /tts_dialogue_stream_job/{cache_key}` now generates the faithful segmented cache if it is not ready, then returns the WAV. This is not true low-latency streaming yet, but it prevents losing per-sentence voices/styles.
- True segment-by-segment live streaming remains the next optimization after P2 correctness.

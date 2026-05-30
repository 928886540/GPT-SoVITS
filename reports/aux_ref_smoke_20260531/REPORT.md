# Aux Reference Smoke Test 20260531

Purpose:

- Verify that local adapter profiles can pass `aux_ref_audio_paths` to the official GPT-SoVITS `/tts` payload.
- Provide A/B files for AD学姐 with and without a voice-style auxiliary reference.

Adapter change:

- `gsv_tavo_adapter.py` now accepts request-level `sample_steps`, `batch_size`, `parallel_infer`, `text_split_method`, and `aux_ref_audio_paths`.
- `_official_payload_for_segment()` now forwards profile/request `aux_ref_audio_paths` to official GPT-SoVITS.

Profiles added:

- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\AD学姐_耳语_aux.json`
- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\AD学姐_低语_aux.json`
- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\AD学姐_轻笑_aux.json`
- `D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\AD学姐_喘息_aux.json`

Test text:

`学姐，贴近一点，用轻一点的耳语感觉，说完这段声腔测试。`

Parameters:

- `sample_steps=16`
- `batch_size=8`
- `parallel_infer=true`
- `top_k=15`
- `top_p=1.0`
- `temperature=1.0`

Results:

| Case | Profile | Aux ref | Duration | Total | RTF | WAV |
| --- | --- | --- | ---: | ---: | ---: | --- |
| No aux baseline | `女声/AD学姐` | none | 5.797s | 2.355s | 0.406 | `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\aux_ref_smoke_20260531\ad_xuejie_no_aux_cached.wav` |
| Whisper aux | `女声/AD学姐_耳语_aux` | `声腔/耳语-AD学姐.MP3` | 6.116s | 2.543s | 0.416 | `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\aux_ref_smoke_20260531\ad_xuejie_whisper_aux_cached.wav` |

Interpretation:

- The adapter-side aux reference path is now wired and testable.
- The first A/B pair is generated and ready for listening.
- The numerical RTF impact is small in this short test; whether the声腔 actually changes style must be judged by listening.
- Next useful tests: run the same text for `低语_aux`, `轻笑_aux`, and `喘息_aux`, then compare against the no-aux baseline.

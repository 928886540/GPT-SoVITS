Codex handoff rules for this workspace:

- Default reply language is Simplified Chinese.
- Before doing work here, read `README.md`, `handoff_docs/CURRENT_STATUS.md`, and `handoff_docs/NEXT_SESSION.md`.
- This workspace is for GPT-SoVITS / Genie-TTS local product validation, not for a public hosted service.
- The user wants a distributable local package for community users to run on their own machines.
- Current main direction: official GPT-SoVITS for training and voice creation. Genie-TTS is paused as a later lightweight local runtime option.
- Keep third-party repos in `..\gpt-sovits-official` and `..\genie-tts` clean unless the user explicitly asks to patch them.
- Put local scripts, reports, samples, and handoff notes under this `Leon_api` directory.
- Avoid C drive caches. Use `dev_tools\env_official.ps1` and `dev_tools\env_genie.ps1` before running Python tests.
- Do not add silent fallback behavior for Tavo/TTS configuration. Missing voice mappings, missing prompt text, unavailable services, or invalid parameters must fail visibly with a specific error and logs. Do not swallow errors, auto-select voices, reuse random defaults, or mask bad configuration with "best effort" behavior. Only add automatic fallback/auto-selection when the user explicitly asks for it or an existing documented product rule requires it.

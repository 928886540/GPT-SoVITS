Codex handoff rules for this workspace:

- Default reply language is Simplified Chinese.
- Before doing work here, read `README.md`, `docs/AGENT_STATE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/BUGS.md`, `docs/TODO.md`, and `docs/REGRESSION.md`.
- This workspace is for GPT-SoVITS / Genie-TTS local product validation, not for a public hosted service.
- The user wants a distributable local package for community users to run on their own machines.
- Current main direction: official GPT-SoVITS for training and voice creation. Genie-TTS is paused as a later lightweight local runtime option.
- Keep third-party repos in `..\gpt-sovits-official` and `..\genie-tts` clean unless the user explicitly asks to patch them.
- Put local scripts, reports, samples, and handoff notes under this `Leon_api` directory.
- Keep `outputs\cache` reserved for real Tavo/runtime cache artifacts. Do not put Codex-only test audio there; place future manual/benchmark test audio under `reports\...` or a dedicated non-cache output folder instead.
- Avoid C drive caches. Use `dev_tools\env_official.ps1` and `dev_tools\env_genie.ps1` before running Python tests.
- Do not add silent fallback behavior for Tavo/TTS configuration. Missing voice mappings, missing prompt text, unavailable services, or invalid parameters must fail visibly with a specific error and logs. Do not swallow errors, auto-select voices, reuse random defaults, or mask bad configuration with "best effort" behavior. Only add automatic fallback/auto-selection when the user explicitly asks for it or an existing documented product rule requires it.
- When the user reports a new bug, immediately add or update an entry in `docs/BUGS.md` before fixing it. If root cause is not confirmed, mark it as investigating and separate evidence from hypothesis.
- Before changing bug-fix code, read `docs/BUGS.md` and check existing entries so the same bug is not forgotten, duplicated, or repeatedly fixed in conflicting ways.
- If another agent or parallel session is working in the same area, record the split in `docs/AGENT_STATE.md`, inspect current `git status` / `git diff`, and avoid touching their reserved code path unless the user explicitly redirects.
- Context-low handoff rule: Codex cannot directly read the UI `context left` percentage. If the user says context is low, near 5%, or asks to record context, immediately stop feature work, update `docs/AGENT_STATE.md` plus `docs/TODO.md` / `docs/BUGS.md` / `docs/REGRESSION.md` as needed, summarize current files changed, validation status, blockers, and next exact step, then remind the user to end the current session and reopen Codex.
- For long-running refactors or bug hunts, update `docs/AGENT_STATE.md` after each stable milestone instead of waiting until context is nearly exhausted.
- When a bug is fixed, record it in `docs/BUGS.md` with repro, root cause, fix, and regression guard. If the same bug returns, treat it as a regression and update `docs/REGRESSION.md`.
- Keep `README.md` short and structural. Put ongoing state in `docs/`, not in the README body.
- Treat `handoff_docs/` as historical context. Read it only when `docs/` is insufficient or when the user asks to trace older validation details.




# AGENTS.md

This file defines how Codex should behave in this workspace and its subdirectories.

## User Preferences

- Default language: Chinese.
- Address the user naturally as `bro`, `哥们`, or `兄弟` when it fits the tone.
- Tone: direct, concise, a little more lively than the default CLI style.
- Use light emoji naturally when replying, but keep output readable in a terminal. Do not use kaomoji or childish emoticons. Do not overuse emoji.
- Avoid sounding dry or overly formal.

## Debugging Style

- Prioritize root-cause analysis over defensive coding.
- Before changing code, state the main cause hypothesis and the evidence.
- Do not add fallback logic, retry logic, broad exception swallowing, or compatibility branches unless the user explicitly asks for a workaround.
- Prefer minimal, targeted fixes that make the real failure easier to observe.
- If a change is only a workaround, label it clearly as a workaround rather than a real fix.
- If the root cause is still uncertain, say so directly instead of presenting guesses as facts.

## Coding Preferences

- Keep changes small and easy to diff.
- Expose failures clearly when useful; do not hide bugs behind silent handling.
- When multiple fixes are possible, prefer the one that helps future debugging.

## Scope Note

- This file applies when Codex is started in `C:\Users\Administrator` or any subdirectory under it.

# Architecture

## 产品边界

目标是本地整合包，不是公网服务。用户在自己的机器上运行模型、adapter、脚本和可选 Tavo 集成。

## 模块边界

- Tavo 前端：`static/tavo.js` / `static/tavo.runtime.js`，负责消息卡片、配置、角色映射、播放、历史音频和 IndexedDB 离线缓存。
- Adapter：`gsv_tavo_adapter.py`，负责兼容 Tavo 前端接口、队列、缓存、Voice Profile、LLM parse 代理和调用官方 GPT-SoVITS。
- 官方 GPT-SoVITS：`../gpt-sovits-official`，负责模型加载和 TTS 推理。默认不在上游仓库里打本地补丁。
- Voice Profiles：`prompts/library/**/*.json`，GPT-SoVITS 可生成音色必须有 `ref_audio_path` 和准确 `prompt_text`。
- Reports：`reports/...`，保存 benchmark、Whisper 输出、人工听感和复现证据。

## Tavo 多音色链路

```text
Tavo 原文
  -> LLM 拆句输出 role + style
  -> 前端按角色映射构造 voices map
  -> adapter 按 role 选择主 Voice Profile
  -> adapter 按 style 选择声腔 aux_ref_audio_paths
  -> GPT-SoVITS 分句合成
  -> adapter 拼接并保存 cache WAV + metadata
  -> Tavo 播放流式或保存音频
```

## 声腔职责

- 主 Voice Profile 决定角色像不像、稳不稳。
- LLM / 用户标注决定每句是谁说的、用什么 style。
- 声腔 aux 只给当前句子叠加耳语、喘息、轻笑、哭腔、尖叫、余韵等参考。

## 缓存边界

缓存 key 必须区分文本、角色映射、Voice Profile、模型版本和推理参数。相同文本分别用 v2ProPlus / V4 生成时必须是两个不同缓存。

普通模式 / 智能模式也必须进入缓存边界：相同原文在不同模式、不同默认/旁白/对白音色、不同角色映射或不同推理参数下，不能复用同一个 cache。

## Tavo runtime 拆分计划

当前 `static/tavo.runtime.js` 是单文件 runtime，已经同时承载配置、消息提取、正文清洗、播放器、缓存、dialogue job、设置页、音色选择器和调试日志。文件过大导致每次 AI 接手都会大量消耗上下文 token，定位慢、改动慢，也更容易误碰并行工作线。后续需要拆分来降低冲突和上下文成本，但 Tavo 正则注入仍保留 `static/tavo.js` 一个入口。

第一版已落地为行为等价的物理拆分：

- `static/tavo.js`：Tavo 正则唯一入口和消息懒加载卡片。
- `static/tavo.runtime.js`：小型 runtime part loader；只有点击懒加载卡片后才加载。
- `static/tavo.runtime.parts/00_base_config_storage.js`
- `static/tavo.runtime.parts/05_message_text_config.js`
- `static/tavo.runtime.parts/10_tts_jobs_audio_stream.js`
- `static/tavo.runtime.parts/20_llm_segmentation.js`
- `static/tavo.runtime.parts/25_ui_templates.js`
- `static/tavo.runtime.parts/30_player_shell.js`
- `static/tavo.runtime.parts/32_llm_reuse_helpers.js`
- `static/tavo.runtime.parts/34_element_audio_controls.js`
- `static/tavo.runtime.parts/36_track_state_offline.js`
- `static/tavo.runtime.parts/38_saved_prompt_stream_helpers.js`
- `static/tavo.runtime.parts/40_playback_cache.js`
- `static/tavo.runtime.parts/42_saved_playback_cache.js`
- `static/tavo.runtime.parts/44_track_history_cache.js`
- `static/tavo.runtime.parts/48_settings_fields.js`
- `static/tavo.runtime.parts/50_settings_voice_picker.js`
- `static/tavo.runtime.parts/52_voice_subtitle_media.js`
- `static/tavo.runtime.parts/54_voice_picker_panel.js`
- `static/tavo.runtime.parts/58_live_pause_helper.js`
- `static/tavo.runtime.parts/60_generate_mount_boot.js`
- `static/tavo.runtime.parts/62_dialog_audio_events.js`
- `static/tavo.runtime.parts/68_mount_boot.js`
- `static/tavo.ui.skin.default.css`

当前 parts 是按顺序拼接执行的闭包片段，目的是先降低单文件 token 成本并减少并行冲突。第二步已把 message/text/config 从 bootstrap 里拆出，抽离 CSS 和第一批 HTML 模板，并继续把播放、track/cache、设置、picker、生成和事件绑定按函数边界拆小。`tavo.ui.skin.default.css` 承载默认皮肤，`25_ui_templates.js` 承载主 shell、懒加载 shell、字幕、角色行和 picker 小模板。

当前 Phase 1 已把 `static/tavo.runtime.js` 改为 manifest/config 驱动的 ordered-fragments loader：loader 读取 `static/tavo.runtime.manifest.json`，校验依赖并拓扑排序，再 fetch 21 个旧 parts 拼接闭包执行。它已经不再只靠硬编码数组决定模块列表，但还不是 Phase 2 的真 module registry；parts 之间仍共享闭包变量。下一步先做真实 Tavo/雷电回归，通过后再逐步迁到 module registry / UI skin 可替换 / 业务模块 API。中途如果会话中断，以 `docs/RUNTIME_MODULARIZATION.md` 的阶段状态和回滚规则为准。

拆分建议按职责推进：

- bootstrap / loader handshake：注入幂等、base URL、版本和日志入口。
- config / storage：Tavo character/chat scope 配置、历史 tracks、IndexedDB。
- message / text cleaning：当前消息识别、正文清洗、普通模式规则拆段。
- audio / player：`<audio>`、Web Audio、seek、保存音频复播、AudioContext 生命周期。
- tts jobs：普通模式 stream job、智能模式 dialogue job、cache 状态轮询。
- settings panel / voice picker：设置页布局、弹层层级、音色试听和应用。
- UI skin：参考旧项目 `insert.ui.skin.*.js`，后续允许加载不同 UI/skin JS。

拆分前必须先看当前未提交 diff，避免把普通/智能模式半成品和 BUG-004/014/015/016 的弹层/播放器修复混在一个大改里。

## 质量档位

当前暂定：

- `fast`: `batch_size=8`, `sample_steps=8`
- `balanced`: `batch_size=4`, `sample_steps=16`
- `expressive`: 待重新实测，目标至少测 `sample_steps=24`
- `ultra`: 待重新实测，目标至少测 `sample_steps=32`

旧“质量优先”实际更像标准档，不能继续靠名字判断质量。

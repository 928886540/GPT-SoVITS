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

## 质量档位

当前暂定：

- `fast`: `batch_size=8`, `sample_steps=8`
- `balanced`: `batch_size=4`, `sample_steps=16`
- `expressive`: 待重新实测，目标至少测 `sample_steps=24`
- `ultra`: 待重新实测，目标至少测 `sample_steps=32`

旧“质量优先”实际更像标准档，不能继续靠名字判断质量。

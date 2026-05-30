# GPT-SoVITS Tavo Migration Plan

更新时间：2026-05-30

## 目标

把旧 `IndexTTS2 × Tavo` 后期形成的本地播放器体验迁移到 GPT-SoVITS：

- Tavo 单脚本注入。
- 多角色多音色。
- 点击才生成。
- 当前卡片流式播放。
- 非当前卡片后台排队并落盘。
- 本地快照缓存。
- Tavo 持久化配置。
- SQLite Profile。
- IndexedDB 离线音频。
- 诊断日志和任务状态。

这次迁移保留产品层和交互层，不保留 IndexTTS2/vLLM/BigVGAN 的引擎假设。

## 旧项目来源

旧仓库：

```text
D:\apiWorkSpace\index-tts2-vLLM
```

当前分支和提交：

```text
VLLM
830aa03 Fix Tavo live stream resume playback
```

重点文件：

- `static/tavo.js`
- `static/tavo_widget_test.html`
- `indextts2_api.py`
- `indextts/snapshot_cache.py`
- `indextts/profile_store.py`
- `indextts/voice_library.py`
- `indextts/llm_proxy.py`
- `Leon_api/handoff_docs/architecture/README.md`
- `Leon_api/handoff_docs/QUICKSTART_TAVO.md`

最后提交的关键改动：

- live stream 支持 `start_s` 断点续播。
- 前端记录 stream offset，字幕/进度条按真实播放秒数计算。
- 默认用 `<audio>` 元素播放 live stream，`webAudioLive=1` 时才强制 Web Audio。
- MediaSession seek 和进度状态改用真实 track 时间。

## 可直接迁移的层

前端：

- 播放卡片 UI。
- 设置面板。
- 角色音色映射结构：`roleVoiceList = [{role, voice}]`。
- Tavo `tavo.get` / `tavo.set` 持久化。
- 当前消息识别、角色名识别、角色头像读取。
- 历史卡片恢复。
- IndexedDB 离线音频。
- MediaSession 后台控制。
- seek / rewind / forward。
- `segments_meta` 字幕校准。
- `/parse_text` LLM 代理调用方式。

后端辅助模块：

- `snapshot_cache.py`：改名为 GPT-SoVITS cache 即可复用。
- `profile_store.py`：SQLite profile 结构可复用，DB 名改为 `outputs/gptsovits_profiles.sqlite3`。
- `voice_library.py`：扫描 `prompts/library/**` 可复用，但返回结构要扩展为 GPT-SoVITS Voice Profile。
- `llm_proxy.py`：OpenAI-compatible JSON 拆段逻辑可复用，`emo_vec` 字段在 GPT-SoVITS 中降级为可选风格提示。

## 必须重写的层

GPT-SoVITS adapter：

- 不直接暴露官方 `api_v2.py` 给 Tavo。
- 本地 adapter 负责把旧前端契约转换为 GPT-SoVITS 参数。
- adapter 可以先代理官方 API，后续再考虑直接 import 官方 TTS pipeline。

任务调度：

- 本机 FIFO 队列。
- 同一时间默认只跑一个重型 TTS 推理任务。
- 当前卡片允许流式。
- 非当前卡片只生成到缓存，不抢播。

Voice Profile：

- 旧 IndexTTS 的 voice 是音频文件名。
- GPT-SoVITS 的 voice 应该包含：
  - `ref_audio_path`
  - `prompt_text`
  - `prompt_lang`
  - `text_lang`
  - `gpt_weights_path`
  - `sovits_weights_path`
  - 默认推理参数

字幕元数据：

- 旧项目按每段 PCM 起止位置写 `segments_meta`。
- GPT-SoVITS adapter 也要落：
  - `role`
  - `text`
  - `start_s`
  - `start_offset_bytes`
  - `duration_s`
  - `sample_rate`

## 本地接口契约

为了最大化复用旧 `static/tavo.js`，GPT-SoVITS adapter 优先实现这些接口：

```text
GET  /static/tavo.js
GET  /tavo_test
GET  /voices
POST /profiles
GET  /profiles
POST /parse_text
POST /tts_dialogue_stream_job
GET  /tts_dialogue_stream_job/{cache_key}?start_s=0
GET  /tts_dialogue_job_status/{cache_key}
GET  /cache_audio/{cache_key}
DELETE /tts_dialogue_stream_job/{cache_key}
GET  /diagnostics/resource
GET  /diagnostics/perf
GET  /server_log/tail
```

`POST /tts_dialogue_stream_job` 输入保持旧前端形状：

```json
{
  "segments": [
    {"role": "旁白", "text": "旁白正文"},
    {"role": "角色A", "text": "角色台词"}
  ],
  "voices": {
    "default": "mika_whisper_v2proplus",
    "旁白": "narrator_v4",
    "角色A": "mika_whisper_v2proplus"
  },
  "top_p": 1.0,
  "top_k": 15,
  "temperature": 1.0,
  "speed_factor": 1.0,
  "streaming_mode": 2
}
```

adapter 内部再转换为官方 GPT-SoVITS 请求参数：

```json
{
  "text": "角色台词",
  "text_lang": "zh",
  "ref_audio_path": "prompts/library/mika/ref.wav",
  "prompt_text": "参考音频对应原文",
  "prompt_lang": "zh",
  "text_split_method": "cut5",
  "batch_size": 1,
  "top_k": 15,
  "top_p": 1.0,
  "temperature": 1.0,
  "streaming_mode": 2,
  "parallel_infer": true,
  "speed_factor": 1.0,
  "fragment_interval": 0.3,
  "overlap_length": 2,
  "min_chunk_length": 16
}
```

## 执行顺序

1. 文档先落地：README 写清 GPT-SoVITS 要达到的本地交付效果。
2. 复制旧 `static/tavo.js` 到 `Leon_api/static/tavo.js`，先做最小重命名，保留旧接口契约。
3. 复制旧 Tavo 测试页到 `Leon_api/static/tavo_widget_test.html`，改成 GPT-SoVITS 命名。
4. 创建 adapter 辅助模块：
   - `gsv_adapter/snapshot_cache.py`
   - `gsv_adapter/profile_store.py`
   - `gsv_adapter/voice_library.py`
   - `gsv_adapter/llm_proxy.py`
5. 官方 GPT-SoVITS 推理跑通后，再实现 `gsv_tavo_adapter.py`。
6. 建立固定验证：
   - `node --check static/tavo.js`
   - adapter `python -m py_compile`
   - `/tavo_test` Playwright 烟测
   - 官方 GPT-SoVITS API 推理 benchmark

## 风险点

- 官方 GPT-SoVITS 的流式返回语义需要实测，不能假设等同 IndexTTS 的 chunked WAV。
- v4 / v2ProPlus 是否适合 ASMR，要靠参考音频和主观试听决定。
- GPT-SoVITS 多角色频繁切权重成本可能很高，优先用同一权重 + 不同参考音频验证。
- 图片架构图只能做视觉沟通，准确接口契约以 README 和本计划为准。

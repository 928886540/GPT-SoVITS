# Tavo Adapter Official Binding

更新时间：2026-05-30

## 结论

`gsv_tavo_adapter.py` 已接到官方 GPT-SoVITS `api_v2.py` 的非流式 `/tts` 路径。

当前实现能完成：

- Tavo dialogue job 契约输入。
- `POST /tts_dialogue_stream_job` 立即返回 `cache_key`，后台单 worker FIFO 生成。
- 按段调用官方 `/tts`。
- 多段 WAV PCM 拼接。
- 写入 `outputs/cache/{cache_key}.wav` 和 JSON metadata。
- `GET /tts_dialogue_job_status/{cache_key}` 返回 `state=done`、`segments_meta`、`duration_s`、`metrics`。
- `GET/HEAD /cache_audio/{cache_key}` 返回可播放 WAV。
- `/voices` 返回 `{ voices, items }`，兼容旧 Tavo 前端读取方式。

这一步仍不是最终流式播放实现。当前卡片“真流式首包”后续要单独接官方 `streaming_mode=true`；后台缓存和历史播放先走非流式完整 WAV。

## 后台队列验证

新增后台 job 队列后，POST 不再等待官方 GPT-SoVITS 完整合成。

验证请求：两段中文，`local_huihui` 测试 profile。

POST 返回：

```json
{
  "cache_key": "fd2c0f6cdfa00bb81c07531514d4c3a742b556b3",
  "cached": false,
  "live": false,
  "state": "queued",
  "queue_position": 1
}
```

提交耗时：`18ms`

随后轮询状态：

```json
{
  "state": "done",
  "cached": true,
  "sample_rate": 32000,
  "duration_s": 10.92,
  "metrics": {
    "total_s": 4.308084399992367,
    "audio_duration_s": 10.92,
    "rtf": 0.3945132234425245
  }
}
```

缓存音频验证：

```text
HEAD /cache_audio/fd2c0f6cdfa00bb81c07531514d4c3a742b556b3 -> 200 OK, content-type: audio/wav, content-length: 698924
```

队列策略：

- 单 worker FIFO。
- 相同 `cache_key` 的 queued/running job 不重复入队。
- 删除 job 会删除缓存，并把内存状态标为 `deleted`。
- 生成失败时 status 返回 `state=failed` 和 `error`。

## 测试音色

新增测试 Voice Profile：`prompts/library/local_huihui.json`

它引用本机生成参考音频：

```text
prompts/generated_reference/huihui_ref.wav
```

该 wav 被 `.gitignore` 排除，只用于本机链路验证。真实音色后续按同样 JSON 结构写 profile。

## 端到端验证

服务：

- Adapter: `http://127.0.0.1:9880`
- Official API: `http://127.0.0.1:9881`

请求：

```json
{
  "segments": [
    {"role": "旁白", "text": "第一段来自 GPT SoVITS adapter。"},
    {"role": "角色", "text": "第二段用于验证多段拼接和缓存状态。"}
  ],
  "voices": {
    "旁白": "local_huihui",
    "角色": "local_huihui",
    "default": "local_huihui"
  },
  "top_p": 1.0,
  "top_k": 15,
  "temperature": 1.0,
  "speed_factor": 1.0,
  "streaming_mode": false,
  "performance_mode": "balanced"
}
```

返回：

```json
{
  "cache_key": "81c0026493712656f53c64cb758e7a846b2a1f76",
  "cached": false,
  "live": false,
  "state": "done",
  "metrics": {
    "total_s": 3.281070800003363,
    "audio_duration_s": 10.12,
    "rtf": 0.32421648221377103
  }
}
```

状态接口验证：

- `state`: `done`
- `cached`: `true`
- `sample_rate`: `32000`
- `duration_s`: `10.12`
- `segments_meta`: 2 段，带 `start_s` / `duration_s` / `start_offset_bytes`

缓存音频验证：

```text
HEAD /cache_audio/81c0026493712656f53c64cb758e7a846b2a1f76 -> 200 OK, content-type: audio/wav, content-length: 647724
```

## 限制

- 现在多角色能映射不同 Voice Profile，但没有做 GPT/SoVITS 权重热切换。
- 当前播放卡片的真流式路径还没接入；已确认官方流式首包约 `2.039s`，但流式 WAV 长度字段是占位，不能直接用于缓存时长。
- 测试参考音频是 SAPI 生成音，不代表目标 ASMR 音质。

## 下一步

1. 为当前卡片增加官方 `streaming_mode=true` 直通播放路径。
2. 添加真实人声音色 profile 后重测音质和角色映射。
3. 再下载 v2ProPlus / v4 权重，测权重切换成本和 ASMR 听感。

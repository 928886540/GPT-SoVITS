# Real Voice GPT-SoVITS First Test

更新时间：2026-05-30

## 结论

已从旧 IndexTTS2 音色库中挑选真实人声音色，创建 GPT-SoVITS Voice Profile，并通过 Tavo adapter 跑通当前卡片流式 + 后台缓存。

这次测试比 `local_huihui` 更接近真实使用场景。`prompt_text` 仍是 ASR 初稿人工规整版，后续需要人工试听校对参考音频原文。

## 已创建 Profile

- `prompts/library/女声/高圆圆.json`
- `prompts/library/女声/温柔御姐.json`

参考音频：

| Profile | Audio | 时长 | 来源 |
| --- | --- | ---: | --- |
| `女声/高圆圆` | `prompts/library/女声/高圆圆.mp3` | `8.000s` | 旧 IndexTTS2 音色库 |
| `女声/温柔御姐` | `prompts/library/女声/温柔御姐.mp3` | `8.000s` | 旧 IndexTTS2 音色库 |

ASR 初稿：

| Profile | prompt_text |
| --- | --- |
| `女声/高圆圆` | `这个地方有关的历史和故事，以及在这条线路上你还能看到什么更多的风景。` |
| `女声/温柔御姐` | `这么想听啊，那你在求我一下。` |

## 高圆圆测试

请求：

```json
{
  "segments": [
    {"role": "旁白", "text": "这是高圆圆音色的 GPT SoVITS 本机测试。声音应该比系统测试音自然很多。"},
    {"role": "角色", "text": "如果这条能听，我们就继续挑更适合 ASMR 的参考音频。"}
  ],
  "voices": {
    "旁白": "女声/高圆圆",
    "角色": "女声/高圆圆",
    "default": "女声/高圆圆"
  },
  "streaming_mode": true
}
```

cache_key：`fa1e3818157173352faf99fdc20cc66fac5c6df1`

live 输出：

- Path: `reports/real_voice_gpt_sovits_first/gaoyuanyuan_live.wav`
- first byte: `1.128s`
- total: `3.705s`
- bytes: `806444`
- 注意：这是官方流式 WAV 抓包文件，RIFF 头长度字段是占位，普通播放器可能显示 `0s`，不适合作为人工试听文件。

后台缓存：

| 指标 | 值 |
| --- | ---: |
| sample_rate | `32000` |
| duration | `13.92s` |
| total_s | `4.18730270001106s` |
| RTF | `0.30081197557550715` |
| content-length | `890924` |

人工试听文件：

- Path: `reports/real_voice_gpt_sovits_first/gaoyuanyuan_cached_13s.wav`
- WAV duration: `13.920s`
- 这份来自 `outputs/cache/fa1e3818157173352faf99fdc20cc66fac5c6df1.wav`，是完整标准 WAV。

segments_meta：

| index | role | start_s | duration_s | voice |
| ---: | --- | ---: | ---: | --- |
| 0 | `旁白` | `0.0` | `8.04` | `女声/高圆圆` |
| 1 | `角色` | `8.04` | `5.88` | `女声/高圆圆` |

## 说明

- `声腔` 目录里的样本主要是旧 IndexTTS2 的 emotion/style reference，不是普通角色主音色；后续适合做风格控制路线，不适合作为第一批 GPT-SoVITS 角色 Profile 主线。
- 当前最值得继续筛的是 `女声/`、`角色扮演/`、`常用配音/`、`逗哥热门音色/` 里 5-10 秒的清晰中文样本。
- 没有精确逐字稿时，GPT-SoVITS 可以跑，但稳定性和音质判断会受影响。下一步要补人工校对或更可靠 ASR。

## 下一步

1. 试听 `reports/real_voice_gpt_sovits_first/gaoyuanyuan_cached_13s.wav`。
2. 如果可接受，继续批量为候选真实音色生成 profile。
3. 如果不满意，优先换 `女声/温柔御姐`、`女声/AD学姐`、`角色扮演/*` 这类更贴近目标的样本。

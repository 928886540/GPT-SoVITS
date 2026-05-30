# IndexTTS2 vLLM vs GPT-SoVITS v2 Comparison

更新时间：2026-05-30

## 直接打开

- 修正版对比图完整路径：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\comparison\indextts_vs_gptsovits_corrected.png`
- 覆盖版对比图完整路径：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\comparison\indextts_vs_gptsovits.png`
- 本报告完整路径：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\comparison\INDEXTTS_VS_GPTSOVITS.md`
- GPT-SoVITS 可试听完整 WAV：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\real_voice_gpt_sovits_first\gaoyuanyuan_cached_13s.wav`
- GPT-SoVITS 不建议试听的流式抓包：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\real_voice_gpt_sovits_first\gaoyuanyuan_live.wav`

`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\real_voice_gpt_sovits_first\gaoyuanyuan_live.wav` 是官方流式 WAV 抓包，RIFF 长度字段是占位，普通播放器可能显示 0 秒。人工试听请用 `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\real_voice_gpt_sovits_first\gaoyuanyuan_cached_13s.wav`。

## 纠错

上一版图的显存柱子画错了。我把 IndexTTS2 日志里的 `vLLM gpu_memory_utilization=0.18` / `2.16 GiB` 当成整服务常驻显存，这是错误口径。

正确口径应该是：

- IndexTTS2 vLLM：按用户实际运行观察，整服务常驻约 `10 GiB` 显存。
- GPT-SoVITS v2：本轮官方 v2 bench 后观测约 `3767 MiB`，即约 `3.68 GiB` 显存。

## 核心结论

这张图是工程性能对比，不是严格音质横评。两边测试文本、音色、模型结构都不同，但足够回答当前几个问题：内存/显存大概多少、RTF 大概多少、参数是多少、和旧 IndexTTS2 比处在什么位置。

| 指标 | IndexTTS2 vLLM | GPT-SoVITS v2 zero-shot |
| --- | ---: | ---: |
| RTF | `0.889` warm 平均 | `0.301` 高圆圆后台缓存 |
| 首段/首包 | `4.217s` warm 首 chunk 平均 | `1.128s` live first byte |
| 显存 | 约 `10 GiB` 常驻 | 约 `3.68 GiB` 观测占用 |
| CPU 内存 | 本次旧日志没有可靠完整记录 | 本次未单独快照进报告，后续要补进统一 bench |
| 质量/采样步数 | `diffusion_steps=12` | `sample_steps=32` |
| 采样参数 | `top_p=0.8`, `temperature=0.7`, `repetition_penalty=1.2` | `top_k=15`, `top_p=1.0`, `temperature=1.0` |
| 模式 | vLLM 整合包 + IndexTTS2 Tavo 链路 | 官方 GPT-SoVITS v2 + Tavo adapter |

当前判断：在 RTX 3060 12GB 上，GPT-SoVITS v2 zero-shot 这轮 RTF、首包和显存余量都比旧 IndexTTS2 vLLM 更适合继续做本地分发路线。IndexTTS2 常驻约 10G 会把 12GB 卡顶得很紧，后台再开 ComfyUI 或其它 GPU 程序就容易炸。

## GPT-SoVITS 数据来源

- 主报告完整路径：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\REAL_VOICE_GPTSOVITS_FIRST.md`
- 首次官方 v2 bench 完整路径：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\OFFICIAL_V2_FIRST_BENCH.md`
- 输出目录完整路径：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\real_voice_gpt_sovits_first`

高圆圆后台缓存结果：

| 指标 | 值 |
| --- | ---: |
| 音频时长 | `13.920s` |
| 生成总耗时 | `4.187s` |
| RTF | `0.3008` |
| sample_rate | `32000` |
| content-length | `890924` |

高圆圆当前卡片 live 流式结果：

| 指标 | 值 |
| --- | ---: |
| first byte | `1.128s` |
| total | `3.705s` |
| bytes | `806444` |

官方 v2 参数：

| 参数 | 值 |
| --- | --- |
| `batch_size` | `1` |
| `sample_steps` | `32` |
| `top_k` | `15` |
| `top_p` | `1.0` |
| `temperature` | `1.0` |
| `text_split_method` | `cut5` |
| `parallel_infer` | `true` |
| `speed_factor` | `1.0` |
| `fragment_interval` | `0.3` |
| `overlap_length` | `2` |
| `min_chunk_length` | `16` |

## IndexTTS2 数据来源

- 旧项目 README 完整路径：`D:\apiWorkSpace\index-tts2-vLLM\Leon_api\README.md`
- 旧项目 handoff 完整路径：`D:\apiWorkSpace\index-tts2-vLLM\HANDOFF.md`
- 本次采用的旧日志完整路径：`D:\apiWorkSpace\index-tts2-vLLM\Leon_api\dev_tools\restart_20260530_130500.log`

旧日志里前两条 RTF 是冷启动/异常慢数据：`16.3744`、`11.5750`，这次工程对比没有把它们算进 warm 平均。warm 后统计：

| 指标 | 值 |
| --- | ---: |
| warm RTF 数量 | `22` |
| warm RTF 平均 | `0.8892` |
| warm RTF 最低 | `0.8254` |
| warm RTF 最高 | `0.9775` |
| warm 首 chunk 数量 | `22` |
| warm 首 chunk 平均 | `4.217s` |
| warm 首 chunk 最低 | `2.160s` |
| warm 首 chunk 最高 | `6.660s` |

旧 IndexTTS2 参数和显存线索：

| 项 | 值 |
| --- | --- |
| 整服务显存口径 | 用户实际运行观察：常驻约 `10 GiB` |
| `vLLM gpu_memory_utilization` | `0.18`，这只是 vLLM/KV cache 目标，不代表整服务显存 |
| vLLM 目标显存 | `2.16 GiB`，不能用来画整服务常驻显存 |
| vLLM 权重加载 | `0.9233 GiB` |
| 启动空闲显存 | `10.96 / 12.0 GiB` |
| `diffusion_steps` | `12` |
| `s2mel_cfg_rate` | `0.70` |
| README 记录默认 `top_p` | `0.8` |
| README 记录默认 `temperature` | `0.7` |
| README 记录默认 `repetition_penalty` | `1.2` |

## 可比性限制

- GPT-SoVITS 当前是 zero-shot 参考音频模式，不是 few-shot 或完整角色模型。
- IndexTTS2 旧日志是 vLLM 整合包 warm 状态，且不一定是和 GPT-SoVITS 同一段文本。
- IndexTTS2 显存这里按用户运行观察记录为 `10 GiB`，不是从这份日志自动采样得到。
- GPT-SoVITS 的 CPU 内存没有在这次高圆圆报告里单独快照，后续统一 bench 应补上 Working Set / Private / Peak Working Set。
- 这张图可以指导工程路线，但最终音质要靠同文本、同参考素材、同角色目标的试听和盲测。

## 下一步建议

1. 用同一段中文短句、中文长段、日语短句、中日混合段重新跑 IndexTTS2 和 GPT-SoVITS。
2. GPT-SoVITS bench 脚本补进 CPU Working Set、Private、Peak Working Set、GPU memory before/after。
3. 下载并测试 v2ProPlus / v4 后，在同一张图里新增第三、第四组柱子。
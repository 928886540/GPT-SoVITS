# Genie Mika Benchmark

时间：2026-05-30

## 环境

- 引擎：Genie-TTS HTTP
- 角色：mika
- 模型类型：v2ProPlus
- 语言：Japanese
- ONNX Runtime providers：`AzureExecutionProvider`, `CPUExecutionProvider`
- 实际预期 provider：`CPUExecutionProvider`
- 采样率：32000 Hz
- 声道：mono
- sample width：16-bit

## Genie HTTP 暴露参数

Genie 当前 HTTP `/tts` 暴露：

- `character_name`
- `text`
- `split_sentence`
- `save_path`

当前 Genie HTTP 不暴露：

- `batch_size`
- `sample_steps`
- `top_k`
- `top_p`
- `temperature`
- `streaming_mode`

这些是官方 GPT-SoVITS API 侧才有的参数。

## 内存

- 服务 ready 后：Working Set 80.6 MiB，Private 416.8 MiB
- 加载 mika 后：Working Set 2709.0 MiB，Peak Working Set 4151.3 MiB，Private 3786.4 MiB
- 首次 TTS 后：Working Set 4324.6 MiB，Peak Working Set 5355.4 MiB，Private 5631.8 MiB
- 第 5 次 TTS 后：Working Set 4346.7 MiB，Peak Working Set 5355.4 MiB，Private 5632.9 MiB

结论：单个 v2ProPlus 角色 + 共享特征模型在本机约占 4.3 GiB working set，提交内存约 5.6 GiB。

## 5 次 HTTP TTS

| Run | First Chunk | Total | Audio Duration | RTF | Chunks |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 5.241s | 6.778s | 3.800s | 1.784 | 11 |
| 2 | 2.067s | 3.736s | 4.000s | 0.934 | 11 |
| 3 | 2.212s | 4.839s | 5.400s | 0.896 | 14 |
| 4 | 2.080s | 4.836s | 5.520s | 0.876 | 14 |
| 5 | 2.501s | 5.759s | 6.520s | 0.883 | 19 |

## 发现

- 第一轮慢，主要是首次加载 CN_HuBERT / Speaker Verification 等共享模型。
- Warm 后 RTF 稳定在 0.88-0.93 左右。
- 首包 warm 后约 2.1-2.5s。
- HTTP 返回 `content-type: audio/wav`，但原始流不是 RIFF/WAV，需要外层包装 WAV header 或改服务端输出。

## 输出文件

- `genie_http_mika_bench/run_1.wav`
- `genie_http_mika_bench/run_2.wav`
- `genie_http_mika_bench/run_3.wav`
- `genie_http_mika_bench/run_4.wav`
- `genie_http_mika_bench/run_5.wav`


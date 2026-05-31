# Next Session Handoff

更新时间：2026-05-30

## 用户目标

用户准备切到 `D:\apiWorkSpace\GPT-SoVITS\Leon_api` 并重启 Codex。新会话需要直接接着做 GPT-SoVITS 官方版验证。

核心目标不是公网服务，也不是作者托管 API。

目标是做一个本地可分发产品包，让社区用户拿到文件后在自己机器上运行：

- 本地模型
- 本地推理/训练工具
- 本地启动脚本
- 配置文件
- 可选 Tavo.js 或其他前端资源

## 目录

当前根目录：

`D:\apiWorkSpace\GPT-SoVITS`

关键目录：

- `Leon_api\`：本地验证和交接工作区
- `gpt-sovits-official\`：官方 GPT-SoVITS，主线验证对象
- `genie-tts\`：Genie-TTS，后期轻量推理候选

当前克隆状态：

- 官方 GPT-SoVITS：`gpt-sovits-official`，branch `main`，commit `08d627c`
- Genie-TTS：`genie-tts`，branch `master`，commit `0ad8b38`

## 当前决策

主线从 Genie 切回官方 GPT-SoVITS。

原因：

- 用户当前阶段是收集素材、训练声音、调效果。
- 官方 GPT-SoVITS 更适合训练、切片、标注、推理基准验证。
- Genie 更像轻量部署/本地运行时，应该等模型练满意后再考虑转换。

不要继续深挖 Genie，除非用户明确要求。

## 用户机器

已确认：

- Python：`3.10.11`
- GPU：RTX 3060 12GB
- 内存：32GB
- 当前方向：这套机器适合折腾 GPT-SoVITS 官方训练/推理，比 IndexTTS2 + vLLM 更合理。

注意：

- 之前 IndexTTS2 进程已被杀掉。
- 显存已从约 11.8GB 占用降到约 1GB 左右。

## Genie 已测结果

Genie 环境：

- 虚拟环境：`Leon_api\.venvs\genie`
- 环境脚本：`dev_tools\env_genie.ps1`
- 资源目录：`Leon_api\models\GenieData`
- 角色模型：`Leon_api\models\CharacterModels\v2ProPlus\mika`

Genie provider：

```text
['AzureExecutionProvider', 'CPUExecutionProvider']
```

源码中写死：

```python
self.providers = ["CPUExecutionProvider"]
```

所以当前 Genie 测试是 CPU ONNX 推理，不占 GPU 是正常的。

5 次本机 HTTP warm benchmark：

| Run | 首包 | 总耗时 | 音频时长 | RTF | chunks |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 5.241s | 6.778s | 3.800s | 1.784 | 11 |
| 2 | 2.067s | 3.736s | 4.000s | 0.934 | 11 |
| 3 | 2.212s | 4.839s | 5.400s | 0.896 | 14 |
| 4 | 2.080s | 4.836s | 5.520s | 0.876 | 14 |
| 5 | 2.501s | 5.759s | 6.520s | 0.883 | 19 |

内存：

- 服务 ready 后：Working Set 80.6 MiB，Private 416.8 MiB
- 加载 mika 后：Working Set 2709.0 MiB，Peak Working Set 4151.3 MiB，Private 3786.4 MiB
- 首次 TTS 后：Working Set 4324.6 MiB，Peak Working Set 5355.4 MiB，Private 5631.8 MiB
- 第 5 次 TTS 后：Working Set 4346.7 MiB，Peak Working Set 5355.4 MiB，Private 5632.9 MiB

Genie 重要坑：

- HTTP 返回 `content-type: audio/wav`
- 但实际原始流不是 RIFF/WAV，是 raw PCM
- 当前脚本手动包装成 WAV

报告：

- `reports\GENIE_MIKA_BENCH.md`
- `reports\genie_http_mika_bench\result.json`

## 已有脚本

环境脚本：

- `dev_tools\env_genie.ps1`
- `dev_tools\env_official.ps1`

Genie 测试脚本：

- `dev_tools\test_genie_predefined.py`
- `dev_tools\test_genie_http_mika.py`
- `dev_tools\bench_genie_http_mika.py`

## 官方 GPT-SoVITS 当前状态

已做：

- 克隆官方仓库。
- 阅读 README 和 `api_v2.py`。
- `api_v2.py` 语法检查通过。
- `Leon_api/.venvs/official` 已创建并安装官方依赖。
- 官方环境当前关键版本：
  - `torch 2.7.1+cu126`
  - `torchaudio 2.7.1+cu126`
  - `numpy 1.26.4`
  - `transformers 4.50.0`
  - `fastapi 0.136.3`
  - `pydantic 2.10.6`
- 最小 v2 推理模型已下载到 `gpt-sovits-official/GPT_SoVITS/pretrained_models`。
- 中文 `G2PWModel` 已放到 `gpt-sovits-official/GPT_SoVITS/text/G2PWModel`。
- 官方 `api_v2.py` 已能加载 v2 模型并启动在 `http://127.0.0.1:9881/docs`。
- 本机 Tavo adapter 骨架已启动在 `http://127.0.0.1:9880/health`。

未做：

- 没有跑官方推理。
- 没有做训练实验。
- 没有下载 v2ProPlus / v4 / BigVGAN 等额外模型。
- adapter 的 `/tts_dialogue_stream_job` 还没有接到真实 GPT-SoVITS 推理，只是接口契约骨架。

官方 API 参数需要重点打印：

- `batch_size`
- `sample_steps`
- `top_k`
- `top_p`
- `temperature`
- `text_split_method`
- `streaming_mode`
- `parallel_infer`
- `speed_factor`
- `fragment_interval`
- `overlap_length`
- `min_chunk_length`

用户明确要求参数必须打印清楚。

## 下一步建议

最新进展：

- v2 / v2ProPlus / v4 三版本同文本对比已完成，报告在 `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\REPORT.md`。
- V4 参数扫描已完成，报告在 `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\REPORT.md`。旧慢结果来自 `batch_size=1` / `sample_steps=32`；长文本下 `batch_size=8` / `sample_steps=8` / `parallel_infer=true` 的 RTF 已降到 `0.191`。
- AD学姐 canonical zero-shot profile 是：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\400个火爆音色\AD学姐.json`。不要恢复或新增 `女声\AD学姐*.json` 重复别名。
- AD学姐当前用户听写 `prompt_text` 是：`刀不锋利马太瘦，你拿什么跟我斗？`。之前的“你好，我是AD学姐...”是介绍文案/错逐字稿，会导致 GPT-SoVITS 参考音频对齐错误和复读污染。
- AD学姐 V4 3 组参数测试已完成，报告在 `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\REPORT.md`。其中 `batch_size=8` / `sample_steps=8` 三次平均 RTF `0.163`。
- Whisper ASR 两套入口已可用：
  - 用户手动 GUI：`D:\software\WhisperDesktop\WhisperDesktop.exe`
  - Codex 自动 CLI：`D:\software\whisper-codex\transcribe.cmd`
  - 共用模型：`D:\software\WhisperDesktop\models\ggml-medium.bin`
  - 示例：`D:\software\whisper-codex\transcribe.cmd "D:\path\audio.wav"`，或指定输出目录 `D:\software\whisper-codex\transcribe.cmd "D:\path\audio.mp3" "D:\path\out"`
  - 直接支持 `wav` / `mp3` / `flac` / `ogg`，已验证 RTX 3060 CUDA 正常启用并输出 txt。
  - 来源：官方 whisper.cpp v1.8.5：`https://github.com/ggml-org/whisper.cpp/releases/tag/v1.8.5`
  - Codex 本机记忆：`C:\Users\Administrator\.codex\memories\whisper-codex.md`
- v2ProPlus 和 V4 都可以继续做：v2ProPlus 做稳定默认，V4 做情绪/抑扬顿挫候选。短期单 API 切权重，产品化可考虑 v2ProPlus/V4 双端口。
- P2 句级声腔已接入第一版：前端/LLM 每段传 `{role,text,style,style_alpha}`，adapter 保留 `style` 并映射到 `prompts/library/声腔` 下的 aux reference。烟测报告在 `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\p2_sentence_style_smoke_20260531\REPORT.md`。
- 手机/局域网入口：`http://192.168.8.100:9880/static/tavo.js`，P2 直接测试页：`http://192.168.8.100:9880/p2_test`。
- LAN 启动脚本：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\dev_tools\start_adapter_lan.ps1`。当前 adapter 已加 CORS，Tavo/WebView 跨来源 fetch `/voices`、`/tts_dialogue_stream_job` 应不再被浏览器拦截。
- 注意：音色模型不负责自动分辨场景；自动分辨来自 LLM 拆句输出的 `style`。训练模型负责角色声线身份和稳定性。
- `女声/风韵少妇` 已补 GPT-SoVITS JSON Profile。后续如果 Tavo 选中其他只有音频、没有 JSON 的声音，必须先补 `prompt_text`，不能直接作为 GPT-SoVITS 生成音色。

1. 进入官方 GPT-SoVITS 目录：

```powershell
cd D:\apiWorkSpace\GPT-SoVITS\gpt-sovits-official
```

2. 先加载本地环境脚本：

```powershell
. ..\Leon_api\dev_tools\env_official.ps1
```

3. 如果 `9881` 没在运行，启动官方 API：

```powershell
D:\apiWorkSpace\GPT-SoVITS\Leon_api\.venvs\official\Scripts\python.exe api_v2.py -a 127.0.0.1 -p 9881 -c GPT_SoVITS/configs/tts_infer.yaml
```

工作目录必须是：

```powershell
D:\apiWorkSpace\GPT-SoVITS\gpt-sovits-official
```

4. 如果继续对比 v2ProPlus 与 V4，优先复用 `D:\apiWorkSpace\GPT-SoVITS\Leon_api\dev_tools\bench_gptsovits_v4_params.py` 或扩展成双版本参数脚本，记录参数、显存、首包、RTF 和输出路径。

优先任务：

- 不要先训练。
- 优先人工试听 V4 `steps=8` 与 `steps=16` 是否保留用户想要的抑扬顿挫。
- 同步保留 v2ProPlus，不要把 v4 和 v2ProPlus 做成互斥路线。
- 确认哪些音色默认走 v2ProPlus，哪些音色适合走 V4。
- 每次测试都记录：
  - 参数
  - 显存
  - CPU 内存
  - RTF
  - 首包
  - 输出音频路径
  - 主观音质由用户试听
- 继续 P2 时优先做两件事：
  - 用手机打开 `http://192.168.8.100:9880/p2_test` 验证 WebUI 能显示并能请求 `/voices`。
  - 优化真正逐句 live streaming。当前为保真优先，缓存未完成时 GET `/tts_dialogue_stream_job/{cache_key}` 会同步分句生成完整 WAV 后返回，避免丢多音色和句级声腔。

4. ASMR 训练验证后置。

训练前先准备：

- 干净耳语素材
- 单人说话
- 20-40 分钟优先
- 轻度降噪
- 切片
- 标注

## 重要原则

- 不要把目标理解成公网服务。
- 不要优先做 API 托管。
- 不要把 Tavo.js 当唯一目标。
- 不要继续陷在 IndexTTS2 迁移成本里。
- 本轮以“官方 GPT-SoVITS 能否训练出高质量 ASMR 音色”为主线。
- Genie 只作为后续本地轻量运行时候选。

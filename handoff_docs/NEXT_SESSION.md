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

4. 先跑官方 v2 推理请求，记录参数、显存、首包、RTF 和输出路径。

优先任务：

- 不要先训练。
- 先用官方 v2 API 跑通推理。
- 再下载 v2ProPlus / v4 额外模型到 D 盘。
- 确认 v4 与 v2ProPlus 哪个更适合作为 ASMR 主线。
- 每次测试都记录：
  - 参数
  - 显存
  - CPU 内存
  - RTF
  - 首包
  - 输出音频路径
  - 主观音质由用户试听

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

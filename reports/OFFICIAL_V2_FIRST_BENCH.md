# Official GPT-SoVITS v2 First Bench

更新时间：2026-05-30

## 结论

官方 GPT-SoVITS `api_v2.py` 已在本机跑通 `/tts` 推理，使用默认 v2 权重、CUDA、非流式 WAV 输出。

这次只验证链路和性能，不评价最终音色质量。参考音频是 Windows SAPI 本机生成的短中文音频，逐字稿可控，但不是目标 ASMR 素材。

## 服务

- Adapter: `http://127.0.0.1:9880/health`
- Official API: `http://127.0.0.1:9881/tts`
- Official API docs: `http://127.0.0.1:9881/docs`

官方启动命令：

```powershell
D:\apiWorkSpace\GPT-SoVITS\Leon_api\.venvs\official\Scripts\python.exe api_v2.py -a 127.0.0.1 -p 9881 -c GPT_SoVITS/configs/tts_infer.yaml
```

工作目录：

```powershell
D:\apiWorkSpace\GPT-SoVITS\gpt-sovits-official
```

## 模型和补充资源

- GPT-SoVITS version: `v2`
- GPT weights: `GPT_SoVITS/pretrained_models/gsv-v2final-pretrained/s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt`
- SoVITS weights: `GPT_SoVITS/pretrained_models/gsv-v2final-pretrained/s2G2333k.pth`
- BERT: `GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large`
- CNHuBERT: `GPT_SoVITS/pretrained_models/chinese-hubert-base`
- fast-langdetect full model: `GPT_SoVITS/pretrained_models/fast_langdetect/lid.176.bin`
- NLTK data: `Leon_api/.venvs/official/nltk_data`

首次请求前补了两个缺失资源：

- `fast_langdetect/lid.176.bin`，否则官方接口返回 `Cache directory not found`。
- `averaged_perceptron_tagger_eng`、`averaged_perceptron_tagger`、`cmudict`，否则英文 G2P/语言处理链路触发 NLTK 缺资源错误。

## Payload

Payload 文件：`samples/official_v2_tts_payload.local.json`

关键参数：

| 参数 | 值 |
| --- | --- |
| `batch_size` | `1` |
| `sample_steps` | `32` |
| `top_k` | `15` |
| `top_p` | `1.0` |
| `temperature` | `1.0` |
| `text_split_method` | `cut5` |
| `streaming_mode` | `false` |
| `parallel_infer` | `true` |
| `speed_factor` | `1.0` |
| `fragment_interval` | `0.3` |
| `overlap_length` | `2` |
| `min_chunk_length` | `16` |

参考音频：

- Path: `prompts/generated_reference/huihui_ref.wav`
- Prompt text: `这是本机生成的参考音频，用于验证 GPT SoVITS 官方接口。`
- 该 wav 被 `.gitignore` 排除，不进仓库。

## 结果

命令：

```powershell
. .\dev_tools\env_official.ps1
python .\dev_tools\bench_official_api_v2.py --payload .\samples\official_v2_tts_payload.local.json --out .\reports\official_v2_first\out.wav
```

结果：

| 指标 | 值 |
| --- | ---: |
| first byte | `4.585s` |
| total | `4.586s` |
| bytes | `682284` |
| audio duration | `10.660s` |
| RTF | `0.430` |

GPU 观测：

| 时间点 | 显存 | GPU 利用率 |
| --- | ---: | ---: |
| bench 前 | `2908 MiB / 12288 MiB` | `3%` |
| bench 后 | `3746 MiB / 12288 MiB` | `40%` |

输出音频：`reports/official_v2_first/out.wav`，该 wav 被 `.gitignore` 排除。

## 下一步

1. 跑 `streaming_mode=true`，确认首包是否明显低于完整生成时间。
2. 用真实人声参考音频和逐字稿重测，开始评价音质。
3. 下载 v2ProPlus / v4 权重，按同一脚本对比 RTF、显存、首包和听感。
4. 把 `gsv_tavo_adapter.py` 的 `/tts_dialogue_stream_job` 接到官方 `/tts`，先走非流式生成 + 本地缓存，再加流式播放。

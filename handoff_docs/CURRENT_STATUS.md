# Current Status

更新时间：2026-05-30

## 已完成

- 创建验证根目录：`D:\apiWorkSpace\GPT-SoVITS`
- 克隆官方 GPT-SoVITS：
  - 路径：`gpt-sovits-official`
  - 分支：`main`
  - 当前提交：`08d627c`
- 克隆 Genie-TTS：
  - 路径：`genie-tts`
  - 分支：`master`
  - 当前提交：`0ad8b38`
- 创建本地协作区：`Leon_api`
- 迁移旧 IndexTTS2 的 Tavo 前端种子到 `Leon_api/static/tavo.js`
- 创建 GPT-SoVITS 本机 Tavo adapter 骨架：`Leon_api/gsv_tavo_adapter.py`
- 创建 adapter 辅助模块：`Leon_api/gsv_adapter/`
- 写入 image2 生图提示词：`handoff_docs/IMAGE2_GPTSOVITS_TAVO_ARCHITECTURE_PROMPT.txt`
- 创建官方验证虚拟环境：`Leon_api/.venvs/official`
- 安装官方 GPT-SoVITS Python 依赖与 CUDA PyTorch：
  - `torch 2.7.1+cu126`
  - `torchaudio 2.7.1+cu126`
  - CUDA 可用：`torch.cuda.is_available() == True`
- 下载最小 v2 推理模型到官方目录：
  - `GPT_SoVITS/pretrained_models/chinese-hubert-base/*`
  - `GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large/*`
  - `GPT_SoVITS/pretrained_models/gsv-v2final-pretrained/s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt`
  - `GPT_SoVITS/pretrained_models/gsv-v2final-pretrained/s2G2333k.pth`
- 下载并解压中文 G2PWModel：`gpt-sovits-official/GPT_SoVITS/text/G2PWModel`
- 官方 `api_v2.py` 已成功加载 v2 模型并启动：`http://127.0.0.1:9881/docs`
- 本机 Tavo adapter 已成功启动并通过烟测：`http://127.0.0.1:9880/health`
- 官方 v2 `/tts` 已完成非流式和流式基准验证：`reports/OFFICIAL_V2_FIRST_BENCH.md`
- 本机 Tavo adapter 已接到官方 GPT-SoVITS 非流式 `/tts`、后台单 worker FIFO job 队列，并完成当前卡片官方流式直通：`reports/TAVO_ADAPTER_OFFICIAL_BINDING.md`
- 已从旧 IndexTTS2 项目复制本地音色库到 `prompts/library`：1115 个文件，约 710.64MB，其中 1109 个音频文件。
- 已创建第一批真实人声 GPT-SoVITS Voice Profile：
  - `prompts/library/女声/高圆圆.json`
  - `prompts/library/女声/温柔御姐.json`
- 已完成 `女声/高圆圆` 当前卡片流式 + 后台缓存测试：`reports/REAL_VOICE_GPTSOVITS_FIRST.md`
- 新增本机链路测试 Voice Profile：`prompts/library/local_huihui.json`
- 已按用户要求通过代理 `127.0.0.1:7897` 下载 v2ProPlus / v4 推理权重到官方目录：
  - `D:\apiWorkSpace\GPT-SoVITS\gpt-sovits-official\GPT_SoVITS\pretrained_models\s1v3.ckpt`
  - `D:\apiWorkSpace\GPT-SoVITS\gpt-sovits-official\GPT_SoVITS\pretrained_models\v2Pro\s2Gv2ProPlus.pth`
  - `D:\apiWorkSpace\GPT-SoVITS\gpt-sovits-official\GPT_SoVITS\pretrained_models\gsv-v4-pretrained\s2Gv4.pth`
  - `D:\apiWorkSpace\GPT-SoVITS\gpt-sovits-official\GPT_SoVITS\pretrained_models\sv\pretrained_eres2netv2w24s4ep4.ckpt`
  - `D:\apiWorkSpace\GPT-SoVITS\gpt-sovits-official\GPT_SoVITS\pretrained_models\gsv-v4-pretrained\vocoder.pth`
- 已完成 v2 / v2ProPlus / v4 各 3 次同文本 zero-shot 对比：
  - 报告：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\REPORT.md`
  - 说明：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\NOTES.md`
  - 原始数据：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\result.json`
  - 结论：v2ProPlus 是稳态候选；v4 在默认 `batch_size=1` / `sample_steps=32` 下慢，但不能按这组参数直接弃用。
- 已完成 V4 参数扫描：
  - 脚本：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\dev_tools\bench_gptsovits_v4_params.py`
  - 报告：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\REPORT.md`
  - 原始数据：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\result.json`
  - 关键结果：长文本 `batch_size=8` / `sample_steps=8` / `parallel_infer=true` 的 RTF 为 `0.191`，明显快于旧基线 `batch_size=1` / `sample_steps=32` 的 `0.951`。
  - 判断：V4 应保留为候选，尤其适合用户偏好的抑扬顿挫和情绪轮廓；`sample_steps=4` 最快但需要人工试听确认质量。
- 已创建并测试热门音色 AD学姐：
  - Profile：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\AD学姐.json`
  - 参考音频：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\prompts\library\女声\AD学姐.wav`
  - 报告：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\REPORT.md`
  - 原始数据：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\result.json`
  - 关键结果：AD学姐 `batch_size=8` / `sample_steps=8` / `parallel_infer=true` 3 次平均首包 `2.480s`，RTF `0.163`，GPU after 约 `4744 MiB`。
  - 注意：AD学姐 `prompt_text` 是 Whisper ASR 初稿后人工规整，后续必须人工试听校对。
- 已完成 P2 句级声腔接入第一版：
  - Adapter：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\gsv_tavo_adapter.py`
  - P2 测试页：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\static\gsv_p2_test.html`
  - LAN 启动脚本：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\dev_tools\start_adapter_lan.ps1`
  - LAN 测试地址：`http://192.168.8.100:9880/p2_test`
  - 报告：`D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\p2_sentence_style_smoke_20260531\REPORT.md`
  - 已验证 `role` 选择主音色，`style` 逐句映射到 `aux_ref_audio_paths`，例如 `whisper_soft -> 声腔/whisper_soft.wav`、`喘息-AD学姐 -> 声腔/喘息-AD学姐.mp3`。
  - 已加 CORS 与旧前端兼容接口：`/voice_preview`、`/tts_stream_job`、`/server_log/tail`。

## 当前判断

本轮验证不以旧 IndexTTS2 迁移成本为约束。目标是确认 GPT-SoVITS 生态是否能提供更专业、更省资源、更适合本地分发的 TTS 产品底座。

用户明确的交付定位：

- 不提供公网服务器。
- 不托管统一 API。
- 产品会以本地文件/整合包形式一次性发给社区用户。
- Tavo.js 只是交付物的一部分。
- 后端 API 只考虑本机使用，不作为对外服务承诺。

核心问题：

- 多音色是否能以角色级配置稳定实现。
- 流式播放是否是真正低首包延迟，而不是完整生成后再分块下载。
- 中文和日语混合场景是否稳定。
- 12GB 显存机器上是否有足够运行余量。
- 缓存、模型、临时文件是否能明确落在 D 盘。

最新决策：

- 主线切回官方 GPT-SoVITS。
- Genie 已验证为可用的 CPU ONNX 本地推理候选，但不适合作为当前训练主线。
- 用户当前更需要训练和打磨 ASMR 音色，所以先测官方 GPT-SoVITS v4 / v2ProPlus。
- V4 不再按旧默认参数判死刑。当前建议并行非流式先试 `batch_size=8` / `sample_steps=8`，同时保留 `batch_size=4` / `sample_steps=16` 做质量对照。
- v2ProPlus 和 V4 可以并行作为产品候选：v2ProPlus 做稳定默认，V4 做情绪/抑扬顿挫候选。短期用单官方 API 切权重验证；产品化如果频繁混用，建议拆成两个本机端口，避免反复切权重。双端口空闲 CPU 应该很低，但显存会常驻，12GB 机器要限制并发生成。
- 后续测试必须打印参数、内存、显存、RTF、首包和输出文件路径。
- Tavo 迁移采用“旧前端体验 + 新 GPT-SoVITS adapter”的路线：先保留旧接口契约，再把内部接到官方 GPT-SoVITS。
- P2 的正确玩法是“多音色 + 句级声腔”：音色模型不自动判断场景，LLM/前端每句输出 `role + style`，adapter 再把 `role` 映射为主音色，把 `style` 映射为声腔 aux。

## 当前运行状态

- `127.0.0.1:9880` / `192.168.8.100:9880`：`Leon_api/gsv_tavo_adapter.py`，已提供 Tavo 前端、voices/profile/cache/parse_text/job、P2 测试页，并已接官方 GPT-SoVITS 非流式推理、后台队列、WAV 拼接、本地缓存、多音色与句级声腔 aux。
- `127.0.0.1:9881`：官方 `gpt-sovits-official/api_v2.py`，当前会话最后切到 v4 权重，可进入 Swagger 文档。
- 运行日志：
  - `outputs/logs/gsv_tavo_adapter.out.log`
  - `outputs/logs/gsv_tavo_adapter.err.log`
  - `outputs/logs/official_api_v2_9881.out.log`
  - `outputs/logs/official_api_v2_9881.err.log`

## 下一步

1. 阅读 `handoff_docs/NEXT_SESSION.md`。
2. 进入 `..\gpt-sovits-official`。
3. 加载 `..\Leon_api\dev_tools\env_official.ps1`。
4. 官方 GPT-SoVITS 的最小 v2 服务已能启动并完成推理基准。
5. Tavo adapter 已能通过官方非流式 `/tts` 生成多段 dialogue 缓存。
6. 下一步试听 `reports/real_voice_gpt_sovits_first/gaoyuanyuan_cached_13s.wav`，并校对参考音频逐字稿。不要用 `gaoyuanyuan_live.wav` 做人工试听；它是流式抓包，普通播放器会显示 0 秒。
7. 继续从 `女声/`、`角色扮演/`、`常用配音/`、`逗哥热门音色/` 批量筛 5-10 秒清晰中文样本生成 Profile。
8. v2 / v2ProPlus / v4 横向对比已完成；下一步人工试听：
   - `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\version_compare_20260531\**\run_*.wav`
   - `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_param_sweep_20260531\**\run_*.wav`
   - `D:\apiWorkSpace\GPT-SoVITS\Leon_api\reports\v4_ad_xuejie_20260531\**\run_*.wav`
   优先判断 V4 `steps=8` 是否保留了用户想要的抑扬顿挫，以及 `steps=4` 是否有质量损失。
9. 先继续推理和产品链路验证，不要先训练。
10. 建立统一测试样本：
   - 中文短句
   - 中文长段
   - 日语短句
   - 中日混合段
   - 多角色对话段
11. 建立统一指标记录表。
12. P2 下一步优化真逐句 live streaming：当前 GET `/tts_dialogue_stream_job/{cache_key}` 为保证多音色/句级声腔正确，会同步生成分句缓存后返回完整 WAV；不是最终低首包流式。

## 注意事项

- 暂时不要在两个上游源码目录里做本地补丁。
- 暂时不要安装到系统 Python。
- 暂时不要把模型缓存放到 C 盘默认目录。
- 后续启动本机组件前，先固定缓存环境变量和工作目录。

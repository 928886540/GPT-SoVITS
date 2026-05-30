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
- 本机 Tavo adapter 已接到官方 GPT-SoVITS 非流式 `/tts`，并完成后台单 worker FIFO job 队列：`reports/TAVO_ADAPTER_OFFICIAL_BINDING.md`
- 新增本机链路测试 Voice Profile：`prompts/library/local_huihui.json`

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
- 后续测试必须打印参数、内存、显存、RTF、首包和输出文件路径。
- Tavo 迁移采用“旧前端体验 + 新 GPT-SoVITS adapter”的路线：先保留旧接口契约，再把内部接到官方 GPT-SoVITS。

## 当前运行状态

- `127.0.0.1:9880`：`Leon_api/gsv_tavo_adapter.py`，已提供 Tavo 前端、voices/profile/cache/parse_text/job，并已接官方 GPT-SoVITS 非流式推理、后台队列、WAV 拼接和本地缓存。
- `127.0.0.1:9881`：官方 `gpt-sovits-official/api_v2.py`，已加载 v2 默认权重，可进入 Swagger 文档。
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
6. 下一步接当前卡片真流式播放。
7. 下载 v2ProPlus / v4 额外模型，用于 ASMR 路线对比。
8. 先继续推理和产品链路验证，不要先训练。
7. 建立统一测试样本：
   - 中文短句
   - 中文长段
   - 日语短句
   - 中日混合段
   - 多角色对话段
8. 建立统一指标记录表。

## 注意事项

- 暂时不要在两个上游源码目录里做本地补丁。
- 暂时不要安装到系统 Python。
- 暂时不要把模型缓存放到 C 盘默认目录。
- 后续启动本机组件前，先固定缓存环境变量和工作目录。

# Agent State

更新时间：2026-06-01

## 当前目标

把 GPT-SoVITS 官方能力整理成本地可分发产品链路：本地模型、本地 adapter、本地 Tavo 注入脚本、本地训练/验证工具和可复现报告。

当前主线是官方 GPT-SoVITS。Genie-TTS 已验证为后续轻量运行时候选，但现在不继续深挖。

## 当前运行链路

- `gsv_tavo_adapter.py` 提供本机 FastAPI adapter，默认端口 `9880`。
- 官方 GPT-SoVITS `api_v2.py` 作为推理后端，当前验证端口 `9881`。
- Tavo 通过 `static/tavo.js` 加载运行时，真实验证以 Tavo app / 雷电模拟器为准。
- `outputs/cache` 是真实 runtime 缓存目录，不放 Codex 手工 benchmark 音频。
- Whisper CLI 可用于生成后转写验证，但最终仍要人工试听。

## 最近真实 Tavo 进度

- 2026-06-01 已拿到雷电模拟器真实截图和 UI 树：`dev_tools/tavo_debug/tavo_screen.png`、`dev_tools/tavo_debug/tavo_window.xml`。
- 当前抓到的页面仍在正则/加载器链路，界面里能看到 `正则`、`应用` 和 `GPTSoVITS_TTS_Loader`，说明这轮是在真实 Tavo 里检查注入规则，而不是 mock 页面。
- 最新注入规则版本是 `static/tavo_regex_gptsovits_loader.json` 里的 `v=2028881907`，loader 版本 `20260601-lan-webview-layer-v17`。
- 2026-06-01 用户真实测试暴露 5 个问题：移动 WebView 流式先走 `<audio>` 失败、保存到本机缓存后 seek 仍重拉、补角色后 LLM 拆段未复用、`女声/风韵少妇` 小声且长对白吞字、`极致/离线` 文案误导。
- 已做代码修复：移动端多音色 live 直接 Web Audio；已保存音频首次解码后复用 `AudioBuffer`；LLM 复用 fingerprint 去掉角色映射；长 segment 合成前按标点拆短；`女声/风韵少妇` 增加 `post_gain_db=9.0`；档位文案改为 `极限质量`。
- 证据：最新 cache `outputs/cache/c23aca2bd05f294a1a0bf8152395886d9e4bbcc9.wav/json`，Whisper 输出在 `reports/whisper_cache_c23aca2bd05f294a1a0bf8152395886d9e4bbcc9_20260601/`，确认原第 20 段吞掉 `白产品经理，你今晚在公司`。
- 2026-06-01 用户 iPhone 14 Pro 真机继续暴露弹层问题：设置页在 iOS Tavo WebView 里显示成一条长窄面板；点设置页边缘/右上/空白会误关闭；从设置页进 `选择音色` 后点 picker `X` 应该回上一层设置页，但当前直接回播放器；点 `日日新` 等分类 tab 附近也可能误触关闭。已记录为 `BUG-004`、`BUG-014`、`BUG-015`，回归清单见 `docs/REGRESSION.md` 的 iPhone 真机弹层回归。
- 当前 adapter 局域网日志在 `outputs/logs/gsv_tavo_adapter_lan.out.log`，后续要继续对照真实 Tavo 的请求顺序、播放器表现和缓存命中情况。
- 重启后先回到真实聊天页，再核对消息卡片、播放器、音色选择器和保存/播放链路，不要只看静态截图。

## 当前工作区状态

工作区已有未提交代码改动，后续接手不要随手回退：

- `dev_tools/start_adapter_lan.ps1`
- `gsv_tavo_adapter.py`
- `static/tavo.js`
- `static/tavo.runtime.js`
- `static/tavo_regex_gptsovits_loader.json`
- `README.md`
- `AGENTS.md`

这些改动主要围绕 Tavo 真实端问题：LLM adapter 配置、音色选择器试听/应用分离、保存音频播放 fallback、缓存状态确认、注入版本更新和 README 拆分。

## 真实端原则

- mock 页面只做语法和基础接口烟测，不能替代真实 Tavo 结论。
- 多音色必须在真实 Tavo 消息里点消息/音符触发，不能用单音色片段冒充验证。
- 每次真实端验证记录：Tavo 角色映射、注入脚本 `v=`、文本、音色 profile、模型版本、`batch_size`、`sample_steps`、是否多音色、RTF、缓存 key、音频路径、Whisper 输出和人工听感。

## 私有配置

- LLM key：`local_private/gsv_tavo_llm.ps1`
- 生图 key：`local_private/image_api_tizenry.ps1`
- 这些文件只在本机存在，不提交。
- Tavo 本地客户端可以显示 endpoint/model/key；约束是不要把真实 key 写进 git。

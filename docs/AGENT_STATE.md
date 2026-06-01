# Agent State

更新时间：2026-06-01 23:20 +08:00

## 当前目标

把 GPT-SoVITS 官方能力整理成本地可分发产品链路：本地模型、本地 adapter、本地 Tavo 注入脚本、本地训练/验证工具和可复现报告。

当前主线是官方 GPT-SoVITS。Genie-TTS 已验证为后续轻量运行时候选，但现在不继续深挖。

## 重开 Codex 交接快照（2026-06-01）

触发原因：用户准备重开 Codex，会话上下文需要落盘。当前不要继续扩大拆分，先让新会话稳定接手。

## 低上下文追加记录（2026-06-01 23:20 +08:00）

触发原因：用户提示“上下文不够了”，按本仓库规则停止继续功能开发，先把当前 BUG-018 修复现场落盘。

当前重点：`BUG-018`（多音色 live stream 只解析 WAV 头后中断无声）。这条不是前端 Web Audio 首路径问题；前端已经解析 WAV header 并启动时钟，失败点更像 adapter 读取官方 GPT-SoVITS 上游流时中断。

已做代码改动（未 commit）：

- `gsv_tavo_adapter.py` 引入 `IncompleteRead` / `RemoteDisconnected`，增强官方 API stream 读取异常识别。
- `/tts_dialogue_job_status/{cache_key}` 对当前内存里的 `failed` job 保持 `state=failed`，不再把失败中的 job 折叠成 `missing`。
- `_stream_dialogue_to_cache()` 增加 `fail_stream()`：写入 `state=failed`、保留错误、已完成/部分 `segments_meta`、`sample_rate`、部分字节数和耗时，并打印 `[gsv_adapter] dialogue_stream_failed ...`。
- 单个 segment 调 `_stream_official_tts()` 抛异常时，现在会记录失败 job 并结束 generator；不会把未完成的 partial cache 当 `done` 保存。
- `_stream_official_tts()` 对 `HTTPError`、`URLError`、`IncompleteRead`、`RemoteDisconnected`、`TimeoutError`、`ConnectionError`、`OSError` 统一包装出更明确的 RuntimeError，错误里包含已读取 bytes/chunks。

已验证：

- `python -m py_compile gsv_tavo_adapter.py` 通过。
- `git diff --check` exit 0；只有 Git 的 LF/CRLF 工作区提示。
- 已用 `dev_tools/start_adapter_lan.ps1` 重启 adapter；当前 `/health` 返回 `{"status":"ok","engine":"gptsovits-adapter"}`。
- 当前 lan adapter 日志显示 Uvicorn PID `16812` 正在 `0.0.0.0:9880`。
- 旧用户 cache key `eda219ac41c210002f57480cab469d26fc163d6f` 在重启后查 `/tts_dialogue_job_status/...` 返回 `state=missing` / `cache not found or job expired`，这是预期的：重启清了内存 `JOBS`，旧 key 不能用来验证新 `failed` 状态。

未完成 / 下一步：

1. 用真实 Tavo/LDPlayer 在重启后的 adapter 上重新触发同类多音色 live stream，拿新 cache key。
2. 如果官方 GPT-SoVITS 上游仍中断，确认新 key 的 `/tts_dialogue_job_status/<key>` 返回 `state=failed` 并带具体错误，而不是 `missing` 或纯前端 `network error`。
3. 同时看 `outputs/logs/gsv_tavo_adapter_lan.out.log` 是否出现 `[gsv_adapter] dialogue_stream_failed`，错误里应包含 segment index、role、text preview 和 `official API stream ... after <bytes>/<chunks>`。
4. 再追根因：官方 `api_v2.py` 断连、长耗时/并发导致连接关闭、还是某个特定 voice/长文本 segment 触发上游失败。
5. 真实回归前不要 commit，也不要继续机械切 runtime 文件。

当前代码状态：

- 还原点：`bec4cbd 整理 docs 文档体系并固化 Tavo 真实端修复快照` 已推送到 `origin/master`。
- 当前有未提交改动，主要是 runtime 拆分、静态路由、docs/AGENTS/README 更新，未 commit。
- `static/tavo.js` 保持唯一 Tavo 正则入口，懒加载卡片仍是第一屏。
- `static/tavo.runtime.js` 是小 loader，点击懒加载后按顺序 fetch 21 个 `static/tavo.runtime.parts/*.js` 并拼接执行。
- `static/tavo.ui.skin.default.css` 是默认皮肤，runtime 启动后才加载。
- 当前版本号：正则 `v=2028881910`，loader `20260601-lan-webview-layer-v20`，parts query `20260601-split-runtime-v4`。

当前未提交范围（`git status --short`）：

- 修改：`AGENTS.md`、`README.md`、`docs/AGENT_STATE.md`、`docs/ARCHITECTURE.md`、`docs/BUGS.md`、`docs/DECISIONS.md`、`docs/REGRESSION.md`、`docs/TODO.md`
- 修改：`gsv_tavo_adapter.py`
- 修改：`static/tavo.js`、`static/tavo.runtime.js`、`static/tavo_regex_gptsovits_loader.json`
- 新增：`static/tavo.runtime.parts/`
- 新增：`static/tavo.ui.skin.default.css`

已验证通过：

- `node --check static\tavo.js`
- `node --check static\tavo.runtime.js`
- 21 个 runtime parts 读取拼接后 `new Function(parts)` 语法通过。
- `python -m py_compile gsv_tavo_adapter.py`
- `git diff --check` 通过。
- HTTP HEAD：全部 21 个 `static/tavo.runtime.parts/*.js` 返回 `200 application/javascript`。
- HTTP HEAD：`static/tavo.ui.skin.default.css` 返回 `200 text/css`。
- 路径穿越保护：`/static/../README.md` 返回 404。
- key 扫描：`README.md`、`docs/**`、`static/**`、`*.py` 未发现 `sk-...` 或 `GSV_TAVO_LLM_API_KEY=` 明文赋值。

新会话第一步：

1. 先读 `AGENTS.md`、`README.md` 和 docs 入口文件。
2. 执行 `git status --short`，不要回退当前未提交拆分成果。
3. 不要继续机械切文件；下一步应做真实 Tavo/雷电回归，确认 `v=2028881910` 能加载 21 个 parts 和 CSS skin。
4. 回归通过后再考虑 commit；commit 前复跑上述验证和 key 扫描。
5. 功能线继续时优先处理：普通/智能模式半成品，或 iPhone 弹层 BUG-004/014/015/016。不要把两条线混成一个补丁。

## 当前运行链路

- `gsv_tavo_adapter.py` 提供本机 FastAPI adapter，默认端口 `9880`。
- 官方 GPT-SoVITS `api_v2.py` 作为推理后端，当前验证端口 `9881`。
- Tavo 通过 `static/tavo.js` 加载运行时，真实验证以 Tavo app / 雷电模拟器为准。
- `outputs/cache` 是真实 runtime 缓存目录，不放 Codex 手工 benchmark 音频。
- Whisper CLI 可用于生成后转写验证，但最终仍要人工试听。

## 最近真实 Tavo 进度

- 2026-06-01 22:47 重开后已做一轮真实 LDPlayer/Tavo 回归：模拟器内 `curl` 可访问 `http://192.168.8.100:9880/health` 和 `static/tavo.js?v=2028881910`；真实 Tavo 日志出现 `GET /static/tavo.js?v=2028881910`。
- 2026-06-01 22:47 已在真实 Tavo 聊天页点击 GPT-SoVITS 卡片，adapter 日志确认 `static/tavo.runtime.js`、全部 21 个 `static/tavo.runtime.parts/*.js?runtime_part_v=20260601-split-runtime-v4`、以及 `static/tavo.ui.skin.default.css?skin_v=20260601-lan-webview-layer-v20` 均从模拟器侧请求并返回 200。证据：`dev_tools/tavo_debug/adapter_log_tail_20260601_224730.txt`、`dev_tools/tavo_debug/emulator_screen_20260601_224730.png`。
- 2026-06-01 22:48 设置页在 LDPlayer 里已打开，能看到播放缓存、角色音色映射、LLM 配置和保存按钮，未出现 LDPlayer 侧窄条布局问题。证据：`dev_tools/tavo_debug/emulator_screen_20260601_224807.png`。注意：这不能替代 iPhone 14 Pro 的 BUG-004/014/015/016 回归。
- 2026-06-01 22:49 音色选择器尚未完成验证。一次坐标点选误进 Tavo `JavaScript 控制台` 并触发了新的 live job `fbaeeb8a6f7487caeb0f4c1eec0f07c15c7c19a2`；该 job 因 `IncompleteRead(0 bytes read)` 变成 `state=missing`，无 `outputs/cache/*.wav/json`，前端显示“历史音频已失效”。这次不要当作音色 picker 回归通过；下一步应先稳定回到设置页，再精确点击 `.idx-voice-btn` 或人工操作。
- 2026-06-01 已在改 bug 前创建并推送还原点：`bec4cbd 整理 docs 文档体系并固化 Tavo 真实端修复快照`，远端为 `origin/master`。提交前确认 `local_private` 被忽略，key 扫描未发现真实 key，`dev_tools/tavo_debug/` 约 174MB 真机/调试缓存已排除，不推公开仓库。
- 2026-06-01 已拿到雷电模拟器真实截图和 UI 树：`dev_tools/tavo_debug/tavo_screen.png`、`dev_tools/tavo_debug/tavo_window.xml`。
- 当前抓到的页面仍在正则/加载器链路，界面里能看到 `正则`、`应用` 和 `GPTSoVITS_TTS_Loader`，说明这轮是在真实 Tavo 里检查注入规则，而不是 mock 页面。
- 最新注入规则版本是 `static/tavo_regex_gptsovits_loader.json` 里的 `v=2028881910`，loader 版本 `20260601-lan-webview-layer-v20`。
- 2026-06-01 用户真实测试暴露 5 个问题：移动 WebView 流式先走 `<audio>` 失败、保存到本机缓存后 seek 仍重拉、补角色后 LLM 拆段未复用、`女声/风韵少妇` 小声且长对白吞字、`极致/离线` 文案误导。
- 已做代码修复：移动端多音色 live 直接 Web Audio；已保存音频首次解码后复用 `AudioBuffer`；LLM 复用 fingerprint 去掉角色映射；长 segment 合成前按标点拆短；`女声/风韵少妇` 增加 `post_gain_db=9.0`；档位文案改为 `极限质量`。
- 证据：最新 cache `outputs/cache/c23aca2bd05f294a1a0bf8152395886d9e4bbcc9.wav/json`，Whisper 输出在 `reports/whisper_cache_c23aca2bd05f294a1a0bf8152395886d9e4bbcc9_20260601/`，确认原第 20 段吞掉 `白产品经理，你今晚在公司`。
- 2026-06-01 用户 iPhone 14 Pro 真机继续暴露弹层问题：设置页在 iOS Tavo WebView 里显示成一条长窄面板；点设置页边缘/右上/空白会误关闭；从设置页进 `选择音色` 后点 picker `X` 应该回上一层设置页，但当前直接回播放器；点 `日日新` 等分类 tab 附近也可能误触关闭。已记录为 `BUG-004`、`BUG-014`、`BUG-015`，回归清单见 `docs/REGRESSION.md` 的 iPhone 真机弹层回归。
- 当前 adapter 局域网日志在 `outputs/logs/gsv_tavo_adapter_lan.out.log`，后续要继续对照真实 Tavo 的请求顺序、播放器表现和缓存命中情况。
- 重启后先回到真实聊天页，再核对消息卡片、播放器、音色选择器和保存/播放链路，不要只看静态截图。

## 并行工作线

- Claude 线：处理 `BUG-004` / `BUG-014` / `BUG-015` / `BUG-016`，主要会碰 `static/tavo.runtime.js` 的设置页 CSS、弹层关闭守卫、音色选择器关闭层级、保存音频复播/Web Audio 播放链路。
- Codex 线：处理“单音色/多音色”产品命名和普通模式配置，目标是改成“普通模式/智能模式”。普通模式先用 JS 清洗正文，再支持默认音色、旁白音色、对白音色；智能模式继续走 LLM 拆旁白/人物/声腔。
- 两条线不要混改：Codex 线不要动 BUG-004/014/015/016 的 CSS、弹层、播放器修复；Claude 线不要动普通/智能模式命名、普通模式三音色配置、文本清洗和规则拆段。
- 当前 `static/tavo.runtime.js` 已有未提交的普通模式局部改动：新增 `extractMessageBody` / `stripTaggedBlocks` / `stripMarkdownNoise` / `stripSpecialSymbols` / `collapseBodyText` 等正文清洗方法，并把消息正文提取切到 `extractMessageBody(...)`；还新增 `ensureNormalVoiceSlots` / `voiceFromNormalizedList`。这条线尚未完成，不要回退。
- 2026-06-01 已开始 runtime 物理拆分：`static/tavo.runtime.js` 变成小型懒加载入口，真实 runtime 被切到 `static/tavo.runtime.parts/*.js`。这是行为等价拆分，优先降低 token 和冲突成本。
- 2026-06-01 已继续抽离模块：`00_base_config_storage.js` 收缩为 bootstrap/debug/shared base；正文清洗、message context、配置加载、icons、style presets 放到 `05_message_text_config.js`；默认皮肤 CSS 放到 `static/tavo.ui.skin.default.css`；主播放器/懒加载 shell/字幕/角色行/音色 picker 动态模板集中到 `25_ui_templates.js`；播放、track/cache、设置、picker、生成和事件绑定继续按函数边界拆到 21 个 runtime parts。`static/tavo.js` 仍是唯一 Tavo 正则入口；CSS 和 runtime parts 都只在点击懒加载卡片后加载。
- 用户提供的旧项目拆分参考：`insert.core.base.js`、`insert.core.engine.js`、`insert.core.flow.js`、`insert.core.js`、`insert.js`、`insert.ui.js`、`insert.ui.runtime.js`、`insert.ui.skin.*.js`。后续目标是接近这种结构，UI/skin JS 可以按需加载替换。
- 拆分后发现 adapter 旧静态路由不支持子目录，已修 `gsv_tavo_adapter.py` 的 `/static/{name:path}` 安全路由，并重启 9880 adapter；全部 21 个 `static/tavo.runtime.parts/*.js` 和 `static/tavo.ui.skin.default.css` 当前通过 HTTP HEAD 返回 200。

## 当前工作区状态

还原点 `bec4cbd` 已推送。当前仍有未提交改动，后续接手不要随手回退：

- `AGENTS.md`
- `docs/BUGS.md`
- `docs/AGENT_STATE.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/TODO.md`
- `docs/REGRESSION.md`
- `static/tavo.js`
- `static/tavo.runtime.js`
- `static/tavo.runtime.parts/`

代码改动包括 `static/tavo.js`、`static/tavo.runtime.js`、`static/tavo.runtime.parts/` 和 `static/tavo.ui.skin.default.css`。`static/tavo.js` 现在会等待 `window.__gptsovits_tavo_runtime_ready`，保证 runtime parts 加载/执行完成后再隐藏懒加载卡片；`static/tavo.runtime.js` 负责 fetch parts 并按原闭包执行。当前缓存版本：`static/tavo_regex_gptsovits_loader.json` 用 `v=2028881910`，`LOADER_VERSION=20260601-lan-webview-layer-v20`，runtime parts query 为 `20260601-split-runtime-v4`。

## 流程补充

- 用户每报一个新 bug，先记录到 `docs/BUGS.md`，再开始定位或改代码。
- 改 bug 前必须读 `docs/BUGS.md`，避免同一问题重复修、丢上下文或覆盖另一条工作线。
- 并行 agent 修改同一文件前必须先看 `git status --short` 和目标文件 diff；不能把普通/智能模式改动与弹层/播放器 bug 修复混在一个无说明的补丁里。

## 真实端原则

- mock 页面只做语法和基础接口烟测，不能替代真实 Tavo 结论。
- 多音色必须在真实 Tavo 消息里点消息/音符触发，不能用单音色片段冒充验证。
- 每次真实端验证记录：Tavo 角色映射、注入脚本 `v=`、文本、音色 profile、模型版本、`batch_size`、`sample_steps`、是否多音色、RTF、缓存 key、音频路径、Whisper 输出和人工听感。

## 私有配置

- LLM key：`local_private/gsv_tavo_llm.ps1`
- 生图 key：`local_private/image_api_tizenry.ps1`
- 这些文件只在本机存在，不提交。
- Tavo 本地客户端可以显示 endpoint/model/key；约束是不要把真实 key 写进 git。

# Agent State

更新时间：2026-06-03 07:46 +08:00

## 当前目标

把 GPT-SoVITS 官方能力整理成本地可分发产品链路：本地模型、本地 adapter、本地 Tavo 注入脚本、本地训练/验证工具和可复现报告。

当前主线是官方 GPT-SoVITS。Genie-TTS 已验证为后续轻量运行时候选，但现在不继续深挖。

## BUG-034 删除到空后计数残留和无声假播放修复（2026-06-03 07:46 +08:00）

用户反馈：历史音频全删后播放器仍显示 4 条；再点播放会开始 live 流式，进度条在走但没有声音。

已改：

- 正则入口升到 `https://sovits.928886540.xyz/static/tavo.js?v=2028881930`。
- Loader 版本 `20260603-delete-audio-v40`，runtime parts/manifest `20260603-delete-audio-v22`。
- `05_message_text_config.js`：保存空 tracks 时同步清 `sovits_tracks_*` 和旧 `indextts_tracks_*` 的 localStorage / Tavo chat / Tavo global，避免删除后旧 key 回灌。
- `44_track_history_cache.js`：删除后立刻刷新 `knownHistoryCount`；删除到 0 时等待 `saveTracksForMessage()` 写完并清空音频/UI；删除后切剩余卡片只走 metadata-only。
- `10_tts_jobs_audio_stream.js` / `42_saved_playback_cache.js`：live/saved Web Audio 只有 `AudioContext.state === "running"` 才能进入 playing 和推进进度；否则提示 `音频通道未放行`。

已验证：

- `node --check static\tavo.js`
- `node --check static\tavo.runtime.js`
- manifest 21 parts 拓扑拼接后 `new Function(src)` 通过，runtimeVersion=`20260603-delete-audio-v22`
- `python -m py_compile gsv_tavo_adapter.py`
- 本地 adapter `/health` 200；`/static/tavo.js?v=2028881930` 返回 `delete-audio-v40`；manifest 返回 `delete-audio-v22`。

未完成验证：

- 本机 `curl.exe --noproxy "*"` 直连 `https://sovits.928886540.xyz/health` 当前 TLS handshake 被 reset，未能确认公网静态响应是否已取到 v1930。真实 Tavo 仍需以控制台脚本来源和 adapter 日志为准。

待真实 Tavo 回归：

1. 刷新真实 Tavo 正则到 `v=2028881930`，重渲染消息。
2. 删除所有历史音频后，完整播放器应立即显示 `历史音频 0 条`，重进消息不能读回旧 4 条。
3. 再点播放如果新建 live，必须真实出声才进入 playing；如果 AudioContext 没放行，应显示 `音频通道未放行`，不能进度条假走。

## BUG-033 历史/播放状态机修复（2026-06-03 01:52 +08:00）

用户反馈：历史音频仍不显示、上一条/下一条失效、loading 卡住播放键、live 切卡/后台状态混乱、歌词不同步、设置页不应贴底。结论：这是卡片选择态、服务端 cache 态、播放器 playback 态混在一起，不是单个接口问题。

已改：

- 正则入口升到 `https://sovits.928886540.xyz/static/tavo.js?v=2028881929`。
- Loader 版本 `20260603-state-model-v39`，runtime parts/manifest `20260603-state-model-v21`。
- `44_track_history_cache.js`：`selectTrack()` 开头立即刷新页码/状态；上一条/下一条不再自动播放；后台合成卡片非 autoplay 时不把播放按钮置为 loading。
- `62_dialog_audio_events.js`：上一条/下一条改为 metadata-only 切卡；settings/picker 打开时按播放器卡片 rect 定位，不再固定贴底。
- `30_player_shell.js`：已知历史条数但未加载 tracks 时显示 `历史音频 N 条`，右上角显示 `N条`，不再用“可恢复上次音频”掩盖数量。
- `05_message_text_config.js` / `static/tavo.js`：读到旧 key 或异步 Tavo 存储里的历史后，迁移写回新的 `sovits_tracks_*` chat 变量，不只写 localStorage。
- `34_element_audio_controls.js`：saved 播放失败按 `fetchSaved/arrayBufferSaved/decodeSaved/resume` 分层提示。
- `52_voice_subtitle_media.js`：没有真实 `segments_meta` 时间轴时，live 歌词只显示校准中，不做假同步/跳转。
- `58_live_pause_helper.js`：暂停文案改为后台继续保存，点播放再决定续播或读取历史。

已验证：

- `node --check static\tavo.js`
- `node --check static\tavo.runtime.js`
- manifest 21 parts 拓扑拼接后 `new Function(src)` 通过，runtimeVersion=`20260603-state-model-v21`
- `python -m py_compile gsv_tavo_adapter.py`
- `git diff --check` 通过，仅有 LF/CRLF 工作区提示
- key 扫描无命中
- 本地 adapter `/health` 200；`/static/tavo.js?v=2028881929` 返回 `state-model-v39`；`/static/tavo.runtime.manifest.json?runtime_part_v=20260603-state-model-v21` 返回 200。
- LDPlayer：把正则 LAN 规则从 `v=2028881926` 改到 `v=2028881928` 后，点击懒加载文字区域加载了 `state-model-v38/v20` runtime；设置页覆盖在播放器卡片区域；上一条/下一条从 6/6 到 5/6/2/6/1/6 页码即时切换且不进 loading。当前模拟器这条消息 6 条历史全是 failed，不能验证 saved 音频成功播放。

待真实 Tavo 回归：

1. 刷新真实 Tavo 正则到 `v=2028881929`，重渲染消息。
2. 用一条确实有 saved 历史音频的消息验证：打开时显示 `历史音频 N 条`；上一条/下一条只切卡；点播放能读 saved 音频或显示具体失败阶段。
3. live 生成时切卡/后台/落盘完成验证：提示不能互相覆盖，未点播放不自动切 saved。
4. live 歌词在没有真实时间轴前显示校准中；有 `segments_meta` 后再同步和允许跳转。

## BUG-030/031/032 Tavo 历史恢复和歌词点击修复（2026-06-03 01:10 +08:00）

用户真实 Tavo 反馈：流式播放时误点歌词会重连音频并刷多条 `play snapshot`；快照/懒加载卡片看不到历史音频条数；关闭 Tavo 后重进消息，日志说只恢复 metadata，但 UI 显示 `读取已保存音频`，随后播放失败并出现 `play compensation 本机缓存保存失败` 或裸 `错误: Error`。

已改：

- 正则入口升到 `https://sovits.928886540.xyz/static/tavo.js?v=2028881927`。
- Loader 版本 `20260603-history-restore-v37`，runtime parts/manifest `20260603-history-restore-v19`。
- `static/tavo.js`、`05_message_text_config.js`：历史读取优先非空 tracks；新 `sovits_tracks_*` 为空时不会遮住旧 key 的非空历史，异步读到旧历史后迁移写回新 key。
- `25_ui_templates.js`、`30_player_shell.js`：懒加载/完整播放器统一显示 `历史音频 N 条`、`点播放读取历史音频`，不再用 `快照` / `未生成` / `读取快照`。
- `44_track_history_cache.js`：新增 `selectTrack(..., { metadataOnly: true })`；重进消息只恢复历史条目、计数、断点和提示，不请求音频、不补写 IndexedDB、不轮询落盘。点击播放才读取保存音频。
- `36_track_state_offline.js`、`38_saved_prompt_stream_helpers.js`、`42_saved_playback_cache.js`、`60_generate_mount_boot.js`：播放前不再用 `prepareOfflineAudio(... saveMissing=true)` 把离线副本保存和在线播放混起来；本机缓存副本保存失败只记录“不影响在线播放”。
- `34_element_audio_controls.js`、`52_voice_subtitle_media.js`：live 未落盘时歌词/seek 不再重连流式音频；歌词 click 阻断冒泡。保存后的音频仍可 seek。
- 新增 `errorMessage()`，TTS job 和播放/历史事件 catch 不再把空异常显示成裸 `Error`；非 2xx 空响应会显示 `TTS job 后端返回 HTTP xxx，响应为空`。

已验证：

- `node --check static\tavo.js`
- `node --check static\tavo.runtime.js`
- manifest 21 parts 拓扑拼接后 `node --check` 通过，runtimeVersion=`20260603-history-restore-v19`
- `python -m py_compile gsv_tavo_adapter.py`
- `git diff --check` 通过，仅有 LF/CRLF 工作区提示
- key 扫描无命中
- 本地 adapter `/health` 返回 200；`/static/tavo.js?v=2028881927` 返回 loader `20260603-history-restore-v37`；manifest 返回 `20260603-history-restore-v19`；part 44 返回 metadata-only 修复代码。

待真实 Tavo 回归：

1. 把真实 Tavo 正则刷新到 `v=2028881927` 并重渲染消息。
2. 关闭/重进有历史音频的消息，确认只显示 `历史音频 N 条` / `点播放读取历史音频`，未点播放前不出现 `读取已保存音频` 或本机缓存补写日志。
3. 点播放确认历史音频能播放；如果仍失败，看新的具体错误，不再接受裸 `Error`。
4. live 流式播放时点歌词，确认不重连、不刷 `play snapshot`。

## BUG-029 official 9881 代理污染修复（2026-06-03 00:45 +08:00）

用户继续追官方 GPT-SoVITS 502。结论：这次不是 `/parse_text`、不是 Tavo AR 链路，也不是真正的官方接口 body 502；adapter 进程继承了 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY=http://127.0.0.1:7897`，`urllib` 调默认 `http://127.0.0.1:9881/tts` 时会走代理，代理把 9881 不可达伪装成空 body `502 Bad Gateway`。

已改：

- `gsv_tavo_adapter.py`：新增 official no-proxy opener。`GPT_SOVITS_OFFICIAL_TTS_URL` 是 loopback / private / link-local 地址时，adapter 用 `ProxyHandler({})` 绕开系统代理；`GPT_SOVITS_OFFICIAL_BYPASS_PROXY=0/1/auto` 可覆盖。
- 新增 `dev_tools/run_official_api_9881.ps1`：任务计划 runner，负责常驻启动官方 `../gpt-sovits-official/api_v2.py -a 127.0.0.1 -p 9881`，日志写 `outputs/logs/official_api_9881_task.*.log`。
- 已注册并启动任务计划：`GPT-SoVITS Official API 9881`。当前 9881 已由该任务监听。

证据：

- `python urllib.request.urlopen("http://127.0.0.1:9881/docs")` 在代理环境下复现 `HTTPError 502 Bad Gateway`。
- 用 `ProxyHandler({})` 绕过代理后，9881 未启动时是 `URLError [WinError 10061]`，不是 502。
- 任务计划启动后，`curl.exe --noproxy "*"` 打 `http://127.0.0.1:9881/docs` 返回 200。
- 直接 official TTS 成功：`reports/official_tts_proxyfix_20260603/bingshan_gaoyuanyuan.wav`。
- adapter queued job 成功：`d23b5e8df15adb928e73b11a2df40ae4ddb71464`，最终 `done/cached=true`。
- adapter live job 成功：`7627c06937a1398280ac3453e16011cf5ad4a649`，最终 `done/cached=true`，输出 `reports/official_tts_proxyfix_20260603/adapter_live_bingshan_gaoyuanyuan.wav`。

下一步：

1. 先复跑基础检查并提交/push 本轮 BUG-029。
2. 真实 Tavo 再点一次同类生成；如果仍失败，优先看新的 job status/error，不要再把空 502 当官方真实错误。
3. 如果系统重启后 9881 没起来，运行/启动任务计划 `GPT-SoVITS Official API 9881`，不要在普通 Codex 工具调用里裸 `Start-Process` official；该子进程会被工具清理。

## BUG-028 服务端失败提示分层修复（2026-06-03 00:02 +08:00）

用户截图确认：当前不是 `/parse_text` 链路断，也不是 Tavo AR 到 adapter 的网络问题。现象是 Web Audio 先报 `[step:wavHeader] WAV 头未到先断流`，但状态/日志随后明确显示 `服务端推理失败: ... official API HTTP 502`；旧 UI 却显示“音频流格式异常”，误导排查方向。

已改：

- 正则入口升到 `https://sovits.928886540.xyz/static/tavo.js?v=2028881926`。
- Loader 版本 `20260602-sovits-server-error-v36`，runtime parts/manifest `20260602-sovits-server-error-v18`。
- `static/tavo.runtime.parts/34_element_audio_controls.js`：新增 `readableServerJobError()` / `applyServerJobFailure()`；`wavHeader` 不再显示“音频流格式异常”，而是“服务端未返回音频流首包，正在确认服务端合成状态”。
- `static/tavo.runtime.parts/42_saved_playback_cache.js`、`44_track_history_cache.js`：`/tts_dialogue_job_status` 返回 `state=failed` 时写回 track/card/status/history，卡片显示“服务端推理失败”和官方 API / voice profile / LLM 上游真实摘要；`pollCacheUpgrade()` failed 分支补 `done=true`，不再被当成等待落盘超时。
- `static/tavo.runtime.parts/20_llm_segmentation.js`：LLM parse 错误说明改为 Tavo 页面配置优先，避免继续把后端 env 当产品主配置。

已验证：

- `node --check static\tavo.js`
- `node --check static\tavo.runtime.js`
- manifest 21 parts 拓扑拼接后 `new Function(src)` 通过，runtimeVersion=`20260602-sovits-server-error-v18`
- `python -m py_compile gsv_tavo_adapter.py`
- `git diff --check` 通过，仅有 LF/CRLF 工作区提示
- key 扫描无命中
- 本地 adapter `/health` 返回 ok；`/static/tavo.js?v=2028881926` 返回 loader `20260602-sovits-server-error-v36`

待真实 Tavo 回归：刷新真实 Tavo 正则到 `v=2028881926` 并重渲染消息。复现官方 API 502 时，卡片必须显示“服务端推理失败 / 官方 GPT-SoVITS 推理接口返回 502，不是音频格式问题”，不能再显示“音频流格式异常”。如果 `/tts_dialogue_stream_job` 返回 400，则按 voice profile 参考音频 3-10 秒校验处理，不回头查 `/parse_text`。

## Tavo AR 动态 loader 纠偏与当前 HTTPS 映射（2026-06-02 23:10 +08:00）

用户纠正：这个页面是 Tavo 聊天消息里的 AR 渲染环境，不是普通 H5 页面。不能继续用 iframe bridge、plain RPC、WebSocket/JSONP 或服务端 runtime bundle 去绕；必须保留 AR 动态加载模型。

当前正确架构：

- `static/tavo.js` 仍是 Tavo 正则唯一入口，通过 `<script src>` 注入消息。
- `static/tavo.js` 从自己的 `script.src` 推导同源 `/static/` base，再加载 `static/tavo.runtime.js`。
- `static/tavo.runtime.js` 从同源 base 加载 `static/tavo.runtime.manifest.json` 和 21 个 `static/tavo.runtime.parts/*.js`，按 manifest 拓扑顺序拼接并 `eval` 到单消息 AR 运行环境。
- 这仍是 AR 的动态 `fetch + eval` ordered-fragments loader；不是服务器 bundle，也不是真 module registry。
- `/parse_text` 请求失败要按 API POST / CORS / WebView 请求链路单独排查，不能再用 iframe/RPC/bundle 代替。

用户要求：旧 `index` 系列命名改成小写 `sovits`；外网映射子域名改成 `sovits.928886540.xyz`。

当前已确认：

- 已停止旧 `D:\cloudflared\cloudflared.exe` 实例，并通过任务计划 `CF Tunnel` 重启；当前任务状态 `Running`，cloudflared PID `23184`。
- `https://sovits.928886540.xyz/health` 返回 200，body 为 `{"status":"ok","engine":"gptsovits-adapter"}`。
- 之前 BUG-022 里“HTTPS 映射不可用”的判断已修正；外网映射是有效路线，真实问题是 Tavo 仍可能加载旧子域名/旧 `v=` 的脚本来源或 WebView 正则缓存。
- iframe bridge 已废弃并删除；plain RPC/WebSocket/JSONP/服务端 bundle 方向不再继续。

已改方向：

- 正则入口改为 `https://sovits.928886540.xyz/static/tavo.js?v=2028881923`。
- Loader 版本改为 `20260602-sovits-xhr-post-v33`，runtime parts/manifest 改为 `20260602-sovits-xhr-post-v15`。
- `/parse_text`、`/tts_stream_job`、`/tts_dialogue_stream_job` 前端 POST 改成 XHR 主路径，`Content-Type: text/plain;charset=UTF-8` 承载 JSON 字符串，避免 Tavo AR 里 fetch JSON POST / preflight 链路；后端兼容解析 `application/json` 和 `text/plain`。
- 新历史 key 使用 `sovits_tracks_*`，新 IndexedDB 使用 `sovits_tavo_audio_v1`；旧 key/旧 DB 只做读取兼容，避免历史音频丢失。
- `adapterFetch()` 已回到原生 `fetch(url, init)`；没有 iframe bridge/RPC 分支。

下一步：

1. 已通过本地验证：`node --check static\tavo.js`、`node --check static\tavo.runtime.js`、manifest 拼接 `new Function`、`python -m py_compile gsv_tavo_adapter.py`。
2. 已通过代理公网验证：`/static/tavo.js?v=2028881923` 返回 loader `20260602-sovits-xhr-post-v33`；`/static/tavo.runtime.manifest.json?runtime_part_v=20260602-sovits-xhr-post-v15` 返回 200；part 00 返回 `adapterXhrTextPost()`。
3. 待真实 Tavo 回归：当前公网正则必须刷新到 `https://sovits.928886540.xyz/static/tavo.js?v=2028881923` 并重新渲染消息；点击懒加载卡片后应请求 `tavo.runtime.js`、manifest、21 个 parts 和 CSS。
4. 如果新版真实 Tavo 报错变成 `LLM parse failed` / `auth_unavailable` / endpoint/model/key 问题，说明 `/parse_text` 已经到后端，下一步查 LLM adapter 配置，不再查 Tavo fetch。

## BUG-027 LLM 拆段复用和设置同步（2026-06-02 23:45 +08:00）

用户指出：勾选“复用 LLM 拆段”后，不应该再检查 LLM 配置是否可用；保存设置后必须立刻使用页面当前 endpoint/model/key，不能继续拿旧配置。

已改：

- 正则入口升到 `https://sovits.928886540.xyz/static/tavo.js?v=2028881924`。
- Loader 版本 `20260602-sovits-llm-reuse-v34`，runtime parts/manifest `20260602-sovits-llm-reuse-v16`。
- `static/tavo.runtime.parts/32_llm_reuse_helpers.js`：LLM 拆段复用 fingerprint 升到 v4，只按消息正文、用户身份、角色身份匹配，不再包含 `llmEndpoint` / `llmModel`。命中复用时直接返回 segments，不访问 `/parse_text`。
- 同文件兼容旧 v3 记录：扫描旧 `gptsovits_llm_parse_*` localStorage 记录时，匹配正文/用户/角色并忽略 endpoint/model。
- `static/tavo.runtime.parts/48_settings_fields.js`：设置字段读取优先当前打开的 panel，避免读到 root 里的旧字段。
- `gsv_tavo_adapter.py`：`/parse_text` 改为 Tavo 请求里的 endpoint/model/api_key 优先，后端 env 只做兜底。之前后端 `LLM_MODEL or request.model` 会覆盖 Tavo 页面保存的模型，这是本轮真实断点。

已验证：

- `node --check static\tavo.js`
- `node --check static\tavo.runtime.js`
- manifest 拼接 21 parts 后 `new Function` 通过
- `python -m py_compile gsv_tavo_adapter.py`
- 代理公网验证：`/static/tavo.js?v=2028881924` 返回 `20260602-sovits-llm-reuse-v34`；manifest 返回 `20260602-sovits-llm-reuse-v16`；part 32 有 `v: 4`；part 48 的 `findInWidget()` 优先 panel。
- 2026-06-02 23:31 重启 adapter 后，直接 POST `/parse_text`，请求指定 `model=liangjie/grok-4.1`，返回 `200 OK` segments；`/llm_config` 仍显示 env 默认旧模型，但 `request_overrides_env=true`。
- 2026-06-02 23:35 真实 LDPlayer/Tavo 点击音符新建后，adapter 日志显示 `192.168.8.100 ... POST /parse_text HTTP/1.1 200 OK`，说明 Tavo AR -> adapter -> LLM 解析链路已通。下一跳 `/tts_dialogue_stream_job` 返回 `400 Bad Request`，原因是 `400个火爆音色/AD学姐.mp3` 参考音频约 `1.63s`，不满足 GPT-SoVITS 3-10 秒要求。

待真实 Tavo 回归：同一消息已有拆段缓存时，即使 LLM provider 不可用或模型已切换，也必须显示“复用 LLM 拆段”，adapter 日志不能出现新的 `POST /parse_text`。保存设置后下一次生成日志里的 endpoint/model 必须是页面当前值。LLM parse 链路当前已过；若继续失败，优先查实际 voice profile 参考音频时长。

## Runtime Manifest Phase 1 交接（2026-06-02 20:36 +08:00）

触发原因：上一个 Codex 会话在 runtime 架构升级中途上下文炸掉。用户要求给下一个 Codex 留清楚交接。

当前真实状态：

- Phase 0 文档已落盘：`docs/RUNTIME_MODULARIZATION.md`、`docs/ARCHITECTURE.md`、`docs/DECISIONS.md`、`docs/TODO.md`、`docs/REGRESSION.md`、`static/tavo.runtime.parts/README.md` 都已串上 manifest/module registry 路线。
- Phase 1 代码已实现：新增 `static/tavo.runtime.manifest.json`；`static/tavo.runtime.js` 已从 manifest 读取 21 个 modules，校验 schema/id/file/depends，拓扑排序后并行 fetch parts，再按拓扑顺序拼接旧闭包执行。
- 当前仍是 `mode: ordered-fragments`，不是 Phase 2 真 module registry；parts 之间仍共享闭包变量。不要把它误判成已经完全解耦。
- 保留了 `FALLBACK_PARTS` 作为 manifest 加载失败时的回退，并打印 `[GPT-SoVITS TAVO runtime loader] manifest fallback` warning。
- 版本已对齐到：正则 `v=2028881916`，loader `20260602-ios-layer-v26`，runtime parts/manifest `20260602-ios-layer-v9`。

本地验证已通过：

- `node --check static\tavo.js`
- `node --check static\tavo.runtime.js`
- manifest 校验：21 个 modules 文件存在、依赖可拓扑排序、拼接后 `new Function(src)` 通过，runtimeVersion=`20260602-ios-layer-v9`
- `python -m py_compile gsv_tavo_adapter.py`
- `git diff --check` 通过，仅有 Git 的 LF/CRLF 工作区提示
- key 扫描无命中：未发现 `sk-...` 或 `GSV_TAVO_LLM_API_KEY=` 明文赋值

下一步：

1. 不要进入 Phase 2，不要迁 UI 真模块，不要改生成/播放/cache 业务逻辑。
2. 先重启/确认 adapter 静态服务，检查 `/static/tavo.runtime.manifest.json`、`/static/tavo.runtime.js`、21 个 parts 和 CSS 都返回 200。
3. 在真实 Tavo 正则里刷新到 `v=2028881916`。
4. 真实 Tavo/雷电回归：点击懒加载卡片后应先加载 manifest，再加载 21 个 parts 和 CSS；播放器、设置页、音色选择器、BUG-019 音符新建音频、BUG-020 懒加载首点播放都要复测。
5. 真实 Tavo 回归不过，只修 loader/manifest/静态路由；不要继续扩大架构迁移。

当前工作区仍有大量未提交改动，先跑 `git status --short`，不要回退 BUG-018/019/020 和 runtime 拆分成果。

## BUG-021 懒加载后 picker 被误关（2026-06-02 21:08 +08:00）

push 后继续 Phase 1 mock/CDP 回归时发现：manifest loader 在浏览器内正常加载，控制台出现 `manifest ordered-fragments 20260602-ios-layer-v9 21 modules`，但旧 CDP smoke 在音色选择器步骤失败。

已定位：

- narrow CDP trace 证明：点音色按钮后 `.idx-picker` 同步打开，随后 50ms 内被关闭；设置页也已经关闭。
- 根因是 `static/tavo.js` 的 `closeAccidentalPicker()` 在 runtime ready 后延迟清理所有 `.idx-picker[open]`，没有区分 stale picker 和 runtime 明确打开的 picker。

已改：

- `static/tavo.js`：`closeAccidentalPicker()` 遇到 `data-open="1"` 的 active picker 直接跳过，只清理 stale picker。
- 版本已 bump：正则 `v=2028881917`，loader `20260602-ios-layer-v27`，runtime parts/manifest 仍是 `20260602-ios-layer-v9`。
- `docs/BUGS.md` 新增 BUG-021；`docs/REGRESSION.md` 新增对应回归项。

已验证：

- `node --check static\tavo.js` 通过。
- `node --check static\tavo.runtime.js` 通过。
- `python -m py_compile gsv_tavo_adapter.py` 通过。
- `git diff --check` 通过，仅有 Git 的 LF/CRLF 工作区提示。
- key 扫描无命中。
- `http://127.0.0.1:9880/static/tavo.js?v=2028881917` 返回 `LOADER_VERSION = "20260602-ios-layer-v27"`。
- narrow CDP smoke 通过：点击懒加载打开播放器 -> 设置齿轮 -> 点音色按钮后，picker 在 sync/microtask/50ms/300ms/1100ms 均保持 `.idx-picker[open] = true`；manifest 请求存在，21 个 parts 请求存在。

下一步：提交并 push BUG-021 小修版本；之后再跑完整 `dev_tools/tavo_webui_smoke_cdp.mjs` 或进入真实 Tavo/雷电回归。完整 smoke 会触发真实 TTS job，跑之前注意是否允许产生新的 `outputs/cache`。

## BUG-022 真实 Tavo 仍加载旧 HTTPS 脚本（2026-06-02 21:15 +08:00，21:24 修正）

用户贴出的真实 Tavo 日志显示：

- 脚本来源仍是旧 HTTPS 子域名，且 `v=2028821788`
- `/parse_text` 请求 URL 仍打到旧脚本来源同源
- 错误：`TypeError: Load failed`

当前本机事实：

- 用户确认旧 HTTPS 地址是刻意映射的外网地址，不是无效 URL。
- `http://127.0.0.1:9880/health` 正常。
- `http://192.168.8.100:9880/health` 正常。
- 已通过任务计划 `CF Tunnel` 重启 cloudflared，新域名 `https://sovits.928886540.xyz/health` 返回 200。
- 仓库正则已改为 `https://sovits.928886540.xyz/static/tavo.js?v=2028881919`。

结论：这不是 LLM endpoint `127.0.0.1:8317` 的问题，也不是后端 parse 逻辑问题；真实 Tavo 仍在使用旧 HTTPS/旧版本脚本，或 WebView 正则/消息渲染缓存未刷新到当前 `sovits` 子域名。

下一步：在真实 Tavo 正则里刷新脚本 URL 到 `https://sovits.928886540.xyz/static/tavo.js?v=2028881919`，保存/应用后重新渲染真实聊天消息。刷新后控制台脚本来源必须变成 `sovits.928886540.xyz`，再继续验证 BUG-019/020/021/024。

## Runtime 模块化升级文档（2026-06-02 11:00 +08:00）

用户明确要求：不要只口头说架构升级，先写文档，避免升级到一半上下文中断后没人能接。

已完成 Phase 0 文档落盘：

- 新增 `docs/RUNTIME_MODULARIZATION.md`：写清当前 ordered-fragments 问题、目标架构、非目标、Phase 0-4 迁移步骤、每阶段完成标准、失败回滚和中断接手规则。
- `docs/ARCHITECTURE.md`：runtime 拆分计划追加 manifest/module registry 迁移入口。
- `docs/DECISIONS.md`：新增 DEC-009，接受 manifest/module registry 路线，不继续机械切片。
- `docs/TODO.md`：P0/P1 追加 Phase 1 下一步。
- `docs/REGRESSION.md`：新增 Runtime Manifest 回归项。
- `static/tavo.runtime.parts/README.md`：注明当前 parts 仍不是 standalone module，下一步按 `docs/RUNTIME_MODULARIZATION.md` 做 manifest loader。

当前事实更新：此段记录的是 11:00 的 Phase 0 状态。20:36 已进入 Phase 1，本文件顶部为准。

历史下一步记录：11:00 时的计划是新增 `static/tavo.runtime.manifest.json` 并改 loader。20:36 已完成 Phase 1 本地实现，后续以本文件顶部交接为准。

## BUG-020 懒加载过渡裸 HTML 与首点播放（2026-06-02 09:22 +08:00）

用户截图显示：加载完整播放器过渡时，播放器露出未套 CSS 的裸 HTML（白色方块按钮、裸 slider/input、无卡片背景）；同时历史音频显示可恢复，但首次点懒加载播放没有延续到真实播放。

已改：

- `static/tavo.runtime.parts/05_message_text_config.js`：`ensureStyle()` 现在返回 CSS skin 加载 Promise，成功/失败/超时都会 resolve，并打印失败/超时日志。
- `static/tavo.runtime.parts/68_mount_boot.js`：runtime 启动时 `await ensureStyle()` 后才 `mountFull()`，避免完整播放器先于 CSS 显示。
- `static/tavo.js`：懒加载播放键在 `pointerdown/touchstart/click` 里预创建并解锁 AudioContext，存到 `window.__gptsovits_tavo_preprimed_audio_context`；点击不再只 `mountRuntime("")`，而是路由到完整播放器 `[data-role="play"]`。
- `static/tavo.runtime.parts/10_tts_jobs_audio_stream.js`：`primeAudioContext()` 会接管 loader 预解锁的 AudioContext。
- 缓存版本已 bump：正则 `v=2028881915`，loader `20260602-ios-layer-v25`，runtime parts query `20260602-ios-layer-v8`。

已验证：

- `node --check static\tavo.js` 通过。
- `node --check static\tavo.runtime.js` 通过。
- 21 个 runtime parts 拼接后 `new Function(parts)` 通过。
- `python -m py_compile gsv_tavo_adapter.py` 通过。
- `git diff --check` 通过，仅有 LF/CRLF 工作区提示。
- key 扫描无命中。
- 9880 `/health` 正常；服务端静态已返回 loader `20260602-ios-layer-v25`、runtime parts `20260602-ios-layer-v8`、`SKIN_READY_PROMISE` 和 `await ensureStyle()`。

下一步：真实 Tavo 正则刷新到 `v=2028881915`，确认首次点懒加载播放不再露裸 HTML，且有历史音频时会继续进入播放路径。

## BUG-019 音符按钮必须新建音频（2026-06-02 08:58 +08:00）

用户反馈：点音符/新增按钮应该始终创建新音频，不应该先读取或复用历史音频；“复用”只允许复用 LLM 拆段，不允许复用旧 TTS 音频 cache。

已改：

- `static/tavo.runtime.parts/62_dialog_audio_events.js`：播放器挂载后不再自动 `ensureTracksLoaded()` 选择历史音频，只初始化历史条数提示；播放/上一条/下一条仍会按需读取历史。
- `static/tavo.runtime.parts/44_track_history_cache.js`：`ensureTracksLoaded(opts)` 支持只恢复历史 tracks 元数据，不选择、不检查、不读取旧音频。
- `static/tavo.runtime.parts/60_generate_mount_boot.js`：`generate(true)` 先停止旧播放，只用历史元数据保留旧卡片列表，然后创建新占位卡；智能模式请求带 `bypass_cache=true` 和新的 `request_id`。
- `static/tavo.runtime.parts/10_tts_jobs_audio_stream.js`：单音色强制新建请求也带新的 `request_id`。
- `gsv_tavo_adapter.py`：single/dialogue 请求都支持 `request_id`；只有 `bypass_cache=true` 时才把 `request_id` 写进 cache payload 生成新 cache key，普通缓存 key 不变。dialogue 强制新建不再命中旧音频 cache。
- 缓存版本后续已在 BUG-020 中 bump 到：正则 `v=2028881915`，loader `20260602-ios-layer-v25`，runtime parts query `20260602-ios-layer-v8`。

已验证：

- `node --check static\tavo.js` 通过。
- `node --check static\tavo.runtime.js` 通过。
- 21 个 runtime parts 拼接后 `new Function(parts)` 通过。
- `python -m py_compile gsv_tavo_adapter.py` 通过。
- 本地 cache key 检查通过：普通 dialogue payload key 稳定；同 payload 带不同 `request_id` 时生成不同 key。
- 已重启 adapter，当前 9880 Uvicorn PID `13592`；`/health` 正常。BUG-020 版本 bump 后已确认服务端静态版本返回 loader `20260602-ios-layer-v25`、runtime parts `20260602-ios-layer-v8`。
- 接口烟测通过：同 payload 仅改 `request_id` POST `/tts_dialogue_stream_job`，返回 `86301def66e92067552c37a78b16bfbcf0f9dcff` 和 `182a16b04e02a90887a2631719536b6462cb347f`，均为 `cached=false/state=deferred_stream/distinct=true`；未 GET 拉流，已 DELETE 清理这两个烟测 job。

下一步：在真实 Tavo 正则里改到 `v=2028881915`，点音符验证每次都产生新 cache key；播放按钮再单独验证能恢复历史音频。

## BUG-004/014/015 高度与圆角三次修正（2026-06-02 08:45 +08:00）

用户真机反馈上一版设置页“还是一样，特别长”，说明 `82vh` 虽然固定但仍接近全屏，不符合“与播放器卡片同量级、固定高度”的目标。随后用户继续指出选择音色页也要固定高度，且底部没有圆角会第一眼看成仍是长条。

已改：

- `static/tavo.ui.skin.default.css`：设置页固定高度，宽屏 `560px`，iPhone 窄屏 `520px`；选择音色页固定高度，宽屏 `520px`，iPhone 窄屏 `500px`。
- 两个弹层都改成四角圆角，并从贴死 `bottom:0` 改成 `bottom:max(8px, env(safe-area-inset-bottom,0px))`，让底部圆角可见。
- picker grid 不再用 `vh` 限高，随固定弹层内部 flex 占满剩余空间并内部滚动。
- `static/tavo.runtime.parts/54_voice_picker_panel.js`：选择音色页分页改成每页 10 个。
- `static/tavo.js`：loader 版本升到 `20260602-ios-layer-v23`，确保 CSS `skin_v` 更新。
- `static/tavo.runtime.js`：runtime parts query 升到 `20260602-ios-layer-v6`，确保 picker page size 更新。
- `static/tavo_regex_gptsovits_loader.json`：正则脚本 URL 升到 `v=2028881913`。

下一步：必须在 Tavo 正则里把脚本 URL 改到 `v=2028881913`，再让用户/iPhone 14 Pro 真机确认设置页和选择音色页的高度、底部圆角、分页数量是否符合预期。

## BUG-004/014/015 代码收尾（2026-06-02 01:09 +08:00）

已接着 Claude 未完的建议修 iPhone 弹层线，当前仍未 commit。

已改：

- `static/tavo.ui.skin.default.css`：移除设置面板/音色选择器的 `dvw/dvh`、`left:50%`、`translateX` 布局风险；改为左右安全区 inset + `vw/vh` 的固定贴底 sheet。设置面板固定高度、底部对齐、内部滚动，避免 iPhone Tavo WebView 中变成长窄条。
- `static/tavo.runtime.parts/62_dialog_audio_events.js`：设置页不再支持外部点击关闭，只允许明确点设置页 `×` 或保存关闭。面板内部事件在冒泡阶段 stop propagation，避免捕获阶段挡掉按钮/输入框自己的事件。
- `static/tavo.runtime.parts/54_voice_picker_panel.js`：音色选择器不再用外部点击关闭；picker `X` / 应用继续走 `closeVoicePicker()`，返回上一层设置页并恢复滚动位置；`closeVoicePickerForPlayback()` 不用于普通 picker `X`。
- 缓存版本已 bump：正则 `v=2028881913`，loader `20260602-ios-layer-v23`，runtime parts query `20260602-ios-layer-v6`。

已验证：

- `node --check static\tavo.js` 通过。
- `node --check static\tavo.runtime.js` 通过。
- 21 个 runtime parts 拼接后 `new Function(parts)` 通过。
- `python -m py_compile gsv_tavo_adapter.py` 通过。
- `git diff --check` 通过，只有 Git 的 LF/CRLF 工作区提示。
- `static/` 下已无旧前端版本号、`dvw/dvh`、`left:50%` 或 `translateX`。
- LDPlayer 被动烟测通过：模拟器侧可 fetch `http://192.168.8.100:9880/static/tavo.js?v=2028881911`，内容显示 `LOADER_VERSION="20260602-ios-layer-v21"`；CSS `skin_v=20260602-ios-layer-v21` 也返回 200。证据：`dev_tools/tavo_debug/tavo_js_fetch_20260602_011316.txt`、`dev_tools/tavo_debug/adapter_log_tail_20260602_011316.txt`、`dev_tools/tavo_debug/emulator_screen_20260602_011316.png`。
- 当前 LDPlayer 截图仍显示旧的 BUG-018 失败历史卡片，这是历史状态，不代表本轮 iPhone 弹层回归已完成。

下一步：

1. 在真实 Tavo 正则里把脚本 URL 改到 `v=2028881913`。
2. 用 iPhone 14 Pro 真机或等效 iOS WebView 回归 BUG-004/014/015：设置页尺寸、外部误触、picker tab/search/item/apply/X 和返回设置页层级。
3. LDPlayer 只能做加载/基础交互烟测，不能替代 iPhone 结论。

## BUG-018 真实回归结果（2026-06-02 00:44 +08:00）

已用真实 Tavo/LDPlayer 重新触发多音色 live stream，拿到新 key `34f2b685f300e080e4a139f6ea1d83450b5ef67f`（为打破 deterministic cache，当时临时把播放语速从 `1` 改成 `1.01`；已在 Tavo 设置页改回 `1` 并保存）。

结论：

- 前端 Web Audio 首路径没坏：JS 控制台显示 `AudioContext state=running`、WAV header 已解析、播放时钟已启动。
- adapter 可观测性补丁有效：`/tts_dialogue_job_status/34f2...` 返回 `state=failed`，不是 `missing`；保留了 0-4 段 partial `segments_meta`；`outputs/cache/34f2...wav/json` 不存在。
- adapter 日志出现 `[gsv_adapter] dialogue_stream_failed`，第 5 段 role=`用户`，voice=`男声/霸道青年`，错误为 `official API stream incomplete after 0 bytes/0 chunks`。
- 官方 GPT-SoVITS `9881` 错误日志坐实根因：`OSError: 参考音频在3~10秒范围外，请更换！`。
- `prompts/library/男声/霸道青年.mp3` 实测约 `1.61s`（本地 parser 约 `1.69s`，同样低于 3 秒），用户听感也确认“只有一秒多”。

已做新代码改动（未 commit）：

- `gsv_tavo_adapter.py` 增加生成前 voice profile 校验：创建 single/dialogue job 前，遍历实际会用到的角色音色，检查 `ref_audio_path`、`prompt_text` 和参考音频时长；MP3/WAV 可直接量时长。
- 非法参考音频现在直接 400，例如：`音色 '男声/霸道青年' 的参考音频时长 1.69s，不在 GPT-SoVITS 要求的 3-10s 范围内`，不再进入官方流式接口后表现为 `IncompleteRead`。
- `docs/BUGS.md`、`docs/REGRESSION.md` 已同步更新 BUG-018 根因和前置失败回归规则。

已验证：

- `python -m py_compile gsv_tavo_adapter.py` 通过。
- 本地 duration parser：`男声/霸道青年.mp3` 约 `1.692s`、`男声/羞涩青年.mp3` 约 `2.088s`、`女声/旁白.mp3` 约 `3.024s`。
- 用 `dev_tools/start_adapter_lan.ps1` 重启 adapter，`/health` 返回 ok，Uvicorn PID `14428`。
- 最小 POST `/tts_dialogue_stream_job` 使用 `用户 -> 男声/霸道青年` 时，已直接返回 HTTP 400 和明确时长错误。

下一步：

1. 给 `男声/霸道青年` 更换或重新制作 3-10 秒参考音频，并保证 `prompt_text` 是逐字稿；否则它不能作为 GPT-SoVITS 可用音色。
2. 同类短参考也要处理：当前扫描发现 `男声/羞涩青年.mp3` 约 2 秒，`女声/旁白.mp3` 约 2.94 秒，也低于官方下限或非常贴边。
3. 替换有效音色后，再做真实 Tavo 多音色生成成功路径回归，确认最终 `state=done`、cache WAV/JSON 落盘。

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
- 当前版本号：正则 `v=2028881913`，loader `20260602-ios-layer-v23`，parts query `20260602-ios-layer-v6`。

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
3. 不要继续机械切文件；下一步应做真实 Tavo/雷电/iPhone 回归，确认 `v=2028881913` 能加载 21 个 parts 和 CSS skin，并验证 BUG-004/014/015。
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
- 最新注入规则版本是 `static/tavo_regex_gptsovits_loader.json` 里的 `v=2028881913`，loader 版本 `20260602-ios-layer-v23`。
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

代码改动包括 `static/tavo.js`、`static/tavo.runtime.js`、`static/tavo.runtime.parts/` 和 `static/tavo.ui.skin.default.css`。`static/tavo.js` 现在会等待 `window.__gptsovits_tavo_runtime_ready`，保证 runtime parts 加载/执行完成后再隐藏懒加载卡片；`static/tavo.runtime.js` 负责 fetch parts 并按原闭包执行。当前缓存版本：`static/tavo_regex_gptsovits_loader.json` 用 `v=2028881913`，`LOADER_VERSION=20260602-ios-layer-v23`，runtime parts query 为 `20260602-ios-layer-v6`。

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

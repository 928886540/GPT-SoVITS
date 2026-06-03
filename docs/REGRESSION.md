# Regression

## 必跑基础检查

```powershell
python -m py_compile gsv_tavo_adapter.py
```

```powershell
curl.exe --noproxy * -s http://127.0.0.1:9880/health
curl.exe --noproxy * -s http://127.0.0.1:9880/voices
```

已知 cache 音频播放兼容检查：

```powershell
curl.exe --noproxy * -I http://127.0.0.1:9880/cache_audio/<cache_key>
curl.exe --noproxy * -I http://127.0.0.1:9880/tts_dialogue_stream_job/<cache_key>
curl.exe --noproxy * -H "Range: bytes=0-99" http://127.0.0.1:9880/cache_audio/<cache_key>
curl.exe --noproxy * -H "Range: bytes=0-99" http://127.0.0.1:9880/tts_dialogue_stream_job/<cache_key>
```

## 私钥检查

提交前检查不要把真实 key 写进仓库文件：

```powershell
rg -n "sk-[A-Za-z0-9]{8,}" README.md docs static *.py
rg -n "GSV_TAVO_LLM_API_KEY\\s*=\\s*['\\\"][^<]" README.md docs static *.py
```

允许 `local_private/*.ps1` 有真实 key，因为该目录被 `.gitignore` 忽略。

## Tavo 真实端检查

每次改 `static/tavo.js` 或 `static/tavo.runtime.js` 后：

1. 增加 `static/tavo_regex_gptsovits_loader.json` 里的 `v=`。
2. 在真实 Tavo 聊天页刷新正则，不重新导入整组。
3. 点击消息卡片确认播放器加载，不误开音色选择器。
4. 打开设置确认小屏不横向撑开。
5. 打开音色选择器确认单击试听、`√` 应用。
6. 生成单音色缓存并播放。
7. 生成多音色缓存并播放，确认每句 role/style/voice 映射。
8. 如果出现 `audio error code=4` 或 `audio.play() 不支持`，确认日志出现切到 Web Audio，且播放器没有停在失败状态。

## Runtime 拆分回归

- 打开真实 Tavo 消息时，初始只应加载 `static/tavo.js` 和懒加载卡片；未点击前不应请求 `static/tavo.runtime.parts/*.js`。
- 点击懒加载卡片后，应请求 `static/tavo.runtime.js`、`static/tavo.runtime.parts/*.js` 和 `static/tavo.ui.skin.default.css`，并在 `window.__gptsovits_tavo_runtime_ready` resolve 后隐藏懒加载卡片。
- 任一 part 加载失败时，控制台必须出现 `[GPT-SoVITS TAVO runtime loader]` 错误，不应静默失败。
- 拆分后消息卡片、设置页、音色选择器、历史音频和生成流程行为应与拆分前一致。

## Runtime Manifest 回归

- Phase 1 之后，`static/tavo.runtime.js` 不应再把硬编码 `PARTS` 数组作为唯一模块来源；模块列表应来自 `static/tavo.runtime.manifest.json`。
- `/static/tavo.runtime.manifest.json` 必须返回 200，Content-Type 必须是 JSON 或可被浏览器按 JSON 解析。
- manifest 必须包含 `schema`、`runtimeVersion`、`mode`、`modules`；每个 module 必须有唯一 `id`、`file`、`depends`。
- loader 必须能检测重复 module id、缺失依赖和循环依赖，并在控制台打印 `[GPT-SoVITS TAVO runtime loader]` 错误。
- 正常 manifest 下，21 个旧 parts 仍应按依赖拓扑顺序拼接执行，真实 Tavo 行为应与 ordered array 版本一致。
- 如果 manifest 请求失败，loader 可以回退内置 ordered list，但必须打印 warning；真实 Tavo 回归没通过前不能进入 Phase 2。

## 2026-06-01 真实端回归新增

- 更新正则到当前 `static/tavo.js` 版本（目前 `v=2028881916`）后，移动 WebView 多音色 live 首次播放不应先报 `element audio.play() 不支持`；首路径应直接是 Web Audio。
- 勾选“保存到本机缓存”后，同一条已保存音频首次播放完成解码，再连续拖动进度条；日志不应重复请求同一 `/cache_audio/{key}` 或 `/tts_dialogue_stream_job/{key}`。
- LLM 拆段缺角色失败后，补角色映射再点生成；第二次必须命中“复用 LLM 拆段”，不能重新请求 `/parse_text`。
- 设置页合成档位必须显示 `极限质量`，不能出现 `极致/离线`。
- 用 cache `c23aca2bd05f294a1a0bf8152395886d9e4bbcc9` 的同文本重新生成：检查 `白产品经理，你今晚在公司到底给她灌了多少啊？` 不再吞前半句；`女声/风韵少妇` 段电平不能再明显小于旁白约 10 dB。

## BUG-018 Live Stream 中断回归

- 在真实 Tavo/LDPlayer 上重新触发多音色 live stream，必须记录新的 `cache_key`、角色映射、voice profile、`sample_steps`、`batch_size`、Tavo 控制台日志和 adapter log tail。
- 成功路径：`/tts_dialogue_job_status/<cache_key>` 最终必须返回 `state=done`、`cached=true`，且 `outputs/cache/<cache_key>.wav` / `.json` 存在。
- Profile 前置失败路径：如果实际会用到的 voice profile 参考音频不在 3-10 秒内，POST `/tts_dialogue_stream_job` 必须直接返回 400 和明确错误，例如 `音色 '男声/霸道青年' 的参考音频时长 1.61s，不在 GPT-SoVITS 要求的 3-10s 范围内`；不能创建 live job，不能启动 Web Audio 后才表现成 `IncompleteRead`。
- 失败路径：如果官方 GPT-SoVITS 上游断流，新 key 必须返回 `state=failed` 和明确错误；`outputs/logs/gsv_tavo_adapter_lan.out.log` 必须出现 `[gsv_adapter] dialogue_stream_failed`，错误应包含 segment index/role/text preview 以及 official stream 读取到的 bytes/chunks。
- 不要用旧 key `eda219ac41c210002f57480cab469d26fc163d6f` 验证本条；adapter 重启后旧内存 job 丢失，返回 `missing` 是预期状态。

## BUG-019 音符新建音频回归

- 更新真实 Tavo 正则到 `v=2028881916` 后，同一条消息连续点两次音符/新增按钮：两次都必须 POST 新 TTS job，并返回不同的 `cache_key`。
- 勾选“复用 LLM 拆段”时，第二次可以复用 parse 结果，但不能复用旧 TTS 音频；`/tts_dialogue_stream_job` 不应因为同 payload 返回旧 cache 的 `cached=true`。
- 打开已有历史的消息卡片时，不应自动选择/读取历史音频；只显示历史条数和“可恢复上次音频”提示。
- 播放按钮、上一条、下一条仍可读取历史音频；音符按钮只追加新音频，不把当前 track 切回旧历史。
- 单音色强制新建也要检查：同文本连续点音符应返回不同 cache key，不能命中同一个 IndexedDB offline key。

## BUG-020 懒加载播放器过渡回归

- 更新真实 Tavo 正则到 `v=2028881916` 后，首次点懒加载播放键时，懒加载卡片必须保持到 CSS skin 加载完成，不能出现未套样式的白色方块按钮、裸 range/input 或无卡片背景的中间态。
- 有历史音频时，首次点懒加载播放键应继续触发完整播放器的播放路径；不能只打开播放器停在“可恢复上次音频”。
- Tavo 控制台若出现 `UI skin CSS 加载失败` 或 `UI skin CSS 等待超时`，必须记录 URL 和截图，优先查 `/static/tavo.ui.skin.default.css?skin_v=...` 是否 200。

## BUG-021 懒加载后音色选择器回归

- 更新真实 Tavo 正则到 `v=2028881919` 后，点击懒加载卡片打开完整播放器，不点播放生成，立即点设置齿轮再点任一音色按钮。
- 音色选择器应保持打开；不能出现 picker 短暂打开后 50-500ms 内被关闭，且设置页也消失的状态。
- 本地 CDP narrow smoke 应看到 `.idx-picker[open]` 在 click 后至少 1s 仍为 true，manifest 仍加载 21 个 modules。

## BUG-022 真实 Tavo 脚本来源回归

- 真实 Tavo 控制台的脚本来源必须是当前 HTTPS loader：`https://sovits.928886540.xyz/static/tavo.js?v=2028881919`。
- 生成前确认前端请求 `/parse_text` 的 base URL 与 adapter health URL 一致；不能继续打到旧子域名或旧 `v=2028821788`。
- 手机/Tavo WebView 必须能访问同源 `/health`、`/static/tavo.js`、`/static/tavo.runtime.manifest.json`、`/static/tavo.runtime.js` 和 `/parse_text`；否则先查 Cloudflare Tunnel / WebView / 正则缓存。

## BUG-023 sovits 小写命名回归

- 活跃 runtime/test/docs 入口统一使用小写 `sovits`；正则入口使用 `https://sovits.928886540.xyz/static/tavo.js?v=2028881919`。
- 新历史 tracks 写入 `sovits_tracks_<messageId>`；旧历史 tracks 仍能读取并在后续刷新中迁移到新 key。
- 新离线音频 IndexedDB 使用 `sovits_tavo_audio_v1`；旧离线音频库仍能读取，删除当前 track 时新旧库都应清理对应 `cache:<key>`。
- 允许历史报告、旧对比资料和 voice profile provenance 保留旧产品名；不要把这些历史来源当成活跃 runtime 残留。

## BUG-024/025/026 Tavo AR 动态 loader 与 /parse_text 回归

- 真实 Tavo 控制台脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881923`，loader 版本 `20260602-sovits-xhr-post-v33`，runtime manifest/parts `20260602-sovits-xhr-post-v15`。
- 点击懒加载卡片后，应请求 `GET /static/tavo.runtime.js?...`、`GET /static/tavo.runtime.manifest.json?...`、21 个 `GET /static/tavo.runtime.parts/*.js?...` 和 CSS skin。
- 动态 loader 必须按当前入口脚本 `src` 派生同源 base，不是外网专用：入口从 LAN 加载时，runtime/manifest/parts 走 LAN；入口从 `sovits.928886540.xyz` 加载时才走 HTTPS origin。
- 页面不能创建或显示 iframe；`static/tavo.fetch.bridge.html` 不应存在也不应被请求；不应请求 `tavo.runtime.bundle.js`；不应出现 RPC/WebSocket/JSONP 绕行层。
- `/parse_text` 单独验证：真实 Tavo 智能生成必须通过 XHR `text/plain;charset=UTF-8` POST 让 adapter 收到 `/parse_text`。如果失败，不改 runtime 模块架构；如果报错变成 `LLM parse failed` / `auth_unavailable`，说明请求已到后端，下一步查 LLM endpoint/model/key。

## 普通模式 / 智能模式回归

## BUG-027 LLM 拆段复用回归

- 真实 Tavo 正则脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881924`，loader 版本 `20260602-sovits-llm-reuse-v34`，runtime `20260602-sovits-llm-reuse-v16`。
- 同一消息已有 LLM 拆段缓存时，把 LLM endpoint/model/key 改成不可用值后再次点生成，必须显示“复用 LLM 拆段”，adapter 日志不能出现新的 `POST /parse_text`。
- 在设置页修改 LLM endpoint/model/key 后保存，下一次非复用生成的 debug 日志必须显示页面当前 endpoint/model，不能继续使用旧配置。
- 如果复用未命中，才允许请求 `/parse_text`；这时后端 LLM 错误应按 endpoint/model/key 单独处理。
- 后端 `/parse_text` 必须使用 Tavo 请求里的 endpoint/model/api_key 优先，env 只能兜底。`/llm_config` 显示 env 默认旧模型不等于实际请求会用旧模型；用直接 POST 指定新模型验证时应能覆盖 env。
- 真实 Tavo/LDPlayer 非复用生成时，adapter 日志应出现 `POST /parse_text 200 OK`。若下一步 `/tts_dialogue_stream_job` 返回 400，按 voice profile 校验处理，不再回头查 LLM 链路。

## BUG-028 服务端失败提示回归

- 真实 Tavo 正则脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881926`，loader 版本 `20260602-sovits-server-error-v36`，runtime `20260602-sovits-server-error-v18`。
- 复现官方 GPT-SoVITS 推理失败时，如果 `/tts_dialogue_job_status/<cache_key>` 返回 `state=failed` 且 error 包含 `official API HTTP 502`，播放器卡片必须显示“服务端推理失败”和“官方 GPT-SoVITS 推理接口返回 502”，不能显示“音频流格式异常”。
- 如果 Web Audio 先报 `[step:wavHeader] WAV 头未到先断流`，这只能显示为“服务端未返回音频流首包，正在确认服务端合成状态”；随后 job status failed 必须覆盖成服务端失败原因。
- `pollCacheUpgrade()` 进入 failed 分支后不能再把同一任务当成等待落盘超时；track 状态、cache 状态、playback 状态都应变成 failed/error，并写回 Tavo 历史。

## BUG-029 official 9881 代理污染回归

- 在有 `HTTP_PROXY=http://127.0.0.1:7897` 的环境里，普通 `urllib.request.urlopen("http://127.0.0.1:9881/docs")` 可以复现代理空 body 502；adapter 的 official 调用必须绕过这个代理。
- `curl.exe --noproxy "*" -s -i http://127.0.0.1:9881/docs` 必须返回 200；如果 9881 没监听，应先启动任务计划 `GPT-SoVITS Official API 9881`。
- `python -c "import gsv_tavo_adapter as a; print(a._official_should_bypass_proxy())"` 默认官方 URL 下必须输出 `True`。
- 用 `女声/冰山美人` 和文本 `高圆圆躺在床上，心跳狂乱。` 直接调用 official `/tts` 应生成 WAV，不能返回代理 502。
- 同文本走 adapter `/tts_dialogue_stream_job` 的 queued 路径应最终 `state=done/cached=true`；live `streaming_mode=2` 路径也应最终 `state=done/cached=true`。
- 如果以后 `official API HTTP 502:` body 为空再次出现，先检查 adapter 是否加载了 no-proxy 代码、9881 是否由任务计划常驻、进程环境代理是否变化；不要先改 Tavo AR 前端。

## BUG-030/031/032 历史恢复与歌词点击回归

- 真实 Tavo 正则脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881927`，loader 版本 `20260603-history-restore-v37`，runtime `20260603-history-restore-v19`。
- 关闭 Tavo 后重新进入有 1 条以上历史音频的消息：懒加载卡片和完整播放器都必须显示 `历史音频 N 条`；完整播放器日志应是 `恢复历史 tracks 元数据...未读取音频/未补写本机缓存/未轮询落盘`。
- 重进消息但未点播放时，UI 不能显示 `读取已保存音频`，adapter 日志不能出现 `/cache_audio`、`/tts_dialogue_job_status` 或 IndexedDB 本机缓存补写请求。
- 点播放后才允许显示 `读取已保存音频` 或 `读取本机缓存`；如果 IndexedDB 副本保存失败，只能提示“本机缓存副本保存失败，在线播放不受影响”，不能阻断在线历史音频播放。
- 新 key `sovits_tracks_<messageId>` 为空、旧 key 有历史时，应显示旧历史条数，并迁移写回新 key；不能被空数组抢占成 0 条。
- live 流式播放时点击歌词行不能重连音频，不能触发 `play snapshot` 刷屏；应提示“流式播放中，歌词跳转需等完整音频保存后使用”。落盘后的 saved 音频才允许歌词/进度跳转。
- 新建单音色/多音色生成如果后端返回非 2xx 空响应，UI 必须显示 `TTS job 后端返回 HTTP xxx，响应为空` 这类可读错误，不能显示 `错误: Error`。

## BUG-033 历史卡片/播放状态机回归

- 真实 Tavo 正则脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881929`，loader 版本 `20260603-state-model-v39`，runtime `20260603-state-model-v21`。
- 打开有历史的消息但尚未读取 tracks 时，懒加载卡片和完整播放器必须明确显示 `历史音频 N 条`；右上角不能长期显示含义不清的 `0/N`。
- 上一条/下一条只切换当前卡片，必须立即刷新到 `N/N`；未点播放时不能请求 `/cache_audio`、不能显示 `读取已保存音频`、不能把播放按钮置为 loading。
- 点播放读取 saved 历史时，如果失败，UI 必须显示具体阶段：`cache 请求 HTTP`、`已保存音频读取失败`、`内容读取失败`、`解码失败` 或 `音频通道未放行`，不能只显示“播放失败”或转圈。
- live 生成/播放切后台或切卡时，暂停提示只能表达一个状态：后台继续保存，点播放再续播或读历史；不能一会儿“播放可继续”、一会儿“不会恢复流式”。
- live 歌词没有真实 `segments_meta/start_s/duration_s` 前，只能显示“歌词时间轴校准中”，不能高亮假同步，也不能点击歌词跳转。拿到真实时间轴后再恢复同步/跳转。
- 设置页和音色选择器应覆盖在播放器卡片位置附近，由播放器 rect 定位；不能固定贴在屏幕最底部。
- LDPlayer 快照验证路径：刷新正则到 `v=2028881929`，点击懒加载文字区域打开播放器，不点播放生成；打开设置页截图；按上一条/下一条截图；记录 `dev_tools/tavo_debug/emulator_screen_*` 和 adapter log tail。

## BUG-034 删除到空和无声假播放回归

- 真实 Tavo 正则脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881930`，loader 版本 `20260603-delete-audio-v40`，runtime `20260603-delete-audio-v22`。
- 连续删除当前消息里的所有历史音频，最后一条删除后完整播放器必须立即显示 `历史音频 0 条` / `0/0`，不能继续显示旧 `4条`。
- 删除到空后关闭/重进 Tavo，同一条消息不能从 `sovits_tracks_*`、旧 `indextts_tracks_*` 或 global 变量里读回旧历史。
- 删除到空后点播放会新建 live 生成，这是允许的；但只有 `AudioContext.state === "running"` 后才允许显示 playing 和推进进度。未放行时必须显示 `音频通道未放行`，不能出现进度走但无声。
- saved 历史音频 Web Audio 复播同样要验证：解码成功但 AudioContext 未 running 时不能显示正在播放。

## BUG-035 Tavo 切画面/桌面音频生命周期回归

- 真实 Tavo 正则脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881932`，loader 版本 `20260603-audio-keepalive-v42`，runtime `20260603-audio-keepalive-v24`。
- 新建流式播放时，从用户点击到首段 PCM 到达之前，控制台应出现 `AudioContext keepalive started`；首段真实音频进入 playing 后应出现 keepalive stopped。等待首段期间不能直接报 `音频通道未放行`。
- v1934 后 live 播放过程中切到 Tavo 其他页面或系统桌面，前端不能主动删除任务；如果 WebAudio 被宿主挂起，应请求后台合成并等待 saved/history，不自动叠出第二路音频。
- v1934 后返回当前消息时，未完成 live 仍是特殊临时卡片，不能恢复成历史卡片；只有 saved track 才能进入历史条数。
- 触发 `音频通道未放行` 后，下一次用户点击播放/生成必须创建新的 AudioContext；不能切任何一条都继续提示未放行。
- saved 历史音频按 BUG-036 新策略验证：前端不主动暂停，允许 Tavo/系统后台策略决定是否继续；如果宿主自行暂停，回来点播放继续，不能重复播放、不能进度假走。

## BUG-036 live/history 后台与切卡策略回归

- 真实 Tavo 正则脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881934`，loader 版本 `20260603-live-background-v44`，runtime `20260603-live-background-v26`。
- saved/history 音频播放时切 Tavo 页面或系统后台，前端不能主动调用 pause/reset；如果宿主允许后台播放，应继续出声。
- 如果宿主自行暂停 saved/history，返回后点播放应继续当前 saved track，不能新建 live、不能叠第二路。
- live/pending 流式播放时普通控制按钮必须隐藏，只显示 `退出流式`；上一条/下一条/播放/新增/删除不能被点击到。
- live/pending 在 `visibilitychange/pagehide`、用户暂停、`audio_suspended`、首段 90 秒超时、连续缓冲或网络流中断时，前端不能主动删除；应保留 live 卡片、请求后台合成并轮询保存状态。
- live 未完成时点 `退出流式` 必须删除当前 live 卡片和服务端任务/cache，且不写入历史。
- live 已播放结束或 job status done 后点按钮应进入/等待 saved history，不能删除。
- 未完成 live 不能写入 `sovits_tracks_<messageId>`；关闭/重进消息后，懒加载卡片和完整播放器只显示已 saved 的历史条数。
- 只有 job status done 或 saved track 才能保存进历史；成功落盘后仍能按 saved/history 规则播放、seek、显示历史条数。
- 如果流式响应被宿主关闭且前端已请求后台合成，adapter 日志应出现 `dialogue_stream_background_queued`，状态最终必须进入 done/failed，不能长期 stuck running。

## BUG-037 LLM role 信任与音色映射回归

- 真实 Tavo 正则脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881936`，loader 版本 `20260603-llm-role-trust-v46`，runtime `20260603-llm-role-trust-v28`。
- 智能模式生成时，前端日志不能再出现 `无引号正文强制归旁白`。
- `/parse_text` 返回的 `segments[].role` 如果是 `用户`、`白夜雨` 或其他已映射角色，前端提交给 `/tts_dialogue_stream_job` 的 `segments` 必须保留该 role，不能因没有引号被 JS 改成 `旁白`。
- adapter 日志 `[gsv_adapter] official_tts` 的 `voice` 必须等于该 role 在 voicesMap 里的音色；例如 `用户/白夜雨 -> 男声/忧郁少年`。
- 前端从 `/tts_dialogue_job_status` 读取 `segments_meta` 后，track.segments 必须保留 `voice` 字段；播放状态栏应优先显示服务端实际 voice，不能只按本地映射猜。

## BUG-038 live 后台状态、歌词和指标回归

- 真实 Tavo 正则脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881937`，loader 版本 `20260603-live-status-metrics-v47`，runtime `20260603-live-status-metrics-v29`。
- 点击懒加载后 manifest 仍应加载 21 个 runtime modules；`static/tavo.runtime.manifest.json` 返回的 `runtimeVersion` 必须是 `20260603-live-status-metrics-v29`。
- live 播放时切 Tavo 控制台日志页、Tavo 其他页面或系统后台，前端不能仅因 `visibilitychange/pagehide/pageshow` 写“流式后台继续”，也不能仅因此请求 `/tts_dialogue_stream_job/<cache>/background`。
- 如果宿主允许后台播放，live/saved 音频应继续出声；如果真实 WebAudio 挂起、网络流中断、连续缓冲或首段等待超时，才允许进入“后台继续保存”兜底并轮询 job status。
- live 生成开始后，即使还没有精确 `segments_meta`，歌词区域也必须先显示粗略歌词行并按播放时间高亮；粗略时间轴不能点击 seek。job done 后必须从 `segments_meta` 校准歌词并在 saved/history 阶段允许 seek。
- job done 或历史恢复后，指标文案必须至少包含：档位、steps、batch、采样率、RTF、音频时长、总耗时、段数；如果原始 LLM 段数和合成段数不同，还要显示原始段数。
- `/tts_dialogue_job_status/<cache_key>` 返回的 `metrics` 必须包含 `performance_mode`、`sample_steps`、`batch_size`、`sample_rate`、`segments_done`、`segments_total`、`source_segments_total`；旧 cache 也应能从 metadata.request 补齐这些字段。
- Whisper 质量检查：旧 cache `7230be132b08365af4db14ece6a13a8f2183c1bd` 的报告在 `reports/whisper_cache_7230be132b08365af4db14ece6a13a8f2183c1bd_20260603/`；新同类生成应确认相邻同角色/同声腔短对白不再被拆成 1 秒左右小段。

## 旁白 artwork 回归

- 真实 Tavo 正则脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881938`，loader 版本 `20260603-narrator-art-v48`，runtime `20260603-narrator-art-v30`。
- `/static/tavo.assets/narrator.png?asset_v=20260603-narrator-art-v30` 本地和公网都必须返回 200，图片尺寸应为 1024x1024 PNG；公网裸 `/static/tavo.assets/narrator.png` 短时间可能命中 Cloudflare 旧 404 缓存，不作为失败判定。
- 播放到 `role="旁白"` 的 segment 时，播放器左上角 cover 应显示新的开书/声波图。
- 系统后台/锁屏 MediaSession artwork 对旁白段也应使用同一张图。
- `用户` 和普通角色的默认 avatar 不应改变：用户仍走 `userAvatarUrl || DEFAULT_AVATARS.user`，角色仍走 `avatarUrl || DEFAULT_AVATARS.character`。

- 前端主模式文案应显示“普通模式”和“智能模式”，不再把产品入口叫“单音色 / 多音色”。
- 普通模式生成前必须使用 JS 清洗后的正文，验证脚本标签、隐藏块、markdown 噪声、emoji/符号被剔除，但正文对白和旁白不被误删。
- 普通模式设置页必须能配置默认音色、旁白音色、对白音色；生成时记录实际使用的 voice，并确保 cache key 区分正文、模式、音色和推理参数。
- 智能模式仍走 LLM 拆段，角色映射、声腔、复用拆段缓存逻辑不能被普通模式改动破坏。

## iPhone 14 Pro 真机弹层回归

- 设置页和音色选择器必须在 iPhone 14 Pro 真机 Tavo WebView 内保持稳定宽度和中等固定高度，不能显示成一条很长的窄面板，不能横向撑开，不能接近全屏长面板。
- 两个弹层底部圆角必须可见，不能贴死屏幕底部导致看起来像长条；选择音色页一页显示 10 个音色项。
- 设置页打开后，点面板边缘、右上附近、滚动区空白处不能误关闭；只有设置页自己的 `×` 或保存按钮能关闭设置页。
- 从设置页进入 `选择音色` 后，点音色选择器右上 `X` 只能关闭当前音色选择层，并返回上一层设置页，不能直接回播放器。
- 音色选择器内点分类 tab，例如 `日日新`、`全部`，以及搜索框、音色卡片、右侧 `√`，都不能被 document 外部点击守卫误判为外部点击。
- 复测必须用 iPhone 真机或等效 iOS WebView；LDPlayer 通过不能替代这组回归。

## iPhone 长时间挂机复播回归

- iPhone 14 Pro 真机进入后台或长时间挂机后回到 Tavo，点复播已保存音频，不应长时间停在 loading。
- 解码完成后必须真实出声；如果 `AudioContext.state` 仍不是 `running`，前端必须显示明确失败状态和日志，不能把 track 标记为 playing。
- 记录播放点击后的 `AudioContext.state`、`resume()` 前后状态、`play()` reject、loader loaded 次数和“已解码保存音频”次数。

## 音频质量检查

生成后的 WAV/MP3：

1. 用 Whisper CLI 转写。
2. 把转写文本、参数、RTF、输出路径写进 `reports/...`。
3. 人工试听确认错词、复读、噪音、抽吸、音量异常和情绪是否达标。

## 回归记录规则

如果 bug 复发：

- 在 `docs/BUGS.md` 更新原条目，不新开重复条目。
- 在本文件补一条更硬的 Guard。
- 修复提交必须带可重复命令、真实端截图或报告路径。

## 失效 cache 状态检查

- 对任一已生成但 WAV 文件不存在的 cache key，请求 /tts_dialogue_job_status/<cache_key> 必须返回 state=missing、cached=false、空 cache_url。
- 不能只看内存里的 job 记录；cache 丢失时前端必须把它当作失效历史音频。
- 复测时同时检查 /cache_audio/<cache_key>、/tts_dialogue_stream_job/<cache_key> 的 HEAD 和 Range。


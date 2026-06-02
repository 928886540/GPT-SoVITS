# Bugs

记录格式：

```text
## BUG-000: title

Status:
Repro:
Root cause:
Fix:
Guard:
Notes:
```

流程规则：

- 用户每报一个新 bug，先在本文件新增或更新条目，再动代码。
- 根因未确认时写 `Status: open, investigating`，把截图/日志/复现现象和假设分开写。
- 改 bug 前先读本文件，避免同一个问题反复改、重复编号或丢掉已知上下文。

## BUG-001: 保存音频自动播放被 WebView 手势策略拦截

Status: partially fixed, needs real mobile regression

Repro: 真实 Tavo 中生成单音色后自动播放，历史日志出现 `play() can only be initiated by a user gesture`。

Root cause: WebView 对 `audio.play()` 有用户手势限制；缓存和 metadata 已加载不代表可以自动播放。

Fix: 当前代码引入点击路径播放、保存音频状态检查和 Web Audio fallback。

Guard: 真实 Tavo 点消息卡片播放已保存音频，确认进度推进；记录 cache key 和截图。

## BUG-002: 用户要删 10 秒快退/快进 UI，却误删历史上一条/下一条

Status: fixed in current UI, needs real Tavo check

Repro: 用户要求去掉前进/后退 10 秒按钮；之前实现理解成上一首/下一首。

Root cause: 播放器“历史上一条/下一条”和“10 秒 seek”概念混淆。

Fix: 可见 UI 保留上一条/下一条历史音频；10 秒 seek 只允许保留在后台、键盘或 MediaSession 能力里。

Guard: 真实 Tavo 播放器截图确认只有上一条/播放/下一条/生成/删除，没有可见 10 秒按钮。

## BUG-003: 音色选择器单击直接应用，导致不能试听

Status: implemented, needs real Tavo check

Repro: 打开音色选择器，点击音色卡片会直接替换角色映射。

Root cause: picker item click 同时承担试听和应用。

Fix: 单击 item 只试听；只有点击右侧 `√` 才应用到默认音色或角色映射。

Guard: 真实 Tavo 中点音色卡片先播放 `/voice_preview`，角色映射不变；点 `√` 后映射才改变。

## BUG-004: iOS 设置页横向撑开

Status: patched in code, needs iPhone 14 Pro regression

Repro: iPhone 14 Pro 真机 Tavo 打开 GPT-SoVITS 设置页，设置面板在屏幕内显示成很长一条/宽度异常，内容被横向撑开或只剩中间窄区域可见。用户截图时间 2026-06-01 20:17，页面标题 `BoBo`，设置页可见 `LLM 配置` 与 `复用 LLM 拆段`。另有（用户 2026-06-01）：面板高度随内容忽长忽短、打开/切换时上下跳动、未稳定底部对齐。

Root cause: 原 panel/picker CSS 依赖 `dialog` + `position: fixed` + `dvw/dvh` + transform 居中；iPhone Tavo WebView 的视觉视口、安全区和 transform 祖先处理与 LDPlayer 不一致。仅靠模拟器验证会漏掉该问题。

Fix: `static/tavo.ui.skin.default.css` 已移除面板/picker 的 `dvw/dvh`、`left:50%`、`translateX` 布局风险；改成左右安全区 inset + 固定底部 sheet。2026-06-02 用户反馈上一版 `82vh` 仍然“特别长”，已把设置页高度改成明确固定值：桌面/宽屏 `560px`，iPhone 窄屏 `520px`。随后用户指出选择音色页也要固定高度、底部圆角必须可见，已把 picker 改为宽屏 `520px`、窄屏 `500px`，两个弹层都保留四角圆角并离底部至少 `8px/safe-area`；内容只在面板内部滚动。`static/tavo.runtime.parts/54_voice_picker_panel.js` 的 picker page size 改为 10。

Guard: 必须用 iPhone 14 Pro 真机或等效 iOS WebView 截图确认：设置页左右 inset 稳定、无横向滚动、内容不被压成超长窄条，`LLM 配置`、`复用 LLM 拆段`、保存按钮都在面板内正常显示。

Notes: 不要把 LDPlayer 正常当作 iPhone 正常；真实 iPhone 是这个 bug 的准绳。

目标规格（用户 2026-06-01，指导本 bug 修复）：
- 固定高度：面板高度不随内容多少变化，不忽长忽短。
- 底部对齐：贴底固定，打开/关闭/内容变化时不上下跳动。
- 尺寸：与播放器卡片同量级、仅略大；宽度与播放器一致，不撑满全屏、不变形、无横向滚动。
- 内容超高时面板内部滚动，面板外框高度与位置保持不变。
- 仍需 iPhone 14 Pro 真机验证。

## BUG-005: 局域网手机播放 audio error code=4 / play unsupported

Status: fixed in current code, needs real mobile regression

Repro: 手机局域网访问 `/tts_dialogue_stream_job/{cache_key}` 或 `/cache_audio/{cache_key}`，出现 `audio error code=4` 或 `audio.play() 不支持: The operation is not supported.`。

Root cause: `/tts_dialogue_stream_job/{cache_key}` 的 GET 在 cache 命中时能返回 WAV/Range，但 HEAD 探测返回 405；同时前端只给 saved cache 的 audio 元素失败做 Web Audio fallback，live/stream_job URL 的 code=4 或 NotSupported 会直接进入失败状态。

Fix: 给 `/tts_dialogue_stream_job/{cache_key}` 增加 HEAD，cache 命中时返回和 GET 一致的 `audio/wav`、Range 元信息和 `X-GPT-SoVITS-Cache-Key`；前端对 live track 的 audio 元素 error / NotSupported 标记 `forceWebAudioLive`，改走 Web Audio，并继续保留 cache upgrade 轮询。

Guard: iOS/Android WebView 真实播放同一 cache，记录 URL、response headers、是否走 Web Audio、截图和日志；本地必须验证 `/cache_audio/{key}` 与 `/tts_dialogue_stream_job/{key}` 的 HEAD、Range 都可用。

## BUG-006: 多音色验证被单音色片段冒充

Status: process guard

Repro: 只用单音色生成片段，却声称多音色流程通过。

Root cause: 缺少真实消息触发和角色/style 映射证据。

Fix: 每次多音色验证必须记录 segments、voices map、cache metadata、Whisper 输出和人工听感。

Guard: `docs/REGRESSION.md` 的真实端验证清单。

## BUG-007: 质量优先档命名不准

Status: open

Repro: 当前 `batch_size=4` / `sample_steps=16` 被叫质量优先，但真实多音色 RTF 仍有余量，实际更像标准档。

Root cause: 档位按主观命名，没有同文本同角色对照实测。

Fix: pending。需要测试 `sample_steps=24` 和 `sample_steps=32`，保存 WAV、Whisper 输出和人工听感。

Guard: 同文本、同角色、多音色流程下比较 RTF、噪音、尾音、情绪和稳定性。
## BUG-008: 失效 dialogue cache 仍被状态接口报告为 done

Status: fixed, needs stale-cache regression

Repro: 生成过的多音色任务在内存 `JOBS` 里仍是 `done`，但对应 `outputs/cache/<key>.wav` 已丢失或被清理时，请求 `/tts_dialogue_job_status/{key}` 仍返回 `state=done`，前端会继续把它当成可播放历史音频。

Root cause: 状态接口把内存 job state 当最终状态；没有在 cache 文件不存在时把终态 job 收紧为 `missing`。

Fix: `/tts_dialogue_job_status/{key}` 现在只有真实 cache 文件存在才返回 `done`；无文件时只保留 `queued` / `deferred_stream` / `running` 这些活跃状态，其它状态统一返回 `missing`。

Guard: 构造或复用一个无 WAV 的历史 cache key，请求 `/tts_dialogue_job_status/{key}` 必须返回 `state=missing`、`cached=false`、空 `cache_url`；前端应显示“历史音频已失效”，不继续播放旧 URL。

## BUG-009: 移动 WebView 流式播放先走 audio 元素导致失败和长等待

Status: fixed in code, needs real Tavo reload check

Repro: 真实 Tavo 里点流式播放，日志出现 `element audio.play() 不支持: The operation is not supported`，随后切 Web Audio，但用户等待约 80 秒且需要反复点击才开始播放。

Root cause: 多音色 live track 在移动 WebView 里先尝试 `<audio>` 元素；该容器不支持当前流式 WAV 播放，失败后才 fallback 到 Web Audio，浪费一次播放手势和状态。

Fix: `static/tavo.runtime.js` 对移动端多音色 live track 直接使用 Web Audio，不再先走 `<audio>` 元素。

Guard: 真实 Tavo 更新到当前 `static/tavo.js` 正则版本（目前 `v=2028881916`）后，首次点播放不应再出现 `element audio.play() 不支持` 作为流式首路径。

## BUG-010: 已保存音频拖进度仍重新拉音频

Status: fixed in code, needs real Tavo reload check

Repro: 勾选保存到本机缓存后，拖播放器进度条仍显示重新连接/读取音频并卡顿数秒。

Root cause: Web Audio 播放已保存 WAV 时每次 seek 都重新 fetch + 跳过前置 PCM；IndexedDB 只保存 blob，没有复用已解码的 `AudioBuffer`。

Fix: 已保存音频改为首次播放时解码并挂到当前 track；后续 seek 直接复用 `decodedAudioBuffer` 从目标 offset 起播。播放前也会优先 hydrate IndexedDB 本机缓存。

Guard: 同一条已保存音频首次起播后，连续拖动进度条不应再次请求 `/cache_audio/{key}` 或 `/tts_dialogue_stream_job/{key}`。

## BUG-011: 新增角色映射后 LLM 拆段复用失效

Status: fixed in code, needs real Tavo reload check

Repro: 勾选复用 LLM 拆段。第一次生成因缺少某人物音色映射失败；补角色后第二次仍重新 AI 分析。

Root cause: LLM 复用 fingerprint 包含角色映射列表；用户补一个缺失角色会改变 fingerprint，导致刚保存的拆段缓存无法命中。

Fix: 复用 fingerprint 去掉角色映射列表，只保留文本、用户/角色身份和 LLM endpoint/model；同时增加文本级 key，降低 Tavo message id 变化导致的失配。

Guard: 缺角色失败后补映射，第二次同消息应显示“复用 LLM 拆段”，不重新请求 `/parse_text`。

## BUG-012: 长对白片段吞字且风韵少妇音量明显偏低

Status: partially fixed in code, needs regeneration + ASR/listening check

Repro: cache `c23aca2bd05f294a1a0bf8152395886d9e4bbcc9` 第 20 段 metadata 文本是 `晚棠平时可是个有洁癖的人，能让她忍着一路走到这儿……白产品经理，你今晚在公司到底给她灌了多少啊？`；Whisper 输出漏掉 `白产品经理，你今晚在公司`。同 cache 里 `女声/风韵少妇` 段 RMS 约 `727/814`，旁白 `女声/冰山美人` RMS 约 `2756/2930`。

Root cause: 长对白作为单个 GPT-SoVITS segment 合成时更容易漏前后短语；`女声/风韵少妇` 当前参考音色输出整体电平明显低于旁白音色。

Fix: 前端在提交合成前把长 segment 按标点拆成更短 TTS 段；`女声/风韵少妇` voice profile 增加 `post_gain_db=9.0`，adapter 对该 profile 输出 PCM 做后处理增益。

Guard: 用同文本重新生成新 cache，Whisper 不应再漏 `白产品经理，你今晚在公司`；同时比较小薇段与旁白段 RMS，不应再相差约 10 dB。

## BUG-013: 合成档位文案“极致/离线”误导

Status: fixed in code, needs real Tavo reload check

Repro: 设置页合成档位显示 `极致/离线`，容易被理解成“极致”和“离线”是同一个概念或奇怪模式。

Root cause: 档位名和播放缓存能力混在一个 label 里。

Fix: 档位改为 `极限质量`；播放缓存区域改为 `播放缓存` / `保存到本机缓存`。

Guard: 真实 Tavo 设置页不再出现 `极致/离线`。

## BUG-014: iPhone 设置页/音色选择器外部误触会关闭弹层

Status: patched in code, needs iPhone 14 Pro regression

Repro: iPhone 14 Pro 真机 Tavo 中打开 GPT-SoVITS 设置页，点到设置页旁边或稍微靠右上角的区域，设置页会突然退出。打开音色选择器后，点击顶部分类 tab 附近例如 `日日新`，也可能被当成外部点击导致弹层关闭。

Root cause: 原 `installLayerDocumentGuard` / `installPickerDocumentGuard` 用 document 捕获阶段判断 `target.closest('.idx-panel')` / `target.closest('.idx-picker')`，在 iOS Tavo WebView 的 dialog/body 重挂载、视觉视口偏移、透明区域和事件 retargeting 下会误判内部点击为外部点击。外部点击关闭策略在真机上风险高。

Fix: 设置页和音色选择器已取消外部点击关闭策略，并移除 document 外部点击关闭监听。面板/picker 根节点只在冒泡阶段阻止事件继续到宿主，避免捕获阶段拦截按钮、tab、搜索框自己的事件。现在只有设置页 `×`、保存、picker `×`、应用这些明确路径会关闭对应层级。

Guard: iPhone 14 Pro 真机验证：打开设置页后，点面板边缘、右上附近、滚动区域空白处都不能关闭；打开音色选择器后点 `日日新`、`全部`、搜索框和音色卡片不会意外退出。

Notes: 这个 bug 和 BUG-004 相关但不是同一个问题；BUG-004 是尺寸/布局，BUG-014 是事件误判/关闭策略。

## BUG-015: 音色选择器 X 关闭层级错误

Status: patched in code, needs iPhone 14 Pro regression

Repro: 从设置页进入 `选择音色` 弹层后，点击右上 `X`。用户预期是关闭当前音色选择层，返回上一层设置页；当前行为会直接回到播放器/聊天层，相当于退出全部设置流程。

Root cause: 音色选择器关闭逻辑没有稳定保留 `returnPanel` / 上一层 panel 状态，或被外部点击守卫/close path 清掉，导致 `closeVoicePicker()` 没有重新打开设置页。

Fix: picker `X` 和应用路径走 `closeVoicePicker()`，保留 `pickerState.returnPanel` 与 `panelScrollTop`，关闭 picker 后重新打开设置页并恢复滚动位置；`closeVoicePickerForPlayback()` 只用于非法孤立 picker 或播放前关闭，不用于普通 picker `X`。

Guard: iPhone 14 Pro 真机验证：设置页 -> 选择音色 -> 点音色选择器 `X`，应回到设置页并保持原滚动位置；点设置页 `×` 才回播放器。

Notes: 不要把 `closeVoicePickerForPlayback()` 用在普通 picker `X` 路径上。

## BUG-016: 长时间挂机后复播已保存音频卡 loading 且无声

Status: open, investigating（根因未坐实）

Repro: iPhone 14 Pro 真机，长时间挂机（WebView 进后台）后回到聊天，点复播已保存音频。现象：先长时间卡 loading、要播不播；loading 结束后仍然没有声音。截图时间 2026-06-01 20:45，loader `20260601-lan-webview-layer-v17` / `tavo.js?v=2028881887888`，track `state=saved`、`cache_audio/c23aca2bd05f294a1a0bf8152395886d9e4bbcc9`、`duration=142.94s`。

证据（JS 控制台 2026-06-01 20:45 真机截图）：
- `[GPT-SoVITS TAVO loader] loaded` 连续打印 8 次。
- `selectTrack idx=0 state=saved urlSource=cacheUrl src=.../cache_audio/c23a…`。
- `按需恢复历史 tracks: 1 段，未预取本机缓存音频/未轮询落盘`。
- `已解码保存音频: 服务端缓存 duration=142.94s` 连续打印 3 次。

Root cause: 部分坐实（读 static/tavo.runtime.js）。
- 已坐实的代码缺陷：复播保存音频走 `playSavedTrackViaDecodedBuffer`（runtime ~2940）。先 `await decodedBufferForSavedTrack`（fetch + decodeAudioData，多个 await）才在 ~2955 执行 `try { if (ctx.state==="suspended") await ctx.resume(); } catch(_){}`。此时早已脱离用户手势栈，挂机后 ctx 为 suspended，该 resume 在 iOS 会失败且被静默 catch 吞掉；代码仍照常 `source.start()`（~2999）并把 track 标记 playing（~3002）。→ 解码成功（打印"已解码保存音频"）、播放器显示在播，但 ctx 仍 suspended、无声、且不报错。这是"loading 好了一样没声音"的直接原因。
- 待真机日志确认：挂机后 play 手势里 `primeAudioContext()`（~983，play 的 pointerdown/touchstart/click 都调）为何没让 PRIMED_CTX 恢复。怀疑 iOS 长时间后台把 AudioContext 置为 interrupted，老 ctx 即使 resume 也回不到 running，需在手势内重建新 ctx。
- "已解码 ×3"提示 `decodedBufferForSavedTrack` 的解码缓存（~2915 `track.decodedAudioBuffer`）未命中或被多次触发（用户反复点 / 多实例），结合手势后日志判断。

Fix: pending。最小、可观测优先：去掉 ~2955 静默 catch，resume 后检查 `ctx.state`，仍非 running 即按播放失败 `setError` + 打印 `ctx.state`（resume 前后），不再假装 playing。据真机日志坐实后再决定是否在手势内重建 AudioContext。不在坐实前赌修复。

Guard: iPhone 14 Pro 真机，后台挂机足够久后回前台点复播：loading 不应长时间卡死；解码完成后必须出声。记录 AudioContext.state、是否成功 resume、`play()` 是否 reject、loaded/已解码日志次数。

Notes: 与 BUG-001/005/010 同属保存音频播放/Web Audio 链路，但触发条件是「长时间后台挂机」，症状是「解码成功却无声」，单独立条跟踪。

## BUG-017: runtime 拆分后静态 parts 子目录 404

Status: fixed and adapter reload verified

Repro: 将 `static/tavo.runtime.js` 拆成小 loader + `static/tavo.runtime.parts/*.js` 后，本地请求 `http://127.0.0.1:9880/static/tavo.runtime.parts/00_base_config_storage.js` 返回 404，但 `/static/tavo.runtime.js` 返回 200。

Root cause: `gsv_tavo_adapter.py` 的静态路由是 `/static/{name}`，只匹配单段文件名；`_static_file_response()` 也拒绝包含 `/` 的路径。拆分后的 parts 在子目录里，必然无法被 adapter 暴露。

Fix: 静态路由改为 `/static/{name:path}`，并在 `_static_file_response()` 里做安全子路径校验：拒绝空路径、绝对路径、盘符、空段和 `..`，只允许 `.js/.css/.html/.json`，最终仍用 `resolve()` 确认文件留在 `ROOT/static` 下。

Guard: adapter 重启后，`HEAD /static/tavo.runtime.js`、全部 21 个 `HEAD /static/tavo.runtime.parts/*.js` 和 `HEAD /static/tavo.ui.skin.default.css` 都必须返回 200；JS content-type 为 JavaScript，CSS content-type 为 `text/css`；路径穿越如 `/static/../README.md` 必须仍是 404。2026-06-01 已重启 adapter 并验证通过。

## BUG-018: 多音色 live stream 只解析 WAV 头后中断无声

Status: root cause confirmed, adapter preflight patched, needs reload + real Tavo regression

Repro: 2026-06-01 用户在真实 Tavo/雷电中点多音色 dialogue live stream 播放，JS 控制台显示：
- `立即写 tavo.set cacheKey=eda219ac41c210002f57480cab469d26fc163d6f`
- `dialogue live stream 播放: http://192.168.8.100:9880/tts_dialogue_stream_job/eda219ac41c210002f57480cab469d26fc163d6f`
- `[wa] AudioContext state=running sr=48000`
- `[wa] WAV header parsed: sr=48000 ch=1 bits=16`
- `Web Audio 播放时钟已启动`
- 随后 `[wa] 流中断，停止 Web Audio: network error`
- `Web Audio 连接中断，不恢复流式: [step:reader.read.loop] network error`
- `dialogue live snapshot cache missing cacheKey=eda219ac41c210002f57480cab469d26fc163d6f`

Evidence: 本机状态接口返回 `{"state":"missing","status":"missing","cached":false,"cache_url":"","error":"IncompleteRead(0 bytes read)"}`；`outputs/cache/eda219ac41c210002f57480cab469d26fc163d6f.wav` 和 `.json` 均不存在。adapter 日志能看到该任务已收到 `POST /tts_dialogue_stream_job` 和 `GET /tts_dialogue_stream_job/<cache_key>`，并开始逐段 `official_tts`，参数为 `sample_steps=32`、`batch_size=4`，但最终未落盘。2026-06-01 23:20 复查：adapter 已重启，旧 key 查状态变成 `missing/cache not found or job expired` 是预期的内存清空结果，不能用旧 key 验证新 `failed` 逻辑。

2026-06-01 真实 LDPlayer 回归拿到新 key `34f2b685f300e080e4a139f6ea1d83450b5ef67f`（为了打破 deterministic cache，临时把 Tavo 播放语速改到 `1.01`）。Tavo JS 控制台截图 `dev_tools/tavo_debug/emulator_screen_20260601_235509.png` 显示：`cache_key=34f2... cached=false live=true`、Web Audio `state=running`、WAV header 已解析，随后第 5 段服务端推理失败。状态接口返回 `state=failed`，包含 0-4 段 partial `segments_meta`，`outputs/cache/34f2...wav/json` 不存在；adapter 日志出现 `[gsv_adapter] dialogue_stream_failed`。

Root cause: 已确认。本次不是 Web Audio 首路径问题，也不是 adapter 网络随机断流。官方 GPT-SoVITS `9881` 错误日志在第 5 段抛出 `OSError: 参考音频在3~10秒范围外，请更换！`；该段 role=`用户`，voice=`男声/霸道青年`，profile 指向 `prompts/library/男声/霸道青年.mp3`。实测该 MP3 时长约 `1.6138125s`，低于官方要求的 3 秒下限；用户听感也确认“只有一秒多”。官方流式响应在异常后无正文返回，所以 adapter 看到 `IncompleteRead(0 bytes read)`。

Fix: 已做两层修复。第一层是可观测性：`gsv_tavo_adapter.py` 保留当前失败 job 的 `state=failed`，不会把内存中的失败折叠成 `missing`；`_stream_dialogue_to_cache()` 在官方 TTS stream 异常时写入失败状态、保留 partial metrics/segment meta，并打印 `[gsv_adapter] dialogue_stream_failed`；`_stream_official_tts()` 捕获并包装 `IncompleteRead`、`RemoteDisconnected`、`URLError` 等上游读取异常，错误中带 bytes/chunks。第二层是生成前校验：创建 single/dialogue job 前遍历实际会用到的 voice profile，校验 `ref_audio_path`、`prompt_text` 和参考音频时长；低于 3 秒或高于 10 秒时直接 400 报错，例如 `音色 '男声/霸道青年' 的参考音频时长 1.61s，不在 GPT-SoVITS 要求的 3-10s 范围内`，不再进入官方流式接口后断成 `IncompleteRead`。

Guard: 用同一文本、同一角色映射、同一参数重新生成时，不能只靠 Web Audio 启动判断成功；必须确认 `/tts_dialogue_job_status/<cache_key>` 最终为 `done`、`cached=true`，`outputs/cache/<cache_key>.wav/json` 存在，Tavo 控制台没有 `reader.read.loop network error` 或 `snapshot cache missing`。如果 voice profile 参考音频非法，POST `/tts_dialogue_stream_job` 应直接返回 400 和明确 profile 错误，不应创建 live job、不应启动 Web Audio、不应再出现官方 `IncompleteRead`。如果官方 GPT-SoVITS 仍在已校验合法的音色上断流，新生成的 cache key 应返回 `state=failed` 和具体错误，adapter 日志应出现 `[gsv_adapter] dialogue_stream_failed`，不能只显示泛化的 `network error`，也不能在当前内存 job 仍存在时变成 `missing`。

Notes: 这个问题和 BUG-009 不同。BUG-009 是移动端首路径选择 `<audio>` 导致播放失败；本次首路径已经是 Web Audio，失败点在 live stream 中途断流/缓存未生成。

## BUG-019: 音符按钮误读历史音频且历史加载后播放读不出

Status: patched in code, needs real Tavo regression

Repro: 用户反馈 2026-06-02：点击播放器音符按钮应该始终创建新音频，不应该去读取历史音频；“复用”只指 LLM 拆段复用，不是复用旧音频。当前现象是页面显示加载了历史/缓存，但没有自动读取，点播放也读不出来。

Root cause: 两处语义混在一起。前端 `generate(true)` 开头无条件 `ensureTracksLoaded()`，音符按钮也会先恢复并选择历史 track，触发旧音频状态检查/读取。后端 dialogue `/tts_dialogue_stream_job` 没有 `bypass_cache`/nonce 语义，同一 segments/voices/参数会算出同一个 cache key 并直接返回旧音频；这和“LLM 拆段复用”混淆了。single 虽然有 `bypass_cache`，但旧实现仍可能使用同一个 cache key，导致本机 IndexedDB/offline key 复用旧音频。

Fix: `static/tavo.runtime.parts/44_track_history_cache.js` 的 `ensureTracksLoaded(opts)` 支持只恢复历史元数据、不选择/读取旧音频；`static/tavo.runtime.parts/62_dialog_audio_events.js` 挂载后不再自动选择历史，只显示历史条数。`static/tavo.runtime.parts/60_generate_mount_boot.js` 的 `generate(true)` 停止旧播放，只恢复历史元数据以保留旧卡片，然后创建新任务；智能模式请求带 `bypass_cache=true` 和新 `request_id`。`static/tavo.runtime.parts/10_tts_jobs_audio_stream.js` 单音色强制新建也带 `request_id`。`gsv_tavo_adapter.py` 为 single/dialogue 支持 `request_id`，且只在 `bypass_cache=true` 时把它写进 cache payload 形成新 cache key；普通播放/历史缓存 key 不变。

Guard: 真实 Tavo 回归：更新正则到 `v=2028881916` 后，同一条消息连续点两次音符，必须出现两个不同的 TTS cache key；日志可出现“复用 LLM 拆段”，但第二次 `/tts_dialogue_stream_job` 不能返回 `cached=true` 的旧音频。只有播放按钮、上一条、下一条允许读取历史音频。单音色强制新建也必须返回新的 cache key，不能命中同一个 IndexedDB offline key。

## BUG-020: 懒加载切完整播放器时裸 HTML 闪现且首点播放未延续

Status: patched in code, needs real Tavo regression

Repro: 用户 2026-06-02 iPhone 截图：点击加载播放器的过渡过程中，完整播放器短暂显示成未套皮肤的裸 HTML，控制按钮变成白色方块、播放器卡片背景/圆角未生效。同时历史音频显示可恢复，但首次点击加载后没有直接播放。

Root cause: 当前代码在 `static/tavo.runtime.parts/68_mount_boot.js` 里 `ensureStyle()` 后立刻 `mountFull()`，而 `ensureStyle()` 只是插入 CSS `<link>`，没有等待 `tavo.ui.skin.default.css` 加载完成，导致 FOUC。另一个问题是 `static/tavo.js` 的懒加载播放键只调用 `mountRuntime("")`，没有把这次播放意图继续路由到完整播放器的 `[data-role="play"]`；iOS 手势栈也会在异步加载 runtime 后丢失。

Fix: `static/tavo.runtime.parts/05_message_text_config.js` 的 `ensureStyle()` 改为返回 CSS skin 加载 Promise，成功/失败/超时都有明确结果；`static/tavo.runtime.parts/68_mount_boot.js` 在 `await ensureStyle()` 后才创建完整播放器，避免裸 HTML 闪现。`static/tavo.js` 的懒加载播放键在 `pointerdown/touchstart/click` 中预创建并解锁 AudioContext，保存到 `window.__gptsovits_tavo_preprimed_audio_context`，并把点击路由到完整播放器的 play 按钮；`static/tavo.runtime.parts/10_tts_jobs_audio_stream.js` 的 `primeAudioContext()` 会接管这个预解锁 ctx。

Guard: 更新正则到 `v=2028881916` 后，首次点懒加载播放键时，懒加载卡片应保持到 CSS skin 加载完成再切完整播放器，不能露出裸按钮/裸 range/input。若存在历史音频，首次点懒加载播放键应继续进入完整播放器播放路径，不能只打开播放器停在“可恢复上次音频”。

## BUG-021: 懒加载后快速打开音色选择器会被误关闭

Status: fixed in code, narrow CDP passed, needs real Tavo regression

Repro: 本地 CDP narrow smoke：点击懒加载卡片只打开播放器，不点播放生成；马上点设置齿轮，再点可见音色按钮。trace 显示 `.idx-picker` 在 click 同步阶段已 `open/data-open=1`，但 50ms 后变成 `aria-hidden=true` 且 `open` 被移除，设置页也已关闭。

Root cause: `static/tavo.js` 的懒加载收尾会调用 `closeAccidentalPicker()`，并在 runtime ready 后安排 `0/80/220/520ms` 多次清理。该函数无条件关闭所有 `.idx-picker[open]`，会把用户明确打开且带 `data-open="1"` 的合法 picker 当成懒加载误触残留关掉。

Fix: `closeAccidentalPicker()` 现在跳过 `data-open="1"` 的 active runtime picker，只清理没有 runtime open 标记的 stale picker。正则版本升到 `v=2028881917`，loader 升到 `20260602-ios-layer-v27`。

Guard: CDP narrow smoke 已通过：懒加载打开播放器 -> 设置齿轮 -> 点音色按钮后，`.idx-picker[open]` 在 sync/microtask/50ms/300ms/1100ms 都保持 true，不再被 loader 的 delayed cleanup 关闭；真实 Tavo 中设置页进入选择音色也不能被懒加载 tap guard 误关。

## BUG-022: 真实 Tavo 仍加载旧 HTTPS 脚本导致 /parse_text 请求不到 adapter

Status: corrected diagnosis, config/update required

Repro: 真实 Tavo 控制台报错：`LLM 解析代理 /parse_text 请求没有到达后端`，浏览器错误 `TypeError: Load failed`；脚本来源仍是旧 HTTPS 子域名且 `v=2028821788`，不是当前仓库版本。

Evidence: 用户确认旧 HTTPS 地址是刻意映射的外网地址，不是“无效域名”。2026-06-02 已重启任务计划 `CF Tunnel`，`https://sovits.928886540.xyz/health` 返回 `200` 且 body 为 `{"status":"ok","engine":"gptsovits-adapter"}`。因此之前“旧 HTTPS 域名不可用”的判断不成立；应以 Tavo WebView 实际加载的脚本来源、正则缓存和当前新子域名为准。

Root cause: 真实 Tavo 仍在使用旧子域名/旧 `v=` 的脚本来源，或 WebView 内部渲染/正则缓存没有刷新到当前入口。失败发生在 Tavo WebView 到 adapter `/parse_text` 的浏览器请求阶段，后端还没机会访问 LLM。外网映射本身已经证明可用。

Fix: 当前正则入口改为 `https://sovits.928886540.xyz/static/tavo.js?v=2028881922`；loader 版本升到 `20260602-sovits-simple-post-v32`；runtime parts 版本升到 `20260602-sovits-simple-post-v14`。保存/应用 Tavo 正则后，必须回到真实聊天消息重新渲染，不能只改仓库 JSON。

Guard: 真实 Tavo 控制台脚本来源必须显示 `https://sovits.928886540.xyz/static/tavo.js?v=2028881922`。点击生成前确认同源 `/health`、`/static/tavo.runtime.js`、`/static/tavo.runtime.manifest.json`、21 个 runtime parts 和 `/parse_text` 可达；如果控制台仍显示旧子域名或旧 `v=2028821788` / `v=2028881918`，先清正则/消息渲染缓存，不继续查 LLM。

## BUG-023: 旧品牌命名和旧子域名残留

Status: patched in code, needs real Tavo regression

Repro: 用户要求把旧 `index` 系列命名改成小写 `sovits`，并把外网映射子域名切到 `sovits.928886540.xyz`。运行时代码、测试页和活跃文档里仍残留旧产品名、旧 storage key、旧 IndexedDB 名、旧 data attr、旧 MediaSession 文案和旧正则入口。

Root cause: 当前 Tavo runtime 是从旧产品链路迁移来的，部分 UI/存储/测试页标识只做了 GPT-SoVITS 产品层替换，没有统一收口为 `sovits` 命名。正则入口也仍以 LAN 或旧子域名为主，无法匹配用户新的 Cloudflare Tunnel 子域名。

Fix: 正则入口改为 `https://sovits.928886540.xyz/static/tavo.js?v=2028881922`；loader/runtime 版本同步 bump。运行时新写入 `sovits_tracks_*` 和 `sovits_tavo_audio_v1`，并保留旧 key/旧 IndexedDB 的读取兼容，避免历史播放记录和本机离线音频直接丢失。测试页和 active runtime 文案/console/MediaSession/data attr 改成小写 `sovits`。

Guard: 活跃代码/活跃文档不应出现旧品牌文案；允许历史报告、旧对比资料和旧 voice profile provenance 保留。真实 Tavo 正则必须加载 `sovits.928886540.xyz` 且历史音频仍能显示/恢复。

## BUG-024: Tavo about:srcdoc WebView 阻断跨源 JSON POST

Status: fixed in code, needs real Tavo regression

Repro: 用户真实 Tavo 日志已经显示脚本来源是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881918`，但点击智能生成时仍报：`LLM 解析代理 /parse_text 请求没有到达后端`，请求 URL 是 `https://sovits.928886540.xyz/parse_text`，浏览器错误 `TypeError: Load failed`，当前页面 `about:srcdoc`。

Evidence: 同一域名 `/health` 返回 200，`/static/tavo.js?v=2028881918` 能被 Tavo 加载，`curl POST /parse_text {}` 返回 422，说明 Cloudflare Tunnel、adapter 路由和后端都可达。失败只发生在 Tavo AR `about:srcdoc` WebView 的浏览器 `fetch()` 路径，且是 JSON POST / preflight 类请求。

Root cause: 旧版前端用 `Content-Type: application/json` 发 `/parse_text`，在 Tavo AR 真实 WebView 里会走 JSON POST / preflight 链路，用户日志表现为 `TypeError: Load failed` 且请求未到 adapter。`<script src>`、runtime manifest/parts GET 和 `/health` 可达只能证明静态加载链路通，不能证明 JSON POST 链路通。

Fix: v1922 把 `/parse_text`、`/tts_stream_job`、`/tts_dialogue_stream_job` 的前端请求改为 simple POST：`Content-Type: text/plain;charset=UTF-8`，body 仍是 JSON 字符串；后端 `_parse_request_model()` 同时兼容 `application/json` 和 `text/plain`。这不是 RPC/iframe/bundle，只是同一个 adapter API 的请求体解析兼容。v1919 曾尝试 hidden iframe bridge，但真实 Tavo 里会跳出页面且 `/parse_text` 仍失败，已在 BUG-025 废弃。

Guard: 已通过代理公网验证：`text/plain` POST `/parse_text` 到达 adapter，空 body 返回 422，带 text 后返回后端 `LLM parse failed` / `auth_unavailable`，adapter 日志出现 `POST /parse_text`。真实 Tavo 智能生成必须能看到 adapter 收到 `/parse_text`；如果后端访问 LLM 失败，错误应变成明确的 `LLM parse failed` / endpoint/model/key 问题，而不是浏览器 `TypeError: Load failed`。

## BUG-025: hidden iframe bridge 在真实 Tavo 里跳出且 /parse_text 仍失败

Status: abandoned

Repro: 用户真实 Tavo 测试 `v=2028881919` 后反馈：新增的 iframe bridge 会“跳出去”，页面仍然报同样的 `/parse_text TypeError: Load failed`，请求没有到达 adapter。

Root cause: iframe bridge 方案不适合 Tavo AR `about:srcdoc` 真实 WebView。即使 iframe 理论上与 adapter 同源，真实容器会把 iframe 导航/渲染暴露出来或破坏当前页面；同时原始 JSON POST 拦截问题没有消失。继续修 iframe 是错误方向。

Fix: iframe bridge 文件已删除；plain RPC/WebSocket/JSONP 方向已撤掉，不作为当前方案。

Guard: 真实 Tavo 点击懒加载卡片不能出现可见 iframe/页面跳转；仓库不应再出现 `tavo.fetch.bridge.html` 或 `bridgeFetch()` 调用。后续 `/parse_text` 只按 BUG-024 请求链路排查。

## BUG-026: 错误架构纠偏：Tavo AR 不走服务端 bundle

Status: corrected in code/docs, needs real Tavo regression

Repro: 用户指出当前页面是 Tavo 聊天消息里的 AR 渲染环境，不是普通 H5 页面；此前把 `/parse_text` 请求不通误扩展成 iframe/RPC/服务端 bundle 方向，破坏了 AR 动态加载模型，也造成真实 Tavo 里 iframe 跳出。

Root cause: 架构判断错误。Tavo AR 的正确边界是单入口脚本注入、从入口脚本 `src` 推导同源资源 base、动态加载支持文件、隔离执行并保持单消息生命周期。不能按普通网页思路改成 iframe bridge、RPC 或服务端 bundle。`/parse_text` 是 API POST 链路问题，不是 runtime 模块交付问题。

Fix: 已撤回 iframe bridge/RPC/bundle 方向。当前保留 `static/tavo.js -> static/tavo.runtime.js -> static/tavo.runtime.manifest.json -> 21 个 runtime parts -> eval`。正则入口升到 `v=2028881922`，loader `20260602-sovits-simple-post-v32`，runtime manifest/parts `20260602-sovits-simple-post-v14`。`adapterFetch()` 回到原生 `fetch(url, init)`，后续 adapter JSON 创建请求通过 `adapterJsonPost()` 以 simple POST 发送。

Guard: 真实 Tavo 点击懒加载卡片后，应看到 `GET /static/tavo.runtime.js?...`、`GET /static/tavo.runtime.manifest.json?...`、21 个 `GET /static/tavo.runtime.parts/*.js?...` 和 CSS skin；不应请求 `tavo.runtime.bundle.js`，不应创建 iframe，不应出现 RPC/WebSocket/JSONP。完整播放器仍必须等 `window.__gptsovits_tavo_runtime_ready` resolve 后再隐藏懒加载卡片。

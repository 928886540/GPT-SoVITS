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

Status: confirmed on iPhone 14 Pro, open

Repro: iPhone 14 Pro 真机 Tavo 打开 GPT-SoVITS 设置页，设置面板在屏幕内显示成很长一条/宽度异常，内容被横向撑开或只剩中间窄区域可见。用户截图时间 2026-06-01 20:17，页面标题 `BoBo`，设置页可见 `LLM 配置` 与 `复用 LLM 拆段`。另有（用户 2026-06-01）：面板高度随内容忽长忽短、打开/切换时上下跳动、未稳定底部对齐。

Root cause: 当前 panel/picker CSS 依赖 `dialog` + `position: fixed` + `dvw/dvh` + transform 居中；iPhone Tavo WebView 的视觉视口、安全区和 transform 祖先处理与 LDPlayer 不一致。仅靠模拟器验证会漏掉该问题。

Fix: pending

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

Guard: 真实 Tavo 更新到当前 `static/tavo.js` 正则版本（目前 `v=2028881910`）后，首次点播放不应再出现 `element audio.play() 不支持` 作为流式首路径。

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

Status: open

Repro: iPhone 14 Pro 真机 Tavo 中打开 GPT-SoVITS 设置页，点到设置页旁边或稍微靠右上角的区域，设置页会突然退出。打开音色选择器后，点击顶部分类 tab 附近例如 `日日新`，也可能被当成外部点击导致弹层关闭。

Root cause: 当前 `installLayerDocumentGuard` / `installPickerDocumentGuard` 用 document 捕获阶段判断 `target.closest('.idx-panel')` / `target.closest('.idx-picker')`，在 iOS Tavo WebView 的 dialog/body 重挂载、视觉视口偏移、透明区域和事件 retargeting 下会误判内部点击为外部点击。外部点击关闭策略在真机上风险高。

Fix: pending。建议改为：设置页和音色选择器不响应外部点击关闭，只允许明确点 `×`、保存、应用或返回按钮关闭；内部 tab/search/grid/button 事件先在弹层根部捕获并 stop propagation。

Guard: iPhone 14 Pro 真机验证：打开设置页后，点面板边缘、右上附近、滚动区域空白处都不能关闭；打开音色选择器后点 `日日新`、`全部`、搜索框和音色卡片不会意外退出。

Notes: 这个 bug 和 BUG-004 相关但不是同一个问题；BUG-004 是尺寸/布局，BUG-014 是事件误判/关闭策略。

## BUG-015: 音色选择器 X 关闭层级错误

Status: open

Repro: 从设置页进入 `选择音色` 弹层后，点击右上 `X`。用户预期是关闭当前音色选择层，返回上一层设置页；当前行为会直接回到播放器/聊天层，相当于退出全部设置流程。

Root cause: 音色选择器关闭逻辑没有稳定保留 `returnPanel` / 上一层 panel 状态，或被外部点击守卫/close path 清掉，导致 `closeVoicePicker()` 没有重新打开设置页。

Fix: pending。关闭音色选择器必须区分 `close picker only` 和 `close all layers`：普通 `X`、选完应用、返回动作应回到设置页；只有设置页自己的 `×` 或保存才回播放器。

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

Status: patched for observability, needs real Tavo regression

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

Root cause: 未确认。当前证据更像 adapter 到官方 GPT-SoVITS 的上游读取中途抛出 `IncompleteRead(0 bytes read)`，导致 HTTP live 响应被截断；前端 Web Audio 已经拿到 WAV header 并启动时钟，但后续 PCM 流断开，所以表现为“没一点声音就中断”。需要继续确认是官方 `api_v2.py` 上游连接中断、长耗时/并发导致连接被关、还是 adapter 的 live generator 在异常时没有写入可播放的部分缓存。

Fix: 已做最小可观测性补丁，未标记为最终修复。`gsv_tavo_adapter.py` 现在会保留当前失败 job 的 `state=failed`，不会把仍在内存中的失败折叠成 `missing`；`_stream_dialogue_to_cache()` 在官方 TTS stream 异常时写入失败状态、保留 partial metrics/segment meta，并打印 `[gsv_adapter] dialogue_stream_failed`；`_stream_official_tts()` 捕获并包装 `IncompleteRead`、`RemoteDisconnected`、`URLError` 等上游读取异常，错误中带 bytes/chunks。这样失败会显式暴露，不能伪装成成功 cache。

Guard: 用同一文本、同一角色映射、同一参数重新生成时，不能只靠 Web Audio 启动判断成功；必须确认 `/tts_dialogue_job_status/<cache_key>` 最终为 `done`、`cached=true`，`outputs/cache/<cache_key>.wav/json` 存在，Tavo 控制台没有 `reader.read.loop network error` 或 `snapshot cache missing`。如果上游失败，新生成的 cache key 应返回 `state=failed` 和具体错误，adapter 日志应出现 `[gsv_adapter] dialogue_stream_failed`，不能只显示泛化的 `network error`，也不能在当前内存 job 仍存在时变成 `missing`。

Notes: 这个问题和 BUG-009 不同。BUG-009 是移动端首路径选择 `<audio>` 导致播放失败；本次首路径已经是 Web Audio，失败点在 live stream 中途断流/缓存未生成。

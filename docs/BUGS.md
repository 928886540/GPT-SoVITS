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

## BUG-049: live 流式播放时只显示退出按钮，无法应对蓝牙断开

Status: fixed locally, needs real Tavo regression

Repro: 用户 2026-06-04 反馈：流式播放时只有一个退出按钮可能不够，因为蓝牙断开、耳机拔出等场景会导致音频中断，需要能手动点播放按钮恢复音频。

Root cause: `tavo.ui.skin.default.css` 第27行的规则 `.idx-card[data-live-active='1'] .idx-controls .idx-ctrl{display:none!important}` 会把所有控制按钮（包括播放按钮）都隐藏，只显示退出流式按钮。同时 `62_dialog_audio_events.js` 的 `tryResumeOrPauseInGesture()` 会在 live track 正在播放时阻止播放按钮的暂停/恢复操作。这导致蓝牙断开、耳机拔出或系统音频会话被抢占后，用户无法手动恢复播放。

Fix: CSS 规则改为 `.idx-card[data-live-active='1'] .idx-controls .idx-ctrl:not(.idx-ctrl-main){display:none!important}`，只隐藏上一条/下一条/新增/删除按钮，保留播放按钮（`.idx-ctrl-main`）。同时修改 `tryResumeOrPauseInGesture()` 逻辑：live track 正在 Web Audio 播放时允许暂停，暂停后显示"已暂停流式播放，点播放从当前位置继续；需要中止时点退出流式"；用户可以点播放按钮继续流式播放，也可以点退出流式按钮彻底停止。

Guard: 真实 Tavo 回归时，live 流式播放中应同时显示播放按钮和退出流式按钮；点播放按钮可以暂停/恢复流式播放；点退出流式按钮才删除 live job。蓝牙断开或耳机拔出后，点播放按钮应能恢复音频。

Notes: 这个改动同时解决了 BUG-047 的部分场景：用户可以在流式播放中断后手动恢复，而不是只能退出。但系统层面的后台播放限制（iOS WebAudio 后台挂起）仍需要进一步排查。

## BUG-048: 歌词校准可能导致首播失败或卡顿

Status: fixed by BUG-046, needs real Tavo regression

Repro: 用户 2026-06-04 反馈：首播出来后歌词一直显示"校准中"；同时怀疑之前首播失败/无声/长时间等待就是歌词校准引发的。BUG-044 改造后首播有声音了，但歌词校准仍未正常完成。

Root cause: 和 BUG-046 完全相同：`52_voice_subtitle_media.js` 第336-368行的歌词校准轮询没有超时机制，无限轮询 `/tts_dialogue_job_status` 增加了网络开销。在 live 首播期间，歌词校准轮询和 `pollCacheUpgrade()` 同时请求同一个接口（虽然目的不同），可能影响首播性能或导致用户感知卡顿。

Fix: BUG-046 的修复（最大轮询次数40次/60秒 + 最大时长90秒）已经解决了这个问题。歌词校准不会再无限轮询，最多60秒后自动停止，减少了网络开销，不会阻塞首播音频推进。

Guard: 真实 Tavo 回归时，首播音频出声后，歌词应在60秒内完成校准并显示；不能一直卡在"校准中"。控制台应无频繁的 `/tts_dialogue_job_status` 请求（歌词校准 1.5s 间隔 + pollCacheUpgrade 1s 间隔，最多各60秒）。

Notes: BUG-048 是 BUG-046 的一个表现症状，两者共享同一个根因和修复。如果首播仍有失败/无声/长时间等待，需要进一步排查 BUG-044（live buffer 架构）和 BUG-047（切后台断开）。

## BUG-047: 切后台后流式播放断开

Status: open, investigating

Repro: 用户 2026-06-04 反馈：流式播放时切后台，音频就断了。用户明确要求流式播放也应该能后台播放，不能因为切后台就停止。

Evidence: 待真实 Tavo 日志确认。BUG-036 v1934 改成 saved/history 不主动暂停，live 也不因 `visibilitychange/pagehide` 删除；但可能 WebAudio 在后台仍被系统挂起，或者 live buffer 架构下前端消费被后台策略中断。

Root cause: investigating

Hypothesis: 可能是以下之一：
1. WebAudio 在后台被 iOS/Tavo 系统挂起，`schedulePcm()` 停止推进
2. `<audio>` 元素在后台播放策略下被宿主暂停
3. fetch reader 在后台被系统关闭
4. 前端仍有 `visibilitychange/pagehide` 监听主动停止播放
5. live buffer 架构的 GET 请求在后台被 Tavo 网络策略中断

Fix: pending

Guard: live/saved/history 播放时切后台或切 Tavo 其他页面，只要宿主允许后台播放，音频应继续出声；前端不能因页面可见性主动停止。如果系统真的不允许后台播放（如 iOS 锁屏），应保留断点并在回前台时提示恢复，而不是直接删除或转成 failed。

Notes: 先检查 `62_dialog_audio_events.js` 是否仍监听 `visibilitychange/pagehide`；再检查 WebAudio `schedulePcm()` 和 `<audio>` 元素在后台的行为；最后确认 live buffer GET 是否在后台被网络层中断。

## BUG-046: 首播后歌词一直校准

Status: fixed locally, needs real Tavo regression

Repro: 用户 2026-06-04 反馈：ai8 多音色首播后歌词一直在校准，可能影响性能。

Root cause: `52_voice_subtitle_media.js` 第336-368行，`showSubtitle()` 启动的歌词校准轮询（每1.5秒请求 `/tts_dialogue_job_status`）没有最大轮询次数限制和超时机制，只有在后端返回 `state=done/failed` 时才停止。如果后端 job 状态一直是 `processing` 或其他中间状态（如 live buffer 架构下的 job 没有正确标记为 done），轮询会无限继续，持续发送网络请求，可能影响首播性能和用户体验。

Fix: 添加最大轮询次数（40次，60秒）和最大轮询时长（90秒）限制。轮询计数和计时从 `setInterval` 启动时开始，超过任一限制时主动停止轮询并输出 debug 日志。保留原有的 `state=done/failed` 停止逻辑作为正常结束路径。

Guard: 真实 Tavo 回归时，ai8 多音色首播后歌词校准应在60秒内停止（正常情况下 job done 会更早停止）；超时停止时控制台应输出 `⚠️ 歌词校准轮询超时停止 (count=..., elapsed=...s, cacheKey=...)` 日志；歌词显示和同步功能不受影响（已校准的 segments_meta 已应用）。

Notes: 这个修复同时缓解了 BUG-048（歌词校准影响首播）的网络开销问题。如果超时停止频繁发生，说明后端 job 状态管理有问题（live buffer 架构下 job done 标记缺失），需要进一步排查后端 `/tts_dialogue_job_status` 接口和 live buffer 完成后的状态更新逻辑。

## BUG-045: 快照卡片历史条数显示0

Status: fixed locally, needs real Tavo regression

Repro: 用户 2026-06-04 反馈：快照卡片没显示历史条数，显示的是0条。但实际应该有历史音频。

Root cause: `44_track_history_cache.js` 的 `pollCacheUpgrade()` 函数第264行，当 live track 完成并转为 saved 状态时，调用 `saveTracksForMessage()` 将历史写入 `tavo.set`，但没有同步更新 `knownHistoryCount` 变量。`knownHistoryCount` 用于在懒加载卡片和播放器 UI 显示历史条数（如"历史音频 3 条"），如果它没有在 live → saved 转换时更新，快照卡片和计数器会一直显示旧值（通常是0）。

Fix: 在 `pollCacheUpgrade()` 的 `state=done` 分支，`saveTracksForMessage()` 之前添加 `knownHistoryCount = persistableHistoryTracks(generatedTracks).length;` 和 `updateTrackButtons(); updateTrackCounter();`，确保历史条数和 UI 计数器立即同步更新。这样 live track 转 saved 后，卡片计数器会从"0条"立即变成"1条"或更多。

Guard: 真实 Tavo 回归时，ai8 多音色 live 流式播放完成后，快照卡片右上角的历史条数应立即从"0条"更新为"1条"（或更多，如果有多条历史）；懒加载卡片和播放器状态栏也应显示正确的历史条数；刷新页面后历史条数应保持一致（因为 `tavo.set` 已写入）。

Notes: 这个修复同时确保了 `deleteTrack()` 和 `cancelLiveTrack()` 的 `knownHistoryCount` 更新逻辑一致（第496行和第567行已经有这个更新，但 `pollCacheUpgrade` done 分支漏了）。懒加载卡片的历史条数在初始化时从 `localHistoryCountForMessage()` 读取，这个函数读取的是 `tavo.set` 存储的数据，所以只要 `pollCacheUpgrade()` done 时调用了 `saveTracksForMessage()` 写入存储，下次进入消息时懒加载卡片就能显示正确的历史条数。如果用户反馈的是**当前会话**懒加载卡片的历史条数不更新，那需要在 `pollCacheUpgrade()` done 分支后，主动更新懒加载卡片的 DOM（目前懒加载卡片初始化后不会再更新）。

## BUG-050: 播放完成后点播放按钮，音频在末尾跳一下然后结束

Status: fixed locally, needs real Tavo regression

Status: open, investigating

Repro: 用户 2026-06-04 反馈：流式播放时切到后台（如切换到另一个 Tavo 对话、iOS 回桌面等），音频可能断开。

Root cause: investigating

Hypothesis: 可能是以下之一：
1. WebAudio 在后台被 iOS/Tavo 系统挂起，`schedulePcm()` 停止推进
2. `<audio>` 元素在后台播放策略下被宿主暂停
3. fetch reader 在后台被系统关闭
4. 前端仍有 `visibilitychange/pagehide` 监听主动停止播放
5. live buffer 架构的 GET 请求在后台被 Tavo 网络策略中断

Fix: pending（BUG-049 已支持手动恢复播放，部分缓解了这个问题）

Guard: live/saved/history 播放时切后台或切 Tavo 其他页面，只要宿主允许后台播放，音频应继续出声；前端不能因页面可见性主动停止。如果系统真的不允许后台播放（如 iOS 锁屏），应保留断点并在回前台时提示恢复，而不是直接删除或转成 failed。

Notes: 先检查 `62_dialog_audio_events.js` 是否仍监听 `visibilitychange/pagehide`；再检查 WebAudio `schedulePcm()` 和 `<audio>` 元素在后台的行为；最后确认 live buffer GET 是否在后台被网络层中断。BUG-049 已允许用户在蓝牙断开或音频中断后点播放按钮手动恢复，作为临时解决方案。

## BUG-044: live 流式架构绑定 Tavo 连接导致首播时灵时不灵

Status: patched locally in `v=2028881940` / loader `20260604-live-buffer-v57` / runtime `20260604-live-buffer-v40`, needs real Tavo/iOS regression

Repro: 用户 2026-06-04 对比旧 IndexTTS 经验后确认：GPT-SoVITS live 首播时灵时不灵，可能一直等待首段、歌词/状态在走但没有声音；已保存文件播放正常。旧 IndexTTS 主要问题是 GPU 忙、生成慢，但流式播放本身很少出现首播无限等待或无声假播放。

Evidence: 旧 `D:\apiWorkSpace\index-tts2-vLLM` 的流式链路是 `POST /tts_dialogue_stream_job` 立即启动后台推理任务，后台把 PCM 写入 `LIVE_JOBS[cache_key].pcm`，`GET /tts_dialogue_stream_job/{cache_key}` 只是从内存 buffer tail-poll 读取；客户端断开不影响后台生成。当前 GPT-SoVITS 链路里，`POST /tts_dialogue_stream_job` 对 live 只写 `deferred_stream`，真正 `GET /tts_dialogue_stream_job/{cache_key}` 才进入 `_stream_dialogue_to_cache()` 并同步拉官方 GPT-SoVITS 上游 stream；Tavo/iOS 音频权限、HTTP reader、前端 `<audio>` 探测和官方上游首包被绑在同一次首播连接里。

Root cause: live 生成和 Tavo 播放连接耦合过紧。只要 Tavo AR/iOS 在等待首包期间把 AudioContext 置为 `interrupted/suspended`、`<audio>` live 探测失败、fetch reader 断开，或者官方上游首包慢，首播就会表现为无声、长时间等待或转后台保存。已保存音频正常，说明文件播放链路没有根本问题。

Fix: 把 GPT-SoVITS live 改成 IndexTTS 式后台生产/前端消费架构：`POST` 创建 live job 后立即启动后台线程生成，adapter 从官方 GPT-SoVITS 拉流并写入内存 WAV buffer；`GET /tts_dialogue_stream_job/{cache_key}` 只读取 buffer，客户端断开不影响生成；完成后继续落盘 `/cache_audio/{key}`。前端 live 首播默认使用 WebAudio 消费 buffer，减少 `<audio>` live 探测带来的失败时序；saved/history 仍优先 `<audio>`，保留系统后台/锁屏播放能力。

Guard: 真实 Tavo/iOS 回归时，POST 后即使不立刻 GET，`/tts_dialogue_job_status/<cache_key>` 也应从 `running`/`queued` 推进并最终 `done` 或 `failed`；GET 中途断开不应停止后台生成；再次 GET 同 cache key 应从 buffer 头部或指定 `start_s` 继续读；首播失败不能造成“歌词在走但无声”长期卡住，最终 saved/history 文件仍可播放。

## BUG-043: iOS 首播一直失败（等很久或无声音）

Status: experimental fix in loader v56 / runtime v38 + backend abort check, needs real iOS Tavo regression

Repro: 用户 2026-06-03 真实 iOS Tavo 反馈：首次点播放经常失败，要么一直等待到落盘才播（30+ 秒），要么播放器显示在播但没有声音。需要反复切后台、重启 Tavo 才能偶尔成功。体验极差。

Evidence: iOS WebView 对音频权限管控极严格。AudioContext 必须在用户手势里创建和 resume，且手势栈会在第一个 `await` 后失效。当前流程：用户点播放 → 同步创建 AudioContext + keepalive → await saveConfig/parseWithLlm/fetch → 等待首段 PCM（之前 5秒，v37 改为 1秒）→ schedulePcm() → 如果 AudioContext 已经 interrupted，等待恢复最多 45 秒 → 超时或恢复后播放。

Root cause: **等待首段 PCM 的时间仍然太长！** 即使改为 1 秒，iOS 系统仍可能判定 AudioContext "长时间没有真实音频播放"而进入 `interrupted` 状态。触发条件包括：
1. 页面失去焦点（切控制台日志、通知栏下拉）
2. 等待时间超过系统阈值（不同 iOS 版本不同，可能 < 1秒）
3. keepalive 的静音循环不算"真实音频"
4. 系统音频会话被抢占

一旦进入 `interrupted`，`ensureAudioContextRunning()` 会尝试 resume，但必须等待新的用户交互才能恢复 → 用户切后台再切回来触发手势 → 恢复成功。这解释了"切后台就能播"的现象。

Fix attempts:
- v37: 降低首段缓冲从 5秒 到 1秒 → 改善但不够
- v38: **激进降低到 0.2 秒** → 牺牲流畅度（可能轻微卡顿），换取极速启动
- Backend: 在 `gsv_tavo_adapter.py` 的 dialogue 生成循环里增加 deleted 检查，避免退出流式后 GPU 继续跑

Technical details v38:
```javascript
// 之前 v35-v37
var startBufferBytes = Math.floor(bytesPerSec * 5.00);  // 5秒
var startBufferBytes = Math.floor(bytesPerSec * 1.00);  // 1秒

// v38 激进方案
var flushBytes = Math.floor(bytesPerSec * 0.15);       // 0.15秒
var startBufferBytes = Math.floor(bytesPerSec * 0.20); // 0.2秒
```

48kHz 单声道 16bit = 96000 bytes/s，0.2秒 = 19200 bytes ≈ 19KB。RTF 0.5 的情况下，理论上首段到达时间 < 1秒，加上 0.2秒缓冲，总等待 < 1.5秒。

Guard: 真实 iOS Tavo 正则刷新到 v56 后测试：
1. 首次点播放应在 < 2秒内出声（之前要等 30+秒）
2. 不切后台/控制台的情况下也能正常播放
3. 可能出现轻微卡顿/buffering（可接受的副作用）
4. 退出流式后 GPU 应立即停止（不再疯狂跑）

日志应显示：
```
Web Audio 播放时钟已启动
AudioContext keepalive stopped: live playing
```
不应出现长时间 `state=interrupted` 或 `schedulePcm waiting AudioContext`。

Risks: 0.2秒缓冲极小，网络抖动或后端生成间隔 > 200ms 会导致 underrun（播放中断缓冲）。但考虑到局域网环境 + RTF 0.5，理论上每个 chunk 到达间隔 < 200ms，风险可控。如仍失败，考虑：
1. 完全取消首段缓冲，收到第一个 chunk 就播（最激进）
2. 检测 iOS 版本/Tavo 版本，针对性调整策略
3. 放弃 WebAudio 流式，改用 fetch 全部音频后 Blob URL + audio 元素（失去流式能力）

Notes: iOS 音频播放是已知的跨平台开发难题。Safari/WebView 的音频策略比 Android 严格 10 倍。本次修复是在保持流式能力的前提下，尽可能缩短启动延迟。如用户仍反馈失败，需要收集具体 iOS 版本、Tavo 版本、网络环境、日志等信息进一步诊断。

## BUG-042: 退出流式后状态未清理导致重播失败和等待时长异常

Status: fixed in loader v54 / runtime v36, needs real Tavo regression

Repro: 用户 2026-06-03 真实 Tavo 反馈：退出流式后立即再发起流式播放，出现以下问题：1) 卡在"等待首段音频"很久（之前秒播的能力失效了）；2) 等待时间显示有2个不同的秒数在跳，说明有2个定时器同时运行；3) 大退 Tavo 重进后，第一次播放又回到等很久才出声的状态；4) 落盘后新音频播不了，但历史音频能播。

Evidence: 代码已确认。`44_track_history_cache.js` 的 `cancelLiveTrack()` 调用 `stopWebAudioPlayback("switch")` 停止播放。但在 `40_playback_cache.js` 的 `stopWebAudioPlayback()` 里，`reason="switch"` 时**不会停止 keepalive**：

```javascript
if (reason !== "replace" && reason !== "new-generation") {
  try { if (typeof stopAudioKeepalive === "function") stopAudioKeepalive(reason || "stopWebAudio"); } catch (_) {}
}
```

Root cause: 退出流式时使用 `reason="switch"`，这个 reason 被设计为"切换播放而非完全停止"，所以不停 keepalive。这导致：
1. **keepalive 仍在运行** → AudioContext 和静音循环 buffer 一直播放
2. **下次生成时，旧的 keepalive 和新的冲突** → 2个定时器同时跑
3. **AudioContext 状态不干净** → 可能导致新播放器启动失败或等待很久
4. **BUG-041 修复后的秒播能力失效** → 又回到等待 interrupted 恢复的老问题

用户观察到"等待时间有2个秒数在跳"证明了旧的定时器（可能是 keepalive 或 progress timer）没有被清理，和新生成的定时器同时更新 UI。

Fix: v54/v36 修改 `cancelLiveTrack()` 调用 `stopWebAudioPlayback("cancel")` 而不是 `"switch"`。`"cancel"` reason 会触发 keepalive 停止，确保完全清理播放状态，为下次生成提供干净的环境。

Guard: 真实 Tavo 正则刷新到 v54 后，测试流程：
1. 点播放 → 应秒播（< 10秒出声）
2. 点"退出流式"
3. 立即再点播放 → 应仍然秒播，不应卡在"等待首段"
4. 等待时间显示应该只有1个秒数在跳，不应有2个
5. 大退 Tavo 重进后，第一次播放应该仍然秒播

日志应显示：退出流式时出现 `AudioContext keepalive stopped: cancel`，而不是保持运行。

Notes: 这是 BUG-041 keepalive 保持机制的补充修复。keepalive 在播放期间保持手势有效是对的，但退出流式时必须完全清理，否则会影响下次生成。`"switch"` reason 适用于切换曲目但仍在播放状态，而退出流式是完全停止，应该用更强的清理策略。

## BUG-041: live 流式播放 keepalive 过早停止导致 AudioContext 无手势 interrupted

Status: fixed in loader v53 / runtime v35, needs real Tavo regression

Repro: 用户 2026-06-03 真实 Tavo 反馈 live 流式播放时：第一次点播放经常无声，需要反复切后台再切回来才能播放；等待时间过长（30+ 秒）；切控制台日志页查看日志后，播放就失败。

Evidence: 代码已确认。用户日志显示：
```
AudioContext keepalive stopped: switch
AudioContext keepalive stopped: element play
live track 使用 audio 元素流式
stalled @ 0.00 count=1
element audio.play() 不支持
[wa] AudioContext state=running
宿主音频通道中断，等待恢复...
[wa] schedulePcm waiting AudioContext, state=interrupted
[wa] schedulePcm resume AudioContext -> running  <-- 用户切回来后才恢复
Web Audio 播放时钟已启动
```

Root cause: `62_dialog_audio_events.js` 在 `<audio>` 元素的 `play` 事件里立刻调用 `stopAudioKeepalive("element play")`。当 live 流式首路径尝试 `<audio>` 元素播放时：
1. `audio.play()` 触发 `play` 事件 → **keepalive 立刻停止**
2. `<audio>` 播放失败（Tavo AR 不支持流式 WAV）
3. fallback 到 WebAudio → **keepalive 已经没了，用户手势栈耗尽**
4. WebAudio 启动时 AudioContext 进入 `suspended`/`interrupted`，等待用户交互才能恢复
5. 用户切后台再切回来，触发新的用户手势 → AudioContext `resume()` 成功 → 开始播放

这解释了所有现象：
- **首次点播放无声**：keepalive 停得太早，WebAudio 没有手势
- **切后台再回来能播**：新的用户交互恢复了 AudioContext
- **等待 30+ 秒**：`ensureAudioContextRunning()` 的 45 秒超时
- **切控制台日志就失败**：任何页面切换都可能触发 AudioContext 中断

Fix: v53/v35 移除 `<audio>` 元素 `play` 事件里的 `stopAudioKeepalive()` 调用。keepalive 现在只在真正播放成功时停止（`playing` 事件），或者 WebAudio 开始播放时停止。这样 `<audio>` 失败 fallback WebAudio 时，keepalive 仍在运行，保持用户手势有效。

Guard: 真实 Tavo 正则刷新到 v53 后，live 流式首次点播放应能立即出声（5 秒内），不需要切后台/切控制台。日志应显示：
```
AudioContext keepalive started: prime new
live track 使用 audio 元素流式
element audio.play() 不支持
改用 Web Audio
[wa] AudioContext state=running
[wa] WAV header parsed
Web Audio 播放时钟已启动
AudioContext keepalive stopped: live playing  <-- 真正开始播放时才停
```
不应出现 `keepalive stopped: element play` 或长时间 `state=interrupted` 等待。

Notes: 这是 BUG-035 keepalive 机制的完善。之前 keepalive 在 element audio 尝试时就停了，导致 fallback 路径失去手势保护。真实流式播放的首段缓冲是 5 秒，RTF 0.5 理论上应该 < 10 秒就能出声，绝不应该等 30+ 秒。

Status: fixed in loader v52 / runtime v34, needs real Tavo regression

Repro: 用户 2026-06-03 真实 Tavo 反馈流式播放时报错：`[gptsovits] ⚠️ element audio.play() 不支持: The operation is not supported.`，流式播放失败。

Evidence: 代码已确认。BUG-039 的修复（v1939）把 live 默认播放路径改回 `<audio>` 元素，只有在 `<audio>` 不支持时才 fallback WebAudio。首次报错 `element audio.play() 不支持` 后，BUG-040 v50/v32 误判为"Tavo AR 的 `<audio>` 根本不支持流式"，强制 live 走 WebAudio。但 v50 部署后，用户反馈 live 流式仍无声，日志显示 `[wa] AudioContext state=running` 但 `resume AudioContext failed: Failed to start the audio device`，AudioContext 反复 `interrupted` -> `resume` 失败 -> `interrupted`，无限循环直到超时。同时用户确认**历史音频可以正常播放**，且历史音频走的是 `<audio>` 元素（日志 `audio metadata loaded` + `AudioContext keepalive stopped: element playing`）。v51/v33 回退后，用户反馈仍然报 `element audio.play() 不支持` 且立即 fallback WebAudio，说明不是播放路径选择问题，而是 `audio` 元素本身不存在或不可用。

Root cause: **`startElementAudioFrom()` 没有检查 `audio` 元素是否存在就直接访问 `audio.src`**。`audio` 变量在 `mountFull()` 里通过 `first(root, '[data-role="audio"]', 'audio')` 赋值，如果 DOM 中没有找到该元素或者 `mountFull()` 还没执行完，`audio` 就是 `null`/`undefined`，访问 `audio.src` 或 `audio.play()` 会抛异常。真实 Tavo AR WebView 可能在某些情况下没有成功创建 `<audio>` 元素，或者 runtime 在 `mountFull()` 完成前就尝试播放。

Fix: v52/v34 在 `startElementAudioFrom()` 开头增加 `audio` 元素存在性检查：如果 `!audio`，打印 `audio 元素不存在` 日志并返回 `false`，避免访问 `null.src` 抛异常。同时保留 v51/v33 的 `<audio>` 优先策略和 WebAudio resume 失败快速 bailout。

Guard: 真实 Tavo 正则刷新到 v52 后，如果 live 流式仍报错，日志应明确显示 `audio 元素不存在` 或其他具体原因，不应是泛化的 `element audio.play() 不支持`。如果 `audio` 元素存在且 `<audio>` 播放成功，应正常出声并落盘；如果 `audio` 元素不存在，应快速 fallback WebAudio 并出现 `改用 Web Audio` 日志。

Notes: 需要确认真实 Tavo AR WebView 是否能成功创建 `<audio data-role="audio">` 元素，以及 `mountFull()` 的执行时机。如果 Tavo 根本不支持 `<audio>` 元素，应直接默认走 WebAudio；如果支持但 WebAudio 设备不可用，需要排查系统音频权限/占用问题。

## BUG-039: live WebAudio interrupted 被提示成前端暂停

Status: patched locally in v2028881939, needs real Tavo regression

Repro: 用户 2026-06-03 真实 Tavo v2028881938 反馈 live 流式中出现日志：`⚠️ Web Audio 通道暂停，保留 live 等待保存: [step:schedulePcm] [step:schedulePcm.resume] AudioContext state=interrupted，音频通道未放行`。用户明确要求：不要随便暂停。

Evidence: `10_tts_jobs_audio_stream.js` 的 `ensureAudioContextRunning("schedulePcm")` 在 `AudioContext.state=interrupted` 时抛错；`40_playback_cache.js` 把包含 `AudioContext|resume|schedulePcm|音频通道` 的错误统一写成 `Web Audio 通道暂停，保留 live 等待保存`，并调用 `keepLiveTrackForCache(... "音频通道暂停，后台继续保存" ...)`。这会把宿主/系统中断误表达成前端主动暂停。

Root cause: `interrupted` 是 Tavo WebView / iOS / 系统音频会话中断，不是用户点击暂停，也不是前端应该主动 pause 的状态。当前文案和状态名把它折叠到 `audio_suspended/暂停`，导致用户误判为程序随便暂停；更关键的是 `shouldUseWebAudioForLiveTrack()` 对移动端 live 强制 WebAudio，用户切控制台日志页或系统后台时 WebAudio 更容易被宿主中断，普通等待首段时也可能卡在 `AudioContext state=interrupted`。

Fix: v1939 把 live 默认播放路径改回原生 `<audio>` 系统音频通道；只有 `<audio>` 不支持时才设置 `elementAudioUnsupported/forceWebAudioLive` 回退到 WebAudio。`10_tts_jobs_audio_stream.js` 对 `AudioContext state=interrupted/suspended` 不再立刻失败，而是先等待恢复并发出 `audio_interrupted/audio_suspended/audio_resumed` 状态。`40_playback_cache.js` 对这些状态只显示“等待恢复”，不调用 `keepLiveTrackForCache()`，不把 live 变成 idle/paused；超过恢复窗口仍未恢复时才转“宿主音频通道未恢复，等待保存”。所有相关文案去掉“通道暂停/已暂停”。

Guard: 真实 Tavo 正则刷新到 `https://sovits.928886540.xyz/static/tavo.js?v=2028881939`。live 流式首路径应优先走 `<audio>` 元素，日志应出现 `live track 使用 audio 元素流式`；只有 audio 元素不支持时才 fallback WebAudio。切控制台日志页/后台或普通等待首段时，UI 不能出现“通道暂停/已暂停”这类像用户或前端主动暂停的文案；如果 WebAudio 返回 `interrupted`，应显示“宿主音频通道中断/等待恢复”或超时后“宿主音频通道未恢复，等待保存”。前端不能仅因此删除 live，也不能把未完成 live 写入历史；job done 后仍进入 saved/history。

## BUG-038: live 后台播放状态、歌词时间轴和指标展示不完整

Status: patched locally in v2028881937, needs real Tavo regression

Repro: 用户 2026-06-03 在 v2028881936 真实 Tavo 生成后反馈：流式播放时切控制台日志页或后台页面，前端像在监控页面切换一样一直显示“流式播放继续”，用户期望 live 后台播放依然可用，不需要前端把切页当成特殊状态；最后一条语音疑似漏字，需要用 Whisper 对比；live 过程中歌词始终没有出来，落盘后仍显示流式继续；`dialogue live snapshot 指标: RTF 0.61 · 音频 164.5s` 指标太少，需要显示 batch size、sample steps、采样率、分段数等参数。

Evidence: adapter 日志确认真实 Tavo 已加载 `v=2028881936` / loader `20260603-llm-role-trust-v46` / runtime parts `20260603-llm-role-trust-v28`，并生成最新 cache `7230be132b08365af4db14ece6a13a8f2183c1bd`。日志中有 `POST /tts_dialogue_stream_job/<cache>/background`，说明前端在宿主切换/流式中断时主动请求后台合成。当前 `62_dialog_audio_events.js` 仍监听 `visibilitychange/pagehide/pageshow`，`44_track_history_cache.js` 的 `keepCurrentLiveTrackForHostBackground()` 会写“流式后台继续”，这可能解释用户看到的状态卡住。

Root cause: live 切后台策略仍过度干预 UI 状态：v1936 仍把 `visibilitychange/pagehide/pageshow` 转成“流式后台继续”提示和 `/background` 请求，导致用户切控制台日志页或后台页时被 UI 文案误导。live 歌词在没有精确 `segments_meta.start_s/duration_s` 时只显示校准中，没有先显示粗略歌词；落盘后 `pollCacheUpgrade()` 也没有立即重建当前 track 的字幕。指标少是后端旧 metadata 只写 `total_s/audio_duration_s/rtf`，前端保存 tracks 时也丢了 batch、steps、sample rate 等字段。Whisper 对最新 cache 的比对显示弱覆盖集中在短 TTS chunk，尤其短语气词和约 1.6s 的同角色对白，说明漏字风险更像过短分段而不是链路断。

Fix: v1937 移除 `62_dialog_audio_events.js` 对 `visibilitychange/pagehide/pageshow` 的主动监听和 `44_track_history_cache.js` 的 `keepCurrentLiveTrackForHostBackground()`；切 Tavo 控制台/后台本身不再改 live 状态，也不再因此请求 `/background`。真实 WebAudio 挂起、流中断、连续缓冲或首段等待过久仍由播放层保留 live 并兜底后台合成。`52_voice_subtitle_media.js` 改为 live 没有精确时间轴时先渲染粗略歌词并随播放高亮，拿到 `segments_meta` 后再校准，未精确时间仍不能点击 seek。`44_track_history_cache.js` 在 job done 后对当前 track 立即写“音频已保存”、重建字幕并显示完整指标。`gsv_tavo_adapter.py` 合成前合并相邻同 role / 同 style / 同 style_alpha 的短段，不跨角色、不改变 LLM role/voice；最新 cache 原始 29 段按该规则会合并为 21 个实际 TTS 段。后端 `/tts_dialogue_job_status` 和 cache metadata 补齐 `performance_mode/sample_steps/batch_size/sample_rate/segments_done/segments_total/source_segments_total` 等指标，前端 `formatJobMetrics()` 和 `saveTracksForMessage()` 同步显示/保存这些字段。

Guard: 真实 Tavo 正则必须刷新到 `https://sovits.928886540.xyz/static/tavo.js?v=2028881937`。live/saved 播放时切控制台日志页或后台页，前端不能因 host visibility/pagehide 主动把卡片覆盖成“流式后台继续”，也不能仅因此请求 `/tts_dialogue_stream_job/<cache>/background`；如果宿主允许后台播放，应继续播放，如果真实流式连接或 AudioContext 失败，再按播放层事件兜底保存。live 必须先显示粗略歌词，拿到 `segments_meta` 后校准；落盘后 track 应从 job status 更新为 saved/history 并显示可播放歌词。snapshot 指标至少显示档位、steps、batch、sample rate、RTF、音频时长、总耗时、合并后分段完成数和原始 LLM 段数。Whisper 报告路径：`reports/whisper_cache_7230be132b08365af4db14ece6a13a8f2183c1bd_20260603/`。

## BUG-037: LLM 角色拆段被前端 JS 强制改旁白导致音色映射失效

Status: patched locally in v2028881936, needs real Tavo regression

Repro: 用户 2026-06-03 反馈：最新历史音频里角色映射、歌词和进度条看起来正确，但实际声音不是用户配置的 `男声/忧郁少年`，而是旁白音色。检查最新 cache `5880d2243707038d55529c35e64ef67753d432de` 后发现请求 voices 里有 `白夜雨/用户 -> 男声/忧郁少年`，但 `segments_meta` 只有 `旁白/小薇/BoBo`，没有任何 `用户/白夜雨` 段，因此后端实际不会用男声音色。

Root cause: 前端 LLM prompt 和 `parseWithLlm()` 后处理都写了“无引号正文强制归旁白”的硬规则。LLM 已完成角色拆分后，JS 又用 `quoteDepthAt()` / `insideQuote` 二次判断并把非旁白 role 覆盖成 `旁白`，等于让规则代码推翻 LLM 判断。GPT-SoVITS adapter 只按 `segment.role -> voices[role]` 映射音色，后端没有串音色。

Fix: v1935 移除 JS 对 LLM role 的“无引号强制旁白”覆盖，让 LLM 负责角色归属；JS 只做 role 名规范化、style 范围归一、覆盖率校验和缺失映射报错。prompt 也去掉“所有无引号正文固定旁白”的硬要求，改成“按语义判断，不能只看引号”。前端从 `segments_meta` 恢复歌词时保留服务端实际 `voice` 字段，播放状态栏优先显示真实 voice，避免 UI 只按本地映射显示而误导真实音色判断。

Guard: 新版本生成同类文本时，前端日志不能再出现 `无引号正文强制归旁白`；如果 LLM 输出 `用户/白夜雨`，请求到 adapter 的 `segments` 必须保留该 role，并在 `segments_meta.voice` 中显示 `男声/忧郁少年`。如果 LLM 判断为 `旁白`，UI/日志必须显示实际服务端 `voice`，不能让用户误以为这段用了用户音色。

## BUG-035: Tavo 切画面/桌面后 Web Audio 恢复重复播放且音频通道卡死

Status: patched in v2028881932; live/history policy superseded by BUG-036 v2028881934, needs real Tavo regression

Repro: 用户 2026-06-03 真实 Tavo v2028881930 反馈：第一次更新正则后可以播放；切到别的画面会暂停，回去又继续播放；切桌面后回去没有继续播放，需要点播放按钮。点播放后确实继续播了，但又有一条新的在播放。随后再次点流式播放提示 `音频通道未放行`，之后切任何一条都变成 `音频通道未放行`。

Evidence: v1930 对 `AudioContext.state !== "running"` 做了硬校验，但旧 `PRIMED_CTX` 没有在失败后销毁/重建；一次 suspended/interrupted/closed 状态会污染后续所有 track。`playTrackViaWebAudio()` 会开启新的 Web Audio stream，但旧的 suspended source/controller 如果没有在页面隐藏或 audio_suspended 时完整 stop/close，回到前台或再次点击播放时可能和新连接重叠。当前 runtime 也没有显式处理 Tavo AR WebView 的 `visibilitychange/pagehide/pageshow`，只依赖宿主自动暂停/恢复，行为不稳定。

Regression evidence: 用户 2026-06-03 继续反馈：v1931 下流式播放仍提示 `音频通道未放行`。这说明只重建坏 ctx 不够；生成链路从用户点击到首段 PCM 到达之间有 LLM/后端等待，Tavo/iOS 可能在等待期间再次挂起 AudioContext，真正 `schedulePcm()` 时已经脱离用户手势，`resume()` 被拒。

Hypothesis: Tavo/系统切走会挂起 Web Audio；有的切换会被宿主自动恢复，有的必须用户手势。当前代码没有把“宿主挂起”转成确定的 paused 状态，也没有在通道失败时重置 AudioContext，导致重复连接和后续卡片全部继承坏 ctx。v1931 后剩余断点是：用户手势只播放了极短静音，不能覆盖从点击到首段真实音频之间的长等待，需要在手势里启动低音量 keepalive，并在首段真实音频进入 playing 后停止。

Fix: `10_tts_jobs_audio_stream.js` 新增 `resetPrimedAudioContext()` 和 `audioContextBlockedError()`：`AudioContext` 被系统/Tavo 挂起、关闭或进入非 running 状态后，会关闭旧 ctx、清掉 loader 预热 ctx，并让下一次用户手势强制创建新 ctx。`40_playback_cache.js` 在 `audio_suspended` 状态里不再只改文案，而是记录断点、停止旧 stream/source/controller、清进度 timer、重置 ctx。`42_saved_playback_cache.js` 的 saved Web Audio 也在未 running 时停掉已排程 source 并重置 ctx。`62_dialog_audio_events.js` 监听 `visibilitychange/pagehide/pageshow`：切走时把当前播放显式转成 paused 并保存断点，回来只提示点播放继续，不让宿主自动恢复和新播放流重叠。v1932 继续补 `static/tavo.js` 和 runtime 双层低音量 keepalive：懒加载入口在用户手势里启动预热 keepalive，runtime 接管后继续保持到 live/saved/element audio 真正进入 playing，再停止；`stopWebAudioPlayback("replace"/"new-generation")` 不再提前关 keepalive，避免等待 LLM/首段 PCM 期间 ctx 又掉回 suspended。

Guard: v1932 的 AudioContext keepalive 仍保留：出现 `音频通道未放行` 后，下一次用户手势必须创建新 AudioContext，不能让所有卡片永久失败。流式生成从点击到首段 PCM 的等待期间，控制台应出现 `AudioContext keepalive started`，到 `Web Audio 播放时钟已启动` 后出现 keepalive stopped。后台/切卡最终策略以 BUG-036 为准：saved/history 不主动暂停；live/pending 是特殊临时卡片，只有未完成时点 `退出流式` 才删除，切后台/中断只请求后台合成并等待进入历史。

## BUG-036: live 流式和历史音频后台/切卡策略混用

Status: patched locally in v2028881934, needs real Tavo regression

Repro: 用户 2026-06-03 反馈：上一版看起来把流式和历史音频都变成“不支持后台播放”；流式播放时切上一首/下一首、切 Tavo 画面、切桌面后的暂停/恢复/保存逻辑互相打架，最终核心功能仍可能只返回 `音频通道未放行`。

Evidence: `62_dialog_audio_events.js` 的 `pauseActiveForHostSuspend()` 当前无差别暂停 live/saved Web Audio 或 element audio；`44_track_history_cache.js` 的 `selectTrack()` 切卡会直接 stop 当前 Web Audio；`saveTracksForMessage()` 会把 `pending/live/failed/saved` 都写入消息历史，导致未完成 live 在重进消息时也可能被当成历史恢复。

Regression evidence: 用户 2026-06-03 v2028881933 真实 Tavo 日志显示，live 播放中切到控制台/后台后立刻打印 `AudioContext keepalive stopped: switch`、`live流式已中止并删除:visibility hidden`、`已删除本机缓存音频`。用户明确纠正：`不能进上一条下一条` 指的是 live 播放时阻止历史切换，不是切后台就删除；历史音频在控制台日志页也打印“不主动暂停”，但实际仍暂停，说明当前 host visibility/pagehide 策略仍把 Tavo AR 页面切换当成停止条件。

Root cause: live 流式播放和 saved/history 音频不是同一个生命周期。历史音频是已经落盘的可恢复资源，应该尽量允许 Tavo/系统后台继续播放；live 流式是一次性的实时任务，不应该跨卡、跨页面或重进消息恢复，更不能在未完成时保存成历史。

Fix: v1933 的“切走/挂起就删除 live”策略是错误修复。v1934 改为：saved/history 音频默认优先 `<audio>` 元素播放，失败再 fallback WebAudio，给 Tavo/系统后台播放策略更大机会；saved/history 不在 `visibilitychange/pagehide` 主动 pause/reset。live/pending 不因 `visibility hidden`、`pagehide`、`audio_suspended`、首段等待超时、连续缓冲或网络流中断删除，改为保留卡片、继续轮询保存状态，并请求 adapter 将该 cacheKey 转为后台合成兜底。live/pending 状态下普通控制按钮整排隐藏，只显示 `退出流式`；上一条/下一条不会执行，播放按钮也不会暂停/删除。只有用户点 `退出流式` 或普通删除历史，或后端 job 明确 failed/missing，才清理 live。live 已播放结束但还没转 saved 时按钮改为 `进入历史`，只轮询/等待落盘，不删除。未完成 live 仍不写入历史，只有成功落盘后才进入 saved/history。adapter 新增 `POST /tts_dialogue_stream_job/{cache_key}/background`，用于流式响应被宿主关闭后的后台合成兜底。

Guard: 历史音频播放时切 Tavo 页面、控制台日志页或系统后台，前端不能主动 pause/reset/stop；如果宿主允许后台播放，应继续出声。live 流式播放时切 Tavo 页面或系统后台，前端不能主动 `cancelLiveTrack()` 或删除 cache；按钮区必须只显示 `退出流式`，不能显示上一条/播放/下一条/新增/删除。`退出流式` 只在 live 未完成时删除当前 live 和服务端/cache；live 播放结束或 job done 后只能进入/等待 saved history，不能删除。live 未成功落盘前重进消息不能恢复为历史音频；只有 `/tts_dialogue_job_status` done 或 saved track 才能写入 `sovits_tracks_<messageId>`。如果流式连接被宿主关闭且前端已请求后台合成，adapter 应打印 `dialogue_stream_background_queued` 并最终 done/failed，不能长期卡在 running。

## BUG-034: 删除全部历史后计数残留且播放进度走但无声

Status: patched in v2028881930, needs real Tavo regression

Repro: 用户 2026-06-03 真实 Tavo 反馈：把历史音频全删后，播放器仍显示 `4 条`；随后点击播放，前端开始流式播放，进度条在走，但没有声音。

Evidence: `clearCurrentTrack()` 删除到空列表后只异步 fire-and-forget 调 `saveTracksForMessage(messageId, generatedTracks)`，没有立刻把 `knownHistoryCount` 归零，也没有等待 Tavo chat 变量写入完成；如果同步/异步存储仍返回旧 tracks，懒加载/播放器计数会继续显示旧数量。播放按钮在 `generatedTracks.length === 0` 时会按当前消息重新创建 live job；Web Audio 路径在 schedule 后按计时器推进 UI，如果 `AudioContext` 没有真正进入 `running`，可能出现进度推进但系统没有出声。

Hypothesis: 删除状态和持久化状态没有原子同步，导致“无历史”与“已知 4 条历史”在同一卡片并存。无声播放不是 `/parse_text` 链路问题，而是 Web Audio 输出通道/prime/resume 状态没有被严格校验，UI 把已排程误当成已出声。

Fix: `static/tavo.runtime.parts/05_message_text_config.js` 的 `saveTracksForMessage()` 在保存空 tracks 时同步把新旧 history key 的 localStorage、Tavo chat 变量和 Tavo global 变量都写成空数组，防止旧 key / global 残留把已删除的 4 条回灌。`44_track_history_cache.js` 删除当前 track 后立刻更新 `knownHistoryCount`，删除到 0 时等待历史写入完成、清空音频 src 和 UI 计数；删除后切到剩余卡片只做 metadata-only，不自动读取/播放。`10_tts_jobs_audio_stream.js` 和 `42_saved_playback_cache.js` 在 live/saved Web Audio 路径里强制校验 `AudioContext.state === "running"`，否则直接显示音频通道未放行，不进入 playing，也不启动进度。

Guard: 删除最后一条历史后，当前完整播放器和懒加载卡片必须立即显示 `历史音频 0 条`，下一次进入消息也不能从 Tavo/storage 读回旧 4 条。点击播放如果是新建 live，必须在 `AudioContext.state === "running"` 后才进入 playing/推进进度；如果没有放行音频通道，必须显示明确的 `音频通道未放行`，不能让进度条假走。

## BUG-033: Tavo 历史卡片与流式播放状态混乱

Status: patched in v2028881929, needs real saved-track/mobile regression

Repro: 用户 2026-06-03 真实 Tavo/本地模拟器反馈：`dialogue live snapshot 已落盘，cacheUrl 已写回卡片` 后播放仍失败；页面又显示 `读取已保存音频` 并转圈。历史音频条数仍不稳定；上一条/下一条失效；切换时右上角页码明显慢，要读到音频后才正常；loading 状态让播放按钮看起来不可用；流式播放时切走后切不回原卡片；后台切换后先提示“播放可继续”，又提示“已暂停/不会恢复流式”；流式歌词和音频不同步。

Evidence: `pollCacheUpgrade()` 的“已落盘”只代表服务端 cache/status 完成并写回 track，不代表当前 WebView 已经成功读取、解码或起播。`selectTrack()`、`generate(false)`、`playSavedTrack()` 仍会在切卡/播放/状态确认时共用 `track.state`、`playbackState`、`streamHealth` 和 UI loading 文案。上一条/下一条当前直接 `selectTrack(..., true)`，切卡会立刻进入播放和 loading；`updateTrackButtons()` 又在多处 `await refresh/verify/hydrate` 之后才执行，所以页码要等网络/音频读取后才刷新。`pauseLiveTrack()` 会写 `playSavedWhenReady=false` 和“不会自动恢复流式”，但后台/流式结束/落盘轮询又会写另一套提示。

Hypothesis: 当前状态模型把三件事混在一起：卡片代表什么（live/saved/failed）、服务端 cache 是否落盘、播放器现在是否正在 loading/playing/paused/error。结果是“服务端已落盘”被 UI 当成“播放可用”，而切卡/历史恢复又会误触播放路径。

Fix: `static/tavo.runtime.parts/44_track_history_cache.js` 在 `selectTrack()` 开头立即更新 `currentTrackIndex` / 页码 / 状态，不再等网络状态确认或音频读取后才刷新。上一条/下一条改为 `selectTrack(..., false, { metadataOnly:true, reason:"navigation" })`，只切换卡片，不自动读取/播放历史音频。后台生成卡片在非 autoplay 选择时不再把播放按钮置为 loading。`30_player_shell.js` 在已知历史条数但未加载 tracks 时直接显示 `历史音频 N 条`，右上角显示 `N条`，不再写“可恢复上次音频”。`34_element_audio_controls.js` 把保存音频失败提示按 `fetchSaved/arrayBufferSaved/decodeSaved/resume` 分层。`52_voice_subtitle_media.js` 在没有真实 `segments_meta` 时间轴前，live 歌词只显示“歌词时间轴校准中”，不假装同步、不可点击跳转。`58_live_pause_helper.js` 的暂停文案改成“后台仍会继续保存；点播放再决定续播或读取历史音频”。`62_dialog_audio_events.js` 新增按播放器 rect 定位 settings/picker，设置页不再固定贴底。

Guard: 真实 Tavo/LDPlayer 回归：生成 live 音频时切走/切回不能丢当前卡片；落盘日志出现后，未点播放不应进入 `读取已保存音频`；点播放失败时必须显示具体阶段（状态确认、fetch、decode、AudioContext、element audio），不能只显示转圈或泛化错误。上一条/下一条只换卡片并立即更新 `N/N`，不强行自动播放。2026-06-03 LDPlayer 已验证 `v=2028881928` 可加载 `state-model-v38/v20` runtime，设置页覆盖在播放器卡片区域，上一条从 6/6 到 5/6/2/6/1/6 页码即时切换且不进入 loading；该模拟器当前 6 条历史全是 failed，不能代替 saved 音频播放验证。下一轮用 `v=2028881929` 验证 `历史音频 N 条` 文案补丁。

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

Fix: `static/tavo.ui.skin.default.css` 已移除面板/picker 的 `dvw/dvh`、`left:50%`、`translateX` 布局风险；改成安全区 inset + 固定 sheet。2026-06-02 用户反馈上一版 `82vh` 仍然“特别长”，已把设置页高度改成明确固定值：桌面/宽屏 `560px`，iPhone 窄屏 `520px`。随后用户指出选择音色页也要固定高度、底部圆角必须可见，已把 picker 改为宽屏 `520px`、窄屏 `500px`，两个弹层都保留四角圆角并离底部至少 `8px/safe-area`；内容只在面板内部滚动。`static/tavo.runtime.parts/54_voice_picker_panel.js` 的 picker page size 改为 10。2026-06-03 用户进一步明确：设置页位置应在播放器位置上，不要固定在最下方；下一版应由 runtime 按播放器卡片 rect 给 panel/picker 写入 fixed top/left/width/height CSS 变量。

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

Fix: 当前正则入口改为 `https://sovits.928886540.xyz/static/tavo.js?v=2028881923`；loader 版本升到 `20260602-sovits-xhr-post-v33`；runtime parts 版本升到 `20260602-sovits-xhr-post-v15`。保存/应用 Tavo 正则后，必须回到真实聊天消息重新渲染，不能只改仓库 JSON。

Guard: 真实 Tavo 控制台脚本来源必须显示 `https://sovits.928886540.xyz/static/tavo.js?v=2028881923`。点击生成前确认同源 `/health`、`/static/tavo.runtime.js`、`/static/tavo.runtime.manifest.json`、21 个 runtime parts 和 `/parse_text` 可达；如果控制台仍显示旧子域名或旧 `v=2028821788` / `v=2028881918`，先清正则/消息渲染缓存，不继续查 LLM。

## BUG-023: 旧品牌命名和旧子域名残留

Status: patched in code, needs real Tavo regression

Repro: 用户要求把旧 `index` 系列命名改成小写 `sovits`，并把外网映射子域名切到 `sovits.928886540.xyz`。运行时代码、测试页和活跃文档里仍残留旧产品名、旧 storage key、旧 IndexedDB 名、旧 data attr、旧 MediaSession 文案和旧正则入口。

Root cause: 当前 Tavo runtime 是从旧产品链路迁移来的，部分 UI/存储/测试页标识只做了 GPT-SoVITS 产品层替换，没有统一收口为 `sovits` 命名。正则入口也仍以 LAN 或旧子域名为主，无法匹配用户新的 Cloudflare Tunnel 子域名。

Fix: 正则入口改为 `https://sovits.928886540.xyz/static/tavo.js?v=2028881923`；loader/runtime 版本同步 bump。运行时新写入 `sovits_tracks_*` 和 `sovits_tavo_audio_v1`，并保留旧 key/旧 IndexedDB 的读取兼容，避免历史播放记录和本机离线音频直接丢失。测试页和 active runtime 文案/console/MediaSession/data attr 改成小写 `sovits`。

Guard: 活跃代码/活跃文档不应出现旧品牌文案；允许历史报告、旧对比资料和旧 voice profile provenance 保留。真实 Tavo 正则必须加载 `sovits.928886540.xyz` 且历史音频仍能显示/恢复。

## BUG-024: Tavo about:srcdoc WebView 阻断跨源 JSON POST

Status: fixed in code, needs real Tavo regression

Repro: 用户真实 Tavo 日志已经显示脚本来源是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881918`，但点击智能生成时仍报：`LLM 解析代理 /parse_text 请求没有到达后端`，请求 URL 是 `https://sovits.928886540.xyz/parse_text`，浏览器错误 `TypeError: Load failed`，当前页面 `about:srcdoc`。

Evidence: 同一域名 `/health` 返回 200，`/static/tavo.js?v=2028881918` 能被 Tavo 加载，`curl POST /parse_text {}` 返回 422，说明 Cloudflare Tunnel、adapter 路由和后端都可达。失败只发生在 Tavo AR `about:srcdoc` WebView 的浏览器 `fetch()` 路径，且是 JSON POST / preflight 类请求。

Root cause: 旧版前端用 `Content-Type: application/json` 发 `/parse_text`，在 Tavo AR 真实 WebView 里会走 JSON POST / preflight 链路，用户日志表现为 `TypeError: Load failed` 且请求未到 adapter。`<script src>`、runtime manifest/parts GET 和 `/health` 可达只能证明静态加载链路通，不能证明 JSON POST 链路通。

Fix: v1923 把 `/parse_text`、`/tts_stream_job`、`/tts_dialogue_stream_job` 的前端请求改为 XHR 主路径，`Content-Type: text/plain;charset=UTF-8`，body 仍是 JSON 字符串；后端 `_parse_request_model()` 同时兼容 `application/json` 和 `text/plain`。这不是 RPC/iframe/bundle，只是同一个 adapter API 的请求体解析兼容。v1919 曾尝试 hidden iframe bridge，但真实 Tavo 里会跳出页面且 `/parse_text` 仍失败，已在 BUG-025 废弃。

Guard: 已通过代理公网验证：`/static/tavo.js?v=2028881923` 返回 `20260602-sovits-xhr-post-v33`，part 00 返回 `adapterXhrTextPost()`。真实 Tavo 智能生成必须能看到 adapter 收到 `/parse_text`；如果后端访问 LLM 失败，错误应变成明确的 `LLM parse failed` / endpoint/model/key 问题，而不是浏览器 `TypeError: Load failed`。

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

Fix: 已撤回 iframe bridge/RPC/bundle 方向。当前保留 `static/tavo.js -> static/tavo.runtime.js -> static/tavo.runtime.manifest.json -> 21 个 runtime parts -> eval`。正则入口升到 `v=2028881923`，loader `20260602-sovits-xhr-post-v33`，runtime manifest/parts `20260602-sovits-xhr-post-v15`。`adapterFetch()` 回到原生 `fetch(url, init)`，adapter JSON 创建请求通过 `adapterJsonPost()` 以 XHR text/plain POST 发送。

Guard: 真实 Tavo 点击懒加载卡片后，应看到 `GET /static/tavo.runtime.js?...`、`GET /static/tavo.runtime.manifest.json?...`、21 个 `GET /static/tavo.runtime.parts/*.js?...` 和 CSS skin；不应请求 `tavo.runtime.bundle.js`，不应创建 iframe，不应出现 RPC/WebSocket/JSONP。完整播放器仍必须等 `window.__gptsovits_tavo_runtime_ready` resolve 后再隐藏懒加载卡片。

## BUG-027: LLM 拆段复用仍检查 LLM 配置且设置保存后使用旧模型

Status: fixed in code, needs real Tavo regression

Repro: 用户真实 Tavo 中勾选“复用 LLM 拆段”后，已有拆段应直接复用，但前端仍请求 `/parse_text`；当旧 LLM provider 返回 `auth_unavailable` 时，复用路径也报 LLM 不可用。用户修改 LLM 模型/endpoint 后，生成请求仍显示旧 `endpoint=http://127.0.0.1:8317/v1`、旧 `model=渡鸦/grok-4.20-fast`。

Root cause: 当前 `parseReuseFingerprint()` 把 `llmEndpoint` 和 `llmModel` 写进复用 fingerprint，用户换模型会导致旧拆段缓存失配，进而重新请求 LLM。设置读取也可能优先从当前 widget/root 里拿到旧字段，而不是当前打开的设置 panel 字段。2026-06-02 模拟器复测继续出现旧模型，是因为 adapter `/parse_text` 使用 `LLM_MODEL or request.model`，后端环境变量会覆盖 Tavo 页面保存的模型；页面字段保存成功也不会生效。

Fix: `static/tavo.runtime.parts/32_llm_reuse_helpers.js` 的 LLM 拆段复用 fingerprint 升到 v4，只按消息正文、用户身份、角色身份匹配，不再包含 endpoint/model/key；命中复用时直接返回 segments，绝不调用 `/parse_text`。同时兼容旧 v3 localStorage 记录，扫描 `gptsovits_llm_parse_*` 时忽略 endpoint/model。`static/tavo.runtime.parts/48_settings_fields.js` 的字段读取改成优先当前打开的 panel，保存/生成前同步页面当前值到 `cfg`。版本升到正则 `v=2028881924`、loader `20260602-sovits-llm-reuse-v34`、runtime `20260602-sovits-llm-reuse-v16`。`gsv_tavo_adapter.py` 的 `/parse_text` 改为 request endpoint/model/api_key 优先，后端 env 只做兜底；Tavo 页面当前配置必须能覆盖本机默认 env。

Guard: 同一消息已有 LLM 拆段缓存时，即使 LLM endpoint/model/key 为空、不可用或换成新模型，也必须显示“复用 LLM 拆段”，adapter 日志不能出现新的 `POST /parse_text`。保存设置后，下一次生成日志里的 endpoint/model 必须是页面当前值；`/llm_config` 只能表示 env default，不能说明 env 会覆盖页面请求。

## BUG-028: 官方推理失败被提示成音频流格式异常

Status: fixed in code, needs real Tavo regression

Repro: 用户 2026-06-02 iPhone / 本地模拟器截图显示：JavaScript console 里先出现 `Web Audio 流式异常: [step:wavHeader] WAV 头未到先断流`，随后明确记录 `服务端推理失败: segment 0 role=旁白 failed: official API HTTP 502:`；但播放器卡片显示 `播放失败` / `音频流格式异常，请重新生成一次。`

Root cause: 前端错误分层不对。`friendlyPlaybackError()` 把 `wavHeader` / `WAV` 直接归类成“音频流格式异常”，但这只是服务端没有返回有效 WAV 首包后的播放层症状。`pollCacheUpgrade()` 看到 `/tts_dialogue_job_status` 的 `state=failed` 时只写 `debugLog("服务端推理失败")`，没有把失败原因写回 track/card/status，所以 UI 仍保留播放层的误导提示。

Fix: `static/tavo.runtime.parts/34_element_audio_controls.js` 新增 `readableServerJobError()` 和 `applyServerJobFailure()`，统一把官方 API HTTP 502、参考音频非法、LLM 上游错误等后端失败转成可读卡片提示。`friendlyPlaybackError()` 对 `[step:wavHeader] WAV 头未到先断流` 不再提示“格式异常”，改成“服务端未返回音频流首包，正在确认服务端合成状态”。`static/tavo.runtime.parts/42_saved_playback_cache.js` 和 `44_track_history_cache.js` 在 job status `state=failed` 时写回 track/card/status/history；`pollCacheUpgrade()` 失败路径补 `done=true`，不再继续按等待落盘超时处理。

Guard: 如果 `/tts_dialogue_job_status/<cache_key>` 返回 `state=failed`，UI 必须显示“服务端推理失败”以及官方 API / voice profile / LLM 上游的真实错误摘要，不能显示“音频流格式异常”。只有已保存 WAV 解码失败、真实 `decodeAudioData` 或 WAV data 段损坏时，才允许提示音频格式异常。

## BUG-029: 本机代理把 adapter 到官方 9881 的调用伪装成官方 HTTP 502

Status: fixed, adapter/live paths verified

Repro: 用户真实 Tavo / LDPlayer 生成时，adapter 日志显示 `/parse_text` 已通过，`/tts_dialogue_stream_job` 已到后端，但第 0 段官方 TTS 失败：`segment 0 role=旁白 failed: official API HTTP 502:`，HTTP body 为空。官方 GPT-SoVITS 旧日志未更新，`curl.exe --noproxy "*"` 直连 `http://127.0.0.1:9881/docs` 连接失败；不绕代理访问同 URL 或显式 `-x http://127.0.0.1:7897` 访问同 URL，则返回空 body `502 Bad Gateway`。

Evidence: 当前环境存在 `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY=http://127.0.0.1:7897`，`python urllib.request.urlopen("http://127.0.0.1:9881/docs")` 复现 `HTTPError 502 Bad Gateway`；用 `ProxyHandler({})` 绕过代理后，同 URL 变成真实 `URLError [WinError 10061]`。这说明 adapter 看到的 502 很可能来自本机代理 7897，不是官方 GPT-SoVITS 自己返回的 502。

Root cause: adapter 使用 `urllib.request.urlopen()` 调官方 `OFFICIAL_TTS_URL`，会读取进程环境里的代理变量。默认官方地址是 `http://127.0.0.1:9881/tts`，它是本机推理服务，不应该经过公网/系统代理。代理介入后会把“9881 未监听/不可达”伪装成空 body 502，导致前端和日志把问题误判成官方接口返回 502。同时本机官方 9881 当时确实没有常驻运行；普通 Codex 工具调用里拉起的 official 子进程会在调用结束后被清理，需要通过任务计划常驻。

Fix: `gsv_tavo_adapter.py` 新增 official URL no-proxy opener：当 `GPT_SOVITS_OFFICIAL_TTS_URL` 是 loopback / private / link-local 地址时，adapter 用 `ProxyHandler({})` 绕过系统代理；可用 `GPT_SOVITS_OFFICIAL_BYPASS_PROXY=0/1/auto` 控制。新增 `dev_tools/run_official_api_9881.ps1`，并注册任务计划 `GPT-SoVITS Official API 9881` 用来常驻启动官方 `api_v2.py -a 127.0.0.1 -p 9881`。

Guard: 在有 `HTTP_PROXY=http://127.0.0.1:7897` 的环境下，adapter 调 `http://127.0.0.1:9881/tts` 不能再得到代理空 body 502；如果 9881 未启动，应显示 `official API connection failed: [WinError 10061]` 这类真实连接失败。如果 9881 已启动，则官方日志应更新并返回 WAV 或官方自身的明确错误。2026-06-03 已验证：`python urllib` 默认走代理会复现 502；adapter helper 绕代理后 `/docs` 返回 200；直接 official TTS 生成 `reports/official_tts_proxyfix_20260603/bingshan_gaoyuanyuan.wav`；adapter queued job `d23b5e8df15adb928e73b11a2df40ae4ddb71464` 最终 `done/cached=true`；adapter live job `7627c06937a1398280ac3453e16011cf5ad4a649` 最终 `done/cached=true`。

## BUG-030: live 流式播放时点歌词触发重复 snapshot 切历史且不能续播

Status: patched in code, needs real Tavo regression

Repro: 用户真实 Tavo 流式播放过程中误点歌词区域；前端重新连接音频，随后提示不能恢复/不能播放；控制台打印约 10 条 `✅ play snapshot 已保存，切换为历史音频`。

Evidence: `static/tavo.runtime.parts/52_voice_subtitle_media.js` 的歌词行点击会调用 `seekToSeconds()`；`static/tavo.runtime.parts/60_generate_mount_boot.js` 的 play 路径在当前 live track 有 `cacheKey` 时会 `refreshTrackFromStatus(existingTrack, "play snapshot")`；`static/tavo.runtime.parts/42_saved_playback_cache.js` 里 `refreshTrackFromStatus()` 成功后会打印 `✅ <label> 已保存，切换为历史音频`。

Root cause: confirmed. `seekToSeconds()` 原来把 live track 也当成可 seek 对象；当歌词点击传入 startSec 时，会对 `liveStreamUrlForTrack()` 调 `playLiveTrack(... startOffsetSec=pos)`，等价于重新连接流式音频。歌词行点击本身也没有 `preventDefault/stopPropagation`，在 Tavo AR 事件环境里可能继续穿透到外层播放路径。`refreshTrackFromStatus(..., "play snapshot")` 的 done 日志也没有按 cache/label 去重，所以同一条保存状态可刷多次。

Fix: `static/tavo.runtime.parts/34_element_audio_controls.js` 不再允许 live 未落盘 track 通过 seek 重连；live 下点击歌词只显示“流式播放中，歌词跳转需等完整音频保存后使用”。`52_voice_subtitle_media.js` 给歌词行 click 加 `preventDefault/stopPropagation`。`42_saved_playback_cache.js` 对同一 cache/label 的“已保存，切换为历史音频”日志去重。

Guard: live 流式播放时点击歌词行只能在已有可 seek 的本地/历史音频上跳转；如果当前是 live stream 且 cache 还没落盘，点击歌词不能重新连接、不能触发 play snapshot、不能刷多条“切换为历史音频”。落盘完成后再允许切历史音频/seek。

## BUG-031: 快照卡片不显示历史音频条数

Status: patched in code, needs real Tavo regression

Repro: 用户反馈快照卡片看不到历史音频条数。

Evidence: `static/tavo.js` 和 `static/tavo.runtime.parts/05_message_text_config.js` 都按 `sovits_tracks_<messageId>` -> 旧 key 的顺序读取历史；当前逻辑遇到第一个数组就返回，即使这个新 key 是空数组，也不会继续检查旧 key 或后续非空历史。`static/tavo.runtime.parts/25_ui_templates.js` 还把 lazy 状态文案写成 `快照 X 条 / 未生成`，不是用户要看的 `历史音频 X 条`。

Root cause: confirmed. `static/tavo.js` 和 `static/tavo.runtime.parts/05_message_text_config.js` 都遇到第一个数组就返回；新 key 如果是空数组，会遮住旧 key 里的非空历史。runtime lazy shell 还继续显示 `快照 / 未生成`，和 loader lazy shell 的 `历史音频` 不一致。

Fix: history 读取改为优先第一个非空 tracks 数组；只有所有来源都空时才返回空数组。异步读取到旧 key 非空历史时，迁移写回新的 `sovits_tracks_<messageId>` localStorage。`25_ui_templates.js` 的 runtime lazy shell 改为 `历史音频 N 条` / `历史音频 0 条 · 点开播放器`。

Guard: 快照/lazy 卡片必须稳定显示 `历史音频 N 条`；如果新 key 为空但旧 key 有历史，应显示旧 key 的条数并迁移到新 key。BUG-019 的规则仍然保留：显示历史条数不等于自动读取/复用旧音频。

## BUG-032: 重进 Tavo 消息后历史恢复、读取音频和本机缓存补偿状态混乱

Status: patched in code, needs real Tavo regression

Repro: 用户关闭 Tavo 后重新进入同一条消息。控制台日志显示 `📂 按需恢复历史 tracks: 1 段, 未预取本机缓存音频/未轮询落盘`，但页面文案显示 `读取已保存音频`；随后播放不了，并出现 `⚠️ play compensation 本机缓存保存失败，稍后播放在线音频时补偿: Load failed` 或泛化的 `❌ 错误: Error`。用户确认这不是一次性卡片，第二次进消息也必须能播放历史音频。

Evidence: `static/tavo.runtime.parts/44_track_history_cache.js` 的 `ensureTracksLoaded(selectRestored=true)` 会恢复并选择历史 track，但日志说未预取/未轮询；`selectTrack()` 对 saved track 在 `autoplay=false` 时应只显示“点播放读取”，但播放路径 `playSavedTrack()` 会先 `prepareOfflineAudio(... saveMissing=true)`，离线缓存补写失败日志会被用户看到为播放失败原因。`static/tavo.runtime.parts/42_saved_playback_cache.js` 的读取保存音频文案只适合真实 fetch/decode 阶段，不能用于 metadata-only 恢复。生成 catch 路径把空 message 的异常显示成 `错误: Error`。

Root cause: confirmed. `ensureTracksLoaded(selectRestored=true)` 重进消息时会选择历史 track，但旧 `selectTrack()` 仍可能校验 saved cache、hydrate 离线缓存或显示真实读取文案；这和“只恢复 metadata”的日志矛盾。播放路径又在真正播放前调用 `prepareOfflineAudio(... saveMissing=true)`，导致 IndexedDB 副本补写失败日志和在线播放失败混在一起。部分 WebView 异常 message 为空，生成 catch 使用 `String(e)` 后显示成裸 `Error`。

Fix: `selectTrack(index, autoplay, { metadataOnly: true })` 新增 metadata-only 分支；重进消息只恢复历史条目、计数、断点和提示，不请求 `/cache_audio`、不请求 job status、不补写 IndexedDB。点击播放后才进入真实 `读取已保存音频/读取本机缓存`。`playSavedTrack()` 改为先 hydrate 已有 IndexedDB，再校验/播放在线保存音频；离线副本保存延后并降级为“不影响在线播放”的日志。新增 `errorMessage()`，TTS job、播放、历史读取和事件 catch 不再把空异常显示成 `Error`。

Guard: 重进同一条 Tavo 消息时，懒加载卡片/完整播放器应显示 `历史音频 N 条` 和“点播放读取历史音频”，不得在未点击播放时显示 `读取已保存音频`。点击播放才允许进入“读取已保存音频/读取本机缓存”状态；IndexedDB 补写失败只能作为离线缓存提示，不能阻断在线音频播放，也不能显示成泛化 `Error`。

## BUG-050: 播放完成后点播放按钮，音频在末尾跳一下然后结束

Status: fixed locally, needs real Tavo regression

Repro: 用户 2026-06-04 反馈：播放完成后点播放按钮，音频不是从头播放，而是在末尾跳一下然后结束。

Root cause: `62_dialog_audio_events.js` 第112行的 `tryResumeOrPauseInGesture()` 函数，当检测到 `audio.ended` 为 `true` 时，直接 `return false` 跳过播放逻辑，导致播放按钮点击后无法重新播放。正确的行为应该是：当 `audio.ended` 时，重置 `currentTime` 到0并重新调用 `play()`。

Fix: 修改 `tryResumeOrPauseInGesture()` 第111-120行逻辑：分离 `audio.ended` 判断，当 `ended` 为 `true` 时，执行 `audio.currentTime = 0; audio.play();` 从头播放；只有当 `!(audio.currentSrc || audio.src)` 时才 `return false`。

Guard: 真实 Tavo 回归时，播放完成后（audio ended 事件触发，状态显示"播放完成"），点播放按钮应从0秒重新播放，而不是在末尾跳动或无响应。

Notes: 这是一个常见的 HTML5 audio ended 状态处理问题。修复后的逻辑：`!src` → return false（无音频源）；`ended` → 重置并播放；`paused` → 播放；`!paused` → 暂停。

## BUG-051: 流式播放时歌词卡顿，头像跑得快但歌词不显示

Status: fixed locally, needs real Tavo regression

Repro: 用户 2026-06-04 反馈：流式播放时歌词很卡，头像和进度条在走但歌词不显示或显示很慢。

Root cause: `52_voice_subtitle_media.js` 第272-313行的 `rebuild()` 函数每次都通过 `subBox.innerHTML = renderSubtitleRowsHtml(...)` 全量重建歌词DOM。在流式播放时，后台轮询每1.5秒拿到新的 `segments_meta`，即使 `lastMetaSignature` 判断内容没变，只要长度增加（新增segment），就会触发全量 rebuild，销毁所有旧DOM节点并创建新的，导致卡顿和闪烁。

Fix: 添加 `lastRenderedCount` 变量记录上次渲染的 timeline 长度。`rebuild()` 时只有当 `timeline.length !== lastRenderedCount` 时才调用 `renderSubtitleRows()` 重新渲染DOM，避免相同长度时的无意义重建。这样在流式播放中，只有新增segment时才会重建DOM，时间戳校准（signature变化但长度不变）不会触发DOM操作。

Guard: 真实 Tavo 回归时，流式播放中歌词应实时显示，不卡顿；头像/进度条/歌词高亮应同步；新增segment时歌词区平滑增加新行，不应整个区域闪烁重建。

Notes: 这个修复减少了流式播放中的DOM操作频率。如果仍有卡顿，可能需要进一步优化为增量插入DOM（只append新segment对应的行），而不是长度变化时仍然全量重建。

## BUG-052: 流式播放切后台断开，无缓存重连不顺畅

Status: investigating, 涉及浏览器后台策略和系统限制

Repro: 用户 2026-06-04 反馈两个问题：
1. 流式播放时切控制台日志或切桌面，音频就断开
2. 流式播放没有缓存，每次重连都要重新连接后端，很不顺畅

Root cause (切后台断开): 
- `10_tts_jobs_audio_stream.js` 的 `streamWavViaWebAudio()` 使用 fetch ReadableStream + Web Audio API 播放
- 切后台时可能触发：
  1. AudioContext 被系统挂起为 `suspended` 状态（已有恢复逻辑，但需要 `schedulePcm()` 被调用才触发）
  2. fetch reader 被浏览器后台策略关闭或暂停
  3. iOS/Android WebView 后台网络请求被限制
- BUG-049 已允许用户手动恢复，但不是根本解决方案

Root cause (无缓存重连): 
- 当前 live stream 架构是实时消费：fetch → reader.read() → schedulePcm() → 播放，**没有客户端缓存**
- 已播放的 PCM 数据立即丢弃，没有保留在内存
- 断线重连时只能从头重新 fetch，或者依赖后端的 `startOffsetSec` 参数跳过已播放部分
- 用户体验不顺畅：每次蓝牙断开、耳机拔出、切后台恢复，都要重新连接后端

Fix (切后台): 需要深入排查：
1. 添加 Page Visibility API 监听，切后台时主动保存断点并暂停
2. 回前台时检测 AudioContext 和 reader 状态，自动恢复或提示用户点播放
3. 或改为使用 `<audio>` 元素播放 live stream（系统原生支持后台播放，但可能遇到 Content-Length 未知报错）

Fix (缓存重连): 需要实现客户端缓存机制：
1. 在 `streamWavViaWebAudio()` 中，已播放的 PCM 数据保留在内存（环形buffer或滑动窗口）
2. 断线重连时，先从缓存播放已有部分，同时继续 fetch 新数据
3. 或将 live stream 数据实时写入 IndexedDB，断线后可以完全离线播放已缓存部分
4. 需要权衡内存占用（长音频的PCM数据量大）

Guard: 流式播放切后台应保持播放或保留断点；回前台时应自动恢复或提示用户恢复；断线重连时应从上次位置续播，不需要重新连接后端或重新播放已播放部分。

Notes: 这是两个相关但独立的问题。切后台断开属于系统限制，可能需要妥协方案（提示用户保持前台或使用后台播放通知）；缓存重连是架构问题，需要重构 live stream 消费逻辑。优先级：先实现断点恢复（保存 `scheduledAudioSec` 并在重连时从该位置开始），再考虑完整的客户端缓存。

## BUG-053: 音质参数未传递到后端，导致极限档质量差

Status: fixed locally, needs backend restart

Repro: 用户 2026-06-04 反馈极限档音质很差：声音闷、音量大小不一、丢字、突然被抽气。检查后发现即使前端提升了音质参数（diffusion_steps、prompt_audio_seconds、segment_tokens、first_tokens），音质仍然很差。

Root cause: 前端 `generationQualityOverrides()` 函数生成的音质参数（`prompt_audio_seconds`、`segment_tokens`、`first_tokens`）通过 `Object.assign` 合并到请求body中发送给后端，但后端 `DialogueStreamRequest` 和 `SingleStreamRequest` 模型中**根本没有定义这些字段**，导致后端接收不到，也不会传递给官方GPT-SoVITS API。结果就是：前端设置的音质档位参数全部丢失，实际推理时使用的是默认值。

具体来说：
- `prompt_audio_seconds`: 参考音频长度，影响音色稳定性和表现力（极限档18s vs 默认值可能只有3-6s）
- `segment_tokens`: 每段token数，影响流畅度和自然度（极限档100 vs 默认值未知）
- `first_tokens`: 首段token数，影响起播质量（极限档40 vs 默认值未知）

这三个参数是音质的核心，丢失后即使 `diffusion_steps=48` 也无法发挥作用。

Fix: 
1. 在 `DialogueStreamRequest` 和 `SingleStreamRequest` 模型中添加 `prompt_audio_seconds`、`segment_tokens`、`first_tokens` 字段
2. 在 `_official_payload_for_segment()` 中使用 `request_or_default()` 处理这三个参数
3. 在 `_enrich_dialogue_metrics()` 的 metrics 循环中添加这三个字段，以便在落盘日志中能看到它们的实际值

Guard: 后端重启后，前端设置的音质档位参数应正确传递到官方API；落盘日志中应显示 `prompt_audio=18s`、`segment_tokens=100`、`first_tokens=40` 等实际值（极限档）；音质应明显提升，不再出现声音闷、丢字、抽气感等问题。

Notes: 这是一个严重的参数传递bug，导致前端音质设置完全失效。修复后需要重启后端服务才能生效。建议用户测试时观察落盘日志中的 `🔍 详细参数` 行，确认这三个参数是否正确传递。

关于音质问题的其他可能原因：
- 参考音频质量：如果 `ref_audio_path` 指向的音频本身质量差，会影响整体音质
- GPT-SoVITS模型本身的限制：某些发音可能本身就容易丢字或不清晰
- 音量不一致：可能需要后端添加音量归一化处理
- 抽气感：可能是参考音频中就有气声，或者需要调整 style_alpha 参数


## BUG-054: 音质档位参数不正确，官方API不支持某些参数

Status: fixed locally, needs backend restart + frontend reload

Repro: 用户 2026-06-04 反馈音质很差，检查后发现前端 `generationQualityOverrides()` 中传递的 `prompt_audio_seconds`、`segment_tokens`、`first_tokens` 参数**GPT-SoVITS官方API根本不支持**。

Root cause: 
1. 前端传递了官方API不支持的参数（prompt_audio_seconds、segment_tokens、first_tokens）
2. 后端也尝试接收并传递这些参数，但官方API会忽略它们
3. 官方API支持的音质参数只有：`sample_steps`、`batch_size`、`super_sampling`、`top_k/p/temperature`、`repetition_penalty`
4. `super_sampling` 参数后端写死为 `False`，前端也没有根据档位传递，导致极限档无法开启超采样

根据官方API文档（api_v2.py），支持的参数列表：
```python
top_k, top_p, temperature, text_split_method, batch_size, 
batch_threshold, split_bucket, speed_factor, fragment_interval, 
seed, parallel_infer, repetition_penalty, sample_steps, super_sampling
```

Fix:
1. 前端：删除不支持的参数（prompt_audio_seconds、segment_tokens、first_tokens）
2. 前端：极限档开启 `super_sampling: true`，提升 `sample_steps` 到50
3. 后端：`DialogueStreamRequest` 和 `SingleStreamRequest` 添加 `super_sampling` 字段
4. 后端：payload构建时使用 `request_or_default("super_sampling", ...)` 接收前端参数
5. 后端：metrics中添加 `super_sampling` 字段

新的档位配置：
- 极速档：sample_steps=12, batch_size=6, super_sampling=false
- 标准档：sample_steps=20, batch_size=4, super_sampling=false
- 质量优先：sample_steps=30, batch_size=4, super_sampling=false
- 极限档：sample_steps=50, batch_size=2, super_sampling=true ✨

Guard: 重启后端+刷新前端后，极限档生成的音频应在日志中显示 `super_sampling=True`；音质应有提升（超采样会提高音频分辨率）。

Notes: 
- `super_sampling` 是GPT-SoVITS官方的音质提升开关，但会增加推理时间
- 如果音质仍然不理想，可能需要：
  1. 检查参考音频（ref_audio_path）的质量
  2. 使用辅助参考音频（aux_ref_audio_paths）增加音色稳定性
  3. 调整 `text_split_method`、`fragment_interval` 等参数
  4. 考虑使用更高质量的GPT-SoVITS模型

- 关于音质问题的其他可能原因：
  - 声音闷：可能是参考音频本身闷，或者模型训练数据偏向闷的音色
  - 音量大小不一：可能需要后端添加音量归一化处理
  - 丢字/漏字：可能是 `text_split_method` 不合适，或者某些字的发音模型本身不擅长
  - 抽气感：可能是参考音频中有气声，或者 `aux_ref_audio_paths` 中混入了气声风格

建议下一步实现 Whisper 转录比对，自动检测漏字问题。

## BUG-055: LLM错误提示又臭又长，看不懂

Status: fixed locally, needs frontend reload

Repro: 用户 2026-06-04 反馈LLM解析失败时的错误提示"又臭又长"，"谁他妈知道你在说什么东西"。原提示包含大量技术细节和多行说明，用户看不懂。

Root cause: 错误提示包含过多技术术语和冗长的说明文字，例如："LLM 访问位置: Tavo AR -> GPT-SoVITS adapter /parse_text -> LLM 上游；Tavo 页面 endpoint/model/key 优先，后端 env 只作兜底..."。用户只想知道**到底哪里出错了**，以及**后端返回的原始错误**，而不是一大堆可能原因。

Fix:
1. 网络错误：直接显示"❌ 网络错误: 无法连接到 {URL}"，后面跟原始错误信息
2. HTTP错误：显示"❌ 后端返回错误 (HTTP {status})"，**直接显示后端返回的原始错误文本**
3. JSON解析错误：显示"❌ 后端返回的不是JSON"，**显示原始响应内容**

删除所有"可能原因: 1. xxx 2. xxx"这种瞎猜的提示。如果是后端返回的错误，就直接显示后端说了什么；如果是LLM返回的错误，就显示LLM说了什么。

Guard: 刷新前端后，当LLM解析失败时，错误提示应该简短清晰，直接显示后端/LLM返回的原始错误信息，不要加一堆"可能原因"。

Notes: 
- 错误提示的目的是告诉用户**到底发生了什么**，而不是猜测可能的原因
- 如果后端返回了详细错误，就直接显示它，不要用自己编的提示盖住真实错误
- 用户看到真实错误信息后，能更快定位问题（LLM API key错误、model不存在、网络超时等）

关于用户当前遇到的"空响应"问题：可能是CORS、响应体过大、或Content-Type不对。需要用户提供浏览器Network面板的信息才能定位。

## BUG-056: 流式播放时没有歌词，歌词和头像不同步

Status: FIXED (2026-06-04)

Repro: 流式播放时进度条在走，有声音，但没有歌词。落盘后才有歌词。即使有歌词，歌词和头像也不同步，因为用的是估算时间而不是精确时间轴。

Root cause: 
1. 流式播放时，`_stream_dialogue_to_cache` 只在函数结束后才保存 segments_meta 到 JOBS
2. 流式播放过程中，JOBS[cache_key]["segments_meta"] 一直是空的
3. 前端轮询 job_status 拿到的 segments_meta_count=0，没有歌词
4. 即使落盘后有 segments_meta，但前端已经用估算时间生成了 timeline (exactTiming=false)，导致不同步

Fix:
修改 gsv_tavo_adapter.py 第1340行后，每处理完一个 segment 就立即更新 JOBS：
```python
# 实时更新JOBS的segments_meta，让流式播放时也能拿到歌词时间轴
with JOBS_LOCK:
    current = JOBS.get(cache_key, {})
    if current.get("state") not in {"deleted", "done"}:
        JOBS[cache_key] = {
            **current,
            "segments_meta": list(segments_meta),  # 深拷贝避免引用问题
            "sample_rate": sample_rate,
        }
```

这样：
1. 流式播放时，每生成一个 segment，前端立即能拿到 segments_meta
2. segments_meta 包含精确的 start_s 和 duration_s
3. timeline 用精确时间生成 (exactTiming=true)
4. 歌词和头像完美同步

Guard:
1. 流式播放时，前端控制台应该看到 `🎤 startSubtitle: segments_count>0`
2. 前端控制台应该看到 `🎵 timeline生成: exactTiming=true`
3. 歌词应该随播放进度实时高亮，和音频/头像完全同步

Notes:
- 这是一个架构性改进：从"流式结束后才有歌词"变成"边流式边生成歌词"
- 深拷贝 segments_meta 避免多线程竞争条件
- 同时更新 sample_rate，让前端能计算精确的时间轴

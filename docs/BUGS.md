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

Repro: iPhone 14 Pro 真机 Tavo 打开 GPT-SoVITS 设置页，设置面板在屏幕内显示成很长一条/宽度异常，内容被横向撑开或只剩中间窄区域可见。用户截图时间 2026-06-01 20:17，页面标题 `BoBo`，设置页可见 `LLM 配置` 与 `复用 LLM 拆段`。

Root cause: 当前 panel/picker CSS 依赖 `dialog` + `position: fixed` + `dvw/dvh` + transform 居中；iPhone Tavo WebView 的视觉视口、安全区和 transform 祖先处理与 LDPlayer 不一致。仅靠模拟器验证会漏掉该问题。

Fix: pending

Guard: 必须用 iPhone 14 Pro 真机或等效 iOS WebView 截图确认：设置页左右 inset 稳定、无横向滚动、内容不被压成超长窄条，`LLM 配置`、`复用 LLM 拆段`、保存按钮都在面板内正常显示。

Notes: 不要把 LDPlayer 正常当作 iPhone 正常；真实 iPhone 是这个 bug 的准绳。

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

Guard: 真实 Tavo 更新到 `static/tavo.js?v=2028881907` 后，首次点播放不应再出现 `element audio.play() 不支持` 作为流式首路径。

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


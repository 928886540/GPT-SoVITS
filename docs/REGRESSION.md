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

## BUG-024 about:srcdoc fetch bridge 回归

- 真实 Tavo 控制台脚本来源必须是 `https://sovits.928886540.xyz/static/tavo.js?v=2028881919`，loader 版本 `20260602-sovits-bridge-v29`，runtime manifest `20260602-sovits-bridge-v11`。
- 点击智能生成时控制台应出现 `about:srcdoc adapter fetch bridge: POST .../parse_text`。
- adapter 日志必须出现 `POST /parse_text`；失败时应是后端 HTTP/LLM 错误，不应再是浏览器 `TypeError: Load failed`。
- 后续 `POST /tts_dialogue_stream_job` 和删除历史的 `DELETE` 也应通过 bridge；音频流和 cache 音频 GET 仍直接走原 fetch/audio 路径。

## 普通模式 / 智能模式回归

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


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

## 2026-06-01 真实端回归新增

- 更新正则到当前 `static/tavo.js` 版本（目前 `v=2028881910`）后，移动 WebView 多音色 live 首次播放不应先报 `element audio.play() 不支持`；首路径应直接是 Web Audio。
- 勾选“保存到本机缓存”后，同一条已保存音频首次播放完成解码，再连续拖动进度条；日志不应重复请求同一 `/cache_audio/{key}` 或 `/tts_dialogue_stream_job/{key}`。
- LLM 拆段缺角色失败后，补角色映射再点生成；第二次必须命中“复用 LLM 拆段”，不能重新请求 `/parse_text`。
- 设置页合成档位必须显示 `极限质量`，不能出现 `极致/离线`。
- 用 cache `c23aca2bd05f294a1a0bf8152395886d9e4bbcc9` 的同文本重新生成：检查 `白产品经理，你今晚在公司到底给她灌了多少啊？` 不再吞前半句；`女声/风韵少妇` 段电平不能再明显小于旁白约 10 dB。

## BUG-018 Live Stream 中断回归

- 在真实 Tavo/LDPlayer 上重新触发多音色 live stream，必须记录新的 `cache_key`、角色映射、voice profile、`sample_steps`、`batch_size`、Tavo 控制台日志和 adapter log tail。
- 成功路径：`/tts_dialogue_job_status/<cache_key>` 最终必须返回 `state=done`、`cached=true`，且 `outputs/cache/<cache_key>.wav` / `.json` 存在。
- 失败路径：如果官方 GPT-SoVITS 上游断流，新 key 必须返回 `state=failed` 和明确错误；`outputs/logs/gsv_tavo_adapter_lan.out.log` 必须出现 `[gsv_adapter] dialogue_stream_failed`，错误应包含 segment index/role/text preview 以及 official stream 读取到的 bytes/chunks。
- 不要用旧 key `eda219ac41c210002f57480cab469d26fc163d6f` 验证本条；adapter 重启后旧内存 job 丢失，返回 `missing` 是预期状态。

## 普通模式 / 智能模式回归

- 前端主模式文案应显示“普通模式”和“智能模式”，不再把产品入口叫“单音色 / 多音色”。
- 普通模式生成前必须使用 JS 清洗后的正文，验证脚本标签、隐藏块、markdown 噪声、emoji/符号被剔除，但正文对白和旁白不被误删。
- 普通模式设置页必须能配置默认音色、旁白音色、对白音色；生成时记录实际使用的 voice，并确保 cache key 区分正文、模式、音色和推理参数。
- 智能模式仍走 LLM 拆段，角色映射、声腔、复用拆段缓存逻辑不能被普通模式改动破坏。

## iPhone 14 Pro 真机弹层回归

- 设置页必须在 iPhone 14 Pro 真机 Tavo WebView 内保持稳定宽度，不能显示成一条很长的窄面板，不能横向撑开。
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


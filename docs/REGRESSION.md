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

## 2026-06-01 真实端回归新增

- 更新正则到 `static/tavo.js?v=2028881907` 后，移动 WebView 多音色 live 首次播放不应先报 `element audio.play() 不支持`；首路径应直接是 Web Audio。
- 勾选“保存到本机缓存”后，同一条已保存音频首次播放完成解码，再连续拖动进度条；日志不应重复请求同一 `/cache_audio/{key}` 或 `/tts_dialogue_stream_job/{key}`。
- LLM 拆段缺角色失败后，补角色映射再点生成；第二次必须命中“复用 LLM 拆段”，不能重新请求 `/parse_text`。
- 设置页合成档位必须显示 `极限质量`，不能出现 `极致/离线`。
- 用 cache `c23aca2bd05f294a1a0bf8152395886d9e4bbcc9` 的同文本重新生成：检查 `白产品经理，你今晚在公司到底给她灌了多少啊？` 不再吞前半句；`女声/风韵少妇` 段电平不能再明显小于旁白约 10 dB。

## iPhone 14 Pro 真机弹层回归

- 设置页必须在 iPhone 14 Pro 真机 Tavo WebView 内保持稳定宽度，不能显示成一条很长的窄面板，不能横向撑开。
- 设置页打开后，点面板边缘、右上附近、滚动区空白处不能误关闭；只有设置页自己的 `×` 或保存按钮能关闭设置页。
- 从设置页进入 `选择音色` 后，点音色选择器右上 `X` 只能关闭当前音色选择层，并返回上一层设置页，不能直接回播放器。
- 音色选择器内点分类 tab，例如 `日日新`、`全部`，以及搜索框、音色卡片、右侧 `√`，都不能被 document 外部点击守卫误判为外部点击。
- 复测必须用 iPhone 真机或等效 iOS WebView；LDPlayer 通过不能替代这组回归。

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


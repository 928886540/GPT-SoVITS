# TODO

## P0

- 重开 Codex 后第一步：读 `AGENTS.md`、`README.md`、`docs/AGENT_STATE.md`、`docs/ARCHITECTURE.md`、`docs/DECISIONS.md`、`docs/BUGS.md`、`docs/TODO.md`、`docs/REGRESSION.md`，再跑 `git status --short`。不要回退当前未提交 runtime 拆分成果。
- 先做真实 Tavo/雷电回归：当前正则已 bump 到 `v=2028881923`，入口为 `https://sovits.928886540.xyz/static/tavo.js?v=2028881923`，需要在 Tavo 正则里刷新版本号，再确认 AR 动态 runtime loader、manifest、21 个 parts、CSS skin、播放器、设置页、音色选择器、懒加载首点播放和音符新建音频都加载/交互正常。
- 把 README 拆分后的 `docs/` 作为后续唯一活跃状态入口维护。
- 检查当前未提交 Tavo 代码改动，不要回退用户已有修改。
- 处理并行工作线冲突：Claude 线负责 `BUG-004/014/015/016` 的设置页、弹层、播放器；Codex 线负责“普通模式/智能模式”、普通模式三音色配置、正文清洗和规则拆段。改同一文件前必须先看 `git status --short` 和 `git diff -- static/tavo.runtime.js`。
- 补完普通/智能模式半成品：把前端模式文案从“单音色/多音色”改为“普通模式/智能模式”；普通模式使用 JS 清洗后的正文，并支持默认音色、旁白音色、对白音色；智能模式保留 LLM 拆段和角色声腔链路。
- runtime 第一版物理拆分已落地；CSS skin 和第一批 UI templates 已抽出；runtime 继续按函数边界拆到 21 个 parts。下一步不是继续机械切文件，而是把 UI templates/skin、settings、picker、audio player、text cleaning、dialogue jobs 升级成真正模块 API，最终支持可替换 UI/skin JS。
- runtime 架构升级已写入 `docs/RUNTIME_MODULARIZATION.md`。Phase 1 manifest loader 已实现并通过本地检查；下一步只做真实 Tavo/雷电回归，不要同时迁 UI 真模块或业务逻辑。
- 重启后先回到真实 Tavo 聊天页，继续核对消息卡片、播放器和音色选择器，不要把当前正则页截图当作完成。
- 用真实 Tavo / 雷电模拟器验证音色选择器：单击试听，点 `√` 应用。
- 继续收尾 `BUG-018`：真实 Tavo/LDPlayer 已拿到新 key `34f2b685f300e080e4a139f6ea1d83450b5ef67f`，确认失败时状态接口返回 `state=failed` 且日志出现 `[gsv_adapter] dialogue_stream_failed`。根因是 `男声/霸道青年.mp3` 只有约 1.6 秒，低于官方 GPT-SoVITS 参考音频 3-10 秒要求。下一步要更换/重做 `男声/霸道青年` 的 3-10 秒参考音频和逐字稿，或先把 Tavo 用户音色映射改到合法男声音色后复测成功路径。
- 用真实 Tavo 验证播放器按钮：保留上一条/下一条，移除可见 10 秒 seek UI。
- 复测局域网手机播放 `audio error code=4` 和 `audio.play() 不支持`。
- 把真实 Tavo 正则更新到 `https://sovits.928886540.xyz/static/tavo.js?v=2028881923`，重启 adapter/Cloudflare Tunnel 后复测：AR 动态 runtime loader、移动端 live 直走 Web Audio、懒加载播放首点能继续播放历史、加载完整播放器不出现裸 HTML 闪屏、音符按钮每次创建新音频 cache key、保存音频 seek 不重拉、补角色后 LLM 拆段复用、设置页不再出现 `极致/离线`。
- 注意 runtime loader 是从入口脚本 `src` 派生同源静态资源 base，不是外网专用；如果真实 Tavo 正则切回 LAN loader，同一套动态 loader 应自动使用 LAN origin，不允许再维护一套外网专用分支。
- 单独回归 BUG-024 `/parse_text`：新版前端应通过 XHR `text/plain;charset=UTF-8` POST 请求 `/parse_text`；adapter 日志必须出现 `POST /parse_text`。若返回 `LLM parse failed` / `auth_unavailable`，继续查 LLM 配置，不再查 Tavo AR fetch。
- 用同文本重新生成新 cache，核对 `白产品经理，你今晚在公司到底给她灌了多少啊？` 不再吞字；比较 `女声/风韵少妇` 与旁白电平，确认 `post_gain_db=9.0` 是否合适。
- iPhone 14 Pro 真机回归 BUG-004/014/015：设置页和选择音色页都必须是中等固定高度，底部圆角可见，不能显示成一条长窄面板或接近全屏长面板；选择音色页一页 10 个；点边缘/右上/空白不能误关闭；从设置页进入 `选择音色` 后，点 picker `X` 必须回到设置页；点 `日日新`、`全部` 等分类 tab 不能触发外部关闭。

## P1

- 按 `docs/RUNTIME_MODULARIZATION.md` 继续模块化 `static/tavo.runtime.parts/`：Phase 1 manifest loader 已本地通过，先做真实端回归；Phase 2 才引入 module registry；Phase 3 才做 UI/skin 可替换；Phase 4 再迁业务模块 API。每阶段保持行为等价，避免和正在修的 bug 混成大补丁。
- 质量档重做：同文本、同角色、多音色流程测试 `sample_steps=24` 和 `sample_steps=32`。
- 每个测试输出放 `reports/<case>/`，不要放 `outputs/cache`。
- 每个生成音频先跑 Whisper CLI，再人工试听。
- 角色映射测试前从当前 Tavo 配置读取，不沿用旧名字。

## P2

- 真逐句 live streaming 优化。当前先保证多音色/句级声腔正确，低首包逐句流式后置。
- 建立更稳定的自动化回归脚本，覆盖前端基本行为、adapter 接口和 cache metadata。
- 训练向导和本地打包流程后置，先完成推理链路与真实 Tavo 稳定性。

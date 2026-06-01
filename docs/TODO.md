# TODO

## P0

- 重开 Codex 后第一步：读 `AGENTS.md`、`README.md`、`docs/AGENT_STATE.md`、`docs/ARCHITECTURE.md`、`docs/DECISIONS.md`、`docs/BUGS.md`、`docs/TODO.md`、`docs/REGRESSION.md`，再跑 `git status --short`。不要回退当前未提交 runtime 拆分成果。
- 先做真实 Tavo/雷电回归：已确认正则至少拉到 `v=2028881910`，点击真实聊天卡片后 21 个 runtime parts 和 CSS skin 从模拟器侧加载 200，播放器和设置页可打开。剩余：音色选择器还未验证，下一步不要盲点坐标，先稳定打开设置页，再精确点击 `.idx-voice-btn` 或人工验证 picker 试听/应用。
- 把 README 拆分后的 `docs/` 作为后续唯一活跃状态入口维护。
- 检查当前未提交 Tavo 代码改动，不要回退用户已有修改。
- 处理并行工作线冲突：Claude 线负责 `BUG-004/014/015/016` 的设置页、弹层、播放器；Codex 线负责“普通模式/智能模式”、普通模式三音色配置、正文清洗和规则拆段。改同一文件前必须先看 `git status --short` 和 `git diff -- static/tavo.runtime.js`。
- 补完普通/智能模式半成品：把前端模式文案从“单音色/多音色”改为“普通模式/智能模式”；普通模式使用 JS 清洗后的正文，并支持默认音色、旁白音色、对白音色；智能模式保留 LLM 拆段和角色声腔链路。
- runtime 第一版物理拆分已落地；CSS skin 和第一批 UI templates 已抽出；runtime 继续按函数边界拆到 21 个 parts。下一步不是继续机械切文件，而是把 UI templates/skin、settings、picker、audio player、text cleaning、dialogue jobs 升级成真正模块 API，最终支持可替换 UI/skin JS。
- 重启后先回到真实 Tavo 聊天页，继续核对消息卡片、播放器和音色选择器，不要把当前正则页截图当作完成。
- 用真实 Tavo / 雷电模拟器验证音色选择器：单击试听，点 `√` 应用。
- 继续验证 `BUG-018`：adapter 可观测性补丁已写入 `gsv_tavo_adapter.py`，会把当前内存失败 job 保持为 `state=failed` 并记录 `[gsv_adapter] dialogue_stream_failed`。下一步必须用真实 Tavo/LDPlayer 在重启后的 adapter 上重新触发多音色 live stream，拿新 cache key；旧 key `eda219ac41c210002f57480cab469d26fc163d6f` 因 adapter 重启清空内存，只会返回 `missing`，不能再用来判断新逻辑。
- 用真实 Tavo 验证播放器按钮：保留上一条/下一条，移除可见 10 秒 seek UI。
- 复测局域网手机播放 `audio error code=4` 和 `audio.play() 不支持`。
- 把真实 Tavo 正则更新到 `v=2028881910`，重启 adapter 后复测：移动端 live 直走 Web Audio、保存音频 seek 不重拉、补角色后 LLM 拆段复用、设置页不再出现 `极致/离线`，runtime parts 和 CSS skin 都能在点击懒加载卡片后加载。
- 用同文本重新生成新 cache，核对 `白产品经理，你今晚在公司到底给她灌了多少啊？` 不再吞字；比较 `女声/风韵少妇` 与旁白电平，确认 `post_gain_db=9.0` 是否合适。
- 修 iPhone 14 Pro 真机弹层：设置页不能显示成一条长窄面板，点边缘/右上/空白不能误关闭。
- 修音色选择器层级：从设置页进入 `选择音色` 后，点音色选择器 `X` 必须回到设置页，不得直接回播放器。
- 修音色选择器 tab 误触：点 `日日新`、`全部` 等分类 tab 不能触发外部点击关闭。

## P1

- 继续模块化 `static/tavo.runtime.parts/`：把当前行为等价片段整理成真正模块 API。优先抽：CSS skin、HTML templates、message extraction/text cleaning、audio player、dialogue jobs、settings panel、voice picker/debug log。拆分时每步保持行为等价，避免和正在修的 bug 混成大补丁。
- 质量档重做：同文本、同角色、多音色流程测试 `sample_steps=24` 和 `sample_steps=32`。
- 每个测试输出放 `reports/<case>/`，不要放 `outputs/cache`。
- 每个生成音频先跑 Whisper CLI，再人工试听。
- 角色映射测试前从当前 Tavo 配置读取，不沿用旧名字。

## P2

- 真逐句 live streaming 优化。当前先保证多音色/句级声腔正确，低首包逐句流式后置。
- 建立更稳定的自动化回归脚本，覆盖前端基本行为、adapter 接口和 cache metadata。
- 训练向导和本地打包流程后置，先完成推理链路与真实 Tavo 稳定性。

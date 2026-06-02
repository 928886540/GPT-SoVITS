# Leon_api

`Leon_api/` 是 GPT-SoVITS / Tavo 本地产品验证工作区。README 只做入口和维护规则，不再塞完整交接流水账。

## 新会话入口

每次新 Codex 会话先读：

1. `AGENTS.md`
2. `docs/AGENT_STATE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DECISIONS.md`
5. `docs/BUGS.md`
6. `docs/TODO.md`
7. `docs/REGRESSION.md`

旧的 `handoff_docs/` 保留为历史档案。需要追溯早期验证时再读，不作为日常接手主入口。

## 维护规则

- README 保持短，只放入口、边界和文档索引。
- 当前状态写 `docs/AGENT_STATE.md`。
- 架构边界写 `docs/ARCHITECTURE.md`。
- 已拍板的取舍写 `docs/DECISIONS.md`。
- bug、复现、根因、修复点和防回归命令写 `docs/BUGS.md`。
- 下一步工作写 `docs/TODO.md`。
- 每次修复后的必跑验证写 `docs/REGRESSION.md`。
- 每修一个 bug，必须更新 `docs/BUGS.md`；如果同类问题复发，同步更新 `docs/REGRESSION.md`。
- 如果 Codex 上下文接近耗尽，先更新 `docs/AGENT_STATE.md` 和 TODO/BUGS/REGRESSION，再提醒结束当前会话并重开。

## 协作语气

默认中文，直接、简洁、哥们式沟通，适度用 emoji；调试时先说根因假设和证据。完整协作规则见 `AGENTS.md`。

## 项目边界

- 目标是给社区用户本机运行的本地整合包，不做公网服务，不托管统一远程 API。
- 官方 GPT-SoVITS 是当前主线：训练、音色制作、推理验证都优先走它。
- Genie-TTS 暂停为后续轻量运行时候选。
- 第三方仓库 `../gpt-sovits-official` 和 `../genie-tts` 默认保持干净，本地脚本、报告、样本和适配代码放在 `Leon_api/`。
- `outputs/cache` 只放真实 Tavo/runtime 缓存；Codex 测试音频放 `reports/...` 或专门非 cache 目录。
- 私有 key 和本机覆盖配置放 `local_private/*.ps1`，不提交 git。

## 常用入口

- Adapter health: `http://127.0.0.1:9880/health`
- Public adapter: `https://sovits.928886540.xyz`
- LAN adapter: `http://192.168.8.100:9880`
- Tavo loader: `https://sovits.928886540.xyz/static/tavo.js`
- P2 test page: `http://192.168.8.100:9880/p2_test`
- LAN 启动脚本: `dev_tools/start_adapter_lan.ps1`
- Whisper CLI: `D:\software\whisper-codex\transcribe.cmd`

## LLM 配置约定

Tavo 是本地客户端，LLM endpoint/model/key 可以在 Tavo 设置页给本机用户看和改；常见地址就是自己的反代，例如 `127.0.0.1:8317`。

硬约束只有一条：真实 key 不写进 README、`docs/`、`static/*.js`、报告或 git 提交。需要默认本机配置时，放到 `local_private/gsv_tavo_llm.ps1`。

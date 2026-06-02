# Decisions

## DEC-001: README 只做入口

Status: accepted

README 不再承载所有交接细节。当前状态、架构、bug、TODO 和回归验证分别维护在 `docs/`。

## DEC-002: 真实 Tavo 才算最终验证

Status: accepted

Tavo WebView、雷电模拟器、手机局域网播放和真实聊天消息是最终验证环境。mock 页面只能做语法、接口和视觉初筛。

## DEC-003: LLM 配置允许在 Tavo 客户端可见

Status: accepted

Tavo 是本地客户端，使用者就是本机用户。endpoint/model/key 可以出现在 Tavo 设置页，常见地址是 `127.0.0.1:8317` 或局域网反代。

约束：真实 key 不提交到 git，不写进 README、`docs/`、`static/*.js` 默认值或报告。需要本机默认值时放 `local_private/gsv_tavo_llm.ps1`。

## DEC-004: 不静默兜底 Tavo/TTS 配置错误

Status: accepted

缺音色映射、缺 `prompt_text`、服务不可用、参数非法时必须显式报错。不要自动选随机音色或吞掉错误，除非用户明确要求产品规则这样做。

## DEC-005: Voice Profile 必须有准确逐字稿

Status: accepted

GPT-SoVITS 可生成音色不是一个裸 wav/mp3 文件，而是 JSON Voice Profile。`prompt_text` 必须是参考音频逐字稿，不能用介绍文案代替。

## DEC-006: v2ProPlus 和 V4 双轨保留

Status: accepted

v2ProPlus 做稳定默认候选，V4 做情绪/抑扬顿挫候选。二者的权重、默认参数和缓存 key 分开保存。

## DEC-007: 模式命名改为普通模式 / 智能模式

Status: accepted, implementation in progress

前端产品文案不再用“单音色 / 多音色”作为主模式名，改为：

- 普通模式：本地 JS 清洗正文，不走 LLM 拆段；支持配置默认音色、旁白音色和对白音色。
- 智能模式：继续走 LLM 拆旁白、人物和声腔，并按角色映射选择 Voice Profile。

实现时要保持配置错误显式暴露，不要因为普通模式存在默认音色就随机兜底缺失配置。

## DEC-008: `static/tavo.runtime.js` 需要拆分，但保留单入口 loader

Status: accepted, first physical split implemented

`static/tavo.runtime.js` 已经超过 5000 行，后续继续改弹层、播放器、模式配置和文本清洗时冲突风险太高。下一步需要拆分 runtime，但保持 `static/tavo.js` 作为 Tavo 正则注入的唯一入口，避免每次内部重构都要求用户改正则。

拆分原则：

- 先记录计划，再做小步拆分；每步拆分后跑基础语法检查和真实 Tavo 回归。
- 不在同一个补丁里混合“普通/智能模式”与“弹层/播放器 bug”两条线。
- 拆分后仍要保证注入脚本幂等，不能重复挂 DOM、样式、事件监听或 AudioContext。

第一版采用行为等价的物理拆分：`static/tavo.runtime.js` 只负责懒加载 `static/tavo.runtime.parts/*.js`，parts 拼接后仍按原闭包执行。这样先解决单文件过大、token 消耗和并行冲突问题，不先重写业务逻辑。

已继续抽出 `static/tavo.runtime.parts/05_message_text_config.js`、`static/tavo.ui.skin.default.css` 和 `static/tavo.runtime.parts/25_ui_templates.js`，并把 runtime 继续按函数边界拆到 21 个 parts。当前仍保持行为等价，不改普通/智能模式、不改弹层/播放器 bug 逻辑。后续再把 UI templates/skin 从闭包片段升级成可替换 UI API。

## DEC-009: runtime 升级为 manifest/module registry，而不是继续机械切片

Status: accepted, Phase 1 locally implemented

当前 21 个 runtime parts 已由 `static/tavo.runtime.manifest.json` 声明模块列表和依赖，`static/tavo.runtime.js` 读取 manifest、校验并拓扑排序后仍拼接成一个闭包执行。Phase 1 已把“模块列表和顺序”从硬编码数组迁到配置，但还没有真正消除闭包共享依赖，也不方便后续替换 UI/skin。

后续按 `docs/RUNTIME_MODULARIZATION.md` 分阶段推进：

- Phase 1：已新增 `static/tavo.runtime.manifest.json`，让 loader 从 manifest 读取模块列表、依赖和版本，并拓扑排序后仍以 ordered-fragments 方式执行，业务行为不变；真实 Tavo 回归待做。
- Phase 2：引入轻量 module registry，允许新模块用 `define/require` 注册能力，同时兼容旧闭包片段。
- Phase 3：UI/skin 由 manifest 配置，默认 skin 行为不变，后续可新增可替换 UI。
- Phase 4：逐步把 TTS jobs、audio、tracks、settings、voice picker、generate flow 迁成显式 API。

约束：不引入 bundler，不假设 Tavo WebView 支持 ES module，不一次性重写业务逻辑；每阶段必须能回退到上一阶段并完成真实 Tavo 回归。

## DEC-010: Tavo AR 保留动态 loader，不走 iframe/RPC/服务端 bundle

Status: accepted

当前前端运行面是 Tavo 聊天消息里的 Advanced Rendering（AR），不是普通 H5 页面。`static/tavo.js` 通过正则 `<script src>` 注入消息后，后续 runtime 必须继续按 AR 约束运行：单消息生命周期、幂等挂载、尽量不污染长期 `window`、从入口脚本 `src` 推导同源静态资源 base，再动态加载支持文件。

因此当前路线是：

- 保留 `static/tavo.js -> static/tavo.runtime.js -> static/tavo.runtime.manifest.json -> static/tavo.runtime.parts/*.js -> eval`。
- 保留 manifest/config 驱动的 ordered-fragments loader，后续再小步迁 module registry。
- 不引入 hidden iframe bridge。
- 不引入 plain RPC、WebSocket、JSONP 或类似绕行层，除非用户明确批准并有真实 Tavo 证据证明必须这样做。
- 不把 runtime 改成服务端拼接 bundle 来替代 AR 动态加载。

`/parse_text` 请求不到 adapter 是 API POST 请求链路问题，应按 `Origin: null`、CORS/preflight、Tavo WebView fetch 能力、Cloudflare Tunnel 透传和后端日志逐项验证；不能用模块加载架构重写掩盖。

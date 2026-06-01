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

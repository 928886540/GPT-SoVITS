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

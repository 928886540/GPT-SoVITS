# Tavo Runtime Modularization Plan

更新时间：2026-06-02 20:36 +08:00

## 背景

当前 `static/tavo.runtime.js` 已经从单个大文件拆成 21 个 `static/tavo.runtime.parts/*.js` 片段。这个拆分降低了单次读文件的 token 成本，也减少了手工定位时的上下文压力，但它还不是真正模块化。

当前运行方式仍是：

```text
static/tavo.js
  -> 点击懒加载卡片
  -> static/tavo.runtime.js
  -> 并行 fetch 21 个 parts
  -> 按固定数组顺序拼接成一个 source
  -> eval 成一个共享闭包
```

所以现在的问题是：

- fetch 可以并行，但执行顺序仍靠硬编码数组。
- parts 之间通过闭包变量互相访问，不声明依赖。
- 新 UI/skin 想替换时，只能改 loader 或改闭包里的函数名。
- 任一人接手时仍要知道“为什么这个文件必须排在那个文件前面”。
- 继续拆文件已经收益不高，下一步应该把 loader 和模块边界升级，而不是机械切 runtime。

## 目标

目标不是一次性重写业务逻辑，而是把现有行为稳定迁到可配置、可替换、可回归的模块架构。

最终目标：

```text
static/tavo.js                         # Tavo 正则唯一入口，仍只负责懒加载卡片和启动 runtime
static/tavo.runtime.js                 # runtime kernel / module loader
static/tavo.runtime.manifest.json      # 模块、依赖、版本、skin 配置
static/tavo.runtime.modules/*.js       # 真模块，注册能力或导出 API
static/tavo.ui.skin.default.css        # 默认 CSS skin
static/tavo.ui.skin.*.css/js           # 后续可选 UI/skin
```

关键要求：

- `static/tavo.js` 仍是唯一 Tavo 正则入口，内部重构不要求用户每次重新导入规则。
- loader 先读 manifest，由 manifest 决定加载哪些模块和 skin。
- 模块有 `id`、`file`、`depends`、`provides`、`phase`，不再靠人记顺序。
- loader 对依赖做拓扑排序，检测缺依赖、重复 id、循环依赖，并打印明确错误。
- 支持按需替换 UI/skin，不影响 TTS/cache/audio 逻辑。
- 每一步都能回退到当前 ordered-parts 方式，真实 Tavo 回归不过不继续下一步。

## 非目标

本轮不做这些事：

- 不重写播放器、音频流、LLM 拆段、IndexedDB、设置页等业务逻辑。
- 不把所有 21 个 parts 一次性改成 ES module。Tavo WebView/AR 环境不应假设支持 `type="module"`。
- 不引入 bundler、npm 构建链或外部网络依赖。
- 不改变 `/static/tavo.js` 正则入口策略。
- 不把 BUG 修复和架构迁移混成一个不可回滚的大补丁。

## 迁移阶段

### Phase 0: 文档和接手保护

状态：已完成。

输出：

- 本文件 `docs/RUNTIME_MODULARIZATION.md`。
- `docs/ARCHITECTURE.md` 追加模块化目标入口。
- `docs/DECISIONS.md` 追加 manifest/module loader 决策。
- `docs/TODO.md` 追加分阶段任务。
- `docs/AGENT_STATE.md` 记录当前阶段和下一步。
- `static/tavo.runtime.parts/README.md` 标明当前仍是 ordered fragments，不是真模块。

完成标准：

- 新会话只读 docs 就知道当前架构缺陷、目标和下一步。
- 中途挂掉时，不需要从聊天记录恢复计划。

### Phase 1: manifest 驱动 ordered fragments

状态：已实现，本地验证通过，待真实 Tavo/雷电回归。

目标：不改 21 个 parts 的业务内容，只把 `static/tavo.runtime.js` 的硬编码 `PARTS` 数组搬到 manifest。

新增文件：

- `static/tavo.runtime.manifest.json`

manifest 第一版示例：

```json
{
  "schema": 1,
  "runtimeVersion": "20260602-ios-layer-v9",
  "mode": "ordered-fragments",
  "skin": {
    "default": "tavo.ui.skin.default.css"
  },
  "modules": [
    {
      "id": "base",
      "file": "tavo.runtime.parts/00_base_config_storage.js",
      "phase": "bootstrap",
      "depends": []
    },
    {
      "id": "message-config",
      "file": "tavo.runtime.parts/05_message_text_config.js",
      "phase": "bootstrap",
      "depends": ["base"]
    }
  ]
}
```

`static/tavo.runtime.js` 行为：

1. fetch manifest。
2. 验证 schema、module id、file、depends。
3. 拓扑排序得到执行顺序。
4. 并行 fetch 所有 `file`。
5. 按拓扑顺序拼接并 eval。
6. 如果 manifest 加载失败，可回退内置 ordered list，并打印明确 warning。

完成标准：

- 真实执行仍是旧闭包拼接，业务行为不变。
- `PARTS` 不再是唯一事实来源，manifest 成为模块列表来源。
- loader 能检测明显配置错误。
- `node --check static/tavo.runtime.js` 通过。
- 21 parts 拼接 `new Function(parts)` 通过。
- `/static/tavo.runtime.manifest.json` 返回 200 和 JSON content-type。

当前已完成：

- `static/tavo.runtime.manifest.json` 已新增，声明 21 个旧 parts 的 `id`、`file`、`phase`、`depends`，`runtimeVersion=20260602-ios-layer-v9`。
- `static/tavo.runtime.js` 已实现 manifest fetch、schema/module/file/depends 校验、拓扑排序、并行 fetch parts、按拓扑顺序拼接旧闭包执行。
- manifest 加载失败时会回退内置 ordered list，并打印 warning。
- 本地 `node --check`、manifest 21 modules 拼接 `new Function`、`python -m py_compile`、`git diff --check`、key 扫描已通过。
- 正则 cache-bust 已升到 `v=2028881916`，loader 为 `20260602-ios-layer-v26`。

仍未完成：

- 真实 Tavo/雷电端还没验证 manifest 请求、parts 请求顺序、CSS skin、播放器/设置页/音色选择器行为。
- 未验证 adapter 静态服务当前是否返回 `/static/tavo.runtime.manifest.json` 200。
- 未进入 Phase 2。

失败回滚：

- 恢复 `static/tavo.runtime.js` 中旧 `PARTS` 数组路径。
- 保留 manifest 文件也不会影响旧 loader。
- 正则 `v=` 回退到上一个验证版本。

### Phase 2: 模块注册 API，但继续兼容闭包片段

目标：给真模块准备运行时 API，同时不要求所有 parts 立刻迁移。

新增 kernel 能力：

```js
window.__gptsovitsRuntime = {
  define(id, deps, factory),
  require(id),
  provide(name, value),
  get(name),
  config,
  logger
}
```

迁移策略：

- `ordered-fragments` 仍支持旧闭包片段。
- 新模块可以用 `define()` 注册。
- manifest 允许 `mode: "hybrid"`。
- 旧闭包里的共享函数先不拆，只把 UI template / skin 这类低风险边界迁到注册 API。

优先迁移模块：

1. `25_ui_templates.js` -> `ui.templates`
2. `05_message_text_config.js` 中的 `ensureStyle()` -> `ui.skin`
3. voice picker 渲染函数 -> `ui.voicePicker`
4. debug/log helpers -> `core.log`

完成标准：

- hybrid 模式下旧闭包仍能跑。
- 至少一个 UI 模块通过 `define/require` 提供能力。
- 真实 Tavo 消息卡片、设置页、音色选择器、生成流程行为不变。

失败回滚：

- manifest 改回 `mode: "ordered-fragments"`。
- 新模块文件保留但不加载。

### Phase 3: UI/skin 可替换

目标：让 UI/skin 变成 manifest 可配置项，不再写死默认模板。

manifest 示例：

```json
{
  "ui": {
    "template": "default",
    "skin": "default"
  },
  "skins": {
    "default": {
      "css": "tavo.ui.skin.default.css",
      "module": "tavo.runtime.modules/ui.skin.default.js"
    }
  }
}
```

完成标准：

- 默认 UI/skin 行为不变。
- 可以新增一个实验 skin，不改 `static/tavo.js` 和业务模块。
- settings panel、voice picker、player shell 的尺寸约束仍满足 iPhone 回归要求。

失败回滚：

- manifest 指回 `default` skin。

### Phase 4: 业务模块拆出 API

目标：逐步把播放器、历史 cache、dialogue job、settings、voice picker 从闭包依赖迁到显式 API。

推荐顺序：

1. `tts.jobs`：请求构造、single/dialogue job 创建、cache key 语义。
2. `audio.context`：AudioContext 解锁、Web Audio stream、saved buffer replay。
3. `tracks.store`：Tavo storage、localStorage、IndexedDB、history restore。
4. `settings.panel`：设置页字段、保存、模式同步。
5. `voice.picker`：列表、分页、试听、应用。
6. `generate.flow`：普通/智能模式生成主流程。

每迁一个模块必须：

- 只改一个职责边界。
- 保留旧调用适配层，直到真实 Tavo 回归通过。
- 更新本文件的迁移状态。
- 更新 `docs/REGRESSION.md` 对应回归项。

## Token 成本说明

当前物理拆分已经降低“读全量 runtime”的 token 成本，但还没有降低“理解依赖”的成本。

升级后预期收益：

- Phase 1：减少 loader 变动冲突，依赖列表集中在 manifest，接手成本下降。
- Phase 2：开始减少跨文件隐式闭包依赖，定位 UI/skin 问题不必读 audio/cache。
- Phase 3：UI/skin 增加时不碰 TTS/audio 核心，降低回归范围。
- Phase 4：业务模块逐步有 API 边界，未来单模块 bug 不需要读 20 个文件。

## 中断接手规则

如果升级中途会话挂掉，新会话按这个顺序恢复：

1. 读 `AGENTS.md`、`README.md`、`docs/AGENT_STATE.md`、本文件、`docs/BUGS.md`、`docs/TODO.md`、`docs/REGRESSION.md`。
2. 跑 `git status --short`。
3. 看 `docs/AGENT_STATE.md` 顶部的“当前 runtime 模块化阶段”。
4. 如果 Phase 1 未验证通过，只允许修 loader/manifest，不迁业务模块。
5. 如果真实 Tavo 回归没过，不进入下一阶段。
6. 不回退 BUG-018/019/020 的代码和版本 bump，除非用户明确要求。

## 必跑验证

每次改 loader/manifest/module 后至少跑：

```powershell
node --check static\tavo.js
node --check static\tavo.runtime.js
```

```powershell
node -e "const fs=require('fs'); const parts=fs.readdirSync('static/tavo.runtime.parts').filter(x=>/^\d+_.*\.js$/.test(x)).sort(); const src=parts.map(p=>fs.readFileSync('static/tavo.runtime.parts/'+p,'utf8')).join('\n'); new Function(src); console.log('runtime parts ok', parts.length);"
```

```powershell
python -m py_compile gsv_tavo_adapter.py
git diff --check
rg -n "sk-[A-Za-z0-9]{8,}|GSV_TAVO_LLM_API_KEY\s*=\s*['\"][^<]" README.md docs static *.py
```

如果 adapter 正在跑，还要确认：

```powershell
curl.exe --noproxy * -s http://127.0.0.1:9880/health
curl.exe --noproxy * -I http://127.0.0.1:9880/static/tavo.runtime.manifest.json
curl.exe --noproxy * -I http://127.0.0.1:9880/static/tavo.runtime.js
```

## 当前下一步

下一步只做 Phase 1 回归：确认 adapter 能服务 manifest，真实 Tavo 正则刷新到 `v=2028881916`，验证 manifest loader 与旧 ordered array 行为等价。真实端没过之前不要进入 Phase 2，不要迁 UI/skin 真模块，不要改生成/播放业务逻辑。

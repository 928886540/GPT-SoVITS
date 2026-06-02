// GPT-SoVITS Tavo runtime part: 20_llm_segmentation.js // Source: static/tavo.runtime.js lines 1501-1630 before physical split. // Role: LLM parse, dialogue normalization, synthesis splitting // This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script. 
      "   - 如果说话人是「你」或用户身份名，role 统一写 \"用户\"（不写 \"你\"、不写用户身份名）。",
      "   - 不要把「我」当作用户；无引号的「我……」默认是第一人称叙述，role 写 \"旁白\"。只有明确处在引号/对白里的「我……」才按说话人归属。",
      "   - 其他人物优先从「已知角色名单」里挑名字;名单外的新人物用原文里的名字（如「林老师」「兰绯」「她」）。",
      "3. 「他说：」「她笑道：」「白夜雨说道：」这类引导句本身永远是旁白；只有后面引号里的直接台词才按说话人分配。",
      "4. text 是要朗读的原文片段，保留标点和语气词（啊、嗯、……）。",
      "5. style 是段级声腔/呼吸参考，只能从这个枚举里选：" + styleIdsText(),
      "   - 旁白、客观描写、普通对白 → neutral。",
      "   - 只是轻微带气声/柔声 → breath_soft 或 whisper_soft。",
      "   - 语义里有急促呼吸、压抑紧张 → tense_breath。",
      "   - 明显呼吸加重但仍在说话 → breath_heavy。",
      "   - 亲密、贴耳、黏连、短促气声 → intimate_breath，style_alpha 0.42-0.60。",
      "   - 明显的「嗯、啊、唔、哈、呼、……」等短促气音/短吟，必须用 moan_soft 或 breath_heavy，不要写 neutral。",
      "   - 委屈、哭腔、鼻音 → sob_soft 或 cry_soft。",
      "   - 撒娇、轻笑、惊讶分别用 tease_soft / laugh_soft / gasp_surprise。",
      "   - 如果文本明显呈现亲密互动的强度变化，用阶段型 style：stage_warmup=轻微升温；stage_rising=呼吸变重；stage_peak=高潮峰值/尖叫；stage_afterglow=余韵/低声放松。",
      "   - 明确是尖叫、峰值、高潮爆发时，可直接用 scream_peak；普通短促呻吟用 moan_soft。",
      "   - 如果想指定某个参考来源，优先用「声腔-人名」格式，例如 喘息-AD学姐、耳语-JOK、哭腔-步非烟；没有合适人名版本再用通用英文 style。",
      "   - 普通对话才用 neutral；亲密/情色场景里的喘息、呻吟、娇喘、抽气、断续语气词绝不能用 neutral，必须选对应声腔。",
      "   - 情色/做爱场景按强度递进选 style：前戏轻喘 → intimate_breath / breath_heavy；动作中持续呻吟 → moan_soft 或 喘息-人名；临近高潮 → stage_rising；高潮 → scream_peak / stage_peak；事后余韵 → low_murmur / stage_afterglow。这类段 style_alpha 给足 0.50-0.70，让气声真正盖上去，别绵软。",
      "",
      "完整性硬规则：",
      "- 必须覆盖输入原文 100%，按原文顺序输出，不要总结、改写、删字、漏掉最后一段。",
      "- 每个原文片段只能出现一次，不要把多段无关尾巴合并成一条对白。",
      "- 如果最后一个引号后还有动作/叙述/心理描写，最后一段必须是 role=\"旁白\"。",
      "- 不确定说话人时用 role=\"旁白\"，不要沿用上一句对白角色。",
      "",
      "style_alpha 控制声腔参考音频强度：neutral=0.12-0.20；轻微 style=0.34-0.46；明显 breath/moan/呻吟/喘息 参考=0.50-0.70；高潮 scream_peak/stage_peak 可到 0.70。",
      "不要输出额外字段；当前链路只使用 role/text/style/style_alpha。",
      "",
      "示例输入：",
      "她低着头，眼角有泪。「对不起，我真的撑不住了。」",
      (userName ? userName : "你") + "叹了口气，把手放在她肩上：「别哭。」",
      "示例输出：",
      "{\"segments\":[",
      "  {\"role\":\"旁白\",\"text\":\"她低着头，眼角有泪。\",\"style\":\"neutral\",\"style_alpha\":0.15},",
      "  {\"role\":\"她\",\"text\":\"对不起，我真的撑不住了。\",\"style\":\"sob_soft\",\"style_alpha\":0.42},",
      "  {\"role\":\"旁白\",\"text\":\"" + (userName ? userName : "你") + "叹了口气，把手放在她肩上：\",\"style\":\"neutral\",\"style_alpha\":0.15},",
      "  {\"role\":\"用户\",\"text\":\"别哭。\",\"style\":\"whisper_soft\",\"style_alpha\":0.45}",
      "]}"
    ].join("\n");
    setStatus("后端 LLM 分析中…");
    var maxTokens = llmMaxTokensForText(text);
    var parseUrl = cleanBase(cfg.apiBase) + cfg.parseEndpoint;
    var llmTarget = "LLM 访问位置: GPT-SoVITS adapter 后端；后端环境配置优先，前端字段只作兜底。前端 endpoint=" + (cfg.llmEndpoint || "(空)");
    debugLog("🔎 LLM 解析代理: parseUrl=" + parseUrl + ", " + llmTarget, "#ffd479");
    var res;
    try {
      res = await adapterFetch(parseUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text, endpoint: cfg.llmEndpoint || "", model: cfg.llmModel || "", api_key: cfg.llmApiKey || undefined, system_prompt: prompt, temperature: 0.2, timeout: 90, max_tokens: maxTokens }) });
    } catch (e) {
      throw new Error(formatNetworkError("LLM 解析代理 /parse_text", parseUrl, e, [
        llmTarget,
        "说明: 这里失败的是浏览器/Tavo WebView 到 GPT-SoVITS adapter /parse_text 的请求，后端还没机会访问 LLM。"
      ]));
    }
    if (!res.ok) throw new Error(formatHttpError("LLM 解析代理 /parse_text", parseUrl, res, await res.text(), [llmTarget, "说明: /parse_text 已经到达后端；如果响应里有 LLM proxy request failed，就是 adapter 访问 LLM 失败。"]));
    var data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error("LLM 解析代理 /parse_text 返回的不是合法 JSON。\n请求 URL: " + parseUrl + "\n" + llmTarget + "\n解析错误: " + (e && e.message ? e.message : e));
    }
    if (!data || !Array.isArray(data.segments) || !data.segments.length) throw new Error("AI 没有返回可用片段");
    var llmSec = Math.floor((Date.now() - llmStart) / 1000);
    setStatus("拆分完成 " + data.segments.length + " 段");
    debugLog("✅ LLM 返回 " + data.segments.length + " 段, 用时 " + llmSec + "s", "#9f9");
    try {
      data.segments.forEach(function (s, i) {
        debugLog("  [raw " + i + "] role=" + (s.role || "?") + "  style=" + normalizeStyleId(s.style || s.style_ref) + (s.style_alpha != null ? "  sα=" + s.style_alpha : "") + "  text=" + JSON.stringify(String(s.text || "").slice(0, 40)));
      });
    } catch (_) {}
    var sourceSearchOffset = 0;
    var normalizedSegments = data.segments.map(function (seg) {
      var style = normalizeStyleId(seg.style || seg.style_ref);
      var styleAlpha = Number(seg.style_alpha);
      if (!isFinite(styleAlpha)) styleAlpha = defaultStyleAlpha(style, cfg);
      styleAlpha = style === "neutral" ? Math.max(0.12, Math.min(0.20, styleAlpha)) : Math.max(0.30, Math.min(0.70, styleAlpha));
      var role = String(seg.role || "旁白").trim();
      var segTextForRole = String(seg.text || "");
      var sourceIdx = findSegmentTextInSource(text, segTextForRole, sourceSearchOffset);
      var insideQuote = false;
      if (sourceIdx >= 0) {
        sourceSearchOffset = sourceIdx + segTextForRole.length;
        insideQuote = quoteDepthAt(text, sourceIdx) > 0;
      }
      if (role && role !== "旁白" && !insideQuote) {
        debugLog("↩️ 无引号正文强制归旁白: role=" + role + " → 旁白 text=" + JSON.stringify(segTextForRole.slice(0, 32)), "#fc9");
        role = "旁白";
        style = "neutral";
        styleAlpha = 0.15;
      } else if (isUserRoleName(role, context)) {
        role = "用户";
      }
      if (role === "旁白") {
        style = "neutral";
        styleAlpha = 0.15;
      }
      return {
        role: role || "旁白",
        text: seg.text || "",
        style: style,
        style_alpha: styleAlpha
      };
    }).filter(function (seg) { return seg.text.trim(); });
    assertLlmSegmentsCoverSource(text, normalizedSegments);
    return normalizedSegments;
  }

  function removeLegacyGlobalGear() {
    ["sovits-tavo-global-gear", (LEGACY_PRODUCT_KEY + "-tavo-global-gear")].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    });
  }
  function removeSiblingLazyPlaceholders(activeRoot) {
    try {
      var roots = [];
      var msg = messageElement(script);
      if (msg && msg.querySelectorAll) roots = roots.concat($all(msg, ".idx-tts"));
      if (activeRoot && activeRoot.parentNode && activeRoot.parentNode.querySelectorAll) roots = roots.concat($all(activeRoot.parentNode, ".idx-tts"));
      var seen = [];
      roots.forEach(function (node) {
        if (!node || node === activeRoot || seen.indexOf(node) >= 0) return;
        seen.push(node);
        if (first(node, ".idx-lazy-card") && !first(node, ".idx-card") && node.parentNode) node.parentNode.removeChild(node);
      });
    } catch (_) {}
  }

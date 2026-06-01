// GPT-SoVITS Tavo runtime part: 32_llm_reuse_helpers.js
// Role: LLM parse reuse keys and reuse storage helpers scoped inside mountFull.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
    function parseReuseFingerprint(text) {
      return JSON.stringify({
        v: 3,
        text: String(text || ""),
        userName: String((context && context.userName) || ""),
        userAliases: normalizedUserAliases(context),
        characterName: String((context && context.characterName) || cfg.currentCharacterName || ""),
        llmEndpoint: String(cfg.llmEndpoint || ""),
        llmModel: String(cfg.llmModel || "")
      });
    }
    function parseReuseStorageKeys(fingerprint) {
      var keys = [];
      function add(k) { if (k && keys.indexOf(k) < 0) keys.push(k); }
      add("gptsovits_llm_parse_v3_" + parseReuseHash(fingerprint));
      if (messageId) add("gptsovits_llm_parse_" + parseReuseHash(String(messageId)) + "_" + parseReuseHash(fingerprint));
      add("gptsovits_llm_parse_" + parseReuseHash("message-" + parseReuseHash(messageText || "")) + "_" + parseReuseHash(fingerprint));
      return keys;
    }
    function parseReuseStorageKey(fingerprint) {
      return parseReuseStorageKeys(fingerprint)[0];
    }
    async function loadReusableSegments(text, context) {
      if (cfg.reuseLlmParse === false) return null;
      var fingerprint = parseReuseFingerprint(text);
      var keys = parseReuseStorageKeys(fingerprint);
      var record = null;
      var hitKey = "";
      for (var i = 0; i < keys.length && !record; i++) {
        var key = keys[i];
        try { record = JSON.parse(localStorage.getItem(key) || "null"); } catch (_) {}
        if (!record) {
          try { if (window.tavo && typeof tavo.get === "function") record = await tavo.get(key, "chat"); } catch (_) {}
        }
        if (record) hitKey = key;
      }
      if (!record || record.fingerprint !== fingerprint || !Array.isArray(record.segments) || !record.segments.length) return null;
      debugLog("♻️ 复用 LLM 拆段 cacheKey=" + hitKey + " segments=" + record.segments.length, "#9f9");
      setStatus("复用 LLM 拆段 " + record.segments.length + " 段");
      return normalizeSegmentsForContext(record.segments, context);
    }
    async function saveReusableSegments(text, segments) {
      if (cfg.reuseLlmParse === false || !Array.isArray(segments) || !segments.length) return;
      var fingerprint = parseReuseFingerprint(text);
      var keys = parseReuseStorageKeys(fingerprint);
      var record = { fingerprint: fingerprint, segments: cloneSegments(segments), createdAt: Date.now() };
      for (var i = 0; i < keys.length; i++) {
        try { localStorage.setItem(keys[i], JSON.stringify(record)); } catch (_) {}
        try { if (window.tavo && typeof tavo.set === "function") await tavo.set(keys[i], record, "chat"); } catch (_) {}
      }
      debugLog("💾 保存 LLM 拆段复用 cacheKey=" + keys[0] + " segments=" + segments.length, "#9ff");
    }
    async function parseWithOptionalReuse(text, cfg, setStatus, context) {
      var cached = await loadReusableSegments(text, context);
      if (cached && cached.length) return cached;
      var segments = await parseWithLlm(text, cfg, setStatus, context);
      await saveReusableSegments(text, segments);
      return segments;
    }
